import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default function HomePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">儀表板</h1>
      <div className="grid gap-4 md:grid-cols-3">
        <Link href="/ingredients">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="text-base">原料管理</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                管理原料與採購價格
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/batches/new">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="text-base">建立批次</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                投料計算成本分攤
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/batches">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="text-base">批次紀錄</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                查看歷史批次與成本
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
