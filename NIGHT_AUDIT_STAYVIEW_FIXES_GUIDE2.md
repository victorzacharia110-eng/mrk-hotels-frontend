Night Audit & Stayview Fixes (Simple Guide)
===========================================

Where to find what

1) Night Audit page
   Go to: Reception > Night Audit (/app/night-audit)
   - Removed "Net Profit" column from history.
   - When closing day, business date updates right away (Stayview updates too).
   - Due outs now show a "Go to Stayview" button so you can act quickly.
   - Messages show clearly after close.

2) New Booking (Stayview)
   Go to: Stayview > New Booking
   - Search existing guest by phone or first/last name with a list to pick from. Picking fills the form.
   - Country and City made wider.
   - Vacant rooms and Selected rooms shown side by side (flex).
   - Number inputs have no up/down arrows.
   - Translations added for both English and Swahili.

3) Dark mode
   Checkboxes/radios now look right in dark mode (no white boxes).

4) Prints
   Invoice prints have proper margins.

Files changed
- src/pages/reception/NightAuditPage.vue
- src/pages/dashboards/HotelDashboard.vue
- src/assets/theme.css
- src/locales/en.json
- src/locales/sw.json
- src/components/CountryCitySelect.vue
- src/components/SearchableSelect.vue
