# Contributing to Zeugi-M

## 開發流程

### 分支策略

```
main ← 唯一長期分支，永遠可部署
  └── feat/<描述>   ← 功能分支，完成後 squash merge 回 main
  └── fix/<描述>    ← 修復分支
  └── docs/<描述>   ← 純文件變更
  └── refactor/<描述>
```

- 禁止直接 push 到 `main`（除緊急 hotfix）
- 每個分支對應一個邏輯完整的變更，不混合無關修改

### Commit 規範

格式：`<type>: <簡述>`

| type | 用途 |
|------|------|
| `feat` | 新功能 |
| `fix` | 修復 bug |
| `refactor` | 不改行為的結構調整 |
| `docs` | 文件變更 |
| `chore` | 工具/設定/CI |
| `schema` | Prisma schema 變更（必須附帶 migration） |
| `perf` | 效能改善 |

範例：
```
feat: add recurring cashflow generation
schema: add @@unique on Transaction(source_type, source_id)
fix: multi-entity context leaks across requests
```

- 訊息用英文或中文皆可，但同一 commit 不混用
- 第一行不超過 72 字元
- 若涉及 schema 變更，commit message 必須標明 `schema:`

### Pull Request 規範

PR 標題同 commit 格式。Body 必須包含：

```markdown
## Summary
（1-3 句話描述為什麼做這個變更）

## Changes
（列出主要變更檔案與用途）

## Test Plan
（如何驗證：手動步驟 / 自動測試 / 兩者）

## Migration
（是否有 schema migration？需要 seed 嗎？有破壞性變更嗎？）
```

### Code Review 規範

Review 重點（依優先序）：

1. **正確性**：邏輯是否正確？邊界條件是否處理？
2. **安全性**：是否有跨主體資料洩漏？ownership guard 是否存在？
3. **原子性**：多步驟寫入是否在 `$transaction` 內？
4. **不可破壞的 invariant**：見 [architecture.md](docs/architecture.md) 中的 invariant 清單
5. **可維護性**：命名是否清楚？是否過度工程？

Review 不需要關注：
- 個人風格偏好（用 const vs let、trailing comma）
- 已有 linter/formatter 覆蓋的格式問題

## 程式註解規範

### 原則

- **只寫「為什麼」和「限制」**，不寫「程式正在做什麼」
- 程式碼本身應該是 self-documenting 的

### 關鍵函式註解格式

對跨模組或高風險函式，使用以下格式：

```typescript
/**
 * @pre  必須在 prisma.$transaction 內呼叫（或自行管理 tx）
 * @post Transaction + JournalEntry + ReconciliationItem 原子建立
 * @fails 若 account code 不存在，fallback 到 5211（雜費）
 * @invariant sum(debit) === sum(credit) for each JournalEntry
 * @see docs/adr/001-journal-atomicity.md
 */
```

### 何時需要註解

| 情況 | 是否需要 | 範例 |
|------|---------|------|
| 為什麼用這個做法（而非更直覺的做法） | 必要 | `// Prisma 7 不允許在 create 設定 @unique FK，必須先 create 再 update` |
| 業務規則來源 | 必要 | `// 取得當月不提折舊（台灣稅法）` |
| 已知限制或 workaround | 必要 | `// source_id nullable → PostgreSQL unique 允許多個 NULL` |
| 程式流程描述 | 不需要 | ~~`// 遍歷所有項目計算總金額`~~ |
| 型別說明 | 不需要 | ~~`// string 類型的 id`~~ |

## 多主體安全檢查清單

任何涉及 CRUD 的 PR 必須確認：

- [ ] 讀取操作包含 `org_id` 或 `entity: { org_id }` 過濾
- [ ] 更新/刪除操作有 `assertOrgOwns()` 或 `assertEntityOwns()` guard
- [ ] 報表查詢有 tenant isolation filter
- [ ] 新的 source_type 已在 Transaction @@unique 範圍內考慮

## 目錄結構約定

```
docs/
├── architecture.md        ← 系統架構（模組責任、資料流、invariant）
├── glossary.md            ← 領域術語
├── change-management.md   ← schema/API 變更策略
├── CHANGELOG.md           ← 版本變更紀錄
├── adr/                   ← Architecture Decision Records
├── runbooks/              ← 維運手冊
├── handoffs/              ← AI/人類交接紀錄
└── plans/                 ← 設計與實作計畫
```
