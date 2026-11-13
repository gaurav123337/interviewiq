# Telegram job-status notifications

## What this fix sends

For a supported local auto-apply run, Telegram receives one message for each recorded **Submitted**, **Needs review**, or **Error** outcome, plus a run summary. Skipped, filtered and budget-capped decisions are summary counts, not a stream of individual messages.

Messages carry the original event date/time, the selected timezone and a UTC reference. Posting age is different from the application event time. “Submitted” means the engine detected its supported confirmation signal; it is not an independent employer receipt. An unconfirmed submission stays in review.

## Connect your own Telegram chat

1. Sign in with an active auto-apply add-on, Platinum access or applicable complimentary grant.
2. In Telegram, create your bot through **@BotFather**, then open that bot and send **/start**. For a group, add the bot and ensure it is allowed to send messages.
3. Find the numeric ID of your intended chat through Telegram tooling you trust. Group IDs can be negative. Do not paste bot tokens into this assistant conversation or into a browser address bar.
4. Open **Jobs → Auto-apply → review queue → Telegram**. Enter the chat ID, bot token and timezone.
5. Choose **Save and test**. Only a generic timestamped test is sent; your application history is not sent to a proposed destination.
6. Check that the test arrived in your intended chat. The application saves the connection only after Telegram acknowledges delivery. Successful delivery is not proof of who owns the chat.

A failed change preserves the previous connection. The stored token is never populated back into the browser form; leave the replacement-token field blank to keep it. **Test again** checks the current connection, and **Disconnect** removes it. Disconnect remains available after access expires.

Existing connections are preserved. A connection without a successful-test timestamp is not represented as delivery-tested; test it explicitly when ready.

## Update and resume your local runner

The website release does not update or restart a customer machine. Update your local repository checkout to the released `main` without discarding local changes. Install the lockfile dependencies with lifecycle scripts disabled, and use the documented pinned browser setup.

For a paired customer agent, keep its external binding configuration and your private candidate-profile file outside source control. Pair using `npm run apply:pair` if necessary; do not put the project service-role key on a customer machine.

Start with a **fill-only rehearsal**:

```bash
node scripts/auto-apply-jobs.js --agent-config "<external-binding-config>" --profile "<private-profile.json>" --url "<supported-board-URL>" --max 1 --dry-run
```

After checking your profile, session, site permission and review requirements, explicitly run the supported command when you intend application activity:

```bash
node scripts/auto-apply-jobs.js --agent-config "<external-binding-config>" --profile "<private-profile.json>" --url "<supported-board-URL>" --max 1
```

Existing owner-only workflows require explicit `--legacy-owner` rather than silently falling back to global credentials. Paired customer discovery/watch/listen/session supervisors remain unavailable in this fix. Do not expect Telegram ordinal commands for a paired agent; handle reviews in the website.

## Delivery and reporting limits

- A reporting or Telegram failure never resubmits a job or removes applied-job deduplication.
- Stable event references and occurrence times survive reporting retries.
- Pending database report metadata can be retried on a later supported run. Old Telegram job messages are not broadcast automatically.
- Telegram has no general exactly-once send API. An ambiguous acknowledgement remains **delivery unknown**, not definitely failed, and is not blindly resent.
- Notification failure/unknown state remains visible in local reporting, separately from the application outcome.
- A disconnected/offline runner cannot send messages. Saving a connection does not mean an engine is running.
- To avoid flooding a chat, one run allows at most 24 individual/legacy messages and reserves an extra summary attempt. Rate-limited or suppressed delivery stays visible in the report; the limit resets for the next run without ignoring Telegram's cooldown.
- Lock takeover uses an exclusive `.guard` file. If a machine crashes during acquisition and leaves `engine-cycle.lock.guard` or `pending-results.lock.guard`, recovery fails closed. Stop the relevant runner, inspect the matching report directory and confirm no worker is active before manually removing that guard. Do not delete another user's or a live worker's lock.

## Backend release

Apply only `supabase/migrations/20261113183000_telegram_notify.sql` and deploy `send-notify-test` through the targeted `scripts/rollout-telegram-notify.ps1` path after explicit production approval. Its default invocation is read-only metadata inspection; `-ConfirmedNotificationRelease` performs the approved targeted change, and `-FunctionsOnly` is reserved for reconciled function-only recovery.

Do not use the tenant-expansion runner or broad backend deploy to publish this fix. Ordinary frontend merge remains backend-free and publishes the same build to Pages and Wasmer. Deployment itself must not send Telegram messages, start engines, create bindings or broadcast historical applications.
