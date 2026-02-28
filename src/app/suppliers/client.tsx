"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from "@/actions/purchase-orders";

type Supplier = {
  id: string;
  name: string;
  category: string;
  contact: string | null;
  phone: string | null;
  notes: string | null;
  _count: { purchase_orders: number };
};

type FormData = {
  name: string;
  category: string;
  contact: string;
  phone: string;
  notes: string;
};

const emptyForm: FormData = {
  name: "",
  category: "原料",
  contact: "",
  phone: "",
  notes: "",
};

export function SuppliersClient({
  suppliers,
  categories,
}: {
  suppliers: Supplier[];
  categories: string[];
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = filter
    ? suppliers.filter((s) => s.category === filter)
    : suppliers;

  // All unique categories (from server + any local categories)
  const allCategories = Array.from(
    new Set([...categories, "原料", "包材"]),
  ).sort();

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
    setDialogOpen(true);
  }

  function openEdit(supplier: Supplier) {
    setEditingId(supplier.id);
    setForm({
      name: supplier.name,
      category: supplier.category,
      contact: supplier.contact || "",
      phone: supplier.phone || "",
      notes: supplier.notes || "",
    });
    setError(null);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      setError("請輸入供應商名稱");
      return;
    }
    if (!form.category.trim()) {
      setError("請輸入分類");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await updateSupplier(editingId, {
          name: form.name.trim(),
          category: form.category.trim(),
          contact: form.contact.trim() || null,
          phone: form.phone.trim() || null,
          notes: form.notes.trim() || null,
        });
      } else {
        await createSupplier({
          name: form.name.trim(),
          category: form.category.trim(),
          contact: form.contact.trim() || undefined,
          phone: form.phone.trim() || undefined,
          notes: form.notes.trim() || undefined,
        });
      }
      setDialogOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "儲存失敗");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(supplier: Supplier) {
    if (
      !confirm(
        supplier._count.purchase_orders > 0
          ? `此供應商有 ${supplier._count.purchase_orders} 筆叫貨單，確定要刪除嗎？`
          : `確定要刪除供應商「${supplier.name}」嗎？`,
      )
    )
      return;

    setDeleting(supplier.id);
    try {
      await deleteSupplier(supplier.id);
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "刪除失敗");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">供應商管理</h2>
        <Button onClick={openCreate}>新增供應商</Button>
      </div>

      {/* 分類篩選 */}
      <div className="flex gap-2 flex-wrap">
        <Button
          variant={filter === null ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter(null)}
        >
          全部 ({suppliers.length})
        </Button>
        {allCategories.map((cat) => {
          const count = suppliers.filter((s) => s.category === cat).length;
          if (count === 0 && !categories.includes(cat)) return null;
          return (
            <Button
              key={cat}
              variant={filter === cat ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(cat)}
            >
              {cat} ({count})
            </Button>
          );
        })}
      </div>

      {/* 供應商列表 */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            {filter ? `目前沒有「${filter}」分類的供應商` : "尚未建立任何供應商"}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              供應商列表（{filtered.length} 家）
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名稱</TableHead>
                  <TableHead>分類</TableHead>
                  <TableHead>聯絡人</TableHead>
                  <TableHead>電話</TableHead>
                  <TableHead>備註</TableHead>
                  <TableHead className="text-right">叫貨單數</TableHead>
                  <TableHead className="w-[140px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((supplier) => (
                  <TableRow key={supplier.id}>
                    <TableCell className="font-medium">
                      {supplier.name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{supplier.category}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {supplier.contact || (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {supplier.phone || (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {supplier.notes || "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      {supplier._count.purchase_orders}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEdit(supplier)}
                        >
                          編輯
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          disabled={deleting === supplier.id}
                          onClick={() => handleDelete(supplier)}
                        >
                          刪除
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* 新增/編輯 Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId ? "編輯供應商" : "新增供應商"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>名稱 *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="供應商名稱"
              />
            </div>
            <div className="space-y-2">
              <Label>分類 *</Label>
              <Input
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="例：原料、包材、物流"
                list="category-options"
              />
              <datalist id="category-options">
                {allCategories.map((cat) => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
            </div>
            <div className="space-y-2">
              <Label>聯絡人</Label>
              <Input
                value={form.contact}
                onChange={(e) => setForm({ ...form, contact: e.target.value })}
                placeholder="聯絡人姓名"
              />
            </div>
            <div className="space-y-2">
              <Label>電話</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="電話號碼"
              />
            </div>
            <div className="space-y-2">
              <Label>備註</Label>
              <Input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="備註"
              />
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              取消
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "儲存中..." : "儲存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
