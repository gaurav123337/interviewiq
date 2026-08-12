/* Central, easily-editable app configuration. */

export const CONFIG = {
  productName: "InterviewIQ",
  tagline: "AI Interview Coach",
  /** Where feedback and early-access requests go (mailto target — swap for a form endpoint when a backend exists). */
  supportEmail: "gaurav.123337@gmail.com",
  repoUrl: "https://github.com/gaurav123337/interviewiq",
  /** Checkout / purchase URL for Pro (empty until a storefront exists → falls back to mailto).
      When the cloud payment functions (pay-checkout / pay-webhook) are deployed, the app
      uses those instead and this is ignored. */
  proUrl: "",
  /** Active payment provider (mirrors the server's PAYMENT_PROVIDER secret).
      Only used for UI labels — the actual dispatch lives in the Edge Functions,
      so switching providers is a server-side env change. */
  payment: {
    provider: "razorpay"
  },
  /** Checkout URL for team seat upgrades (empty → fallback to support email). */
  teamProUrl: "",
  features: {
    /** Master switch for the freemium paywall. Off = the app is fully free; flip to true to enforce limits. */
    paywall: true,
    /** Allow the old IQPRO-XXXX format keys (client-side checksum) — TEST ONLY.
        They are forgeable, so flip to false before launch: real Pro comes from
        the server (supabase/billing.sql entitlements + grant codes). */
    testLicensing: true
  },
  /** Optional cross-device sync. Create a free Supabase project, run the SQL in
      the README, and paste the project URL + anon key here. Empty = cloud sync off. */
  supabase: {
    url: "https://ndrusywvceojsoirhkhl.supabase.co",
    anonKey: "sb_publishable_KL1mXNkhOnu8gYqCgMpf7A_3ue6dabe"
  }
} as const;
