# VAPID key rotation — QuranNoor daily-reminder push

## What the keys are and where they live

- The daily-reminder push worker (`workers/push-worker`) signs every push
  notification with a VAPID keypair (ECDSA P-256).
- The keypair is stored **only** in the Cloudflare KV namespace `PUSH_KV`
  (id `1468946869394dcc803dec2a6d5cb3d6`, bound in both `wrangler.toml` and
  `workers/push-worker/wrangler.toml`):
  - `vapid:public` — base64url-encoded P-256 public key (no padding).
  - `vapid:private` — base64url-encoded P-256 private scalar (no padding).
- The keys are **auto-generated on first run** by `generateVapidKeys()` in
  `workers/push-worker/src/index.ts` (WebCrypto `ECDSA` / `P-256`) when
  either key is missing from KV. They are never in code, never in git, and
  never in `wrangler.toml`.
- The public key is served to browsers by `GET /api/push/vapid-key`
  (`functions/api/push/vapid-key.ts`), which reads `vapid:public` from KV.
  The worker signs with both keys via `webpush.setVapidDetails()`.

## When to rotate

Only on suspected compromise of the private key (for example KV access by
an unauthorised party). VAPID keys do not expire, and there is no scheduled
rotation. Do not rotate for routine maintenance — rotation breaks every
existing subscription (see below).

## What breaks

- **All existing push subscriptions stop working.** A subscription is tied
  to the public key it was created with; the browser's push service rejects
  notifications signed with a different key.
- Every subscriber must **re-subscribe** (Reader Settings → Daily Reminder
  toggle off and back on) before they receive the daily reminder again.
- Stale subscriptions are cleaned up automatically: when the push service
  answers 410/404 the worker deletes that subscription from KV, so the
  dead entries disappear over the following days. Nothing else breaks —
  the site, the API proxy, and the contact form are unaffected.

## Rotation procedure

1. **Generate a new keypair** (do this locally, never in the repo):
   `npx web-push generate-vapid-keys`
   Record the `Public Key` and `Private Key` values (base64url, no padding).
2. **Pause the daily cron** while you swap the keys, so the worker cannot
   run mid-swap and auto-generate a different pair (it regenerates whenever
   either key is missing). In the Cloudflare dashboard, open the
   `qurannoor-push-worker` → Settings → Triggers and disable the
   `0 3 * * *` cron trigger. (Alternatively, do the swap in the minutes
   just after 03:00 UTC, when the next run is ~24 h away.)
3. **Write the new keys to KV** (namespace id `1468946869394dcc803dec2a6d5cb3d6`,
   private first, then public, with no delay between them):
   `wrangler kv:key put --namespace-id 1468946869394dcc803dec2a6d5cb3d6 vapid:private "<NEW_PRIVATE_KEY>"`
   `wrangler kv:key put --namespace-id 1468946869394dcc803dec2a6d5cb3d6 vapid:public "<NEW_PUBLIC_KEY>"`
   Never put either value in a file, a commit, or `wrangler.toml`.
4. **Verify the public key is live:**
   `curl https://qurannoor.com/api/push/vapid-key`
   It must return the new public key.
5. **Re-enable the cron trigger** from step 2.
6. **Test with one re-subscribed device:** toggle Daily Reminder off and
   on in Reader Settings on a test device, then confirm the next 07:00
   Dubai run delivers. (There is no manual "send test push" button; the
   next scheduled run is the test.)
7. **Tell users to re-subscribe.** Existing subscribers get nothing until
   they toggle Daily Reminder off and on again. A short note on the site
   or social channels is the only way to reach them — the old
   subscriptions cannot receive a "please re-subscribe" push.

## Known quirks (do not "fix" during a rotation)

- **First-write race:** if two worker invocations run while both keys are
  missing, each generates its own pair and the last write wins. That is why
  step 2 pauses the cron and step 3 writes both keys back-to-back.
- The worker only regenerates when a key is **missing**; writing a wrong or
  mismatched pair does not self-heal — verify step 4 before re-enabling
  the cron.
