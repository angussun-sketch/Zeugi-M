export const dynamic = "force-dynamic";

import { getBatchWithLiveCost } from "@/actions/batches";
import { getIngredients } from "@/actions/ingredients";
import { notFound } from "next/navigation";
import { BatchDetailClient } from "./client";

export default async function BatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [batch, ingredients] = await Promise.all([
    getBatchWithLiveCost(id),
    getIngredients(),
  ]);
  if (!batch) notFound();

  return <BatchDetailClient batch={batch} ingredients={ingredients} />;
}
