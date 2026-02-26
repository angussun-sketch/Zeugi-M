"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function getIngredients() {
  return prisma.ingredient.findMany({
    include: {
      purchase_records: {
        where: { is_current: true },
        take: 1,
      },
    },
    orderBy: { name: "asc" },
  });
}

export async function getIngredient(id: string) {
  return prisma.ingredient.findUnique({
    where: { id },
    include: {
      purchase_records: {
        orderBy: { recorded_at: "desc" },
      },
    },
  });
}

export async function createIngredient(data: {
  name: string;
  measure_type: string;
}) {
  const ingredient = await prisma.ingredient.create({ data });
  revalidatePath("/ingredients");
  return ingredient;
}

export async function updateIngredient(
  id: string,
  data: { name: string; measure_type: string }
) {
  const ingredient = await prisma.ingredient.update({
    where: { id },
    data,
  });
  revalidatePath("/ingredients");
  return ingredient;
}

export async function deleteIngredient(id: string) {
  await prisma.ingredient.delete({ where: { id } });
  revalidatePath("/ingredients");
}
