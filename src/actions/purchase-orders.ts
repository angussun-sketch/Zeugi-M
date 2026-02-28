"use server";

import { prisma } from "@/lib/db";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";

type TxClient = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];
import { computeTotalQtyBase } from "@/lib/units";
import { createTransactionFromPO, deleteLinkedTransaction } from "@/actions/finance";
import { getCurrentEntity, assertOrgOwns, assertEntityOwns } from "@/lib/multi-entity";

// ============ 供應商 ============

export async function getSuppliers() {
  const { orgId } = await getCurrentEntity();
  return prisma.supplier.findMany({
    where: { org_id: orgId },
    orderBy: { name: "asc" },
    include: { _count: { select: { purchase_orders: true } } },
  });
}

export async function getSupplierCategories(): Promise<string[]> {
  const { orgId } = await getCurrentEntity();
  const result = await prisma.supplier.findMany({
    where: { org_id: orgId },
    select: { category: true },
    distinct: ["category"],
    orderBy: { category: "asc" },
  });
  return result.map((r) => r.category);
}

export async function findOrCreateSupplier(name: string, category = "原料") {
  const { orgId } = await getCurrentEntity();
  const trimmed = name.trim();
  let supplier = await prisma.supplier.findFirst({ where: { org_id: orgId, name: trimmed } });
  if (!supplier) {
    supplier = await prisma.supplier.create({ data: { name: trimmed, category, org_id: orgId } });
  }
  return supplier;
}

export async function updateSupplier(
  id: string,
  data: { name?: string; category?: string; contact?: string | null; phone?: string | null; notes?: string | null },
) {
  await assertOrgOwns("supplier", id);
  const supplier = await prisma.supplier.update({ where: { id }, data });
  revalidatePath("/suppliers");
  revalidatePath("/purchase-orders");
  return supplier;
}

export async function deleteSupplier(id: string) {
  await assertOrgOwns("supplier", id);
  const count = await prisma.purchaseOrder.count({ where: { supplier_id: id } });
  if (count > 0) {
    throw new Error(`此供應商有 ${count} 筆叫貨單，無法刪除`);
  }
  await prisma.supplier.delete({ where: { id } });
  revalidatePath("/suppliers");
}

export async function createSupplier(data: {
  name: string;
  category: string;
  contact?: string;
  phone?: string;
  notes?: string;
}) {
  const { orgId } = await getCurrentEntity();
  const supplier = await prisma.supplier.create({
    data: {
      name: data.name.trim(),
      category: data.category,
      contact: data.contact || null,
      phone: data.phone || null,
      notes: data.notes || null,
      org_id: orgId,
    },
  });
  revalidatePath("/suppliers");
  return supplier;
}

// ============ 叫貨單 CRUD ============

export async function generateOrderNumber(
  orderDate: Date,
  db: TxClient | PrismaClient = prisma,
): Promise<string> {
  const dateStr = orderDate.toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `PO-${dateStr}-`;

  for (let attempt = 0; attempt < 3; attempt++) {
    const latest = await db.purchaseOrder.findFirst({
      where: { order_number: { startsWith: prefix } },
      orderBy: { order_number: "desc" },
      select: { order_number: true },
    });

    const seq = latest
      ? parseInt(latest.order_number.slice(-3), 10) + 1
      : 1;
    const orderNumber = `${prefix}${String(seq).padStart(3, "0")}`;

    const exists = await db.purchaseOrder.findUnique({
      where: { order_number: orderNumber },
      select: { id: true },
    });
    if (!exists) return orderNumber;
  }
  throw new Error("無法產生唯一訂單號碼，請稍後再試");
}


interface PurchaseOrderItemInput {
  ingredient_id: string;
  purchase_qty: number;
  purchase_unit: string;
  per_package_qty?: number | null;
  per_package_unit?: string | null;
  subtotal: number;
}

export async function createPurchaseOrder(data: {
  order_date?: string;
  supplier_name?: string;
  notes?: string;
  items: PurchaseOrderItemInput[];
  entity_id?: string;
}) {
  let supplier_id: string | null = null;
  if (data.supplier_name?.trim()) {
    const supplier = await findOrCreateSupplier(data.supplier_name);
    supplier_id = supplier.id;
  }

  const itemsData = data.items.map((item) => {
    const total_qty_base = computeTotalQtyBase(
      item.purchase_qty,
      item.purchase_unit,
      item.per_package_qty,
      item.per_package_unit,
    );
    const unit_cost_base = item.subtotal / total_qty_base;
    return {
      ingredient_id: item.ingredient_id,
      purchase_qty: item.purchase_qty,
      purchase_unit: item.purchase_unit,
      per_package_qty: item.per_package_qty ?? null,
      per_package_unit: item.per_package_unit ?? null,
      total_qty_base,
      subtotal: item.subtotal,
      unit_cost_base,
    };
  });

  const total_amount = itemsData.reduce((sum, i) => sum + i.subtotal, 0);
  const orderDate = data.order_date ? new Date(data.order_date) : new Date();

  const { orgId, entityId: defaultEntityId } = await getCurrentEntity();

  // Validate all ingredient_ids belong to current org
  const ingredientIds = [...new Set(data.items.map((i) => i.ingredient_id))];
  const validIngredients = await prisma.ingredient.findMany({
    where: { id: { in: ingredientIds }, org_id: orgId },
    select: { id: true },
  });
  if (validIngredients.length !== ingredientIds.length) {
    throw new Error("部分食材不屬於目前組織");
  }
  const entityId = data.entity_id ?? defaultEntityId;
  if (data.entity_id) {
    await assertEntityOwns("entity", data.entity_id);
  }

  // Pre-fetch cashflow category & fund account (read-only, safe outside tx)
  const expenseCategory = await prisma.cashflowCategory.findFirst({
    where: { org_id: orgId, direction: "expense", name: "原料費" },
  });
  const cashFundAccount = await prisma.fundAccount.findFirst({
    where: { org_id: orgId, account_type: "cash", is_active: true },
    orderBy: { sort_order: "asc" },
  });

  const order = await prisma.$transaction(async (tx) => {
    const order_number = await generateOrderNumber(orderDate, tx);
    const order = await tx.purchaseOrder.create({
      data: {
        order_number,
        order_date: orderDate,
        supplier_id,
        notes: data.notes || null,
        total_amount,
        entity_id: entityId,
        items: { create: itemsData },
      },
    });

    // Sync ingredient prices within transaction
    await Promise.all(
      itemsData.map((item) =>
        tx.ingredient.update({
          where: { id: item.ingredient_id },
          data: {
            unit_cost_base: item.unit_cost_base,
            purchase_qty: item.purchase_qty,
            purchase_unit: item.purchase_unit,
            per_package_qty: item.per_package_qty,
            per_package_unit: item.per_package_unit,
            subtotal: item.subtotal,
          },
        }),
      ),
    );

    // Create financial transaction
    const transaction = await createTransactionFromPO(order.id, tx);

    // Create cashflow record (支出) linked to the transaction
    if (transaction && expenseCategory) {
      const cfRecord = await tx.cashflowRecord.create({
        data: {
          entity_id: entityId,
          direction: "expense",
          category_id: expenseCategory.id,
          fund_account_id: cashFundAccount?.id ?? null,
          amount: total_amount,
          record_date: orderDate,
          description: `叫貨單 ${order_number}`,
          source: "purchase_order",
        },
      });
      await tx.cashflowRecord.update({
        where: { id: cfRecord.id },
        data: { transaction_id: transaction.id },
      });
    }

    return order;
  });

  revalidatePath("/purchase-orders");
  revalidatePath("/ingredients");
  revalidatePath("/batches");
  revalidatePath("/finance");
  revalidatePath("/cashflow");
  return order;
}

// ============ 叫貨單列表（Server 端分頁 + 篩選） ============

interface PurchaseOrderFilters {
  page?: number;
  pageSize?: number;
  dateFrom?: string;
  dateTo?: string;
  supplierName?: string;
  ingredientIds?: string[];
}

export async function getPurchaseOrders(filters: PurchaseOrderFilters = {}) {
  const {
    page = 1,
    pageSize = 50,
    dateFrom,
    dateTo,
    supplierName,
    ingredientIds,
  } = filters;

  const { orgId } = await getCurrentEntity();
  const where: Prisma.PurchaseOrderWhereInput = {
    entity: { org_id: orgId },
  };

  if (dateFrom || dateTo) {
    where.order_date = {};
    if (dateFrom) where.order_date.gte = new Date(dateFrom);
    if (dateTo) where.order_date.lte = new Date(dateTo + "T23:59:59");
  }

  if (supplierName) {
    where.supplier = { name: supplierName };
  }

  if (ingredientIds?.length) {
    where.items = { some: { ingredient_id: { in: ingredientIds } } };
  }

  const [orders, total] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where,
      include: {
        supplier: true,
        items: {
          select: {
            id: true,
            ingredient: { select: { name: true } },
            purchase_qty: true,
            purchase_unit: true,
            per_package_qty: true,
            per_package_unit: true,
            subtotal: true,
          },
        },
        _count: { select: { items: true } },
      },
      orderBy: [{ order_date: "desc" }, { created_at: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.purchaseOrder.count({ where }),
  ]);

  return {
    orders,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

// ============ 篩選器選項（輕量查詢） ============

export async function getIngredientNames() {
  const { orgId } = await getCurrentEntity();
  return prisma.ingredient.findMany({
    where: { org_id: orgId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export async function getSupplierNames() {
  const { orgId } = await getCurrentEntity();
  const result = await prisma.supplier.findMany({
    where: { org_id: orgId },
    select: { name: true },
    orderBy: { name: "asc" },
  });
  return result.map((s) => s.name);
}

export async function getPurchaseOrder(id: string) {
  await assertEntityOwns("purchaseOrder", id);
  return prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      supplier: true,
      items: {
        include: { ingredient: { select: { name: true, measure_type: true } } },
      },
    },
  });
}

export async function updatePurchaseOrder(
  id: string,
  data: {
    order_date?: string;
    supplier_name?: string;
    notes?: string;
    items: PurchaseOrderItemInput[];
  },
) {
  await assertEntityOwns("purchaseOrder", id);

  // Validate all ingredient_ids belong to current org
  const { orgId } = await getCurrentEntity();
  const ingredientIds = [...new Set(data.items.map((i) => i.ingredient_id))];
  const validIngredients = await prisma.ingredient.findMany({
    where: { id: { in: ingredientIds }, org_id: orgId },
    select: { id: true },
  });
  if (validIngredients.length !== ingredientIds.length) {
    throw new Error("部分食材不屬於目前組織");
  }

  let supplier_id: string | null = null;
  if (data.supplier_name?.trim()) {
    const supplier = await findOrCreateSupplier(data.supplier_name);
    supplier_id = supplier.id;
  }

  const itemsData = data.items.map((item) => {
    const total_qty_base = computeTotalQtyBase(
      item.purchase_qty,
      item.purchase_unit,
      item.per_package_qty,
      item.per_package_unit,
    );
    const unit_cost_base = item.subtotal / total_qty_base;
    return {
      ingredient_id: item.ingredient_id,
      purchase_qty: item.purchase_qty,
      purchase_unit: item.purchase_unit,
      per_package_qty: item.per_package_qty ?? null,
      per_package_unit: item.per_package_unit ?? null,
      total_qty_base,
      subtotal: item.subtotal,
      unit_cost_base,
    };
  });

  const total_amount = itemsData.reduce((sum, i) => sum + i.subtotal, 0);
  const orderDate = data.order_date ? new Date(data.order_date) : undefined;

  const order = await prisma.$transaction(async (tx) => {
    // 如果日期變更，需重新產生 order_number（在 tx 內確保一致性）
    const existing = await tx.purchaseOrder.findUnique({
      where: { id },
      select: { order_date: true, order_number: true },
    });
    let order_number = existing?.order_number;
    if (
      orderDate &&
      existing &&
      orderDate.toISOString().slice(0, 10) !==
        existing.order_date.toISOString().slice(0, 10)
    ) {
      order_number = await generateOrderNumber(orderDate, tx);
    }

    // Delete old items
    await tx.purchaseOrderItem.deleteMany({ where: { order_id: id } });

    const order = await tx.purchaseOrder.update({
      where: { id },
      data: {
        order_number,
        order_date: orderDate,
        supplier_id,
        notes: data.notes || null,
        total_amount,
        items: { create: itemsData },
      },
    });

    // Sync ingredient prices
    await Promise.all(
      itemsData.map((item) =>
        tx.ingredient.update({
          where: { id: item.ingredient_id },
          data: {
            unit_cost_base: item.unit_cost_base,
            purchase_qty: item.purchase_qty,
            purchase_unit: item.purchase_unit,
            per_package_qty: item.per_package_qty,
            per_package_unit: item.per_package_unit,
            subtotal: item.subtotal,
          },
        }),
      ),
    );

    // Delete old CashflowRecord + Transaction, then recreate
    const oldTx = await tx.transaction.findFirst({
      where: { source_type: "purchase_order", source_id: id },
      select: { id: true },
    });
    if (oldTx) {
      await tx.cashflowRecord.deleteMany({ where: { transaction_id: oldTx.id } });
    }
    await deleteLinkedTransaction("purchase_order", id, tx);

    const transaction = await createTransactionFromPO(order.id, tx);

    // Recreate cashflow record
    const { orgId } = await getCurrentEntity();
    const expenseCategory = await tx.cashflowCategory.findFirst({
      where: { org_id: orgId, direction: "expense", name: "原料費" },
    });
    const cashFundAccount = await tx.fundAccount.findFirst({
      where: { org_id: orgId, account_type: "cash", is_active: true },
      orderBy: { sort_order: "asc" },
    });
    if (transaction && expenseCategory) {
      const cfRecord = await tx.cashflowRecord.create({
        data: {
          entity_id: order.entity_id,
          direction: "expense",
          category_id: expenseCategory.id,
          fund_account_id: cashFundAccount?.id ?? null,
          amount: total_amount,
          record_date: order.order_date,
          description: `叫貨單 ${order.order_number}`,
          source: "purchase_order",
        },
      });
      await tx.cashflowRecord.update({
        where: { id: cfRecord.id },
        data: { transaction_id: transaction.id },
      });
    }

    return order;
  });

  revalidatePath("/purchase-orders");
  revalidatePath("/ingredients");
  revalidatePath("/batches");
  revalidatePath("/finance");
  revalidatePath("/cashflow");
  return order;
}

export async function deletePurchaseOrder(id: string) {
  await assertEntityOwns("purchaseOrder", id);
  await prisma.$transaction(async (tx) => {
    const linkedTx = await tx.transaction.findFirst({
      where: { source_type: "purchase_order", source_id: id },
      select: { id: true },
    });
    if (linkedTx) {
      await tx.cashflowRecord.deleteMany({ where: { transaction_id: linkedTx.id } });
    }
    await deleteLinkedTransaction("purchase_order", id, tx);
    await tx.purchaseOrder.delete({ where: { id } });
  });

  revalidatePath("/purchase-orders");
  revalidatePath("/ingredients");
  revalidatePath("/batches");
  revalidatePath("/finance");
  revalidatePath("/cashflow");
}

export async function deletePurchaseOrders(ids: string[]) {
  for (const id of ids) {
    await assertEntityOwns("purchaseOrder", id);
  }
  await prisma.$transaction(async (tx) => {
    for (const id of ids) {
      const linkedTx = await tx.transaction.findFirst({
        where: { source_type: "purchase_order", source_id: id },
        select: { id: true },
      });
      if (linkedTx) {
        await tx.cashflowRecord.deleteMany({ where: { transaction_id: linkedTx.id } });
      }
      await deleteLinkedTransaction("purchase_order", id, tx);
    }
    await tx.purchaseOrderItem.deleteMany({ where: { order_id: { in: ids } } });
    await tx.purchaseOrder.deleteMany({ where: { id: { in: ids } } });
  });

  revalidatePath("/purchase-orders");
  revalidatePath("/ingredients");
  revalidatePath("/batches");
  revalidatePath("/finance");
  revalidatePath("/cashflow");
}
