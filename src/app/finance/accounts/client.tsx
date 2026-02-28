"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { createAccount, updateAccount } from "@/actions/finance";

type Account = {
  id: string;
  code: string;
  name: string;
  type: string;
  is_active: boolean;
  parent: { id: string; code: string; name: string } | null;
  _count: { journal_lines: number };
};

interface Props {
  accounts: Account[];
}

const TYPE_LABELS: Record<string, string> = {
  asset: "資產",
  liability: "負債",
  equity: "業主權益",
  revenue: "收入",
  expense: "費用",
};

const TYPE_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  asset: "default",
  liability: "secondary",
  equity: "outline",
  revenue: "default",
  expense: "destructive",
};

export function AccountsClient({ accounts }: Props) {
  const router = useRouter();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [formCode, setFormCode] = useState("");
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState("expense");
  const [saving, setSaving] = useState(false);

  // 按類型分組
  const grouped = accounts.reduce(
    (acc, a) => {
      if (!acc[a.type]) acc[a.type] = [];
      acc[a.type].push(a);
      return acc;
    },
    {} as Record<string, Account[]>
  );

  const typeOrder = ["asset", "liability", "equity", "revenue", "expense"];

  function openCreateDialog() {
    setFormCode("");
    setFormName("");
    setFormType("expense");
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!formCode.trim() || !formName.trim()) {
      alert("請填寫代碼和名稱");
      return;
    }
    setSaving(true);
    try {
      await createAccount({
        code: formCode.trim(),
        name: formName.trim(),
        type: formType,
      });
      setDialogOpen(false);
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "新增失敗");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(account: Account) {
    try {
      await updateAccount(account.id, { is_active: !account.is_active });
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "更新失敗");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/finance">
            <Button variant="ghost" size="sm">← 返回</Button>
          </Link>
          <h2 className="text-2xl font-bold">科目表</h2>
        </div>
        <Button onClick={openCreateDialog}>新增科目</Button>
      </div>

      {typeOrder.map((type) => {
        const items = grouped[type];
        if (!items || items.length === 0) return null;
        return (
          <Card key={type}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Badge variant={TYPE_COLORS[type] ?? "secondary"}>
                  {TYPE_LABELS[type] ?? type}
                </Badge>
                <span>（{items.length} 個科目）</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">代碼</TableHead>
                    <TableHead>科目名稱</TableHead>
                    <TableHead>分錄數</TableHead>
                    <TableHead>狀態</TableHead>
                    <TableHead className="w-[80px]">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((a) => (
                    <TableRow
                      key={a.id}
                      className={!a.is_active ? "opacity-50" : ""}
                    >
                      <TableCell className="font-mono font-medium">
                        {a.code}
                      </TableCell>
                      <TableCell className="font-medium">{a.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {a._count.journal_lines}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={a.is_active ? "default" : "secondary"}
                          className="cursor-pointer"
                          onClick={() => handleToggleActive(a)}
                        >
                          {a.is_active ? "啟用" : "停用"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {a._count.journal_lines === 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() => handleToggleActive(a)}
                          >
                            {a.is_active ? "停用" : "啟用"}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}

      {/* 新增科目 Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增科目</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>科目代碼</Label>
              <Input
                value={formCode}
                onChange={(e) => setFormCode(e.target.value)}
                placeholder="5212"
              />
            </div>
            <div>
              <Label>科目名稱</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="廣告費"
              />
            </div>
            <div>
              <Label>類別</Label>
              <Select value={formType} onValueChange={setFormType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="asset">資產</SelectItem>
                  <SelectItem value="liability">負債</SelectItem>
                  <SelectItem value="equity">業主權益</SelectItem>
                  <SelectItem value="revenue">收入</SelectItem>
                  <SelectItem value="expense">費用</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
