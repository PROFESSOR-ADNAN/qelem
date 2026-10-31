# ADR 0012: Email Delivery Pipeline, Grace Delays, and Daily Provider Quota Guard

## Status
Accepted

## Context
Transactional and notification emails are delivered through a cloud email provider (e.g. Resend / Brevo) with a strict daily free-tier cap (100-300 emails/day). If notifications trigger instantaneous emails for every mention or reply, a user actively discussing code on the site will receive dozens of redundant emails, and the daily free quota will be rapidly depleted.

## Decision
1. **Tiered Email Prioritization**:
   - Priority 1 (Immediate): Account verification, password reset, security alerts. Sent instantly.
   - Priority 2 (Grace Delay): Mentions and replies. Delayed by 10 minutes. If the recipient reads the notification in-app before the 10-minute grace period expires, the email is dropped. Capped at 5/user/day.
   - Priority 3 (Batch Digest): Optional daily digest sent at 08:00 `Africa/Addis_Ababa`. Skipped if recipient was active in the app within the last 6 hours or if no new unread items exist.
2. **Provider Daily Quota Guard**:
   - A Redis daily counter `email:quota:YYYY-MM-DD` tracks sent emails against the provider limit minus a safety buffer (e.g., 90 out of 100).
   - When the quota guard triggers: Priority 1 emails are still processed (if buffer allows), Priority 2 and 3 are deferred to the next calendar day, and an alert is dispatched.
3. **Compliance & Deliverability**:
   - Every email includes RFC 8058 `List-Unsubscribe: <https://...>` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click` headers.
   - Bounce and complaint webhooks write to the `emailSuppressions` collection to block future deliveries to invalid addresses.
   - All domains configure SPF, DKIM, and DMARC alignment.

## Consequences
- Protects free-tier budget while delivering critical user communication.
- Prevents spamming users who are already actively engaged in the web application.
