# Zeugi-M — AI 開發指引

> 本檔案會在每次 Claude Code session 啟動時自動載入。
> 請在開始任何程式修改前，先讀取相關文件。

## 專案概覽

小型食品加工廠的 ERP 系統。Next.js 16 + Prisma 7 + PostgreSQL。
多主體架構：Organization → Entity（一對多）。

## 必讀文件（依情境）

| 你要做什麼 | 先讀這些 |
|---|---|
| 任何程式修改 | `CONTRIBUTING.md`（commit/PR 規範、註解標準） |
| Schema 變更 | `docs/change-management.md` + `docs/runbooks/migration.md` |
| 新增/修改 CRUD | `docs/architecture.md`（invariant 表）+ 下方安全規則 |
| 理解領域術語 | `docs/glossary.md` |
| 架構決策背景 | `docs/adr/` 目錄下的 ADR |
| 故障排查 | `docs/runbooks/troubleshooting.md` |
| 交接工作 | `docs/handoffs/HANDOFF_TEMPLATE.md` |

## 不可違反的規則

### 1. 多主體隔離
- 所有讀取查詢必須包含 `org_id` 或 `entity: { org_id }` 過濾
- 所有 update/delete 必須先呼叫 `assertOrgOwns()` 或 `assertEntityOwns()`
- 見 `src/lib/multi-entity.ts`

### 2. 財務原子性
- 涉及 Transaction + JournalEntry 的寫入必須在 `prisma.$transaction()` 內
- `sum(debit) === sum(credit)` 對每筆 JournalEntry 必須成立
- 見 `docs/adr/002-journal-atomicity.md`

### 3. Commit 格式
`<type>: <簡述>`，type = feat | fix | refactor | docs | chore | schema | perf
Schema 變更必須用 `schema:` prefix 且附帶 migration。

### 4. 程式註解
只寫「為什麼」和「限制」，不寫「正在做什麼」。
跨模組或高風險函式使用 `@pre/@post/@fails/@invariant/@see` 格式。

## 關鍵檔案路徑

```
prisma/schema.prisma          ← 資料模型
src/lib/multi-entity.ts       ← 多主體 context + ownership guard
src/lib/journal-engine.ts     ← 會計分錄產生引擎
src/actions/finance.ts        ← 交易 CRUD + 報表
src/actions/cashflow.ts       ← 收支紀錄 + 循環收支排程
src/actions/purchase-orders.ts ← 叫貨單
src/actions/batches.ts        ← 生產批次
src/actions/ingredients.ts    ← 食材管理
src/actions/fixed-assets.ts   ← 固定資產 + 折舊
```

## 已知限制

- 金額欄位用 `Float` 非 `Decimal`（45+ 欄位，待遷移）
- 無自動化測試（ownership guard、atomicity 靠人工驗證）
- `cookies()` context 僅在 Server Action / Route Handler 可用
