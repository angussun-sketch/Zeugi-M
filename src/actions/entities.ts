"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getCurrentEntity, assertEntityOwns } from "@/lib/multi-entity";

// 取得所有統編（含停用）
export async function getEntities() {
  const { orgId } = await getCurrentEntity();
  return prisma.entity.findMany({
    where: { org_id: orgId },
    orderBy: [{ is_active: "desc" }, { name: "asc" }],
  });
}

// 取得啟用中的統編（給選擇器用）
export async function getActiveEntities() {
  const { orgId } = await getCurrentEntity();
  return prisma.entity.findMany({
    where: { org_id: orgId, is_active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, tax_id: true },
  });
}

// 新增統編
export async function createEntity(data: {
  tax_id: string;
  name: string;
  entity_type?: string;
}) {
  if (!/^\d{8}$/.test(data.tax_id)) {
    throw new Error("統一編號必須為 8 碼數字");
  }

  const { orgId } = await getCurrentEntity();

  const existing = await prisma.entity.findUnique({
    where: { org_id_tax_id: { org_id: orgId, tax_id: data.tax_id } },
  });
  if (existing) {
    throw new Error(`統一編號 ${data.tax_id} 已存在`);
  }

  const entity = await prisma.entity.create({
    data: {
      org_id: orgId,
      tax_id: data.tax_id,
      name: data.name,
      entity_type: data.entity_type ?? "sole_proprietorship",
    },
  });

  revalidatePath("/companies");
  return entity;
}

// 更新公司資料
export async function updateEntity(
  id: string,
  data: { name?: string; entity_type?: string; tax_id?: string }
) {
  await assertEntityOwns("entity", id);
  if (data.tax_id) {
    if (!/^\d{8}$/.test(data.tax_id)) {
      throw new Error("統一編號必須為 8 碼數字");
    }
    const current = await prisma.entity.findUniqueOrThrow({ where: { id } });
    if (data.tax_id !== current.tax_id) {
      const existing = await prisma.entity.findUnique({
        where: { org_id_tax_id: { org_id: current.org_id, tax_id: data.tax_id } },
      });
      if (existing) {
        throw new Error(`統一編號 ${data.tax_id} 已被其他公司使用`);
      }
    }
  }

  const entity = await prisma.entity.update({
    where: { id },
    data: {
      name: data.name,
      tax_id: data.tax_id,
      entity_type: data.entity_type,
    },
  });

  revalidatePath("/companies");
  return entity;
}

// 停用統編
export async function deactivateEntity(id: string) {
  await assertEntityOwns("entity", id);
  await prisma.entity.update({
    where: { id },
    data: { is_active: false },
  });
  revalidatePath("/companies");
}

// 啟用統編
export async function activateEntity(id: string) {
  await assertEntityOwns("entity", id);
  await prisma.entity.update({
    where: { id },
    data: { is_active: true },
  });
  revalidatePath("/companies");
}
