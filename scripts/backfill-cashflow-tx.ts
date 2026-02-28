import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const records = await prisma.cashflowRecord.findMany({
    select: { id: true, direction: true },
  });

  let updated = 0;
  for (const record of records) {
    const sourceType = record.direction === "income"
      ? "cashflow_income"
      : "cashflow_expense";
    const tx = await prisma.transaction.findFirst({
      where: { source_type: sourceType, source_id: record.id },
      select: { id: true },
    });
    if (tx) {
      await prisma.cashflowRecord.update({
        where: { id: record.id },
        data: { transaction_id: tx.id },
      });
      updated++;
    }
  }
  console.log(`Backfilled ${updated}/${records.length} records`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
