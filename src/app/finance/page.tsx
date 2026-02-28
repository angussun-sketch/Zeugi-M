export const dynamic = "force-dynamic";

import { getTransactions } from "@/actions/finance";
import { getActiveEntities } from "@/actions/entities";
import { FinanceClient } from "./client";

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const dateFrom = (params.dateFrom as string) || "";
  const dateTo = (params.dateTo as string) || "";
  const sourceType = (params.sourceType as string) || "";
  const matchStatus = (params.matchStatus as string) || "";
  const taxTreatment = (params.taxTreatment as string) || "";
  const status = (params.status as string) || "";

  const [result, entities] = await Promise.all([
    getTransactions({
      page,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      sourceType: sourceType || undefined,
      matchStatus: matchStatus || undefined,
      taxTreatment: taxTreatment || undefined,
      status: status || undefined,
    }),
    getActiveEntities(),
  ]);

  return (
    <FinanceClient
      transactions={result.transactions}
      total={result.total}
      page={result.page}
      totalPages={result.totalPages}
      entities={entities}
      filters={{ dateFrom, dateTo, sourceType, matchStatus, taxTreatment, status }}
    />
  );
}
