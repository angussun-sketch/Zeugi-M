export const dynamic = "force-dynamic";

import {
  getPurchaseOrders,
  getIngredientNames,
  getSupplierNames,
} from "@/actions/purchase-orders";
import { PurchaseOrdersClient } from "./client";

export default async function PurchaseOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const dateFrom = (params.dateFrom as string) || undefined;
  const dateTo = (params.dateTo as string) || undefined;
  const supplierName = (params.supplier as string) || undefined;
  const ingredientIds = params.ingredients
    ? Array.isArray(params.ingredients)
      ? params.ingredients
      : params.ingredients.split(",")
    : undefined;

  const [result, ingredients, supplierNames] = await Promise.all([
    getPurchaseOrders({ page, dateFrom, dateTo, supplierName, ingredientIds }),
    getIngredientNames(),
    getSupplierNames(),
  ]);

  return (
    <PurchaseOrdersClient
      orders={result.orders}
      total={result.total}
      page={result.page}
      totalPages={result.totalPages}
      ingredients={ingredients}
      supplierNames={supplierNames}
      filters={{
        dateFrom: dateFrom ?? "",
        dateTo: dateTo ?? "",
        supplierName: supplierName ?? "",
        ingredientIds: ingredientIds ?? [],
      }}
    />
  );
}
