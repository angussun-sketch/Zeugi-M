-- AlterTable
ALTER TABLE "CashflowRecord" ADD COLUMN     "transaction_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "CashflowRecord_transaction_id_key" ON "CashflowRecord"("transaction_id");

-- AddForeignKey
ALTER TABLE "CashflowRecord" ADD CONSTRAINT "CashflowRecord_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
