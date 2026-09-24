export declare const CANONICAL_SKILLS: string[];

/** Canonical skill names detected in free text, ordered by first appearance. */
export declare function deriveSkills(text: string | null | undefined): string[];

/** Hard-noise classifier: machine reason, or null when human-reviewable. */
export declare function noiseReason(
  text: string | null | undefined
): "empty" | "oversize" | "non-english" | "url-as-question" | "playground-link" | "tracking-params" | "json-fragment" | "too-short" | "shout" | null;

/** Readable but likely-incomplete (the "review first" tier). */
export declare function looksTruncated(text: string | null | undefined): boolean;

export interface NoiseEntry<T = unknown> {
  reason: NonNullable<ReturnType<typeof noiseReason>>;
  item: T;
}

/** Splits items into [keep (skill-tagged), dropped (with reasons)]. */
export declare function partitionNoiseItems<T extends { question?: string; skills?: string[] }>(
  items: T[] | null | undefined
): [T[], NoiseEntry<T>[]];
