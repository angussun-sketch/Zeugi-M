import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// 科目表：對齊台灣商業會計項目表（112年度）
const accounts = [
  // ── 111 現金及約當現金 ──
  { code: "1111", name: "庫存現金", type: "asset" },
  { code: "1113", name: "銀行存款", type: "asset" },

  // ── 119 應收帳款 ──
  { code: "1191", name: "應收帳款", type: "asset" },

  // ── 123-124 存貨 ──
  { code: "1235", name: "製成品", type: "asset" },
  { code: "1237", name: "在製品", type: "asset" },
  { code: "1239", name: "原料", type: "asset" },

  // ── 126-127 預付款項 ──
  { code: "1268", name: "進項稅額", type: "asset" },

  // ── 139-146 不動產、廠房及設備 ──
  { code: "1421", name: "機器設備—成本", type: "asset" },
  { code: "1422", name: "累計折舊—機器設備", type: "asset" },
  { code: "1431", name: "辦公設備—成本", type: "asset" },
  { code: "1432", name: "累計折舊—辦公設備", type: "asset" },
  { code: "1461", name: "租賃權益改良—成本", type: "asset" },
  { code: "1462", name: "累計折舊—租賃權益改良", type: "asset" },

  // ── 157-158 其他非流動資產 ──
  { code: "1584", name: "業主(股東)往來", type: "asset" },

  // ── 217 應付帳款 ──
  { code: "2171", name: "應付帳款", type: "liability" },

  // ── 219-220 其他應付款 ──
  { code: "2191", name: "應付薪資", type: "liability" },
  { code: "2194", name: "應付營業稅", type: "liability" },
  { code: "2204", name: "銷項稅額", type: "liability" },
  { code: "2206", name: "其他應付款—其他", type: "liability" },

  // ── 239 其他非流動負債 ──
  { code: "2393", name: "業主(股東)往來", type: "liability" },

  // ── 31 資本 ──
  { code: "3111", name: "業主資本", type: "equity" },

  // ── 41 營業收入 ──
  { code: "4111", name: "銷貨收入", type: "revenue" },
  { code: "4141", name: "其他營業收入", type: "revenue" },

  // ── 511 銷貨成本 ──
  { code: "5111", name: "銷貨成本", type: "expense" },

  // ── 513 進料 ──
  { code: "5131", name: "進料", type: "expense" },

  // ── 514 直接人工 ──
  { code: "5141", name: "直接人工", type: "expense" },

  // ── 515-516 製造費用 ──
  { code: "5158", name: "包裝費", type: "expense" },
  { code: "5163", name: "折舊（製造）", type: "expense" },
  { code: "5169", name: "其他製造費用", type: "expense" },

  // ── 611-613 營業費用 ──
  { code: "6111", name: "薪資支出", type: "expense" },
  { code: "6112", name: "租金支出", type: "expense" },
  { code: "6115", name: "運費", type: "expense" },
  { code: "6117", name: "修繕費", type: "expense" },
  { code: "6119", name: "水電瓦斯費", type: "expense" },
  { code: "6120", name: "保險費", type: "expense" },
  { code: "6123", name: "稅捐", type: "expense" },
  { code: "6125", name: "折舊", type: "expense" },
  { code: "6134", name: "其他營業費用", type: "expense" },
];

async function main() {
  // 1. 建立預設 Organization 和 Entity
  console.log("Seeding default organization and entity...");

  const org = await prisma.organization.upsert({
    where: { id: "default-org" },
    update: {},
    create: { id: "default-org", name: "預設組織" },
  });
  console.log(`Organization: ${org.id} (${org.name})`);

  const entity = await prisma.entity.upsert({
    where: { org_id_tax_id: { org_id: org.id, tax_id: "00000000" } },
    update: {},
    create: {
      id: "default-entity",
      org_id: org.id,
      tax_id: "00000000",
      name: "預設營業主體",
    },
  });
  console.log(`Entity: ${entity.id} (${entity.name})`);

  // 2. 建立科目表
  console.log("Seeding chart of accounts...");

  for (const account of accounts) {
    await prisma.account.upsert({
      where: { org_id_code: { org_id: org.id, code: account.code } },
      update: { name: account.name, type: account.type },
      create: { ...account, org_id: org.id },
    });
  }

  console.log(`Seeded ${accounts.length} accounts.`);

  // ---- 預設資金帳戶 ----
  const fundAccounts = [
    { name: "現金", account_type: "cash", sort_order: 1 },
    { name: "銀行存款", account_type: "bank", sort_order: 2 },
    { name: "信用卡", account_type: "credit_card", sort_order: 3 },
    { name: "業主墊付", account_type: "other", sort_order: 4 },
  ];

  for (const fa of fundAccounts) {
    await prisma.fundAccount.upsert({
      where: { org_id_name: { org_id: "default-org", name: fa.name } },
      update: {},
      create: { org_id: "default-org", ...fa },
    });
  }
  console.log(`Seeded ${fundAccounts.length} fund accounts`);

  // ---- 預設收支分類 ----
  const cashflowCategories = [
    // 支出分類
    { direction: "expense", group_name: "成本·進貨", name: "原料費", account_code: "5131", sort_order: 1 },
    { direction: "expense", group_name: "成本·進貨", name: "包裝費", account_code: "5158", sort_order: 2 },
    { direction: "expense", group_name: "薪資·人事", name: "薪資", account_code: "6111", sort_order: 1 },
    { direction: "expense", group_name: "薪資·人事", name: "勞健保", account_code: "6120", sort_order: 2 },
    { direction: "expense", group_name: "辦公·行政", name: "房租", account_code: "6112", sort_order: 1 },
    { direction: "expense", group_name: "辦公·行政", name: "水電費", account_code: "6119", sort_order: 2 },
    { direction: "expense", group_name: "辦公·行政", name: "文具用品", account_code: "6134", sort_order: 3 },
    { direction: "expense", group_name: "業務·行銷", name: "廣告費", account_code: "6134", sort_order: 1 },
    { direction: "expense", group_name: "業務·行銷", name: "交際費", account_code: "6134", sort_order: 2 },
    { direction: "expense", group_name: "手續費·稅務", name: "手續費", account_code: "6134", sort_order: 1 },
    { direction: "expense", group_name: "手續費·稅務", name: "稅捐", account_code: "6123", sort_order: 2 },
    { direction: "expense", group_name: "其他支出", name: "雜項支出", account_code: "6134", sort_order: 1 },
    // 收入分類
    { direction: "income", group_name: "營業收入", name: "門市營收", account_code: "4111", sort_order: 1 },
    { direction: "income", group_name: "營業收入", name: "批發收入", account_code: "4111", sort_order: 2 },
    { direction: "income", group_name: "營業收入", name: "外送平台收入", account_code: "4111", sort_order: 3 },
    { direction: "income", group_name: "營業外收入", name: "利息收入", account_code: "7111", sort_order: 1 },
    { direction: "income", group_name: "營業外收入", name: "補助收入", account_code: "4141", sort_order: 2 },
    { direction: "income", group_name: "營業外收入", name: "其他收入", account_code: "4141", sort_order: 3 },
  ];

  for (const cat of cashflowCategories) {
    await prisma.cashflowCategory.upsert({
      where: {
        org_id_direction_group_name_name: {
          org_id: "default-org",
          direction: cat.direction,
          group_name: cat.group_name,
          name: cat.name,
        },
      },
      update: {},
      create: { org_id: "default-org", ...cat },
    });
  }
  console.log(`Seeded ${cashflowCategories.length} cashflow categories`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
