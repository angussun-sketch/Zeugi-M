import { generateRecurringCashflows } from "@/actions/cashflow";
import { generateMonthlyDepreciation } from "@/actions/fixed-assets";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  // 簡單 token 驗證（防止外部隨意觸發）
  const token = process.env.CRON_SECRET;
  if (token) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${token}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // 遍歷所有啟用中的 Entity
  const entities = await prisma.entity.findMany({
    where: { is_active: true },
    select: { id: true, name: true },
  });

  const results = [];
  for (const entity of entities) {
    const [cashflow, depreciation] = await Promise.all([
      generateRecurringCashflows(entity.id),
      generateMonthlyDepreciation(entity.id),
    ]);
    results.push({ entity: entity.name, cashflow, depreciation });
  }

  return NextResponse.json({ results });
}
