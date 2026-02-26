"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { PasteDialog } from "@/components/paste-dialog";
import { createBatch } from "@/actions/batches";
import {
  getUnitsForType,
  toBase,
  type MeasureType,
  type Unit,
} from "@/lib/units";
import type { ParsedLine } from "@/lib/parse-paste";

type IngredientOption = {
  id: string;
  name: string;
  measure_type: string;
  purchase_records: { unit_cost_base: number }[];
};

interface InputRow {
  ingredient_id: string;
  qty_input: string;
  input_unit: string;
  is_shared: boolean;
  dedicated_to_index?: number;
}

interface OutputRow {
  flavor_name: string;
  pieces: string;
  filling_g_per_piece: string;
}

export function BatchNewClient({
  ingredients,
}: {
  ingredients: IngredientOption[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [allocMethod, setAllocMethod] = useState("by_pieces");
  const [inputs, setInputs] = useState<InputRow[]>([
    { ingredient_id: "", qty_input: "", input_unit: "g", is_shared: true },
  ]);
  const [outputs, setOutputs] = useState<OutputRow[]>([
    { flavor_name: "", pieces: "", filling_g_per_piece: "" },
  ]);
  const [loading, setLoading] = useState(false);

  function addInput() {
    setInputs([
      ...inputs,
      { ingredient_id: "", qty_input: "", input_unit: "g", is_shared: true },
    ]);
  }

  function removeInput(index: number) {
    setInputs(inputs.filter((_, i) => i !== index));
  }

  function updateInput(index: number, field: string, value: string | boolean | number) {
    setInputs(
      inputs.map((row, i) => {
        if (i !== index) return row;
        const updated = { ...row, [field]: value };
        // Auto-set unit when ingredient changes
        if (field === "ingredient_id") {
          const ing = ingredients.find((g) => g.id === value);
          if (ing) {
            updated.input_unit =
              ing.measure_type === "weight" ? "g" : "cc";
          }
        }
        return updated;
      })
    );
  }

  function addOutput() {
    setOutputs([
      ...outputs,
      { flavor_name: "", pieces: "", filling_g_per_piece: "" },
    ]);
  }

  function removeOutput(index: number) {
    setOutputs(outputs.filter((_, i) => i !== index));
  }

  function updateOutput(index: number, field: string, value: string) {
    setOutputs(
      outputs.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  }

  function handlePasteConfirm(parsed: ParsedLine[]) {
    const newInputs: InputRow[] = parsed.map((p) => {
      const existing = ingredients.find(
        (ing) => ing.name === p.name
      );
      return {
        ingredient_id: existing?.id || "",
        qty_input: p.qty.toString(),
        input_unit: p.unit,
        is_shared: true,
      };
    });
    setInputs([...inputs.filter((i) => i.ingredient_id), ...newInputs]);
  }

  function getQtyBasePreview(row: InputRow): string {
    const qty = parseFloat(row.qty_input);
    if (isNaN(qty) || qty <= 0) return "";
    const base = toBase(qty, row.input_unit as Unit);
    const ing = ingredients.find((g) => g.id === row.ingredient_id);
    const baseUnit = ing?.measure_type === "volume" ? "cc" : "g";
    return `= ${base.toLocaleString()} ${baseUnit}`;
  }

  function getUnitCostPreview(row: InputRow): string {
    const ing = ingredients.find((g) => g.id === row.ingredient_id);
    if (!ing || !ing.purchase_records[0]) return "";
    const unitCost = ing.purchase_records[0].unit_cost_base;
    const baseUnit = ing.measure_type === "volume" ? "cc" : "g";
    return `單價: ${unitCost.toFixed(4)} 元/${baseUnit}`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const batchId = await createBatch({
        name,
        alloc_method: allocMethod,
        inputs: inputs
          .filter((i) => i.ingredient_id && i.qty_input)
          .map((i) => ({
            ingredient_id: i.ingredient_id,
            qty_input: parseFloat(i.qty_input),
            input_unit: i.input_unit,
            is_shared: i.is_shared,
            dedicated_to_index: i.is_shared
              ? undefined
              : i.dedicated_to_index,
          })),
        outputs: outputs
          .filter((o) => o.flavor_name && o.pieces)
          .map((o) => ({
            flavor_name: o.flavor_name,
            pieces: parseInt(o.pieces),
            filling_g_per_piece: o.filling_g_per_piece
              ? parseFloat(o.filling_g_per_piece)
              : undefined,
          })),
      });
      router.push(`/batches/${batchId}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="text-2xl font-bold">建立批次</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Batch name */}
        <div>
          <Label>批次名稱</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如：2024/01 蘿蔔絲餅"
            required
          />
        </div>

        {/* Outputs (flavors) - placed before inputs so dedicated_to can reference them */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">口味產出</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {outputs.map((row, i) => (
              <div key={i} className="flex gap-2 items-end">
                <div className="flex-1">
                  <Label>口味名稱</Label>
                  <Input
                    value={row.flavor_name}
                    onChange={(e) =>
                      updateOutput(i, "flavor_name", e.target.value)
                    }
                    placeholder="例如：蘿蔔絲"
                    required
                  />
                </div>
                <div className="w-24">
                  <Label>顆數</Label>
                  <Input
                    type="number"
                    value={row.pieces}
                    onChange={(e) => updateOutput(i, "pieces", e.target.value)}
                    placeholder="200"
                    required
                  />
                </div>
                <div className="w-32">
                  <Label>每顆餡料(g)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={row.filling_g_per_piece}
                    onChange={(e) =>
                      updateOutput(i, "filling_g_per_piece", e.target.value)
                    }
                    placeholder="選填"
                  />
                </div>
                {outputs.length > 1 && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => removeOutput(i)}
                  >
                    移除
                  </Button>
                )}
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addOutput}>
              + 新增口味
            </Button>
          </CardContent>
        </Card>

        {/* Allocation method */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">共用原料分攤規則</CardTitle>
          </CardHeader>
          <CardContent>
            <RadioGroup value={allocMethod} onValueChange={setAllocMethod}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="by_pieces" id="by_pieces" />
                <Label htmlFor="by_pieces">按顆數比例分攤</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem
                  value="by_filling_weight"
                  id="by_filling_weight"
                />
                <Label htmlFor="by_filling_weight">
                  按餡料重量比例分攤 (顆數 × 每顆餡料g)
                </Label>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        <Separator />

        {/* Inputs (ingredients) */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">原料投入</CardTitle>
              <PasteDialog onConfirm={handlePasteConfirm} />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {inputs.map((row, i) => {
              const ing = ingredients.find(
                (g) => g.id === row.ingredient_id
              );
              const units = ing
                ? getUnitsForType(ing.measure_type as MeasureType)
                : ["g", "kg", "台斤", "cc"];

              return (
                <div key={i} className="rounded border p-3 space-y-2">
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <Label>原料</Label>
                      <Select
                        value={row.ingredient_id}
                        onValueChange={(v) =>
                          updateInput(i, "ingredient_id", v)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="選擇原料" />
                        </SelectTrigger>
                        <SelectContent>
                          {ingredients.map((g) => (
                            <SelectItem key={g.id} value={g.id}>
                              {g.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-28">
                      <Label>數量</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={row.qty_input}
                        onChange={(e) =>
                          updateInput(i, "qty_input", e.target.value)
                        }
                        placeholder="數量"
                      />
                    </div>
                    <div className="w-24">
                      <Label>單位</Label>
                      <Select
                        value={row.input_unit}
                        onValueChange={(v) =>
                          updateInput(i, "input_unit", v)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {units.map((u) => (
                            <SelectItem key={u} value={u}>
                              {u}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {inputs.length > 1 && (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => removeInput(i)}
                      >
                        移除
                      </Button>
                    )}
                  </div>

                  {/* Preview */}
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    {getQtyBasePreview(row) && (
                      <span>{getQtyBasePreview(row)}</span>
                    )}
                    {getUnitCostPreview(row) && (
                      <span>{getUnitCostPreview(row)}</span>
                    )}
                  </div>

                  {/* Shared/Dedicated toggle */}
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1 text-sm">
                      <input
                        type="checkbox"
                        checked={row.is_shared}
                        onChange={(e) =>
                          updateInput(i, "is_shared", e.target.checked)
                        }
                      />
                      共用原料
                    </label>
                    {!row.is_shared && outputs.length > 0 && (
                      <Select
                        value={
                          row.dedicated_to_index?.toString() ?? "0"
                        }
                        onValueChange={(v) =>
                          updateInput(i, "dedicated_to_index", parseInt(v))
                        }
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue placeholder="歸屬口味" />
                        </SelectTrigger>
                        <SelectContent>
                          {outputs.map((o, oi) => (
                            <SelectItem key={oi} value={oi.toString()}>
                              {o.flavor_name || `口味 ${oi + 1}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
              );
            })}
            <Button type="button" variant="outline" size="sm" onClick={addInput}>
              + 新增原料
            </Button>
          </CardContent>
        </Card>

        <Button type="submit" disabled={loading} size="lg" className="w-full">
          {loading ? "計算中..." : "建立批次並計算"}
        </Button>
      </form>
    </div>
  );
}
