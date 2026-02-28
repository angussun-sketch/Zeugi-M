# 收支管理模組 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 將「支出管理」升級為「收支管理」，全新模型重建，支援收入/支出統一管理，二級分類群組，資金帳戶，定期收支。

**Architecture:** 建立 4 個新 Prisma 模型（CashflowCategory, FundAccount, CashflowRecord, RecurringCashflow）取代舊的 ExpenseCategory/ExpenseRecord/RecurringExpense。前端用 tab 切換收款/付款，參考藍途記帳三合一設計。分錄引擎擴充支援收入科目。

**Tech Stack:** Next.js 16 + Prisma + shadcn/ui + TypeScript

---

### Task 1: Prisma Schema — 新增 4 個模型

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: 在 schema.prisma 新增 FundAccount 模型**

在 `ExpenseCategory` 模型之前（約 line 196 附近）加入：

```prisma
model FundAccount {
  id           String   @id @default(cuid())
  org_id       String
  org          Organization @relation(fields: [org_id], references: [id])
  name         String
  account_type String   @default("cash") // "cash" | "bank" | "credit_card" | "other"
  is_active    Boolean  @default(true)
  sort_order   Int      @default(0)
  created_at   DateTime @default(now())
  updated_at   DateTime @updatedAt

  cashflow_records    CashflowRecord[]
  recurring_cashflows RecurringCashflow[]

  @@unique([org_id, name])
  @@index([org_id])
}
```

**Step 2: 新增 CashflowCategory 模型**

```prisma
model CashflowCategory {
  id           String   @id @default(cuid())
  org_id       String
  org          Organization @relation(fields: [org_id], references: [id])
  direction    String   // "income" | "expense"
  group_name   String   // "成本·進貨" | "營業收入" etc.
  name         String   // "原料費" | "門市營收" etc.
  account_code String   // "5131" | "4111" etc.
  sort_order   Int      @default(0)
  created_at   DateTime @default(now())
  updated_at   DateTime @updatedAt

  cashflow_records    CashflowRecord[]
  recurring_cashflows RecurringCashflow[]

  @@unique([org_id, direction, group_name, name])
  @@index([org_id])
  @@index([direction])
}
```

**Step 3: 新增 CashflowRecord 模型**

```prisma
model CashflowRecord {
  id                    String    @id @default(cuid())
  entity_id             String
  entity                Entity    @relation(fields: [entity_id], references: [id])
  direction             String    // "income" | "expense"
  category_id           String
  category              CashflowCategory @relation(fields: [category_id], references: [id])
  fund_account_id       String?
  fund_account          FundAccount?     @relation(fields: [fund_account_id], references: [id])
  amount                Float
  record_date           DateTime
  description           String?
  source                String    @default("manual") // "manual" | "recurring"
  recurring_cashflow_id String?
  recurring_cashflow    RecurringCashflow? @relation(fields: [recurring_cashflow_id], references: [id], onDelete: SetNull)
  recorded_at           DateTime  @default(now())
  created_at            DateTime  @default(now())
  updated_at            DateTime  @updatedAt

  @@index([entity_id])
  @@index([category_id])
  @@index([fund_account_id])
  @@index([record_date])
  @@index([direction])
  @@index([recurring_cashflow_id])
}
```

**Step 4: 新增 RecurringCashflow 模型**

```prisma
model RecurringCashflow {
  id              String    @id @default(cuid())
  entity_id       String
  entity          Entity    @relation(fields: [entity_id], references: [id])
  direction       String    // "income" | "expense"
  name            String
  category_id     String
  category        CashflowCategory @relation(fields: [category_id], references: [id])
  fund_account_id String?
  fund_account    FundAccount?     @relation(fields: [fund_account_id], references: [id])
  amount          Float
  due_day         Int                // 每月幾號 (1-28)
  description     String?
  is_active       Boolean   @default(true)
  last_generated  DateTime?
  created_at      DateTime  @default(now())
  updated_at      DateTime  @updatedAt

  records         CashflowRecord[]

  @@index([entity_id])
  @@index([category_id])
}
```

**Step 5: 在 Organization 模型加入 relation 欄位**

在 `prisma/schema.prisma` 的 Organization 模型（line 12-24）加入：

```prisma
  fund_accounts        FundAccount[]
  cashflow_categories  CashflowCategory[]
```

**Step 6: 在 Entity 模型加入 relation 欄位**

在 Entity 模型（line 26-50）的 relations 區塊加入：

```prisma
  cashflow_records     CashflowRecord[]
  recurring_cashflows  RecurringCashflow[]
```

**Step 7: 執行 migration**

Run: `npx prisma migrate dev --name add_cashflow_models`
Expected: Migration created successfully

**Step 8: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add CashflowRecord, CashflowCategory, FundAccount, RecurringCashflow models"
```

---

### Task 2: Seed 預設分類與資金帳戶

**Files:**
- Modify: `prisma/seed.ts`

**Step 1: 在 seed.ts 加入預設資金帳戶**

在 accounts upsert 完成後（約 line 100 後），新增：

```typescript
// ---- 預設資金帳戶 ----
const fundAccounts = [
  { name: "現金", account_type: "cash", sort_order: 1 },
  { name: "銀行存款", account_type: "bank", sort_order: 2 },
  { name: "信用卡", account_type: "credit_card", sort_order: 3 },
  { name: "業主墊付", account_type: "other", sort_order: 4 },
];

for (const fa of fundAccounts) {
  await prisma.fundAccount.upsert({
    where: { org_id_name: { org_id: "default-org", name: fa.name } },
    update: {},
    create: { org_id: "default-org", ...fa },
  });
}
console.log(`Seeded ${fundAccounts.length} fund accounts`);
```

**Step 2: 加入預設收支分類**

```typescript
// ---- 預設收支分類 ----
const cashflowCategories = [
  // 支出分類
  { direction: "expense", group_name: "成本·進貨", name: "原料費", account_code: "5131", sort_order: 1 },
  { direction: "expense", group_name: "成本·進貨", name: "包裝費", account_code: "5158", sort_order: 2 },
  { direction: "expense", group_name: "薪資·人事", name: "薪資", account_code: "6111", sort_order: 1 },
  { direction: "expense", group_name: "薪資·人事", name: "勞健保", account_code: "6120", sort_order: 2 },
  { direction: "expense", group_name: "辦公·行政", name: "房租", account_code: "6112", sort_order: 1 },
  { direction: "expense", group_name: "辦公·行政", name: "水電費", account_code: "6119", sort_order: 2 },
  { direction: "expense", group_name: "辦公·行政", name: "文具用品", account_code: "6134", sort_order: 3 },
  { direction: "expense", group_name: "業務·行銷", name: "廣告費", account_code: "6134", sort_order: 1 },
  { direction: "expense", group_name: "業務·行銷", name: "交際費", account_code: "6134", sort_order: 2 },
  { direction: "expense", group_name: "手續費·稅務", name: "手續費", account_code: "6134", sort_order: 1 },
  { direction: "expense", group_name: "手續費·稅務", name: "稅捐", account_code: "6123", sort_order: 2 },
  { direction: "expense", group_name: "其他支出", name: "雜項支出", account_code: "6134", sort_order: 1 },
  // 收入分類
  { direction: "income", group_name: "營業收入", name: "門市營收", account_code: "4111", sort_order: 1 },
  { direction: "income", group_name: "營業收入", name: "批發收入", account_code: "4111", sort_order: 2 },
  { direction: "income", group_name: "營業收入", name: "外送平台收入", account_code: "4111", sort_order: 3 },
  { direction: "income", group_name: "營業外收入", name: "利息收入", account_code: "7111", sort_order: 1 },
  { direction: "income", group_name: "營業外收入", name: "補助收入", account_code: "4141", sort_order: 2 },
  { direction: "income", group_name: "營業外收入", name: "其他收入", account_code: "4141", sort_order: 3 },
];

for (const cat of cashflowCategories) {
  await prisma.cashflowCategory.upsert({
    where: {
      org_id_direction_group_name_name: {
        org_id: "default-org",
        direction: cat.direction,
        group_name: cat.group_name,
        name: cat.name,
      },
    },
    update: {},
    create: { org_id: "default-org", ...cat },
  });
}
console.log(`Seeded ${cashflowCategories.length} cashflow categories`);
```

**Step 3: 執行 seed**

Run: `npx prisma db seed`
Expected: Seeded successfully

**Step 4: Commit**

```bash
git add prisma/seed.ts
git commit -m "feat: seed default fund accounts and cashflow categories"
```

---

### Task 3: 擴充 chart-of-accounts 與 journal-engine

**Files:**
- Modify: `src/lib/chart-of-accounts.ts`
- Modify: `src/lib/journal-engine.ts`

**Step 1: 在 chart-of-accounts.ts 新增收入科目映射**

在 `ACCUM_DEPR_ACCOUNT` 之後（約 line 157 後）加入：

```typescript
// ---- 收入科目映射 ----
export const INCOME_ACCOUNT: Record<string, string> = {
  門市營收: SALES_REVENUE,
  批發收入: SALES_REVENUE,
  外送平台收入: SALES_REVENUE,
  勞務收入: SERVICE_REVENUE,
  利息收入: INTEREST_REVENUE,
  補助收入: OTHER_OPERATING_REVENUE,
  其他收入: OTHER_OPERATING_REVENUE,
};

export const DEFAULT_INCOME_CODE = SALES_REVENUE; // "4111"
```

**Step 2: 在 journal-engine.ts 新增收入分錄邏輯**

在 `generateEntries` 函式的開頭（line 93 的 `export function generateEntries` 內，在 owner_draw 判斷之前）加入收入處理：

```typescript
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
```

同時在 helper 區塊加入 `getIncomeCode`：

```typescript
function getIncomeCode(categoryName?: string): string {
  if (!categoryName) return DEFAULT_INCOME_CODE;
  if (/^\d{4}$/.test(categoryName)) return categoryName;
  if (INCOME_ACCOUNT[categoryName]) return INCOME_ACCOUNT[categoryName];
  for (const [key, code] of Object.entries(INCOME_ACCOUNT)) {
    if (categoryName.includes(key) || key.includes(categoryName)) return code;
  }
  return DEFAULT_INCOME_CODE;
}
```

需要在 import 加入：

```typescript
import {
  // ...existing imports...
  INCOME_ACCOUNT,
  DEFAULT_INCOME_CODE,
} from "@/lib/chart-of-accounts";
```

**Step 3: 驗證 build**

Run: `npx next build`
Expected: Build 成功

**Step 4: Commit**

```bash
git add src/lib/chart-of-accounts.ts src/lib/journal-engine.ts
git commit -m "feat: add income account mappings and journal entry generation for income"
```

---

### Task 4: 收支管理 Server Actions

**Files:**
- Create: `src/actions/cashflow.ts`

**Step 1: 建立完整的 cashflow server actions**

```typescript
"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getCurrentEntity } from "@/lib/multi-entity";
import { createTransaction } from "@/actions/finance";

// ============ CashflowCategory CRUD ============

export async function getCashflowCategories(direction?: "income" | "expense") {
  const { orgId } = await getCurrentEntity();
  return prisma.cashflowCategory.findMany({
    where: {
      org_id: orgId,
      ...(direction ? { direction } : {}),
    },
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
    data: { org_id: orgId, ...data },
  });
  revalidatePath("/cashflow");
  return category;
}

export async function updateCashflowCategory(
  id: string,
  data: { name?: string; group_name?: string; account_code?: string }
) {
  const category = await prisma.cashflowCategory.update({
    where: { id },
    data,
  });
  revalidatePath("/cashflow");
  return category;
}

export async function deleteCashflowCategory(id: string) {
  const cat = await prisma.cashflowCategory.findUnique({
    where: { id },
    include: { _count: { select: { cashflow_records: true, recurring_cashflows: true } } },
  });
  if (!cat) throw new Error("分類不存在");
  if (cat._count.cashflow_records > 0 || cat._count.recurring_cashflows > 0) {
    throw new Error(`「${cat.name}」已有關聯紀錄，無法刪除`);
  }
  await prisma.cashflowCategory.delete({ where: { id } });
  revalidatePath("/cashflow");
}

// ============ FundAccount CRUD ============

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
    data: { org_id: orgId, name: data.name, account_type: data.account_type },
  });
  revalidatePath("/cashflow");
  return account;
}

export async function updateFundAccount(
  id: string,
  data: { name?: string; account_type?: string; is_active?: boolean }
) {
  const account = await prisma.fundAccount.update({
    where: { id },
    data,
  });
  revalidatePath("/cashflow");
  return account;
}

export async function deleteFundAccount(id: string) {
  const fa = await prisma.fundAccount.findUnique({
    where: { id },
    include: { _count: { select: { cashflow_records: true } } },
  });
  if (!fa) throw new Error("帳戶不存在");
  if (fa._count.cashflow_records > 0) {
    throw new Error(`「${fa.name}」已有關聯紀錄，無法刪除`);
  }
  await prisma.fundAccount.delete({ where: { id } });
  revalidatePath("/cashflow");
}

// ============ CashflowRecord CRUD ============

type CashflowRecordFilters = {
  page?: number;
  direction?: string;
  dateFrom?: string;
  dateTo?: string;
  categoryId?: string;
  fundAccountId?: string;
  source?: string;
};

export async function getCashflowRecords(filters: CashflowRecordFilters = {}) {
  const { orgId } = await getCurrentEntity();
  const pageSize = 50;
  const page = filters.page || 1;

  const where: Record<string, unknown> = {
    entity: { org_id: orgId },
  };
  if (filters.direction) where.direction = filters.direction;
  if (filters.dateFrom || filters.dateTo) {
    where.record_date = {
      ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
      ...(filters.dateTo ? { lte: new Date(filters.dateTo + "T23:59:59") } : {}),
    };
  }
  if (filters.categoryId) where.category_id = filters.categoryId;
  if (filters.fundAccountId) where.fund_account_id = filters.fundAccountId;
  if (filters.source) where.source = filters.source;

  const [records, total] = await Promise.all([
    prisma.cashflowRecord.findMany({
      where,
      orderBy: [{ record_date: "desc" }, { recorded_at: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        category: true,
        fund_account: true,
        entity: { select: { name: true, tax_id: true } },
        recurring_cashflow: { select: { id: true, name: true } },
      },
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
  direction: string;
  category_id: string;
  fund_account_id?: string;
  amount: number;
  record_date: string;
  description?: string;
  entity_id?: string;
}) {
  const { entityId } = await getCurrentEntity();
  const finalEntityId = data.entity_id || entityId;

  const record = await prisma.cashflowRecord.create({
    data: {
      entity_id: finalEntityId,
      direction: data.direction,
      category_id: data.category_id,
      fund_account_id: data.fund_account_id || null,
      amount: data.amount,
      record_date: new Date(data.record_date),
      description: data.description || null,
      source: "manual",
    },
    include: { category: true, fund_account: true },
  });

  // 自動建立 Transaction
  const sourceType = data.direction === "income" ? "cashflow_income" : "cashflow_expense";
  const paymentMethod = record.fund_account
    ? fundAccountToPaymentMethod(record.fund_account.account_type)
    : "cash";

  await createTransaction({
    transaction_date: data.record_date,
    amount: data.amount,
    description: data.description ?? record.category.name,
    source_type: sourceType,
    source_id: record.id,
    payment_method: paymentMethod,
    has_payment: data.direction === "expense",
    has_receipt: false,
    has_invoice: false,
    tax_treatment: "deductible",
    expense_category_name: record.category.account_code,
    entity_id: finalEntityId,
  });

  revalidatePath("/cashflow");
  revalidatePath("/finance");
  return record;
}

function fundAccountToPaymentMethod(accountType: string): string {
  switch (accountType) {
    case "cash": return "cash";
    case "bank": return "bank";
    case "credit_card": return "credit_card";
    default: return "cash";
  }
}

export async function updateCashflowRecord(
  id: string,
  data: {
    category_id?: string;
    fund_account_id?: string;
    amount?: number;
    record_date?: string;
    description?: string;
  }
) {
  const record = await prisma.cashflowRecord.update({
    where: { id },
    data: {
      ...(data.category_id !== undefined && { category_id: data.category_id }),
      ...(data.fund_account_id !== undefined && { fund_account_id: data.fund_account_id || null }),
      ...(data.amount !== undefined && { amount: data.amount }),
      ...(data.record_date !== undefined && { record_date: new Date(data.record_date) }),
      ...(data.description !== undefined && { description: data.description || null }),
    },
  });
  revalidatePath("/cashflow");
  return record;
}

export async function deleteCashflowRecord(id: string) {
  await prisma.cashflowRecord.delete({ where: { id } });
  revalidatePath("/cashflow");
  revalidatePath("/finance");
}

// ============ RecurringCashflow CRUD ============

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
  direction: string;
  name: string;
  category_id: string;
  fund_account_id?: string;
  amount: number;
  due_day: number;
  description?: string;
}) {
  if (data.due_day < 1 || data.due_day > 28) {
    throw new Error("每月日期必須介於 1-28");
  }
  const { entityId } = await getCurrentEntity();
  const item = await prisma.recurringCashflow.create({
    data: {
      entity_id: entityId,
      direction: data.direction,
      name: data.name,
      category_id: data.category_id,
      fund_account_id: data.fund_account_id || null,
      amount: data.amount,
      due_day: data.due_day,
      description: data.description || null,
    },
  });
  revalidatePath("/cashflow");
  return item;
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
  }
) {
  if (data.due_day !== undefined && (data.due_day < 1 || data.due_day > 28)) {
    throw new Error("每月日期必須介於 1-28");
  }
  const item = await prisma.recurringCashflow.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.category_id !== undefined && { category_id: data.category_id }),
      ...(data.fund_account_id !== undefined && { fund_account_id: data.fund_account_id || null }),
      ...(data.amount !== undefined && { amount: data.amount }),
      ...(data.due_day !== undefined && { due_day: data.due_day }),
      ...(data.description !== undefined && { description: data.description || null }),
      ...(data.is_active !== undefined && { is_active: data.is_active }),
    },
  });
  revalidatePath("/cashflow");
  return item;
}

export async function deleteRecurringCashflow(id: string) {
  await prisma.recurringCashflow.delete({ where: { id } });
  revalidatePath("/cashflow");
}

export async function generateRecurringCashflows() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const day = today.getDate();

  const { orgId, entityId } = await getCurrentEntity();
  const items = await prisma.recurringCashflow.findMany({
    where: {
      entity: { org_id: orgId },
      is_active: true,
      due_day: day,
    },
    include: { category: true, fund_account: true },
  });

  const results: { name: string; created: boolean; reason?: string }[] = [];

  for (const item of items) {
    // 檢查本月是否已產生
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59);
    const existing = await prisma.cashflowRecord.findFirst({
      where: {
        recurring_cashflow_id: item.id,
        record_date: { gte: monthStart, lte: monthEnd },
      },
    });

    if (existing) {
      results.push({ name: item.name, created: false, reason: "本月已產生" });
      continue;
    }

    const record = await prisma.cashflowRecord.create({
      data: {
        entity_id: item.entity_id,
        direction: item.direction,
        category_id: item.category_id,
        fund_account_id: item.fund_account_id,
        amount: item.amount,
        record_date: new Date(year, month - 1, day),
        description: `${item.description ?? item.name}（自動產生）`,
        source: "recurring",
        recurring_cashflow_id: item.id,
      },
    });

    // 建立 Transaction
    const sourceType = item.direction === "income" ? "cashflow_income" : "cashflow_expense";
    const paymentMethod = item.fund_account
      ? fundAccountToPaymentMethod(item.fund_account.account_type)
      : "cash";

    await createTransaction({
      transaction_date: record.record_date.toISOString(),
      amount: item.amount,
      description: record.description ?? item.category.name,
      source_type: sourceType,
      source_id: record.id,
      payment_method: paymentMethod,
      has_payment: item.direction === "expense",
      has_receipt: false,
      has_invoice: false,
      tax_treatment: "deductible",
      expense_category_name: item.category.account_code,
      entity_id: item.entity_id,
    });

    await prisma.recurringCashflow.update({
      where: { id: item.id },
      data: { last_generated: today },
    });

    results.push({ name: item.name, created: true });
  }

  revalidatePath("/cashflow");
  revalidatePath("/finance");
  return { date: today.toISOString(), processed: results };
}
```

**Step 2: 驗證 build**

Run: `npx next build`
Expected: Build 成功

**Step 3: Commit**

```bash
git add src/actions/cashflow.ts
git commit -m "feat: add cashflow server actions (categories, fund accounts, records, recurring)"
```

---

### Task 5: 前端 — 收支管理主頁面（tab + 表單 + 列表）

**Files:**
- Create: `src/app/cashflow/page.tsx`
- Create: `src/app/cashflow/client.tsx`

**Step 1: 建立 server component page.tsx**

```typescript
export const dynamic = "force-dynamic";

import { getCashflowRecords, getCashflowCategories, getActiveFundAccounts } from "@/actions/cashflow";
import { getActiveEntities } from "@/actions/entities";
import { CashflowClient } from "./client";

export default async function CashflowPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const direction = (params.direction as string) || "";
  const dateFrom = (params.dateFrom as string) || "";
  const dateTo = (params.dateTo as string) || "";
  const categoryId = (params.category as string) || "";
  const source = (params.source as string) || "";

  const [result, categories, fundAccounts, entities] = await Promise.all([
    getCashflowRecords({
      page,
      direction: direction || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      categoryId: categoryId || undefined,
      source: source || undefined,
    }),
    getCashflowCategories(),
    getActiveFundAccounts(),
    getActiveEntities(),
  ]);

  return (
    <CashflowClient
      records={result.records}
      total={result.total}
      page={result.page}
      totalPages={result.totalPages}
      categories={categories}
      fundAccounts={fundAccounts}
      entities={entities}
      filters={{ direction, dateFrom, dateTo, categoryId, source }}
    />
  );
}
```

**Step 2: 建立 client.tsx**

這是最大的檔案，包含：
- **Tab 切換**（+ 收款 / - 付款）
- **快速輸入表單**（上方，依 tab 過濾對應分類）
- **紀錄列表**（下方，帶篩選與分頁）
- **設定按鈕**（開啟 Dialog）

完整程式碼見 Task 5 Step 2 的實作。client.tsx 的核心結構：

```typescript
"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { EntityCombobox } from "@/components/entity-combobox";
import {
  createCashflowRecord, updateCashflowRecord, deleteCashflowRecord,
  getCashflowCategories, createCashflowCategory, deleteCashflowCategory,
  getActiveFundAccounts, createFundAccount, updateFundAccount, deleteFundAccount,
  getRecurringCashflows, createRecurringCashflow, updateRecurringCashflow, deleteRecurringCashflow,
} from "@/actions/cashflow";

// Type definitions for props
// ... (matching server action return types)

export function CashflowClient({ records, total, page, totalPages, categories, fundAccounts, entities, filters }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Tab state
  const [activeTab, setActiveTab] = useState<"income" | "expense">(
    (filters.direction as "income" | "expense") || "expense"
  );

  // Quick-input form state
  const [formEntityId, setFormEntityId] = useState("");
  const [formCategoryId, setFormCategoryId] = useState("");
  const [formFundAccountId, setFormFundAccountId] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formDate, setFormDate] = useState(new Date().toISOString().split("T")[0]);
  const [formDescription, setFormDescription] = useState("");
  const [saving, setSaving] = useState(false);

  // Filter state
  // ... dateFrom, dateTo, etc.

  // Settings dialog states
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"categories" | "accounts" | "recurring">("categories");

  // -- Tab 切換時更新 URL direction filter --
  function handleTabChange(tab: "income" | "expense") {
    setActiveTab(tab);
    setFormCategoryId(""); // reset category selection
    // navigate with direction filter
  }

  // -- 快速新增 --
  async function handleQuickAdd() {
    if (!formCategoryId || !formAmount) return;
    setSaving(true);
    try {
      await createCashflowRecord({
        direction: activeTab,
        category_id: formCategoryId,
        fund_account_id: formFundAccountId || undefined,
        amount: parseFloat(formAmount),
        record_date: formDate,
        description: formDescription || undefined,
        entity_id: formEntityId || undefined,
      });
      // reset form (keep date & entity for repeated entry)
      setFormCategoryId("");
      setFormAmount("");
      setFormDescription("");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  // -- 分類按群組分組（二級下拉） --
  const filteredCategories = categories.filter((c) => c.direction === activeTab);
  const groupedCategories = filteredCategories.reduce((groups, cat) => {
    if (!groups[cat.group_name]) groups[cat.group_name] = [];
    groups[cat.group_name].push(cat);
    return groups;
  }, {} as Record<string, typeof filteredCategories>);

  // Render
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">收支管理</h2>
        <Button variant="outline" onClick={() => setSettingsOpen(true)}>設定</Button>
      </div>

      {/* Tab: + 收款 / - 付款 */}
      <div className="flex gap-2">
        <Button
          variant={activeTab === "income" ? "default" : "outline"}
          onClick={() => handleTabChange("income")}
        >
          + 收款
        </Button>
        <Button
          variant={activeTab === "expense" ? "default" : "outline"}
          onClick={() => handleTabChange("expense")}
        >
          - 付款
        </Button>
      </div>

      {/* Quick Input Form */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <EntityCombobox entities={entities} value={formEntityId} onChange={setFormEntityId} />
            {/* 資金帳戶 */}
            {/* 日期 */}
            {/* 分類（grouped select） */}
            {/* 金額 */}
            {/* 備註 */}
            {/* 新增按鈕 */}
          </div>
        </CardContent>
      </Card>

      {/* Filter + Records Table */}
      {/* ... filters, table, pagination ... */}

      {/* Settings Dialog */}
      {/* ... categories / fund accounts / recurring management ... */}
    </div>
  );
}
```

**注意事項：**
- 分類下拉使用 `<SelectGroup>` + `<SelectLabel>` 實現二級群組視覺效果
- 快速輸入後只重設金額、分類、備註，保留日期和統編（方便連續輸入）
- 列表同時顯示收入和支出，用 Badge 區分方向
- 金額格式化：收入顯示綠色 +，支出顯示紅色 -

**Step 3: 驗證 build**

Run: `npx next build`
Expected: Build 成功

**Step 4: Commit**

```bash
git add src/app/cashflow/
git commit -m "feat: add cashflow management page with income/expense tabs"
```

---

### Task 6: 前端 — 設定面板（分類管理 + 資金帳戶 + 定期收支）

**Files:**
- Modify: `src/app/cashflow/client.tsx`（在 Task 5 的基礎上擴充 Settings Dialog）

**Step 1: 設定 Dialog 結構**

在 CashflowClient 內的 `settingsOpen` Dialog 中，用三個 tab 切換：
- **分類管理**：顯示群組化的分類列表，可新增/刪除，需選 direction + group_name + name + account_code
- **資金帳戶**：列表，新增/編輯/停用/刪除
- **定期收支**：列表（含 direction badge），新增/編輯/啟停/刪除

每個 tab 是獨立的 CRUD 介面，共用同一個 Dialog。

**Step 2: 分類管理 — 二級群組顯示**

```typescript
// 分類按 direction > group_name 分組顯示
// 收入分類和支出分類分開顯示
// 每個群組下列出子分類，附帶 account_code
// 新增分類：選 direction → 輸入 group_name → 輸入 name → 輸入 account_code
// 刪除分類：有關聯紀錄時不可刪除
```

**Step 3: 資金帳戶管理**

```typescript
// 帳戶列表：名稱、類型（cash/bank/credit_card/other）、狀態 badge
// 新增：輸入名稱 + 選類型
// 編輯：修改名稱/類型
// 停用/啟用 toggle
// 刪除：有關聯紀錄時不可刪除
```

**Step 4: 定期收支**

```typescript
// 列表：名稱、方向 badge、分類、金額、每月幾號、狀態、上次產生
// 新增/編輯 Dialog：direction、name、category（二級群組下拉）、amount、due_day（1-28）
// 啟停 toggle
// 刪除
```

**Step 5: 驗證 build**

Run: `npx next build`
Expected: Build 成功

**Step 6: Commit**

```bash
git add src/app/cashflow/client.tsx
git commit -m "feat: add settings panel for categories, fund accounts, and recurring cashflow"
```

---

### Task 7: Sidebar 更新與路由調整

**Files:**
- Modify: `src/components/sidebar-nav.tsx`
- Modify: `src/app/expenses/page.tsx`（加 redirect）

**Step 1: 更新 sidebar-nav.tsx**

將 navItems 中的：
```typescript
{ href: "/expenses", label: "支出管理" },
```
改為：
```typescript
{ href: "/cashflow", label: "收支管理" },
```

**Step 2: 在舊路由加 redirect**

在 `src/app/expenses/page.tsx` 加入 redirect 到 `/cashflow`，避免書籤失效：

```typescript
import { redirect } from "next/navigation";

export default function ExpensesPage() {
  redirect("/cashflow");
}
```

同樣處理 `src/app/expenses/recurring/page.tsx`。

**Step 3: 驗證 build**

Run: `npx next build`
Expected: Build 成功

**Step 4: Commit**

```bash
git add src/components/sidebar-nav.tsx src/app/expenses/
git commit -m "feat: rename sidebar to 收支管理, redirect /expenses to /cashflow"
```

---

### Task 8: 資料遷移 — ExpenseRecord → CashflowRecord

**Files:**
- Create: `scripts/migrate-expenses-to-cashflow.ts`

**Step 1: 撰寫遷移腳本**

```typescript
import { PrismaClient } from "@/generated/prisma";

const prisma = new PrismaClient();

async function main() {
  console.log("=== 開始遷移支出資料至收支管理 ===");

  // 1. 遷移 ExpenseCategory → CashflowCategory
  const oldCategories = await prisma.expenseCategory.findMany();
  console.log(`找到 ${oldCategories.length} 個舊分類`);

  const categoryMap = new Map<string, string>(); // oldId → newId

  for (const cat of oldCategories) {
    // 檢查是否已存在對應的 CashflowCategory
    const existing = await prisma.cashflowCategory.findFirst({
      where: {
        org_id: cat.org_id,
        direction: "expense",
        name: cat.name,
      },
    });

    if (existing) {
      categoryMap.set(cat.id, existing.id);
      console.log(`  分類「${cat.name}」已存在，映射到 ${existing.id}`);
    } else {
      const newCat = await prisma.cashflowCategory.create({
        data: {
          org_id: cat.org_id,
          direction: "expense",
          group_name: "其他支出", // 舊分類無群組，暫歸「其他支出」
          name: cat.name,
          account_code: "6134", // 預設科目
        },
      });
      categoryMap.set(cat.id, newCat.id);
      console.log(`  分類「${cat.name}」已建立 → ${newCat.id}`);
    }
  }

  // 2. 取得預設資金帳戶（現金）
  const defaultFundAccount = await prisma.fundAccount.findFirst({
    where: { account_type: "cash" },
  });

  // 3. 遷移 ExpenseRecord → CashflowRecord
  const oldRecords = await prisma.expenseRecord.findMany();
  console.log(`\n找到 ${oldRecords.length} 筆舊支出紀錄`);

  let migratedRecords = 0;
  for (const rec of oldRecords) {
    const newCategoryId = categoryMap.get(rec.category_id);
    if (!newCategoryId) {
      console.warn(`  跳過紀錄 ${rec.id}：找不到對應分類`);
      continue;
    }

    await prisma.cashflowRecord.create({
      data: {
        entity_id: rec.entity_id,
        direction: "expense",
        category_id: newCategoryId,
        fund_account_id: defaultFundAccount?.id || null,
        amount: rec.amount,
        record_date: rec.expense_date,
        description: rec.description,
        source: rec.source,
        recorded_at: rec.recorded_at,
      },
    });
    migratedRecords++;
  }
  console.log(`已遷移 ${migratedRecords} 筆紀錄`);

  // 4. 遷移 RecurringExpense → RecurringCashflow
  const oldRecurring = await prisma.recurringExpense.findMany();
  console.log(`\n找到 ${oldRecurring.length} 筆舊定期支出`);

  for (const rec of oldRecurring) {
    const newCategoryId = categoryMap.get(rec.category_id);
    if (!newCategoryId) {
      console.warn(`  跳過定期支出 ${rec.id}：找不到對應分類`);
      continue;
    }

    await prisma.recurringCashflow.create({
      data: {
        entity_id: rec.entity_id,
        direction: "expense",
        name: rec.name,
        category_id: newCategoryId,
        fund_account_id: defaultFundAccount?.id || null,
        amount: rec.amount,
        due_day: rec.due_day,
        description: rec.description,
        is_active: rec.is_active,
        last_generated: rec.last_generated,
      },
    });
  }
  console.log(`已遷移 ${oldRecurring.length} 筆定期支出`);

  console.log("\n=== 遷移完成 ===");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

**Step 2: 執行遷移**

Run: `npx tsx scripts/migrate-expenses-to-cashflow.ts`
Expected: 遷移完成（筆數依實際資料而定）

**Step 3: Commit**

```bash
git add scripts/migrate-expenses-to-cashflow.ts
git commit -m "feat: add data migration script from expenses to cashflow"
```

---

### Task 9: 清理舊模型

**Files:**
- Modify: `prisma/schema.prisma`（移除 ExpenseCategory, ExpenseRecord, RecurringExpense）
- Delete: `src/actions/expenses.ts`
- Delete: `src/app/expenses/client.tsx`
- Delete: `src/app/expenses/recurring/client.tsx`
- Delete: `src/app/expenses/recurring/page.tsx`
- Modify: `src/actions/finance.ts`（移除 createTransactionFromExpense）

**Step 1: 從 schema.prisma 移除舊模型**

刪除 `ExpenseCategory`（line 197-209）、`ExpenseRecord`（line 211-229）、`RecurringExpense`（line 231-250）模型定義。

同時移除 Organization 和 Entity 中對舊模型的 relation 欄位：
- Organization: `expense_categories ExpenseCategory[]`
- Entity: `expense_records ExpenseRecord[]`, `recurring_expenses RecurringExpense[]`

**Step 2: 執行 migration**

Run: `npx prisma migrate dev --name remove_old_expense_models`
Expected: Migration 成功

**Step 3: 刪除舊檔案**

刪除 `src/actions/expenses.ts`。

清理 `src/app/expenses/` 目錄：保留 `page.tsx`（redirect），刪除 `client.tsx`、`recurring/client.tsx`。

**Step 4: 清理 finance.ts**

移除 `createTransactionFromExpense` 函式（line 602-622），因為不再需要。

更新 Transaction 的 `source_type` 註解：新增 `"cashflow_income"` | `"cashflow_expense"`。

**Step 5: 驗證 build**

Run: `npx next build`
Expected: Build 成功，無 import 錯誤

**Step 6: Commit**

```bash
git add -A
git commit -m "refactor: remove old expense models and migrate to cashflow"
```

---

### Task 10: 最終驗證

**Step 1: 啟動 dev server**

Run: `npm run dev -- --port 3010`

**Step 2: 瀏覽器驗證**

- 訪問 `/cashflow` — 頁面正確載入
- 切換 + 收款 / - 付款 tab
- 新增一筆收入：選分類、輸入金額、儲存
- 新增一筆支出：選分類、選資金帳戶、輸入金額、儲存
- 確認列表正確顯示
- 訪問 `/expenses` — 重導向到 `/cashflow`
- 設定面板：分類管理、資金帳戶、定期收支
- 確認 `/finance` 頁面能看到自動產生的 Transaction

**Step 3: Final commit（如有修正）**

```bash
git add -A
git commit -m "fix: final adjustments for cashflow module"
```
