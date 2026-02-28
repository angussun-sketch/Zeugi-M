-- DropForeignKey
ALTER TABLE "PurchaseRecord" DROP CONSTRAINT "PurchaseRecord_ingredient_id_fkey";

-- DropTable
DROP TABLE "PurchaseRecord";
