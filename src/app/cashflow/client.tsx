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
  createCashflowCategory,
  deleteCashflowCategory,
  createFundAccount,
  updateFundAccount,
  deleteFundAccount,
  getFundAccounts,
  getRecurringCashflows,
  createRecurringCashflow,
  updateRecurringCashflow,
  deleteRecurringCashflow,
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

type RecurringCashflowItem = {
  id: string;
  direction: string;
  name: string;
  category_id: string;
  category: { id: string; direction: string; group_name: string; name: string };
  fund_account_id: string | null;
  fund_account: { id: string; name: string } | null;
  amount: number;
  due_day: number;
  description: string | null;
  is_active: boolean;
  last_generated: Date | null;
  _count: { records: number };
};

type FundAccountFull = {
  id: string;
  name: string;
  account_type: string;
  is_active: boolean;
  _count?: { cashflow_records: number };
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

  // Settings dialog state
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"categories" | "accounts" | "recurring">("categories");

  // Settings: Category form
  const [newCatDirection, setNewCatDirection] = useState<string>("expense");
  const [newCatGroupName, setNewCatGroupName] = useState("");
  const [newCatName, setNewCatName] = useState("");
  const [newCatAccountCode, setNewCatAccountCode] = useState("");
  const [catSaving, setCatSaving] = useState(false);

  // Settings: Fund accounts
  const [allFundAccounts, setAllFundAccounts] = useState<FundAccountFull[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountType, setNewAccountType] = useState("bank");
  const [accountSaving, setAccountSaving] = useState(false);

  // Settings: Recurring cashflow
  const [recurringItems, setRecurringItems] = useState<RecurringCashflowItem[]>([]);
  const [recurringLoading, setRecurringLoading] = useState(false);
  const [recurringFormOpen, setRecurringFormOpen] = useState(false);
  const [editingRecurring, setEditingRecurring] = useState<RecurringCashflowItem | null>(null);
  const [rcDirection, setRcDirection] = useState<string>("expense");
  const [rcName, setRcName] = useState("");
  const [rcCategoryId, setRcCategoryId] = useState("");
  const [rcFundAccountId, setRcFundAccountId] = useState("");
  const [rcAmount, setRcAmount] = useState("");
  const [rcDueDay, setRcDueDay] = useState("1");
  const [rcDescription, setRcDescription] = useState("");
  const [rcSaving, setRcSaving] = useState(false);

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

  // ==================== Settings: Load data ====================

  async function loadFundAccounts() {
    setAccountsLoading(true);
    try {
      const accounts = await getFundAccounts();
      setAllFundAccounts(accounts as FundAccountFull[]);
    } catch {
      // silently fail
    } finally {
      setAccountsLoading(false);
    }
  }

  async function loadRecurring() {
    setRecurringLoading(true);
    try {
      const items = await getRecurringCashflows();
      setRecurringItems(items as RecurringCashflowItem[]);
    } catch {
      // silently fail
    } finally {
      setRecurringLoading(false);
    }
  }

  function handleSettingsTabChange(tab: "categories" | "accounts" | "recurring") {
    setSettingsTab(tab);
    if (tab === "accounts") loadFundAccounts();
    if (tab === "recurring") loadRecurring();
  }

  function openSettings() {
    setSettingsOpen(true);
    setSettingsTab("categories");
  }

  // ==================== Settings: Categories ====================

  async function handleCreateCategory() {
    if (!newCatDirection || !newCatGroupName.trim() || !newCatName.trim() || !newCatAccountCode.trim()) {
      alert("請填寫所有欄位");
      return;
    }
    setCatSaving(true);
    try {
      await createCashflowCategory({
        direction: newCatDirection,
        group_name: newCatGroupName.trim(),
        name: newCatName.trim(),
        account_code: newCatAccountCode.trim(),
      });
      setNewCatGroupName("");
      setNewCatName("");
      setNewCatAccountCode("");
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "新增失敗");
    } finally {
      setCatSaving(false);
    }
  }

  async function handleDeleteCategory(id: string) {
    if (!confirm("確定要刪除此分類？")) return;
    try {
      await deleteCashflowCategory(id);
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "刪除失敗");
    }
  }

  // ==================== Settings: Fund Accounts ====================

  async function handleCreateAccount() {
    if (!newAccountName.trim()) {
      alert("請填寫帳戶名稱");
      return;
    }
    setAccountSaving(true);
    try {
      await createFundAccount({
        name: newAccountName.trim(),
        account_type: newAccountType,
      });
      setNewAccountName("");
      router.refresh();
      loadFundAccounts();
    } catch (e) {
      alert(e instanceof Error ? e.message : "新增失敗");
    } finally {
      setAccountSaving(false);
    }
  }

  async function handleToggleAccount(account: FundAccountFull) {
    try {
      await updateFundAccount(account.id, { is_active: !account.is_active });
      router.refresh();
      loadFundAccounts();
    } catch (e) {
      alert(e instanceof Error ? e.message : "操作失敗");
    }
  }

  async function handleDeleteAccount(id: string) {
    if (!confirm("確定要刪除此帳戶？")) return;
    try {
      await deleteFundAccount(id);
      router.refresh();
      loadFundAccounts();
    } catch (e) {
      alert(e instanceof Error ? e.message : "刪除失敗");
    }
  }

  // ==================== Settings: Recurring ====================

  const rcCategories = categories.filter((c) => c.direction === rcDirection);
  const groupedRcCategories = groupCategories(rcCategories);

  function openRecurringForm(item?: RecurringCashflowItem) {
    if (item) {
      setEditingRecurring(item);
      setRcDirection(item.direction);
      setRcName(item.name);
      setRcCategoryId(item.category_id);
      setRcFundAccountId(item.fund_account_id ?? "");
      setRcAmount(item.amount.toString());
      setRcDueDay(item.due_day.toString());
      setRcDescription(item.description ?? "");
    } else {
      setEditingRecurring(null);
      setRcDirection("expense");
      setRcName("");
      setRcCategoryId("");
      setRcFundAccountId("");
      setRcAmount("");
      setRcDueDay("1");
      setRcDescription("");
    }
    setRecurringFormOpen(true);
  }

  async function handleSaveRecurring() {
    const amount = parseFloat(rcAmount);
    const dueDay = parseInt(rcDueDay);
    if (!rcName.trim() || !rcCategoryId || isNaN(amount) || amount <= 0 || isNaN(dueDay) || dueDay < 1 || dueDay > 28) {
      alert("請填寫完整，金額必須為正數，日期 1-28");
      return;
    }

    setRcSaving(true);
    try {
      if (editingRecurring) {
        await updateRecurringCashflow(editingRecurring.id, {
          name: rcName.trim(),
          category_id: rcCategoryId,
          fund_account_id: rcFundAccountId || undefined,
          amount,
          due_day: dueDay,
          description: rcDescription.trim() || undefined,
        });
      } else {
        await createRecurringCashflow({
          direction: rcDirection as "income" | "expense",
          name: rcName.trim(),
          category_id: rcCategoryId,
          fund_account_id: rcFundAccountId || undefined,
          amount,
          due_day: dueDay,
          description: rcDescription.trim() || undefined,
        });
      }
      setRecurringFormOpen(false);
      router.refresh();
      loadRecurring();
    } catch (e) {
      alert(e instanceof Error ? e.message : "儲存失敗");
    } finally {
      setRcSaving(false);
    }
  }

  async function handleToggleRecurring(item: RecurringCashflowItem) {
    try {
      await updateRecurringCashflow(item.id, { is_active: !item.is_active });
      router.refresh();
      loadRecurring();
    } catch (e) {
      alert(e instanceof Error ? e.message : "操作失敗");
    }
  }

  async function handleDeleteRecurring(id: string) {
    if (!confirm("確定要刪除此定期收支？")) return;
    try {
      await deleteRecurringCashflow(id);
      router.refresh();
      loadRecurring();
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
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setSettingsOpen(true); handleSettingsTabChange("recurring"); }}>
            定期收支
          </Button>
          <Button variant="outline" onClick={openSettings}>
            設定
          </Button>
        </div>
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
        <DialogContent aria-describedby={undefined}>
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

      {/* Settings Dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent aria-describedby={undefined} className="max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>收支管理設定</DialogTitle>
          </DialogHeader>

          {/* Settings Tab Buttons */}
          <div className="flex gap-2 border-b pb-3 shrink-0">
            <Button
              variant={settingsTab === "categories" ? "default" : "outline"}
              size="sm"
              onClick={() => handleSettingsTabChange("categories")}
            >
              分類管理
            </Button>
            <Button
              variant={settingsTab === "accounts" ? "default" : "outline"}
              size="sm"
              onClick={() => handleSettingsTabChange("accounts")}
            >
              資金帳戶
            </Button>
            <Button
              variant={settingsTab === "recurring" ? "default" : "outline"}
              size="sm"
              onClick={() => handleSettingsTabChange("recurring")}
            >
              定期收支
            </Button>
          </div>

          {/* ===== Tab: 分類管理 ===== */}
          {settingsTab === "categories" && (
            <div className="flex flex-col min-h-0 flex-1">
              {/* Scrollable category list */}
              <div className="overflow-y-auto flex-1 min-h-0 space-y-6 pr-1">
                {/* 收入分類 */}
                <div>
                  <h3 className="text-lg font-semibold mb-3">收入分類</h3>
                  {(() => {
                    const incomeCats = categories.filter((c) => c.direction === "income");
                    const grouped = groupCategories(incomeCats);
                    if (Object.keys(grouped).length === 0) {
                      return <p className="text-sm text-muted-foreground">尚無收入分類</p>;
                    }
                    return Object.entries(grouped).map(([groupName, cats]) => (
                      <div key={groupName} className="mb-3">
                        <h4 className="text-sm font-medium text-muted-foreground mb-1">{groupName}</h4>
                        <div className="space-y-1">
                          {cats.map((cat) => {
                            const totalCount = cat._count.cashflow_records + cat._count.recurring_cashflows;
                            return (
                              <div key={cat.id} className="flex items-center justify-between py-1 px-3 bg-muted/50 rounded">
                                <div className="flex items-center gap-3">
                                  <span className="font-medium">{cat.name}</span>
                                  <span className="text-xs text-muted-foreground">{cat.account_code}</span>
                                  {totalCount > 0 && (
                                    <span className="text-xs text-muted-foreground">（{totalCount} 筆使用中）</span>
                                  )}
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive"
                                  disabled={totalCount > 0}
                                  onClick={() => handleDeleteCategory(cat.id)}
                                >
                                  刪除
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ));
                  })()}
                </div>

                {/* 支出分類 */}
                <div>
                  <h3 className="text-lg font-semibold mb-3">支出分類</h3>
                  {(() => {
                    const expenseCats = categories.filter((c) => c.direction === "expense");
                    const grouped = groupCategories(expenseCats);
                    if (Object.keys(grouped).length === 0) {
                      return <p className="text-sm text-muted-foreground">尚無支出分類</p>;
                    }
                    return Object.entries(grouped).map(([groupName, cats]) => (
                      <div key={groupName} className="mb-3">
                        <h4 className="text-sm font-medium text-muted-foreground mb-1">{groupName}</h4>
                        <div className="space-y-1">
                          {cats.map((cat) => {
                            const totalCount = cat._count.cashflow_records + cat._count.recurring_cashflows;
                            return (
                              <div key={cat.id} className="flex items-center justify-between py-1 px-3 bg-muted/50 rounded">
                                <div className="flex items-center gap-3">
                                  <span className="font-medium">{cat.name}</span>
                                  <span className="text-xs text-muted-foreground">{cat.account_code}</span>
                                  {totalCount > 0 && (
                                    <span className="text-xs text-muted-foreground">（{totalCount} 筆使用中）</span>
                                  )}
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive"
                                  disabled={totalCount > 0}
                                  onClick={() => handleDeleteCategory(cat.id)}
                                >
                                  刪除
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>

              {/* Add Category Form - fixed at bottom */}
              <div className="border-t pt-4 shrink-0">
                <h4 className="text-sm font-semibold mb-3">新增分類</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
                  <div>
                    <Label className="text-xs">方向</Label>
                    <Select value={newCatDirection} onValueChange={setNewCatDirection}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="income">收入</SelectItem>
                        <SelectItem value="expense">支出</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">群組名稱</Label>
                    <Input
                      value={newCatGroupName}
                      onChange={(e) => setNewCatGroupName(e.target.value)}
                      placeholder="如：營業收入"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">分類名稱</Label>
                    <Input
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      placeholder="如：產品銷售"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">科目代碼</Label>
                    <Input
                      value={newCatAccountCode}
                      onChange={(e) => setNewCatAccountCode(e.target.value)}
                      placeholder="如：4111"
                    />
                  </div>
                  <div>
                    <Button className="w-full" onClick={handleCreateCategory} disabled={catSaving}>
                      {catSaving ? "新增中..." : "新增分類"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ===== Tab: 資金帳戶 ===== */}
          {settingsTab === "accounts" && (
            <div className="flex flex-col min-h-0 flex-1">
              {/* Scrollable account list */}
              <div className="overflow-y-auto flex-1 min-h-0">
                {accountsLoading ? (
                  <p className="text-center text-muted-foreground py-4">載入中...</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>名稱</TableHead>
                        <TableHead>類型</TableHead>
                        <TableHead>狀態</TableHead>
                        <TableHead className="w-[180px]">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allFundAccounts.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground">
                            尚無資金帳戶
                          </TableCell>
                        </TableRow>
                      )}
                      {allFundAccounts.map((account) => {
                        const typeLabels: Record<string, string> = {
                          cash: "現金",
                          bank: "銀行",
                          credit_card: "信用卡",
                          other: "其他",
                        };
                        return (
                          <TableRow key={account.id}>
                            <TableCell className="font-medium">{account.name}</TableCell>
                            <TableCell>{typeLabels[account.account_type] ?? account.account_type}</TableCell>
                            <TableCell>
                              <Badge variant={account.is_active ? "default" : "secondary"}>
                                {account.is_active ? "啟用" : "停用"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleToggleAccount(account)}
                                >
                                  {account.is_active ? "停用" : "啟用"}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive"
                                  disabled={(account._count?.cashflow_records ?? 0) > 0}
                                  onClick={() => handleDeleteAccount(account.id)}
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
                )}
              </div>

              {/* Add Account Form - fixed at bottom */}
              <div className="border-t pt-4 shrink-0">
                <h4 className="text-sm font-semibold mb-3">新增帳戶</h4>
                <div className="flex gap-3 items-end">
                  <div className="flex-1">
                    <Label className="text-xs">帳戶名稱</Label>
                    <Input
                      value={newAccountName}
                      onChange={(e) => setNewAccountName(e.target.value)}
                      placeholder="如：台新銀行"
                    />
                  </div>
                  <div className="w-40">
                    <Label className="text-xs">類型</Label>
                    <Select value={newAccountType} onValueChange={setNewAccountType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">現金</SelectItem>
                        <SelectItem value="bank">銀行</SelectItem>
                        <SelectItem value="credit_card">信用卡</SelectItem>
                        <SelectItem value="other">其他</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Button onClick={handleCreateAccount} disabled={accountSaving}>
                      {accountSaving ? "新增中..." : "新增帳戶"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ===== Tab: 定期收支 ===== */}
          {settingsTab === "recurring" && (
            <div className="flex flex-col min-h-0 flex-1">
              <div className="flex justify-end shrink-0 mb-3">
                <Button size="sm" onClick={() => openRecurringForm()}>
                  新增定期收支
                </Button>
              </div>

              <div className="overflow-y-auto flex-1 min-h-0">
                {recurringLoading ? (
                  <p className="text-center text-muted-foreground py-4">載入中...</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>名稱</TableHead>
                        <TableHead>方向</TableHead>
                        <TableHead>分類</TableHead>
                        <TableHead className="text-right">金額</TableHead>
                        <TableHead>每月幾號</TableHead>
                        <TableHead>狀態</TableHead>
                        <TableHead className="w-[200px]">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recurringItems.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground">
                            尚無定期收支
                          </TableCell>
                        </TableRow>
                      )}
                      {recurringItems.map((item) => {
                        const isIncome = item.direction === "income";
                        return (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.name}</TableCell>
                            <TableCell>
                              <Badge
                                variant={isIncome ? "default" : "secondary"}
                                className={isIncome ? "bg-green-600 hover:bg-green-600" : ""}
                              >
                                {isIncome ? "收入" : "支出"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {item.category.group_name} · {item.category.name}
                            </TableCell>
                            <TableCell className="text-right">
                              {item.amount.toLocaleString()} 元
                            </TableCell>
                            <TableCell>第 {item.due_day} 日</TableCell>
                            <TableCell>
                              <Badge variant={item.is_active ? "default" : "secondary"}>
                                {item.is_active ? "啟用" : "停用"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleToggleRecurring(item)}
                                >
                                  {item.is_active ? "停用" : "啟用"}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openRecurringForm(item)}
                                >
                                  編輯
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive"
                                  onClick={() => handleDeleteRecurring(item.id)}
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
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Recurring Add/Edit Sub-Dialog */}
      <Dialog open={recurringFormOpen} onOpenChange={setRecurringFormOpen}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{editingRecurring ? "編輯定期收支" : "新增定期收支"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>方向</Label>
              <Select
                value={rcDirection}
                onValueChange={(v) => {
                  setRcDirection(v);
                  setRcCategoryId("");
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">收入</SelectItem>
                  <SelectItem value="expense">支出</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>名稱</Label>
              <Input
                value={rcName}
                onChange={(e) => setRcName(e.target.value)}
                placeholder="如：辦公室租金"
              />
            </div>
            <div>
              <Label>分類</Label>
              <Select value={rcCategoryId} onValueChange={setRcCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="選擇分類" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(groupedRcCategories).map(([groupName, cats]) => (
                    <SelectGroup key={groupName}>
                      <SelectLabel>{groupName}</SelectLabel>
                      {cats.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>資金帳戶（選填）</Label>
              <Select
                value={rcFundAccountId || "__none__"}
                onValueChange={(v) => setRcFundAccountId(v === "__none__" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="不指定" />
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
            <div>
              <Label>金額（元）</Label>
              <Input
                type="number"
                value={rcAmount}
                onChange={(e) => setRcAmount(e.target.value)}
                placeholder="金額"
                min="0"
                step="1"
              />
            </div>
            <div>
              <Label>每月幾號（1-28）</Label>
              <Select value={rcDueDay} onValueChange={setRcDueDay}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                    <SelectItem key={d} value={d.toString()}>
                      第 {d} 日
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>備註（選填）</Label>
              <Input
                value={rcDescription}
                onChange={(e) => setRcDescription(e.target.value)}
                placeholder="備註"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecurringFormOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSaveRecurring} disabled={rcSaving}>
              {rcSaving ? "儲存中..." : editingRecurring ? "儲存" : "新增"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
