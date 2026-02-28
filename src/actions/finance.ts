"use server";

import { PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import {
  generateEntries,
  type JournalEntryInput,
} from "@/lib/journal-engine";
import { getCurrentEntity } from "@/lib/multi-entity";

type TxClient = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

// ============ 科目表 ============

export async function getAccounts() {
  const { orgId } = await getCurrentEntity();
  return prisma.account.findMany({
    where: { org_id: orgId },
    orderBy: { code: "asc" },
    include: {
      parent: { select: { id: true, code: true, name: true } },
      _count: { select: { journal_lines: true } },
    },
  });
}

export async function createAccount(data: {
  code: string;
  name: string;
  type: string;
  parent_id?: string;
}) {
  const { orgId } = await getCurrentEntity();
  const existing = await prisma.account.findFirst({
    where: { org_id: orgId, code: data.code },
  });
  if (existing) throw new Error(`科目代碼 ${data.code} 已存在`);

  const account = await prisma.account.create({ data: { ...data, org_id: orgId } });
  revalidatePath("/finance/accounts");
  return account;
}

export async function updateAccount(
  id: string,
  data: { name?: string; is_active?: boolean; parent_id?: string | null }
) {
  const account = await prisma.account.update({ where: { id }, data });
  revalidatePath("/finance/accounts");
  return account;
}

// ============ 交易 CRUD ============

const PAGE_SIZE = 20;

export async function getTransactions(filters?: {
  page?: number;
  dateFrom?: string;
  dateTo?: string;
  sourceType?: string;
  matchStatus?: string;
  taxTreatment?: string;
  status?: string;
}) {
  const page = filters?.page ?? 1;
  const { orgId } = await getCurrentEntity();
  const where: Record<string, unknown> = { entity: { org_id: orgId } };

  if (filters?.dateFrom || filters?.dateTo) {
    where.transaction_date = {
      ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
      ...(filters.dateTo
        ? { lte: new Date(filters.dateTo + "T23:59:59") }
        : {}),
    };
  }
  if (filters?.sourceType) where.source_type = filters.sourceType;
  if (filters?.matchStatus) where.match_status = filters.matchStatus;
  if (filters?.taxTreatment) where.tax_treatment = filters.taxTreatment;
  if (filters?.status) where.status = filters.status;

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: { transaction_date: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.transaction.count({ where }),
  ]);

  return {
    transactions,
    total,
    page,
    totalPages: Math.ceil(total / PAGE_SIZE),
  };
}

export async function getTransactionById(id: string) {
  return prisma.transaction.findUnique({
    where: { id },
    include: {
      journal_entries: {
        include: { lines: { include: { account: true } } },
        orderBy: { book_type: "asc" },
      },
      reconciliation_items: true,
    },
  });
}

async function applyJournalEntries(
  transactionId: string,
  entries: GeneratedEntriesResult,
  entityId: string,
  db: TxClient | PrismaClient = prisma,
) {
  // 刪除舊分錄 + 調節項
  await db.journalEntry.deleteMany({
    where: { transaction_id: transactionId },
  });
  await db.reconciliationItem.deleteMany({
    where: { transaction_id: transactionId },
  });

  // 取得所有科目 code → id 映射（同 org）
  const { orgId } = await getCurrentEntity();
  const accounts = await db.account.findMany({
    where: { org_id: orgId },
    select: { id: true, code: true },
  });
  const codeToId: Record<string, string> = {};
  for (const a of accounts) codeToId[a.code] = a.id;

  async function createEntry(entry: JournalEntryInput) {
    await db.journalEntry.create({
      data: {
        transaction_id: transactionId,
        entity_id: entityId,
        book_type: entry.book_type,
        entry_date: entry.entry_date,
        description: entry.description,
        lines: {
          create: entry.lines.map((l) => ({
            account_id: codeToId[l.account_code] ?? codeToId["5211"],
            debit: l.debit,
            credit: l.credit,
            description: l.description,
          })),
        },
      },
    });
  }

  // 內帳
  await createEntry(entries.internal);
  // 外帳
  if (entries.tax) await createEntry(entries.tax);
  // 調節項
  if (entries.reconciliation) {
    await db.reconciliationItem.create({
      data: {
        transaction_id: transactionId,
        ...entries.reconciliation,
      },
    });
  }
}

type GeneratedEntriesResult = ReturnType<typeof generateEntries>;

export async function createTransaction(data: {
  transaction_date: string;
  amount: number;
  description: string;
  source_type: string;
  source_id?: string;
  counterparty?: string;
  supplier_id?: string;
  payment_method: string;
  has_payment?: boolean;
  has_receipt?: boolean;
  has_invoice?: boolean;
  business_use?: boolean;
  tax_treatment?: string;
  tax_mode?: string;
  reason_code?: string;
  invoice_type?: string;
  invoice_number?: string;
  tax_rate?: number;
  tax_amount?: number;
  net_amount?: number;
  proof_type?: string;
  proof_note?: string;
  expense_category_name?: string;
  credit_account_override?: string;
  entity_id?: string;
}, db: TxClient | PrismaClient = prisma) {
  // 計算三方匹配狀態
  const flags = [
    data.has_payment ?? false,
    data.has_receipt ?? false,
    data.has_invoice ?? false,
  ];
  const trueCount = flags.filter(Boolean).length;
  const match_status =
    trueCount === 3 ? "fully_matched" : trueCount > 0 ? "partial" : "unmatched";

  const entityId = data.entity_id ?? (await getCurrentEntity()).entityId;
  const tx = await db.transaction.create({
    data: {
      transaction_date: new Date(data.transaction_date),
      amount: data.amount,
      description: data.description,
      source_type: data.source_type,
      source_id: data.source_id,
      counterparty: data.counterparty,
      supplier_id: data.supplier_id,
      payment_method: data.payment_method,
      has_payment: data.has_payment ?? false,
      has_receipt: data.has_receipt ?? false,
      has_invoice: data.has_invoice ?? false,
      match_status,
      business_use: data.business_use ?? true,
      tax_treatment: data.tax_treatment ?? "deductible",
      tax_mode: data.tax_mode ?? "mode1",
      reason_code: data.reason_code,
      invoice_type: data.invoice_type,
      invoice_number: data.invoice_number,
      tax_rate: data.tax_rate,
      tax_amount: data.tax_amount,
      net_amount: data.net_amount,
      proof_type: data.proof_type,
      proof_note: data.proof_note,
      entity_id: entityId,
    },
  });

  // 自動產生分錄
  const entries = generateEntries({
    ...tx,
    expense_category_name: data.expense_category_name,
    credit_account_override: data.credit_account_override,
  });
  await applyJournalEntries(tx.id, entries, entityId, db);

  revalidatePath("/finance");
  return tx;
}

export async function updateTransaction(
  id: string,
  data: {
    transaction_date?: string;
    amount?: number;
    description?: string;
    counterparty?: string;
    payment_method?: string;
    has_payment?: boolean;
    has_receipt?: boolean;
    has_invoice?: boolean;
    business_use?: boolean;
    tax_treatment?: string;
    tax_mode?: string;
    reason_code?: string;
    invoice_type?: string;
    invoice_number?: string;
    tax_rate?: number;
    tax_amount?: number;
    net_amount?: number;
    proof_type?: string;
    proof_note?: string;
    expense_category_name?: string;
  }
) {
  // 計算匹配狀態
  const current = await prisma.transaction.findUnique({ where: { id } });
  if (!current) throw new Error("交易不存在");

  const hp = data.has_payment ?? current.has_payment;
  const hr = data.has_receipt ?? current.has_receipt;
  const hi = data.has_invoice ?? current.has_invoice;
  const trueCount = [hp, hr, hi].filter(Boolean).length;
  const match_status =
    trueCount === 3 ? "fully_matched" : trueCount > 0 ? "partial" : "unmatched";

  const updateData: Record<string, unknown> = { ...data, match_status };
  if (data.transaction_date) {
    updateData.transaction_date = new Date(data.transaction_date);
  }
  delete updateData.expense_category_name;

  const tx = await prisma.transaction.update({
    where: { id },
    data: updateData,
  });

  // 重新產生分錄
  const entries = generateEntries({
    ...tx,
    expense_category_name: data.expense_category_name,
  });
  await applyJournalEntries(tx.id, entries, tx.entity_id);

  revalidatePath("/finance");
  return tx;
}

export async function deleteTransaction(id: string) {
  await prisma.transaction.delete({ where: { id } });
  revalidatePath("/finance");
}

export async function postTransaction(id: string) {
  const tx = await prisma.transaction.update({
    where: { id },
    data: { status: "posted" },
  });
  // 同步過帳分錄
  await prisma.journalEntry.updateMany({
    where: { transaction_id: id },
    data: { is_posted: true },
  });
  revalidatePath("/finance");
  return tx;
}

export async function voidTransaction(id: string) {
  await prisma.transaction.update({
    where: { id },
    data: { status: "voided" },
  });
  // 刪除分錄
  await prisma.journalEntry.deleteMany({
    where: { transaction_id: id },
  });
  await prisma.reconciliationItem.deleteMany({
    where: { transaction_id: id },
  });
  revalidatePath("/finance");
}

// ============ 分錄查詢 ============

export async function getJournalEntries(filters?: {
  page?: number;
  bookType?: string;
  dateFrom?: string;
  dateTo?: string;
  accountId?: string;
}) {
  const page = filters?.page ?? 1;
  const { orgId } = await getCurrentEntity();
  const where: Record<string, unknown> = { entity: { org_id: orgId } };

  if (filters?.bookType) where.book_type = filters.bookType;
  if (filters?.dateFrom || filters?.dateTo) {
    where.entry_date = {
      ...(filters?.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
      ...(filters?.dateTo
        ? { lte: new Date(filters.dateTo + "T23:59:59") }
        : {}),
    };
  }
  if (filters?.accountId) {
    where.lines = { some: { account_id: filters.accountId } };
  }

  const [entries, total] = await Promise.all([
    prisma.journalEntry.findMany({
      where,
      include: {
        lines: { include: { account: true } },
        transaction: { select: { id: true, description: true, status: true } },
      },
      orderBy: { entry_date: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.journalEntry.count({ where }),
  ]);

  return {
    entries,
    total,
    page,
    totalPages: Math.ceil(total / PAGE_SIZE),
  };
}

export async function getAccountBalance(
  accountId: string,
  bookType?: string,
  dateFrom?: string,
  dateTo?: string
) {
  const where: Record<string, unknown> = {
    account_id: accountId,
  };
  if (bookType || dateFrom || dateTo) {
    const entryWhere: Record<string, unknown> = {};
    if (bookType) entryWhere.book_type = bookType;
    if (dateFrom || dateTo) {
      entryWhere.entry_date = {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo ? { lte: new Date(dateTo + "T23:59:59") } : {}),
      };
    }
    where.entry = entryWhere;
  }

  const result = await prisma.journalLine.aggregate({
    where,
    _sum: { debit: true, credit: true },
  });

  return {
    debit: result._sum.debit ?? 0,
    credit: result._sum.credit ?? 0,
    balance: (result._sum.debit ?? 0) - (result._sum.credit ?? 0),
  };
}

// ============ 調節 ============

export async function getReconciliation(year: number, month: number) {
  return prisma.reconciliationItem.findMany({
    where: { period_year: year, period_month: month },
    include: {
      transaction: {
        select: { id: true, description: true, amount: true, tax_treatment: true },
      },
    },
    orderBy: { transaction: { transaction_date: "asc" } },
  });
}

export async function getReconciliationSummary(year: number, month: number) {
  const items = await getReconciliation(year, month);
  const byReason: Record<
    string,
    { count: number; totalDifference: number; items: typeof items }
  > = {};

  for (const item of items) {
    if (!byReason[item.reason_code]) {
      byReason[item.reason_code] = { count: 0, totalDifference: 0, items: [] };
    }
    byReason[item.reason_code].count++;
    byReason[item.reason_code].totalDifference += item.difference;
    byReason[item.reason_code].items.push(item);
  }

  return {
    totalItems: items.length,
    totalDifference: items.reduce((sum, i) => sum + i.difference, 0),
    byReason,
  };
}

// ============ 報表 ============

export async function getIncomeStatement(
  bookType: string,
  dateFrom: string,
  dateTo: string
) {
  // 取得所有收入+費用科目的彙總
  const lines = await prisma.journalLine.findMany({
    where: {
      entry: {
        book_type: bookType,
        entry_date: {
          gte: new Date(dateFrom),
          lte: new Date(dateTo + "T23:59:59"),
        },
      },
      account: { type: { in: ["revenue", "expense"] } },
    },
    include: { account: true },
  });

  // 彙總每個科目
  const accountTotals: Record<
    string,
    { code: string; name: string; type: string; debit: number; credit: number }
  > = {};

  for (const line of lines) {
    const key = line.account_id;
    if (!accountTotals[key]) {
      accountTotals[key] = {
        code: line.account.code,
        name: line.account.name,
        type: line.account.type,
        debit: 0,
        credit: 0,
      };
    }
    accountTotals[key].debit += line.debit;
    accountTotals[key].credit += line.credit;
  }

  const revenue = Object.values(accountTotals)
    .filter((a) => a.type === "revenue")
    .map((a) => ({ ...a, amount: a.credit - a.debit }));

  const expenses = Object.values(accountTotals)
    .filter((a) => a.type === "expense")
    .map((a) => ({ ...a, amount: a.debit - a.credit }));

  const totalRevenue = revenue.reduce((sum, r) => sum + r.amount, 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  return {
    revenue,
    expenses,
    totalRevenue,
    totalExpenses,
    netIncome: totalRevenue - totalExpenses,
  };
}

export async function getTrialBalance(bookType: string, dateTo: string) {
  const lines = await prisma.journalLine.findMany({
    where: {
      entry: {
        book_type: bookType,
        entry_date: { lte: new Date(dateTo + "T23:59:59") },
      },
    },
    include: { account: true },
  });

  const accountTotals: Record<
    string,
    { code: string; name: string; type: string; debit: number; credit: number }
  > = {};

  for (const line of lines) {
    const key = line.account_id;
    if (!accountTotals[key]) {
      accountTotals[key] = {
        code: line.account.code,
        name: line.account.name,
        type: line.account.type,
        debit: 0,
        credit: 0,
      };
    }
    accountTotals[key].debit += line.debit;
    accountTotals[key].credit += line.credit;
  }

  const accounts = Object.values(accountTotals).sort((a, b) =>
    a.code.localeCompare(b.code)
  );
  const totalDebit = accounts.reduce((sum, a) => sum + a.debit, 0);
  const totalCredit = accounts.reduce((sum, a) => sum + a.credit, 0);

  return { accounts, totalDebit, totalCredit, isBalanced: Math.abs(totalDebit - totalCredit) < 0.01 };
}

export async function getUnmatchedDocuments() {
  const { orgId } = await getCurrentEntity();
  return prisma.transaction.findMany({
    where: {
      entity: { org_id: orgId },
      status: { not: "voided" },
      OR: [
        { match_status: "unmatched" },
        { match_status: "partial" },
      ],
    },
    orderBy: { transaction_date: "desc" },
  });
}

// ============ PO / Expense 整合 ============

export async function createTransactionFromPO(
  purchaseOrderId: string,
  db: TxClient | PrismaClient = prisma,
) {
  const po = await db.purchaseOrder.findUnique({
    where: { id: purchaseOrderId },
    include: { supplier: true, items: true },
  });
  if (!po || !po.total_amount) return null;

  return createTransaction({
    transaction_date: po.order_date.toISOString(),
    amount: po.total_amount,
    description: `叫貨單 ${po.order_number}`,
    source_type: "purchase_order",
    source_id: po.id,
    counterparty: po.supplier?.name,
    supplier_id: po.supplier_id ?? undefined,
    payment_method: "cash",
    has_payment: true,
    has_receipt: true,
    has_invoice: false,
    tax_treatment: "deductible",
    expense_category_name: "進貨成本",
  }, db);
}

// ============ Transaction Helper ============

export async function deleteLinkedTransaction(
  sourceType: string,
  sourceId: string,
  db: TxClient | PrismaClient = prisma,
) {
  const existing = await db.transaction.findFirst({
    where: { source_type: sourceType, source_id: sourceId },
    select: { id: true },
  });
  if (existing) {
    await db.transaction.delete({ where: { id: existing.id } });
  }
  return existing?.id ?? null;
}

export type { TxClient };

