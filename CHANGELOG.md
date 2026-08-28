# Changelog

Version tracking for the MRK Hotels project. Format follows [Keep a Changelog](https://keepachangelog.com/)
and [Semantic Versioning](https://semver.org/).

## [1.3.0] - 2026-08-21

SaaS self-service portal release — customer registration, portal payments, full i18n.

### Added
- **Customer self-service portal** (`/portal`): dashboard, hotel details, subscription management, staff list, payments
- **Public pricing page** (`/portal/pricing`): DB-backed plans with no-cache headers, FAQ section, CTA to registration
- **Self-service registration** (`/portal/register`): Google-style form with TIN, VRN, business registration, country of registration
- **Customer login** (`/portal/login`): Google-style minimal form with password eye/slash toggle
- **Portal payments**: ClickPesa mobile money (M-Pesa, Tigo Pesa, Airtel Money, HaloPesa, EzyPesa) and bank transfer (CRDB, NMB, Stanbic, ABSA, NCBA, Equity)
- **Plan management**: Superadmin inline editing (price, trial days, features), dynamic plan filters from DB, create/delete with confirmation
- **Integration dashboard**: Superadmin read-only view of Booking.com/QuickBooks connection status per hotel
- **i18n**: 55+ new translation keys in `en.json` and `sw.json` for ReportsPage, PlansPage, TenantListPage, TenantDetailPage
- **Self-service tenant badges**: "Self Service" and "Trial" badges in superadmin tenant list, trial expiry dates

### Changed
- Plans now database-backed (`plans` table) — config/plans.php is seed source only
- Pricing links updated to `/portal/pricing` (TSCL MarketingLayout, not MRK StoreLayout)
- Registration endpoint accepts `plan` parameter, auto-generates subdomain from hotel name
- Number input arrows on PlansPage now trigger immediate save (`@change` instead of `@blur`)
- Password eye/slash toggle added to portal login and registration pages
- Developer documentation updated to v1.6 with SaaS portal and i18n sections

## [1.1.0] - 2026-08-15

Feature release on top of the v1.0.0 baseline.

### Added
- Set-PIN dialog now **auto-generates a random 4-digit PIN by default**, with
  re-roll and copy buttons; an admin can switch to typing the PIN manually
- **Eye toggles** on both manual PIN fields to reveal/hide what was typed
- Developer documentation: **§6.13 functionality catalog** — one logic loop per
  feature (frontend → backend → response → UI) across every module

### Changed
- Client action items, user manuals (EN/SW), developer documentation and the
  database ERD restamped to **v1.1.0**

## [1.0.0] - 2026-08-15

First versioned baseline. Captures the feature-complete state of the project
(guest SMS is deliberately **one-way**, hotel → guest).

### Added
- Dual-mode sign-in: password + iPOS-style 4-digit PIN (shared terminals)
- Full operations suite: dashboard, reservations, housekeeping, checkout,
  accounting, laundry, nearby staff, meetings & SOS alerts, reports
- Guest-facing online booking flow with invoice download
- Messaging: staff group chat and one-way guest SMS (Africa's Talking)
- i18n: English and Kiswahili
- STAAH channel-manager integration (settings, room/rate mapping, ARI push,
  reservation webhooks, reconciliation ledger, scheduled availability push)
- Documentation: user manuals (EN/SW), developer documentation, database ERD,
  client go-live action items

### Changed
- Guest SMS restricted to one-way (hotel → guest) only; inbound webhook disabled
- Documents now carry a code version and date stamp alongside edition/year

[1.0.0]: https://github.com/anomalyco/mrk-hotels-frontend/releases/tag/v1.0.0
[1.1.0]: https://github.com/anomalyco/mrk-hotels-frontend/releases/tag/v1.1.0
