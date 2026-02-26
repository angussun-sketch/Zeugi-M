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
import { createIngredient, updateIngredient } from "@/actions/ingredients";

interface IngredientFormProps {
  ingredient?: { id: string; name: string; measure_type: string };
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

export function IngredientForm({
  ingredient,
  trigger,
  onSuccess,
}: IngredientFormProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(ingredient?.name || "");
  const [measureType, setMeasureType] = useState(
    ingredient?.measure_type || "weight"
  );
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (ingredient) {
        await updateIngredient(ingredient.id, {
          name,
          measure_type: measureType,
        });
      } else {
        await createIngredient({ name, measure_type: measureType });
      }
      setOpen(false);
      setName("");
      setMeasureType("weight");
      onSuccess?.();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || <Button>新增原料</Button>}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{ingredient ? "編輯原料" : "新增原料"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>原料名稱</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：二砂糖"
              required
            />
          </div>
          <div>
            <Label>計量類型</Label>
            <Select value={measureType} onValueChange={setMeasureType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weight">重量 (g/kg/台斤)</SelectItem>
                <SelectItem value="volume">體積 (cc)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "儲存中..." : "儲存"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
