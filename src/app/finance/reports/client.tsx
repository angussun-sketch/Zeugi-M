"use client";

import { useState } from "react";
import Link from "next/link";
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
  getIncomeStatement,
  getReconciliationSummary,
  getUnmatchedDocuments,
} from "@/actions/finance";

type Tab = "internal_pl" | "tax_pl" | "reconciliation" | "unmatched";

type IncomeStatementData = Awaited<ReturnType<typeof getIncomeStatement>> | null;
type ReconciliationData = Awaited<ReturnType<typeof getReconciliationSummary>> | null;
type UnmatchedData = Awaited<ReturnType<typeof getUnmatchedDocuments>> | null;

const TAX_LABELS: Record<string, string> = {
  deductible: "可列支",
  nondeductible: "不可扣抵",
  exclude_by_policy: "政策排除",
  owner_draw: "私人用途",
};

const MATCH_LABELS: Record<string, string> = {
  fully_matched: "完全匹配",
  partial: "部分匹配",
  unmatched: "未匹配",
};

export function ReportsClient() {
  const now = new Date();
  const [activeTab, setActiveTab] = useState<Tab>("internal_pl");
  const [dateFrom, setDateFrom] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`
  );
  const [dateTo, setDateTo] = useState(now.toISOString().slice(0, 10));
  const [reconcYear, setReconcYear] = useState(now.getFullYear().toString());
  const [reconcMonth, setReconcMonth] = useState(
    (now.getMonth() + 1).toString()
  );

  const [internalPL, setInternalPL] = useState<IncomeStatementData>(null);
  const [taxPL, setTaxPL] = useState<IncomeStatementData>(null);
  const [reconciliation, setReconciliation] = useState<ReconciliationData>(null);
  const [unmatched, setUnmatched] = useState<UnmatchedData>(null);
  const [loading, setLoading] = useState(false);

  async function loadInternalPL() {
    setLoading(true);
    try {
      const data = await getIncomeStatement("internal", dateFrom, dateTo);
      setInternalPL(data);
    } catch (e) {
      alert(e instanceof Error ? e.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }

  async function loadTaxPL() {
    setLoading(true);
    try {
      const data = await getIncomeStatement("tax", dateFrom, dateTo);
      setTaxPL(data);
    } catch (e) {
      alert(e instanceof Error ? e.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }

  async function loadReconciliation() {
    setLoading(true);
    try {
      const data = await getReconciliationSummary(
        parseInt(reconcYear),
        parseInt(reconcMonth)
      );
      setReconciliation(data);
    } catch (e) {
      alert(e instanceof Error ? e.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }

  async function loadUnmatched() {
    setLoading(true);
    try {
      const data = await getUnmatchedDocuments();
      setUnmatched(data);
    } catch (e) {
      alert(e instanceof Error ? e.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }

  function handleLoad() {
    if (activeTab === "internal_pl") loadInternalPL();
    else if (activeTab === "tax_pl") loadTaxPL();
    else if (activeTab === "reconciliation") loadReconciliation();
    else loadUnmatched();
  }

  function renderPL(data: IncomeStatementData, title: string) {
    if (!data) return <p className="text-muted-foreground text-sm">請點擊「產生報表」載入資料</p>;
    return (
      <div className="space-y-4">
        <h3 className="font-bold text-lg">{title}</h3>
        {/* 收入 */}
        <Card>
          <CardHeader><CardTitle className="text-base">收入</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>代碼</TableHead>
                  <TableHead>科目</TableHead>
                  <TableHead className="text-right">金額</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.revenue.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">無收入紀錄</TableCell>
                  </TableRow>
                )}
                {data.revenue.map((r) => (
                  <TableRow key={r.code}>
                    <TableCell className="font-mono">{r.code}</TableCell>
                    <TableCell>{r.name}</TableCell>
                    <TableCell className="text-right font-medium">{r.amount.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-bold border-t-2">
                  <TableCell colSpan={2}>收入合計</TableCell>
                  <TableCell className="text-right">{data.totalRevenue.toLocaleString()}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* 費用 */}
        <Card>
          <CardHeader><CardTitle className="text-base">費用</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>代碼</TableHead>
                  <TableHead>科目</TableHead>
                  <TableHead className="text-right">金額</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.expenses.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">無費用紀錄</TableCell>
                  </TableRow>
                )}
                {data.expenses.map((e) => (
                  <TableRow key={e.code}>
                    <TableCell className="font-mono">{e.code}</TableCell>
                    <TableCell>{e.name}</TableCell>
                    <TableCell className="text-right font-medium">{e.amount.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-bold border-t-2">
                  <TableCell colSpan={2}>費用合計</TableCell>
                  <TableCell className="text-right">{data.totalExpenses.toLocaleString()}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* 損益 */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-center text-lg font-bold">
              <span>淨利（損）</span>
              <span className={data.netIncome >= 0 ? "text-green-600" : "text-red-600"}>
                {data.netIncome.toLocaleString()} 元
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  function renderReconciliation() {
    if (!reconciliation)
      return <p className="text-muted-foreground text-sm">請點擊「產生報表」載入資料</p>;

    return (
      <div className="space-y-4">
        <h3 className="font-bold text-lg">
          內外帳調節表 — {reconcYear} 年 {reconcMonth} 月
        </h3>
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-6 mb-4">
              <div>
                <span className="text-sm text-muted-foreground">調節項數</span>
                <p className="font-bold text-lg">{reconciliation.totalItems}</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">差異總額</span>
                <p className="font-bold text-lg">{reconciliation.totalDifference.toLocaleString()} 元</p>
              </div>
            </div>

            {Object.entries(reconciliation.byReason).map(([reason, group]) => (
              <div key={reason} className="mb-4">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Badge variant="outline">{reason}</Badge>
                  <span className="text-sm text-muted-foreground">
                    {group.count} 筆，差異 {group.totalDifference.toLocaleString()} 元
                  </span>
                </h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>交易摘要</TableHead>
                      <TableHead className="text-right">內帳金額</TableHead>
                      <TableHead className="text-right">外帳金額</TableHead>
                      <TableHead className="text-right">差異</TableHead>
                      <TableHead>說明</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.transaction.description}</TableCell>
                        <TableCell className="text-right">{item.internal_amount.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{item.tax_amount.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-medium text-red-600">
                          {item.difference.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {item.description}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ))}

            {reconciliation.totalItems === 0 && (
              <p className="text-muted-foreground text-center py-4">本月無調節差異</p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  function renderUnmatched() {
    if (!unmatched)
      return <p className="text-muted-foreground text-sm">請點擊「產生報表」載入資料</p>;

    return (
      <div className="space-y-4">
        <h3 className="font-bold text-lg">未匹配清單（{unmatched.length} 筆）</h3>
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>日期</TableHead>
                  <TableHead>摘要</TableHead>
                  <TableHead>對象</TableHead>
                  <TableHead className="text-right">金額</TableHead>
                  <TableHead>匹配</TableHead>
                  <TableHead>稅務</TableHead>
                  <TableHead>狀態</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unmatched.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      無未匹配交易
                    </TableCell>
                  </TableRow>
                )}
                {unmatched.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="text-sm">
                      {new Date(tx.transaction_date).toLocaleDateString("zh-TW")}
                    </TableCell>
                    <TableCell className="font-medium">{tx.description}</TableCell>
                    <TableCell className="text-sm">{tx.counterparty ?? "-"}</TableCell>
                    <TableCell className="text-right font-medium">
                      {tx.amount.toLocaleString()} 元
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-0.5 text-sm">
                        <span className={tx.has_payment ? "text-green-600" : "text-muted-foreground/30"}>P</span>
                        <span className={tx.has_receipt ? "text-green-600" : "text-muted-foreground/30"}>R</span>
                        <span className={tx.has_invoice ? "text-green-600" : "text-muted-foreground/30"}>I</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {TAX_LABELS[tx.tax_treatment] ?? tx.tax_treatment}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={tx.match_status === "partial" ? "secondary" : "destructive"}>
                        {MATCH_LABELS[tx.match_status] ?? tx.match_status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "internal_pl", label: "內帳損益表" },
    { key: "tax_pl", label: "外帳損益表" },
    { key: "reconciliation", label: "調節表" },
    { key: "unmatched", label: "未匹配清單" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/finance">
          <Button variant="ghost" size="sm">← 返回</Button>
        </Link>
        <h2 className="text-2xl font-bold">財務報表</h2>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 篩選條件 */}
      <Card>
        <CardContent className="pt-6">
          {(activeTab === "internal_pl" || activeTab === "tax_pl") && (
            <div className="flex gap-3 items-end">
              <div>
                <Label className="text-xs">日期從</Label>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">日期到</Label>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </div>
              <Button onClick={handleLoad} disabled={loading}>
                {loading ? "載入中..." : "產生報表"}
              </Button>
            </div>
          )}
          {activeTab === "reconciliation" && (
            <div className="flex gap-3 items-end">
              <div>
                <Label className="text-xs">年</Label>
                <Input
                  type="number"
                  value={reconcYear}
                  onChange={(e) => setReconcYear(e.target.value)}
                  className="w-24"
                />
              </div>
              <div>
                <Label className="text-xs">月</Label>
                <Select value={reconcMonth} onValueChange={setReconcMonth}>
                  <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => (
                      <SelectItem key={i + 1} value={(i + 1).toString()}>
                        {i + 1} 月
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleLoad} disabled={loading}>
                {loading ? "載入中..." : "產生報表"}
              </Button>
            </div>
          )}
          {activeTab === "unmatched" && (
            <div>
              <Button onClick={handleLoad} disabled={loading}>
                {loading ? "載入中..." : "載入未匹配清單"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 報表內容 */}
      {activeTab === "internal_pl" && renderPL(internalPL, "內帳損益表（管理帳）")}
      {activeTab === "tax_pl" && renderPL(taxPL, "外帳損益表（稅務帳）")}
      {activeTab === "reconciliation" && renderReconciliation()}
      {activeTab === "unmatched" && renderUnmatched()}
    </div>
  );
}
