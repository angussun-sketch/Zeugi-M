# Runbook: 本機開發環境

## 首次設定

```bash
# 1. 安裝依賴
npm install

# 2. 啟動 PostgreSQL（Docker）
docker compose up -d

# 3. 設定環境變數
cp .env.example .env  # 若不存在，手動建立
# DATABASE_URL="postgresql://postgres:postgres@localhost:5433/zeugi_m"

# 4. 執行 migration
npx prisma migrate deploy

# 5. 產生 Prisma Client
npx prisma generate

# 6. （選用）填入種子資料
npx tsx prisma/seed.ts

# 7. 啟動開發伺服器
npm run dev
# → http://localhost:3010
```

## 常用指令

| 指令 | 用途 |
| --- | --- |
| `npm run dev` | 啟動 dev server (port 3010) |
| `npm run build` | 生產環境建置 |
| `npx prisma studio` | 開啟 Prisma DB GUI |
| `npx prisma migrate dev --name xxx` | 建立新 migration |
| `npx prisma migrate deploy` | 套用未執行的 migration |
| `npx prisma generate` | 重新產生 Prisma Client |
| `npx tsc --noEmit` | TypeScript 型別檢查 |

## 常見問題

### Port 3010 被佔用

```bash
lsof -i :3010
kill -9 <PID>
```

### Prisma Client 過期（schema 改了但型別沒更新）

```bash
npx prisma generate
rm -rf .next
npm run dev
```

### Docker PostgreSQL 連不上

```bash
docker compose ps          # 確認容器在跑
docker compose logs db     # 看 DB 日誌
docker compose down && docker compose up -d  # 重啟
```
