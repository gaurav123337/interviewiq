import type { Level, LevelId } from "../types";

export const LEVELS: Level[] = [
  {
    id: "junior", name: "Junior Developer", icon: "🌱", years: "0–2 years",
    blurb: "Core fundamentals, clean code, and a solid learning mindset.",
    focus: "language basics, data structures, debugging, testing fundamentals, communication"
  },
  {
    id: "mid", name: "Mid-Level", icon: "⚙️", years: "2–4 years",
    blurb: "Ship features independently and make sound engineering trade-offs.",
    focus: "design patterns, APIs, databases, moderate system design, code review"
  },
  {
    id: "senior", name: "Senior", icon: "🚀", years: "4–7 years",
    blurb: "Lead features end-to-end, mentor others, own architecture decisions.",
    focus: "architecture, scalability, mentoring, cross-team collaboration, system design"
  },
  {
    id: "staff", name: "Staff", icon: "🏗️", years: "7–10 years",
    blurb: "Cross-team impact: set technical direction and unblock large systems.",
    focus: "large-scale systems, technical strategy, standards, risk management"
  },
  {
    id: "principal", name: "Principal", icon: "🧭", years: "10+ years",
    blurb: "Org-wide architecture and high-leverage bets that shape the company.",
    focus: "org-wide architecture, platform strategy, executive communication, hiring bar"
  },
  {
    id: "cto", name: "CTO", icon: "🏛️", years: "Executive",
    blurb: "Technical vision, org building, cost, security and board-level communication.",
    focus: "technical vision, engineering org, budget, security & compliance, hiring leaders"
  },
  {
    id: "ceo", name: "CEO", icon: "👑", years: "Executive",
    blurb: "Business strategy, product-market fit, capital and company building.",
    focus: "strategy, product, market, fundraising, talent, metrics, communication"
  }
];

export const LEVEL_INDEX: Record<LevelId, number> = {
  junior: 0, mid: 1, senior: 2, staff: 3, principal: 4, cto: 5, ceo: 6
};

export const LEVEL_WEIGHT: Record<LevelId, number> = {
  junior: 1, mid: 1.1, senior: 1.25, staff: 1.35, principal: 1.45, cto: 1.5, ceo: 1.5
};

export function levelById(id: LevelId | string | null | undefined): Level {
  return LEVELS.find(l => l.id === id) || LEVELS[0];
}
