"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import { createTransaction, deleteLinkedTransaction } from "@/actions/finance";
import { getCurrentEntity } from "@/lib/multi-entity";

// ==================== Helper ====================

function fundAccountToPaymentMethod(accountType: string): string {
  switch (accountType) {
    case "cash":
      return "cash";
    case "bank":
      return "bank";
    case "credit_card":
      return "credit_card";
    default:
      return "cash";
  }
}

// ==================== 收支分類 ====================

export async function getCashflowCategories(
  direction?: "income" | "expense",
) {
  const { orgId } = await getCurrentEntity();
  const where: Prisma.CashflowCategoryWhereInput = { org_id: orgId };
  if (direction) {
    where.direction = direction;
  }

  return prisma.cashflowCategory.findMany({
    where,
    orderBy: [{ direction: "asc" }, { group_name: "asc" }, { sort_order: "asc" }],
    include: {
      _count: { select: { cashflow_records: true, recurring_cashflows: true } },
    },
  });
}

export async function createCashflowCategory(data: {
  direction: string;
  group_name: string;
  name: string;
  account_code: string;
}) {
  const { orgId } = await getCurrentEntity();
  const category = await prisma.cashflowCategory.create({
    data: { ...data, org_id: orgId },
  });
  revalidatePath("/cashflow");
  return category;
}

export async function updateCashflowCategory(
  id: string,
  data: { name?: string; group_name?: string; account_code?: string },
) {
  const category = await prisma.cashflowCategory.update({
    where: { id },
    data,
  });
  revalidatePath("/cashflow");
  return category;
}

export async function deleteCashflowCategory(id: string) {
  const refs = await prisma.cashflowCategory.findUnique({
    where: { id },
    select: {
      name: true,
      _count: { select: { cashflow_records: true, recurring_cashflows: true } },
    },
  });

  if (refs) {
    const parts: string[] = [];
    if (refs._count.cashflow_records > 0)
      parts.push(`${refs._count.cashflow_records} 筆收支紀錄`);
    if (refs._count.recurring_cashflows > 0)
      parts.push(`${refs._count.recurring_cashflows} 筆循環收支`);
    if (parts.length > 0) {
      throw new Error(
        `無法刪除「${refs.name}」，尚有${parts.join("及")}使用中`,
      );
    }
  }

  await prisma.cashflowCategory.delete({ where: { id } });
  revalidatePath("/cashflow");
}

// ==================== 資金帳戶 ====================

export async function getFundAccounts() {
  const { orgId } = await getCurrentEntity();
  return prisma.fundAccount.findMany({
    where: { org_id: orgId },
    orderBy: [{ sort_order: "asc" }, { name: "asc" }],
  });
}

export async function getActiveFundAccounts() {
  const { orgId } = await getCurrentEntity();
  return prisma.fundAccount.findMany({
    where: { org_id: orgId, is_active: true },
    orderBy: [{ sort_order: "asc" }, { name: "asc" }],
  });
}

export async function createFundAccount(data: {
  name: string;
  account_type: string;
}) {
  const { orgId } = await getCurrentEntity();
  const account = await prisma.fundAccount.create({
    data: { ...data, org_id: orgId },
  });
  revalidatePath("/cashflow");
  return account;
}

export async function updateFundAccount(
  id: string,
  data: { name?: string; account_type?: string; is_active?: boolean },
) {
  const account = await prisma.fundAccount.update({
    where: { id },
    data,
  });
  revalidatePath("/cashflow");
  return account;
}

export async function deleteFundAccount(id: string) {
  const refs = await prisma.fundAccount.findUnique({
    where: { id },
    select: {
      name: true,
      _count: { select: { cashflow_records: true } },
    },
  });

  if (refs && refs._count.cashflow_records > 0) {
    throw new Error(
      `無法刪除「${refs.name}」，尚有 ${refs._count.cashflow_records} 筆收支紀錄使用中`,
    );
  }

  await prisma.fundAccount.delete({ where: { id } });
  revalidatePath("/cashflow");
}

// ==================== 收支紀錄 ====================

interface CashflowRecordFilters {
  page?: number;
  pageSize?: number;
  direction?: "income" | "expense";
  dateFrom?: string;
  dateTo?: string;
  categoryId?: string;
  fundAccountId?: string;
  source?: string; // "manual" | "recurring" | undefined (all)
}

export async function getCashflowRecords(
  filters: CashflowRecordFilters = {},
) {
  const {
    page = 1,
    pageSize = 50,
    direction,
    dateFrom,
    dateTo,
    categoryId,
    fundAccountId,
    source,
  } = filters;

  const { orgId } = await getCurrentEntity();
  const where: Prisma.CashflowRecordWhereInput = {
    entity: { org_id: orgId },
  };

  if (direction) {
    where.direction = direction;
  }

  if (dateFrom || dateTo) {
    where.record_date = {};
    if (dateFrom) where.record_date.gte = new Date(dateFrom);
    if (dateTo) where.record_date.lte = new Date(dateTo + "T23:59:59");
  }

  if (categoryId) {
    where.category_id = categoryId;
  }

  if (fundAccountId) {
    where.fund_account_id = fundAccountId;
  }

  if (source) {
    where.source = source;
  }

  const [records, total] = await Promise.all([
    prisma.cashflowRecord.findMany({
      where,
      include: {
        category: true,
        fund_account: true,
        entity: { select: { name: true, tax_id: true } },
        recurring_cashflow: { select: { id: true, name: true } },
      },
      orderBy: [{ record_date: "desc" }, { recorded_at: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.cashflowRecord.count({ where }),
  ]);

  return {
    records,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function createCashflowRecord(data: {
  direction: "income" | "expense";
  category_id: string;
  fund_account_id?: string;
  amount: number;
  record_date: string;
  description?: string;
  entity_id?: string;
}) {
  const entityId = data.entity_id ?? (await getCurrentEntity()).entityId;

  // Pre-fetch outside transaction (read-only, safe)
  const category = await prisma.cashflowCategory.findUnique({
    where: { id: data.category_id },
  });

  let paymentMethod = "cash";
  if (data.fund_account_id) {
    const fundAccount = await prisma.fundAccount.findUnique({
      where: { id: data.fund_account_id },
    });
    if (fundAccount) {
      paymentMethod = fundAccountToPaymentMethod(fundAccount.account_type);
    }
  }

  const sourceType =
    data.direction === "income" ? "cashflow_income" : "cashflow_expense";

  const result = await prisma.$transaction(async (tx) => {
    const record = await tx.cashflowRecord.create({
      data: {
        direction: data.direction,
        category_id: data.category_id,
        fund_account_id: data.fund_account_id || null,
        amount: data.amount,
        record_date: new Date(data.record_date),
        description: data.description || null,
        source: "manual",
        entity_id: entityId,
      },
    });

    const transaction = await createTransaction({
      transaction_date: data.record_date,
      amount: data.amount,
      description: data.description ?? category?.name ?? data.direction,
      source_type: sourceType,
      source_id: record.id,
      payment_method: paymentMethod,
      has_payment: true,
      has_receipt: false,
      has_invoice: false,
      tax_treatment: "deductible",
      expense_category_name: category?.account_code,
      entity_id: entityId,
    }, tx);

    // Write back transaction_id FK
    await tx.cashflowRecord.update({
      where: { id: record.id },
      data: { transaction_id: transaction.id },
    });

    return { ...record, transaction_id: transaction.id };
  });

  revalidatePath("/cashflow");
  revalidatePath("/finance");
  return result;
}

export async function updateCashflowRecord(
  id: string,
  data: {
    category_id?: string;
    fund_account_id?: string;
    amount?: number;
    record_date?: string;
    description?: string;
  },
) {
  const result = await prisma.$transaction(async (tx) => {
    const record = await tx.cashflowRecord.update({
      where: { id },
      data: {
        ...data,
        record_date: data.record_date ? new Date(data.record_date) : undefined,
      },
      include: { category: true, fund_account: true },
    });

    // Delete old Transaction, recreate with new data
    const sourceType =
      record.direction === "income" ? "cashflow_income" : "cashflow_expense";
    await deleteLinkedTransaction(sourceType, id, tx);

    const paymentMethod = record.fund_account
      ? fundAccountToPaymentMethod(record.fund_account.account_type)
      : "cash";

    const transaction = await createTransaction({
      transaction_date: record.record_date.toISOString(),
      amount: record.amount,
      description: record.description ?? record.category.name ?? record.direction,
      source_type: sourceType,
      source_id: record.id,
      payment_method: paymentMethod,
      has_payment: true,
      has_receipt: false,
      has_invoice: false,
      tax_treatment: "deductible",
      expense_category_name: record.category.account_code,
      entity_id: record.entity_id,
    }, tx);

    // Update FK
    await tx.cashflowRecord.update({
      where: { id },
      data: { transaction_id: transaction.id },
    });

    return record;
  });

  revalidatePath("/cashflow");
  revalidatePath("/finance");
  return result;
}

export async function deleteCashflowRecord(id: string) {
  await prisma.$transaction(async (tx) => {
    const record = await tx.cashflowRecord.findUnique({
      where: { id },
      select: { direction: true },
    });
    if (!record) return;

    const sourceType =
      record.direction === "income" ? "cashflow_income" : "cashflow_expense";
    await deleteLinkedTransaction(sourceType, id, tx);
    await tx.cashflowRecord.delete({ where: { id } });
  });

  revalidatePath("/cashflow");
  revalidatePath("/finance");
}

// ==================== 循環收支 ====================

export async function getRecurringCashflows() {
  const { orgId } = await getCurrentEntity();
  return prisma.recurringCashflow.findMany({
    where: { entity: { org_id: orgId } },
    orderBy: [{ is_active: "desc" }, { direction: "asc" }, { due_day: "asc" }],
    include: {
      category: true,
      fund_account: true,
      _count: { select: { records: true } },
    },
  });
}

export async function createRecurringCashflow(data: {
  direction: "income" | "expense";
  name: string;
  category_id: string;
  fund_account_id?: string;
  amount: number;
  due_day: number;
  description?: string;
}) {
  if (data.due_day < 1 || data.due_day > 28) {
    throw new Error("出款日必須在 1-28 之間");
  }

  const { entityId } = await getCurrentEntity();
  const recurring = await prisma.recurringCashflow.create({
    data: {
      direction: data.direction,
      name: data.name,
      category_id: data.category_id,
      fund_account_id: data.fund_account_id || null,
      amount: data.amount,
      due_day: data.due_day,
      description: data.description || null,
      entity_id: entityId,
    },
  });
  revalidatePath("/cashflow");
  return recurring;
}

export async function updateRecurringCashflow(
  id: string,
  data: {
    name?: string;
    category_id?: string;
    fund_account_id?: string;
    amount?: number;
    due_day?: number;
    description?: string;
    is_active?: boolean;
  },
) {
  if (data.due_day !== undefined && (data.due_day < 1 || data.due_day > 28)) {
    throw new Error("出款日必須在 1-28 之間");
  }

  const recurring = await prisma.recurringCashflow.update({
    where: { id },
    data,
  });
  revalidatePath("/cashflow");
  return recurring;
}

export async function deleteRecurringCashflow(id: string) {
  await prisma.recurringCashflow.delete({ where: { id } });
  revalidatePath("/cashflow");
}

// ==================== 排程核心 ====================

export async function generateRecurringCashflows() {
  const today = new Date();
  const todayDay = today.getDate();
  const year = today.getFullYear();
  const month = today.getMonth(); // 0-indexed

  // 找所有啟用中且今天到期的循環收支
  const { entityId } = await getCurrentEntity();
  const dueItems = await prisma.recurringCashflow.findMany({
    where: { entity_id: entityId, is_active: true, due_day: todayDay },
    include: { category: true, fund_account: true },
  });

  const results: { name: string; created: boolean; reason?: string }[] = [];

  for (const item of dueItems) {
    // 檢查本月是否已產生（防重複）
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0, 23, 59, 59);

    const existing = await prisma.cashflowRecord.findFirst({
      where: {
        recurring_cashflow_id: item.id,
        record_date: { gte: monthStart, lte: monthEnd },
      },
    });

    if (existing) {
      results.push({
        name: item.name,
        created: false,
        reason: "本月已產生",
      });
      continue;
    }

    // 產生紀錄 + 財務交易（原子化）
    const sourceType =
      item.direction === "income" ? "cashflow_income" : "cashflow_expense";
    const paymentMethod = item.fund_account
      ? fundAccountToPaymentMethod(item.fund_account.account_type)
      : "cash";

    await prisma.$transaction(async (tx) => {
      const genRecord = await tx.cashflowRecord.create({
        data: {
          direction: item.direction,
          category_id: item.category_id,
          fund_account_id: item.fund_account_id,
          amount: item.amount,
          record_date: today,
          description: `${item.name}（自動產生）`,
          source: "recurring",
          recurring_cashflow_id: item.id,
          entity_id: entityId,
        },
      });

      const transaction = await createTransaction({
        transaction_date: today.toISOString(),
        amount: item.amount,
        description: `${item.name}（自動產生）`,
        source_type: sourceType,
        source_id: genRecord.id,
        payment_method: paymentMethod,
        has_payment: true,
        has_receipt: false,
        has_invoice: false,
        tax_treatment: "deductible",
        expense_category_name: item.category.account_code,
        entity_id: entityId,
      }, tx);

      // Write back transaction_id FK
      await tx.cashflowRecord.update({
        where: { id: genRecord.id },
        data: { transaction_id: transaction.id },
      });

      await tx.recurringCashflow.update({
        where: { id: item.id },
        data: { last_generated: today },
      });
    });

    results.push({ name: item.name, created: true });
  }

  revalidatePath("/cashflow");
  revalidatePath("/finance");
  return { date: today.toISOString(), processed: results };
}
