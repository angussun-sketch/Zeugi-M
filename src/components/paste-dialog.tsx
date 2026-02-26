"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { parsePasteText, type ParsedLine } from "@/lib/parse-paste";

interface PasteDialogProps {
  onConfirm: (parsed: ParsedLine[]) => void;
}

export function PasteDialog({ onConfirm }: PasteDialogProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [result, setResult] = useState<{
    parsed: ParsedLine[];
    errors: string[];
  } | null>(null);

  function handleParse() {
    const r = parsePasteText(text);
    setResult(r);
  }

  function handleConfirm() {
    if (result && result.parsed.length > 0) {
      onConfirm(result.parsed);
      setOpen(false);
      setText("");
      setResult(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">快速貼上</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>快速貼上原料</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            每行一項，格式：名稱 數量單位
            <br />
            例如：乾蘿蔔絲 90台斤
          </p>
          <Textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setResult(null);
            }}
            placeholder={`乾蘿蔔絲 90台斤\n胡椒粉 2250g\n醬油 14000cc`}
            rows={6}
          />
          <Button onClick={handleParse} variant="secondary" className="w-full">
            解析
          </Button>

          {result && (
            <div className="space-y-2">
              {result.parsed.length > 0 && (
                <div className="rounded border p-3 space-y-1">
                  <p className="text-sm font-medium">
                    成功解析 {result.parsed.length} 項：
                  </p>
                  {result.parsed.map((p, i) => (
                    <p key={i} className="text-sm">
                      {p.name} — {p.qty}
                      {p.unit} → {p.qty_base.toLocaleString()}{" "}
                      {p.measure_type === "weight" ? "g" : "cc"}
                    </p>
                  ))}
                </div>
              )}
              {result.errors.length > 0 && (
                <div className="rounded border border-destructive p-3 space-y-1">
                  <p className="text-sm font-medium text-destructive">
                    無法解析：
                  </p>
                  {result.errors.map((e, i) => (
                    <p key={i} className="text-sm text-destructive">
                      {e}
                    </p>
                  ))}
                </div>
              )}
              <Button
                onClick={handleConfirm}
                disabled={result.parsed.length === 0}
                className="w-full"
              >
                確認帶入
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
