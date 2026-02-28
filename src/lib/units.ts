export type MeasureType = "weight" | "volume";
export type WeightUnit = "公斤" | "台斤";
export type VolumeUnit = "公升" | "毫升";
export type Unit = WeightUnit | VolumeUnit;
export type PackageUnit = "箱" | "瓶" | "桶" | "袋";
export type AllPurchaseUnit = Unit | PackageUnit;

const WEIGHT_TO_G: Record<WeightUnit, number> = {
  "公斤": 1000,
  "台斤": 600,
};

const VOLUME_TO_CC: Record<VolumeUnit, number> = {
  "公升": 1000,
  "毫升": 1,
};

export function getUnitsForType(type: MeasureType): Unit[] {
  if (type === "weight") return ["公斤", "台斤"];
  return ["公升", "毫升"];
}

export function getBaseUnit(type: MeasureType): string {
  return type === "weight" ? "公斤" : "公升";
}

export function toBase(qty: number, unit: Unit): number {
  if (unit in WEIGHT_TO_G) {
    return qty * WEIGHT_TO_G[unit as WeightUnit];
  }
  if (unit in VOLUME_TO_CC) {
    return qty * VOLUME_TO_CC[unit as VolumeUnit];
  }
  throw new Error(`Unknown unit: ${unit}`);
}

export function fromBase(qtyBase: number, targetUnit: Unit): number {
  if (targetUnit in WEIGHT_TO_G) {
    return qtyBase / WEIGHT_TO_G[targetUnit as WeightUnit];
  }
  if (targetUnit in VOLUME_TO_CC) {
    return qtyBase / VOLUME_TO_CC[targetUnit as VolumeUnit];
  }
  throw new Error(`Unknown unit: ${targetUnit}`);
}

export function getMeasureTypeForUnit(unit: string): MeasureType {
  if (unit in WEIGHT_TO_G) return "weight";
  if (unit in VOLUME_TO_CC) return "volume";
  throw new Error(`Unknown unit: ${unit}`);
}

// ============ 包裝單位支援 ============

export const PACKAGE_UNITS: PackageUnit[] = ["箱", "瓶", "桶", "袋"];

export function isPackageUnit(unit: string): unit is PackageUnit {
  return PACKAGE_UNITS.includes(unit as PackageUnit);
}

/** 取得某量測類型可用的所有採購單位（計量 + 包裝） */
export function getPurchaseUnitsForType(type: MeasureType): AllPurchaseUnit[] {
  return [...getUnitsForType(type), ...PACKAGE_UNITS];
}

/**
 * 計算採購的基礎總量 (g 或 cc)
 * 直接單位：toBase(qty, unit)
 * 包裝單位：qty × toBase(perPkgQty, perPkgUnit)
 */
export function computeTotalQtyBase(
  purchaseQty: number,
  purchaseUnit: string,
  perPackageQty?: number | null,
  perPackageUnit?: string | null,
): number {
  if (isPackageUnit(purchaseUnit)) {
    if (!perPackageQty || !perPackageUnit) {
      throw new Error(`包裝單位「${purchaseUnit}」必須指定每包裝量和單位`);
    }
    return purchaseQty * toBase(perPackageQty, perPackageUnit as Unit);
  }
  return toBase(purchaseQty, purchaseUnit as Unit);
}

// ============ 顯示 ============

/** 單位顯示名稱（值即名稱，直接回傳） */
export function unitLabel(unit: string): string {
  return unit;
}

// ============ 格式化 ============

export function formatCost(cost: number): string {
  if (cost >= 1) return cost.toFixed(2);
  if (cost >= 0.01) return cost.toFixed(4);
  return cost.toFixed(6);
}

/** 將基礎成本 (元/g 或 元/cc) 轉為顯示用 (元/公斤 或 元/公升) */
export function formatBaseCost(costPerGOrCC: number): string {
  const costPerDisplay = costPerGOrCC * 1000;
  return formatCost(costPerDisplay);
}

export function formatQty(qtyBase: number, measureType: MeasureType): string {
  if (measureType === "volume") return `${(qtyBase / 1000).toFixed(2)} 公升`;
  return `${(qtyBase / 1000).toFixed(2)} 公斤`;
}
