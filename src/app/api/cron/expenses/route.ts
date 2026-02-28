import { generateRecurringCashflows } from "@/actions/cashflow";
import { generateMonthlyDepreciation } from "@/actions/fixed-assets";
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

  const [cashflowResult, depreciationResult] = await Promise.all([
    generateRecurringCashflows(),
    generateMonthlyDepreciation(),
  ]);

  return NextResponse.json({
    cashflow: cashflowResult,
    depreciation: depreciationResult,
  });
}
