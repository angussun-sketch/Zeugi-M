# Zeugi-M 系統架構文件

**最後更新：** 2026-03-01
**版本：** 2.0
**狀態：** Phase 1-2 已完成（原料/叫貨/配方/財務/收支/多主體），Phase 3-4 開發中

---

## 1. 技術棧

| 層級 | 技術 | 版本 |
|------|------|------|
| 框架 | Next.js (App Router) | 16.1.6 |
| 語言 | TypeScript | 5.x |
| UI | Tailwind CSS + shadcn/ui | 4.x |
| ORM | Prisma (driver adapter 模式) | 7.4.1 |
| 資料庫 | PostgreSQL | 16 |
| DB 連接 | @prisma/adapter-pg + pg | 8.19.0 |
| 圖表 | recharts | 3.7.0 |
| 部署 | Zeabur (standalone output) | - |
| 本地開發 | Docker Compose (PostgreSQL port 5433) | - |

---

## 2. 專案結構

```
Zeugi-M/
├── prisma/
│   ├── schema.prisma          # 資料庫 Schema（唯一真相來源）
│   ├── prisma.config.ts       # Prisma 設定
│   └── migrations/            # 資料庫遷移紀錄
├── src/
│   ├── actions/               # Server Actions（資料存取層）
│   │   ├── ingredients.ts     # 原料 CRUD + 快速新增 + 批量匯入
│   │   ├── batches.ts         # 配方 CRUD + 即時成本計算
│   │   ├── purchase-orders.ts # 叫貨單 + 供應商 CRUD
│   │   ├── finance.ts         # 交易/科目/分錄/報表
│   │   ├── cashflow.ts        # 收支紀錄 + 循環收支 + 排程
│   │   ├── fixed-assets.ts    # 固定資產 + 折舊
│   │   └── entities.ts        # 公司主體管理
│   ├── app/                   # Next.js App Router 頁面
│   │   ├── layout.tsx         # 根佈局（側邊欄 + 主內容區）
│   │   ├── page.tsx           # / 儀表板首頁
│   │   ├── ingredients/       # /ingredients 原料管理
│   │   │   ├── page.tsx       # Server Component（資料獲取）
│   │   │   └── client.tsx     # Client Component（互動邏輯）
│   │   ├── purchase-orders/   # /purchase-orders 叫貨單
│   │   │   ├── page.tsx       # 叫貨單列表
│   │   │   ├── client.tsx     # 列表互動邏輯
│   │   │   ├── new/           # /purchase-orders/new 建立叫貨單
│   │   │   │   ├── page.tsx
│   │   │   │   └── client.tsx
│   │   │   └── [id]/          # /purchase-orders/[id] 叫貨單詳情
│   │   │       ├── page.tsx
│   │   │       └── client.tsx
│   │   └── batches/           # /batches 產品菜單
│   │       ├── page.tsx       # 菜單列表（即時成本卡片）
│   │       ├── new/           # /batches/new 建立配方
│   │       │   ├── page.tsx
│   │       │   └── client.tsx
│   │       └── [id]/          # /batches/[id] 配方詳情
│   │           ├── page.tsx
│   │           └── client.tsx
│   ├── components/            # 共用元件
│   │   ├── sidebar-nav.tsx    # 側邊導航列
│   │   ├── supplier-combobox.tsx # 供應商選擇/新建 combobox
│   │   ├── paste-dialog.tsx   # 批量貼上對話框
│   │   └── ui/               # shadcn/ui 基礎元件
│   ├── lib/                   # 工具函數
│   │   ├── db.ts             # Prisma Client 單例
│   │   ├── multi-entity.ts   # 多主體 context（cookie-based）+ ownership guards
│   │   ├── journal-engine.ts # 分錄自動產生引擎（內帳/外帳/調節）
│   │   ├── units.ts          # 單位換算（g/kg/台斤/cc + 包裝單位）
│   │   ├── price-map.ts      # 最新原料價格查詢（共用）
│   │   ├── calc.ts           # 批次成本分攤計算引擎
│   │   ├── parse-paste.ts    # 貼上文字解析器
│   │   └── utils.ts          # cn() 等通用工具
│   └── generated/prisma/     # Prisma 自動生成（勿手動修改）
├── docs/                      # BMAD 工程文件
├── bmad/                      # BMAD 設定
├── docker-compose.yml         # 本地 PostgreSQL
├── next.config.ts             # Next.js 設定（standalone + pg）
├── zbpack.json                # Zeabur 部署設定
└── package.json
```

---

## 3. 資料庫 Schema

### 3.1 ER 關係圖（文字版）

```text
Organization 1──N Entity
Organization 1──N Ingredient, Supplier, Account, FundAccount, CashflowCategory

Entity 1──N PurchaseOrder, Transaction, JournalEntry, Batch
Entity 1──N CashflowRecord, RecurringCashflow, FixedAsset, Employee

Supplier 1──N PurchaseOrder
PurchaseOrder 1──N PurchaseOrderItem
Ingredient 1──N PurchaseOrderItem
Ingredient 1──N BatchInput
Batch 1──N BatchInput
Batch 1──N BatchOutput

Transaction 1──N JournalEntry
Transaction 1──1? CashflowRecord (via transaction_id @unique)
Transaction 1──N ReconciliationItem
JournalEntry 1──N JournalLine
JournalLine N──1 Account

CashflowCategory 1──N CashflowRecord
FundAccount 1──N CashflowRecord
RecurringCashflow 1──N CashflowRecord

FixedAsset 1──N DepreciationRecord
Employee 1──N Attendance
Employee 1──N SalaryRecord
```

### 3.2 核心 Models

#### Ingredient（原料）
| 欄位 | 型別 | 說明 |
|------|------|------|
| id | String (cuid) | PK |
| name | String (unique) | 原料名稱 |
| measure_type | String | "weight" 或 "volume" |

#### Supplier（供應商）
| 欄位 | 型別 | 說明 |
|------|------|------|
| id | String (cuid) | PK |
| name | String (unique) | 供應商名稱 |
| contact | String? | 聯絡人 |
| phone | String? | 電話 |
| notes | String? | 備註 |

#### PurchaseOrder（叫貨單）
| 欄位 | 型別 | 說明 |
|------|------|------|
| id | String (cuid) | PK |
| order_date | DateTime | 叫貨日期（用於判定最新價格） |
| supplier_id | String? | FK → Supplier |
| notes | String? | 備註 |
| total_amount | Float? | 總金額 |

#### PurchaseOrderItem（叫貨單明細）
| 欄位 | 型別 | 說明 |
|------|------|------|
| id | String (cuid) | PK |
| order_id | String | FK → PurchaseOrder (cascade delete) |
| ingredient_id | String | FK → Ingredient |
| purchase_qty | Float | 採購數量 (e.g. 3) |
| purchase_unit | String | 採購單位 (箱/袋/瓶/桶/罐/g/kg/台斤/cc) |
| per_package_qty | Float? | 每包裝量 (e.g. 30)，直接單位時為 null |
| per_package_unit | String? | 每包裝單位 (kg/g/台斤/cc)，直接單位時為 null |
| total_qty_base | Float | 換算後總量 (g/cc) |
| subtotal | Float | 小計金額 |
| unit_cost_base | Float | 元/g 或 元/cc |

**設計要點：** 最新價格以叫貨單日期（`order_date`）判定，越新的叫貨單即為目前原料成本。查詢透過共用函數 `getLatestPriceMap()` 實現，按 `order_date DESC` 排序取每個原料的第一筆。

#### Batch（配方/菜單）
| 欄位 | 型別 | 說明 |
|------|------|------|
| id | String (cuid) | PK |
| name | String | 配方名稱 |
| alloc_method | String | "by_pieces" 或 "by_filling_weight" |
| total_cost | Float? | 快照總成本 |

#### BatchInput（配方投入原料）
| 欄位 | 型別 | 說明 |
|------|------|------|
| id | String (cuid) | PK |
| batch_id | String | FK → Batch (cascade delete) |
| ingredient_id | String | FK → Ingredient |
| qty_input | Float | 使用者輸入數量 |
| input_unit | String | 使用者輸入單位 |
| qty_base | Float | 換算後 (g/cc) |
| unit_cost_used | Float | 建立時的價格快照 |
| cost | Float | qty_base × unit_cost_used |
| is_shared | Boolean | 是否為共用原料 |
| dedicated_to | String? | 專用口味的 BatchOutput.id |

#### BatchOutput（配方產出口味）
| 欄位 | 型別 | 說明 |
|------|------|------|
| id | String (cuid) | PK |
| batch_id | String | FK → Batch (cascade delete) |
| flavor_name | String | 口味名稱 |
| pieces | Int | 產出顆數 |
| filling_g_per_piece | Float? | 每顆餡料重量 (g) |
| skin_g_per_piece | Float? | 每顆皮料重量 (g) |
| total_cost | Float? | 快照口味總成本 |
| cost_per_piece | Float? | 快照每顆成本 |

#### Transaction（財務交易）

每筆業務事件（叫貨、收支、折舊）對應一筆 Transaction，自動產生分錄。

- `source_type` + `source_id` 為 `@@unique` — 每個來源只能有一筆 Transaction
- `status`: draft → posted → voided（不可逆）
- 建立時自動呼叫 `journal-engine.ts` 產生內帳/外帳分錄

#### JournalEntry / JournalLine（分錄）

- 每筆 Transaction 產生 1-2 筆 JournalEntry（internal + tax）
- JournalLine 為借貸明細，`@@invariant: sum(debit) == sum(credit)` per entry

#### CashflowRecord（收支紀錄）

- 可手動建立或由 PurchaseOrder / RecurringCashflow 自動產生
- `transaction_id` 為 `@unique` FK — 一筆收支對應一筆 Transaction
- `source` 欄位區分來源：`manual` / `recurring` / `purchase_order`

#### RecurringCashflow（循環收支）

- `due_day` (1-28) 指定每月幾號
- Cron 排程自動產生 CashflowRecord + Transaction

#### FixedAsset / DepreciationRecord（固定資產）

- 直線法折舊，`@@unique([asset_id, period_year, period_month])` 防重複
- Cron 排程每月自動提列

#### Employee / Attendance / SalaryRecord（人事）

- 員工資料 + 出勤 + 薪資月結
- Schema 已建立，頁面尚未實作

---

## 4. 多主體架構

### 4.0 層級結構

```text
Organization（組織）
  └── Entity（公司主體，各有獨立統編）
        └── PurchaseOrder, Transaction, Batch, CashflowRecord, FixedAsset...
```

- **Org-level 資源**（共用）：Ingredient, Supplier, Account, FundAccount, CashflowCategory
- **Entity-level 資源**（隔離）：PurchaseOrder, Transaction, JournalEntry, Batch, CashflowRecord, FixedAsset

### 4.1 Context 機制

`src/lib/multi-entity.ts` 的 `getCurrentEntity()` 使用 cookie 儲存當前 orgId / entityId。
無 cookie 時（如 cron）自動 fallback 到 DB 查詢第一個啟用中的 Entity。

### 4.2 Ownership Guard

所有 update/delete Server Action 在執行前呼叫：

- `assertOrgOwns(model, id)` — 驗證 org-level 資源歸屬
- `assertEntityOwns(model, id)` — 驗證 entity-level 資源歸屬

未通過驗證時拋出 `"無權限操作此記錄"`。

---

## 5. 核心架構模式

### 4.1 頁面架構：Server Component + Client Component

每個功能頁面遵循固定模式：

```
page.tsx (Server Component)
  → 呼叫 Server Action 取得資料
  → 傳遞資料給 Client Component

client.tsx (Client Component)
  → 管理互動狀態 (useState)
  → 呼叫 Server Action 執行寫入
  → router.refresh() 重新取資料
```

**規則：**
- 所有有 DB 查詢的 page.tsx 必須加 `export const dynamic = "force-dynamic"`
- Client Component 透過 props 接收 Server Component 傳來的資料
- 寫入操作使用 `"use server"` 標記的 Server Actions

### 4.2 即時成本計算

系統有兩套成本計算：

1. **快照成本**（建立時計算，存入 DB）
   - `BatchInput.unit_cost_used` = 建立時的原料單價
   - `BatchInput.cost` = qty_base × unit_cost_used
   - 用於歷史記錄

2. **即時成本**（每次查看時計算，不存 DB）
   - `liveCostCalc()` 函數使用最新的叫貨單價格（透過 `getLatestPriceMap()`）
   - `getBatchWithLiveCost()` / `getBatchesWithLiveCost()` 回傳即時成本
   - 原料漲價後，打開配方頁面就能看到更新後的成本

### 4.3 單位換算系統

所有原料在內部統一使用基礎單位儲存：
- 重量 → `g`（1 台斤 = 600g, 1 kg = 1000g）
- 體積 → `cc`（1 cc = 1 cc）

使用者可用任意單位輸入，系統自動換算：
```
toBase(qty, unit) → g 或 cc
fromBase(qtyBase, unit) → 使用者單位
```

**包裝單位支援：** 叫貨單支援包裝單位（箱/袋/瓶/桶/罐），需指定每包裝含量後換算：
```
computeTotalQtyBase(qty, unit, perPkgQty?, perPkgUnit?)
  例: 3箱, 每箱30kg → 3 × 30 × 1000 = 90000g
  例: 20kg → toBase(20, "kg") = 20000g
```

### 4.4 成本分攤邏輯

配方可有多個口味產出，共用原料按比例分攤：

```
1. 專用原料 → 直接歸屬指定口味
2. 共用原料 → 按分攤規則分配：
   - by_pieces: 按各口味顆數比例
   - by_filling_weight: 按各口味 (顆數 × 每顆餡料g) 比例
3. 單一口味 → 預設 by_pieces，隱藏分攤選項
```

---

## 5. 頁面路由與功能狀態

| 路由 | 功能 | 狀態 |
|------|------|------|
| `/` | 儀表板（導航入口） | 已完成（基礎版） |
| `/ingredients` | 原料管理（快速新增、批量貼上、價格更新） | 已完成 |
| `/purchase-orders` | 叫貨單列表（日期、供應商、總金額） | 已完成 |
| `/purchase-orders/new` | 建立叫貨單（供應商、動態明細、包裝單位換算） | 已完成 |
| `/purchase-orders/[id]` | 叫貨單詳情（明細表格、換算預覽） | 已完成 |
| `/batches` | 產品菜單列表（即時成本卡片） | 已完成 |
| `/batches/new` | 建立配方（投料、口味、分攤） | 已完成 |
| `/batches/[id]` | 配方詳情（即時成本、SOP、編輯） | 已完成 |
| `/expenses` | 額外開銷管理 | 未實作 |
| `/employees` | 人事管理 | 未實作 |
| `/salary` | 薪資月結 | 未實作 |
| `/trends` | 歷史趨勢圖表 | 未實作 |

---

## 6. Server Actions API

### ingredients.ts

| 函數 | 用途 |
|------|------|
| `getIngredients()` | 取得所有原料（含最新價格，透過 `getLatestPriceMap`） |
| `getIngredient(id)` | 取得單一原料詳情（含叫貨單明細） |
| `createIngredient(data)` | 建立原料 |
| `updateIngredient(id, data)` | 更新原料名稱/類型 |
| `deleteIngredient(id)` | 刪除原料 |
| `quickAddIngredient(data)` | 一步完成：找/建原料 + 建立單項叫貨單 |
| `bulkAddIngredients(items)` | 批量匯入多筆原料（各建立獨立叫貨單） |

### purchase-orders.ts

| 函數 | 用途 |
|------|------|
| `getSuppliers()` | 取得所有供應商 |
| `findOrCreateSupplier(name)` | 找或建供應商（combobox 用） |
| `createPurchaseOrder(data)` | 建立叫貨單（含多筆明細、自動換算） |
| `getPurchaseOrders()` | 叫貨單列表（含供應商、品項數、總金額） |
| `getPurchaseOrder(id)` | 叫貨單詳情（含品項 + 原料名） |
| `deletePurchaseOrder(id)` | 刪除叫貨單 |

### batches.ts

| 函數 | 用途 |
|------|------|
| `createBatch(data)` | 建立配方（含成本分攤計算） |
| `getBatchesWithLiveCost()` | 列表頁：所有配方 + 即時成本 |
| `getBatchWithLiveCost(id)` | 詳情頁：單一配方 + 即時成本明細 |
| `updateBatchName(id, name)` | 更新配方名稱 |
| `updateBatchOutput(id, data)` | 更新口味（顆數/餡料/皮料） |
| `updateBatchInput(id, data)` | 更新原料投入量 |
| `removeBatchInput(id)` | 移除原料 |
| `addBatchInput(data)` | 新增原料到配方 |
| `deleteBatch(id)` | 刪除配方 |

---

## 7. 部署架構

```
[使用者瀏覽器]
      ↓ HTTPS
[Zeabur - Next.js Standalone]
      ↓ TCP
[Zeabur - PostgreSQL]
```

**設定重點：**
- `next.config.ts`: `output: "standalone"`, `serverExternalPackages: ["pg"]`
- `zbpack.json`: build = `npm run build`, start = `npm run migrate:deploy && npm run start`
- 環境變數：`DATABASE_URL` 必須在 Zeabur web service 上設定
- 本地開發：`localhost:3010`，DB 在 Docker port 5433

---

## 8. 開發規範

### 命名慣例
- 檔案：kebab-case (`sidebar-nav.tsx`)
- 元件：PascalCase (`BatchDetailClient`)
- 函數/變數：camelCase (`liveCostCalc`)
- DB 欄位：snake_case (`unit_cost_base`)
- 路由參數：kebab-case (`[id]`)

### 新增功能的標準流程
1. 若需新增 DB 欄位 → 修改 `prisma/schema.prisma` → `npx prisma migrate dev --name xxx`
2. 若需新增 Server Action → 在 `src/actions/` 對應檔案新增函數
3. 頁面遵循 `page.tsx` (Server) + `client.tsx` (Client) 模式
4. 所有有 DB 查詢的 page.tsx 加 `export const dynamic = "force-dynamic"`
5. 修改完成後執行 `npm run build` 驗證

### UI 語言
- 所有使用者介面使用**繁體中文**
- 程式碼/變數名使用英文

---

---

## 9. 不可破壞的 Invariants

以下規則必須在任何變更中被保持，違反將導致資料不一致：

| ID | Invariant | 涉及檔案 |
| --- | --- | --- |
| INV-1 | 每筆 JournalEntry 的 `sum(debit) == sum(credit)` | `journal-engine.ts` |
| INV-2 | Transaction 的 `(source_type, source_id)` 組合全域唯一 | `schema.prisma` @@unique |
| INV-3 | CashflowRecord.transaction_id 為 @unique — 一筆收支最多對應一筆 Transaction | `schema.prisma` |
| INV-4 | 所有 update/delete Server Action 必須有 `assertOrgOwns` 或 `assertEntityOwns` guard | `multi-entity.ts` |
| INV-5 | 多步驟寫入（Transaction + JournalEntry + ReconciliationItem）必須在 `prisma.$transaction` 內 | `finance.ts`, `cashflow.ts` |
| INV-6 | Org-level 資源（Ingredient 等）用 `org_id` 隔離；Entity-level 資源用 `entity.org_id` 隔離 | 所有 actions/ |
| INV-7 | DepreciationRecord 的 `(asset_id, period_year, period_month)` 唯一 — 同月不可重複提列 | `schema.prisma` @@unique |
| INV-8 | RecurringCashflow 每月每筆最多產生一筆 CashflowRecord（用日期範圍查重） | `cashflow.ts` |

---

## 10. 模組依賴圖

```text
┌─────────────┐
│  app/ pages  │  ← UI 層，只呼叫 actions/
└──────┬──────┘
       │ Server Actions
       ▼
┌─────────────────────────────────────────────────┐
│  actions/                                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │purchase- │→│ finance  │←│    cashflow       │ │
│  │orders    │ │          │ │                   │ │
│  └──────────┘ └────┬─────┘ └──────────────────┘ │
│  ┌──────────┐      │       ┌──────────────────┐ │
│  │batches   │      │       │  fixed-assets     │ │
│  └──────────┘      │       └──────────────────┘ │
│  ┌──────────┐      │       ┌──────────────────┐ │
│  │ingredient│      │       │  entities         │ │
│  └──────────┘      │       └──────────────────┘ │
└────────────────────┼────────────────────────────┘
                     │ 呼叫
       ┌─────────────┼─────────────┐
       ▼             ▼             ▼
┌────────────┐ ┌───────────┐ ┌──────────┐
│multi-entity│ │journal-   │ │  units   │
│ (context)  │ │engine     │ │ (換算)   │
└────────────┘ └───────────┘ └──────────┘
       │             │
       ▼             ▼
┌──────────────────────────┐
│  lib/db.ts → Prisma      │
└──────────────────────────┘
```

**關鍵依賴方向：**

- `purchase-orders` → `finance`（建立 Transaction）→ `journal-engine`（產生分錄）
- `cashflow` → `finance`（建立/刪除 Transaction）
- `fixed-assets` → `finance`（折舊 Transaction）
- 所有 actions → `multi-entity`（取得 context + ownership guard）
- `api/cron/expenses` → `cashflow` + `fixed-assets`（排程產生）

---

**This document was created using BMAD Method v6 - Phase 3 (Architecture). Last updated 2026-03-01.**
