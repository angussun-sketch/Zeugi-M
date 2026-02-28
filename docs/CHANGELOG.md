# Zeugi-M 變更紀錄 (CHANGELOG)

> **用途：** 記錄所有功能變更、資料庫異動、架構調整。供跨 AI 協作時快速理解專案演進。
>
> **更新規則：** 每次功能變更後，在最上方新增條目。格式遵循 [新增/修改/修復/移除] 分類。

---

## [Unreleased] — 尚未 commit 的變更

### 新增 (Added)

- **叫貨單系統 (Purchase Orders)** — 完整的原料採購管理功能
  - DB models: `Supplier`, `PurchaseOrder`, `PurchaseOrderItem`
  - Migrations: `20260226173257_add_purchase_orders`, `20260227_drop_purchase_record`
  - `src/actions/purchase-orders.ts` → 叫貨單 + 供應商 CRUD（getSuppliers, findOrCreateSupplier, createPurchaseOrder, getPurchaseOrders, getPurchaseOrder, deletePurchaseOrder）
  - `src/lib/price-map.ts` → `getLatestPriceMap()` 共用最新價格查詢（按 order_date DESC）
  - `src/components/supplier-combobox.tsx` → 供應商選擇/新建 combobox（Popover + Command）
  - 頁面：
    - `/purchase-orders` — 叫貨單列表（日期、供應商、品項數、總金額）
    - `/purchase-orders/new` — 建立叫貨單（供應商 combobox、動態品項列、包裝單位換算）
    - `/purchase-orders/[id]` — 叫貨單詳情（基本資訊 + 品項明細表格）

- **包裝單位支援** — 叫貨單支援箱/袋/瓶/桶/罐等包裝單位
  - `src/lib/units.ts` → `PackageUnit` type, `PACKAGE_UNITS`, `isPackageUnit()`, `computeTotalQtyBase()`, `getPurchaseUnitsForType()`
  - 叫貨單表單中選擇包裝單位時顯示「每包裝規格」欄位（數量 + 直接單位），自動換算至 g/cc

- **BatchOutput.skin_g_per_piece** — 新增「每顆皮料重量(g)」欄位 (Float?, 選填)
  - DB migration: `20260226164746_add_skin_g_per_piece`
  - Schema: `prisma/schema.prisma` → BatchOutput model
  - 前端顯示「每顆總重」= filling_g_per_piece + skin_g_per_piece（僅顯示，不存 DB）

- **即時成本計算 (Live Cost)** — 配方頁面可即時反映最新原料價格
  - `src/lib/calc.ts` → `liveCostCalc()` 計算引擎
  - `src/actions/batches.ts` → `getBatchWithLiveCost()` / `getBatchesWithLiveCost()`
  - 配方列表卡片顯示即時成本，而非建立時的快照成本

- **配方詳情頁拆分** — Server/Client Component 分離
  - `src/app/batches/[id]/page.tsx` → Server Component（資料獲取）
  - `src/app/batches/[id]/client.tsx` → Client Component（互動邏輯：inline 編輯、即時成本顯示）

- **配方建立頁面增強** — 支援皮料重量欄位
  - `src/app/batches/new/client.tsx` → OutputRow 新增 skin_g_per_piece 輸入

- **原料管理增強**
  - `src/actions/ingredients.ts` → `quickAddIngredient()` 一步完成找/建原料 + 建立單項叫貨單
  - `src/actions/ingredients.ts` → `bulkAddIngredients()` 批量匯入
  - `src/app/ingredients/client.tsx` → 快速新增表單、批量貼上對話框

- **批量貼上匯入** — 支援從文字貼上快速匯入原料
  - `src/components/paste-dialog.tsx` → 對話框元件
  - `src/lib/parse-paste.ts` → 文字解析器（正則：品名 數量單位 價格）

- **側邊導航列** — 新增所有頁面路由
  - `src/components/sidebar-nav.tsx` → 儀表板、原料管理、叫貨單、產品菜單、開銷記錄、人事管理、趨勢分析

- **BMAD 工程文件**
  - `docs/product-brief-zeugi-m-2026-02-27.md` → 產品簡報
  - `docs/architecture.md` → 軟體架構文檔
  - `docs/CHANGELOG.md` → 本變更紀錄

### 修改 (Changed)

- **成本判定機制** — 從 `is_current` flag 改為日期排序
  - 舊：PurchaseRecord 的 `is_current` boolean（新增時手動切換）
  - 新：PurchaseOrderItem 按 `PurchaseOrder.order_date DESC` 排序，取最新一筆
  - 影響：`src/actions/ingredients.ts`, `src/actions/batches.ts`（4 處查詢改用 `getLatestPriceMap()`）

- **原料管理頁面** (`src/app/ingredients/client.tsx`) — 型別從 `IngredientWithPurchase`（含 `purchase_records[]`）改為 `IngredientWithPrice`（含 `latest_unit_cost_base: number | null`）

- **配方頁面** (`src/app/batches/new/client.tsx`, `src/app/batches/[id]/client.tsx`) — `IngredientOption` 型別改用 `latest_unit_cost_base`

- **儀表板** (`src/app/page.tsx`) — 新增「叫貨單」卡片

- **配方列表頁** (`src/app/batches/page.tsx`) — 改用 `getBatchesWithLiveCost()` 顯示即時成本
- **貼上解析器** (`src/lib/parse-paste.ts`) — 改進正則以支援更多格式

### 移除 (Removed)

- **PurchaseRecord model** — 完全移除，資料已遷移至 PurchaseOrder + PurchaseOrderItem
  - Migration: `20260227_drop_purchase_record`
- **`src/actions/purchases.ts`** — 被 `src/actions/purchase-orders.ts` 取代
- **`src/components/purchase-form.tsx`** — 不再使用

### 資料庫異動 (Database)

- Migration `20260226164746_add_skin_g_per_piece`:
  ```sql
  ALTER TABLE "BatchOutput" ADD COLUMN "skin_g_per_piece" DOUBLE PRECISION;
  ```
- Migration `20260226173257_add_purchase_orders`:

  ```sql
  CREATE TABLE "Supplier" (...)
  CREATE TABLE "PurchaseOrder" (...)
  CREATE TABLE "PurchaseOrderItem" (...)
  -- 含索引：order_date, order_id, ingredient_id
  ```

- Migration `20260227_drop_purchase_record`:

  ```sql
  DROP TABLE "PurchaseRecord"
  -- 資料已預先遷移至 PurchaseOrder + PurchaseOrderItem（13 筆紀錄）
  ```

---

## [0.1.0] — 2026-02-26 (初始版本)

> Git commit: `8210547` feat: init Zeugi-M batch cost calculator

### 新增 (Added)

#### 資料庫 Schema（全部 Models）
- **Ingredient** — 原料（name unique, measure_type: weight/volume）
- **PurchaseRecord** — 採購紀錄（is_current 標記最新價格，支援包裝數拆算）
- **Batch** — 配方（alloc_method: by_pieces/by_filling_weight）
- **BatchInput** — 配方投入原料（is_shared 共用/dedicated_to 專用、快照單價 unit_cost_used）
- **BatchOutput** — 配方產出口味（pieces 顆數、filling_g_per_piece 餡料重量）
- **ExpenseCategory** — 開銷分類（type: fixed/variable/recurring）
- **ExpenseRecord** — 開銷紀錄（period_start/end 循環期間）
- **Employee** — 員工（salary_type: monthly/hourly/daily）
- **Attendance** — 出勤（status: present/absent/leave/half_day）
- **SalaryRecord** — 薪資月結（含勞健保、加班、扣款、獎金）

> Migration: `20260226103926_init`

#### 核心工具
- `src/lib/units.ts` — 單位換算（g/kg/台斤/cc，toBase/fromBase）
- `src/lib/calc.ts` — 成本分攤引擎（共用原料按 pieces 或 filling_weight 比例分攤）
- `src/lib/db.ts` — Prisma Client 單例（driver adapter 模式，@prisma/adapter-pg + pg）
- `src/lib/parse-paste.ts` — 貼上文字解析器
- `src/lib/utils.ts` — cn() 等通用工具

#### Server Actions
- `src/actions/ingredients.ts` — getIngredients, getIngredient, createIngredient, updateIngredient, deleteIngredient
- `src/actions/batches.ts` — createBatch, getBatchWithLiveCost, getBatchesWithLiveCost, updateBatchName, updateBatchOutput, updateBatchInput, removeBatchInput, addBatchInput, deleteBatch

#### 頁面
- `/` — 儀表板首頁（導航入口）
- `/ingredients` — 原料管理（CRUD + 採購紀錄）
- `/batches` — 產品菜單列表
- `/batches/new` — 建立配方（投料、口味、分攤方式選擇）
- `/batches/[id]` — 配方詳情（成本明細、SOP）

#### UI 元件
- shadcn/ui 基礎元件（Button, Card, Input, Label, Select, Dialog, Table, Badge, Tabs）
- 側邊導航列 `sidebar-nav.tsx`
- 批量貼上對話框 `paste-dialog.tsx`

#### 部署設定
- `next.config.ts` — standalone output + pg externalized
- `zbpack.json` — Zeabur 部署（build + migrate:deploy + start）
- `docker-compose.yml` — 本地 PostgreSQL (port 5433)

---

## 資料庫 Migration 索引

| Migration | 日期 | 說明 |
|-----------|------|------|
| `20260226103926_init` | 2026-02-26 | 初始 Schema：10 個 Models，全部索引與外鍵 |
| `20260226164746_add_skin_g_per_piece` | 2026-02-26 | BatchOutput 新增 skin_g_per_piece 欄位 |
| `20260226173257_add_purchase_orders` | 2026-02-26 | 新增 Supplier, PurchaseOrder, PurchaseOrderItem |
| `20260227_drop_purchase_record` | 2026-02-27 | 移除 PurchaseRecord（資料已遷移） |

---

## 給其他 AI 的快速上手指南

### 技術棧
- Next.js 16.1.6 (App Router) + TypeScript + Tailwind 4.x + shadcn/ui
- PostgreSQL 16 + Prisma 7.4.1 (driver adapter: @prisma/adapter-pg + pg)
- 部署：Zeabur (standalone)；本地：Docker Compose (port 5433)

### 關鍵架構規則
1. **頁面模式**：`page.tsx` (Server Component) + `client.tsx` (Client Component)
2. **DB 查詢頁面**：必加 `export const dynamic = "force-dynamic"`
3. **資料存取**：透過 `src/actions/` 下的 Server Actions，不直接在元件中查詢
4. **成本系統**：快照成本（建立時存 DB）+ 即時成本（查看時用最新價格計算）
5. **單位系統**：內部統一用 g/cc，使用者可用 g/kg/台斤/cc 輸入
6. **UI 語言**：繁體中文；程式碼：英文

### 修改前必讀
- `docs/architecture.md` — 完整架構說明
- `prisma/schema.prisma` — 資料庫唯一真相來源
- `src/actions/batches.ts` — 配方相關所有 Server Actions
- `src/actions/ingredients.ts` — 原料相關所有 Server Actions
- `src/actions/purchase-orders.ts` — 叫貨單 + 供應商 Server Actions
- `src/lib/price-map.ts` — 最新原料價格查詢（共用於 ingredients, batches, purchase-orders）

### 新增功能標準流程
1. DB 變更 → `prisma/schema.prisma` → `npx prisma migrate dev --name xxx`
2. Server Action → `src/actions/` 對應檔案
3. 頁面 → `page.tsx` (Server) + `client.tsx` (Client) + `force-dynamic`
4. 驗證 → `npm run build`
