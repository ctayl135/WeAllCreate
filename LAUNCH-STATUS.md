# WeAllCreate release and launch status

The original logo, purple/cyan branding, dark theme and GitHub history are preserved. Work is on `development`; main has not been replaced or deployed. The repository is `ctayl135/WeAllCreate`.

## Implemented

- Accounts, secure sessions, email verification and single-use password recovery.
- Creator profiles, cover uploads, availability, portfolios and creator shops.
- Digital and service listings, management, search, filters, buyer/seller orders and confirmed-buyer reviews.
- Private messages, unread markers, refreshable inbox, community posts/comments/likes, group membership, collaboration applications and booking requests.
- Reports, reversible content hiding, account suspension/restoration and an administration audit log. Administrators require verified email and the server-side ADMIN_EMAILS allowlist; the first registrant is never automatically an administrator.
- Private uploaded PDF/ZIP/image deliverables and public PNG/JPEG/WebP images. Files are limited to 12 MB, with a 120 MB per-account allowance. Production publishing requires verified email. Private download links are buyer-bound, expire after five minutes, and check confirmed order status.
- Test-only Stripe Checkout, Accounts v2 onboarding with full creator Stripe Dashboard access, Stripe-managed seller risk, direct creator payments, subscriptions and billing portal. Webhooks verify signatures/timestamps, handle duplicates and payment failure/expiry, and restrict downloads after refunds or disputes. Live keys are rejected.
- Migration tracking, encrypted SQLite/upload backups, tested restore, health checks, structured error logs, Docker/Caddy, Railway configuration and GitHub Actions tests/container build.

Live views exclude example creators, invented messages and fake engagement. Original sample content remains in legacy source for reference.

## Verification

Seven automated scenarios pass with `node --test`: account authorization, email recovery, restart persistence, full creator/social/admin journey, checkout/delivery, subscription lifecycle and encrypted backup/restore. Browser checks cover signup, profile editing, service publication, portfolio image upload/publication, community posting, creator search and mobile navigation. Script syntax checks pass.

Automated suite Stripe responses are simulated. Website follow-up checks also verify mobile profile save, portfolio project editing with its existing image retained, service search combined with price filters, and no browser console errors. The country field serialization bug and unselected-creator booking entry point are fixed.

Separate real sandbox checks passed: website signup and hosted subscription checkout creation, a successful test-card payment, a declined test card, a test refund, a Stripe-managed-risk connected creator account, and a hosted onboarding link, an active test subscription, billing portal creation and scheduled cancellation. The subscription fixture was then canceled. The test creator remains restricted pending its onboarding requirements. Connected-creator purchases, actual webhook delivery, completed subscription checkout/renewal, real email delivery and public deployment are not yet verified. Docker is unavailable locally; GitHub Actions has successfully built the container and passed the application tests. The workflow also runs a production-container smoke test for static assets, secure cookies, verified-email publishing restrictions, persistent-volume writes and session persistence after a container restart.

## Hosting and access

Railway was initially selected: one Docker service, one persistent volume at `/app/data`, a generated HTTPS address, and no separate database service. Its Hobby plan has a $5 monthly minimum that counts toward usage; resource usage can cost more. No paid service or domain purchase has been approved or provisioned.

Railway signup is confirmed disabled in its authentication screen. Render is the prepared fallback: Starter Docker web service plus 1 GB persistent disk, approximately $7.25/month before extra usage/taxes. `render.yaml` defines the development branch, one instance, Virginia region, health check, persistent data mount, manual deployments and secret prompts. The owner approved this base cost and private test credential/backup-key transfer. Browser sign-in works, and the service creation form has the approved settings; Render requires a payment card before creating the service. The owner explicitly deferred that payment/hosting step to focus on the website. No service is deployed and no payment card was entered by the agent.

GitHub access is available. Railway account calls currently fail. A separate United States business named WeAllCreate and its WeAllCreate sandbox have now been created through Stripe's official claim flow. Catalog access works, and sandbox-only subscription fixtures have been created. The owner approved a restricted sandbox-only integration key, which is stored privately outside Git. The broader CLI sign-in session was revoked; no live key is stored for this project. The unrelated `untitled.stream` account was explicitly declined and must not be used.

## Secure configuration

Set these through the host's secret manager, never in Git, client code, Docker build arguments or chat:

| Variable | Value |
| --- | --- |
| NODE_ENV | production |
| APP_ORIGIN | Exact generated HTTPS origin; Render uses RENDER_EXTERNAL_URL when unset |
| DATABASE_PATH | /app/data/weallcreate.sqlite |
| TRUST_PROXY | render on Render; railway on Railway; caddy behind the bundled VPS proxy |
| STRIPE_SECRET_KEY | Approved WeAllCreate sandbox's restricted test key; never a live key |
| STRIPE_WEBHOOK_SECRET | Platform test webhook signing secret |
| STRIPE_CONNECT_WEBHOOK_SECRET | Connected-account test webhook signing secret |
| STRIPE_PRICE_ID | Approved recurring Creator Pro test price |
| RESEND_API_KEY | Email sending key |
| EMAIL_FROM | Verified sender/domain |
| ADMIN_EMAILS | Operator's verified website-account emails |
| SUPPORT_EMAIL | Owner-selected public support address |
| BACKUP_ENCRYPTION_KEY | Unique 32-byte key encoded as 64 hexadecimal characters |

`node --env-file-if-exists=.env preflight.mjs` checks required configuration and prints only missing names/errors, never secrets. Configure email before opening public registration. Keep one replica because SQLite is on a local volume. Verify UID 1000 can write to the mounted volume; do not replace/delete a populated volume to fix permissions. Render and Railway manage HTTPS; the Caddy Compose service is for a VPS only.

## Stripe acceptance checks

Register signed webhook delivery to `/api/stripe/webhook` from both the platform account (subscriptions) and connected accounts (direct creator purchases). Create two test webhook destinations at that URL: one for platform events and one for connected-account events. Store their signing secrets separately as STRIPE_WEBHOOK_SECRET and STRIPE_CONNECT_WEBHOOK_SECRET, and verify both sources end to end. Subscribe to checkout.session.completed, checkout.session.async_payment_succeeded, checkout.session.async_payment_failed, checkout.session.expired, customer.subscription.created, customer.subscription.updated, customer.subscription.deleted, charge.refunded and charge.dispute.created.

Create separate test seller/buyer accounts, verify email, publish a portfolio, digital file and service, and finish Connect test onboarding. Test approved/declined cards, abandoned checkout, order states, private downloads, service purchases/messages, reviews, subscription renewal/failure/cancellation and webhook retries. A return redirect never grants purchase access.

No commission is configured. Buyers pay creators directly on their connected Stripe accounts. Creators receive full Stripe Dashboard access; Stripe collects its fees and manages unrecoverable seller payment losses. WeAllCreate Creator Pro subscriptions are separate platform-account charges. Final Creator Pro price/benefits, refunds, disputes and seller terms remain owner decisions before real billing. Live activation requires a separate approved implementation change.

## Backups and monitoring

With BACKUP_ENCRYPTION_KEY configured, encrypted consistent SQLite and referenced-upload snapshots run shortly after startup and daily. They use AES-256-GCM with a manifest under `/app/data/backups`. Logs record completion/failure; unexpected app errors return an incident ID without private message/password/secret content. `/api/health` supports uptime monitoring.

Keep the encryption key outside the volume. Enable provider volume backups and copy encrypted snapshots off-volume; same-volume snapshots do not protect against disk loss. Backup schedules, off-volume storage, alert destination and retention require account access/operator choices. Backups are not automatically deleted. The restore test verifies database/file contents and rejects a wrong key. `node restore.mjs BACKUP_DIRECTORY NEW_DESTINATION` restores and verifies the database and files using BACKUP_ENCRYPTION_KEY, and refuses an existing destination. Verify recovery before changing production data.

## Remaining public-launch gates

1. Resume the owner-deferred Render payment-card step for the approved Starter service with 1 GB disk (approximately $7.25/month before extra usage/taxes). Verify Docker build, volume writes and HTTPS deployment.
2. Finish test creator onboarding, verify direct creator purchases and both platform/Connect webhooks, and complete subscription lifecycle checks. Restricted sandbox key access and real basic payment tests now work.
3. Configure verified email delivery, administrator identity and support address.
4. Approve pricing/benefits, seller terms, privacy/retention requirements and refund/chargeback policy. The site contains factual platform/privacy information, not jurisdiction-specific legal terms.
5. Configure off-volume backups and monitoring alerts. ZIP/PDF malware scanning is not implemented; type limits and attachment delivery are enforced.
6. Run the final deployed buyer/seller/mobile smoke test. No successful public deployment has yet been verified.

## Local operation

Node.js 24; no dependencies to install. Run `node --env-file-if-exists=.env server.mjs`, open http://localhost:3000, and run `node --test` for verification. Do not open index.html directly.

## Provider references

- [Render pricing](https://render.com/pricing)
- [Render Blueprint configuration](https://render.com/docs/blueprint-spec)
- [Render persistent disks](https://render.com/docs/disks)
- [Railway billing](https://docs.railway.com/pricing/understanding-your-bill)
- [Railway volume backups](https://docs.railway.com/volumes/backups)
- [Stripe direct charges](https://docs.stripe.com/connect/direct-charges)
- [Stripe webhook handling](https://docs.stripe.com/events/manage-webhook-endpoints)
- [Resend sending API](https://resend.com/docs/api-reference/emails/send-email)
