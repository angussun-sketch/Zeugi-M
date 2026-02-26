"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { toBase, type Unit } from "@/lib/units";

export async function createPurchaseRecord(data: {
  ingredient_id: string;
  purchase_price: number;
  purchase_unit: string;
  // Direct input mode
  purchase_qty?: number;
  // Package mode
  package_count?: number;
  per_package_qty?: number;
  per_package_unit?: string;
}) {
  let purchase_qty_base: number;

  if (data.package_count && data.per_package_qty) {
    // Package mode: count × per_package_qty, then convert
    const unit = (data.per_package_unit || data.purchase_unit) as Unit;
    const totalQty = data.package_count * data.per_package_qty;
    purchase_qty_base = toBase(totalQty, unit);
  } else if (data.purchase_qty) {
    // Direct mode
    purchase_qty_base = toBase(data.purchase_qty, data.purchase_unit as Unit);
  } else {
    throw new Error("必須提供採購數量");
  }

  const unit_cost_base = data.purchase_price / purchase_qty_base;

  // Mark old records as not current
  await prisma.purchaseRecord.updateMany({
    where: { ingredient_id: data.ingredient_id, is_current: true },
    data: { is_current: false },
  });

  const record = await prisma.purchaseRecord.create({
    data: {
      ingredient_id: data.ingredient_id,
      purchase_price: data.purchase_price,
      purchase_qty_base,
      purchase_unit: data.purchase_unit,
      package_count: data.package_count || null,
      per_package_qty: data.per_package_qty || null,
      per_package_unit: data.per_package_unit || null,
      unit_cost_base,
      is_current: true,
    },
  });

  revalidatePath("/ingredients");
  return record;
}
