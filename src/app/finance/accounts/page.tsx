export const dynamic = "force-dynamic";

import { getAccounts } from "@/actions/finance";
import { AccountsClient } from "./client";

export default async function AccountsPage() {
  const accounts = await getAccounts();
  return <AccountsClient accounts={accounts} />;
}
