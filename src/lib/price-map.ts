import { prisma } from "@/lib/db";

export interface PriceInfo {
  unit_cost_base: number;            // 元/g 或 元/cc
  purchase_unit: string;             // 採購單位（箱、kg...）
  purchase_qty: number;              // 採購數量
  purchase_unit_cost: number;        // 每採購單位的價格（元/箱、元/kg...）
  subtotal: number;                  // 該筆總價
  per_package_qty: number | null;    // 每包裝量（如 5）
  per_package_unit: string | null;   // 每包裝單位（如 kg）
}

/**
 * 取得各原料的最新價格資訊
 * 以叫貨單日期 (order_date) 判定，最新日期的為目前成本
 */
export async function getLatestPriceMap(
  ingredientIds?: string[],
): Promise<Map<string, PriceInfo>> {
  const items = await prisma.purchaseOrderItem.findMany({
    where: ingredientIds ? { ingredient_id: { in: ingredientIds } } : undefined,
    include: { order: { select: { order_date: true } } },
    orderBy: [
      { order: { order_date: "desc" } },
      { order: { created_at: "desc" } },
    ],
  });

  const map = new Map<string, PriceInfo>();
  for (const item of items) {
    if (!map.has(item.ingredient_id)) {
      map.set(item.ingredient_id, {
        unit_cost_base: item.unit_cost_base,
        purchase_unit: item.purchase_unit,
        purchase_qty: item.purchase_qty,
        purchase_unit_cost: item.subtotal / item.purchase_qty,
        subtotal: item.subtotal,
        per_package_qty: item.per_package_qty,
        per_package_unit: item.per_package_unit,
      });
    }
  }
  return map;
}
