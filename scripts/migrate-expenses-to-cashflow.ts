import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("=== 開始遷移支出資料至收支管理 ===");

  // 1. Migrate ExpenseCategory → CashflowCategory
  const oldCategories = await prisma.expenseCategory.findMany();
  console.log(`找到 ${oldCategories.length} 個舊分類`);

  const categoryMap = new Map<string, string>(); // oldId → newId

  for (const cat of oldCategories) {
    // Check if a matching CashflowCategory already exists
    const existing = await prisma.cashflowCategory.findFirst({
      where: {
        org_id: cat.org_id,
        direction: "expense",
        name: cat.name,
      },
    });

    if (existing) {
      categoryMap.set(cat.id, existing.id);
      console.log(`  分類「${cat.name}」已存在，映射到 ${existing.id}`);
    } else {
      const newCat = await prisma.cashflowCategory.create({
        data: {
          org_id: cat.org_id,
          direction: "expense",
          group_name: "其他支出", // Old categories had no group, default to "其他支出"
          name: cat.name,
          account_code: "6134", // Default expense code
        },
      });
      categoryMap.set(cat.id, newCat.id);
      console.log(`  分類「${cat.name}」已建立 → ${newCat.id}`);
    }
  }

  // 2. Get default fund account (cash)
  const defaultFundAccount = await prisma.fundAccount.findFirst({
    where: { account_type: "cash" },
  });

  // 3. Migrate ExpenseRecord → CashflowRecord
  const oldRecords = await prisma.expenseRecord.findMany();
  console.log(`\n找到 ${oldRecords.length} 筆舊支出紀錄`);

  let migratedRecords = 0;
  for (const rec of oldRecords) {
    const newCategoryId = categoryMap.get(rec.category_id);
    if (!newCategoryId) {
      console.warn(`  跳過紀錄 ${rec.id}：找不到對應分類`);
      continue;
    }

    await prisma.cashflowRecord.create({
      data: {
        entity_id: rec.entity_id,
        direction: "expense",
        category_id: newCategoryId,
        fund_account_id: defaultFundAccount?.id || null,
        amount: rec.amount,
        record_date: rec.expense_date,
        description: rec.description,
        source: rec.source,
        recorded_at: rec.recorded_at,
      },
    });
    migratedRecords++;
  }
  console.log(`已遷移 ${migratedRecords} 筆紀錄`);

  // 4. Migrate RecurringExpense → RecurringCashflow
  const oldRecurring = await prisma.recurringExpense.findMany();
  console.log(`\n找到 ${oldRecurring.length} 筆舊定期支出`);

  for (const rec of oldRecurring) {
    const newCategoryId = categoryMap.get(rec.category_id);
    if (!newCategoryId) {
      console.warn(`  跳過定期支出 ${rec.id}：找不到對應分類`);
      continue;
    }

    await prisma.recurringCashflow.create({
      data: {
        entity_id: rec.entity_id,
        direction: "expense",
        name: rec.name,
        category_id: newCategoryId,
        fund_account_id: defaultFundAccount?.id || null,
        amount: rec.amount,
        due_day: rec.due_day,
        description: rec.description,
        is_active: rec.is_active,
        last_generated: rec.last_generated,
      },
    });
  }
  console.log(`已遷移 ${oldRecurring.length} 筆定期支出`);

  console.log("\n=== 遷移完成 ===");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
