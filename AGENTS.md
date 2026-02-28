# Zeugi-M — AI Agent 開發指引

> 本檔案供 OpenAI Codex 及其他 AI agent 自動載入。
> 與 CLAUDE.md 內容同步，若有衝突以 CLAUDE.md 為準。

## 開始前必讀

1. `CONTRIBUTING.md` — 開發流程、commit 規範、code review 標準
2. `docs/architecture.md` — 系統架構、模組依賴、invariant 清單
3. `docs/change-management.md` — schema/API 變更策略

## 核心規則

1. **多主體隔離**：所有 DB 查詢必須加 org_id filter；update/delete 前呼叫 `assertOrgOwns()` 或 `assertEntityOwns()`（見 `src/lib/multi-entity.ts`）
2. **財務原子性**：Transaction + JournalEntry 寫入必須在 `prisma.$transaction()` 內
3. **Commit 格式**：`<type>: <描述>`，schema 變更必須用 `schema:` prefix
4. **註解標準**：只寫 why/constraints，不寫 what。高風險函式用 `@pre/@post/@fails/@invariant` 格式

## Tech Stack

- Next.js 16 (App Router, Server Actions)
- Prisma 7 + PostgreSQL
- TypeScript strict mode
- Tailwind CSS + shadcn/ui
