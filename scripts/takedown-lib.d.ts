export declare function questionHash(text: string): string;

export interface ProblemEntry {
  id: string;
  title: string;
  source: string | null;
  attributed: boolean;
}

export declare function problemEntry(problem: {
  id?: string | number;
  title?: string;
  source?: string | null;
  meta?: { source?: string | null } | null;
}): ProblemEntry;

export declare function excludeProblems<T extends { id?: string | number }>(
  problems: T[] | null | undefined,
  takenDownIds: (string | number)[] | null | undefined
): T[];

export declare function takedownNote(takenDownIds: (string | number)[] | null | undefined): string;
