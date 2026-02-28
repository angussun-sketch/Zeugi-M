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
        <Link href="/purchase-orders">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="text-base">叫貨單</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                管理叫貨訂單與採購紀錄
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/suppliers">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="text-base">供應商</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                管理供應商與分類
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/batches/new">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="text-base">建立配方</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                新增產品配方與投料計算
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/batches">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="text-base">產品菜單</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                查看配方、成本與生產 SOP
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
