/**
 * 分錄引擎：根據 Transaction 自動產生內帳 & 外帳分錄 + 調節項
 *
 * 規則：
 * A. deductible → 內帳=費用+進項稅/付款, 外帳=同內帳, 調節=無
 * B. nondeductible / exclude_by_policy
 *    → 內帳=費用/付款
 *    → 外帳 Mode1=不產生 → 調節差異=+expense
 *    → 外帳 Mode2=同內帳但標記 → 報表做調整加回
 * C. owner_draw → 內帳=業主往來/付款, 外帳=同, 調節=無
 */

import {
  PAYMENT_ACCOUNT,
  EXPENSE_ACCOUNT,
  DEFAULT_EXPENSE_CODE,
  INPUT_VAT,
  OWNER_ACCOUNT_DEBIT,
  CASH_ON_HAND,
  INCOME_ACCOUNT,
  DEFAULT_INCOME_CODE,
} from "@/lib/chart-of-accounts";

// ---- 型別 ----

type TransactionInput = {
  id: string;
  transaction_date: Date;
  amount: number;
  description: string;
  source_type: string;
  payment_method: string;
  tax_treatment: string;
  tax_mode: string;
  tax_amount: number | null;
  net_amount: number | null;
  business_use: boolean;
  reason_code: string | null;
  // 用來決定費用科目
  expense_category_name?: string;
};

export type JournalLineInput = {
  account_code: string;
  debit: number;
  credit: number;
  description?: string;
};

export type JournalEntryInput = {
  book_type: "internal" | "tax";
  entry_date: Date;
  description: string;
  lines: JournalLineInput[];
};

export type ReconciliationInput = {
  period_year: number;
  period_month: number;
  internal_amount: number;
  tax_amount: number;
  difference: number;
  reason_code: string;
  description?: string;
};

export type GeneratedEntries = {
  internal: JournalEntryInput;
  tax: JournalEntryInput | null; // Mode1 非扣抵 → null
  reconciliation: ReconciliationInput | null;
};

// 科目常數皆從 chart-of-accounts.ts 引入
const INPUT_TAX_CODE = INPUT_VAT;
const OWNER_DRAW_CODE = OWNER_ACCOUNT_DEBIT;

// ---- 核心函式 ----

function getPaymentCode(method: string): string {
  return PAYMENT_ACCOUNT[method] ?? CASH_ON_HAND;
}

function getExpenseCode(categoryName?: string): string {
  if (!categoryName) return DEFAULT_EXPENSE_CODE;
  // 若直接傳入科目代碼（如 "1501"），直接返回
  if (/^\d{4}$/.test(categoryName)) return categoryName;
  // 嘗試完全匹配，再嘗試部分匹配
  if (EXPENSE_ACCOUNT[categoryName]) return EXPENSE_ACCOUNT[categoryName];
  for (const [key, code] of Object.entries(EXPENSE_ACCOUNT)) {
    if (categoryName.includes(key) || key.includes(categoryName)) return code;
  }
  return DEFAULT_EXPENSE_CODE;
}

function getIncomeCode(categoryName?: string): string {
  if (!categoryName) return DEFAULT_INCOME_CODE;
  if (/^\d{4}$/.test(categoryName)) return categoryName;
  if (INCOME_ACCOUNT[categoryName]) return INCOME_ACCOUNT[categoryName];
  for (const [key, code] of Object.entries(INCOME_ACCOUNT)) {
    if (categoryName.includes(key) || key.includes(categoryName)) return code;
  }
  return DEFAULT_INCOME_CODE;
}

export function generateEntries(tx: TransactionInput): GeneratedEntries {
  const paymentCode = getPaymentCode(tx.payment_method);
  const date = tx.transaction_date;
  const year = date.getFullYear();
  const month = date.getMonth() + 1;

  // ---- income (收入) ----
  if (tx.source_type === "cashflow_income") {
    const incomeCode = tx.expense_category_name && /^\d{4}$/.test(tx.expense_category_name)
      ? tx.expense_category_name
      : getIncomeCode(tx.expense_category_name);
    const lines: JournalLineInput[] = [
      { account_code: paymentCode, debit: tx.amount, credit: 0 },
      { account_code: incomeCode, debit: 0, credit: tx.amount, description: "營業收入" },
    ];
    const entry: JournalEntryInput = {
      book_type: "internal",
      entry_date: date,
      description: tx.description,
      lines,
    };
    const taxEntry: JournalEntryInput = {
      book_type: "tax",
      entry_date: date,
      description: tx.description,
      lines: [...lines],
    };
    return { internal: entry, tax: taxEntry, reconciliation: null };
  }

  // ---- owner_draw ----
  if (tx.tax_treatment === "owner_draw") {
    const lines: JournalLineInput[] = [
      { account_code: OWNER_DRAW_CODE, debit: tx.amount, credit: 0, description: "業主往來" },
      { account_code: paymentCode, debit: 0, credit: tx.amount },
    ];
    const entry: JournalEntryInput = {
      book_type: "internal",
      entry_date: date,
      description: tx.description,
      lines,
    };
    // 外帳同內帳（不列費用，走業主往來）
    const taxEntry: JournalEntryInput = {
      book_type: "tax",
      entry_date: date,
      description: tx.description,
      lines: [...lines],
    };
    return { internal: entry, tax: taxEntry, reconciliation: null };
  }

  // ---- deductible ----
  if (tx.tax_treatment === "deductible") {
    const expenseCode = getExpenseCode(tx.expense_category_name);
    const lines: JournalLineInput[] = [];

    if (tx.tax_amount && tx.net_amount) {
      // 有進項稅額
      lines.push({ account_code: expenseCode, debit: tx.net_amount, credit: 0 });
      lines.push({ account_code: INPUT_TAX_CODE, debit: tx.tax_amount, credit: 0, description: "進項稅額" });
    } else {
      lines.push({ account_code: expenseCode, debit: tx.amount, credit: 0 });
    }
    lines.push({ account_code: paymentCode, debit: 0, credit: tx.amount });

    const internal: JournalEntryInput = {
      book_type: "internal",
      entry_date: date,
      description: tx.description,
      lines,
    };
    // 外帳同內帳
    const tax: JournalEntryInput = {
      book_type: "tax",
      entry_date: date,
      description: tx.description,
      lines: [...lines],
    };
    return { internal, tax, reconciliation: null };
  }

  // ---- nondeductible / exclude_by_policy ----
  const expenseCode = getExpenseCode(tx.expense_category_name);
  const internalLines: JournalLineInput[] = [
    { account_code: expenseCode, debit: tx.amount, credit: 0 },
    { account_code: paymentCode, debit: 0, credit: tx.amount },
  ];
  const internal: JournalEntryInput = {
    book_type: "internal",
    entry_date: date,
    description: tx.description,
    lines: internalLines,
  };

  if (tx.tax_mode === "mode1") {
    // Mode1: 外帳不入 → 調節差異
    const reconciliation: ReconciliationInput = {
      period_year: year,
      period_month: month,
      internal_amount: tx.amount,
      tax_amount: 0,
      difference: tx.amount,
      reason_code: tx.reason_code ?? tx.tax_treatment,
      description: `${tx.description}（${tx.tax_treatment === "nondeductible" ? "不可扣抵" : "政策排除"}）`,
    };
    return { internal, tax: null, reconciliation };
  }

  // Mode2: 外帳入但標記（報表做調整加回）
  const taxLines: JournalLineInput[] = [
    { account_code: expenseCode, debit: tx.amount, credit: 0, description: "稅務調整加回" },
    { account_code: paymentCode, debit: 0, credit: tx.amount },
  ];
  const tax: JournalEntryInput = {
    book_type: "tax",
    entry_date: date,
    description: `${tx.description}（稅務調整）`,
    lines: taxLines,
  };
  const reconciliation: ReconciliationInput = {
    period_year: year,
    period_month: month,
    internal_amount: tx.amount,
    tax_amount: tx.amount,
    difference: 0,
    reason_code: tx.reason_code ?? `${tx.tax_treatment}_mode2`,
    description: `${tx.description}（Mode2 標記加回）`,
  };
  return { internal, tax, reconciliation };
}
