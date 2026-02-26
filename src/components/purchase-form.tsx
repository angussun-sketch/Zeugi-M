"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { createPurchaseRecord } from "@/actions/purchases";
import { getUnitsForType, type MeasureType } from "@/lib/units";

interface PurchaseFormProps {
  ingredientId: string;
  measureType: string;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

type InputMode = "direct" | "package";

export function PurchaseForm({
  ingredientId,
  measureType,
  trigger,
  onSuccess,
}: PurchaseFormProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<InputMode>("direct");
  const [price, setPrice] = useState("");
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState(measureType === "weight" ? "kg" : "cc");
  const [packageCount, setPackageCount] = useState("");
  const [perPackageQty, setPerPackageQty] = useState("");
  const [perPackageUnit, setPerPackageUnit] = useState(
    measureType === "weight" ? "kg" : "cc"
  );
  const [loading, setLoading] = useState(false);

  const units = getUnitsForType(measureType as MeasureType);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "direct") {
        await createPurchaseRecord({
          ingredient_id: ingredientId,
          purchase_price: parseFloat(price),
          purchase_unit: unit,
          purchase_qty: parseFloat(qty),
        });
      } else {
        await createPurchaseRecord({
          ingredient_id: ingredientId,
          purchase_price: parseFloat(price),
          purchase_unit: perPackageUnit,
          package_count: parseInt(packageCount),
          per_package_qty: parseFloat(perPackageQty),
          per_package_unit: perPackageUnit,
        });
      }
      setOpen(false);
      resetForm();
      onSuccess?.();
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setPrice("");
    setQty("");
    setPackageCount("");
    setPerPackageQty("");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || <Button variant="outline" size="sm">設定採購</Button>}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>採購設定</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>採購總價 (元)</Label>
            <Input
              type="number"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="例如：1450"
              required
            />
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant={mode === "direct" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("direct")}
            >
              直接輸入總量
            </Button>
            <Button
              type="button"
              variant={mode === "package" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("package")}
            >
              包裝明細
            </Button>
          </div>

          {mode === "direct" ? (
            <div className="flex gap-2">
              <div className="flex-1">
                <Label>總數量</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  placeholder="例如：50"
                  required
                />
              </div>
              <div className="w-28">
                <Label>單位</Label>
                <Select value={unit} onValueChange={setUnit}>
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
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <Label>幾包/罐</Label>
                <Input
                  type="number"
                  value={packageCount}
                  onChange={(e) => setPackageCount(e.target.value)}
                  placeholder="例如：4"
                  required
                />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label>每包/罐數量</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={perPackageQty}
                    onChange={(e) => setPerPackageQty(e.target.value)}
                    placeholder="例如：5000"
                    required
                  />
                </div>
                <div className="w-28">
                  <Label>單位</Label>
                  <Select
                    value={perPackageUnit}
                    onValueChange={setPerPackageUnit}
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
              </div>
            </div>
          )}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "儲存中..." : "儲存採購紀錄"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
