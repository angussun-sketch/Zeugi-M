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

type Account = {
  id: string;
  code: string;
  name: string;
  type: string;
  parent: { id: string; code: string; name: string } | null;
  _count: { journal_lines: number };
};

type JournalLine = {
  id: string;
  debit: number;
  credit: number;
  description: string | null;
  account: { id: string; code: string; name: string; type: string };
};

type JournalEntry = {
  id: string;
  book_type: string;
  entry_date: Date;
  description: string | null;
  is_posted: boolean;
  lines: JournalLine[];
  transaction: { id: string; description: string; status: string };
};

interface Props {
  entries: JournalEntry[];
  total: number;
  page: number;
  totalPages: number;
  accounts: Account[];
  filters: {
    bookType: string;
    dateFrom: string;
    dateTo: string;
    accountId: string;
  };
}

const BOOK_LABELS: Record<string, string> = {
  internal: "內帳",
  tax: "外帳",
};

export function JournalClient({
  entries,
  total,
  page,
  totalPages,
  accounts,
  filters,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [bookType, setBookType] = useState(filters.bookType);
  const [dateFrom, setDateFrom] = useState(filters.dateFrom);
  const [dateTo, setDateTo] = useState(filters.dateTo);
  const [accountId, setAccountId] = useState(filters.accountId);

  function applyFilters() {
    const params = new URLSearchParams();
    if (bookType) params.set("bookType", bookType);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (accountId) params.set("accountId", accountId);
    router.push(`/finance/journal?${params.toString()}`);
  }

  function clearFilters() {
    setBookType("");
    setDateFrom("");
    setDateTo("");
    setAccountId("");
    router.push("/finance/journal");
  }

  function goToPage(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", p.toString());
    router.push(`/finance/journal?${params.toString()}`);
  }

  // 計算借貸合計
  let totalDebit = 0;
  let totalCredit = 0;
  for (const entry of entries) {
    for (const line of entry.lines) {
      totalDebit += line.debit;
      totalCredit += line.credit;
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/finance">
            <Button variant="ghost" size="sm">← 返回</Button>
          </Link>
          <h2 className="text-2xl font-bold">分錄帳</h2>
        </div>
      </div>

      {/* 篩選 */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
            <div>
              <Label className="text-xs">帳本</Label>
              <Select value={bookType} onValueChange={setBookType}>
                <SelectTrigger><SelectValue placeholder="全部" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="internal">內帳</SelectItem>
                  <SelectItem value="tax">外帳</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">日期從</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">日期到</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">科目</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger><SelectValue placeholder="全部" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.code} {a.name}
                    </SelectItem>
                  ))}
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

      {/* 分錄列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            分錄（共 {total} 筆）
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>日期</TableHead>
                <TableHead>帳本</TableHead>
                <TableHead>摘要</TableHead>
                <TableHead>借方科目</TableHead>
                <TableHead className="text-right">借方金額</TableHead>
                <TableHead>貸方科目</TableHead>
                <TableHead className="text-right">貸方金額</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    尚無分錄
                  </TableCell>
                </TableRow>
              )}
              {entries.map((entry) => {
                const debitLines = entry.lines.filter((l) => l.debit > 0);
                const creditLines = entry.lines.filter((l) => l.credit > 0);
                const maxRows = Math.max(debitLines.length, creditLines.length, 1);

                return Array.from({ length: maxRows }, (_, i) => (
                  <TableRow key={`${entry.id}-${i}`}>
                    {i === 0 && (
                      <>
                        <TableCell rowSpan={maxRows} className="text-sm align-top">
                          {new Date(entry.entry_date).toLocaleDateString("zh-TW")}
                        </TableCell>
                        <TableCell rowSpan={maxRows} className="align-top">
                          <Badge variant={entry.book_type === "internal" ? "default" : "secondary"}>
                            {BOOK_LABELS[entry.book_type] ?? entry.book_type}
                          </Badge>
                        </TableCell>
                        <TableCell rowSpan={maxRows} className="align-top text-sm max-w-[180px] truncate">
                          {entry.description ?? entry.transaction.description}
                        </TableCell>
                      </>
                    )}
                    <TableCell className="text-sm">
                      {debitLines[i] ? `${debitLines[i].account.code} ${debitLines[i].account.name}` : ""}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {debitLines[i]?.debit ? debitLines[i].debit.toLocaleString() : ""}
                    </TableCell>
                    <TableCell className="text-sm">
                      {creditLines[i] ? `${creditLines[i].account.code} ${creditLines[i].account.name}` : ""}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {creditLines[i]?.credit ? creditLines[i].credit.toLocaleString() : ""}
                    </TableCell>
                  </TableRow>
                ));
              })}
              {entries.length > 0 && (
                <TableRow className="font-bold border-t-2">
                  <TableCell colSpan={4} className="text-right">合計</TableCell>
                  <TableCell className="text-right">{totalDebit.toLocaleString()}</TableCell>
                  <TableCell></TableCell>
                  <TableCell className="text-right">{totalCredit.toLocaleString()}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => goToPage(page - 1)}>
                上一頁
              </Button>
              <span className="text-sm text-muted-foreground">第 {page} / {totalPages} 頁</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => goToPage(page + 1)}>
                下一頁
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
