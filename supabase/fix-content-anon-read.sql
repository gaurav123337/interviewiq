/* Fix: anonymous visitors can no longer read the Content CMS tables.

   fix-is-owner.sql revoked EXECUTE on public.is_admin() from anon, public
   (correct — anon never calls it directly as an RPC). But each CMS table's
   "_admin_all" policy is still evaluated for EVERY role: Postgres OR-combines
   permissive policies, so an anonymous SELECT on these tables evaluates
   public.is_admin() too and dies with 42501 "permission denied for function
   is_admin".

   app_config/announcements/published_questions escape only because their
   public-read policy is `using (true)`, which constant-folds the OR away;
   the CMS policies use non-constant conditions (`published = true`) that
   can't fold. Net effect: every fresh browser fell back to its per-origin
   localStorage cache, so Content CMS edits never showed on the live site and
   first-time visitors saw no banners/testimonials at all.

   Fix without re-granting EXECUTE to anon: scope the policies by role.
   - public-read policies -> TO anon, authenticated (anon only ever evaluates
     this one, so is_admin() is never touched)
   - the admin policies -> TO authenticated (is_admin() is granted to
     authenticated + service_role per fix-is-owner.sql; signed-in non-admins
     see public rows via the public-read policy, admins see everything via
     this one). service_role bypasses RLS, so it needs no policy of its own.

   Verified against live DB: all five tables returned 42501 for anon before.
   Idempotent: drop-if-exists then re-create. Re-run in the Supabase SQL
   editor any time the policies drift again. */

DROP POLICY IF EXISTS "testimonials_public_read" ON admin_testimonials;
CREATE POLICY "testimonials_public_read" ON admin_testimonials
  FOR SELECT TO anon, authenticated USING (published = true);
DROP POLICY IF EXISTS "testimonials_admin_all" ON admin_testimonials;
CREATE POLICY "testimonials_admin_all" ON admin_testimonials
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "ads_public_read" ON admin_ads;
CREATE POLICY "ads_public_read" ON admin_ads
  FOR SELECT TO anon, authenticated USING (published = true);
DROP POLICY IF EXISTS "ads_admin_all" ON admin_ads;
CREATE POLICY "ads_admin_all" ON admin_ads
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "resources_public_read" ON admin_resources;
CREATE POLICY "resources_public_read" ON admin_resources
  FOR SELECT TO anon, authenticated USING (published = true);
DROP POLICY IF EXISTS "resources_admin_all" ON admin_resources;
CREATE POLICY "resources_admin_all" ON admin_resources
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "tips_public_read" ON admin_tips;
CREATE POLICY "tips_public_read" ON admin_tips
  FOR SELECT TO anon, authenticated USING (enabled = true);
DROP POLICY IF EXISTS "tips_admin_all" ON admin_tips;
CREATE POLICY "tips_admin_all" ON admin_tips
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "banners_public_read" ON admin_banners;
CREATE POLICY "banners_public_read" ON admin_banners
  FOR SELECT TO anon, authenticated USING (published = true);
DROP POLICY IF EXISTS "banners_admin_all" ON admin_banners;
CREATE POLICY "banners_admin_all" ON admin_banners
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
