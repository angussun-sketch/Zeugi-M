import { getSuppliers, getSupplierCategories } from "@/actions/purchase-orders";
import { SuppliersClient } from "./client";

export const dynamic = "force-dynamic";

export default async function SuppliersPage() {
  const [suppliers, categories] = await Promise.all([
    getSuppliers(),
    getSupplierCategories(),
  ]);

  return <SuppliersClient suppliers={suppliers} categories={categories} />;
}
