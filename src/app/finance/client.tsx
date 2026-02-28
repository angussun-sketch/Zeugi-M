"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createTransaction,
  deleteTransaction,
  postTransaction,
  voidTransaction,
} from "@/actions/finance";
import { EntityCombobox } from "@/components/entity-combobox";

type Transaction = {
  id: string;
  transaction_date: Date;
  amount: number;
  description: string;
  source_type: string;
  source_id: string | null;
  counterparty: string | null;
  payment_method: string;
  has_payment: boolean;
  has_receipt: boolean;
  has_invoice: boolean;
  match_status: string;
  tax_treatment: string;
  tax_mode: string;
  status: string;
};

type EntityOption = {
  id: string;
  name: string;
  tax_id: string;
};

interface Props {
  transactions: Transaction[];
  total: number;
  page: number;
  totalPages: number;
  entities: EntityOption[];
  filters: {
    dateFrom: string;
    dateTo: string;
    sourceType: string;
    matchStatus: string;
    taxTreatment: string;
    status: string;
  };
}

const SOURCE_LABELS: Record<string, string> = {
  purchase_order: "叫貨單",
  expense: "支出",
  salary: "薪資",
  manual: "手動",
};

const PAYMENT_LABELS: Record<string, string> = {
  cash: "現金",
  bank: "銀行轉帳",
  credit_card: "信用卡",
  owner_advance: "業主代墊",
};

const TAX_LABELS: Record<string, string> = {
  deductible: "可列支",
  nondeductible: "不可扣抵",
  exclude_by_policy: "政策排除",
  owner_draw: "私人用途",
};

const TAX_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  deductible: "default",
  nondeductible: "secondary",
  exclude_by_policy: "destructive",
  owner_draw: "outline",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "草稿",
  posted: "已過帳",
  voided: "已作廢",
};

export function FinanceClient({
  transactions,
  total,
  page,
  totalPages,
  entities,
  filters,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // 篩選
  const [dateFrom, setDateFrom] = useState(filters.dateFrom);
  const [dateTo, setDateTo] = useState(filters.dateTo);
  const [sourceType, setSourceType] = useState(filters.sourceType);
  const [matchStatus, setMatchStatus] = useState(filters.matchStatus);
  const [taxTreatment, setTaxTreatment] = useState(filters.taxTreatment);
  const [statusFilter, setStatusFilter] = useState(filters.status);

  // 新增 Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formEntityId, setFormEntityId] = useState(entities[0]?.id ?? "");
  const [formDate, setFormDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [formAmount, setFormAmount] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCounterparty, setFormCounterparty] = useState("");
  const [formPaymentMethod, setFormPaymentMethod] = useState("cash");
  const [formTaxTreatment, setFormTaxTreatment] = useState("deductible");
  const [formTaxMode, setFormTaxMode] = useState("mode1");
  const [formHasPayment, setFormHasPayment] = useState(true);
  const [formHasReceipt, setFormHasReceipt] = useState(false);
  const [formHasInvoice, setFormHasInvoice] = useState(false);
  const [formInvoiceType, setFormInvoiceType] = useState("");
  const [formInvoiceNumber, setFormInvoiceNumber] = useState("");
  const [formTaxAmount, setFormTaxAmount] = useState("");
  const [formExpenseCategory, setFormExpenseCategory] = useState("");
  const [saving, setSaving] = useState(false);

  function applyFilters() {
    const params = new URLSearchParams();
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (sourceType) params.set("sourceType", sourceType);
    if (matchStatus) params.set("matchStatus", matchStatus);
    if (taxTreatment) params.set("taxTreatment", taxTreatment);
    if (statusFilter) params.set("status", statusFilter);
    router.push(`/finance?${params.toString()}`);
  }

  function clearFilters() {
    setDateFrom("");
    setDateTo("");
    setSourceType("");
    setMatchStatus("");
    setTaxTreatment("");
    setStatusFilter("");
    router.push("/finance");
  }

  function goToPage(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", p.toString());
    router.push(`/finance?${params.toString()}`);
  }

  function openCreateDialog() {
    setFormEntityId(entities[0]?.id ?? "");
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormAmount("");
    setFormDescription("");
    setFormCounterparty("");
    setFormPaymentMethod("cash");
    setFormTaxTreatment("deductible");
    setFormTaxMode("mode1");
    setFormHasPayment(true);
    setFormHasReceipt(false);
    setFormHasInvoice(false);
    setFormInvoiceType("");
    setFormInvoiceNumber("");
    setFormTaxAmount("");
    setFormExpenseCategory("");
    setDialogOpen(true);
  }

  async function handleSave() {
    const amount = parseFloat(formAmount);
    if (!formDescription.trim() || isNaN(amount) || amount <= 0) {
      alert("請填寫摘要且金額必須為正數");
      return;
    }

    setSaving(true);
    try {
      const taxAmt = formTaxAmount ? parseFloat(formTaxAmount) : undefined;
      await createTransaction({
        transaction_date: formDate,
        amount,
        description: formDescription.trim(),
        source_type: "manual",
        entity_id: formEntityId || undefined,
        counterparty: formCounterparty || undefined,
        payment_method: formPaymentMethod,
        has_payment: formHasPayment,
        has_receipt: formHasReceipt,
        has_invoice: formHasInvoice,
        tax_treatment: formTaxTreatment,
        tax_mode: formTaxMode,
        invoice_type: formInvoiceType || undefined,
        invoice_number: formInvoiceNumber || undefined,
        tax_amount: taxAmt,
        net_amount: taxAmt ? amount - taxAmt : undefined,
        expense_category_name: formExpenseCategory || undefined,
      });
      setDialogOpen(false);
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "儲存失敗");
    } finally {
      setSaving(false);
    }
  }

  async function handlePost(id: string) {
    try {
      await postTransaction(id);
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "過帳失敗");
    }
  }

  async function handleVoid(id: string) {
    if (!confirm("確定要作廢此交易？分錄將被刪除。")) return;
    try {
      await voidTransaction(id);
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "作廢失敗");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("確定要刪除此交易？")) return;
    try {
      await deleteTransaction(id);
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "刪除失敗");
    }
  }

  return (
    <div className="space-y-6">
      {/* 標題列 */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">財務管理</h2>
        <div className="flex gap-2">
          <Link href="/finance/accounts">
            <Button variant="outline" size="sm">科目表</Button>
          </Link>
          <Link href="/finance/journal">
            <Button variant="outline" size="sm">分錄帳</Button>
          </Link>
          <Link href="/finance/reports">
            <Button variant="outline" size="sm">報表</Button>
          </Link>
          <Link href="/finance/fixed-assets">
            <Button variant="outline" size="sm">固定資產</Button>
          </Link>
          <Button onClick={openCreateDialog}>新增交易</Button>
        </div>
      </div>

      {/* 篩選 */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 items-end">
            <div>
              <Label className="text-xs">日期從</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">日期到</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">來源</Label>
              <Select value={sourceType} onValueChange={setSourceType}>
                <SelectTrigger><SelectValue placeholder="全部" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="purchase_order">叫貨單</SelectItem>
                  <SelectItem value="expense">支出</SelectItem>
                  <SelectItem value="salary">薪資</SelectItem>
                  <SelectItem value="manual">手動</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">匹配狀態</Label>
              <Select value={matchStatus} onValueChange={setMatchStatus}>
                <SelectTrigger><SelectValue placeholder="全部" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="fully_matched">完全匹配</SelectItem>
                  <SelectItem value="partial">部分匹配</SelectItem>
                  <SelectItem value="unmatched">未匹配</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">稅務處理</Label>
              <Select value={taxTreatment} onValueChange={setTaxTreatment}>
                <SelectTrigger><SelectValue placeholder="全部" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="deductible">可列支</SelectItem>
                  <SelectItem value="nondeductible">不可扣抵</SelectItem>
                  <SelectItem value="exclude_by_policy">政策排除</SelectItem>
                  <SelectItem value="owner_draw">私人用途</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">狀態</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger><SelectValue placeholder="全部" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="draft">草稿</SelectItem>
                  <SelectItem value="posted">已過帳</SelectItem>
                  <SelectItem value="voided">已作廢</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-1">
              <Button size="sm" onClick={applyFilters}>查詢</Button>
              <Button size="sm" variant="ghost" onClick={clearFilters}>清除</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 交易列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            交易紀錄（共 {total} 筆）
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>日期</TableHead>
                <TableHead>摘要</TableHead>
                <TableHead>對象</TableHead>
                <TableHead className="text-right">金額</TableHead>
                <TableHead>付款</TableHead>
                <TableHead>匹配</TableHead>
                <TableHead>稅務</TableHead>
                <TableHead>狀態</TableHead>
                <TableHead className="w-[180px]">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground">
                    尚無交易紀錄
                  </TableCell>
                </TableRow>
              )}
              {transactions.map((tx) => (
                <TableRow
                  key={tx.id}
                  className={tx.status === "voided" ? "opacity-50" : ""}
                >
                  <TableCell className="text-sm">
                    {new Date(tx.transaction_date).toLocaleDateString("zh-TW")}
                  </TableCell>
                  <TableCell className="font-medium max-w-[200px] truncate">
                    {tx.description}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {tx.counterparty ?? "-"}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {tx.amount.toLocaleString()} 元
                  </TableCell>
                  <TableCell className="text-xs">
                    {PAYMENT_LABELS[tx.payment_method] ?? tx.payment_method}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-0.5">
                      <span title="付款" className={tx.has_payment ? "text-green-600" : "text-muted-foreground/30"}>P</span>
                      <span title="收貨" className={tx.has_receipt ? "text-green-600" : "text-muted-foreground/30"}>R</span>
                      <span title="發票" className={tx.has_invoice ? "text-green-600" : "text-muted-foreground/30"}>I</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={TAX_COLORS[tx.tax_treatment] ?? "secondary"}>
                      {TAX_LABELS[tx.tax_treatment] ?? tx.tax_treatment}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={tx.status === "posted" ? "default" : tx.status === "voided" ? "destructive" : "outline"}>
                      {STATUS_LABELS[tx.status] ?? tx.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {tx.status === "draft" && (
                        <Button variant="outline" size="sm" onClick={() => handlePost(tx.id)}>
                          過帳
                        </Button>
                      )}
                      {tx.status === "draft" && (
                        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleVoid(tx.id)}>
                          作廢
                        </Button>
                      )}
                      {tx.status === "draft" && (
                        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(tx.id)}>
                          刪除
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* 分頁 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => goToPage(page - 1)}
              >
                上一頁
              </Button>
              <span className="text-sm text-muted-foreground">
                第 {page} / {totalPages} 頁
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => goToPage(page + 1)}
              >
                下一頁
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 新增交易 Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>新增交易</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            {entities.length > 1 && (
              <div className="col-span-2">
                <Label>歸屬公司</Label>
                <EntityCombobox
                  entities={entities}
                  value={formEntityId}
                  onChange={setFormEntityId}
                />
              </div>
            )}
            <div>
              <Label>交易日期</Label>
              <Input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} />
            </div>
            <div>
              <Label>金額（元）</Label>
              <Input type="text" inputMode="decimal" value={formAmount} onChange={(e) => setFormAmount(e.target.value)} placeholder="1000" />
            </div>
            <div className="col-span-2">
              <Label>摘要</Label>
              <Input value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="信用卡加油" />
            </div>
            <div>
              <Label>對象</Label>
              <Input value={formCounterparty} onChange={(e) => setFormCounterparty(e.target.value)} placeholder="中油" />
            </div>
            <div>
              <Label>費用分類名稱</Label>
              <Input value={formExpenseCategory} onChange={(e) => setFormExpenseCategory(e.target.value)} placeholder="油料費" />
            </div>
            <div>
              <Label>付款方式</Label>
              <Select value={formPaymentMethod} onValueChange={setFormPaymentMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">現金</SelectItem>
                  <SelectItem value="bank">銀行轉帳</SelectItem>
                  <SelectItem value="credit_card">信用卡</SelectItem>
                  <SelectItem value="owner_advance">業主代墊</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>稅務處理</Label>
              <Select value={formTaxTreatment} onValueChange={setFormTaxTreatment}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="deductible">可列支</SelectItem>
                  <SelectItem value="nondeductible">不可扣抵</SelectItem>
                  <SelectItem value="exclude_by_policy">政策排除</SelectItem>
                  <SelectItem value="owner_draw">私人用途</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(formTaxTreatment === "nondeductible" || formTaxTreatment === "exclude_by_policy") && (
              <div>
                <Label>外帳模式</Label>
                <Select value={formTaxMode} onValueChange={setFormTaxMode}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mode1">Mode1（外帳不入）</SelectItem>
                    <SelectItem value="mode2">Mode2（入帳標記加回）</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="col-span-2 flex gap-6">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={formHasPayment} onChange={(e) => setFormHasPayment(e.target.checked)} />
                已付款 (P)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={formHasReceipt} onChange={(e) => setFormHasReceipt(e.target.checked)} />
                已收貨 (R)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={formHasInvoice} onChange={(e) => setFormHasInvoice(e.target.checked)} />
                有發票 (I)
              </label>
            </div>
            {formHasInvoice && (
              <>
                <div>
                  <Label>發票類型</Label>
                  <Select value={formInvoiceType} onValueChange={setFormInvoiceType}>
                    <SelectTrigger><SelectValue placeholder="選擇" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="二聯式">二聯式</SelectItem>
                      <SelectItem value="三聯式">三聯式</SelectItem>
                      <SelectItem value="收據">收據</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>發票號碼</Label>
                  <Input value={formInvoiceNumber} onChange={(e) => setFormInvoiceNumber(e.target.value)} placeholder="AA-12345678" />
                </div>
                <div>
                  <Label>稅額</Label>
                  <Input type="text" inputMode="decimal" value={formTaxAmount} onChange={(e) => setFormTaxAmount(e.target.value)} placeholder="48" />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "儲存中..." : "儲存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
