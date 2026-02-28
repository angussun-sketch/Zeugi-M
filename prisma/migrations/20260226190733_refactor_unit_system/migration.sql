-- 重構單位系統：g/kg/cc/L → 公斤/台斤/公升/毫升

-- BatchInput.input_unit
UPDATE "BatchInput" SET qty_input = qty_input / 1000, input_unit = '公斤' WHERE input_unit = 'g';
UPDATE "BatchInput" SET input_unit = '公斤' WHERE input_unit = 'kg';
UPDATE "BatchInput" SET input_unit = '毫升' WHERE input_unit = 'cc';
UPDATE "BatchInput" SET input_unit = '公升' WHERE input_unit = 'L';

-- PurchaseOrderItem.purchase_unit
UPDATE "PurchaseOrderItem" SET purchase_qty = purchase_qty / 1000, purchase_unit = '公斤' WHERE purchase_unit = 'g';
UPDATE "PurchaseOrderItem" SET purchase_unit = '公斤' WHERE purchase_unit = 'kg';
UPDATE "PurchaseOrderItem" SET purchase_unit = '毫升' WHERE purchase_unit = 'cc';
UPDATE "PurchaseOrderItem" SET purchase_unit = '公升' WHERE purchase_unit = 'L';

-- PurchaseOrderItem.per_package_unit
UPDATE "PurchaseOrderItem" SET per_package_qty = per_package_qty / 1000, per_package_unit = '公斤' WHERE per_package_unit = 'g';
UPDATE "PurchaseOrderItem" SET per_package_unit = '公斤' WHERE per_package_unit = 'kg';
UPDATE "PurchaseOrderItem" SET per_package_unit = '毫升' WHERE per_package_unit = 'cc';
UPDATE "PurchaseOrderItem" SET per_package_unit = '公升' WHERE per_package_unit = 'L';

-- 移除罐（轉為桶）
UPDATE "PurchaseOrderItem" SET purchase_unit = '桶' WHERE purchase_unit = '罐';
