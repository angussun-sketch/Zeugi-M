-- 新增 order_number 欄位（先可 NULL）
ALTER TABLE "PurchaseOrder" ADD COLUMN "order_number" TEXT;

-- 回填現有資料：PO-YYYYMMDD-NNN
WITH numbered AS (
  SELECT id, order_date,
    ROW_NUMBER() OVER (
      PARTITION BY DATE(order_date)
      ORDER BY created_at ASC
    ) AS seq
  FROM "PurchaseOrder"
)
UPDATE "PurchaseOrder" po
SET order_number = 'PO-' || TO_CHAR(n.order_date, 'YYYYMMDD') || '-' || LPAD(n.seq::text, 3, '0')
FROM numbered n
WHERE po.id = n.id;

-- 設為 NOT NULL + UNIQUE
ALTER TABLE "PurchaseOrder" ALTER COLUMN "order_number" SET NOT NULL;
CREATE UNIQUE INDEX "PurchaseOrder_order_number_key" ON "PurchaseOrder"("order_number");
