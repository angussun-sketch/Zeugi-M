# 變更管理策略

## Schema 變更

### 分類

| 類型 | 範例 | 風險 | 流程 |
| --- | --- | --- | --- |
| 新增欄位（nullable） | 加 `notes String?` | 低 | 直接 migrate |
| 新增欄位（NOT NULL） | 加 `status String` | 中 | 先加 nullable → backfill → 改 NOT NULL |
| 新增 model | 加 `Employee` | 低 | 直接 migrate |
| 刪除欄位/model | 移除 `ExpenseRecord` | 高 | 先移除 code 引用 → 確認無用 → migrate |
| 改名 | `name` → `display_name` | 高 | Prisma 視為 drop+create → 需手動寫 RENAME SQL |
| 新增 unique constraint | `@@unique([a, b])` | 中 | 先檢查重複 → 清理 → migrate |
| 改變型別 | `Float` → `Decimal` | 高 | 需資料遷移 script |

### 必要步驟

1. 修改 `prisma/schema.prisma`
2. 建立 migration（見 [runbooks/migration.md](runbooks/migration.md)）
3. 更新 `docs/CHANGELOG.md`
4. 若涉及 invariant 變更，更新 `docs/architecture.md` 的 invariant 表
5. Commit message 使用 `schema:` prefix

## Server Action API 變更

### 向後相容規則

- **新增函式**：直接加，不影響現有功能
- **新增參數**：必須是 optional（`param?: type`），保持現有呼叫不變
- **移除函式**：先標記 `@deprecated`，至少保留 1 個版本週期後再刪
- **改變回傳格式**：禁止直接改。改用新函式名稱

### 棄用政策

```typescript
/**
 * @deprecated 使用 getCashflowRecords() 取代。將在 v0.3.0 移除。
 */
export async function getExpenseRecords() { ... }
```

- 棄用時在 CHANGELOG 記錄
- 至少保留一個 minor 版本後才能移除
- 移除前搜尋所有 import 確認無引用

## 前端頁面變更

- 路由變更（URL 結構改變）：需在 CHANGELOG 記錄
- 元件 props 變更：確認所有呼叫點已更新
- 沒有外部 API 消費者，前端變更不需要向後相容

## 相容性檢查清單

PR 提交前確認：

- [ ] 新增的 DB 欄位有 default 或是 nullable
- [ ] 沒有直接刪除仍在使用的欄位/函式
- [ ] CHANGELOG 已更新
- [ ] 若有 invariant 變更，architecture.md 已更新
- [ ] 若有新 model，glossary.md 已更新
