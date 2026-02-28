-- DropForeignKey
ALTER TABLE "Account" DROP CONSTRAINT "Account_org_id_fkey";

-- DropForeignKey
ALTER TABLE "Batch" DROP CONSTRAINT "Batch_entity_id_fkey";

-- DropForeignKey
ALTER TABLE "Employee" DROP CONSTRAINT "Employee_entity_id_fkey";

-- DropForeignKey
ALTER TABLE "ExpenseCategory" DROP CONSTRAINT "ExpenseCategory_org_id_fkey";

-- DropForeignKey
ALTER TABLE "ExpenseRecord" DROP CONSTRAINT "ExpenseRecord_entity_id_fkey";

-- DropForeignKey
ALTER TABLE "FixedAsset" DROP CONSTRAINT "FixedAsset_entity_id_fkey";

-- DropForeignKey
ALTER TABLE "Ingredient" DROP CONSTRAINT "Ingredient_org_id_fkey";

-- DropForeignKey
ALTER TABLE "JournalEntry" DROP CONSTRAINT "JournalEntry_entity_id_fkey";

-- DropForeignKey
ALTER TABLE "PurchaseOrder" DROP CONSTRAINT "PurchaseOrder_entity_id_fkey";

-- DropForeignKey
ALTER TABLE "RecurringExpense" DROP CONSTRAINT "RecurringExpense_entity_id_fkey";

-- DropForeignKey
ALTER TABLE "Supplier" DROP CONSTRAINT "Supplier_org_id_fkey";

-- DropForeignKey
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_entity_id_fkey";

-- DropIndex
DROP INDEX "Account_code_key";

-- DropIndex
DROP INDEX "ExpenseCategory_name_key";

-- DropIndex
DROP INDEX "Ingredient_name_key";

-- DropIndex
DROP INDEX "Supplier_name_key";

-- AlterTable
ALTER TABLE "Account" ALTER COLUMN "org_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "Batch" ALTER COLUMN "entity_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "Employee" ALTER COLUMN "entity_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "ExpenseCategory" ALTER COLUMN "org_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "ExpenseRecord" ALTER COLUMN "entity_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "FixedAsset" ALTER COLUMN "entity_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "Ingredient" ALTER COLUMN "org_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "JournalEntry" ALTER COLUMN "entity_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "PurchaseOrder" ALTER COLUMN "entity_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "RecurringExpense" ALTER COLUMN "entity_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "Supplier" ALTER COLUMN "org_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "Transaction" ALTER COLUMN "entity_id" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Account_org_id_idx" ON "Account"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "Account_org_id_code_key" ON "Account"("org_id", "code");

-- CreateIndex
CREATE INDEX "Batch_entity_id_idx" ON "Batch"("entity_id");

-- CreateIndex
CREATE INDEX "Employee_entity_id_idx" ON "Employee"("entity_id");

-- CreateIndex
CREATE INDEX "ExpenseCategory_org_id_idx" ON "ExpenseCategory"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseCategory_org_id_name_key" ON "ExpenseCategory"("org_id", "name");

-- CreateIndex
CREATE INDEX "ExpenseRecord_entity_id_idx" ON "ExpenseRecord"("entity_id");

-- CreateIndex
CREATE INDEX "FixedAsset_entity_id_idx" ON "FixedAsset"("entity_id");

-- CreateIndex
CREATE INDEX "Ingredient_org_id_idx" ON "Ingredient"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "Ingredient_org_id_name_key" ON "Ingredient"("org_id", "name");

-- CreateIndex
CREATE INDEX "JournalEntry_entity_id_idx" ON "JournalEntry"("entity_id");

-- CreateIndex
CREATE INDEX "PurchaseOrder_entity_id_idx" ON "PurchaseOrder"("entity_id");

-- CreateIndex
CREATE INDEX "RecurringExpense_entity_id_idx" ON "RecurringExpense"("entity_id");

-- CreateIndex
CREATE INDEX "Supplier_org_id_idx" ON "Supplier"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_org_id_name_key" ON "Supplier"("org_id", "name");

-- CreateIndex
CREATE INDEX "Transaction_entity_id_idx" ON "Transaction"("entity_id");

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "Entity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ingredient" ADD CONSTRAINT "Ingredient_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Batch" ADD CONSTRAINT "Batch_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "Entity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseCategory" ADD CONSTRAINT "ExpenseCategory_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseRecord" ADD CONSTRAINT "ExpenseRecord_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "Entity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringExpense" ADD CONSTRAINT "RecurringExpense_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "Entity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedAsset" ADD CONSTRAINT "FixedAsset_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "Entity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "Entity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "Entity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "Entity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

