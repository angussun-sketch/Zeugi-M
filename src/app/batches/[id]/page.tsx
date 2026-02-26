import { getBatch } from "@/actions/batches";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCost, formatQty } from "@/lib/units";
import { calculateBatch } from "@/lib/calc";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function BatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const batch = await getBatch(id);
  if (!batch) notFound();

  const allocMethodLabel =
    batch.alloc_method === "by_pieces" ? "按顆數比例" : "按餡料重量比例";

  // Re-calculate allocation details for display
  const calcResult = calculateBatch(
    batch.inputs.map((i) => ({
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
    batch.alloc_method as "by_pieces" | "by_filling_weight"
  );

  // Build detail map: output_id -> input details
  const detailsByOutput = new Map<
    string,
    { ingredient_name: string; allocated_qty: number; allocated_cost: number; measure_type: string }[]
  >();
  for (const d of calcResult.details) {
    const input = batch.inputs.find((i) => i.id === d.input_id);
    if (!input) continue;
    const arr = detailsByOutput.get(d.output_id) || [];
    arr.push({
      ingredient_name: input.ingredient.name,
      allocated_qty: d.allocated_qty,
      allocated_cost: d.allocated_cost,
      measure_type: input.ingredient.measure_type,
    });
    detailsByOutput.set(d.output_id, arr);
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{batch.name}</h1>
          <p className="text-sm text-muted-foreground">
            {new Date(batch.created_at).toLocaleDateString("zh-TW")} ·{" "}
            {allocMethodLabel}
          </p>
        </div>
        <Link href="/batches">
          <Button variant="outline">返回列表</Button>
        </Link>
      </div>

      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">批次總成本</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">
            {batch.total_cost?.toFixed(2) ?? "—"} 元
          </p>
        </CardContent>
      </Card>

      {/* Flavor cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {batch.outputs.map((output) => (
          <Card key={output.id}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                {output.flavor_name}
                <Badge variant="secondary">{output.pieces} 顆</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">口味總成本</span>
                <span className="font-semibold">
                  {output.total_cost?.toFixed(2) ?? "—"} 元
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">每顆成本</span>
                <span className="font-semibold text-lg">
                  {output.cost_per_piece?.toFixed(2) ?? "—"} 元
                </span>
              </div>
              {output.filling_g_per_piece && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">每顆餡料</span>
                  <span>{output.filling_g_per_piece} g</span>
                </div>
              )}

              {/* Allocation detail */}
              {detailsByOutput.get(output.id) && (
                <div className="mt-2">
                  <p className="text-xs font-medium mb-1">原料分攤明細：</p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">原料</TableHead>
                        <TableHead className="text-xs">分攤量</TableHead>
                        <TableHead className="text-xs text-right">
                          分攤成本
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detailsByOutput.get(output.id)!.map((d, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs">
                            {d.ingredient_name}
                          </TableCell>
                          <TableCell className="text-xs">
                            {formatQty(
                              d.allocated_qty,
                              d.measure_type as "weight" | "volume"
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-right">
                            {d.allocated_cost.toFixed(2)} 元
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* All inputs summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">原料投入明細</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>原料</TableHead>
                <TableHead>投入量</TableHead>
                <TableHead>換算</TableHead>
                <TableHead>單價</TableHead>
                <TableHead className="text-right">成本</TableHead>
                <TableHead>類型</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batch.inputs.map((input) => (
                <TableRow key={input.id}>
                  <TableCell>{input.ingredient.name}</TableCell>
                  <TableCell>
                    {input.qty_input} {input.input_unit}
                  </TableCell>
                  <TableCell>
                    {formatQty(
                      input.qty_base,
                      input.ingredient.measure_type as "weight" | "volume"
                    )}
                  </TableCell>
                  <TableCell>
                    {formatCost(input.unit_cost_used)} 元/
                    {input.ingredient.measure_type === "weight" ? "g" : "cc"}
                  </TableCell>
                  <TableCell className="text-right">
                    {input.cost.toFixed(2)} 元
                  </TableCell>
                  <TableCell>
                    {input.is_shared ? (
                      <Badge variant="secondary">共用</Badge>
                    ) : (
                      <Badge>
                        專用：
                        {batch.outputs.find((o) => o.id === input.dedicated_to)
                          ?.flavor_name ?? "—"}
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
