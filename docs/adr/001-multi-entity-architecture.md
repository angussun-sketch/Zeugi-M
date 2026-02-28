# ADR-001: 多主體（Multi-Entity）架構

**日期：** 2026-02-27
**狀態：** accepted
**決策者：** 產品規劃階段（brainstorming）

## 背景

Zeugi-M 的使用者（烘焙業老闆）通常以個人名義持有多家公司（獨資/有限公司），每家有不同統編，但共用相同的原料供應商和原料清單。系統需要支援：

1. 一個使用者管理多家公司的帳務
2. 原料/供應商等共用資源跨公司共享
3. 財務交易、叫貨單等業務資料按公司隔離
4. 報表按公司分別產出

## 考慮的方案

### 方案 A: 單層 tenant（每公司一個 tenant）

- 優點：簡單，完全隔離
- 缺點：原料/供應商要重複建立；使用者需在多個 tenant 間切換

### 方案 B: 雙層架構 Organization → Entity

- 優點：共用資源放 org 層級，業務資料放 entity 層級，符合實際使用場景
- 缺點：查詢需要處理兩層過濾；ownership 驗證更複雜

### 方案 C: 全域共用 + tag 標記

- 優點：最靈活
- 缺點：隔離靠應用層邏輯，容易漏；無法利用 DB 約束

## 決策

選擇 **方案 B：雙層 Organization → Entity**。

理由：

1. 完全對應業務現實（一個老闆、多家公司、共用供應鏈）
2. DB 層可用 `org_id` / `entity_id` 做硬約束
3. 未來若需支援多使用者（員工帳號），只需在 org 層加 user 關聯

## 後果

- **正面：** 共用資源不重複；報表天然隔離；schema 語意清晰
- **負面/風險：**
  - 所有查詢都必須加 org/entity 過濾（容易遺漏 → 建立 `assertOrgOwns` / `assertEntityOwns` guard）
  - Context 切換機制需要可靠（從 global singleton 遷移到 cookie-based）
  - Cron job 需要明確遍歷所有 entity，不能依賴 context
- **需要的後續行動：**
  - 2026-03-01: 完成 cookie-based context 遷移（已完成）
  - 2026-03-01: 完成 29 個 ownership guard（已完成）
  - 待辦: 報表層級的 entity filter 持續審查

## 相關文件

- [brainstorming-multi-entity-2026-02-27.md](../brainstorming-multi-entity-2026-02-27.md)
- [entity-management-design.md](../plans/2026-03-01-entity-management-design.md)
- `src/lib/multi-entity.ts` — context + ownership guards 實作
- `prisma/schema.prisma` — Organization / Entity model 定義
