"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { createTransaction, deleteLinkedTransaction } from "@/actions/finance";
import { getCurrentEntity, assertEntityOwns } from "@/lib/multi-entity";
import { ASSET_ACCOUNT, ACCUM_DEPR_ACCOUNT } from "@/lib/chart-of-accounts";

// ============ 固定資產 CRUD ============

export async function getFixedAssets() {
  const { orgId } = await getCurrentEntity();
  return prisma.fixedAsset.findMany({
    where: { entity: { org_id: orgId } },
    orderBy: [{ is_active: "desc" }, { acquisition_date: "desc" }],
    include: {
      _count: { select: { depreciation_records: true } },
    },
  });
}

export async function getFixedAssetById(id: string) {
  return prisma.fixedAsset.findUnique({
    where: { id },
    include: {
      depreciation_records: {
        orderBy: [{ period_year: "asc" }, { period_month: "asc" }],
      },
    },
  });
}

export async function createFixedAsset(data: {
  name: string;
  category: string;
  acquisition_date: string;
  cost: number;
  residual_value?: number;
  useful_life_years: number;
  payment_method?: string;
  description?: string;
}) {
  const residual = data.residual_value ?? 0;
  const useful_life_months = data.useful_life_years * 12;
  const depreciable = data.cost - residual;
  const monthly_depreciation =
    useful_life_months > 0
      ? Math.round((depreciable / useful_life_months) * 100) / 100
      : 0;

  const { entityId } = await getCurrentEntity();
  const assetAccountCode = ASSET_ACCOUNT[data.category] ?? "1501";

  const asset = await prisma.$transaction(async (tx) => {
    const asset = await tx.fixedAsset.create({
      data: {
        name: data.name,
        category: data.category,
        acquisition_date: new Date(data.acquisition_date),
        cost: data.cost,
        residual_value: residual,
        useful_life_months,
        monthly_depreciation,
        net_book_value: data.cost,
        payment_method: data.payment_method ?? "cash",
        description: data.description || null,
        entity_id: entityId,
      },
    });

    await createTransaction({
      transaction_date: data.acquisition_date,
      amount: data.cost,
      description: `購置固定資產：${data.name}`,
      source_type: "fixed_asset",
      source_id: asset.id,
      payment_method: data.payment_method ?? "cash",
      has_payment: true,
      has_receipt: true,
      tax_treatment: "deductible",
      expense_category_name: assetAccountCode,
    }, tx);

    return asset;
  });

  revalidatePath("/finance/fixed-assets");
  revalidatePath("/finance");
  return asset;
}

export async function updateFixedAsset(
  id: string,
  data: {
    name?: string;
    description?: string;
    residual_value?: number;
    useful_life_years?: number;
  }
) {
  await assertEntityOwns("fixedAsset", id);
  const current = await prisma.fixedAsset.findUnique({ where: { id } });
  if (!current) throw new Error("資產不存在");

  const residual = data.residual_value ?? current.residual_value;
  const months =
    data.useful_life_years !== undefined
      ? data.useful_life_years * 12
      : current.useful_life_months;

  const depreciable = current.cost - residual;
  const monthly_depreciation =
    months > 0
      ? Math.round((depreciable / months) * 100) / 100
      : 0;
  const net_book_value = current.cost - current.accumulated_depreciation;

  const asset = await prisma.fixedAsset.update({
    where: { id },
    data: {
      name: data.name,
      description: data.description,
      residual_value: residual,
      useful_life_months: months,
      monthly_depreciation,
      net_book_value,
    },
  });

  revalidatePath("/finance/fixed-assets");
  return asset;
}

export async function deleteFixedAsset(id: string) {
  await assertEntityOwns("fixedAsset", id);
  const asset = await prisma.fixedAsset.findUnique({
    where: { id },
    include: { _count: { select: { depreciation_records: true } } },
  });
  if (!asset) throw new Error("資產不存在");
  if (asset._count.depreciation_records > 0) {
    throw new Error(
      `「${asset.name}」已有 ${asset._count.depreciation_records} 筆折舊紀錄，無法刪除`
    );
  }

  await prisma.$transaction(async (tx) => {
    await deleteLinkedTransaction("fixed_asset", id, tx);
    await tx.fixedAsset.delete({ where: { id } });
  });

  revalidatePath("/finance/fixed-assets");
  revalidatePath("/finance");
}

export async function disposeFixedAsset(id: string) {
  await assertEntityOwns("fixedAsset", id);
  const asset = await prisma.fixedAsset.findUnique({ where: { id } });
  if (!asset) throw new Error("資產不存在");

  await prisma.fixedAsset.update({
    where: { id },
    data: { is_active: false },
  });

  revalidatePath("/finance/fixed-assets");
}

// ============ 折舊排程 ============

export async function generateMonthlyDepreciation(overrideEntityId?: string) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;

  // 找出所有需要折舊的資產
  const entityId = overrideEntityId ?? (await getCurrentEntity()).entityId;
  const assets = await prisma.fixedAsset.findMany({
    where: { entity_id: entityId, is_active: true, is_fully_depreciated: false },
  });

  const results: { name: string; created: boolean; reason?: string }[] = [];

  for (const asset of assets) {
    // 檢查取得日期是否在本月之前（取得當月不提）
    const acqDate = new Date(asset.acquisition_date);
    const acqYM = acqDate.getFullYear() * 12 + acqDate.getMonth();
    const currentYM = year * 12 + (month - 1);
    if (currentYM <= acqYM) {
      results.push({ name: asset.name, created: false, reason: "取得當月不提折舊" });
      continue;
    }

    // 檢查本月是否已產生
    const existing = await prisma.depreciationRecord.findUnique({
      where: {
        asset_id_period_year_period_month: {
          asset_id: asset.id,
          period_year: year,
          period_month: month,
        },
      },
    });

    if (existing) {
      results.push({ name: asset.name, created: false, reason: "本月已提折舊" });
      continue;
    }

    // 計算折舊額（最後一期可能不足整月）
    const remaining = asset.cost - asset.residual_value - asset.accumulated_depreciation;
    if (remaining <= 0) {
      await prisma.fixedAsset.update({
        where: { id: asset.id },
        data: { is_fully_depreciated: true },
      });
      results.push({ name: asset.name, created: false, reason: "已提完折舊" });
      continue;
    }

    const amount = Math.min(asset.monthly_depreciation, remaining);
    const newAccumulated = asset.accumulated_depreciation + amount;
    const newNetBookValue = asset.cost - newAccumulated;
    const fullyDepreciated = newAccumulated >= asset.cost - asset.residual_value - 0.01;

    // Atomic: Transaction + DepreciationRecord + FixedAsset update
    const accumAccount = ACCUM_DEPR_ACCOUNT[asset.category] ?? "1601";

    await prisma.$transaction(async (tx) => {
      const transaction = await createTransaction({
        transaction_date: new Date(year, month - 1, 1).toISOString(),
        amount,
        description: `${asset.name} ${year}/${month} 折舊`,
        source_type: "depreciation",
        source_id: asset.id,
        payment_method: "non_cash",
        credit_account_override: accumAccount,
        has_payment: false,
        has_receipt: false,
        has_invoice: false,
        tax_treatment: "deductible",
        expense_category_name: "折舊費用",
      }, tx);

      await tx.depreciationRecord.create({
        data: {
          asset_id: asset.id,
          period_year: year,
          period_month: month,
          amount,
          transaction_id: transaction.id,
        },
      });

      await tx.fixedAsset.update({
        where: { id: asset.id },
        data: {
          accumulated_depreciation: newAccumulated,
          net_book_value: newNetBookValue,
          is_fully_depreciated: fullyDepreciated,
        },
      });
    });

    results.push({ name: asset.name, created: true });
  }

  revalidatePath("/finance/fixed-assets");
  revalidatePath("/finance");
  return { date: today.toISOString(), processed: results };
}
