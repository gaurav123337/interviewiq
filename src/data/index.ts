import type { Field } from "../types";
import { FIELDS_PART1 } from "./fields1";
import { FIELDS_PART2 } from "./fields2";

export { LEVELS, LEVEL_INDEX, LEVEL_WEIGHT, levelById } from "./levels";
export { FIELDS_PART1 } from "./fields1";
export { FIELDS_PART2 } from "./fields2";
export { COMPANIES, GENERAL_COMPANY, companyById } from "./companies";
export { BEHAVIORAL, SYSTEM_DESIGN, CTO_POOL, CEO_POOL } from "./pools";

export const FIELDS: Field[] = [...FIELDS_PART1, ...FIELDS_PART2];

export function fieldById(id: string | null | undefined): Field | undefined {
  return FIELDS.find(f => f.id === id);
}
