export const dynamic = "force-dynamic";

import { getPurchaseOrder, getSuppliers } from "@/actions/purchase-orders";
import { getIngredients } from "@/actions/ingredients";
import { notFound } from "next/navigation";
import { PurchaseOrderDetailClient } from "./client";

export default async function PurchaseOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [order, ingredients, suppliers] = await Promise.all([
    getPurchaseOrder(id),
    getIngredients(),
    getSuppliers(),
  ]);
  if (!order) notFound();
  return (
    <PurchaseOrderDetailClient
      order={order}
      ingredients={ingredients.map((i) => ({
        id: i.id,
        name: i.name,
        measure_type: i.measure_type,
      }))}
      suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
    />
  );
}
