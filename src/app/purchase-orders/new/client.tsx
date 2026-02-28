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
import { SupplierCombobox } from "@/components/supplier-combobox";
import { EntityCombobox } from "@/components/entity-combobox";
import { createPurchaseOrder } from "@/actions/purchase-orders";
import {
  isPackageUnit,
  PACKAGE_UNITS,
  computeTotalQtyBase,
  formatBaseCost,
  getBaseUnit,
  type MeasureType,
} from "@/lib/units";

type Ingredient = {
  id: string;
  name: string;
  measure_type: string;
  unit_cost_base: number | null;
};

type Supplier = {
  id: string;
  name: string;
};

interface ItemRow {
  ingredient_id: string;
  purchase_qty: string;
  purchase_unit: string;
  per_package_qty: string;
  per_package_unit: string;
  subtotal: string;
}

function emptyRow(): ItemRow {
  return {
    ingredient_id: "",
    purchase_qty: "",
    purchase_unit: "",
    per_package_qty: "",
    per_package_unit: "",
    subtotal: "",
  };
}

type EntityOption = {
  id: string;
  name: string;
  tax_id: string;
};

export function PurchaseOrderNewClient({
  ingredients,
  suppliers,
  entities,
}: {
  ingredients: Ingredient[];
  suppliers: Supplier[];
  entities: EntityOption[];
}) {
  const router = useRouter();
  const today = new Date().toISOString().split("T")[0];

  const [entityId, setEntityId] = useState(entities[0]?.id ?? "");
  const [orderDate, setOrderDate] = useState(today);
  const [supplierName, setSupplierName] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<ItemRow[]>([emptyRow()]);
  const [submitting, setSubmitting] = useState(false);

  function updateItem(index: number, field: keyof ItemRow, value: string) {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };

      // 選原料時自動設定預設單位
      if (field === "ingredient_id" && value) {
        if (!next[index].purchase_unit) {
          next[index].purchase_unit = "台斤";
        }
        if (!next[index].per_package_unit) {
          next[index].per_package_unit = "公斤";
        }
      }

      // 切換單位時清除包裝欄位
      if (field === "purchase_unit" && !isPackageUnit(value)) {
        next[index].per_package_qty = "";
        next[index].per_package_unit = "";
      }

      return next;
    });
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function getItemPreview(item: ItemRow): string | null {
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

  const grandTotal = items.reduce((sum, item) => {
    const n = parseFloat(item.subtotal);
    return sum + (isNaN(n) ? 0 : n);
  }, 0);

  function validateItems(): string | null {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
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

  async function handleSubmit() {
    const error = validateItems();
    if (error) {
      alert(error);
      return;
    }

    const validItems = items.filter(
      (item) =>
        item.ingredient_id &&
        parseFloat(item.purchase_qty) > 0 &&
        parseFloat(item.subtotal) > 0,
    );

    if (validItems.length === 0) return;

    setSubmitting(true);
    try {
      await createPurchaseOrder({
        order_date: orderDate,
        supplier_name: supplierName || undefined,
        notes: notes || undefined,
        entity_id: entityId || undefined,
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
      router.push("/purchase-orders");
    } catch (e) {
      alert(e instanceof Error ? e.message : "建立失敗");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <h2 className="text-2xl font-bold">建立叫貨單</h2>

      {/* 基本資訊 */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          {entities.length > 1 && (
            <div>
              <Label>歸屬公司</Label>
              <EntityCombobox
                entities={entities}
                value={entityId}
                onChange={setEntityId}
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>叫貨日期</Label>
              <Input
                type="date"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
              />
            </div>
            <div>
              <Label>供應商</Label>
              <SupplierCombobox
                suppliers={suppliers}
                value={supplierName}
                onChange={setSupplierName}
              />
            </div>
          </div>
          <div>
            <Label>備註</Label>
            <Input
              placeholder="選填"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
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
          {items.map((item, idx) => {
            const ing = ingredients.find((i) => i.id === item.ingredient_id);
            const showPackage = isPackageUnit(item.purchase_unit);
            const preview = getItemPreview(item);

            return (
              <div key={idx} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-end gap-2">
                  {/* 原料 */}
                  <div className="flex-1">
                    <Label className="text-xs">原料</Label>
                    <Select
                      value={item.ingredient_id}
                      onValueChange={(v) =>
                        updateItem(idx, "ingredient_id", v)
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
                        updateItem(idx, "purchase_qty", e.target.value)
                      }
                    />
                  </div>

                  {/* 單位 */}
                  <div className="w-24">
                    <Label className="text-xs">單位</Label>
                    <Select
                      value={item.purchase_unit}
                      onValueChange={(v) =>
                        updateItem(idx, "purchase_unit", v)
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

                  {/* 包裝規格 → 測量單位換算（條件顯示） */}
                  {showPackage && (
                    <>
                      <div className="w-20">
                        <Label className="text-xs">每{item.purchase_unit}</Label>
                        <Input
                          type="text"
                          inputMode="decimal"
                          placeholder="0"
                          value={item.per_package_qty}
                          onChange={(e) =>
                            updateItem(idx, "per_package_qty", e.target.value)
                          }
                        />
                      </div>
                      <div className="w-20">
                        <Label className="text-xs">測量單位</Label>
                        <Select
                          value={item.per_package_unit}
                          onValueChange={(v) =>
                            updateItem(idx, "per_package_unit", v)
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
                        updateItem(idx, "subtotal", e.target.value)
                      }
                    />
                  </div>

                  {/* 刪除 */}
                  {items.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive shrink-0"
                      onClick={() => removeItem(idx)}
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
              onClick={() => setItems((prev) => [...prev, emptyRow()])}
            >
              + 新增項目
            </Button>
            <div className="text-lg font-bold">
              總計：{grandTotal.toLocaleString()} 元
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 提交 */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.back()}>
          取消
        </Button>
        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting ? "建立中..." : "建立叫貨單"}
        </Button>
      </div>
    </div>
  );
}
