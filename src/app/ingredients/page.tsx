import { getIngredients } from "@/actions/ingredients";
import { IngredientsClient } from "./client";

export default async function IngredientsPage() {
  const ingredients = await getIngredients();
  return <IngredientsClient ingredients={ingredients} />;
}
