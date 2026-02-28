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
import {
  createFixedAsset,
  deleteFixedAsset,
  disposeFixedAsset,
  generateMonthlyDepreciation,
} from "@/actions/fixed-assets";

type FixedAsset = {
  id: string;
  name: string;
  category: string;
  acquisition_date: Date;
  cost: number;
  residual_value: number;
  useful_life_months: number;
  monthly_depreciation: number;
  accumulated_depreciation: number;
  net_book_value: number;
  is_active: boolean;
  is_fully_depreciated: boolean;
  description: string | null;
  payment_method: string;
  _count: { depreciation_records: number };
};

interface Props {
  assets: FixedAsset[];
}

const CATEGORY_LABELS: Record<string, string> = {
  equipment: "設備",
  vehicle: "車輛",
  building: "裝潢",
  other: "其他",
};

const PAYMENT_LABELS: Record<string, string> = {
  cash: "現金",
  bank: "銀行轉帳",
  credit_card: "信用卡",
  owner_advance: "業主代墊",
};

function getStatusBadge(asset: FixedAsset) {
  if (!asset.is_active)
    return <Badge variant="destructive">已處分</Badge>;
  if (asset.is_fully_depreciated)
    return <Badge variant="secondary">已提完</Badge>;
  return <Badge variant="default">使用中</Badge>;
}

export function FixedAssetsClient({ assets }: Props) {
  const router = useRouter();

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState("equipment");
  const [formDate, setFormDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [formCost, setFormCost] = useState("");
  const [formResidual, setFormResidual] = useState("0");
  const [formYears, setFormYears] = useState("5");
  const [formPayment, setFormPayment] = useState("cash");
  const [formDescription, setFormDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [depreciating, setDepreciating] = useState(false);

  // 統計
  const totalCost = assets.reduce((s, a) => s + a.cost, 0);
  const totalAccum = assets.reduce((s, a) => s + a.accumulated_depreciation, 0);
  const totalNet = assets.reduce((s, a) => s + a.net_book_value, 0);
  const activeCount = assets.filter((a) => a.is_active && !a.is_fully_depreciated).length;

  function openCreateDialog() {
    setFormName("");
    setFormCategory("equipment");
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormCost("");
    setFormResidual("0");
    setFormYears("5");
    setFormPayment("cash");
    setFormDescription("");
    setDialogOpen(true);
  }

  async function handleSave() {
    const cost = parseFloat(formCost);
    const residual = parseFloat(formResidual);
    const years = parseFloat(formYears);

    if (!formName.trim() || isNaN(cost) || cost <= 0) {
      alert("請填寫名稱且成本必須為正數");
      return;
    }
    if (isNaN(years) || years <= 0) {
      alert("耐用年限必須為正數");
      return;
    }
    if (residual < 0 || residual >= cost) {
      alert("殘值不能為負數或大於成本");
      return;
    }

    setSaving(true);
    try {
      await createFixedAsset({
        name: formName.trim(),
        category: formCategory,
        acquisition_date: formDate,
        cost,
        residual_value: residual,
        useful_life_years: years,
        payment_method: formPayment,
        description: formDescription || undefined,
      });
      setDialogOpen(false);
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "新增失敗");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(asset: FixedAsset) {
    if (!confirm(`確定要刪除「${asset.name}」？`)) return;
    try {
      await deleteFixedAsset(asset.id);
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "刪除失敗");
    }
  }

  async function handleDispose(asset: FixedAsset) {
    if (!confirm(`確定要處分「${asset.name}」？處分後將不再提折舊。`)) return;
    try {
      await disposeFixedAsset(asset.id);
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "處分失敗");
    }
  }

  async function handleRunDepreciation() {
    if (!confirm("確定要手動執行本月折舊？")) return;
    setDepreciating(true);
    try {
      const result = await generateMonthlyDepreciation();
      const created = result.processed.filter((r) => r.created).length;
      const skipped = result.processed.filter((r) => !r.created).length;
      alert(`折舊完成：${created} 筆產生，${skipped} 筆略過`);
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "折舊執行失敗");
    } finally {
      setDepreciating(false);
    }
  }

  // 預覽月折舊額
  const previewCost = parseFloat(formCost) || 0;
  const previewResidual = parseFloat(formResidual) || 0;
  const previewYears = parseFloat(formYears) || 0;
  const previewMonthly =
    previewYears > 0 && previewCost > previewResidual
      ? Math.round(
          ((previewCost - previewResidual) / (previewYears * 12)) * 100
        ) / 100
      : 0;

  return (
    <div className="space-y-6">
      {/* 標題列 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/finance">
            <Button variant="ghost" size="sm">
              ← 返回
            </Button>
          </Link>
          <h2 className="text-2xl font-bold">固定資產</h2>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRunDepreciation}
            disabled={depreciating}
          >
            {depreciating ? "執行中..." : "手動執行本月折舊"}
          </Button>
          <Button onClick={openCreateDialog}>新增資產</Button>
        </div>
      </div>

      {/* 統計卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">資產總數</div>
            <div className="text-2xl font-bold">{assets.length}</div>
            <div className="text-xs text-muted-foreground">
              使用中 {activeCount}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">取得成本合計</div>
            <div className="text-2xl font-bold">
              {totalCost.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">已提折舊合計</div>
            <div className="text-2xl font-bold">
              {totalAccum.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">帳面淨值合計</div>
            <div className="text-2xl font-bold">
              {totalNet.toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 資產列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            固定資產列表（{assets.length} 項）
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名稱</TableHead>
                <TableHead>分類</TableHead>
                <TableHead>取得日期</TableHead>
                <TableHead className="text-right">取得成本</TableHead>
                <TableHead className="text-right">已提折舊</TableHead>
                <TableHead className="text-right">帳面淨值</TableHead>
                <TableHead className="text-right">每月折舊</TableHead>
                <TableHead>狀態</TableHead>
                <TableHead className="w-[140px]">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assets.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="text-center text-muted-foreground"
                  >
                    尚無固定資產
                  </TableCell>
                </TableRow>
              )}
              {assets.map((asset) => (
                <TableRow
                  key={asset.id}
                  className={!asset.is_active ? "opacity-50" : ""}
                >
                  <TableCell className="font-medium">{asset.name}</TableCell>
                  <TableCell>
                    {CATEGORY_LABELS[asset.category] ?? asset.category}
                  </TableCell>
                  <TableCell className="text-sm">
                    {new Date(asset.acquisition_date).toLocaleDateString(
                      "zh-TW"
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {asset.cost.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {asset.accumulated_depreciation.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {asset.net_book_value.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {asset.monthly_depreciation.toLocaleString()}
                  </TableCell>
                  <TableCell>{getStatusBadge(asset)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {asset.is_active && !asset.is_fully_depreciated && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDispose(asset)}
                        >
                          處分
                        </Button>
                      )}
                      {asset._count.depreciation_records === 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => handleDelete(asset)}
                        >
                          刪除
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 說明 */}
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            系統使用直線法計算折舊：每月折舊額 = (取得成本 - 殘值) ÷
            耐用月數。每月 1 號由排程自動產生折舊分錄（借：折舊費用 /
            貸：累計折舊），也可手動執行。
          </p>
        </CardContent>
      </Card>

      {/* 新增 Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>新增固定資產</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>資產名稱</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="商用烤箱"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>分類</Label>
                <Select value={formCategory} onValueChange={setFormCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="equipment">設備</SelectItem>
                    <SelectItem value="vehicle">車輛</SelectItem>
                    <SelectItem value="building">裝潢</SelectItem>
                    <SelectItem value="other">其他</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>取得日期</Label>
                <Input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>取得成本（元）</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={formCost}
                  onChange={(e) => setFormCost(e.target.value)}
                  placeholder="60000"
                />
              </div>
              <div>
                <Label>殘值（元）</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={formResidual}
                  onChange={(e) => setFormResidual(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>耐用年限（年）</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={formYears}
                  onChange={(e) => setFormYears(e.target.value)}
                  placeholder="5"
                />
              </div>
              <div>
                <Label>付款方式</Label>
                <Select value={formPayment} onValueChange={setFormPayment}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">現金</SelectItem>
                    <SelectItem value="bank">銀行轉帳</SelectItem>
                    <SelectItem value="credit_card">信用卡</SelectItem>
                    <SelectItem value="owner_advance">業主代墊</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>說明（選填）</Label>
              <Input
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="備註"
              />
            </div>
            {previewMonthly > 0 && (
              <div className="bg-muted rounded-md p-3 text-sm">
                <p>
                  每月折舊額：
                  <span className="font-bold">
                    {previewMonthly.toLocaleString()} 元
                  </span>
                </p>
                <p className="text-muted-foreground">
                  共 {Math.round(previewYears * 12)} 個月，總折舊{" "}
                  {(previewCost - previewResidual).toLocaleString()} 元
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
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
