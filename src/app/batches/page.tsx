export const dynamic = "force-dynamic";

import { getBatchesWithLiveCost } from "@/actions/batches";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function BatchesPage() {
  const batches = await getBatchesWithLiveCost();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">產品菜單</h1>
        <Link href="/batches/new">
          <Button>建立配方</Button>
        </Link>
      </div>

      {batches.length === 0 ? (
        <p className="text-muted-foreground">尚無配方，點擊「建立配方」開始</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {batches.map((batch) => (
            <Link key={batch.id} href={`/batches/${batch.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{batch.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {batch.outputs.map((o) => (
                    <div key={o.id} className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        {o.flavor_name}（{o.pieces}顆）
                      </span>
                      <span className="text-xl font-bold">
                        {o.liveCostPerPiece.toFixed(2)} 元/顆
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between text-xs text-muted-foreground pt-1 border-t">
                    <span>{batch._count.inputs} 項原料</span>
                    <span>總成本 {batch.liveTotalCost.toFixed(2)} 元</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
