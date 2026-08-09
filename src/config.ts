/* Central, easily-editable app configuration. */

export const CONFIG = {
  productName: "InterviewIQ",
  tagline: "AI Interview Coach",
  /** Where feedback and early-access requests go (mailto target — swap for a form endpoint when a backend exists). */
  supportEmail: "gaurav.123337@gmail.com",
  repoUrl: "https://github.com/gaurav123337/interviewiq",
  /** Checkout / purchase URL for Pro (empty until a storefront exists → falls back to mailto). */
  proUrl: "",
  features: {
    /** Master switch for the freemium paywall. Off = the app is fully free; flip to true to enforce limits. */
    paywall: false
  }
} as const;
