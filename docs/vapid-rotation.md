# VAPID key rotation — QuranNoor daily-reminder push

## What the keys are and where they live

- The daily-reminder push worker (`workers/push-worker`) signs every push
  notification with a VAPID keypair (ECDSA P-256).
- The keypair is stored **only** in the Cloudflare KV namespace `PUSH_KV`
  (id `1468946869394dcc803dec2a6d5cb3d6`, bound in both `wrangler.toml` and
  `workers/push-worker/wrangler.toml`):
  - `vapid:public` — base64url-encoded P-256 public key (no padding).
  - `vapid:private` — base64url-encoded P-256 private scalar (no padding).
- The keys are **created once manually** and written to KV (see
  "First-time setup" below). They are never in code, never in git, and
  never in `wrangler.toml`.
- The worker **only reads** the keys from KV — it never generates them.
  `ensureVapidKeys()` in `workers/push-worker/src/index.ts` throws (fails
  loudly) if either half is missing instead of silently regenerating a
  pair (see "Incomplete keypair" below). First-run auto-generation was
  removed in the re-audit (L-7): KV has no atomic compare-and-set, so a
  lease/lock could not prevent two concurrent first runs from generating
  different pairs, and regenerating when only one half was missing
  discarded the surviving half and invalidated every live subscription.
- The public key is served to browsers by `GET /api/push/vapid-key`
  (`functions/api/push/vapid-key.ts`), which reads `vapid:public` from KV.
  It returns 503 while the key is not initialised. The worker signs with
  both keys via `webpush.setVapidDetails()`.

## First-time setup

Do this once, before the first scheduled push run (or if both keys were
ever deleted from KV):

1. **Generate a keypair** (locally, never in the repo):
   `npx web-push generate-vapid-keys`
   Record the `Public Key` and `Private Key` values (base64url, no padding).
2. **Write both halves to KV** (namespace id `1468946869394dcc803dec2a6d5cb3d6`,
   private first, then public, with no delay between them):
   `wrangler kv:key put --namespace-id 1468946869394dcc803dec2a6d5cb3d6 vapid:private "<NEW_PRIVATE_KEY>"`
   `wrangler kv:key put --namespace-id 1468946869394dcc803dec2a6d5cb3d6 vapid:public "<NEW_PUBLIC_KEY>"`
   Never put either value in a file, a commit, or `wrangler.toml`.
3. **Verify the public key is live:**
   `curl https://qurannoor.com/api/push/vapid-key`
   It must return the new public key (200). A 503 here means the key was
   not written.
4. **Test with one subscribed device:** the next 07:00 Dubai run should
   deliver the daily reminder. (There is no manual "send test push"
   button; the next scheduled run is the test.)

Until both halves are in KV, the worker throws on every run and sends
nothing — this is intentional (fail loudly, not silently broken).

## Incomplete keypair (only one half in KV)

- **Symptom:** the worker throws `VAPID keypair is incomplete in KV...`
  in the Workers logs and no daily reminders go out. `GET
  /api/push/vapid-key` still returns the stored public half if it is the
  one present (or 503 if the public half is the missing one).
- **Cause:** one half was deleted or overwritten by mistake, or a rotation
  was interrupted between the two KV writes.
- **Recovery:** restore the missing half from your backup of the keypair.
  Do NOT generate a fresh pair to fill the gap — a fresh pair would not
  match the surviving half, and subscriptions are tied to the public key
  they were created with. If the missing half is unrecoverable, treat it
  as a rotation (below): generate a new pair, write BOTH halves, and tell
  users to re-subscribe.
- The worker deliberately does **not** self-heal this state.

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
2. **Pause the daily cron** while you swap the keys, so no run executes
   mid-swap and throws on the temporarily incomplete pair (a run between
   the two KV writes would send nothing that day). In the Cloudflare
   dashboard, open the `qurannoor-push-worker` → Settings → Triggers and
   disable the `0 3 * * *` cron trigger. (Alternatively, do the swap in the
   minutes just after 03:00 UTC, when the next run is ~24 h away.)
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

- **No auto-generation:** the worker never writes keys. If both halves are
  missing it throws; if only one half is present it throws. The old
  first-write race (two concurrent runs generating different pairs, last
  write wins) is gone because nothing generates anymore — but that also
  means a fresh environment sends no pushes until the manual first-time
  setup above is done.
- The worker only regenerates nothing — writing a wrong or mismatched pair
  does not self-heal; verify step 4 before re-enabling the cron.
