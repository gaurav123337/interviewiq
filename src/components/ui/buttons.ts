/* buttons.ts — shared button class constants and card class.
   These are Tailwind class strings, not components, so they live in a
   plain .ts file. Import as: import { btnPrimary, cardCls } from "./ui/buttons"; */

export const btn =
  "inline-flex h-10 items-center justify-center gap-2 rounded-xl font-bold transition-all duration-150 active:scale-[.99] disabled:opacity-45 disabled:cursor-not-allowed";
export const btnPrimary = btn + " grad-bg px-6 py-3 text-white shadow-[0_10px_26px_rgba(99,102,241,.35)] hover:-translate-y-px hover:brightness-110";
export const btnGhost = btn + " border border-line/20 px-4 py-2 text-sm text-mut hover:bg-wht/10 hover:text-ink";
export const btnSoft = btn + " grad-bg-soft border border-acc1/50 px-4 py-2 text-sm text-acctxt hover:bg-acc1/40";
export const btnOk = btn + " bg-gradient-to-br from-emerald-600 to-emerald-500 px-6 py-3 text-white shadow-[0_10px_26px_rgba(16,185,129,.3)] hover:-translate-y-px hover:brightness-110";
export const btnDanger = btn + " border border-bad/40 px-4 py-2 text-sm text-bad hover:bg-bad/10";
export const btnLg = " h-12 px-8 py-4 text-[17px] rounded-2xl";
export const btnSm = " px-3.5 py-1.5 text-[13px] rounded-lg";

/* ---------- card ---------- */
export const cardCls =
  "rounded-2xl border border-line/10 bg-gradient-to-b from-panel to-panel2 card-shadow";
