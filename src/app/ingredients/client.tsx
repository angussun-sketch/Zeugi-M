"use client";

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
import { Badge } from "@/components/ui/badge";
import { IngredientForm } from "@/components/ingredient-form";
import { PurchaseForm } from "@/components/purchase-form";
import { deleteIngredient } from "@/actions/ingredients";
import { formatCost } from "@/lib/units";

type IngredientWithPurchase = {
  id: string;
  name: string;
  measure_type: string;
  created_at: Date;
  updated_at: Date;
  purchase_records: {
    id: string;
    unit_cost_base: number;
    purchase_price: number;
    purchase_qty_base: number;
    purchase_unit: string;
    recorded_at: Date;
  }[];
};

export function IngredientsClient({
  ingredients,
}: {
  ingredients: IngredientWithPurchase[];
}) {
  const router = useRouter();

  async function handleDelete(id: string) {
    if (!confirm("確定要刪除此原料？")) return;
    await deleteIngredient(id);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">原料管理</h1>
        <IngredientForm onSuccess={() => router.refresh()} />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>名稱</TableHead>
            <TableHead>計量類型</TableHead>
            <TableHead>目前單價</TableHead>
            <TableHead>採購資訊</TableHead>
            <TableHead className="w-48">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ingredients.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                尚無原料，點擊「新增原料」開始
              </TableCell>
            </TableRow>
          )}
          {ingredients.map((ing) => {
            const currentPurchase = ing.purchase_records[0];
            const baseUnit = ing.measure_type === "weight" ? "g" : "cc";

            return (
              <TableRow key={ing.id}>
                <TableCell className="font-medium">{ing.name}</TableCell>
                <TableCell>
                  <Badge variant="secondary">
                    {ing.measure_type === "weight" ? "重量" : "體積"}
                  </Badge>
                </TableCell>
                <TableCell>
                  {currentPurchase ? (
                    <span>
                      {formatCost(currentPurchase.unit_cost_base)} 元/{baseUnit}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">未設定</span>
                  )}
                </TableCell>
                <TableCell>
                  {currentPurchase ? (
                    <span className="text-sm text-muted-foreground">
                      {currentPurchase.purchase_price} 元 /{" "}
                      {currentPurchase.purchase_qty_base.toLocaleString()}{" "}
                      {baseUnit}
                    </span>
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <PurchaseForm
                      ingredientId={ing.id}
                      measureType={ing.measure_type}
                      onSuccess={() => router.refresh()}
                    />
                    <IngredientForm
                      ingredient={ing}
                      trigger={
                        <Button variant="outline" size="sm">
                          編輯
                        </Button>
                      }
                      onSuccess={() => router.refresh()}
                    />
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(ing.id)}
                    >
                      刪除
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
