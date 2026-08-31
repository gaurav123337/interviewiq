/* skillVocab — the ONE canonical skill vocabulary (roadmap Item 11).
   ─────────────────────────────────────────────────────────────────
   InterviewIQ historically carried three unaligned skill vocabularies:
     1. FIELDS[].skills  — composite human labels ("React · Vue · Angular").
     2. skillCatalog.ts  — lowercase slug ids ("react", "ci-cd", "data-structures").
     3. resume/matcher   — canonical display names ("React", "Node.js", "CI/CD").
   Nothing bridged them, so the Skill Counselor silently under-counted owned
   skills: it lowercased display names and compared to catalog ids with no
   slugification, so "Node.js".toLowerCase()="node.js" ≠ catalog id "node",
   "CI/CD"≠"ci-cd", "Data structures"≠"data-structures".

   This module is the single canonicalizer that folds any of the three into a
   stable { slug, display, catalogId? }. It is a PURE leaf data module — it
   imports only the catalog (no services), has no side effects, and is safe to
   call from anywhere.

   NOTE: the resume alias seed below is a curated superset of
   resumeParser.ts SKILL_KEYWORDS. A follow-up will have resumeParser import
   from here to retire the duplication (kept separate now so this PR touches no
   call sites). */

import { SKILLS } from "./skillCatalog";

/* ------------------------------------------------------------------ */
/* slugify — the canonical key transform                               */
/* ------------------------------------------------------------------ */

/** Lowercase, turn every run of separators (`. _ / & , · + space` …) into a
    single dash, and trim dashes. Alphanumerics plus `+`/`#` survive so `c++`
    and `c#` stay distinct. This is what aligns the three vocabularies:
    `"Node.js" → "node-js"`, `"CI/CD" → "ci-cd"`, `"Data structures" → "data-structures"`. */
export function slugify(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9+#]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/* ------------------------------------------------------------------ */
/* Alias seed — surface variant → canonical display name               */
/* ------------------------------------------------------------------ */

/** canonical display → known surface variants (lowercased at build time). */
const SKILL_ALIASES: Record<string, string[]> = {
  // Frontend
  "React": ["react", "reactjs", "react.js"],
  "Vue": ["vue", "vuejs", "vue.js", "vue3"],
  "Angular": ["angular", "angularjs", "angular.js"],
  "Next.js": ["next.js", "nextjs", "next js"],
  "TypeScript": ["typescript"],
  "JavaScript": ["javascript", "js"],
  "HTML": ["html", "html5"],
  "CSS": ["css", "css3"],
  "Redux": ["redux", "mobx", "zustand", "recoil"],
  "GraphQL": ["graphql", "gql"],
  "REST APIs": ["rest", "restful", "rest api", "rest apis", "apis", "api"],
  "Webpack": ["webpack"],
  "Vite": ["vite"],
  "Tailwind CSS": ["tailwind", "tailwindcss", "tailwind css"],
  "Styled Components": ["styled components", "css-in-js", "emotion"],
  "Testing": ["testing", "jest", "cypress", "playwright", "testing library", "mocha", "vitest", "enzyme"],
  "Accessibility": ["accessibility", "a11y", "wcag", "wai-aria", "aria"],
  "Performance": ["performance", "web performance", "lighthouse", "web vitals", "core web vitals"],
  "Responsive Design": ["responsive", "responsive design", "mobile-first"],
  "Design Systems": ["design system", "design systems", "storybook"],
  "PWA": ["pwa", "progressive web app", "service worker"],
  // Backend
  "Node.js": ["node.js", "nodejs", "node js", "node", "express", "expressjs"],
  "Python": ["python", "django", "flask", "fastapi"],
  "Java": ["java", "spring", "springboot", "spring boot"],
  "Go": ["go", "golang"],
  "Rust": ["rust"],
  "PHP": ["php", "laravel"],
  "Ruby": ["ruby", "rails", "ruby on rails"],
  "Authentication": ["auth", "authentication", "authorization", "oauth", "jwt"],
  "API design": ["api design", "services"],
  // Database
  "PostgreSQL": ["postgresql", "postgres"],
  "MySQL": ["mysql"],
  "MongoDB": ["mongodb", "mongo"],
  "Redis": ["redis"],
  "Elasticsearch": ["elasticsearch", "elastic"],
  "SQL": ["sql"],
  "Databases": ["databases", "database"],
  // Cloud & DevOps
  "AWS": ["aws", "amazon web services"],
  "GCP": ["gcp", "google cloud"],
  "Azure": ["azure", "microsoft cloud"],
  "Docker": ["docker", "containerization", "containers"],
  "Kubernetes": ["kubernetes", "k8s"],
  "CI/CD": ["ci/cd", "cicd", "ci cd", "jenkins", "github actions", "gitlab ci", "circleci", "iac", "infrastructure as code", "terraform"],
  "Linux": ["linux", "bash", "shell"],
  "Observability": ["observability", "sre", "monitoring", "prometheus", "grafana", "logs metrics traces"],
  "Caching": ["caching", "cache"],
  // Data & ML
  "TensorFlow": ["tensorflow"],
  "PyTorch": ["pytorch"],
  "Pandas": ["pandas", "numpy"],
  "Spark": ["spark", "pyspark"],
  "Airflow": ["airflow"],
  // Mobile
  "React Native": ["react native"],
  "Flutter": ["flutter", "dart"],
  "Swift": ["swift", "ios"],
  "Kotlin": ["kotlin", "android"],
  // Systems / practices
  "System design": ["system design", "systems design"],
  "Distributed systems": ["distributed systems", "distributed system"],
  "Data structures & algorithms": ["data structures", "data structures & algorithms", "dsa", "algorithms"],
  "Product thinking": ["product thinking"],
  "Agile": ["agile", "scrum", "kanban", "sprint"],
  "Git": ["git", "github", "gitlab", "bitbucket"],
  "Microservices": ["microservice", "microservices"],
  "State management": ["state management", "context api"],
};

/** lowercased alias → canonical display. First writer wins on collision, so
    order the seed above from most- to least-specific canonical. */
const ALIAS_TO_DISPLAY: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  for (const [display, aliases] of Object.entries(SKILL_ALIASES)) {
    const dk = display.toLowerCase();
    if (!(dk in out)) out[dk] = display;
    for (const a of aliases) {
      const k = a.trim().toLowerCase();
      if (k && !(k in out)) out[k] = display;
    }
  }
  return out;
})();

/* ------------------------------------------------------------------ */
/* Catalog remap — slug → catalog id                                   */
/* ------------------------------------------------------------------ */

/** Curated remaps for slugs that don't equal a catalog id but have a clear
    catalog home. Programmatic catalog-name remaps are layered under these. */
const CURATED_REMAP: Record<string, string> = {
  "node-js": "node",
  "postgresql": "databases",
  "mysql": "databases",
  "mongodb": "databases",
  "redis": "caching",
  "rest-apis": "api-design",
  "apis": "api-design",
  "auth": "authentication",
  "sre": "reliability-engineering",
  "web-performance": "performance-basics",
  "performance": "performance-basics",
  "testing": "testing-basics",
  "redux": "state-management",
  "dsa": "data-structures",
  "algorithms": "data-structures",
};

/** slug → catalog id. Built from CURATED_REMAP plus every catalog skill's
    slugified NAME (so a catalog display like "Databases (PostgreSQL)" →
    "databases-postgresql" → "databases" round-trips, guaranteeing idempotency). */
const SLUG_TO_CATALOG: Record<string, string> = (() => {
  const out: Record<string, string> = { ...CURATED_REMAP };
  for (const [id, s] of Object.entries(SKILLS)) {
    const nameSlug = slugify(s.name);
    if (nameSlug && !(nameSlug in out)) out[nameSlug] = id;
  }
  return out;
})();

/** Resolve a slug to a catalog id, or undefined if the catalog doesn't cover it. */
function catalogIdForSlug(slug: string): string | undefined {
  if (slug in SKILLS) return slug;
  return SLUG_TO_CATALOG[slug];
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export interface Canonical {
  /** Canonical key: the catalog id when known, else slugify(display). */
  slug: string;
  /** Human label: the catalog name when known, else the alias-folded display. */
  display: string;
  /** Set iff `slug` is a skillCatalog id. */
  catalogId?: string;
}

/** Fold any single skill label (display name, catalog id, or manual entry)
    into its canonical { slug, display, catalogId? }. Idempotent on `.display`. */
export function canonicalize(raw: string): Canonical {
  const trimmed = raw.trim();
  const display0 = ALIAS_TO_DISPLAY[trimmed.toLowerCase()] ?? trimmed;
  const slug0 = slugify(display0);
  const catalogId = catalogIdForSlug(slug0);
  if (catalogId) {
    return { slug: catalogId, display: SKILLS[catalogId].name, catalogId };
  }
  return { slug: slug0, display: display0 };
}

/** Split a composite label ("React · Vue · Angular", "CSS & accessibility")
    into canonical atomic slugs, order-preserving and de-duped. Splits ONLY on
    space-padded separators (· / & + , "and") so tight tokens like "CI/CD" and
    "Node.js" survive intact. A label with no separator canonicalizes whole. */
export function decompose(compositeLabel: string): string[] {
  const parts = compositeLabel.split(/\s+(?:[·/&+,]|and)\s+/i);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const p of parts) {
    const t = p.trim();
    if (!t) continue;
    const { slug } = canonicalize(t);
    if (slug && !seen.has(slug)) { seen.add(slug); out.push(slug); }
  }
  return out;
}

/** Best-effort human label for a slug: the catalog name when known, else the
    slug itself. (Canonical profile nodes carry their own `display`; this is a
    fallback for slug-only contexts.) */
export function displayName(slug: string): string {
  return SKILLS[slug]?.name ?? slug;
}
