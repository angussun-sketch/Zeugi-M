export const dynamic = "force-dynamic";

import { getBatches } from "@/actions/batches";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function BatchesPage() {
  const batches = await getBatches();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">批次紀錄</h1>
        <Link href="/batches/new">
          <Button>建立批次</Button>
        </Link>
      </div>

      {batches.length === 0 ? (
        <p className="text-muted-foreground">尚無批次紀錄</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {batches.map((batch) => (
            <Link key={batch.id} href={`/batches/${batch.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader>
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>{batch.name}</span>
                    <span className="text-lg font-bold">
                      {batch.total_cost?.toFixed(2) ?? "—"} 元
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {batch.outputs.map((o) => (
                      <Badge key={o.id} variant="secondary">
                        {o.flavor_name}: {o.pieces}顆 @{" "}
                        {o.cost_per_piece?.toFixed(2) ?? "—"}元
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(batch.created_at).toLocaleDateString("zh-TW")} ·{" "}
                    {batch._count.inputs} 項原料
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
