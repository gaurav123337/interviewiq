# Site Configuration Complete Refresh Implementation Plan

**Timestamp:** **2026-10-28T05:22:25Z (UTC) | 28-10-2026 10:52:25 (IST)**

## Overview

Make every Site Config section editable in Admin and ensure saved branding, navigation, footer, hero, visibility, and SEO values reach their live browser consumers immediately and persist across reloads.

## Current State

- `site_config` is stored as one `app_config` JSON value. Branding is consumed by the app shell and landing page; navigation and footer settings had partially hardcoded consumers.
- The Visibility tab uses a separate `menuVisibility` remote-config setting; partial remote-config writes must retain all unrelated config groups.
- Some menu entries carried ids that were not selectable/editable in the Site Config form, and route safety/normalization could silently discard or fail to apply configured values.

## Implementation

1. Normalize saved and legacy config values while retaining defaults for missing nested fields; keep valid empty navigation lists empty.
2. Propagate config to the shell and landing page, including metadata, links, logo/fav icon, header, menus, footer and hero CTAs.
3. Make tab destinations/order and footer-link details editable, and preserve visibility settings in the existing remote-config persistence path.
4. Verify with focused service and remote-config tests, project typecheck, and production build.

## Technical Considerations

- No schema migration, new service, or dependency is required. Supabase remains the source of truth; the existing local remote-config cache remains the offline fallback for visibility settings.
- Browser metadata updates after the client app loads. Social crawlers that only read initial HTML still need a static build metadata change for equivalent previews.
- Only HTTP(S), mailto, tel, and known same-app hash routes are followed from configurable links.

## Success Criteria

- Renaming the brand (e.g. InterviewIQ to JobAssist) updates default-derived footer, hero description, title, app metadata, header and landing content, while user-customized text remains untouched.
- All configuration sections apply after save and remain applied after reloading.
- Configured navigation destinations and footer hashes route to the intended views.
- A visibility-only update does not erase feature flags or other remote settings.
- Focused tests, typecheck and production build pass.

## Completion Summary

- Updated the config service to normalize routes and propagate default-derived branding on save without replacing custom copy.
- Connected the application shell and landing page to saved navigation, footer, hero, branding and metadata values; added safe configured-link handling and removed redundant destinations from the More menu.
- Made route destinations, ordering, adding/removing navigation entries, footer hashes, and visibility persistence editable in Admin.
- Added coverage for remote-config merge behavior, branding persistence/derived copy, and empty or invalid configured routes.

### Follow-up: every section, not just the header

The first pass wired all consumers, but only the app shell actually reacted to saved values. `subscribeSiteConfig` waited for the *next* publish, so lazily loaded routes (Landing, Legal) that mount after `loadSiteConfig()` already resolved stayed on defaults — the header showed the saved brand while the hero, footer, legal footer and metadata kept the shipped copy.

- `subscribeSiteConfig` now replays the current snapshot to new listeners, so a component mounted later immediately renders the saved config instead of waiting for another save.
- The Visibility tab re-reads the published map when remote config lands, guarded by a dirty flag so unsaved toggles are never overwritten.
- The pricing card's free CTA and the desktop ☰ / mobile "More" entries now follow configuration too; an emptied More menu hides both buttons instead of opening an empty popover.

### Verification (2026-10-30)

- `npm run typecheck` — clean.
- `npm test` — 124 files, 1772 tests passing.
- `npm run build` — production build succeeds.
- Not checked: a live Supabase round-trip and the GitHub Pages deploy; the panel's save path was verified through the mocked service tests only.
