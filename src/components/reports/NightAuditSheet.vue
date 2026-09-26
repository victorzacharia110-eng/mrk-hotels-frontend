<!--
  Night Audit sheet — the printed daily close document.

  Renders the full legacy "Night Audit" layout (Room Charges, Checked Out,
  Daily Sales, Receipts, Misc. Charges, Room Status, Pax Status, Pax Analysis
  and the POS summaries) fed by the backend `nightAuditApi.report` `.sheet`
  payload. Used twice from the Report Browser:

    - variant="screen" → the on-screen report preview (`na-screen`).
    - variant="print"  → the hidden A4-landscape print document (`na-sheet`).

  Figures arrive pre-rounded from the API; this component only formats them.
  Columns/captions intentionally match the printed hotel sheet so a printed
  copy is identical to the reference document.
-->
<template>
  <div :class="variant === 'print' ? 'na-sheet' : 'na-screen'">
    <!-- The whole document sits inside a frame table so the printed sheet can
         repeat the brand head on every page (like the reference document);
         the meta line sits in the body and only prints once, on page 1. -->
    <table class="na-frame">
      <thead>
        <tr>
          <th class="na-frame-head">
            <div v-if="showBrand" class="na-brand">
              <div class="na-brand-left">
                <img v-if="logoUrl" :src="logoUrl" class="na-logo" alt="" />
                <div>
                  <div class="na-hotel">{{ hotelName }}</div>
                  <div class="na-title">{{ title }}</div>
                </div>
              </div>
              <span v-if="closed" class="na-closed">Closed</span>
            </div>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
    <div v-if="showBrand" class="na-meta">
      <span>As On Date: <b>{{ dateLabel }}</b></span>
      <span>Currency <b>TSh</b></span>
    </div>

    <!-- ══ 1 · Room Charges ══ -->
    <section class="na-sec-block">
      <h3 class="na-sec-title">Room Charges</h3>
      <table class="na-table">
        <thead>
          <tr>
            <th>Room</th>
            <th>Folio No.</th>
            <th>Guest</th>
            <th>Source</th>
            <th>Company</th>
            <th>Rent Date</th>
            <th>Rate Type</th>
            <th class="num">Nrml.Tariff (TSh)</th>
            <th class="num">Ofrd.Tariff (TSh)</th>
            <th class="num">Total Tax (TSh)</th>
            <th class="num">Total Rent (TSh)</th>
            <th class="num">Var %</th>
            <th>Checkin By</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(r, i) in sheet.room_charges.rows" :key="'rc' + i">
            <td>{{ r.room }}</td>
            <td>{{ r.folio_no }}</td>
            <td>{{ r.guest }}</td>
            <td>{{ text(r.source) }}</td>
            <td>{{ text(r.company) }}</td>
            <td>{{ r.rent_date }}</td>
            <td>{{ text(r.rate_type) }}</td>
            <td class="num">{{ money(r.normal_tariff) }}</td>
            <td class="num">{{ money(r.offered_tariff) }}</td>
            <td class="num">{{ money(r.tax) }}</td>
            <td class="num">{{ money(r.total_rent) }}</td>
            <td class="num">{{ pct(r.var_pct) }}</td>
            <td>{{ text(r.checkin_by) }}</td>
          </tr>
          <tr v-if="sheet.room_charges.rows.length" class="na-total">
            <td colspan="7">Total (TSh)</td>
            <td class="num">{{ money(sheet.room_charges.totals.normal) }}</td>
            <td class="num">{{ money(sheet.room_charges.totals.offered) }}</td>
            <td class="num">{{ money(sheet.room_charges.totals.tax) }}</td>
            <td class="num">{{ money(sheet.room_charges.totals.total) }}</td>
            <td class="num">{{ pct(sheet.room_charges.totals.var_pct) }}</td>
            <td></td>
          </tr>
          <tr v-if="sheet.room_charges.rows.length === 0">
            <td colspan="13" class="na-empty">No rooms were charged for this date.</td>
          </tr>
        </tbody>
      </table>
      <div v-if="sheet.room_charges.total_rooms" class="na-rows-count">Total <b>{{ sheet.room_charges.total_rooms }}</b></div>
    </section>

    <!-- ══ 2 · Checked Out ══ -->
    <section class="na-sec-block">
      <h3 class="na-sec-title">Checked Out</h3>
      <table class="na-table">
        <thead>
          <tr>
            <th>Room</th>
            <th>Guest</th>
            <th>Invoice No</th>
            <th>Arrival</th>
            <th>Departure</th>
            <th class="num">Nights</th>
            <th class="num">Room Charges (TSh)</th>
            <th class="num">Extra Charges (TSh)</th>
            <th class="num">Discount (TSh)</th>
            <th class="num">Adjust (TSh)</th>
            <th class="num">Tax (TSh)</th>
            <th class="num">Payment (TSh)</th>
            <th class="num">Balance (TSh)</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(r, i) in sheet.checked_out.rows" :key="'co' + i">
            <td>{{ r.room }}</td>
            <td>{{ r.guest }}</td>
            <td>{{ text(r.invoice_no) }}</td>
            <td>{{ r.arrival }}</td>
            <td>{{ r.departure }}</td>
            <td class="num">{{ r.nights }}</td>
            <td class="num">{{ money(r.room_charges) }}</td>
            <td class="num">{{ money(r.extra_charges) }}</td>
            <td class="num">{{ money(r.discount) }}</td>
            <td class="num">{{ money(r.adjust) }}</td>
            <td class="num">{{ money(r.tax) }}</td>
            <td class="num">{{ money(r.payment) }}</td>
            <td class="num">{{ money(r.balance) }}</td>
          </tr>
          <tr v-if="sheet.checked_out.rows.length" class="na-total">
            <td colspan="6">Total (TSh)</td>
            <td class="num">{{ money(sheet.checked_out.totals.room_charges) }}</td>
            <td class="num">{{ money(sheet.checked_out.totals.extra) }}</td>
            <td class="num">{{ money(sheet.checked_out.totals.discount) }}</td>
            <td class="num">{{ money(sheet.checked_out.totals.adjust) }}</td>
            <td class="num">{{ money(sheet.checked_out.totals.tax) }}</td>
            <td class="num">{{ money(sheet.checked_out.totals.payment) }}</td>
            <td class="num">{{ money(sheet.checked_out.totals.balance) }}</td>
          </tr>
          <tr v-if="sheet.checked_out.rows.length === 0">
            <td colspan="13" class="na-empty">No guests checked out on this date.</td>
          </tr>
        </tbody>
      </table>
      <div v-if="sheet.checked_out.count" class="na-rows-count">Total <b>{{ sheet.checked_out.count }}</b></div>
    </section>

    <!-- ══ 3 · Daily Sales ══ -->
    <section class="na-sec-block">
      <h3 class="na-sec-title">Daily Sales</h3>
      <table class="na-table">
        <thead>
          <tr>
            <th>Sales Type</th>
            <th class="num">Room Charges (TSh)</th>
            <th class="num">Extra Charges (TSh)</th>
            <th class="num">Room Tax (TSh)</th>
            <th class="num">Extra Tax (TSh)</th>
            <th class="num">Discount (TSh)</th>
            <th class="num">Adjustment (TSh)</th>
            <th class="num">Total Sales (TSh)</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(r, i) in sheet.daily_sales.rows" :key="'ds' + i">
            <td>{{ r.type }}</td>
            <td class="num">{{ money(r.room_charges) }}</td>
            <td class="num">{{ money(r.extra_charges) }}</td>
            <td class="num">{{ money(r.room_tax) }}</td>
            <td class="num">{{ money(r.extra_tax) }}</td>
            <td class="num">{{ money(r.discount) }}</td>
            <td class="num">{{ money(r.adjustment) }}</td>
            <td class="num">{{ money(r.total) }}</td>
          </tr>
          <tr class="na-total">
            <td>Total (TSh)</td>
            <td class="num">{{ money(sheet.daily_sales.totals.room_charges) }}</td>
            <td class="num">{{ money(sheet.daily_sales.totals.extra_charges) }}</td>
            <td class="num">{{ money(sheet.daily_sales.totals.room_tax) }}</td>
            <td class="num">{{ money(sheet.daily_sales.totals.extra_tax) }}</td>
            <td class="num">{{ money(sheet.daily_sales.totals.discount) }}</td>
            <td class="num">{{ money(sheet.daily_sales.totals.adjustment) }}</td>
            <td class="num">{{ money(sheet.daily_sales.totals.total) }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- ══ 4 · Receipts ══ -->
    <section class="na-sec-block">
      <h3 class="na-sec-title">Receipt - Detail</h3>
      <template v-if="sheet.receipts.detail.groups.length">
        <div v-for="(group, gi) in sheet.receipts.detail.groups" :key="'r' + gi">
          <div class="na-pay-method">Pay Method <b>{{ group.method }}(TSh)</b></div>
          <table class="na-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Receipt</th>
                <th>Reference</th>
                <th class="num">Amount</th>
                <th>User</th>
                <th>Entered On</th>
                <th>Remark</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(r, ri) in group.rows" :key="'rr' + ri">
                <td>{{ r.date }}</td>
                <td>{{ text(r.receipt) }}</td>
                <td>{{ text(r.reference) }}</td>
                <td class="num">TSh {{ money(r.amount) }}</td>
                <td>{{ text(r.user) }}</td>
                <td>{{ text(r.entered_on) }}</td>
                <td>{{ text(r.remark) }}</td>
              </tr>
              <tr class="na-total">
                <td colspan="3">Total</td>
                <td class="num">TSh {{ money(group.total) }}</td>
                <td colspan="3"></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="na-grand-total">Grand Total <b>TSh {{ money(sheet.receipts.detail.grand_total) }}</b></div>
      </template>
      <div v-else class="na-empty">No receipts were recorded for this date.</div>

      <h3 class="na-sec-title" style="margin-top: 12px;">Receipt - Summary</h3>
      <div class="na-cols">
        <table class="na-table">
          <thead>
            <tr>
              <th>User</th>
              <th class="num">Amount (TSh)</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(r, i) in sheet.receipts.summary_by_user" :key="'ru' + i">
              <td>{{ r.user }}</td>
              <td class="num">{{ money(r.amount) }}</td>
            </tr>
            <tr class="na-total">
              <td>Total (TSh)</td>
              <td class="num">{{ money(sheet.receipts.detail.grand_total) }}</td>
            </tr>
          </tbody>
        </table>
        <table class="na-table">
          <thead>
            <tr>
              <th>Pay Method</th>
              <th class="num">Amount (TSh)</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(r, i) in sheet.receipts.summary_by_method" :key="'rm' + i">
              <td>{{ r.method }}</td>
              <td class="num">{{ money(r.amount) }}</td>
            </tr>
            <tr class="na-total">
              <td>Total (TSh)</td>
              <td class="num">{{ money(sheet.receipts.detail.grand_total) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- ══ 5 · Misc. Charges ══ -->
    <section class="na-sec-block">
      <h3 class="na-sec-title">Misc. Charges</h3>
      <table class="na-table">
        <thead>
          <tr>
            <th>Room</th>
            <th>Folio No.</th>
            <th>Guest</th>
            <th>Charge Date</th>
            <th>Voucher No</th>
            <th>Charge</th>
            <th class="num">Unit Price (TSh)</th>
            <th class="num">Unit (Q'ty)</th>
            <th class="num">Amount (TSh)</th>
            <th>Entered On</th>
            <th>Remark</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(r, i) in sheet.misc_charges.rows" :key="'mc' + i">
            <td>{{ text(r.room) }}</td>
            <td>{{ text(r.folio_no) }}</td>
            <td>{{ text(r.guest) }}</td>
            <td>{{ r.charge_date }}</td>
            <td>{{ text(r.voucher_no) }}</td>
            <td>{{ text(r.charge) }}</td>
            <td class="num">{{ money(r.unit_price) }}</td>
            <td class="num">{{ r.qty }}</td>
            <td class="num">{{ money(r.amount) }}</td>
            <td>{{ text(r.entered_on) }}</td>
            <td>{{ text(r.remark) }}</td>
          </tr>
          <tr v-if="sheet.misc_charges.rows.length" class="na-total">
            <td colspan="7">Total (TSh)</td>
            <td class="num">{{ sheet.misc_charges.totals.qty }}</td>
            <td class="num">{{ money(sheet.misc_charges.totals.amount) }}</td>
            <td colspan="2"></td>
          </tr>
          <tr v-if="sheet.misc_charges.rows.length === 0">
            <td colspan="11" class="na-empty">No misc charges were posted for this date.</td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- ══ 6 · Room Status ══ -->
    <section class="na-sec-block">
      <h3 class="na-sec-title">Room Status</h3>
      <table class="na-table">
        <thead>
          <tr>
            <th>Date</th>
            <th class="num">Total Rooms</th>
            <th class="num">Occupied</th>
            <th class="num">Due Out</th>
            <th class="num">Vacant</th>
            <th class="num">Departed</th>
            <th class="num">Reserve</th>
            <th class="num">Blocked</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{{ sheet.room_status.date }}</td>
            <td class="num">{{ sheet.room_status.total_rooms }}</td>
            <td class="num">{{ sheet.room_status.occupied }}</td>
            <td class="num">{{ sheet.room_status.due_out }}</td>
            <td class="num">{{ sheet.room_status.vacant }}</td>
            <td class="num">{{ sheet.room_status.departed }}</td>
            <td class="num">{{ sheet.room_status.reserve }}</td>
            <td class="num">{{ sheet.room_status.blocked }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- ══ 7 + 8 · Pax Status / Pax Analysis ══ -->
    <div class="na-cols">
      <section class="na-sec-block">
        <h3 class="na-sec-title">Pax Status</h3>
        <table class="na-table">
          <thead>
            <tr>
              <th>Status</th>
              <th class="num">Rooms</th>
              <th class="num">Adult</th>
              <th class="num">Child</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(r, i) in sheet.pax_status.rows" :key="'ps' + i">
              <td>{{ r.status }}</td>
              <td class="num">{{ r.rooms }}</td>
              <td class="num">{{ r.adults }}</td>
              <td class="num">{{ r.children }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="na-sec-block">
        <h3 class="na-sec-title">Pax Analysis</h3>
        <table class="na-table">
          <thead>
            <tr>
              <th>Rate Type</th>
              <th class="num">Adult</th>
              <th class="num">Child</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(r, i) in sheet.pax_analysis.rows" :key="'pa' + i">
              <td>{{ text(r.rate_type) }}</td>
              <td class="num">{{ r.adults }}</td>
              <td class="num">{{ r.children }}</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>

    <!-- ══ 9 · POS Summary ══ -->
    <section class="na-sec-block">
      <h3 class="na-sec-title">POS Summary</h3>
      <table class="na-table">
        <thead>
          <tr>
            <th>Outlets</th>
            <th class="num">POS Sales (TSh)</th>
            <th class="num">Charges (TSh)</th>
            <th class="num">Tax (TSh)</th>
            <th class="num">Item Discount (TSh)</th>
            <th class="num">Order Discount (TSh)</th>
            <th class="num">Round Off (TSh)</th>
            <th class="num">Tips (TSh)</th>
            <th class="num">Total (TSh)</th>
            <th class="num">Payments (TSh)</th>
            <th class="num">Posting (TSh)</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(r, i) in sheet.pos_summary.rows" :key="'pos' + i">
            <td>{{ r.outlet }}</td>
            <td class="num">{{ money(r.sales) }}</td>
            <td class="num">{{ money(r.charges) }}</td>
            <td class="num">{{ money(r.tax) }}</td>
            <td class="num">{{ money(r.item_discount) }}</td>
            <td class="num">{{ money(r.order_discount) }}</td>
            <td class="num">{{ money(r.round_off) }}</td>
            <td class="num">{{ money(r.tips) }}</td>
            <td class="num">{{ money(r.total) }}</td>
            <td class="num">{{ money(r.payments) }}</td>
            <td class="num">{{ money(r.posting) }}</td>
          </tr>
          <tr class="na-total">
            <td>Total (TSh)</td>
            <td class="num">{{ money(sheet.pos_summary.totals.sales) }}</td>
            <td class="num">{{ money(sheet.pos_summary.totals.charges) }}</td>
            <td class="num">{{ money(sheet.pos_summary.totals.tax) }}</td>
            <td class="num">{{ money(sheet.pos_summary.totals.item_discount) }}</td>
            <td class="num">{{ money(sheet.pos_summary.totals.order_discount) }}</td>
            <td class="num">{{ money(sheet.pos_summary.totals.round_off) }}</td>
            <td class="num">{{ money(sheet.pos_summary.totals.tips) }}</td>
            <td class="num">{{ money(sheet.pos_summary.totals.total) }}</td>
            <td class="num">{{ money(sheet.pos_summary.totals.payments) }}</td>
            <td class="num">{{ money(sheet.pos_summary.totals.posting) }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- ══ 10 · POS Payment Summary ══ -->
    <section class="na-sec-block">
      <h3 class="na-sec-title">POS Payment Summary</h3>
      <template v-if="sheet.pos_payment_summary.groups.length">
        <div v-for="(group, gi) in sheet.pos_payment_summary.groups" :key="'pp' + gi">
          <div class="na-pay-method">Pay Method <b>{{ group.method }}</b></div>
          <table class="na-table">
            <thead>
              <tr>
                <th>Outlet</th>
                <th class="num">Amount (TSh)</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(r, ri) in group.rows" :key="'ppr' + ri">
                <td>{{ r.outlet }}</td>
                <td class="num">{{ money(r.amount) }}</td>
              </tr>
              <tr class="na-total">
                <td>Total (TSh)</td>
                <td class="num">{{ money(group.total) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
      <div v-else class="na-empty">No POS payments were recorded for this date.</div>
    </section>

    <!-- ══ 11 · POS Posting Summary ══ -->
    <section class="na-sec-block">
      <h3 class="na-sec-title">POS Posting Summary</h3>
      <table class="na-table">
        <thead>
          <tr>
            <th>Outlets</th>
            <th>Posting</th>
            <th class="num">Total (TSh)</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(r, i) in sheet.pos_posting_summary.rows" :key="'po' + i">
            <td>{{ text(r.outlet) }}</td>
            <td>{{ text(r.posting) }}</td>
            <td class="num">{{ money(r.total) }}</td>
          </tr>
          <tr class="na-total">
            <td>Total (TSh)</td>
            <td></td>
            <td class="num">{{ money(sheet.pos_posting_summary.total) }}</td>
          </tr>
        </tbody>
      </table>
    </section>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
defineProps({
  sheet: { type: Object, required: true },
  variant: { type: String, default: 'screen' },
  hotelName: { type: String, default: '' },
  logoUrl: { type: String, default: '' },
  title: { type: String, default: 'Night Audit' },
  dateLabel: { type: String, default: '' },
  printedOn: { type: String, default: '' },
  printedBy: { type: String, default: '' },
  closed: { type: Boolean, default: false },
  showBrand: { type: Boolean, default: true },
})

const money = (v) => (v == null ? '0.00' : Number(v || 0).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
const pct = (v) => (v == null ? '' : Number(v).toLocaleString('en', { maximumFractionDigits: 2 }))
const text = (v) => (v == null || v === '' ? '' : String(v))
</script>