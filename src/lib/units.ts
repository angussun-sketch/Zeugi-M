export type MeasureType = "weight" | "volume";
export type WeightUnit = "g" | "kg" | "台斤";
export type VolumeUnit = "cc";
export type Unit = WeightUnit | VolumeUnit;

const WEIGHT_TO_G: Record<WeightUnit, number> = {
  g: 1,
  kg: 1000,
  "台斤": 600,
};

const VOLUME_TO_CC: Record<VolumeUnit, number> = {
  cc: 1,
};

export function getUnitsForType(type: MeasureType): Unit[] {
  if (type === "weight") return ["g", "kg", "台斤"];
  return ["cc"];
}

export function getBaseUnit(type: MeasureType): string {
  return type === "weight" ? "g" : "cc";
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

export function formatCost(cost: number): string {
  if (cost >= 1) return cost.toFixed(2);
  if (cost >= 0.01) return cost.toFixed(4);
  return cost.toFixed(6);
}

export function formatQty(qtyBase: number, measureType: MeasureType): string {
  if (measureType === "volume") return `${qtyBase} cc`;
  if (qtyBase >= 1000) return `${(qtyBase / 1000).toFixed(2)} kg`;
  return `${qtyBase} g`;
}
