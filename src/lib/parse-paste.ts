import { toBase, getMeasureTypeForUnit, type Unit, type MeasureType } from "./units";

export interface ParsedLine {
  name: string;
  qty: number;
  unit: Unit;
  qty_base: number;
  measure_type: MeasureType;
  price?: number;
}

export interface ParseResult {
  parsed: ParsedLine[];
  errors: string[];
}

// 支援兩種格式：
// 1. 品名 數量單位 價格   (例: 乾蘿蔔絲 90台斤 5400)
// 2. 品名 數量單位         (例: 乾蘿蔔絲 90台斤)
const LINE_REGEX = /^(.+?)\s+([\d,.]+)\s*(公斤|台斤|公升|毫升)\s*(?:([\d,.]+))?$/;

export function parsePasteText(text: string): ParseResult {
  const lines = text.trim().split("\n").filter((l) => l.trim());
  const parsed: ParsedLine[] = [];
  const errors: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    const match = trimmed.match(LINE_REGEX);
    if (!match) {
      errors.push(trimmed);
      continue;
    }

    const name = match[1].trim();
    const qty = parseFloat(match[2].replace(/,/g, ""));
    const unit = match[3] as Unit;
    const price = match[4] ? parseFloat(match[4].replace(/,/g, "")) : undefined;

    if (isNaN(qty) || qty <= 0) {
      errors.push(trimmed);
      continue;
    }

    if (price !== undefined && (isNaN(price) || price <= 0)) {
      errors.push(trimmed);
      continue;
    }

    const qty_base = toBase(qty, unit);
    const measure_type = getMeasureTypeForUnit(unit);

    parsed.push({ name, qty, unit, qty_base, measure_type, price });
  }

  return { parsed, errors };
}
