# ADR-002: 財務分錄原子性策略

**日期：** 2026-03-01
**狀態：** accepted
**決策者：** Phase 1 data integrity 計畫

## 背景

系統中每筆業務事件（叫貨、收支、折舊）需要同時建立多筆資料：

1. Transaction（交易主檔）
2. JournalEntry + JournalLine（內帳/外帳分錄）
3. ReconciliationItem（調節項，若內外帳有差異）
4. CashflowRecord（收支紀錄，若適用）

如果這些步驟部分失敗，會導致：

- 有 Transaction 但沒有分錄 → 報表數字不正確
- 有分錄但 debit != credit → 違反會計基本原則
- 有 CashflowRecord 但沒有對應 Transaction → 收支與財務脫鉤

## 考慮的方案

### 方案 A: 事後修復（eventual consistency）

- 優點：程式碼簡單；不需要 interactive transaction
- 缺點：需要背景修復 job；中間狀態可見；修復邏輯複雜

### 方案 B: Prisma interactive transaction（`$transaction(async (tx) => {...})`）

- 優點：原子性由 DB 保證；失敗自動 rollback；程式碼邏輯直覺
- 缺點：transaction 持有連線時間較長；需要把所有 DB client 參數化（`db: TxClient`）

### 方案 C: DB trigger / stored procedure

- 優點：完全在 DB 層保證
- 缺點：邏輯分散在 DB 和 app；Prisma 遷移管理困難；debug 困難

## 決策

選擇 **方案 B：Prisma interactive transaction**。

所有涉及多步驟寫入的 Server Action 必須在 `prisma.$transaction(async (tx) => {...})` 內執行。
被呼叫的內部函式（如 `createTransaction`、`applyJournalEntries`）接受 `db: TxClient | PrismaClient` 參數，
讓呼叫者決定是否在 transaction 內。

## 後果

- **正面：** 原子性由 PostgreSQL transaction 保證；失敗自動 rollback；invariant INV-1/INV-5 在 DB 層強制
- **負面/風險：**
  - Transaction 內的 `cookies()` 呼叫可能有 Next.js 限制（目前可行，但需注意）
  - 長時間 transaction 可能影響連線池（目前單使用者，風險低）
  - `createTransaction` 內的 `revalidatePath` 在 transaction 內呼叫是安全的（Next.js cache invalidation 不依賴 DB）
- **需要的後續行動：**
  - 已完成：`updateTransaction`、`postTransaction`、`voidTransaction` 包裝在 `$transaction` 內
  - 已完成：`createPurchaseOrder`、`createCashflowRecord` 等已原子化
  - 待辦：確認所有 `createTransaction` 的呼叫點都在 transaction context 內

## 相關文件

- [phase1-data-integrity.md](../plans/2026-03-01-phase1-data-integrity.md)
- `src/actions/finance.ts` — Transaction CRUD + `applyJournalEntries`
- `src/lib/journal-engine.ts` — 分錄規則引擎
- architecture.md: INV-1, INV-5
