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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  createEntity,
  updateEntity,
  deactivateEntity,
  activateEntity,
} from "@/actions/entities";

type Entity = {
  id: string;
  tax_id: string;
  name: string;
  entity_type: string;
  is_active: boolean;
};

type FormData = {
  tax_id: string;
  name: string;
  entity_type: string;
};

const emptyForm: FormData = {
  tax_id: "",
  name: "",
  entity_type: "sole_proprietorship",
};

const ENTITY_TYPE_LABELS: Record<string, string> = {
  sole_proprietorship: "獨資",
  limited_company: "有限公司",
  corporation: "股份有限公司",
};

export function CompaniesClient({ entities }: { entities: Entity[] }) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
    setDialogOpen(true);
  }

  function openEdit(entity: Entity) {
    setEditingId(entity.id);
    setForm({
      tax_id: entity.tax_id,
      name: entity.name,
      entity_type: entity.entity_type,
    });
    setError(null);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      setError("請輸入公司名稱");
      return;
    }
    if (!/^\d{8}$/.test(form.tax_id)) {
      setError("統一編號必須為 8 碼數字");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await updateEntity(editingId, {
          tax_id: form.tax_id.trim(),
          name: form.name.trim(),
          entity_type: form.entity_type,
        });
      } else {
        await createEntity({
          tax_id: form.tax_id.trim(),
          name: form.name.trim(),
          entity_type: form.entity_type,
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

  async function handleToggleActive(entity: Entity) {
    try {
      if (entity.is_active) {
        await deactivateEntity(entity.id);
      } else {
        await activateEntity(entity.id);
      }
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "操作失敗");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">公司管理</h2>
        <Button onClick={openCreate}>新增公司</Button>
      </div>

      {entities.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            尚未建立任何公司統編
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              公司列表（{entities.length} 家）
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>公司名稱</TableHead>
                  <TableHead>統一編號</TableHead>
                  <TableHead>類型</TableHead>
                  <TableHead>狀態</TableHead>
                  <TableHead className="w-[180px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entities.map((entity) => (
                  <TableRow
                    key={entity.id}
                    className={!entity.is_active ? "opacity-50" : ""}
                  >
                    <TableCell className="font-medium">
                      {entity.name}
                    </TableCell>
                    <TableCell className="font-mono">
                      {entity.tax_id}
                    </TableCell>
                    <TableCell>
                      {ENTITY_TYPE_LABELS[entity.entity_type] ||
                        entity.entity_type}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={entity.is_active ? "default" : "secondary"}
                      >
                        {entity.is_active ? "啟用" : "停用"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEdit(entity)}
                        >
                          編輯
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className={
                            entity.is_active ? "text-destructive" : ""
                          }
                          onClick={() => handleToggleActive(entity)}
                        >
                          {entity.is_active ? "停用" : "啟用"}
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId ? "編輯公司" : "新增公司"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>統一編號 *</Label>
              <Input
                value={form.tax_id}
                onChange={(e) =>
                  setForm({ ...form, tax_id: e.target.value })
                }
                placeholder="8 碼數字"
                maxLength={8}
              />
              {editingId && (
                <p className="text-xs text-amber-600">
                  修改統編不會影響已建立的資料關聯，但請確認新統編正確
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>公司名稱 *</Label>
              <Input
                value={form.name}
                onChange={(e) =>
                  setForm({ ...form, name: e.target.value })
                }
                placeholder="公司全名"
              />
            </div>
            <div className="space-y-2">
              <Label>營業類型</Label>
              <Select
                value={form.entity_type}
                onValueChange={(v) =>
                  setForm({ ...form, entity_type: v })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sole_proprietorship">獨資</SelectItem>
                  <SelectItem value="limited_company">有限公司</SelectItem>
                  <SelectItem value="corporation">股份有限公司</SelectItem>
                </SelectContent>
              </Select>
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
