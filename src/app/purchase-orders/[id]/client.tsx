"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { SupplierCombobox } from "@/components/supplier-combobox";
import {
  deletePurchaseOrder,
  updatePurchaseOrder,
} from "@/actions/purchase-orders";
import {
  isPackageUnit,
  PACKAGE_UNITS,
  computeTotalQtyBase,
  formatBaseCost,
  unitLabel,
  getBaseUnit,
  type MeasureType,
} from "@/lib/units";

type OrderDetail = {
  id: string;
  order_number: string;
  order_date: Date;
  supplier: { id: string; name: string } | null;
  notes: string | null;
  total_amount: number | null;
  items: {
    id: string;
    ingredient_id: string;
    ingredient: { name: string; measure_type: string };
    purchase_qty: number;
    purchase_unit: string;
    per_package_qty: number | null;
    per_package_unit: string | null;
    total_qty_base: number;
    subtotal: number;
    unit_cost_base: number;
  }[];
};

type IngredientOption = {
  id: string;
  name: string;
  measure_type: string;
};

type SupplierOption = {
  id: string;
  name: string;
};

interface EditItemRow {
  ingredient_id: string;
  purchase_qty: string;
  purchase_unit: string;
  per_package_qty: string;
  per_package_unit: string;
  subtotal: string;
}

function emptyRow(): EditItemRow {
  return {
    ingredient_id: "",
    purchase_qty: "",
    purchase_unit: "",
    per_package_qty: "",
    per_package_unit: "",
    subtotal: "",
  };
}

export function PurchaseOrderDetailClient({
  order,
  ingredients,
  suppliers,
}: {
  order: OrderDetail;
  ingredients: IngredientOption[];
  suppliers: SupplierOption[];
}) {
  const router = useRouter();

  // Edit mode state
  const [editing, setEditing] = useState(false);
  const [editDate, setEditDate] = useState("");
  const [editSupplier, setEditSupplier] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editItems, setEditItems] = useState<EditItemRow[]>([]);
  const [saving, setSaving] = useState(false);

  function startEdit() {
    setEditDate(new Date(order.order_date).toISOString().split("T")[0]);
    setEditSupplier(order.supplier?.name ?? "");
    setEditNotes(order.notes ?? "");
    setEditItems(
      order.items.map((item) => ({
        ingredient_id: item.ingredient_id,
        purchase_qty: String(item.purchase_qty),
        purchase_unit: item.purchase_unit,
        per_package_qty: item.per_package_qty
          ? String(item.per_package_qty)
          : "",
        per_package_unit: item.per_package_unit ?? "",
        subtotal: String(item.subtotal),
      })),
    );
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
  }

  function updateEditItem(
    index: number,
    field: keyof EditItemRow,
    value: string,
  ) {
    setEditItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };

      if (field === "ingredient_id" && value) {
        if (!next[index].purchase_unit) {
          next[index].purchase_unit = "台斤";
        }
        if (!next[index].per_package_unit) {
          next[index].per_package_unit = "公斤";
        }
      }

      if (field === "purchase_unit" && !isPackageUnit(value)) {
        next[index].per_package_qty = "";
        next[index].per_package_unit = "";
      }

      return next;
    });
  }

  function removeEditItem(index: number) {
    setEditItems((prev) => prev.filter((_, i) => i !== index));
  }

  function getEditItemPreview(item: EditItemRow): string | null {
    const ing = ingredients.find((i) => i.id === item.ingredient_id);
    if (!ing) return null;

    const qty = parseFloat(item.purchase_qty);
    const price = parseFloat(item.subtotal);
    if (!qty || !price) return null;

    try {
      const totalBase = computeTotalQtyBase(
        qty,
        item.purchase_unit,
        item.per_package_qty ? parseFloat(item.per_package_qty) : null,
        isPackageUnit(item.purchase_unit) ? item.per_package_unit : null,
      );
      const unitCost = price / totalBase;
      const baseUnit = getBaseUnit(ing.measure_type as MeasureType);
      const displayQty = (totalBase / 1000).toFixed(2);
      return `= ${displayQty} ${baseUnit}，單價 ${formatBaseCost(unitCost)} 元/${baseUnit}`;
    } catch {
      return null;
    }
  }

  const editGrandTotal = editItems.reduce((sum, item) => {
    const n = parseFloat(item.subtotal);
    return sum + (isNaN(n) ? 0 : n);
  }, 0);

  function validateEditItems(): string | null {
    for (let i = 0; i < editItems.length; i++) {
      const item = editItems[i];
      if (!item.ingredient_id) continue;
      const ing = ingredients.find((x) => x.id === item.ingredient_id);
      const label = ing?.name ?? `第 ${i + 1} 項`;
      if (item.purchase_qty && isNaN(Number(item.purchase_qty))) {
        return `「${label}」的數量必須為數字`;
      }
      if (
        isPackageUnit(item.purchase_unit) &&
        item.per_package_qty &&
        isNaN(Number(item.per_package_qty))
      ) {
        return `「${label}」的每${item.purchase_unit}量必須為數字`;
      }
      if (item.subtotal && isNaN(Number(item.subtotal))) {
        return `「${label}」的金額必須為數字`;
      }
    }
    return null;
  }

  async function handleSave() {
    const error = validateEditItems();
    if (error) {
      alert(error);
      return;
    }

    const validItems = editItems.filter(
      (item) =>
        item.ingredient_id &&
        parseFloat(item.purchase_qty) > 0 &&
        parseFloat(item.subtotal) > 0,
    );

    if (validItems.length === 0) return;

    setSaving(true);
    try {
      await updatePurchaseOrder(order.id, {
        order_date: editDate,
        supplier_name: editSupplier || undefined,
        notes: editNotes || undefined,
        items: validItems.map((item) => ({
          ingredient_id: item.ingredient_id,
          purchase_qty: parseFloat(item.purchase_qty),
          purchase_unit: item.purchase_unit,
          per_package_qty: isPackageUnit(item.purchase_unit)
            ? parseFloat(item.per_package_qty) || undefined
            : undefined,
          per_package_unit: isPackageUnit(item.purchase_unit)
            ? item.per_package_unit || undefined
            : undefined,
          subtotal: parseFloat(item.subtotal),
        })),
      });
      router.refresh();
      setEditing(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : "更新失敗");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("確定要刪除這張叫貨單嗎？")) return;
    await deletePurchaseOrder(order.id);
    router.push("/purchase-orders");
  }

  // ─── Edit Mode ───
  if (editing) {
    return (
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">
            編輯叫貨單 {order.order_number}
          </h2>
          <Button variant="outline" onClick={cancelEdit}>
            取消編輯
          </Button>
        </div>

        {/* 基本資訊 */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>叫貨日期</Label>
                <Input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                />
              </div>
              <div>
                <Label>供應商</Label>
                <SupplierCombobox
                  suppliers={suppliers}
                  value={editSupplier}
                  onChange={setEditSupplier}
                />
              </div>
            </div>
            <div>
              <Label>備註</Label>
              <Input
                placeholder="選填"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* 叫貨明細 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">叫貨明細</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {editItems.map((item, idx) => {
              const showPackage = isPackageUnit(item.purchase_unit);
              const preview = getEditItemPreview(item);

              return (
                <div key={idx} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-end gap-2">
                    {/* 原料 */}
                    <div className="flex-1">
                      <Label className="text-xs">原料</Label>
                      <Select
                        value={item.ingredient_id}
                        onValueChange={(v) =>
                          updateEditItem(idx, "ingredient_id", v)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="選擇原料" />
                        </SelectTrigger>
                        <SelectContent>
                          {ingredients.map((ing) => (
                            <SelectItem key={ing.id} value={ing.id}>
                              {ing.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* 數量 */}
                    <div className="w-24">
                      <Label className="text-xs">數量</Label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        placeholder="0"
                        value={item.purchase_qty}
                        onChange={(e) =>
                          updateEditItem(idx, "purchase_qty", e.target.value)
                        }
                      />
                    </div>

                    {/* 單位 */}
                    <div className="w-24">
                      <Label className="text-xs">單位</Label>
                      <Select
                        value={item.purchase_unit}
                        onValueChange={(v) =>
                          updateEditItem(idx, "purchase_unit", v)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="單位" />
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

                    {/* 包裝規格（條件顯示） */}
                    {showPackage && (
                      <>
                        <div className="w-20">
                          <Label className="text-xs">
                            每{item.purchase_unit}
                          </Label>
                          <Input
                            type="text"
                            inputMode="decimal"
                            placeholder="0"
                            value={item.per_package_qty}
                            onChange={(e) =>
                              updateEditItem(
                                idx,
                                "per_package_qty",
                                e.target.value,
                              )
                            }
                          />
                        </div>
                        <div className="w-20">
                          <Label className="text-xs">測量單位</Label>
                          <Select
                            value={item.per_package_unit}
                            onValueChange={(v) =>
                              updateEditItem(idx, "per_package_unit", v)
                            }
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

                    {/* 金額 */}
                    <div className="w-28">
                      <Label className="text-xs">金額 (元)</Label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        placeholder="0"
                        value={item.subtotal}
                        onChange={(e) =>
                          updateEditItem(idx, "subtotal", e.target.value)
                        }
                      />
                    </div>

                    {/* 刪除 */}
                    {editItems.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive shrink-0"
                        onClick={() => removeEditItem(idx)}
                      >
                        ✕
                      </Button>
                    )}
                  </div>

                  {/* 換算預覽 */}
                  {preview && (
                    <p className="text-xs text-muted-foreground pl-1">
                      {preview}
                    </p>
                  )}
                </div>
              );
            })}

            <div className="flex items-center justify-between pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setEditItems((prev) => [...prev, emptyRow()])
                }
              >
                + 新增項目
              </Button>
              <div className="text-lg font-bold">
                總計：{editGrandTotal.toLocaleString()} 元
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 儲存 */}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={cancelEdit}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "儲存中..." : "儲存變更"}
          </Button>
        </div>
      </div>
    );
  }

  // ─── View Mode ───
  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">叫貨單 {order.order_number}</h2>
        <div className="flex gap-2">
          <Link href="/purchase-orders">
            <Button variant="outline">返回列表</Button>
          </Link>
          <Button variant="secondary" onClick={startEdit}>
            編輯
          </Button>
          <Button variant="destructive" onClick={handleDelete}>
            刪除
          </Button>
        </div>
      </div>

      {/* 基本資訊 */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">叫貨日期</span>
              <p className="font-medium">
                {new Date(order.order_date).toLocaleDateString("zh-TW")}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">供應商</span>
              <p className="font-medium">
                {order.supplier?.name || "未指定"}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">總金額</span>
              <p className="font-medium text-lg">
                {order.total_amount?.toLocaleString()} 元
              </p>
            </div>
          </div>
          {order.notes && (
            <div className="mt-4 text-sm">
              <span className="text-muted-foreground">備註：</span>
              {order.notes}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 品項明細 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            叫貨明細（{order.items.length} 項）
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>原料</TableHead>
                <TableHead>採購量</TableHead>
                <TableHead>總重量/容量</TableHead>
                <TableHead className="text-right">金額</TableHead>
                <TableHead className="text-right">單位成本</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.items.map((item) => {
                const baseUnit = getBaseUnit(
                  item.ingredient.measure_type as MeasureType,
                );
                const displayQty = (item.total_qty_base / 1000).toFixed(2);

                return (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      {item.ingredient.name}
                      <Badge variant="outline" className="ml-2 text-xs">
                        {item.ingredient.measure_type === "weight"
                          ? "重量"
                          : "體積"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {item.purchase_qty} {unitLabel(item.purchase_unit)}
                      {isPackageUnit(item.purchase_unit) &&
                        item.per_package_qty && (
                          <span className="text-xs text-muted-foreground ml-1">
                            (每{unitLabel(item.purchase_unit)}{" "}
                            {item.per_package_qty}{" "}
                            {item.per_package_unit
                              ? unitLabel(item.per_package_unit)
                              : ""}
                            )
                          </span>
                        )}
                    </TableCell>
                    <TableCell>
                      {displayQty} {baseUnit}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.subtotal.toLocaleString()} 元
                    </TableCell>
                    <TableCell className="text-right">
                      {formatBaseCost(item.unit_cost_base)} 元/{baseUnit}
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
