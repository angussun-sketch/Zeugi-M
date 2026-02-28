"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "儀表板" },
  { href: "/ingredients", label: "原料管理" },
  { href: "/purchase-orders", label: "叫貨單" },
  { href: "/suppliers", label: "供應商" },
  { href: "/companies", label: "公司管理" },
  { href: "/batches", label: "產品菜單" },
  { href: "/cashflow", label: "收支管理" },
  { href: "/finance", label: "財務管理" },
  { href: "/employees", label: "人事管理" },
  { href: "/trends", label: "趨勢分析" },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 border-r bg-muted/40 p-4">
      <div className="mb-6">
        <h1 className="text-lg font-bold">Zeugi-M</h1>
        <p className="text-xs text-muted-foreground">食品成本計算器</p>
      </div>
      <nav className="space-y-1">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "block rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
