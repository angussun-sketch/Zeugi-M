import { getIngredients } from "@/actions/ingredients";
import { BatchNewClient } from "./client";

export default async function NewBatchPage() {
  const ingredients = await getIngredients();
  return <BatchNewClient ingredients={ingredients} />;
}
