# Runbook: Schema Migration

## 標準流程

### 1. 修改 Schema

編輯 `prisma/schema.prisma`。

### 2. 建立 Migration

```bash
npx prisma migrate dev --name <描述>
```

若 interactive mode 不可用（CI/sandbox）：

```bash
# 手動建立 migration 目錄
mkdir -p prisma/migrations/YYYYMMDD_<描述>

# 寫 SQL
cat > prisma/migrations/YYYYMMDD_<描述>/migration.sql << 'SQL'
-- 你的 SQL
SQL

# 套用
npx prisma migrate deploy
```

### 3. 重新產生 Client

```bash
npx prisma generate
rm -rf .next  # 清除 Turbopack 快取
```

### 4. 驗證

```bash
npx tsc --noEmit          # 型別檢查
npm run dev               # 啟動確認無 runtime 錯誤
```

## 破壞性變更檢查清單

在套用 migration 前確認：

- [ ] 是否有欄位被刪除？若有，確認 code 已不再引用
- [ ] 是否有 NOT NULL 新增？若有，確認已有 default 或已 backfill
- [ ] 是否有 UNIQUE constraint？若有，確認無現有重複資料
- [ ] 是否改名？Prisma 會視為 drop + create（資料遺失）

## 回滾 Migration

Prisma 不支援自動 rollback。手動步驟：

```bash
# 1. 寫反向 SQL
npx prisma db execute --stdin << 'SQL'
-- 反向操作（例如 DROP INDEX, ALTER TABLE DROP COLUMN）
SQL

# 2. 從 migration 表移除記錄
npx prisma db execute --stdin << 'SQL'
DELETE FROM "_prisma_migrations"
WHERE migration_name = 'YYYYMMDD_<描述>';
SQL

# 3. 修改 schema.prisma 回原狀
# 4. npx prisma generate
```

## 生產環境部署

Zeabur 部署時自動執行 `npx prisma migrate deploy`（見 `zbpack.json`）。

**注意：** 生產環境不應該用 `migrate dev`，只用 `migrate deploy`。
