"use client";

import { useState, useTransition, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { IngredientMultiSelect } from "@/components/ingredient-multi-select";
import { deletePurchaseOrders } from "@/actions/purchase-orders";
import { isPackageUnit } from "@/lib/units";

type OrderItem = {
  id: string;
  ingredient: { name: string };
  purchase_qty: number;
  purchase_unit: string;
  per_package_qty: number | null;
  per_package_unit: string | null;
  subtotal: number;
};

type Order = {
  id: string;
  order_number: string;
  order_date: Date;
  supplier: { id: string; name: string } | null;
  notes: string | null;
  total_amount: number | null;
  items: OrderItem[];
  _count: { items: number };
};

interface Filters {
  dateFrom: string;
  dateTo: string;
  supplierName: string;
  ingredientIds: string[];
}

interface Props {
  orders: Order[];
  total: number;
  page: number;
  totalPages: number;
  ingredients: { id: string; name: string }[];
  supplierNames: string[];
  filters: Filters;
}

export function PurchaseOrdersClient({
  orders,
  total,
  page,
  totalPages,
  ingredients,
  supplierNames,
  filters,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // 篩選器 local state（初始化自 server 傳來的 filters）
  const [dateFrom, setDateFrom] = useState(filters.dateFrom);
  const [dateTo, setDateTo] = useState(filters.dateTo);
  const [filterSupplier, setFilterSupplier] = useState(filters.supplierName);
  const [filterIngredients, setFilterIngredients] = useState<string[]>(
    filters.ingredientIds,
  );

  // 多選
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // 刪除 Dialog
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const hasFilter =
    dateFrom || dateTo || filterSupplier || filterIngredients.length > 0;

  // 構建 URL 並導航
  const navigate = useCallback(
    (overrides: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());

      for (const [key, value] of Object.entries(overrides)) {
        if (value) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      }

      startTransition(() => {
        router.push(`/purchase-orders?${params.toString()}`);
      });
    },
    [router, searchParams, startTransition],
  );

  function applyFilters() {
    setSelected(new Set());
    navigate({
      page: "1",
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      supplier: filterSupplier || undefined,
      ingredients:
        filterIngredients.length > 0
          ? filterIngredients.join(",")
          : undefined,
    });
  }

  function clearFilters() {
    setDateFrom("");
    setDateTo("");
    setFilterSupplier("");
    setFilterIngredients([]);
    setSelected(new Set());
    startTransition(() => {
      router.push("/purchase-orders");
    });
  }

  function goToPage(p: number) {
    setSelected(new Set());
    navigate({ page: String(p) });
  }

  // 多選操作
  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === orders.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(orders.map((o) => o.id)));
    }
  }

  const selectedOrders = orders.filter((o) => selected.has(o.id));

  async function handleBatchDelete() {
    if (deleteConfirmText !== "刪除") return;
    setDeleting(true);
    try {
      await deletePurchaseOrders(Array.from(selected));
      setSelected(new Set());
      setShowDeleteDialog(false);
      setDeleteConfirmText("");
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "刪除失敗");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* 標題列 + 右上角操作 */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">叫貨單</h2>
        <div className="flex gap-2">
          {selected.size > 0 && (
            <Button
              variant="destructive"
              onClick={() => {
                setDeleteConfirmText("");
                setShowDeleteDialog(true);
              }}
            >
              刪除 ({selected.size})
            </Button>
          )}
          <Link href="/purchase-orders/new">
            <Button>建立叫貨單</Button>
          </Link>
        </div>
      </div>

      {/* 篩選器 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-3 items-end flex-wrap">
            <div className="w-36">
              <Label className="text-xs">日期起始</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="w-36">
              <Label className="text-xs">日期結束</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <div className="w-40">
              <Label className="text-xs">供應商</Label>
              <Select
                value={filterSupplier || "__all__"}
                onValueChange={(v) =>
                  setFilterSupplier(v === "__all__" ? "" : v)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="全部" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">全部</SelectItem>
                  {supplierNames.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-48">
              <Label className="text-xs">品項</Label>
              <IngredientMultiSelect
                ingredients={ingredients}
                value={filterIngredients}
                onChange={setFilterIngredients}
              />
            </div>
            <Button size="sm" onClick={applyFilters} disabled={isPending}>
              {isPending ? "查詢中..." : "查詢"}
            </Button>
            {hasFilter && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                disabled={isPending}
              >
                清除篩選
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 表格 */}
      {total === 0 && !hasFilter ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            尚未建立任何叫貨單
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              叫貨紀錄
              <span className="text-muted-foreground font-normal ml-2">
                （共 {total} 筆
                {totalPages > 1 && `，第 ${page} / ${totalPages} 頁`}）
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={
                        orders.length > 0 && selected.size === orders.length
                      }
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>單號</TableHead>
                  <TableHead>日期</TableHead>
                  <TableHead>供應商</TableHead>
                  <TableHead>品項</TableHead>
                  <TableHead className="text-right">總金額</TableHead>
                  <TableHead>備註</TableHead>
                  <TableHead className="w-[80px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center text-muted-foreground"
                    >
                      {hasFilter ? "無符合篩選條件的叫貨單" : "尚無叫貨單"}
                    </TableCell>
                  </TableRow>
                )}
                {orders.map((order) => (
                  <TableRow
                    key={order.id}
                    className={selected.has(order.id) ? "bg-muted/50" : ""}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selected.has(order.id)}
                        onCheckedChange={() => toggleSelect(order.id)}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {order.order_number}
                    </TableCell>
                    <TableCell>
                      {new Date(order.order_date).toLocaleDateString("zh-TW")}
                    </TableCell>
                    <TableCell>
                      {order.supplier?.name || (
                        <span className="text-muted-foreground">未指定</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {order.items.map((item) => (
                          <div key={item.id} className="text-sm">
                            <span className="font-medium">
                              {item.ingredient.name}
                            </span>
                            <span className="text-muted-foreground ml-1">
                              {item.purchase_qty} {item.purchase_unit}
                              {isPackageUnit(item.purchase_unit) &&
                                item.per_package_qty && (
                                  <span>
                                    {" "}
                                    (每{item.purchase_unit}{" "}
                                    {item.per_package_qty}{" "}
                                    {item.per_package_unit})
                                  </span>
                                )}
                            </span>
                          </div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {order.total_amount?.toLocaleString()} 元
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {order.notes || "-"}
                    </TableCell>
                    <TableCell>
                      <Link href={`/purchase-orders/${order.id}`}>
                        <Button variant="outline" size="sm">
                          檢視
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* 分頁 */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t mt-4">
                <p className="text-sm text-muted-foreground">
                  第 {page} / {totalPages} 頁（共 {total} 筆）
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1 || isPending}
                    onClick={() => goToPage(page - 1)}
                  >
                    上一頁
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages || isPending}
                    onClick={() => goToPage(page + 1)}
                  >
                    下一頁
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 批次刪除確認 Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>確認刪除叫貨單</DialogTitle>
            <DialogDescription>
              即將刪除 {selectedOrders.length} 筆叫貨單，此操作無法復原。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="max-h-40 overflow-y-auto border rounded p-2 text-sm space-y-1">
              {selectedOrders.map((o) => (
                <div key={o.id} className="flex justify-between">
                  <span className="font-mono">{o.order_number}</span>
                  <span className="text-muted-foreground">
                    {new Date(o.order_date).toLocaleDateString("zh-TW")}
                    {o.supplier ? ` — ${o.supplier.name}` : ""}
                  </span>
                </div>
              ))}
            </div>
            <div>
              <Label className="text-sm">
                請輸入「刪除」以確認操作
              </Label>
              <Input
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="刪除"
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              disabled={deleteConfirmText !== "刪除" || deleting}
              onClick={handleBatchDelete}
            >
              {deleting ? "刪除中..." : `確認刪除 (${selectedOrders.length} 筆)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
