Night Audit & Stayview Fixes Guide
==================================

Where to go and what changed

1) Night Audit (Reception)
   Path: Frontend > src/pages/reception/NightAuditPage.vue
   - Removed "Net Profit" column from history table.
   - After successful day close, business date is refreshed instantly (reloads business date store).
   - Close flow shows messages more directly.

2) New Booking Form (Stayview)
   Path: Frontend > src/pages/dashboards/HotelDashboard.vue
   - Guest lookup by phone/name with dropdown selection; selecting existing guest now fills names fully.
   - Country and City fields made wider in the form.
   - Group/multi-room: Vacant rooms and Selected rooms shown side by side with flex layout.
   - Number inputs have no spinner arrows (global CSS added).

3) Dark Mode
   Path: Frontend > src/assets/theme.css
   - Removed white backgrounds for checkboxes/radios in dark mode; added consistent dark styles.

4) Translations
   Paths: Frontend > src/locales/en.json, src/locales/sw.json
   - Added/updated guest lookup and stayview labels for both languages.

5) Prints/Margins
   Path: Frontend > src/pages/dashboards/HotelDashboard.vue
   - Invoice/folio prints use proper @page margins (no extra body padding).
