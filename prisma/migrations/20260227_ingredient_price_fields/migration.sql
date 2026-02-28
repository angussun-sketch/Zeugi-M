-- 1. 新增欄位
ALTER TABLE "Ingredient" ADD COLUMN "unit_cost_base" DOUBLE PRECISION;
ALTER TABLE "Ingredient" ADD COLUMN "purchase_qty" DOUBLE PRECISION;
ALTER TABLE "Ingredient" ADD COLUMN "purchase_unit" TEXT;
ALTER TABLE "Ingredient" ADD COLUMN "per_package_qty" DOUBLE PRECISION;
ALTER TABLE "Ingredient" ADD COLUMN "per_package_unit" TEXT;
ALTER TABLE "Ingredient" ADD COLUMN "subtotal" DOUBLE PRECISION;

-- 2. 從現有叫貨單回填（取每個原料最新日期的最新一筆）
WITH latest_items AS (
  SELECT DISTINCT ON (poi.ingredient_id)
    poi.ingredient_id,
    poi.unit_cost_base,
    poi.purchase_qty,
    poi.purchase_unit,
    poi.per_package_qty,
    poi.per_package_unit,
    poi.subtotal
  FROM "PurchaseOrderItem" poi
  JOIN "PurchaseOrder" po ON po.id = poi.order_id
  ORDER BY poi.ingredient_id, po.order_date DESC, po.created_at DESC
)
UPDATE "Ingredient" i
SET
  unit_cost_base   = li.unit_cost_base,
  purchase_qty     = li.purchase_qty,
  purchase_unit    = li.purchase_unit,
  per_package_qty  = li.per_package_qty,
  per_package_unit = li.per_package_unit,
  subtotal         = li.subtotal
FROM latest_items li
WHERE i.id = li.ingredient_id;
