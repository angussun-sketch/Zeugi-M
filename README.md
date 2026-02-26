# Zeugi-M

食品成本計算器（Next.js + Prisma + PostgreSQL）。

## Local Development

1. 啟動資料庫（可選，若你本機沒有 PostgreSQL）

```bash
docker compose up -d
```

2. 安裝套件與啟動開發環境

```bash
npm ci
npm run dev
```

3. 常用指令

```bash
npm run lint
npm run build
npm run migrate:deploy
```

## Deploy on Zeabur

此專案已提供 `zbpack.json`，Zeabur 會使用：

- `build_command`: `npm run build`
- `start_command`: `npm run migrate:deploy && npm run start`

### 部署步驟

1. 在 Zeabur 匯入此 Git Repo。
2. 新增 PostgreSQL 服務。
3. 在 Web 服務環境變數設定 `DATABASE_URL`（指向 Zeabur PostgreSQL）。
4. 重新部署。

## Required Environment Variables

- `DATABASE_URL`: Prisma 連線字串（PostgreSQL）
