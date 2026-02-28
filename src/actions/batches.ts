"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { toBase, type Unit } from "@/lib/units";
import { calculateBatch } from "@/lib/calc";
import { getLatestPriceMap, type PriceInfo } from "@/lib/price-map";
import { getCurrentEntity, assertEntityOwns } from "@/lib/multi-entity";

interface BatchInputData {
  ingredient_id: string;
  qty_input: number;
  input_unit: string;
  is_shared: boolean;
  dedicated_to_index?: number;
}

interface BatchOutputData {
  flavor_name: string;
  pieces: number;
  filling_g_per_piece?: number;
  skin_g_per_piece?: number;
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
  const priceMap = await getLatestPriceMap(ingredientIds);

  // 2. Create batch with outputs first (need IDs for dedicated_to)
  const { entityId } = await getCurrentEntity();
  const batch = await prisma.batch.create({
    data: {
      name: data.name,
      alloc_method: data.alloc_method,
      notes: data.notes || null,
      entity_id: entityId,
      outputs: {
        create: data.outputs.map((o) => ({
          flavor_name: o.flavor_name,
          pieces: o.pieces,
          filling_g_per_piece: o.filling_g_per_piece ?? null,
          skin_g_per_piece: o.skin_g_per_piece ?? null,
        })),
      },
    },
    include: { outputs: true },
  });

  // 3. Create inputs with cost calculation
  const inputsToCreate = data.inputs.map((input) => {
    const qty_base = toBase(input.qty_input, input.input_unit as Unit);
    const unit_cost_used = priceMap.get(input.ingredient_id)?.unit_cost_base || 0;
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

  // 4. Run allocation and update stored costs
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

// 即時計算成本（用最新原料價格）
function liveCostCalc(
  inputs: { qty_base: number; ingredient_id: string; is_shared: boolean; dedicated_to: string | null }[],
  outputs: { id: string; pieces: number; filling_g_per_piece: number | null }[],
  allocMethod: string,
  priceMap: Map<string, PriceInfo>
) {
  let totalCost = 0;
  const outputCosts: Record<string, number> = {};
  for (const o of outputs) outputCosts[o.id] = 0;

  const sharedInputs: typeof inputs = [];

  for (const input of inputs) {
    const unitCost = priceMap.get(input.ingredient_id)?.unit_cost_base || 0;
    const cost = input.qty_base * unitCost;
    totalCost += cost;

    if (!input.is_shared && input.dedicated_to) {
      outputCosts[input.dedicated_to] = (outputCosts[input.dedicated_to] || 0) + cost;
    } else {
      sharedInputs.push({ ...input, qty_base: input.qty_base });
    }
  }

  // Allocation ratios
  const totalPieces = outputs.reduce((s, o) => s + o.pieces, 0);
  const totalFilling = outputs.reduce(
    (s, o) => s + o.pieces * (o.filling_g_per_piece || 0),
    0
  );

  for (const input of sharedInputs) {
    const unitCost = priceMap.get(input.ingredient_id)?.unit_cost_base || 0;
    const cost = input.qty_base * unitCost;
    for (const o of outputs) {
      let ratio: number;
      if (allocMethod === "by_filling_weight" && totalFilling > 0) {
        ratio = (o.pieces * (o.filling_g_per_piece || 0)) / totalFilling;
      } else {
        ratio = totalPieces > 0 ? o.pieces / totalPieces : 0;
      }
      outputCosts[o.id] += cost * ratio;
    }
  }

  return {
    totalCost,
    outputs: outputs.map((o) => ({
      id: o.id,
      totalCost: outputCosts[o.id] || 0,
      costPerPiece: o.pieces > 0 ? (outputCosts[o.id] || 0) / o.pieces : 0,
    })),
  };
}

// 列表頁用：取得所有配方 + 即時成本
export async function getBatchesWithLiveCost() {
  const { orgId } = await getCurrentEntity();
  const batches = await prisma.batch.findMany({
    where: { entity: { org_id: orgId } },
    include: {
      inputs: true,
      outputs: true,
      _count: { select: { inputs: true } },
    },
    orderBy: { created_at: "desc" },
  });

  // 取得所有相關原料的最新價格
  const allIngredientIds = [
    ...new Set(batches.flatMap((b) => b.inputs.map((i) => i.ingredient_id))),
  ];
  const priceMap = await getLatestPriceMap(allIngredientIds);

  return batches.map((batch) => {
    const live = liveCostCalc(batch.inputs, batch.outputs, batch.alloc_method, priceMap);
    return {
      ...batch,
      liveTotalCost: live.totalCost,
      outputs: batch.outputs.map((o) => {
        const liveOutput = live.outputs.find((lo) => lo.id === o.id);
        return {
          ...o,
          liveCostPerPiece: liveOutput?.costPerPiece ?? 0,
        };
      }),
    };
  });
}

// 詳情頁用：單一配方 + 即時成本明細
export async function getBatchWithLiveCost(id: string) {
  const batch = await prisma.batch.findUnique({
    where: { id },
    include: {
      inputs: { include: { ingredient: true } },
      outputs: true,
    },
  });
  if (!batch) return null;

  const ingredientIds = [...new Set(batch.inputs.map((i) => i.ingredient_id))];
  const priceMap = await getLatestPriceMap(ingredientIds);

  const live = liveCostCalc(batch.inputs, batch.outputs, batch.alloc_method, priceMap);

  return {
    ...batch,
    liveTotalCost: live.totalCost,
    inputs: batch.inputs.map((input) => ({
      ...input,
      liveUnitCost: priceMap.get(input.ingredient_id)?.unit_cost_base || 0,
      liveCost: input.qty_base * (priceMap.get(input.ingredient_id)?.unit_cost_base || 0),
    })),
    outputs: batch.outputs.map((o) => {
      const liveOutput = live.outputs.find((lo) => lo.id === o.id);
      return {
        ...o,
        liveTotalCost: liveOutput?.totalCost ?? 0,
        liveCostPerPiece: liveOutput?.costPerPiece ?? 0,
      };
    }),
  };
}

// 保留舊的給其他地方用
export async function getBatches() {
  const { orgId } = await getCurrentEntity();
  return prisma.batch.findMany({
    where: { entity: { org_id: orgId } },
    include: {
      outputs: true,
      _count: { select: { inputs: true } },
    },
    orderBy: { created_at: "desc" },
  });
}

export async function getBatch(id: string) {
  await assertEntityOwns("batch", id);
  return prisma.batch.findUnique({
    where: { id },
    include: {
      inputs: { include: { ingredient: true } },
      outputs: true,
    },
  });
}

export async function deleteBatch(id: string) {
  await assertEntityOwns("batch", id);
  await prisma.batch.delete({ where: { id } });
  revalidatePath("/batches");
}

// 更新配方名稱
export async function updateBatchName(id: string, name: string) {
  await assertEntityOwns("batch", id);
  await prisma.batch.update({ where: { id }, data: { name } });
  revalidatePath("/batches");
  revalidatePath(`/batches/${id}`);
}

// 更新口味產出
export async function updateBatchOutput(
  outputId: string,
  data: { flavor_name?: string; pieces?: number; filling_g_per_piece?: number | null; skin_g_per_piece?: number | null }
) {
  await prisma.batchOutput.update({ where: { id: outputId }, data });
  revalidatePath("/batches");
}

// 更新原料投入量
export async function updateBatchInput(
  inputId: string,
  data: { qty_input: number; input_unit: string; qty_base: number }
) {
  await prisma.batchInput.update({
    where: { id: inputId },
    data: {
      qty_input: data.qty_input,
      input_unit: data.input_unit,
      qty_base: data.qty_base,
    },
  });
  revalidatePath("/batches");
}

// 刪除配方中的某項原料
export async function removeBatchInput(inputId: string) {
  await prisma.batchInput.delete({ where: { id: inputId } });
  revalidatePath("/batches");
}

// 新增原料到配方
export async function addBatchInput(data: {
  batch_id: string;
  ingredient_id: string;
  qty_input: number;
  input_unit: string;
  qty_base: number;
  is_shared: boolean;
  dedicated_to?: string | null;
}) {
  // 取得該原料的最新單價
  const pm = await getLatestPriceMap([data.ingredient_id]);
  const unit_cost_used = pm.get(data.ingredient_id)?.unit_cost_base || 0;

  await prisma.batchInput.create({
    data: {
      batch_id: data.batch_id,
      ingredient_id: data.ingredient_id,
      qty_input: data.qty_input,
      input_unit: data.input_unit,
      qty_base: data.qty_base,
      unit_cost_used,
      cost: data.qty_base * unit_cost_used,
      is_shared: data.is_shared,
      dedicated_to: data.dedicated_to || null,
    },
  });
  revalidatePath("/batches");
}
