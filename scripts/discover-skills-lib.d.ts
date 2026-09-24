import type { CatalogSkill } from "../src/data/skillCatalog";

/** Minimal catalog shape used by the lib (Record<skillId, skill>). */
export type CatalogLike = Record<string, Pick<CatalogSkill, "name">>;

export interface SkillSeedProposal {
  url: string;
  kind: "html" | "json" | "sitemap" | "github-topic" | "github-repo";
  origin: "manual" | "skill-auto";
  origin_detail: string;
  skill: string;
}

/** Fewer than GAP_MIN approved discovery resources ⇒ the skill is a gap. */
export declare const GAP_MIN: number;

export declare function skillNames(catalog: CatalogLike | null | undefined): string[];
export declare function parseCatalogSkillNames(sourceText: string | null | undefined): string[];
export declare function sourceKey(source: unknown): string;
export declare function findSkillGaps(
  skills: string[] | CatalogLike | null | undefined,
  approvedCounts: Record<string, number> | null | undefined
): string[];
export declare function proposeSkillSeeds(
  gapSkills: string[] | null | undefined,
  opts?: { maxPerSkill?: number }
): SkillSeedProposal[];
export declare function dedupeProposals(
  proposals: SkillSeedProposal[] | null | undefined,
  existingUrls: unknown[] | null | undefined
): SkillSeedProposal[];
export declare function budgetCap(
  proposals: SkillSeedProposal[] | null | undefined,
  maxTotal?: number
): SkillSeedProposal[];
export declare function buildSeedValuesSql(
  proposals: SkillSeedProposal[] | null | undefined
): string;
