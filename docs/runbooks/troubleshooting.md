# Runbook: 故障排查

## 症狀 → 排查步驟

### 頁面載入白畫面 / 500 Error

1. 檢查 dev server 日誌（terminal）
2. 常見原因：
   - DB 連線失敗 → `docker compose ps` 確認 DB 在跑
   - Prisma Client 過期 → `npx prisma generate && rm -rf .next`
   - 環境變數缺失 → 確認 `.env` 有 `DATABASE_URL`

### 建立叫貨單/收支後，財務頁面沒有對應紀錄

1. 檢查 Transaction 是否建立：

   ```bash
   npx prisma db execute --stdin <<< "SELECT id, source_type, source_id, amount FROM \"Transaction\" ORDER BY created_at DESC LIMIT 5;"
   ```

2. 檢查 JournalEntry 是否建立：

   ```bash
   npx prisma db execute --stdin <<< "SELECT id, transaction_id, book_type FROM \"JournalEntry\" ORDER BY created_at DESC LIMIT 5;"
   ```

3. 若 Transaction 存在但 JournalEntry 不存在：分錄引擎可能失敗。檢查 `journal-engine.ts` 的科目 code 是否在 Account 表中。

### 跨主體資料洩漏（看到別家公司的資料）

1. 確認 `getCurrentEntity()` 回傳正確的 `orgId`
2. 檢查 cookie：瀏覽器 DevTools → Application → Cookies → `zeugi_org_id` / `zeugi_entity_id`
3. 確認 Server Action 有 `assertOrgOwns` / `assertEntityOwns` guard

### Cron 排程沒有產生循環收支 / 折舊

1. 手動觸發：

   ```bash
   curl http://localhost:3010/api/cron/expenses
   ```

2. 檢查回應中每個 entity 的 `processed` 陣列
3. 常見原因：
   - `due_day` 與今天日期不符
   - 本月已產生（防重複機制）
   - Entity 未啟用（`is_active = false`）

### Migration 失敗

見 [migration.md](./migration.md) 的回滾流程。

## 資料一致性檢查

```sql
-- 檢查借貸不平衡的分錄
SELECT je.id, je.book_type,
       SUM(jl.debit) as total_debit,
       SUM(jl.credit) as total_credit
FROM "JournalEntry" je
JOIN "JournalLine" jl ON jl.entry_id = je.id
GROUP BY je.id, je.book_type
HAVING ABS(SUM(jl.debit) - SUM(jl.credit)) > 0.01;

-- 檢查 Transaction 沒有對應分錄的孤兒紀錄
SELECT t.id, t.description, t.source_type
FROM "Transaction" t
LEFT JOIN "JournalEntry" je ON je.transaction_id = t.id
WHERE je.id IS NULL AND t.status != 'voided';

-- 檢查重複的 source_type + source_id
SELECT source_type, source_id, COUNT(*)
FROM "Transaction"
WHERE source_id IS NOT NULL
GROUP BY source_type, source_id
HAVING COUNT(*) > 1;
```
