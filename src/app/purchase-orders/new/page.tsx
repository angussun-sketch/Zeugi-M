export const dynamic = "force-dynamic";

import { getIngredients } from "@/actions/ingredients";
import { getSuppliers } from "@/actions/purchase-orders";
import { getActiveEntities } from "@/actions/entities";
import { PurchaseOrderNewClient } from "./client";

export default async function NewPurchaseOrderPage() {
  const [ingredients, suppliers, entities] = await Promise.all([
    getIngredients(),
    getSuppliers(),
    getActiveEntities(),
  ]);
  return (
    <PurchaseOrderNewClient
      ingredients={ingredients}
      suppliers={suppliers}
      entities={entities}
    />
  );
}
