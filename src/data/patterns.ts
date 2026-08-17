/* P4 pattern catalog — the taxonomy that maps generated coding problems to
   roadmap topics and powers the Playground pattern filter. Ids are the single
   contract shared with the AI-draft pipeline (scripts/ai-draft-lib.js asserts
   every id it emits exists here). Labels are shown in the picker; topics feed
   company frequency buckets + the roadmap → coding mapping. */

/** Pattern id → human label (Playground filter + chips). */
export const PATTERN_LABELS: Record<string, string> = {
  "two-pointer": "Two Pointers",
  "sliding-window": "Sliding Window",
  "hash-map": "Hash Map / Set",
  "binary-search": "Binary Search",
  "dynamic-programming": "Dynamic Programming",
  "greedy": "Greedy",
  "heap": "Heap / Priority Queue",
  "stack": "Stack",
  "queue": "Queue / BFS",
  "graph": "Graph",
  "interval": "Intervals",
  "linked-list": "Linked List",
  "tree": "Tree",
  "trie": "Trie",
  "bit": "Bit Manipulation",
  "backtracking": "Backtracking",
  "math": "Math",
  "string": "String",
  "sorting": "Sorting",
  "mixed": "Mixed"
};

/** Pattern id → CLI topic bucket (used by codingTopicFor when a problem has no
    explicit CLI_TOPICS entry, and by the roadmap pattern links). */
export const PATTERN_TOPIC: Record<string, string> = {
  "two-pointer": "Arrays & hashing",
  "sliding-window": "Arrays & hashing",
  "hash-map": "Arrays & hashing",
  "interval": "Arrays & hashing",
  "greedy": "Arrays & hashing",
  "sorting": "Arrays & hashing",
  "string": "Strings & stacks",
  "stack": "Strings & stacks",
  "queue": "Strings & stacks",
  "linked-list": "Strings & stacks",
  "binary-search": "Search & sorting",
  "backtracking": "Search & sorting",
  "dynamic-programming": "Dynamic programming",
  "tree": "Dynamic programming",
  "graph": "Dynamic programming",
  "heap": "Dynamic programming",
  "trie": "Dynamic programming",
  "bit": "Dynamic programming",
  "math": "Language basics",
  "mixed": "Algorithms"
};
