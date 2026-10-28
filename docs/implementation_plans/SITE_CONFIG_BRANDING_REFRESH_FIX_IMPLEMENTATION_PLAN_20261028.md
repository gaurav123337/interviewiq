# Site Config Branding Refresh Fix Implementation Plan

**Timestamp:** **2026-10-28T04:33:43Z (UTC) | 28-10-2026 10:03:44 (IST)**

## Overview

Ensure branding saved in Admin → Site Config (for example, changing the logo text from InterviewIQ to JobAssist) is loaded into and reflected by the app shell and landing page.

## Current State Analysis

- The admin form saves the `site_config` value to Supabase `app_config`.
- The app shell previously hardcoded its header and footer branding and did not subscribe to Site Config changes.
- The Landing page had site-config fields for the hero but rendered hardcoded translations instead.
- Admin save reset the service cache after save, defeating the optimistic publication path and leaving already-mounted consumers stale.

## Implementation Phases

1. Publish normalized site config values through a shared subscriber after loading and saving.
2. Subscribe the app shell and Landing page so header/footer/hero reflect loaded or newly saved settings.
3. Preserve defaults for missing nested config values and report save failure as before.
4. Add focused service tests for remote load, nested defaults, save publication, and offline behavior; run them and the project typecheck.

## Technical Considerations

- No new dependency or database schema is needed.
- Branding changes become visible in the current tab immediately after save; users in other tabs see changes on their next load (no cross-tab realtime listener is added).
- Existing app-config read/write security policy remains unchanged.

## Success Criteria

- Saved `logo.text` (e.g. JobAssist) reaches the header and is not overwritten by reset-cache behavior.
- Saved hero settings appear on the landing page.
- Missing nested fields continue to fall back to defaults.
- Focused tests and typecheck pass.
