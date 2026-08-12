/* Public legal policy templates — Terms, Privacy, Refunds, Shipping.
   These are the pages payment providers (Razorpay's banking partners)
   require on a merchant website before international payments can be
   enabled. The bodies are light markdown (## headings, - bullets, **bold**)
   rendered by components/Legal.tsx. Placeholders are filled from CONFIG at
   read time. Admins can override any document via app_config → policies
   (components/Admin.tsx → ⚖️ Legal & Policies) without a deploy. */

export type PolicyId = "terms" | "privacy" | "refunds" | "shipping";

export interface PolicyMeta {
  id: PolicyId;
  title: string;
  icon: string;
  blurb: string;
  updatedAt: string;
}

export const POLICY_META: PolicyMeta[] = [
  {
    id: "terms",
    title: "Terms of Service",
    icon: "📜",
    blurb: "The rules that govern your use of InterviewIQ.",
    updatedAt: "2026-08-12"
  },
  {
    id: "privacy",
    title: "Privacy Policy",
    icon: "🔒",
    blurb: "What data we store, what we never collect, and your rights.",
    updatedAt: "2026-08-12"
  },
  {
    id: "refunds",
    title: "Refund & Cancellation",
    icon: "💸",
    blurb: "How refunds and subscription cancellations work.",
    updatedAt: "2026-08-12"
  },
  {
    id: "shipping",
    title: "Shipping Policy",
    icon: "📦",
    blurb: "Delivery terms for this digital product.",
    updatedAt: "2026-08-12"
  }
];

const T = `## Acceptance of Terms

By creating an account, purchasing a plan, or using {{company}} ("the Service"), you agree to these Terms of Service. If you do not agree, please do not use the Service.

## The Service

{{company}} is an AI interview preparation tool. It generates practice questions, scores answers, builds study roadmaps, and provides AI coaching and feedback. The Service is provided "as is" for personal, non-commercial interview preparation unless you hold a paid plan.

## Accounts

- You are responsible for keeping your sign-in credentials secure and for all activity under your account.
- You must provide accurate information when you create an account or complete a purchase.
- One account may be used by one person. Sharing paid access across a team requires a Team plan.

## Free vs Paid (Pro) Plans

- The core Service — tailored sessions, mock interviews, the question bank, drill and roadmap — is free with reasonable usage limits.
- Pro removes those limits and adds premium features. Pro access is granted only after a confirmed payment or a valid grant code; access is tied to your signed-in account and is verified server-side.
- We may change free limits or the Pro feature set at any time; changes never remove access you have already paid for within the paid period.

## Payments, Subscriptions and Refunds

- Payments are processed by our payment provider (currently Razorpay). We never see or store your full card details.
- Monthly and yearly plans renew automatically at the end of each period until you cancel. You can cancel anytime from your account settings; access continues until the end of the paid period.
- Refunds are governed by our Refund & Cancellation Policy, which forms part of these Terms.

## Acceptable Use

You agree not to:

- Reproduce, resell or redistribute the question bank, model answers or coaching content without permission.
- Use the Service to build a competing product or to train a model on our content.
- Attempt to bypass the paywall, access controls or usage quotas.
- Upload, paste or transmit unlawful, infringing or malicious content (including malicious code in the code playground).

## Intellectual Property

The Service, including its questions, answers, scoring logic, branding and content, is owned by {{company}} and its licensors. You may use it only as permitted by these Terms. Your answers, notes and uploaded materials remain yours; you grant us a limited license to store and process them to operate the Service.

## Disclaimers

- The Service provides practice materials and simulated feedback. It does not guarantee interview outcomes, employment or offers.
- AI-generated feedback may contain errors; it is a coaching aid, not an authoritative assessment.
- The Service is provided "as is" without warranties of any kind, express or implied.

## Limitation of Liability

To the maximum extent permitted by law, {{company}} is not liable for indirect, incidental or consequential damages, or for loss of profits, data or goodwill, arising from your use of the Service.

## Termination

We may suspend or terminate accounts that violate these Terms, abuse the Service, or attempt to defraud the payment flow. You may delete your account and data at any time from Settings.

## Changes

We may update these Terms from time to time. Material changes will be announced in the app. Continued use after changes take effect constitutes acceptance.

## Contact

Questions about these Terms: **{{email}}**`;

const P = `## Overview

This Privacy Policy explains what information {{company}} ("we") collects, why we collect it, and the choices you have. This policy applies to the {{url}} website and the InterviewIQ application.

## What we collect

- **Usage data.** Your sessions, answers, scores, streaks, roadmap progress and study history, stored locally on your device and — when you sign in to the cloud — synced to your account so your progress follows you across devices.
- **Account data.** Your email address and display name when you create a cloud account or sign in with Google or GitHub.
- **Payments.** When you purchase Pro, our payment provider (Razorpay) processes the transaction. We receive a payment confirmation and store the plan, amount, currency and payment reference — never your card number.
- **AI requests.** Content you send to AI coaching or the tutor (including uploaded PDFs for the knowledge base) is transmitted to the AI provider you configure or the built-in engine, solely to generate your response.
- **Diagnostics.** Anonymous error and event telemetry used to improve the product.

## What we never collect

- Your full card numbers or CVV — those never touch our servers.
- Content from third-party sites you don't paste yourself.
- Microphone audio without your explicit action — voice answers are processed only when you record and submit them.

## How we use data

- To run the Service: generate sessions, score answers, adapt roadmaps, sync progress.
- To fulfill purchases: verify payments, grant Pro access, prevent fraud, issue refunds.
- To improve the product: aggregated, de-identified usage analytics.
- To contact you: transactional emails about your account, payments, or announcements you opt into.

## Sharing

We share data only with:

- **Payment providers** (Razorpay) — necessary to process your payment.
- **AI providers** — when you enable generative AI feedback, the content you submit is sent to the configured provider.
- **Service infrastructure** (hosting, email delivery) — to operate the Service.

We never sell your personal data.

## Storage, retention & security

- Data is stored in encrypted cloud infrastructure and on your device. Transmissions use HTTPS.
- We retain account and payment records as required for tax and anti-fraud purposes, and session history until you delete it.
- You can delete your local data at any time (Settings → Reset) and your cloud account from Account.

## Your rights

Depending on your region (including GDPR / CCPA), you may have the right to access, correct, export or delete your personal data. Email **{{email}}** and we will respond within the timeframes the law requires.

## Cookies & local storage

The app uses local browser storage (localStorage) for offline-first operation and preferences. We do not use advertising cookies. Payment pages may set cookies operated by the payment provider under their own policies.

## Children

The Service is intended for working professionals and is not directed at children under 16. We do not knowingly collect data from children.

## Changes

We may update this policy; material changes will be announced in the app. The current version is always available on this page.

## Contact

Privacy questions: **{{email}}**`;

const R = `## Our promise

We want you to be happy with InterviewIQ. If a purchase isn't right for you, this policy explains how refunds and cancellations work.

## One-time purchases

- **7-day grace window.** You can request a full refund within 7 days of purchase for any reason — no questions asked.
- After the grace window, refunds are considered on a case-by-case basis (for example, a billing error or a duplicate charge). Repeated refunds for the same account are limited unless approved by our team.

## Subscriptions (monthly & yearly)

- **Cancel anytime** from Account settings. Cancellation stops future renewals; access continues until the end of the paid period you already paid for.
- **No partial refunds** for unused time on a cancelled period, except within the 7-day grace window described above.

## Lifetime plans

- Lifetime plans are covered by the same 7-day grace window.
- After 7 days, lifetime access is non-refundable unless the Service is discontinued; in that case we will provide a pro-rata refund of the remaining value.

## How to request a refund

1. Email **{{email}}** with the subject "Refund request", or use the in-app support channel.
2. Include the email address used for the purchase and the payment reference from your receipt.
3. We review requests within 3 business days. Approved refunds are returned to the original payment method within 5–10 business days, depending on your bank or payment provider.

## Failed or duplicate payments

- If a payment fails, no charge is made and no Pro access is granted; the checkout simply closes.
- If you are charged twice for the same plan, the duplicate charge is refunded automatically on request.

## Payment provider

Payments are processed by Razorpay. Their terms and refund handling also apply to the transaction itself.`;

const S = `## Digital product — no physical shipping

{{company}} is a fully digital service. There are no physical goods, so there is no physical shipping, handling or delivery cost.

## How you receive your purchase

- **Access is instant.** When your payment is confirmed, Pro access is activated on your account immediately — typically within seconds.
- **Receipt.** A payment receipt is issued by our payment provider (Razorpay) to the email address you used at checkout.
- **No carrier, no tracking.** Because nothing physical is sent, there is nothing to track and no shipping address is required.

## Delayed delivery

In rare cases (for example, a payment that was captured but whose confirmation event was delayed), access may take a few minutes to appear. If Pro access does not appear within 24 hours of a confirmed payment, email **{{email}}** with your payment reference and we will resolve it — including restoring access from our end.

## International orders

Because the product is digital, the same instant-delivery terms apply to every country. Any applicable taxes or currency conversion are handled by the payment provider at checkout.`;

export const POLICY_DEFAULTS: Record<PolicyId, string> = {
  terms: T,
  privacy: P,
  refunds: R,
  shipping: S
};
