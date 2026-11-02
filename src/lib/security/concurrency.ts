import { admin } from "../supabase/server";
import { ApiError } from "./http";
export async function withScanSlot<T>(work: () => Promise<T>): Promise<T> {
  const client = admin();
  const claim = await client.rpc("acquire_scan_slot");
  if (claim.error) throw new ApiError("SERVICE_UNAVAILABLE", 503);
  if (!claim.data) throw new ApiError("SCAN_CAPACITY_REACHED", 429);
  try {
    return await work();
  } finally {
    await client.from("scan_leases").delete().eq("id", claim.data);
  }
}
