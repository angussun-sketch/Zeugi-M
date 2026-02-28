"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createCashflowRecord,
  updateCashflowRecord,
  deleteCashflowRecord,
} from "@/actions/cashflow";
import { EntityCombobox } from "@/components/entity-combobox";

// ==================== Types ====================

type Category = {
  id: string;
  direction: string;
  group_name: string;
  name: string;
  account_code: string;
  _count: { cashflow_records: number; recurring_cashflows: number };
};

type FundAccount = {
  id: string;
  name: string;
  account_type: string;
  is_active: boolean;
};

type CashflowRecord = {
  id: string;
  direction: string;
  category_id: string;
  category: { id: string; direction: string; group_name: string; name: string };
  fund_account_id: string | null;
  fund_account: { id: string; name: string } | null;
  entity: { name: string; tax_id: string };
  amount: number;
  description: string | null;
  record_date: Date;
  source: string;
  recurring_cashflow: { id: string; name: string } | null;
};

type EntityOption = {
  id: string;
  name: string;
  tax_id: string;
};

interface Filters {
  direction: string;
  dateFrom: string;
  dateTo: string;
  categoryId: string;
  source: string;
}

interface Props {
  records: CashflowRecord[];
  total: number;
  page: number;
  totalPages: number;
  categories: Category[];
  fundAccounts: FundAccount[];
  entities: EntityOption[];
  filters: Filters;
}

// ==================== Helpers ====================

function groupCategories(categories: Category[]) {
  const groups: Record<string, Category[]> = {};
  for (const cat of categories) {
    if (!groups[cat.group_name]) groups[cat.group_name] = [];
    groups[cat.group_name].push(cat);
  }
  return groups;
}

// ==================== Component ====================

export function CashflowClient({
  records,
  total,
  page,
  totalPages,
  categories,
  fundAccounts,
  entities,
  filters,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const today = new Date().toISOString().split("T")[0];

  // Tab state
  const [activeTab, setActiveTab] = useState<"income" | "expense">(
    (filters.direction as "income" | "expense") || "expense",
  );

  // Quick input form state
  const [formEntityId, setFormEntityId] = useState(entities[0]?.id ?? "");
  const [formFundAccountId, setFormFundAccountId] = useState(
    fundAccounts[0]?.id ?? "",
  );
  const [formDate, setFormDate] = useState(today);
  const [formCategoryId, setFormCategoryId] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [saving, setSaving] = useState(false);

  // Filter state
  const [dateFrom, setDateFrom] = useState(filters.dateFrom);
  const [dateTo, setDateTo] = useState(filters.dateTo);
  const [filterCategory, setFilterCategory] = useState(filters.categoryId);
  const [filterSource, setFilterSource] = useState(filters.source);
  const hasFilter =
    filters.direction || dateFrom || dateTo || filterCategory || filterSource;

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<CashflowRecord | null>(
    null,
  );
  const [editCategoryId, setEditCategoryId] = useState("");
  const [editFundAccountId, setEditFundAccountId] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // Derived data
  const tabCategories = categories.filter((c) => c.direction === activeTab);
  const groupedTabCategories = groupCategories(tabCategories);

  // ==================== Navigation ====================

  const navigate = useCallback(
    (overrides: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(overrides)) {
        if (value) params.set(key, value);
        else params.delete(key);
      }
      startTransition(() => {
        router.push(`/cashflow?${params.toString()}`);
      });
    },
    [router, searchParams, startTransition],
  );

  function switchTab(tab: "income" | "expense") {
    setActiveTab(tab);
    setFormCategoryId("");
    navigate({ direction: tab, page: "1", category: undefined });
  }

  function applyFilters() {
    navigate({
      page: "1",
      direction: activeTab,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      category: filterCategory || undefined,
      source: filterSource || undefined,
    });
  }

  function clearFilters() {
    setDateFrom("");
    setDateTo("");
    setFilterCategory("");
    setFilterSource("");
    startTransition(() => {
      router.push(`/cashflow?direction=${activeTab}`);
    });
  }

  function goToPage(p: number) {
    navigate({ page: String(p) });
  }

  // ==================== Quick Input ====================

  async function handleQuickSubmit() {
    const amount = parseFloat(formAmount);
    if (!formCategoryId || isNaN(amount) || amount <= 0 || !formDate) {
      alert("請填寫完整且金額必須為正數");
      return;
    }

    setSaving(true);
    try {
      await createCashflowRecord({
        direction: activeTab,
        category_id: formCategoryId,
        fund_account_id: formFundAccountId || undefined,
        amount,
        record_date: formDate,
        description: formDescription || undefined,
        entity_id: formEntityId || undefined,
      });
      // Clear amount, category, description; keep date, entity, fund account
      setFormAmount("");
      setFormCategoryId("");
      setFormDescription("");
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "新增失敗");
    } finally {
      setSaving(false);
    }
  }

  // ==================== Edit ====================

  function openEditDialog(record: CashflowRecord) {
    setEditingRecord(record);
    setEditCategoryId(record.category_id);
    setEditFundAccountId(record.fund_account_id ?? "");
    setEditDate(new Date(record.record_date).toISOString().split("T")[0]);
    setEditAmount(record.amount.toString());
    setEditDescription(record.description ?? "");
    setEditDialogOpen(true);
  }

  async function handleEditSave() {
    if (!editingRecord) return;
    const amount = parseFloat(editAmount);
    if (!editCategoryId || isNaN(amount) || amount <= 0 || !editDate) {
      alert("請填寫完整且金額必須為正數");
      return;
    }

    setEditSaving(true);
    try {
      await updateCashflowRecord(editingRecord.id, {
        category_id: editCategoryId,
        fund_account_id: editFundAccountId || undefined,
        amount,
        record_date: editDate,
        description: editDescription || undefined,
      });
      setEditDialogOpen(false);
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "儲存失敗");
    } finally {
      setEditSaving(false);
    }
  }

  // ==================== Delete ====================

  async function handleDelete(id: string) {
    if (!confirm("確定要刪除此筆收支紀錄？")) return;
    try {
      await deleteCashflowRecord(id);
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "刪除失敗");
    }
  }

  // ==================== Edit dialog categories ====================

  const editCategories = editingRecord
    ? categories.filter((c) => c.direction === editingRecord.direction)
    : [];
  const groupedEditCategories = groupCategories(editCategories);

  // ==================== Render ====================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">收支管理</h2>
        <Button variant="outline" onClick={() => {}}>
          設定
        </Button>
      </div>

      {/* Tab Buttons */}
      <div className="flex gap-2">
        <Button
          variant={activeTab === "income" ? "default" : "outline"}
          onClick={() => switchTab("income")}
        >
          + 收款
        </Button>
        <Button
          variant={activeTab === "expense" ? "default" : "outline"}
          onClick={() => switchTab("expense")}
        >
          - 付款
        </Button>
      </div>

      {/* Quick Input Form */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            {/* Entity Combobox */}
            {entities.length > 1 && (
              <div>
                <Label className="text-xs">歸屬公司</Label>
                <EntityCombobox
                  entities={entities}
                  value={formEntityId}
                  onChange={setFormEntityId}
                />
              </div>
            )}

            {/* Fund Account */}
            <div>
              <Label className="text-xs">資金帳戶</Label>
              <Select
                value={formFundAccountId || "__none__"}
                onValueChange={(v) =>
                  setFormFundAccountId(v === "__none__" ? "" : v)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="選擇帳戶" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">不指定</SelectItem>
                  {fundAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date */}
            <div>
              <Label className="text-xs">日期</Label>
              <Input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
              />
            </div>

            {/* Category (grouped) */}
            <div>
              <Label className="text-xs">分類</Label>
              <Select value={formCategoryId} onValueChange={setFormCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="選擇分類" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(groupedTabCategories).map(
                    ([groupName, cats]) => (
                      <SelectGroup key={groupName}>
                        <SelectLabel>{groupName}</SelectLabel>
                        {cats.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Amount */}
            <div>
              <Label className="text-xs">金額</Label>
              <Input
                type="number"
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
                placeholder="金額"
                min="0"
                step="1"
              />
            </div>

            {/* Description */}
            <div>
              <Label className="text-xs">備註</Label>
              <Input
                type="text"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="備註（選填）"
              />
            </div>

            {/* Submit */}
            <div>
              <Button
                className="w-full"
                onClick={handleQuickSubmit}
                disabled={saving}
              >
                {saving
                  ? "新增中..."
                  : activeTab === "income"
                    ? "+ 新增收款"
                    : "- 新增付款"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filter Bar */}
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
              <Label className="text-xs">分類</Label>
              <Select
                value={filterCategory || "__all__"}
                onValueChange={(v) =>
                  setFilterCategory(v === "__all__" ? "" : v)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="全部" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">全部</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.group_name} · {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-32">
              <Label className="text-xs">來源</Label>
              <Select
                value={filterSource || "__all__"}
                onValueChange={(v) =>
                  setFilterSource(v === "__all__" ? "" : v)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="全部" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">全部</SelectItem>
                  <SelectItem value="manual">手動</SelectItem>
                  <SelectItem value="recurring">定期</SelectItem>
                </SelectContent>
              </Select>
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
                清除
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Records Table */}
      {total === 0 && !hasFilter ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            尚未建立任何收支紀錄
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              收支紀錄
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
                  <TableHead>日期</TableHead>
                  <TableHead>方向</TableHead>
                  <TableHead>分類</TableHead>
                  <TableHead className="text-right">金額</TableHead>
                  <TableHead>資金帳戶</TableHead>
                  <TableHead>備註</TableHead>
                  <TableHead className="w-[120px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center text-muted-foreground"
                    >
                      {hasFilter ? "無符合篩選條件的紀錄" : "尚無紀錄"}
                    </TableCell>
                  </TableRow>
                )}
                {records.map((record) => {
                  const isIncome = record.direction === "income";
                  return (
                    <TableRow key={record.id}>
                      <TableCell>
                        {new Date(record.record_date).toLocaleDateString(
                          "zh-TW",
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={isIncome ? "default" : "secondary"}
                          className={
                            isIncome
                              ? "bg-green-600 hover:bg-green-600"
                              : ""
                          }
                        >
                          {isIncome ? "收入" : "支出"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {record.category.group_name} · {record.category.name}
                      </TableCell>
                      <TableCell
                        className={`text-right font-medium ${isIncome ? "text-green-600" : "text-red-600"}`}
                      >
                        {isIncome ? "+" : "-"}
                        {record.amount.toLocaleString()} 元
                      </TableCell>
                      <TableCell>
                        {record.fund_account?.name ?? "-"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {record.description || "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(record)}
                          >
                            編輯
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() => handleDelete(record.id)}
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

            {/* Pagination */}
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

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>編輯收支紀錄</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Fund Account */}
            <div>
              <Label>資金帳戶</Label>
              <Select
                value={editFundAccountId || "__none__"}
                onValueChange={(v) =>
                  setEditFundAccountId(v === "__none__" ? "" : v)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="選擇帳戶" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">不指定</SelectItem>
                  {fundAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date */}
            <div>
              <Label>日期</Label>
              <Input
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
              />
            </div>

            {/* Category (grouped) */}
            <div>
              <Label>分類</Label>
              <Select value={editCategoryId} onValueChange={setEditCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="選擇分類" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(groupedEditCategories).map(
                    ([groupName, cats]) => (
                      <SelectGroup key={groupName}>
                        <SelectLabel>{groupName}</SelectLabel>
                        {cats.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Amount */}
            <div>
              <Label>金額（元）</Label>
              <Input
                type="number"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                placeholder="金額"
                min="0"
                step="1"
              />
            </div>

            {/* Description */}
            <div>
              <Label>備註（選填）</Label>
              <Input
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="備註"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
            >
              取消
            </Button>
            <Button onClick={handleEditSave} disabled={editSaving}>
              {editSaving ? "儲存中..." : "儲存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
