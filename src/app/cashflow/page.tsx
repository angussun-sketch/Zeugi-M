export const dynamic = "force-dynamic";

import { getCashflowRecords, getCashflowCategories, getActiveFundAccounts } from "@/actions/cashflow";
import { getActiveEntities } from "@/actions/entities";
import { CashflowClient } from "./client";

export default async function CashflowPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const direction = (params.direction as string) || "";
  const dateFrom = (params.dateFrom as string) || "";
  const dateTo = (params.dateTo as string) || "";
  const categoryId = (params.category as string) || "";
  const source = (params.source as string) || "";

  const [result, categories, fundAccounts, entities] = await Promise.all([
    getCashflowRecords({
      page,
      direction: direction ? (direction as "income" | "expense") : undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      categoryId: categoryId || undefined,
      source: source || undefined,
    }),
    getCashflowCategories(),
    getActiveFundAccounts(),
    getActiveEntities(),
  ]);

  return (
    <CashflowClient
      records={result.records}
      total={result.total}
      page={result.page}
      totalPages={result.totalPages}
      categories={categories}
      fundAccounts={fundAccounts}
      entities={entities}
      filters={{ direction, dateFrom, dateTo, categoryId, source }}
    />
  );
}
