export interface CalcInput {
  id: string;
  ingredient_id: string;
  qty_base: number;
  unit_cost_used: number;
  cost: number;
  is_shared: boolean;
  dedicated_to: string | null;
}

export interface CalcOutput {
  id: string;
  flavor_name: string;
  pieces: number;
  filling_g_per_piece: number | null;
}

export interface AllocDetail {
  input_id: string;
  output_id: string;
  allocated_qty: number;
  allocated_cost: number;
}

export interface CalcResult {
  total_cost: number;
  outputs: {
    id: string;
    total_cost: number;
    cost_per_piece: number;
  }[];
  details: AllocDetail[];
}

export function calculateBatch(
  inputs: CalcInput[],
  outputs: CalcOutput[],
  alloc_method: "by_pieces" | "by_filling_weight"
): CalcResult {
  const total_cost = inputs.reduce((sum, i) => sum + i.cost, 0);

  const outputCosts: Record<string, number> = {};
  const details: AllocDetail[] = [];

  for (const o of outputs) {
    outputCosts[o.id] = 0;
  }

  // 1) Dedicated inputs → directly to their flavor
  const sharedInputs: CalcInput[] = [];
  for (const input of inputs) {
    if (!input.is_shared && input.dedicated_to) {
      outputCosts[input.dedicated_to] =
        (outputCosts[input.dedicated_to] || 0) + input.cost;
      details.push({
        input_id: input.id,
        output_id: input.dedicated_to,
        allocated_qty: input.qty_base,
        allocated_cost: input.cost,
      });
    } else {
      sharedInputs.push(input);
    }
  }

  // 2) Calculate allocation ratios for shared inputs
  const totalPieces = outputs.reduce((sum, o) => sum + o.pieces, 0);
  const totalFillingWeight = outputs.reduce(
    (sum, o) => sum + o.pieces * (o.filling_g_per_piece || 0),
    0
  );

  const ratios: Record<string, number> = {};
  for (const o of outputs) {
    if (alloc_method === "by_filling_weight" && totalFillingWeight > 0) {
      ratios[o.id] =
        (o.pieces * (o.filling_g_per_piece || 0)) / totalFillingWeight;
    } else {
      // fallback to by_pieces
      ratios[o.id] = totalPieces > 0 ? o.pieces / totalPieces : 0;
    }
  }

  // 3) Allocate shared inputs
  for (const input of sharedInputs) {
    for (const o of outputs) {
      const ratio = ratios[o.id] || 0;
      const allocatedCost = input.cost * ratio;
      const allocatedQty = input.qty_base * ratio;
      outputCosts[o.id] += allocatedCost;
      details.push({
        input_id: input.id,
        output_id: o.id,
        allocated_qty: allocatedQty,
        allocated_cost: allocatedCost,
      });
    }
  }

  const resultOutputs = outputs.map((o) => ({
    id: o.id,
    total_cost: outputCosts[o.id] || 0,
    cost_per_piece: o.pieces > 0 ? (outputCosts[o.id] || 0) / o.pieces : 0,
  }));

  return { total_cost, outputs: resultOutputs, details };
}
