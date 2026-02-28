"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  deleteIngredient,
  updateIngredient,
  quickAddIngredient,
  bulkAddIngredients,
} from "@/actions/ingredients";
import {
  formatBaseCost,
  getBaseUnit,
  isPackageUnit,
  PACKAGE_UNITS,
  getMeasureTypeForUnit,
  type MeasureType,
  type Unit,
} from "@/lib/units";
import { parsePasteText } from "@/lib/parse-paste";

type IngredientWithPrice = {
  id: string;
  name: string;
  measure_type: string;
  unit_cost_base: number | null;
  purchase_unit: string | null;
  purchase_qty: number | null;
  per_package_qty: number | null;
  per_package_unit: string | null;
  subtotal: number | null;
  created_at: Date;
  updated_at: Date;
  _count: { batch_inputs: number; purchase_order_items: number };
};

function isValidNumber(v: string): boolean {
  if (!v.trim()) return false;
  const n = Number(v);
  return !isNaN(n) && n > 0;
}

export function IngredientsClient({
  ingredients,
}: {
  ingredients: IngredientWithPrice[];
}) {
  const router = useRouter();

  // 快速新增
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState("台斤");
  const [perPkgQty, setPerPkgQty] = useState("");
  const [perPkgUnit, setPerPkgUnit] = useState<Unit>("公斤");
  const [price, setPrice] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const showPkg = isPackageUnit(unit);

  // 批次貼上
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pasteResult, setPasteResult] = useState<ReturnType<
    typeof parsePasteText
  > | null>(null);
  const [pasteLoading, setPasteLoading] = useState(false);

  // 編輯原料
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editQty, setEditQty] = useState("");
  const [editPurchaseUnit, setEditPurchaseUnit] = useState("台斤");
  const [editPerPkgQty, setEditPerPkgQty] = useState("");
  const [editPerPkgUnit, setEditPerPkgUnit] = useState<Unit>("公斤");
  const [editPrice, setEditPrice] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const editShowPkg = isPackageUnit(editPurchaseUnit);

  const quickAddValid =
    name.trim() &&
    isValidNumber(qty) &&
    isValidNumber(price) &&
    (!showPkg || isValidNumber(perPkgQty));

  async function handleQuickAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!quickAddValid) return;
    setAddLoading(true);
    try {
      await quickAddIngredient({
        name: name.trim(),
        qty: parseFloat(qty),
        unit,
        price: parseFloat(price),
        per_package_qty: showPkg ? parseFloat(perPkgQty) : undefined,
        per_package_unit: showPkg ? perPkgUnit : undefined,
      });
      setName("");
      setQty("");
      setPerPkgQty("");
      setPrice("");
      router.refresh();
    } finally {
      setAddLoading(false);
    }
  }

  function handleParse() {
    setPasteResult(parsePasteText(pasteText));
  }

  async function handlePasteConfirm() {
    if (!pasteResult || pasteResult.parsed.length === 0) return;
    setPasteLoading(true);
    try {
      const items = pasteResult.parsed
        .filter((p) => p.price !== undefined)
        .map((p) => ({
          name: p.name,
          qty: p.qty,
          unit: p.unit,
          price: p.price!,
        }));
      await bulkAddIngredients(items);
      setPasteOpen(false);
      setPasteText("");
      setPasteResult(null);
      router.refresh();
    } finally {
      setPasteLoading(false);
    }
  }

  async function handleSaveEdit(ing: IngredientWithPrice) {
    setEditLoading(true);
    try {
      // 名稱變更 → 更新原料名稱（measure_type 由 quickAddIngredient 自動判斷）
      if (editName !== ing.name) {
        await updateIngredient(ing.id, {
          name: editName,
          measure_type: ing.measure_type,
        });
      }

      // 如果有填價格資訊，同時更新採購價格
      if (isValidNumber(editQty) && isValidNumber(editPrice)) {
        await quickAddIngredient({
          name: editName,
          qty: parseFloat(editQty),
          unit: editPurchaseUnit,
          price: parseFloat(editPrice),
          per_package_qty:
            editShowPkg && isValidNumber(editPerPkgQty)
              ? parseFloat(editPerPkgQty)
              : undefined,
          per_package_unit: editShowPkg ? editPerPkgUnit : undefined,
        });
      }

      setEditingId(null);
      router.refresh();
    } finally {
      setEditLoading(false);
    }
  }

  function getRefLabel(ing: IngredientWithPrice): string | null {
    const parts: string[] = [];
    if (ing._count.batch_inputs > 0)
      parts.push(`${ing._count.batch_inputs} 筆批次`);
    if (ing._count.purchase_order_items > 0)
      parts.push(`${ing._count.purchase_order_items} 筆叫貨`);
    return parts.length > 0 ? `有${parts.join("及")}使用中，無法刪除` : null;
  }

  async function handleDelete(id: string) {
    if (!confirm("確定要刪除此原料？")) return;
    try {
      await deleteIngredient(id);
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "刪除失敗");
    }
  }

  function startEdit(ing: IngredientWithPrice) {
    setEditingId(ing.id);
    setEditName(ing.name);
    setEditQty(ing.purchase_qty?.toString() ?? "");
    setEditPrice(ing.subtotal?.toString() ?? "");
    if (ing.purchase_unit && isPackageUnit(ing.purchase_unit)) {
      setEditPurchaseUnit(ing.purchase_unit);
      setEditPerPkgQty(ing.per_package_qty?.toString() ?? "");
      setEditPerPkgUnit((ing.per_package_unit as Unit) ?? "公斤");
    } else {
      setEditPurchaseUnit(ing.purchase_unit ?? (ing.measure_type === "weight" ? "台斤" : "公升"));
      setEditPerPkgQty("");
      setEditPerPkgUnit(ing.measure_type === "weight" ? "公斤" : "公升");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">原料管理</h1>
      </div>

      {/* 快速新增 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">快速新增原料</CardTitle>
            <Dialog open={pasteOpen} onOpenChange={setPasteOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  批次貼上
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>批次貼上採購單</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    每行一項，格式：品名 數量單位 價格
                  </p>
                  <Textarea
                    value={pasteText}
                    onChange={(e) => {
                      setPasteText(e.target.value);
                      setPasteResult(null);
                    }}
                    placeholder={`乾蘿蔔絲 90台斤 5400\n胡椒粉 1台斤 390\n醬油 5公升 238`}
                    rows={8}
                  />
                  <Button
                    onClick={handleParse}
                    variant="secondary"
                    className="w-full"
                  >
                    解析
                  </Button>

                  {pasteResult && (
                    <div className="space-y-2">
                      {pasteResult.parsed.length > 0 && (
                        <div className="rounded border p-3 space-y-1 max-h-60 overflow-y-auto">
                          <p className="text-sm font-medium">
                            成功解析 {pasteResult.parsed.length} 項：
                          </p>
                          {pasteResult.parsed.map((p, i) => (
                            <p key={i} className="text-sm">
                              {p.name} — {p.qty}{p.unit}
                              {p.price !== undefined && ` — ${p.price.toLocaleString()} 元`}
                              {p.price === undefined && (
                                <span className="text-amber-500 ml-1">
                                  (缺少價格，將跳過)
                                </span>
                              )}
                            </p>
                          ))}
                        </div>
                      )}
                      {pasteResult.errors.length > 0 && (
                        <div className="rounded border border-destructive p-3 space-y-1">
                          <p className="text-sm font-medium text-destructive">
                            無法解析：
                          </p>
                          {pasteResult.errors.map((e, i) => (
                            <p key={i} className="text-sm text-destructive">
                              {e}
                            </p>
                          ))}
                        </div>
                      )}
                      <Button
                        onClick={handlePasteConfirm}
                        disabled={
                          pasteLoading ||
                          pasteResult.parsed.filter((p) => p.price !== undefined)
                            .length === 0
                        }
                        className="w-full"
                      >
                        {pasteLoading
                          ? "匯入中..."
                          : `確認匯入 ${pasteResult.parsed.filter((p) => p.price !== undefined).length} 項`}
                      </Button>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleQuickAdd} className="flex gap-2 items-end flex-wrap">
            <div className="flex-1 min-w-[120px]">
              <Label>品名</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="乾蘿蔔絲"
              />
            </div>
            <div className="w-24">
              <Label>數量</Label>
              <Input
                inputMode="decimal"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                placeholder="90"
              />
            </div>
            <div className="w-24">
              <Label>單位</Label>
              <Select
                value={unit}
                onValueChange={(v) => {
                  setUnit(v);
                  if (!isPackageUnit(v)) {
                    setPerPkgQty("");
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="台斤">台斤</SelectItem>
                  <SelectItem value="公斤">公斤</SelectItem>
                  <SelectItem value="公升">公升</SelectItem>
                  <SelectItem value="毫升">毫升</SelectItem>
                  {PACKAGE_UNITS.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {showPkg && (
              <>
                <div className="w-20">
                  <Label>每{unit}</Label>
                  <Input
                    inputMode="decimal"
                    value={perPkgQty}
                    onChange={(e) => setPerPkgQty(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="w-20">
                  <Label>單位</Label>
                  <Select
                    value={perPkgUnit}
                    onValueChange={(v) => setPerPkgUnit(v as Unit)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="公斤">公斤</SelectItem>
                      <SelectItem value="台斤">台斤</SelectItem>
                      <SelectItem value="公升">公升</SelectItem>
                      <SelectItem value="毫升">毫升</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            <div className="w-28">
              <Label>總價（元）</Label>
              <Input
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="5400"
              />
            </div>
            <Button type="submit" disabled={addLoading || !quickAddValid}>
              {addLoading ? "新增中..." : "新增"}
            </Button>
          </form>
          <p className="text-xs text-muted-foreground mt-2">
            原料不存在會自動建立，已存在則更新採購價格。單位會自動判斷重量/體積。
          </p>
        </CardContent>
      </Card>

      {/* 原料列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            原料列表（{ingredients.length} 項）
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>品名</TableHead>
                <TableHead>包裝單價</TableHead>
                <TableHead>包裝規格</TableHead>
                <TableHead>基礎單價</TableHead>
                <TableHead className="w-20">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ingredients.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-muted-foreground"
                  >
                    尚無原料，用上方表單快速新增
                  </TableCell>
                </TableRow>
              )}
              {ingredients.map((ing) => {
                const baseUnit = getBaseUnit(
                  ing.measure_type as "weight" | "volume",
                );
                const isEditing = editingId === ing.id;
                const hasPkg =
                  ing.purchase_unit !== null &&
                  isPackageUnit(ing.purchase_unit);

                if (isEditing) {
                  return (
                    <TableRow key={ing.id}>
                      <TableCell colSpan={5}>
                        <div className="space-y-3 py-1">
                          {/* 名稱 */}
                          <div>
                            <Label className="text-xs">品名</Label>
                            <Input
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="h-8 text-sm"
                            />
                          </div>

                          {/* 更新採購價格（選填） */}
                          <div className="flex gap-2 items-end flex-wrap">
                            <p className="text-xs text-muted-foreground shrink-0 pb-2">
                              更新價格：
                            </p>
                            <div className="w-20">
                              <Label className="text-xs">數量</Label>
                              <Input
                                inputMode="decimal"
                                value={editQty}
                                onChange={(e) => setEditQty(e.target.value)}
                                placeholder="選填"
                                className="h-8 text-sm"
                              />
                            </div>
                            <div className="w-20">
                              <Label className="text-xs">單位</Label>
                              <Select
                                value={editPurchaseUnit}
                                onValueChange={(v) => {
                                  setEditPurchaseUnit(v);
                                  if (!isPackageUnit(v)) {
                                    setEditPerPkgQty("");
                                  }
                                }}
                              >
                                <SelectTrigger className="h-8 text-sm">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="台斤">台斤</SelectItem>
                                  <SelectItem value="公斤">公斤</SelectItem>
                                  <SelectItem value="公升">公升</SelectItem>
                                  <SelectItem value="毫升">毫升</SelectItem>
                                  {PACKAGE_UNITS.map((u) => (
                                    <SelectItem key={u} value={u}>
                                      {u}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            {editShowPkg && (
                              <>
                                <div className="w-20">
                                  <Label className="text-xs">
                                    每{editPurchaseUnit}
                                  </Label>
                                  <Input
                                    inputMode="decimal"
                                    value={editPerPkgQty}
                                    onChange={(e) =>
                                      setEditPerPkgQty(e.target.value)
                                    }
                                    placeholder="0"
                                    className="h-8 text-sm"
                                  />
                                </div>
                                <div className="w-20">
                                  <Label className="text-xs">單位</Label>
                                  <Select
                                    value={editPerPkgUnit}
                                    onValueChange={(v) =>
                                      setEditPerPkgUnit(v as Unit)
                                    }
                                  >
                                    <SelectTrigger className="h-8 text-sm">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="公斤">公斤</SelectItem>
                                      <SelectItem value="台斤">台斤</SelectItem>
                                      <SelectItem value="公升">公升</SelectItem>
                                      <SelectItem value="毫升">毫升</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </>
                            )}
                            <div className="w-24">
                              <Label className="text-xs">總價（元）</Label>
                              <Input
                                inputMode="decimal"
                                value={editPrice}
                                onChange={(e) => setEditPrice(e.target.value)}
                                placeholder="選填"
                                className="h-8 text-sm"
                              />
                            </div>
                          </div>

                          {/* 操作按鈕 */}
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              disabled={editLoading || !editName.trim()}
                              onClick={() => handleSaveEdit(ing)}
                            >
                              {editLoading ? "儲存中..." : "儲存"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingId(null)}
                            >
                              取消
                            </Button>
                            <div className="flex-1" />
                            {(() => {
                              const refLabel = getRefLabel(ing);
                              return (
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  disabled={!!refLabel}
                                  title={refLabel ?? undefined}
                                  onClick={() => handleDelete(ing.id)}
                                >
                                  刪除
                                </Button>
                              );
                            })()}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                }

                return (
                  <TableRow key={ing.id}>
                    <TableCell className="font-medium">{ing.name}</TableCell>
                    <TableCell>
                      {hasPkg && ing.subtotal !== null && ing.purchase_qty ? (
                        <span className="font-mono text-sm">
                          {(ing.subtotal / ing.purchase_qty).toLocaleString(
                            undefined,
                            { maximumFractionDigits: 2 },
                          )}{" "}
                          元/{ing.purchase_unit}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {hasPkg &&
                      ing.per_package_qty &&
                      ing.per_package_unit ? (
                        <span className="text-sm">
                          一{ing.purchase_unit}{" "}
                          {ing.per_package_qty}
                          {ing.per_package_unit}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {ing.unit_cost_base !== null ? (
                        <span className="font-mono text-sm">
                          {formatBaseCost(ing.unit_cost_base)} 元/
                          {baseUnit}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-sm">
                          未設定
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => startEdit(ing)}
                      >
                        編輯
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
