-- DropForeignKey
ALTER TABLE "ExpenseCategory" DROP CONSTRAINT "ExpenseCategory_org_id_fkey";

-- DropForeignKey
ALTER TABLE "ExpenseRecord" DROP CONSTRAINT "ExpenseRecord_category_id_fkey";

-- DropForeignKey
ALTER TABLE "ExpenseRecord" DROP CONSTRAINT "ExpenseRecord_entity_id_fkey";

-- DropForeignKey
ALTER TABLE "ExpenseRecord" DROP CONSTRAINT "ExpenseRecord_recurring_expense_id_fkey";

-- DropForeignKey
ALTER TABLE "RecurringExpense" DROP CONSTRAINT "RecurringExpense_category_id_fkey";

-- DropForeignKey
ALTER TABLE "RecurringExpense" DROP CONSTRAINT "RecurringExpense_entity_id_fkey";

-- DropTable
DROP TABLE "ExpenseCategory";

-- DropTable
DROP TABLE "ExpenseRecord";

-- DropTable
DROP TABLE "RecurringExpense";
