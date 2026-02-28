"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatBaseCost, formatQty, toBase, getUnitsForType, getBaseUnit, unitLabel, type Unit, type MeasureType } from "@/lib/units";
import {
  updateBatchName,
  updateBatchOutput,
  updateBatchInput,
  removeBatchInput,
  addBatchInput,
  deleteBatch,
} from "@/actions/batches";
import Link from "next/link";

type BatchData = {
  id: string;
  name: string;
  alloc_method: string;
  liveTotalCost: number;
  inputs: {
    id: string;
    ingredient_id: string;
    qty_input: number;
    input_unit: string;
    qty_base: number;
    is_shared: boolean;
    dedicated_to: string | null;
    liveUnitCost: number;
    liveCost: number;
    ingredient: { id: string; name: string; measure_type: string };
  }[];
  outputs: {
    id: string;
    flavor_name: string;
    pieces: number;
    filling_g_per_piece: number | null;
    skin_g_per_piece: number | null;
    liveTotalCost: number;
    liveCostPerPiece: number;
  }[];
};

type IngredientOption = {
  id: string;
  name: string;
  measure_type: string;
  unit_cost_base: number | null;
};

export function BatchDetailClient({
  batch,
  ingredients,
}: {
  batch: BatchData;
  ingredients: IngredientOption[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);

  // 編輯狀態
  const [editName, setEditName] = useState(batch.name);
  const [editOutputs, setEditOutputs] = useState(
    batch.outputs.map((o) => ({
      id: o.id,
      pieces: o.pieces.toString(),
      filling_g_per_piece: o.filling_g_per_piece?.toString() ?? "",
      skin_g_per_piece: o.skin_g_per_piece?.toString() ?? "",
    }))
  );
  const [editInputs, setEditInputs] = useState(
    batch.inputs.map((i) => ({
      id: i.id,
      qty_input: i.qty_input.toString(),
      input_unit: i.input_unit,
    }))
  );

  // 新增原料
  const [addIngId, setAddIngId] = useState("");
  const [addQty, setAddQty] = useState("");
  const [addUnit, setAddUnit] = useState("台斤");

  async function handleSave() {
    setLoading(true);
    try {
      // 更新名稱
      if (editName !== batch.name) {
        await updateBatchName(batch.id, editName);
      }

      // 更新各口味
      for (const eo of editOutputs) {
        const original = batch.outputs.find((o) => o.id === eo.id);
        if (!original) continue;
        const newPieces = parseInt(eo.pieces);
        const newFilling = eo.filling_g_per_piece
          ? parseFloat(eo.filling_g_per_piece)
          : null;
        const newSkin = eo.skin_g_per_piece
          ? parseFloat(eo.skin_g_per_piece)
          : null;
        if (
          newPieces !== original.pieces ||
          newFilling !== original.filling_g_per_piece ||
          newSkin !== original.skin_g_per_piece
        ) {
          await updateBatchOutput(eo.id, {
            pieces: newPieces,
            filling_g_per_piece: newFilling,
            skin_g_per_piece: newSkin,
          });
        }
      }

      // 更新各原料投入量
      for (const ei of editInputs) {
        const original = batch.inputs.find((i) => i.id === ei.id);
        if (!original) continue;
        const newQty = parseFloat(ei.qty_input);
        if (newQty !== original.qty_input || ei.input_unit !== original.input_unit) {
          const qty_base = toBase(newQty, ei.input_unit as Unit);
          await updateBatchInput(ei.id, {
            qty_input: newQty,
            input_unit: ei.input_unit,
            qty_base,
          });
        }
      }

      setEditing(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function handleRemoveInput(inputId: string) {
    if (!confirm("確定移除此原料？")) return;
    await removeBatchInput(inputId);
    setEditInputs(editInputs.filter((i) => i.id !== inputId));
    router.refresh();
  }

  async function handleAddInput() {
    if (!addIngId || !addQty) return;
    setLoading(true);
    try {
      const ing = ingredients.find((g) => g.id === addIngId);
      const qty_base = toBase(parseFloat(addQty), addUnit as Unit);
      await addBatchInput({
        batch_id: batch.id,
        ingredient_id: addIngId,
        qty_input: parseFloat(addQty),
        input_unit: addUnit,
        qty_base,
        is_shared: true,
      });
      setAddIngId("");
      setAddQty("");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!confirm("確定要刪除此配方？")) return;
    await deleteBatch(batch.id);
    router.push("/batches");
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          {editing ? (
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="text-2xl font-bold h-auto py-1"
            />
          ) : (
            <h1 className="text-2xl font-bold">{batch.name}</h1>
          )}
          {batch.outputs.length > 1 && (
            <p className="text-sm text-muted-foreground">
              共用原料分攤：
              {batch.alloc_method === "by_pieces"
                ? "按顆數比例"
                : "按餡料重量比例"}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {editing ? (
            <>
              <Button onClick={handleSave} disabled={loading}>
                {loading ? "儲存中..." : "儲存"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setEditing(false)}
              >
                取消
              </Button>
            </>
          ) : (
            <>
              <Button onClick={() => setEditing(true)}>編輯配方</Button>
              <Link href="/batches">
                <Button variant="outline">返回菜單</Button>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* 即時成本總覽 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            即時總成本
            <span className="text-xs font-normal text-muted-foreground ml-2">
              依據最新原料價格計算
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">
            {batch.liveTotalCost.toFixed(2)} 元
          </p>
        </CardContent>
      </Card>

      {/* 口味成本卡片 */}
      <div className="grid gap-4 md:grid-cols-2">
        {batch.outputs.map((output, oi) => (
          <Card key={output.id}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                {output.flavor_name}
                {editing ? (
                  <Input
                    type="number"
                    value={editOutputs[oi]?.pieces ?? ""}
                    onChange={(e) => {
                      const updated = [...editOutputs];
                      updated[oi] = { ...updated[oi], pieces: e.target.value };
                      setEditOutputs(updated);
                    }}
                    className="w-24 h-7 text-sm"
                    placeholder="顆數"
                  />
                ) : (
                  <Badge variant="secondary">{output.pieces} 顆</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">口味總成本</span>
                <span className="font-semibold">
                  {output.liveTotalCost.toFixed(2)} 元
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">每顆成本</span>
                <span className="font-semibold text-lg">
                  {output.liveCostPerPiece.toFixed(2)} 元
                </span>
              </div>
              {editing ? (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">每顆餡料(公克)</span>
                    <Input
                      type="number"
                      step="0.1"
                      value={editOutputs[oi]?.filling_g_per_piece ?? ""}
                      onChange={(e) => {
                        const updated = [...editOutputs];
                        updated[oi] = {
                          ...updated[oi],
                          filling_g_per_piece: e.target.value,
                        };
                        setEditOutputs(updated);
                      }}
                      className="w-24 h-7 text-sm"
                      placeholder="選填"
                    />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">每顆皮料(公克)</span>
                    <Input
                      type="number"
                      step="0.1"
                      value={editOutputs[oi]?.skin_g_per_piece ?? ""}
                      onChange={(e) => {
                        const updated = [...editOutputs];
                        updated[oi] = {
                          ...updated[oi],
                          skin_g_per_piece: e.target.value,
                        };
                        setEditOutputs(updated);
                      }}
                      className="w-24 h-7 text-sm"
                      placeholder="選填"
                    />
                  </div>
                </>
              ) : (
                <>
                  {output.filling_g_per_piece && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">每顆餡料</span>
                      <span>{output.filling_g_per_piece} 公克</span>
                    </div>
                  )}
                  {output.skin_g_per_piece && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">每顆皮料</span>
                      <span>{output.skin_g_per_piece} 公克</span>
                    </div>
                  )}
                  {(output.filling_g_per_piece || output.skin_g_per_piece) && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">每顆總重</span>
                      <span>
                        {((output.filling_g_per_piece ?? 0) + (output.skin_g_per_piece ?? 0)).toFixed(1)} 公克
                      </span>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 生產 SOP：投料明細 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">生產投料明細（SOP）</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>原料</TableHead>
                <TableHead>投入量</TableHead>
                <TableHead>換算</TableHead>
                <TableHead>即時單價</TableHead>
                <TableHead className="text-right">即時成本</TableHead>
                {editing && <TableHead className="w-16"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {batch.inputs.map((input, ii) => {
                const ei = editInputs.find((e) => e.id === input.id);
                return (
                  <TableRow key={input.id}>
                    <TableCell className="font-medium">
                      {input.ingredient.name}
                    </TableCell>
                    <TableCell>
                      {editing ? (
                        <div className="flex gap-1">
                          <Input
                            type="number"
                            step="0.01"
                            value={ei?.qty_input ?? ""}
                            onChange={(e) => {
                              setEditInputs(
                                editInputs.map((r) =>
                                  r.id === input.id
                                    ? { ...r, qty_input: e.target.value }
                                    : r
                                )
                              );
                            }}
                            className="w-20 h-7 text-sm"
                          />
                          <Select
                            value={ei?.input_unit ?? input.input_unit}
                            onValueChange={(v) => {
                              setEditInputs(
                                editInputs.map((r) =>
                                  r.id === input.id
                                    ? { ...r, input_unit: v }
                                    : r
                                )
                              );
                            }}
                          >
                            <SelectTrigger className="w-16 h-7 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {getUnitsForType(
                                input.ingredient.measure_type as MeasureType
                              ).map((u) => (
                                <SelectItem key={u} value={u}>
                                  {unitLabel(u)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ) : (
                        <>
                          {input.qty_input} {unitLabel(input.input_unit)}
                        </>
                      )}
                    </TableCell>
                    <TableCell>
                      {formatQty(
                        input.qty_base,
                        input.ingredient.measure_type as "weight" | "volume"
                      )}
                    </TableCell>
                    <TableCell>
                      {formatBaseCost(input.liveUnitCost)} 元/
                      {getBaseUnit(input.ingredient.measure_type as MeasureType)}
                    </TableCell>
                    <TableCell className="text-right">
                      {input.liveCost.toFixed(2)} 元
                    </TableCell>
                    {editing && (
                      <TableCell>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => handleRemoveInput(input.id)}
                        >
                          移除
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {/* 編輯模式：新增原料 */}
          {editing && (
            <div className="flex gap-2 items-end mt-4 pt-4 border-t">
              <div className="flex-1">
                <Select value={addIngId} onValueChange={(v) => {
                  setAddIngId(v);
                  const ing = ingredients.find((g) => g.id === v);
                  if (ing) setAddUnit(ing.measure_type === "weight" ? "台斤" : "公升");
                }}>
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
              <Input
                type="number"
                step="0.01"
                value={addQty}
                onChange={(e) => setAddQty(e.target.value)}
                placeholder="數量"
                className="w-24"
              />
              <Select value={addUnit} onValueChange={setAddUnit}>
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="公斤">公斤</SelectItem>
                  <SelectItem value="台斤">台斤</SelectItem>
                  <SelectItem value="公升">公升</SelectItem>
                  <SelectItem value="毫升">毫升</SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={handleAddInput}
                disabled={!addIngId || !addQty || loading}
                size="sm"
              >
                新增
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 刪除配方 */}
      {editing && (
        <div className="flex justify-end">
          <Button variant="destructive" onClick={handleDelete}>
            刪除此配方
          </Button>
        </div>
      )}
    </div>
  );
}
