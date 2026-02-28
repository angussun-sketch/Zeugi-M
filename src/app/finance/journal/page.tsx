export const dynamic = "force-dynamic";

import { getJournalEntries, getAccounts } from "@/actions/finance";
import { JournalClient } from "./client";

export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const bookType = (params.bookType as string) || "";
  const dateFrom = (params.dateFrom as string) || "";
  const dateTo = (params.dateTo as string) || "";
  const accountId = (params.accountId as string) || "";

  const [result, accounts] = await Promise.all([
    getJournalEntries({
      page,
      bookType: bookType || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      accountId: accountId || undefined,
    }),
    getAccounts(),
  ]);

  return (
    <JournalClient
      entries={result.entries}
      total={result.total}
      page={result.page}
      totalPages={result.totalPages}
      accounts={accounts}
      filters={{ bookType, dateFrom, dateTo, accountId }}
    />
  );
}
