/* Bundled seed feed — a small set of example postings shown ONLY when the
   live feed is empty (fresh install, offline, or before the first cloud
   refresh). Item 18 (Phase 3): the Jobs portal must not look dead
   out-of-the-box.

   HONESTY CONTRACT (do not weaken):
   - Every entry uses source "seed" so the feed card renders a visible
     "Sample" trust chip (see trustOf/sourceLabel in services/importJob.ts) —
     these are never presented as live openings.
   - Salaries are either null or marked source:"estimate" (the UI appends
     " est.", salaryLabel in services/jobs/feed.ts) — never a fake "posting".
   - Skills use ordinary resume/JD vocabulary so the matcher (services/jobs/
     match.ts) produces a real, non-misleading fit % against the user's
     profile rather than an accidental 0% or 100%.

   These rows are a READ-TIME fallback only — listJobs() returns them when the
   stored feed is empty, but they are never written to iq.jobs, so the first
   real cloud fetch or import cleanly supersedes them (see feed.ts). */

import type { JobPosting } from "../types";

/** apply-links point at real public search pages, never a fabricated posting. */
const seed = (
  n: number,
  over: Partial<JobPosting> & Pick<JobPosting, "title" | "company" | "skills">
): JobPosting => ({
  id: `seed:${n}`,
  source: "seed",
  externalId: String(n),
  title: over.title,
  company: over.company,
  location: over.location ?? "Remote",
  remote: over.remote ?? true,
  description: over.description ?? "",
  url: over.url ?? "https://www.google.com/search?q=" + encodeURIComponent(`${over.title} ${over.company} jobs`),
  skills: over.skills,
  level: over.level ?? null,
  salary: over.salary ?? null,
  companySize: over.companySize ?? null,
  postedAt: over.postedAt ?? null
});

/** ~10 example postings spanning common fields, so a fresh feed — and the
    rankings + salary bands downstream of it — are populated with something
    plausible and clearly labelled. */
export const SEED_JOBS: JobPosting[] = [
  seed(1, {
    title: "Frontend Engineer",
    company: "Northwind Labs",
    location: "Remote",
    remote: true,
    description: "Build accessible, performant UI in React and TypeScript. Partner with design to ship polished product features.",
    skills: ["React", "TypeScript", "CSS", "REST APIs"],
    level: "mid",
    salary: { min: 110000, max: 145000, currency: "USD", source: "estimate" },
    companySize: "mid"
  }),
  seed(2, {
    title: "Backend Engineer",
    company: "Meridian Systems",
    location: "Remote",
    remote: true,
    description: "Design and operate services and APIs at scale. Own reliability, data models, and performance.",
    skills: ["Node.js", "PostgreSQL", "REST APIs", "Docker"],
    level: "senior",
    salary: { min: 130000, max: 170000, currency: "USD", source: "estimate" },
    companySize: "large"
  }),
  seed(3, {
    title: "Full-Stack Developer",
    company: "Brightwave",
    location: "Bengaluru, India",
    remote: false,
    description: "Ship end-to-end features across a React frontend and a Node.js backend. Comfortable with SQL and cloud deploys.",
    skills: ["JavaScript", "React", "Node.js", "SQL", "AWS"],
    level: "mid",
    salary: { min: 2000000, max: 3200000, currency: "INR", source: "estimate" },
    companySize: "mid"
  }),
  seed(4, {
    title: "Data Scientist",
    company: "Quanta Analytics",
    location: "Remote",
    remote: true,
    description: "Build models and analyses that drive product decisions. Strong Python and statistics; communicate findings clearly.",
    skills: ["Python", "SQL", "Machine Learning", "Statistics"],
    level: "mid",
    salary: { min: 120000, max: 160000, currency: "USD", source: "estimate" },
    companySize: "mid"
  }),
  seed(5, {
    title: "DevOps Engineer",
    company: "Helios Cloud",
    location: "Remote",
    remote: true,
    description: "Own CI/CD, infrastructure-as-code, and observability. Keep deploys fast and safe.",
    skills: ["Kubernetes", "Docker", "Terraform", "AWS", "CI/CD"],
    level: "senior",
    salary: { min: 135000, max: 175000, currency: "USD", source: "estimate" },
    companySize: "large"
  }),
  seed(6, {
    title: "Product Manager",
    company: "Lumen Product Co.",
    location: "Remote",
    remote: true,
    description: "Own the roadmap for a core product area. Partner with engineering and design; ground decisions in user research and data.",
    skills: ["Product Strategy", "Roadmapping", "User Research", "Analytics"],
    level: "senior",
    salary: { min: 140000, max: 180000, currency: "USD", source: "estimate" },
    companySize: "mid"
  }),
  seed(7, {
    title: "Product Designer",
    company: "Atelier Digital",
    location: "Remote",
    remote: true,
    description: "Design end-to-end product experiences — from research and wireframes to polished, accessible UI.",
    skills: ["Figma", "UX Design", "Prototyping", "User Research"],
    level: "mid",
    salary: null,
    companySize: "small"
  }),
  seed(8, {
    title: "Mobile Engineer (iOS)",
    company: "Cascade Mobile",
    location: "Remote",
    remote: true,
    description: "Build and ship iOS features in Swift. Care about performance, testing, and a great user experience.",
    skills: ["Swift", "iOS", "REST APIs", "Testing"],
    level: "mid",
    salary: { min: 125000, max: 160000, currency: "USD", source: "estimate" },
    companySize: "mid"
  }),
  seed(9, {
    title: "Data Analyst",
    company: "Beacon Insights",
    location: "London, UK",
    remote: false,
    description: "Turn data into decisions — build dashboards, run analyses, and partner with teams on metrics.",
    skills: ["SQL", "Python", "Data Visualization", "Statistics"],
    level: "junior",
    salary: { min: 45000, max: 60000, currency: "GBP", source: "estimate" },
    companySize: "mid"
  }),
  seed(10, {
    title: "Site Reliability Engineer",
    company: "Ironclad Infra",
    location: "Remote",
    remote: true,
    description: "Keep production reliable — on-call, incident response, capacity planning, and automation.",
    skills: ["Linux", "Kubernetes", "Python", "Monitoring", "CI/CD"],
    level: "senior",
    salary: { min: 140000, max: 185000, currency: "USD", source: "estimate" },
    companySize: "large"
  })
];
