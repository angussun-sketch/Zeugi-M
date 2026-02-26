import { toBase, getMeasureTypeForUnit, type Unit, type MeasureType } from "./units";

export interface ParsedLine {
  name: string;
  qty: number;
  unit: Unit;
  qty_base: number;
  measure_type: MeasureType;
}

export interface ParseResult {
  parsed: ParsedLine[];
  errors: string[];
}

const LINE_REGEX = /^(.+?)\s+([\d,.]+)\s*(g|kg|台斤|cc)$/;

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

    if (isNaN(qty) || qty <= 0) {
      errors.push(trimmed);
      continue;
    }

    const qty_base = toBase(qty, unit);
    const measure_type = getMeasureTypeForUnit(unit);

    parsed.push({ name, qty, unit, qty_base, measure_type });
  }

  return { parsed, errors };
}
