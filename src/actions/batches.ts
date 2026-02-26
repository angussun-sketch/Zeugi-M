"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { toBase, type Unit } from "@/lib/units";
import { calculateBatch } from "@/lib/calc";

interface BatchInputData {
  ingredient_id: string;
  qty_input: number;
  input_unit: string;
  is_shared: boolean;
  dedicated_to_index?: number; // index into outputs array
}

interface BatchOutputData {
  flavor_name: string;
  pieces: number;
  filling_g_per_piece?: number;
}

export async function createBatch(data: {
  name: string;
  alloc_method: string;
  notes?: string;
  inputs: BatchInputData[];
  outputs: BatchOutputData[];
}) {
  // 1. Get current unit costs for all ingredients
  const ingredientIds = [...new Set(data.inputs.map((i) => i.ingredient_id))];
  const currentPrices = await prisma.purchaseRecord.findMany({
    where: {
      ingredient_id: { in: ingredientIds },
      is_current: true,
    },
  });
  const priceMap = new Map(currentPrices.map((p) => [p.ingredient_id, p.unit_cost_base]));

  // 2. Create batch with outputs first (need IDs for dedicated_to)
  const batch = await prisma.batch.create({
    data: {
      name: data.name,
      alloc_method: data.alloc_method,
      notes: data.notes || null,
      outputs: {
        create: data.outputs.map((o) => ({
          flavor_name: o.flavor_name,
          pieces: o.pieces,
          filling_g_per_piece: o.filling_g_per_piece ?? null,
        })),
      },
    },
    include: { outputs: true },
  });

  // 3. Create inputs with cost calculation
  const inputsToCreate = data.inputs.map((input) => {
    const qty_base = toBase(input.qty_input, input.input_unit as Unit);
    const unit_cost_used = priceMap.get(input.ingredient_id) || 0;
    const cost = qty_base * unit_cost_used;
    const dedicated_to =
      !input.is_shared && input.dedicated_to_index !== undefined
        ? batch.outputs[input.dedicated_to_index]?.id || null
        : null;

    return {
      batch_id: batch.id,
      ingredient_id: input.ingredient_id,
      qty_input: input.qty_input,
      input_unit: input.input_unit,
      qty_base,
      unit_cost_used,
      cost,
      is_shared: input.is_shared,
      dedicated_to,
    };
  });

  await prisma.batchInput.createMany({ data: inputsToCreate });

  // 4. Run allocation calculation
  const createdInputs = await prisma.batchInput.findMany({
    where: { batch_id: batch.id },
  });

  const calcResult = calculateBatch(
    createdInputs.map((i) => ({
      id: i.id,
      ingredient_id: i.ingredient_id,
      qty_base: i.qty_base,
      unit_cost_used: i.unit_cost_used,
      cost: i.cost,
      is_shared: i.is_shared,
      dedicated_to: i.dedicated_to,
    })),
    batch.outputs.map((o) => ({
      id: o.id,
      flavor_name: o.flavor_name,
      pieces: o.pieces,
      filling_g_per_piece: o.filling_g_per_piece,
    })),
    data.alloc_method as "by_pieces" | "by_filling_weight"
  );

  // 5. Update batch and outputs with calculated costs
  await prisma.batch.update({
    where: { id: batch.id },
    data: { total_cost: calcResult.total_cost },
  });

  for (const outputResult of calcResult.outputs) {
    await prisma.batchOutput.update({
      where: { id: outputResult.id },
      data: {
        total_cost: outputResult.total_cost,
        cost_per_piece: outputResult.cost_per_piece,
      },
    });
  }

  revalidatePath("/batches");
  return batch.id;
}

export async function getBatches() {
  return prisma.batch.findMany({
    include: {
      outputs: true,
      _count: { select: { inputs: true } },
    },
    orderBy: { created_at: "desc" },
  });
}

export async function getBatch(id: string) {
  return prisma.batch.findUnique({
    where: { id },
    include: {
      inputs: {
        include: { ingredient: true },
      },
      outputs: true,
    },
  });
}

export async function deleteBatch(id: string) {
  await prisma.batch.delete({ where: { id } });
  revalidatePath("/batches");
}
