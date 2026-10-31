# WeAllCreate release and launch status

The original logo, purple/cyan branding, dark theme and GitHub history are preserved. Work is on `development`; main has not been replaced or deployed. The repository is `ctayl135/WeAllCreate`.

## Implemented

- Accounts, secure sessions, email verification and single-use password recovery.
- Creator profiles, cover uploads, availability, portfolios and creator shops.
- Digital and service listings, management, search, filters, buyer/seller orders and confirmed-buyer reviews.
- Private messages, unread markers, refreshable inbox, community posts/comments/likes, group membership, collaboration applications and booking requests.
- Reports, reversible content hiding, account suspension/restoration and an administration audit log. Administrators require verified email and the server-side ADMIN_EMAILS allowlist; the first registrant is never automatically an administrator.
- Private uploaded PDF/ZIP/image deliverables and public PNG/JPEG/WebP images. Files are limited to 12 MB, with a 120 MB per-account allowance. Production publishing requires verified email. Private download links are buyer-bound, expire after five minutes, and check confirmed order status.
- Test-only Stripe Checkout, Express Connect onboarding, destination payments, subscriptions and billing portal. Webhooks verify signatures/timestamps, handle duplicates and payment failure/expiry, and restrict downloads after refunds or disputes. Live keys are rejected.
- Migration tracking, encrypted SQLite/upload backups, tested restore, health checks, structured error logs, Docker/Caddy, Railway configuration and GitHub Actions tests/container build.

Live views exclude example creators, invented messages and fake engagement. Original sample content remains in legacy source for reference.

## Verification

Seven automated scenarios pass with `node --test`: account authorization, email recovery, restart persistence, full creator/social/admin journey, checkout/delivery, subscription lifecycle and encrypted backup/restore. Browser checks cover signup, profile editing, service publication, portfolio image upload/publication, community posting, creator search and mobile navigation. Script syntax checks pass.

Stripe responses in tests are simulated. Real sandbox transactions, real email delivery, the Docker build and public deployment still require provider access. Docker is unavailable locally; the GitHub workflow builds the container on a hosted runner and must be checked after pushing.

## Hosting and access

Railway is the selected low-cost starting host: one Docker service, one persistent volume at `/app/data`, a generated HTTPS address, and no separate database service. Its Hobby plan has a $5 monthly minimum that counts toward usage; resource usage can cost more. No paid service or domain purchase has been approved or provisioned.

GitHub access is available. Railway account calls currently fail. The visible Stripe account `untitled.stream` was explicitly declined by the owner and must not be used. Connect the intended WeAllCreate Stripe test account before creating provider resources or testing payments.

## Secure configuration

Set these through the host's secret manager, never in Git, client code, Docker build arguments or chat:

| Variable | Value |
| --- | --- |
| NODE_ENV | production |
| APP_ORIGIN | Exact generated HTTPS origin, without a trailing slash |
| DATABASE_PATH | /app/data/weallcreate.sqlite |
| TRUST_PROXY | railway on Railway; caddy only behind the bundled VPS proxy |
| STRIPE_SECRET_KEY | Approved WeAllCreate account's sk_test_ key |
| STRIPE_WEBHOOK_SECRET | Approved test webhook signing secret |
| STRIPE_PRICE_ID | Approved recurring Creator Pro test price |
| RESEND_API_KEY | Email sending key |
| EMAIL_FROM | Verified sender/domain |
| ADMIN_EMAILS | Operator's verified website-account emails |
| SUPPORT_EMAIL | Owner-selected public support address |
| BACKUP_ENCRYPTION_KEY | Unique 32-byte key encoded as 64 hexadecimal characters |

`node --env-file-if-exists=.env preflight.mjs` checks required configuration and prints only missing names/errors, never secrets. Configure email before opening public registration. Keep one replica because SQLite is on a local volume. Verify UID 1000 can write to the mounted volume; do not replace/delete a populated volume to fix permissions. Railway manages HTTPS; the Caddy Compose service is for a VPS only.

## Stripe acceptance checks

Register `/api/stripe/webhook` for checkout.session.completed, checkout.session.async_payment_succeeded, checkout.session.async_payment_failed, checkout.session.expired, customer.subscription.created, customer.subscription.updated, customer.subscription.deleted, charge.refunded and charge.dispute.created.

Create separate test seller/buyer accounts, verify email, publish a portfolio, digital file and service, and finish Connect test onboarding. Test approved/declined cards, abandoned checkout, order states, private downloads, service purchases/messages, reviews, subscription renewal/failure/cancellation and webhook retries. A return redirect never grants purchase access.

No commission is configured. Final Creator Pro price/benefits, refund funding and transfer-reversal operations remain owner decisions before real billing. Live activation requires a separate approved implementation change.

## Backups and monitoring

With BACKUP_ENCRYPTION_KEY configured, encrypted consistent SQLite and referenced-upload snapshots run shortly after startup and daily. They use AES-256-GCM with a manifest under `/app/data/backups`. Logs record completion/failure; unexpected app errors return an incident ID without private message/password/secret content. `/api/health` supports uptime monitoring.

Keep the encryption key outside the volume. Enable provider volume backups and copy encrypted snapshots off-volume; same-volume snapshots do not protect against disk loss. Backup schedules, off-volume storage, alert destination and retention require account access/operator choices. Backups are not automatically deleted. The restore test verifies database/file contents and rejects a wrong key. `node restore.mjs BACKUP_DIRECTORY NEW_DESTINATION` restores and verifies the database and files using BACKUP_ENCRYPTION_KEY, and refuses an existing destination. Verify recovery before changing production data.

## Remaining public-launch gates

1. Complete Railway authorization and approve any paid plan/usage. Verify Docker build, volume writes and HTTPS deployment.
2. Connect the correct Stripe account, securely configure its key, and run real sandbox buyer/seller transactions.
3. Configure verified email delivery, administrator identity and support address.
4. Approve pricing/benefits, seller terms, privacy/retention requirements and refund/chargeback policy. The site contains factual platform/privacy information, not jurisdiction-specific legal terms.
5. Configure off-volume backups and monitoring alerts. ZIP/PDF malware scanning is not implemented; type limits and attachment delivery are enforced.
6. Run the final deployed buyer/seller/mobile smoke test. No successful public deployment has yet been verified.

## Local operation

Node.js 24; no dependencies to install. Run `node --env-file-if-exists=.env server.mjs`, open http://localhost:3000, and run `node --test` for verification. Do not open index.html directly.

## Provider references

- [Railway billing](https://docs.railway.com/pricing/understanding-your-bill)
- [Railway volume backups](https://docs.railway.com/volumes/backups)
- [Stripe destination charges](https://docs.stripe.com/connect/destination-charges)
- [Stripe webhook handling](https://docs.stripe.com/events/manage-webhook-endpoints)
- [Resend sending API](https://resend.com/docs/api-reference/emails/send-email)
