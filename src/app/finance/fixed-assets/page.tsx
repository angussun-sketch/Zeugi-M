export const dynamic = "force-dynamic";

import { getFixedAssets } from "@/actions/fixed-assets";
import { FixedAssetsClient } from "./client";

export default async function FixedAssetsPage() {
  const assets = await getFixedAssets();
  return <FixedAssetsClient assets={assets} />;
}
