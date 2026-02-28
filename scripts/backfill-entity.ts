import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const DEFAULT_ORG_ID = "default-org";
const DEFAULT_ENTITY_ID = "default-entity";

async function main() {
  // Backfill org_id for org-scoped models
  console.log("Backfilling org_id...");
  const s = await prisma.supplier.updateMany({ where: { org_id: null }, data: { org_id: DEFAULT_ORG_ID } });
  console.log(`  Supplier: ${s.count}`);
  const i = await prisma.ingredient.updateMany({ where: { org_id: null }, data: { org_id: DEFAULT_ORG_ID } });
  console.log(`  Ingredient: ${i.count}`);
  const a = await prisma.account.updateMany({ where: { org_id: null }, data: { org_id: DEFAULT_ORG_ID } });
  console.log(`  Account: ${a.count}`);

  // Backfill entity_id for entity-scoped models
  console.log("Backfilling entity_id...");
  const po = await prisma.purchaseOrder.updateMany({ where: { entity_id: null }, data: { entity_id: DEFAULT_ENTITY_ID } });
  console.log(`  PurchaseOrder: ${po.count}`);
  const tx = await prisma.transaction.updateMany({ where: { entity_id: null }, data: { entity_id: DEFAULT_ENTITY_ID } });
  console.log(`  Transaction: ${tx.count}`);
  const je = await prisma.journalEntry.updateMany({ where: { entity_id: null }, data: { entity_id: DEFAULT_ENTITY_ID } });
  console.log(`  JournalEntry: ${je.count}`);
  const fa = await prisma.fixedAsset.updateMany({ where: { entity_id: null }, data: { entity_id: DEFAULT_ENTITY_ID } });
  console.log(`  FixedAsset: ${fa.count}`);
  const emp = await prisma.employee.updateMany({ where: { entity_id: null }, data: { entity_id: DEFAULT_ENTITY_ID } });
  console.log(`  Employee: ${emp.count}`);
  const b = await prisma.batch.updateMany({ where: { entity_id: null }, data: { entity_id: DEFAULT_ENTITY_ID } });
  console.log(`  Batch: ${b.count}`);

  console.log("Backfill complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
