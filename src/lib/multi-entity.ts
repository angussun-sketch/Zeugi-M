import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

const COOKIE_ORG = "zeugi_org_id";
const COOKIE_ENTITY = "zeugi_entity_id";

/**
 * @pre  必須在 Server Action 或 Route Handler 內呼叫（需要 cookie context）
 * @post 回傳 { orgId, entityId }，若 cookie 為空則自動設定第一個啟用 Entity
 * @fails 若 DB 完全無 Entity，拋 findFirstOrThrow 例外
 * @invariant 同一 request 內多次呼叫回傳相同值（cookie 在 request 內不變）
 * @see docs/adr/001-multi-entity-architecture.md
 */
export async function getCurrentEntity() {
  const cookieStore = await cookies();
  let orgId = cookieStore.get(COOKIE_ORG)?.value ?? null;
  let entityId = cookieStore.get(COOKIE_ENTITY)?.value ?? null;

  if (!orgId || !entityId) {
    // 優先取啟用中的 Entity，若無則取任意 Entity
    const entity =
      (await prisma.entity.findFirst({
        where: { is_active: true },
        orderBy: { created_at: "asc" },
      })) ??
      (await prisma.entity.findFirstOrThrow());
    orgId = entity.org_id;
    entityId = entity.id;
    cookieStore.set(COOKIE_ORG, orgId, { httpOnly: true, sameSite: "lax" });
    cookieStore.set(COOKIE_ENTITY, entityId, {
      httpOnly: true,
      sameSite: "lax",
    });
  }
  return { orgId, entityId };
}

export async function setCurrentEntity(orgId: string, entityId: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_ORG, orgId, { httpOnly: true, sameSite: "lax" });
  cookieStore.set(COOKIE_ENTITY, entityId, {
    httpOnly: true,
    sameSite: "lax",
  });
}

/**
 * 驗證 Org-level 資源的所有權（Ingredient, Supplier, Account 等）。
 * @pre  id 對應的記錄必須存在
 * @post 無副作用；通過驗證則靜默返回
 * @fails 記錄不存在 → "記錄不存在"；org_id 不匹配 → "無權限操作此記錄"
 * @invariant 任何 update/delete 前必須呼叫，防止跨組織資料竄改
 */
export async function assertOrgOwns(
  model: "ingredient" | "supplier" | "account" | "fundAccount" | "cashflowCategory",
  id: string,
) {
  const { orgId } = await getCurrentEntity();
  const record = await (prisma[model] as any).findUnique({
    where: { id },
    select: { org_id: true },
  });
  if (!record) throw new Error("記錄不存在");
  if (record.org_id !== orgId) throw new Error("無權限操作此記錄");
}

/**
 * 驗證 Entity-level 資源的所有權（透過 entity.org_id 間接驗證）。
 * @pre  id 對應的記錄必須存在且有 entity 關聯
 * @post 無副作用；通過驗證則靜默返回
 * @fails 記錄不存在 → "記錄不存在"；org_id 不匹配 → "無權限操作此記錄"
 * @invariant 任何 entity-scoped update/delete 前必須呼叫
 * @note "entity" model 特殊處理：直接檢查 Entity.org_id（無嵌套 entity 關聯）
 */
export async function assertEntityOwns(
  model: "purchaseOrder" | "batch" | "fixedAsset" | "cashflowRecord" | "recurringCashflow" | "transaction" | "entity",
  id: string,
) {
  const { orgId } = await getCurrentEntity();
  if (model === "entity") {
    const record = await prisma.entity.findUnique({
      where: { id },
      select: { org_id: true },
    });
    if (!record) throw new Error("記錄不存在");
    if (record.org_id !== orgId) throw new Error("無權限操作此記錄");
    return;
  }
  const record = await (prisma[model] as any).findUnique({
    where: { id },
    select: { entity_id: true, entity: { select: { org_id: true } } },
  });
  if (!record) throw new Error("記錄不存在");
  if (record.entity.org_id !== orgId) throw new Error("無權限操作此記錄");
}
