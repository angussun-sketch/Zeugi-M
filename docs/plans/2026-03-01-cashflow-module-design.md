# 收支管理模組設計

## 目標

將現有「支出管理」升級為「收支管理」，採全新模型重建（方案 B），支援收入與支出統一管理。參考藍途記帳的三合一頁面設計。

## 需求摘要

- **三合一頁面**：收款 / 付款 tab 切換（移轉暫不做，未來可擴充）
- **收入**：以發票金額為主，不拆付款方式，不記發票號碼
- **分類**：二級群組結構（群組 > 子分類），收入/支出各自獨立分類
- **資金帳戶**：使用者可自建帳戶（零用金、銀行、信用卡等）
- **定期收支**：保留現有循環支出功能，擴展為支援定期收入
- **統編選擇**：延用 EntityCombobox，新增時選擇歸屬統編
- **高頻輸入**：每間分店每天 2-3 筆，UI 需快速填寫

## 資料模型

### CashflowRecord（取代 ExpenseRecord）

| 欄位                  | 型別       | 說明                          |
|-----------------------|-----------|-------------------------------|
| id                    | String    | CUID                          |
| entity_id             | String    | FK → Entity                   |
| direction             | String    | "income" / "expense"          |
| category_id           | String    | FK → CashflowCategory         |
| fund_account_id       | String?   | FK → FundAccount（nullable）   |
| amount                | Float     | 金額                          |
| record_date           | DateTime  | 收支日期                       |
| description           | String?   | 備註                          |
| source                | String    | "manual" / "recurring"        |
| recurring_cashflow_id | String?   | FK → RecurringCashflow         |
| recorded_at           | DateTime  | 建立時間                       |
| created_at            | DateTime  |                               |
| updated_at            | DateTime  |                               |

索引：entity_id, category_id, fund_account_id, record_date, direction

### CashflowCategory（取代 ExpenseCategory，二級結構）

| 欄位          | 型別    | 說明                                    |
|---------------|--------|----------------------------------------|
| id            | String | CUID                                    |
| org_id        | String | FK → Organization                       |
| direction     | String | "income" / "expense"                    |
| group_name    | String | 群組名（成本·進貨、辦公·行政、營業收入等）  |
| name          | String | 子分類名（原料費、房租、門市營收等）         |
| account_code  | String | 對應 chart-of-accounts.ts 科目代碼        |
| sort_order    | Int    | 排序（群組內）                            |

唯一約束：@@unique([org_id, direction, group_name, name])

### FundAccount（新增：資金帳戶）

| 欄位          | 型別     | 說明                                  |
|---------------|---------|---------------------------------------|
| id            | String  | CUID                                  |
| org_id        | String  | FK → Organization                     |
| name          | String  | 帳戶名稱（零用金、玉山銀行、國泰世華卡）  |
| account_type  | String  | "cash" / "bank" / "credit_card" / "other" |
| is_active     | Boolean | 預設 true                              |
| sort_order    | Int     | 排序                                   |

唯一約束：@@unique([org_id, name])

### RecurringCashflow（取代 RecurringExpense）

| 欄位              | 型別     | 說明                       |
|-------------------|---------|---------------------------|
| id                | String  | CUID                       |
| entity_id         | String  | FK → Entity                |
| direction         | String  | "income" / "expense"       |
| name              | String  | 名稱                       |
| category_id       | String  | FK → CashflowCategory      |
| fund_account_id   | String? | FK → FundAccount            |
| amount            | Float   | 金額                       |
| due_day           | Int     | 每月幾號（1-28）            |
| description       | String? | 備註                       |
| is_active         | Boolean | 預設 true                   |
| last_generated    | DateTime? | 上次產生日期               |

## 前端頁面結構

```
/cashflow                         ← 取代 /expenses
├── Tab: + 收款  |  - 付款
├── 上方：快速輸入表單
│   ├── 統編選擇（EntityCombobox，多統編時顯示）
│   ├── 資金帳戶（下拉）
│   ├── 日期（預設今天）
│   ├── 分類（二級群組下拉，依 tab 顯示對應 direction 的分類）
│   ├── 金額
│   └── 備註（選填）
├── 下方：紀錄列表
│   ├── 篩選：日期範圍、分類、收/支
│   ├── 欄位：日期、分類（含群組）、金額、資金帳戶、備註、操作
│   └── 分頁
└── 設定（齒輪 icon 按鈕，開啟 Dialog 或子頁面）
    ├── 分類管理（收入 + 支出，二級群組 CRUD）
    ├── 資金帳戶管理（新增/編輯/停用）
    └── 定期收支設定（延用現有循環支出邏輯，擴展為雙向）
```

## 與現有系統整合

### Transaction / JournalEntry
- 每筆 CashflowRecord 自動建立 Transaction
- 收入：source_type = "cashflow_income"
- 支出：source_type = "cashflow_expense"（取代原本的 "expense"）
- JournalEntry 由 journal-engine 根據 category 的 account_code 自動產生

### journal-engine 擴充
- 新增收入分錄邏輯：Dr. 資金帳戶 / Cr. 收入科目
- 支出邏輯不變：Dr. 費用科目 / Cr. 資金帳戶

### chart-of-accounts.ts
- 新增收入科目常數（4101 銷貨收入、4102 勞務收入、7101 利息收入等）

## 資料遷移

1. 建立新模型（CashflowRecord, CashflowCategory, FundAccount, RecurringCashflow）
2. 遷移 ExpenseCategory → CashflowCategory（direction=expense, 補 group_name）
3. 建立預設 FundAccount（現金）
4. 遷移 ExpenseRecord → CashflowRecord（direction=expense）
5. 遷移 RecurringExpense → RecurringCashflow（direction=expense）
6. 更新 Transaction 的 source_type 和 source_id 參照
7. 移除舊模型

## sidebar 導航

「支出管理」→「收支管理」，路由 /expenses → /cashflow

## 預設分類（seed）

### 支出分類
| 群組 | 子分類 | 科目代碼 |
|------|--------|---------|
| 成本·進貨 | 原料費 | 5101 |
| 成本·進貨 | 包裝費 | 5105 |
| 薪資·人事 | 薪資 | 6116 |
| 薪資·人事 | 勞健保 | 6117 |
| 辦公·行政 | 房租 | 6109 |
| 辦公·行政 | 水電費 | 6114 |
| 辦公·行政 | 文具用品 | 6113 |
| 業務·行銷 | 廣告費 | 6104 |
| 業務·行銷 | 交際費 | 6106 |
| 手續費·稅務 | 手續費 | 6124 |
| 手續費·稅務 | 稅捐 | 6115 |
| 其他支出 | 雜項支出 | 6131 |

### 收入分類
| 群組 | 子分類 | 科目代碼 |
|------|--------|---------|
| 營業收入 | 門市營收 | 4101 |
| 營業收入 | 批發收入 | 4101 |
| 營業收入 | 外送平台收入 | 4101 |
| 營業外收入 | 利息收入 | 7101 |
| 營業外收入 | 補助收入 | 7110 |
| 營業外收入 | 其他收入 | 7199 |
