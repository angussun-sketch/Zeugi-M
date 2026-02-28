"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getMeasureTypeForUnit, isPackageUnit, computeTotalQtyBase, type Unit } from "@/lib/units";
import { getCurrentEntity, assertOrgOwns } from "@/lib/multi-entity";

export async function getIngredients() {
  const { orgId } = await getCurrentEntity();
  return prisma.ingredient.findMany({
    where: { org_id: orgId },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { batch_inputs: true, purchase_order_items: true } },
    },
  });
}

export async function getIngredient(id: string) {
  return prisma.ingredient.findUnique({
    where: { id },
    include: {
      purchase_order_items: {
        include: {
          order: {
            select: {
              order_date: true,
              supplier: { select: { name: true } },
            },
          },
        },
        orderBy: { order: { order_date: "desc" } },
      },
    },
  });
}

export async function createIngredient(data: {
  name: string;
  measure_type: string;
}) {
  const { orgId } = await getCurrentEntity();
  const ingredient = await prisma.ingredient.create({ data: { ...data, org_id: orgId } });
  revalidatePath("/ingredients");
  return ingredient;
}

export async function updateIngredient(
  id: string,
  data: { name: string; measure_type: string },
) {
  await assertOrgOwns("ingredient", id);
  const ingredient = await prisma.ingredient.update({
    where: { id },
    data,
  });
  revalidatePath("/ingredients");
  return ingredient;
}

export async function deleteIngredient(id: string) {
  await assertOrgOwns("ingredient", id);
  const refs = await prisma.ingredient.findUnique({
    where: { id },
    select: {
      name: true,
      _count: { select: { batch_inputs: true, purchase_order_items: true } },
    },
  });

  if (refs) {
    const parts: string[] = [];
    if (refs._count.batch_inputs > 0)
      parts.push(`${refs._count.batch_inputs} 筆批次紀錄`);
    if (refs._count.purchase_order_items > 0)
      parts.push(`${refs._count.purchase_order_items} 筆叫貨紀錄`);
    if (parts.length > 0) {
      throw new Error(
        `無法刪除「${refs.name}」，尚有${parts.join("及")}使用中`,
      );
    }
  }

  await prisma.ingredient.delete({ where: { id } });
  revalidatePath("/ingredients");
}

// 快速新增/編輯原料：直接寫入原料的價格欄位（不建叫貨單）
export async function quickAddIngredient(data: {
  name: string;
  qty: number;
  unit: string;
  price: number;
  per_package_qty?: number;
  per_package_unit?: string;
}) {
  // 決定 measure_type
  const measureUnit = isPackageUnit(data.unit)
    ? (data.per_package_unit as Unit)
    : (data.unit as Unit);
  const measure_type = getMeasureTypeForUnit(measureUnit);

  const qty_base = computeTotalQtyBase(
    data.qty,
    data.unit,
    data.per_package_qty ?? null,
    data.per_package_unit ?? null,
  );
  const unit_cost_base = data.price / qty_base;

  const priceData = {
    unit_cost_base,
    purchase_qty: data.qty,
    purchase_unit: data.unit,
    per_package_qty: isPackageUnit(data.unit) ? (data.per_package_qty ?? null) : null,
    per_package_unit: isPackageUnit(data.unit) ? (data.per_package_unit ?? null) : null,
    subtotal: data.price,
  };

  // 找已存在的原料 → 更新；不存在 → 建立
  const { orgId } = await getCurrentEntity();
  let ingredient = await prisma.ingredient.findFirst({
    where: { org_id: orgId, name: data.name },
  });

  if (ingredient) {
    ingredient = await prisma.ingredient.update({
      where: { id: ingredient.id },
      data: { measure_type, ...priceData },
    });
  } else {
    ingredient = await prisma.ingredient.create({
      data: { name: data.name, measure_type, org_id: orgId, ...priceData },
    });
  }

  revalidatePath("/ingredients");
  return ingredient;
}

// 批次匯入：多筆一次建
export async function bulkAddIngredients(
  items: { name: string; qty: number; unit: string; price: number }[],
) {
  const results: { name: string; success: boolean; error?: string }[] = [];

  for (const item of items) {
    try {
      await quickAddIngredient(item);
      results.push({ name: item.name, success: true });
    } catch (e) {
      results.push({
        name: item.name,
        success: false,
        error: e instanceof Error ? e.message : "未知錯誤",
      });
    }
  }

  revalidatePath("/ingredients");
  return results;
}
