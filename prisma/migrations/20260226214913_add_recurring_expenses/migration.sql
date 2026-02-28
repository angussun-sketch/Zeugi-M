/*
  Warnings:

  - You are about to drop the column `period_end` on the `ExpenseRecord` table. All the data in the column will be lost.
  - You are about to drop the column `period_start` on the `ExpenseRecord` table. All the data in the column will be lost.
  - Added the required column `expense_date` to the `ExpenseRecord` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ExpenseRecord" DROP COLUMN "period_end",
DROP COLUMN "period_start",
ADD COLUMN     "expense_date" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "recurring_expense_id" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'manual';

-- CreateTable
CREATE TABLE "RecurringExpense" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "due_day" INTEGER NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_generated" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringExpense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecurringExpense_category_id_idx" ON "RecurringExpense"("category_id");

-- CreateIndex
CREATE INDEX "ExpenseRecord_expense_date_idx" ON "ExpenseRecord"("expense_date");

-- CreateIndex
CREATE INDEX "ExpenseRecord_recurring_expense_id_idx" ON "ExpenseRecord"("recurring_expense_id");

-- AddForeignKey
ALTER TABLE "ExpenseRecord" ADD CONSTRAINT "ExpenseRecord_recurring_expense_id_fkey" FOREIGN KEY ("recurring_expense_id") REFERENCES "RecurringExpense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringExpense" ADD CONSTRAINT "RecurringExpense_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "ExpenseCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
