export const dynamic = "force-dynamic";

import { getEntities } from "@/actions/entities";
import { CompaniesClient } from "./client";

export default async function CompaniesPage() {
  const entities = await getEntities();
  return <CompaniesClient entities={entities} />;
}
