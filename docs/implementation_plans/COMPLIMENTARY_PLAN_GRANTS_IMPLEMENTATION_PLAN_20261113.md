# Complimentary Plan Grants Implementation Plan

**Timestamp:** **2026-11-13T05:30:13Z (UTC) | 13-11-2026 11:00:13 (IST)**

## Overview

Let administrators give any paid InterviewIQ product to a user at no charge without opening a payment-provider checkout or creating misleading payment records. Support direct user grants and single-use gift codes for Monthly, Yearly, Lifetime, Platinum, and the auto-apply add-on.

## Current State

- Admin Billing can directly overwrite a user’s tier/plan and independently toggle the auto-apply add-on.
- Existing grant codes always produce a Pro entitlement and cannot grant Platinum or the add-on correctly.
- Coupons allow 100% discounts but still enter provider checkout, where zero/minimum amounts are provider-dependent.
- Direct grants overwrite the main entitlement, so revoking a free grant can accidentally remove paid access.
- Add-on activity predicates differ between entitlement, Telegram, and engine code.

## Implementation Phases

### 1. Complimentary grant ledger

- Add a separate `complimentary_grants` table with user, product, source, start/expiry, issuer/code, reason, revocation, and audit timestamps.
- Keep paid entitlements/payments unchanged.
- Add admin grant/revoke/list RPCs with explicit server-side authorization.

### 2. Canonical effective entitlement

- Compute the strongest active combination of paid and complimentary access in one server contract.
- Reuse that contract for `get_my_entitlement`, admin listings, auto-apply pairing, Telegram, and product gates.
- Revoking complimentary access must never remove paid access.
- Normalize auto-apply add-on expiry/active semantics and fix first-time add-on grants.

### 3. Gift codes

- Extend the single-use grant-code model with a product target.
- Redemption creates a complimentary grant, consumes the code atomically, and never creates a payment/subscription.
- Preserve existing unredeemed codes by mapping their existing plan/duration to the new gift semantics.
- Leave reusable free campaigns out of this delivery; ordinary coupons remain payment discounts.

### 4. Admin and user experience

- Add per-user complimentary product, expiry/lifetime, reason, and revoke controls to Admin → Billing.
- Extend the gift-code card to all products, including Platinum and auto-apply.
- Display `Complimentary` or `Gift` as the source and show expiry clearly.

## Technical Considerations

- Complimentary products are `monthly`, `yearly`, `lifetime`, `platinum`, and `auto_apply`.
- Monthly/yearly use their standard duration unless an administrator supplies a custom expiry.
- Lifetime/Platinum/add-on default to no expiry but may be time-limited by an explicit admin choice.
- Grant and redemption operations must be audited and idempotent at the transaction boundary.
- Existing paid rows and payment/refund logic remain authoritative for paid access.

## Success Criteria

- Every paid product can be granted directly or by one-time gift code without checkout.
- No complimentary grant creates a payment or subscription row.
- Paid access survives complimentary revocation.
- Expired/revoked gifts stop contributing to effective entitlement.
- First-time free users can receive the auto-apply add-on.
- Admin-only authorization, audit history, and client labels are covered by tests.

## Next Steps

1. Add the grant ledger and canonical entitlement SQL.
2. Update service types and Admin Billing controls.
3. Upgrade grant-code redemption to product-aware gift semantics.
4. Add regression coverage and include the schema in the staged live rollout.

## Completion Summary

**Completed:** **2026-11-13 (complimentary-plan owned slice)**

- Added `supabase/migrations/20261113_complimentary_grants.sql`: separate audited `complimentary_grants` ledger; additive product-aware gift-code columns; atomic single-use redemption; direct admin grant/revoke/list RPCs; canonical service-only auto-apply predicate; effective self/admin readers; and terminal paid add-on null/expiry normalization.
- Preserved the legacy entitlement fields and appended paid/complimentary provenance. `get_my_entitlement` adds `paid_tier`, `paid_plan`, `paid_expires_at`, `paid_source`, `complimentary`, `complimentary_grant_id`, `complimentary_product`, `complimentary_source`, and `complimentary_expires_at`. `admin_list_entitlements` exposes the same fields after its existing columns (plus `is_platinum` and `issued_by`).
- Updated the entitlement client mapping and Admin Billing UI: every product can be granted with standard/no-expiry/custom duration plus an audited reason; active Complimentary/Gift rows are listed and revoked independently; gift codes cover all five products; coupons remain checkout discounts.
- Added raw-SQL, service, and component regression tests. Focused result: **55 tests passed**; repository TypeScript typecheck passed. No live database apply, commit, push, dependency install, or deploy was performed.
- Integration completed: the notification test and paired-agent dispatch use canonical access and user-scoped data. The obsolete global resolver is service-only during expansion and revoked in the contract phase.
- Local PostgreSQL gift/pairing assertions passed: complimentary revoke preserves paid access, redemption creates no payment or paid entitlement row, gift/pairing codes are single-use, cross-user revocation is rejected, and durable limits enforce thresholds.
- Complimentary migration was included in the explicitly approved live backend expansion. Schema/effective readers verified; no grants or gift codes issued during rollout (complimentary row count 0; existing billing audit count 5 unchanged). The updated Admin Billing frontend is still local, not publicly released.
