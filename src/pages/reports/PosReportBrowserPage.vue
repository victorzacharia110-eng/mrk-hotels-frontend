<!--
  PosReportBrowserPage — the IPOS-style Food & Beverage Report Browser.

  Recreates the client's reference layout (WhatsApp screenshot, Sept 2026):
  a left tree grouped under the EZEE-ABSOLUTE buckets (Menu Item Sales / Sales
  / No Charge / Back Office / Inventory / Stock / Audit), and a right content
  area showing Mandatory Fields (dates + outlet), Filter Options (User,
  Terminal, Category, Sub Category, Order Type, Include No Charge), a
  custom-report builder and the generic wired-engine renderer.

  Every report maps to a live backend builder under GET /reports/wired/{key}.
-->
<template>
  <ReportBrowserLayout
    :categories="categories"
    :active="activeReport"
    :title="$t('posReports.title')"
    :subtitle="windowLabel"
    :exporting="exporting"
    :pos-print="['sales', 'sales-detail', 'cashier-sales-summary'].includes(activeReport)"
    @select="selectReport"
    @print="printReport"
    @pos-print="printPosReceipt"
    @open-window="openReportWindow"
    @export="exportTable"
  >
    <template #toolbar>
      <div class="posr-toolbar">
        <div class="posr-block">
          <div class="posr-block-title">
            <i class="fas fa-key" aria-hidden="true"></i> {{ $t('posReports.mandatoryFields') }}
          </div>
          <div class="posr-grid">
            <label class="posr-field">
              <span>{{ $t('posReports.fromDate') }}</span>
              <input v-model="filterValues.from" type="date" class="rb-input" />
            </label>
            <label class="posr-field">
              <span>{{ $t('posReports.toDate') }}</span>
              <input v-model="filterValues.to" type="date" class="rb-input" />
            </label>
            <label class="posr-field">
              <span>{{ $t('posReports.outlet') }}</span>
              <select v-model="filterValues.outlet_id" class="rb-input rb-select" :disabled="venuesLoading">
                <option value="">{{ $t('posReports.all') }}</option>
                <option v-for="v in venueOptions" :key="v.id" :value="v.id">{{ v.label }}</option>
              </select>
            </label>
          </div>
        </div>

        <div class="posr-block">
          <div class="posr-block-title">
            <i class="fas fa-sliders" aria-hidden="true"></i> {{ $t('posReports.filterOptions') }}
          </div>
          <div class="posr-grid">
            <label class="posr-field">
              <span>{{ $t('posReports.user') }}</span>
              <select v-model="filterValues.user_id" class="rb-input rb-select">
                <option value="">{{ $t('posReports.all') }}</option>
                <option v-for="u in userOptions" :key="u.user_id" :value="u.user_id">{{ u.full_name }}</option>
              </select>
            </label>
            <label class="posr-field">
              <span>{{ $t('posReports.terminal') }}</span>
              <select v-model="filterValues.terminal_id" class="rb-input rb-select" :disabled="venuesLoading">
                <option value="">{{ $t('posReports.all') }}</option>
                <option v-for="v in venueOptions" :key="'t' + v.id" :value="v.id">{{ v.label }}</option>
              </select>
            </label>
            <label class="posr-field">
              <span>{{ $t('posReports.orderType') }}</span>
              <select v-model="filterValues.business_source" class="rb-input rb-select">
                <option value="">{{ $t('posReports.all') }}</option>
                <option v-for="(label, value) in businessSources" :key="value" :value="value">{{ label }}</option>
              </select>
            </label>
            <template v-if="activeReport === 'cashier-sales-summary'">
              <label class="posr-field">
                <span>{{ $t('posReports.menuItem') }}</span>
                <input v-model="filterValues.menu_item" type="text" class="rb-input" placeholder="e.g. Chicken Tikka" />
              </label>
              <label class="posr-field">
                <span>{{ $t('posReports.tax') }}</span>
                <input v-model="filterValues.tax" type="text" class="rb-input" placeholder="e.g. VAT" />
              </label>
              <label class="posr-field">
                <span>{{ $t('posReports.discount') }}</span>
                <input v-model="filterValues.discount" type="text" class="rb-input" placeholder="yes / no" />
              </label>
              <label class="posr-field">
                <span>{{ $t('posReports.payment') }}</span>
                <input v-model="filterValues.payment" type="text" class="rb-input" placeholder="e.g. M-pesa" />
              </label>
              <label class="posr-field">
                <span>{{ $t('posReports.waiterWiseSales') }}</span>
                <input v-model="filterValues.waiter_wise_sales" type="text" class="rb-input" placeholder="e.g. John" />
              </label>
            </template>
            <template v-if="activeReport === 'cashier-report'">
              <label class="posr-field">
                <span>{{ $t('posReports.payment') }}</span>
                <select v-model="filterValues.payment" class="rb-input rb-select">
                  <option value="">{{ $t('posReports.all') }}</option>
                  <option v-for="m in paymentOptions" :key="m" :value="m">{{ $t(`posReports.paymentMethods.${m}`) }}</option>
                </select>
              </label>
              <label class="posr-field">
                <span>{{ $t('posReports.expenseVoucher') }}</span>
                <select v-model="filterValues.voucher" class="rb-input rb-select">
                  <option value="">{{ $t('posReports.all') }}</option>
                  <option v-for="c in voucherOptions" :key="c" :value="c">{{ c }}</option>
                </select>
              </label>
            </template>
            <label class="posr-field">
              <span>{{ $t('posReports.category') }}</span>
              <select v-model="filterValues.category_id" class="rb-input rb-select">
                <option value="">{{ $t('posReports.all') }}</option>
                <option v-for="c in categoryOptions" :key="c.category_id" :value="c.category_id">{{ c.category_name }}</option>
              </select>
            </label>
            <label v-if="usesDepartmentFilter" class="posr-field">
              <span>{{ $t('posReports.department') }}</span>
              <select v-model="filterValues.department" class="rb-input rb-select">
                <option value="">{{ $t('posReports.all') }}</option>
                <option v-for="d in departmentOptions" :key="d" :value="d">{{ $t(`posReports.departments.${d}`) }}</option>
              </select>
            </label>
            <label class="posr-field">
              <span>{{ $t('posReports.subCategory') }}</span>
              <select v-model="filterValues.sub_category" class="rb-input rb-select" :disabled="!subCategoryOptions.length">
                <option value="">{{ $t('posReports.all') }}</option>
                <option v-for="c in subCategoryOptions" :key="c" :value="c">{{ c }}</option>
              </select>
            </label>
            <label class="posr-field posr-check">
              <span>{{ $t('posReports.includeNoCharge') }}</span>
              <input v-model="filterValues.include_no_charge" type="checkbox" class="rb-check" />
            </label>
          </div>
        </div>

        <div class="posr-run">
          <button type="button" class="rb-btn rb-btn-reset" @click="resetFilters">
            <i class="fas fa-rotate-left" aria-hidden="true"></i> {{ $t('posReports.reset') }}
          </button>
          <button type="button" class="rb-btn rb-btn-primary" :disabled="loading || (activeReport === 'custom' && !customSource)" @click="run">
            <i v-if="loading" class="fas fa-spinner fa-spin" aria-hidden="true"></i>
            <i v-else class="fas fa-play" aria-hidden="true"></i>
            {{ $t('posReports.run') }}
          </button>
        </div>
      </div>
    </template>

    <!-- ── Custom Report builder (pick a source, trim its columns) ── -->
    <div v-if="activeReport === 'custom'" class="posr-builder">
      <div class="posr-block-title">
        <i class="fas fa-wand-magic-sparkles" aria-hidden="true"></i> {{ $t('posReports.customBuilder') }}
      </div>
      <div class="posr-builder-row">
        <label class="posr-field posr-source">
          <span>{{ $t('posReports.dataSource') }}</span>
          <select v-model="customSource" class="rb-input rb-select" :disabled="loading">
            <option value="" disabled>{{ $t('posReports.chooseSource') }}</option>
            <option v-for="s in customSources" :key="s.key" :value="s.key">{{ $t(s.label) }}</option>
          </select>
        </label>
        <div v-if="engine?.columns?.length" class="posr-cols">
          <span class="posr-col-caption">
            <i class="fas fa-table-columns" aria-hidden="true"></i> {{ $t('posReports.columns') }}
          </span>
          <label v-for="col in engine.columns" :key="col.key" class="posr-col">
            <input type="checkbox" :checked="customCols.includes(col.key)" @change="toggleColumn(col.key)" />
            {{ columnLabel(col.key, col.label) }}
          </label>
        </div>
      </div>
    </div>

    <!-- ── Generic wired engine output for every report type ── -->
    <div v-if="loading" class="rb-loading">
      <i class="fas fa-spinner fa-spin" aria-hidden="true"></i> {{ $t('reportBrowser.loading') }}
    </div>
    <div v-else-if="error" class="rb-error">{{ error }}</div>

    <template v-else>
      <div class="rb-report-card">
        <div class="rb-report-head">
          <h2>{{ activeLabel }}</h2>
        </div>

        <p v-if="engine?.legend" class="rb-legend">
          <i class="fas fa-circle-info" aria-hidden="true"></i> {{ engine.legend }}
        </p>

        <div v-if="engine?.summary?.length" class="rb-kpi-grid">
          <div v-for="(kpi, i) in engine.summary" :key="i" class="rb-kpi">
            <span class="rb-kpi-value">{{ summaryValue(kpi.value) }}</span>
            <span class="rb-kpi-label">{{ columnLabel(kpi.label, kpi.label) }}</span>
          </div>
        </div>

        <template v-if="engine?.wired !== false">
          <div v-if="engine?.columns?.length" class="table-scroll">
            <table class="rb-table rb-table-wide">
              <thead>
                <tr>
                  <th v-for="col in engine.columns" :key="col.key">{{ columnLabel(col.key, col.label) }}</th>
                </tr>
              </thead>
              <tbody>
                <template v-if="groupedModel.length">
                  <template v-for="(group, gi) in groupedModel" :key="gi">
                    <tr class="rb-group-head">
                      <td :colspan="engine.columns.length">
                        <i class="fas fa-utensils" aria-hidden="true"></i>
                        {{ $t(`posReports.departments.${group.name}`) }}
                      </td>
                    </tr>
                    <tr v-for="(row, i) in group.items" :key="gi + '-' + i">
                      <td
                        v-for="col in engine.columns"
                        :key="col.key"
                        :class="{ num: col.format === 'money' || col.format === 'pct' }"
                      >
                        {{ formatCell(row[col.key], col.format) }}
                      </td>
                    </tr>
                    <tr class="rb-group-foot">
                      <td class="rb-subtotal-label">{{ $t('posReports.subTotal') }}</td>
                      <td v-for="col in groupCols" :key="col.key" class="rb-subtotal-value">
                        {{ groupCellTotal(group, col) }}
                      </td>
                    </tr>
                  </template>
                </template>
                <template v-else>
                  <tr v-for="(row, i) in engine.rows" :key="i">
                    <td
                      v-for="col in engine.columns"
                      :key="col.key"
                      :class="{ num: col.format === 'money' || col.format === 'pct' }"
                    >
                      {{ formatCell(row[col.key], col.format) }}
                    </td>
                  </tr>
                  <tr v-if="!engine.rows.length">
                    <td :colspan="engine.columns.length" class="rb-empty">{{ $t('reportBrowser.noRows') }}</td>
                  </tr>
                </template>
              </tbody>
              <tfoot v-if="engine.totals?.length">
                <tr>
                  <td v-for="col in engine.columns" :key="col.key">
                    <template v-if="totalFor(col.key, col.format)">
                      <span v-if="totalFor(col.key, col.format).label" class="rb-total-label">
                        {{ totalFor(col.key, col.format).label }}:
                      </span>
                      <strong>{{ totalFor(col.key, col.format).value }}</strong>
                    </template>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </template>

        <div v-else class="rb-empty">
          <i class="fas fa-info-circle" aria-hidden="true"></i> {{ engine.legend || $t('posReports.noDataYet') }}
        </div>
      </div>
    </template>
  </ReportBrowserLayout>
</template>

<script setup>
import { ref, computed, reactive, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import ReportBrowserLayout from '@/components/reports/ReportBrowserLayout.vue'
import { reportApi, outletApi, departmentApi } from '@/api'
import { exportCSV } from '@/utils/export'

const { t, te } = useI18n()

const REPORTS = [
  { key: 'menu-item-sales', label: 'posReports.menuItemSalesSummary' },
  { key: 'menu-items-sales-detail', label: 'posReports.menuItemsSalesDetail' },
  { key: 'menu-item-cost-detail', label: 'posReports.menuItemCostDetail' },
  { key: 'menu-item-cost-summary', label: 'posReports.menuItemCostSummary' },
  { key: 'sales', label: 'posReports.salesSummary' },
  { key: 'sales-detail', label: 'posReports.salesDetail' },
  { key: 'sales-by-variable', label: 'posReports.salesByVariable' },
  { key: 'top-selling-item', label: 'posReports.topSellingItem' },
  { key: 'least-selling-item', label: 'posReports.leastSellingItem' },
  { key: 'hourly-sales', label: 'posReports.hourlySales' },
  { key: 'cashier-sales-summary', label: 'posReports.cashierSalesSummary' },
  { key: 'cashier-sales-detail', label: 'posReports.cashierSalesDetail' },
  { key: 'shift-manager-timing', label: 'posReports.shiftManagerTiming' },
  { key: 'no-charge', label: 'posReports.noChargesSalesSummary' },
  { key: 'no-charge-menu-item-sales-summary', label: 'posReports.noChargeMenuItemSalesSummary' },
  { key: 'no-charge-menu-item-sales-detail', label: 'posReports.noChargeMenuItemSalesDetail' },
  { key: 'no-charge-sales-detail', label: 'posReports.noChargeSalesDetail' },
  { key: 'payment-summary', label: 'posReports.paymentSummary' },
  { key: 'payment-detail', label: 'posReports.paymentDetail' },
  { key: 'tax-collection', label: 'posReports.taxCollection' },
  { key: 'tax-analysis', label: 'posReports.taxAnalysis' },
  { key: 'creditors-summary', label: 'posReports.creditorsSummary' },
  { key: 'creditors-details', label: 'posReports.creditorsDetails' },
  { key: 'driver-efficiency', label: 'posReports.driverEfficiency' },
  { key: 'driver-deliveries', label: 'posReports.driverDeliveries' },
  { key: 'expense-income-detail', label: 'posReports.expenseIncomeDetail' },
  { key: 'expense-income-summary', label: 'posReports.expenseIncomeSummary' },
  { key: 'back-office', label: 'posReports.backOfficeSummary' },
  { key: 'purchase-order-detail', label: 'posReports.purchaseOrderDetail' },
  { key: 'stock-adjustment-detail', label: 'posReports.stockAdjustmentDetail' },
  { key: 'physical-stock-detail', label: 'posReports.physicalStockDetail' },
  { key: 'stock-transfer-detail', label: 'posReports.stockTransferDetail' },
  { key: 'stock-transfer-summary', label: 'posReports.stockTransferSummary' },
  { key: 'goods-received-detail', label: 'posReports.goodsReceivedDetail' },
  { key: 'goods-return-detail', label: 'posReports.goodsReturnDetail' },
  { key: 'inventory', label: 'posReports.inventoryMovements' },
  { key: 'stock-ledger', label: 'posReports.stockLedger' },
  { key: 'closing-stock', label: 'posReports.closingStock' },
  { key: 'stock-movement-detail', label: 'posReports.stockMovementDetail' },
  { key: 'low-stock', label: 'posReports.lowStock' },
  { key: 'physical-stock-taking', label: 'posReports.physicalStockTaking' },
  { key: 'stock', label: 'posReports.currentStock' },
  { key: 'audit-void-purchase-order', label: 'posReports.auditVoidPurchaseOrder' },
  { key: 'audit-void-goods-received', label: 'posReports.auditVoidGoodsReceived' },
  { key: 'audit-void-physical-stock', label: 'posReports.auditVoidPhysicalStock' },
  { key: 'audit-void-requisitions', label: 'posReports.auditVoidRequisitions' },
  { key: 'audit-void-stock-adjustment-detail', label: 'posReports.auditVoidStockAdjustmentDetail' },
  { key: 'audit-void-stock-transfer-detail', label: 'posReports.auditVoidStockTransferDetail' },
  { key: 'audit-void-items', label: 'posReports.auditVoidItems' },
  { key: 'audit-void-charges', label: 'posReports.auditVoidCharges' },
  { key: 'audit-void-order', label: 'posReports.auditVoidOrder' },
  { key: 'audit-void-payments', label: 'posReports.auditVoidPayments' },
  { key: 'audit-void-expense-income-voucher', label: 'posReports.auditVoidExpenseIncomeVoucher' },
  { key: 'audit-trail', label: 'posReports.auditTrail' },
  { key: 'audit', label: 'posReports.orderEvents' },
  { key: 'statistical', label: 'posReports.statistical' },
  { key: 'user-terminal', label: 'posReports.userTerminal' },
  { key: 'custom', label: 'posReports.custom' },
]

const categories = [
  {
    key: 'menu-item-sales',
    label: 'posReports.catMenuItemSales',
    icon: 'fas fa-burger',
    reports: [
      { key: 'menu-item-sales', label: 'posReports.menuItemSalesSummary', icon: 'fas fa-burger' },
      { key: 'menu-items-sales-detail', label: 'posReports.menuItemsSalesDetail', icon: 'fas fa-list-ul' },
      { key: 'menu-item-cost-detail', label: 'posReports.menuItemCostDetail', icon: 'fas fa-coins' },
      { key: 'menu-item-cost-summary', label: 'posReports.menuItemCostSummary', icon: 'fas fa-chart-simple' },
    ],
  },
  {
    key: 'sales',
    label: 'posReports.catSales',
    icon: 'fas fa-cash-register',
    reports: [
      { key: 'sales', label: 'posReports.salesSummary', icon: 'fas fa-chart-simple' },
      { key: 'sales-detail', label: 'posReports.salesDetail', icon: 'fas fa-list-ul' },
      { key: 'sales-by-variable', label: 'posReports.salesByVariable', icon: 'fas fa-sliders' },
      { key: 'top-selling-item', label: 'posReports.topSellingItem', icon: 'fas fa-arrow-trend-up' },
      { key: 'least-selling-item', label: 'posReports.leastSellingItem', icon: 'fas fa-arrow-trend-down' },
      { key: 'hourly-sales', label: 'posReports.hourlySales', icon: 'fas fa-clock' },
      { key: 'cashier-sales-summary', label: 'posReports.cashierSalesSummary', icon: 'fas fa-user-tie' },
      { key: 'cashier-sales-detail', label: 'posReports.cashierSalesDetail', icon: 'fas fa-user-tie' },
      { key: 'shift-manager-timing', label: 'posReports.shiftManagerTiming', icon: 'fas fa-stopwatch' },
    ],
  },
  {
    key: 'no-charge',
    label: 'posReports.catNoCharge',
    icon: 'fas fa-shirt',
    reports: [
      { key: 'no-charge', label: 'posReports.noChargesSalesSummary', icon: 'fas fa-shirt' },
      { key: 'no-charge-menu-item-sales-summary', label: 'posReports.noChargeMenuItemSalesSummary', icon: 'fas fa-burger' },
      { key: 'no-charge-menu-item-sales-detail', label: 'posReports.noChargeMenuItemSalesDetail', icon: 'fas fa-list-ul' },
      { key: 'no-charge-sales-detail', label: 'posReports.noChargeSalesDetail', icon: 'fas fa-receipt' },
    ],
  },
  {
    key: 'back-office',
    label: 'posReports.catBackOffice',
    icon: 'fas fa-briefcase',
    reports: [
      { key: 'payment-summary', label: 'posReports.paymentSummary', icon: 'fas fa-money-bill-transfer' },
      { key: 'payment-detail', label: 'posReports.paymentDetail', icon: 'fas fa-list-ul' },
      { key: 'tax-collection', label: 'posReports.taxCollection', icon: 'fas fa-percent' },
      { key: 'tax-analysis', label: 'posReports.taxAnalysis', icon: 'fas fa-magnifying-glass-chart' },
      { key: 'creditors-summary', label: 'posReports.creditorsSummary', icon: 'fas fa-people-group' },
      { key: 'creditors-details', label: 'posReports.creditorsDetails', icon: 'fas fa-address-book' },
      { key: 'driver-efficiency', label: 'posReports.driverEfficiency', icon: 'fas fa-gauge-high' },
      { key: 'driver-deliveries', label: 'posReports.driverDeliveries', icon: 'fas fa-truck-fast' },
      { key: 'expense-income-detail', label: 'posReports.expenseIncomeDetail', icon: 'fas fa-list-ul' },
      { key: 'expense-income-summary', label: 'posReports.expenseIncomeSummary', icon: 'fas fa-chart-pie' },
      { key: 'back-office', label: 'posReports.backOfficeSummary', icon: 'fas fa-briefcase' },
    ],
  },
  {
    key: 'inventory',
    label: 'posReports.catInventory',
    icon: 'fas fa-boxes-stacked',
    reports: [
      { key: 'purchase-order-detail', label: 'posReports.purchaseOrderDetail', icon: 'fas fa-file-invoice' },
      { key: 'stock-adjustment-detail', label: 'posReports.stockAdjustmentDetail', icon: 'fas fa-pen-to-square' },
      { key: 'physical-stock-detail', label: 'posReports.physicalStockDetail', icon: 'fas fa-clipboard-list' },
      { key: 'stock-transfer-detail', label: 'posReports.stockTransferDetail', icon: 'fas fa-right-left' },
      { key: 'stock-transfer-summary', label: 'posReports.stockTransferSummary', icon: 'fas fa-chart-simple' },
      { key: 'goods-received-detail', label: 'posReports.goodsReceivedDetail', icon: 'fas fa-box-open' },
      { key: 'goods-return-detail', label: 'posReports.goodsReturnDetail', icon: 'fas fa-rotate-left' },
      { key: 'inventory', label: 'posReports.inventoryMovements', icon: 'fas fa-arrow-right-arrow-left' },
    ],
  },
  {
    key: 'stock',
    label: 'posReports.catStock',
    icon: 'fas fa-warehouse',
    reports: [
      { key: 'stock-ledger', label: 'posReports.stockLedger', icon: 'fas fa-book' },
      { key: 'closing-stock', label: 'posReports.closingStock', icon: 'fas fa-boxes-stacked' },
      { key: 'stock-movement-detail', label: 'posReports.stockMovementDetail', icon: 'fas fa-arrow-right-arrow-left' },
      { key: 'low-stock', label: 'posReports.lowStock', icon: 'fas fa-triangle-exclamation' },
      { key: 'physical-stock-taking', label: 'posReports.physicalStockTaking', icon: 'fas fa-clipboard-check' },
      { key: 'stock', label: 'posReports.currentStock', icon: 'fas fa-warehouse' },
    ],
  },
  {
    key: 'audit',
    label: 'posReports.catAudit',
    icon: 'fas fa-file-pen',
    reports: [
      { key: 'audit-void-purchase-order', label: 'posReports.auditVoidPurchaseOrder', icon: 'fas fa-file-invoice' },
      { key: 'audit-void-goods-received', label: 'posReports.auditVoidGoodsReceived', icon: 'fas fa-box-open' },
      { key: 'audit-void-physical-stock', label: 'posReports.auditVoidPhysicalStock', icon: 'fas fa-clipboard-list' },
      { key: 'audit-void-requisitions', label: 'posReports.auditVoidRequisitions', icon: 'fas fa-file-lines' },
      { key: 'audit-void-stock-adjustment-detail', label: 'posReports.auditVoidStockAdjustmentDetail', icon: 'fas fa-pen-to-square' },
      { key: 'audit-void-stock-transfer-detail', label: 'posReports.auditVoidStockTransferDetail', icon: 'fas fa-right-left' },
      { key: 'audit-void-items', label: 'posReports.auditVoidItems', icon: 'fas fa-boxes-stacked' },
      { key: 'audit-void-charges', label: 'posReports.auditVoidCharges', icon: 'fas fa-pound-sign' },
      { key: 'audit-void-order', label: 'posReports.auditVoidOrder', icon: 'fas fa-receipt' },
      { key: 'audit-void-payments', label: 'posReports.auditVoidPayments', icon: 'fas fa-money-bill-transfer' },
      { key: 'audit-void-expense-income-voucher', label: 'posReports.auditVoidExpenseIncomeVoucher', icon: 'fas fa-file-circle-xmark' },
      { key: 'audit-trail', label: 'posReports.auditTrail', icon: 'fas fa-list-check' },
      { key: 'audit', label: 'posReports.orderEvents', icon: 'fas fa-file-pen' },
    ],
  },
  {
    key: 'more',
    label: 'posReports.catMore',
    icon: 'fas fa-ellipsis',
    reports: [
      { key: 'statistical', label: 'posReports.statistical', icon: 'fas fa-chart-column' },
      { key: 'user-terminal', label: 'posReports.userTerminal', icon: 'fas fa-desktop' },
      { key: 'custom', label: 'posReports.custom', icon: 'fas fa-wand-magic-sparkles' },
    ],
  },
]

const customSources = REPORTS.filter((r) => r.key !== 'custom')

const activeReport = ref('menu-item-sales')
const customSource = ref('menu-item-sales')
const customCols = ref([])

const engine = ref(null)
const loading = ref(false)
const exporting = ref(false)
const error = ref('')

const outlets = ref([])
const outletsLoading = ref(false)
const departments = ref([])
const departmentsLoading = ref(false)
const venuesLoading = computed(() => outletsLoading.value || departmentsLoading.value)

const filterValues = reactive({
  from: todayIso(),
  to: todayIso(),
  outlet_id: '',
  terminal_id: '',
  user_id: '',
  business_source: '',
  category_id: '',
  sub_category: '',
  department: '',
  include_no_charge: false,
  payment: '',
  voucher: '',
  menu_item: '',
  tax: '',
  discount: '',
  waiter_wise_sales: '',
})

const activeLabel = computed(() => {
  const cfg = REPORTS.find((r) => r.key === activeReport.value)
  return cfg ? t(cfg.label) : ''
})

const windowLabel = computed(() => {
  const from = prettyDate(filterValues.from)
  const to = prettyDate(filterValues.to)
  return `${activeLabel.value} · ${from} → ${to}`
})

/** Staff members offered by the wired engine's filter options. */
const userOptions = computed(() => engine.value?.filters?.users || [])

/** Inventory & store reports scope by physical department — the role EZEE's
 * outlet plays for these reports. F&B reports keep scoping by POS outlet. */
const INVENTORY_REPORTS = new Set([
  'purchase-order-detail', 'stock-adjustment-detail', 'physical-stock-detail',
  'stock-transfer-detail', 'stock-transfer-summary', 'goods-received-detail',
  'goods-return-detail', 'inventory', 'stock-ledger', 'closing-stock',
  'stock-movement-detail', 'low-stock', 'physical-stock-taking', 'stock',
])

const usesDepartments = computed(() => INVENTORY_REPORTS.has(activeReport.value))

/** The single Outlet / Terminal picker: departments for inventory reports, outlets otherwise. */
const venueOptions = computed(() => {
  const items = usesDepartments.value ? departments.value : outlets.value
  return (Array.isArray(items) ? items : []).map((item) => ({
    id: String(item.department_id || item.outlet_id),
    label: item.name || item.outlet_name,
  }))
})

/** Managed menu categories for the CATEGORY filter; inventory categories for
 * the inventory & store reports (the backend folds it into the category enum). */
const categoryOptions = computed(() => {
  if (usesDepartments.value) {
    const cats = engine.value?.filters?.categories || []
    return (Array.isArray(cats) ? cats : []).map((c) => ({
      category_id: c,
      category_name: c,
    }))
  }
  return engine.value?.filters?.menu_categories || []
})

/** Settlement methods offered by the Cashier Report PAYMENT filter. */
const paymentOptions = computed(() => engine.value?.filters?.payment_options || [])

/** Expense/income voucher categories for the Cashier Report VOUCHER filter. */
const voucherOptions = computed(() => engine.value?.filters?.voucher_options || [])

const subCategoryOptions = computed(() => {
  if (activeReport.value !== 'menu-item-sales') return []
  return engine.value?.filters?.categories || []
})

/** F&B department filter for the MENU ITEM SALES reports. */
const MENU_ITEM_REPORTS = new Set(['menu-item-sales', 'menu-items-sales-detail'])
const usesDepartmentFilter = computed(
  () => MENU_ITEM_REPORTS.has(activeReport.value) && (Array.isArray(engine.value?.filters?.departments) ? engine.value.filters.departments.length > 0 : false),
)
const departmentOptions = computed(() => engine.value?.filters?.departments || [])

/** The menu-item reports render one table block per department, with a SUB
 *  TOTAL footer under each block and the engine GRAND TOTAL under all of them.
 *  Backend rows arrive alphabetically within each department; departments are
 *  rowed up in the order they first appear. */
const groupedModel = computed(() => {
  if (!MENU_ITEM_REPORTS.has(activeReport.value)) return []
  const rows = engine.value?.rows || []
  const groups = new Map()
  for (const row of rows) {
    const name = row.department || '—'
    if (!groups.has(name)) groups.set(name, [])
    groups.get(name).push(row)
  }
  return [...groups.entries()].map(([name, items]) => ({ name, items }))
})

/** Columns that carry numbers on a grouped SUB TOTAL row: everything except
 *  the identifying/grouping labels. */
const groupCols = computed(() => {
  const skip = new Set(['order_no', 'receipt_no', 'ordered_time', 'item', 'department', 'category'])
  return (engine.value?.columns || []).filter((c) => !skip.has(c.key))
})

function cellNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string') {
    const n = parseFloat(String(value).replace(/,/g, ''))
    return Number.isNaN(n) ? null : n
  }
  return null
}

function groupCellTotal(group, col) {
  const nums = group.items.map((r) => cellNumber(r[col.key])).filter((n) => n !== null)
  if (!nums.length) return '—'
  const sum = nums.reduce((a, b) => a + b, 0)
  const sample = group.items[0][col.key]
  const isMoney = typeof sample === 'string' && /^\d[\d,]*\.\d{2}$/.test(String(sample))
  if (isMoney) {
    return sum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }
  return String(Math.round(sum * 100) / 100)
}

const businessSources = computed(() => {
  const orderTypes = {
    dine_in: t('posReports.orderTypes.dine_in'),
    at_bar: t('posReports.orderTypes.at_bar'),
    hotel_menu: t('posReports.orderTypes.hotel_menu'),
    takeaway: t('posReports.orderTypes.takeaway'),
    room_service: t('posReports.orderTypes.room_service'),
    delivery: t('posReports.orderTypes.delivery'),
    no_charge: t('posReports.orderTypes.no_charge'),
  }
  return orderTypes
})

function columnLabel(key, fallback) {
  if (te(`reportColumns.${key}`)) return t(`reportColumns.${key}`)
  if (te(`posReports.columns.${String(key).replace(/-/g, '_')}`)) return t(`posReports.columns.${String(key).replace(/-/g, '_')}`)
  return fallback || String(key).replace(/_/g, ' ')
}

function formatCell(value, format) {
  if (value === null || value === undefined || value === '') return '—'
  if (format === 'money' && typeof value === 'number') return money(value)
  if (format === 'pct') return `${value}%`
  if (typeof value === 'number') return String(value)
  if (Array.isArray(value)) return value.join(', ') || '—'
  return String(value)
}

function totalFor(key, format) {
  const total = (engine.value?.totals || []).find((tt) => tt.key === key)
  if (!total) return null
  return { label: total.label || null, value: formatCell(total.value, format) }
}

function summaryValue(value) {
  if (typeof value === 'number' && !Number.isInteger(value)) return money(value)
  return value === null || value === undefined ? '—' : String(value)
}

function toggleColumn(key) {
  if (customCols.value.includes(key)) {
    customCols.value = customCols.value.filter((c) => c !== key)
  } else {
    customCols.value = [...customCols.value, key]
  }
  run()
}

function selectReport(key) {
  activeReport.value = key
  engine.value = null
  error.value = ''
  if (key === 'custom') {
    customSource.value = 'menu-item-sales'
    customCols.value = []
  }
  run()
}

function resetFilters() {
  filterValues.from = todayIso()
  filterValues.to = todayIso()
  filterValues.outlet_id = ''
  filterValues.terminal_id = ''
  filterValues.user_id = ''
  filterValues.business_source = ''
  filterValues.category_id = ''
  filterValues.sub_category = ''
  filterValues.department = ''
  filterValues.payment = ''
  filterValues.voucher = ''
  filterValues.menu_item = ''
  filterValues.tax = ''
  filterValues.discount = ''
  filterValues.waiter_wise_sales = ''
  filterValues.include_no_charge = false
  run()
}

async function run() {
  loading.value = true
  error.value = ''
  engine.value = null
  try {
    const params = {
      from: filterValues.from || undefined,
      to: filterValues.to || undefined,
      // Terminal maps onto the outlet/venue that the ticket was recorded at —
      // orders do not carry a separate device id, so a POS terminal selection
      // narrows to that terminal's outlet. The Terminal filter wins.
      outlet_id: filterValues.terminal_id || filterValues.outlet_id || undefined,
      business_source: filterValues.business_source || undefined,
      order_type: filterValues.business_source || undefined,
      user_id: filterValues.user_id || undefined,
      created_by: filterValues.user_id || undefined,
      category_id: filterValues.category_id || undefined,
      sub_category: filterValues.sub_category || undefined,
      department: filterValues.department || undefined,
      payment: filterValues.payment || undefined,
      voucher: filterValues.voucher || undefined,
      menu_item: filterValues.menu_item || undefined,
      tax: filterValues.tax || undefined,
      discount: filterValues.discount || undefined,
      waiter_wise_sales: filterValues.waiter_wise_sales || undefined,
      include_no_charge: filterValues.include_no_charge ? '1' : '0',
    }
    const isCustom = activeReport.value === 'custom'
    if (isCustom) {
      params.source = customSource.value
      if (customCols.value.length) params.cols = customCols.value.join(',')
    }
    const res = await reportApi.wired(isCustom ? 'custom' : activeReport.value, params)
    engine.value = res.data.data
    if (isCustom && res.data.data?.columns?.length) {
      customCols.value = res.data.data.columns.map((c) => c.key)
    }
  } catch (err) {
    error.value = err.response?.data?.message || t('common.loadError')
  } finally {
    loading.value = false
  }
}

function printReport() {
  const win = openReportWindow()
  if (!win) return
  win.addEventListener('afterprint', () => win.close())
  setTimeout(() => {
    win.focus()
    win.print()
    setTimeout(() => win.close(), 5000)
  }, 250)
}

/**
 * POS-thermal receipt for the cashier sales reports — the reference's small-
 * POS-printer path (NOT A4). Opens a narrow 80mm till-roll window with the
 * report columns and totals, then hands off to the browser print dialog so
 * the small POS printer can be selected.
 */
function printPosReceipt() {
  const data = engine.value
  if (!data || data.wired === false || !data.rows?.length) {
    error.value = t('reportBrowser.openWindowEmpty')
    return
  }
  const win = window.open('', '_blank')
  if (!win) {
    error.value = t('reportBrowser.openWindowBlocked')
    return
  }
  win.opener = null

  const pad = (text, width) => {
    const s = String(text ?? '')
    return s.length >= width ? s : s + ' '.repeat(width - s.length)
  }

  // Sales Summary / Sales Detail print as a receipt too: every column becomes a
  // space-padded line so the 80mm till printer keeps the columns readable.
  const cols = data.columns || []
  const colWidths = cols.map((c) => Math.max(esc(columnLabel(c.key, c.label)).length, 8)).map((w) => Math.min(w, 16))
  const head = cols.map((c, i) => esc(columnLabel(c.key, c.label)).padEnd(colWidths[i])).join(' ').slice(0, 46)
  const lineRows = data.rows.map(
    (r) => cols.map((c, i) => esc(formatCell(r[c.key], c.format)).padEnd(colWidths[i])).join(' ').trimEnd().slice(0, 46),
  )
  const totalLines = (data.totals || [])
    .map((tt) => `${pad(esc(tt.label), 24)} ${esc(formatCell(tt.value, 'money'))}`)
    .join('\n')
  const totalsBlock = totalLines ? `\n------------------------------\n${totalLines}` : ''
  const body = `===============================
 MRK HOTELS POS
 ${activeLabel.value}
 ${windowLabel.value}
 ===============================
${head}
------------------------------
${lineRows.join('\n')}${totalsBlock}
------------------------------
Generated ${new Date().toLocaleString()}
===============================`.trim()

  win.document.open()
  win.document.write(
    `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${esc(activeLabel.value)}</title>
<style>
  @page { size: 80mm auto; margin: 2mm; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body { font-family: 'Courier New', Courier, monospace; font-size: 12px; color: #000; }
  .bar { position: sticky; top: 0; display: flex; justify-content: flex-end; gap: 6px; padding: 6px 10px; background: #eef1f6; z-index: 5; }
  .bar button { border: 1px solid #062a52; background: #062a52; color: #fff; border-radius: 5px; padding: 7px 14px; font-size: 12px; font-weight: 700; cursor: pointer; }
  @media print { .bar { display: none !important; } }
  pre { margin: 0; padding: 6px; white-space: pre; }
</style>
</head><body>
  <div class="bar"><button type="button" onclick="window.print()">${esc(t('reportBrowser.print'))}</button></div>
  <pre>${body}</pre>
</body></html>`,
  )
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 400)
}

/** Escapes API text so it can't break the standalone report window's markup. */
function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Keeps only the report body: drops screen-only chrome and interactive bits. */
function reportBodyHtml(inner) {
  const div = document.createElement('div')
  div.innerHTML = inner
  div.querySelectorAll('button, a, input, select').forEach((n) => n.remove())
  return div.innerHTML
}

/**
 * Opens a clean, print-ready copy of the current POS report in a new window.
 * Only the report body inside `.rb-paper` is carried across, wrapped in a
 * purpose-built A4-landscape stylesheet, so the printed sheet mirrors the
 * paper the reference system produces.
 */
function openReportWindow() {
  const paper = document.querySelector('.rb-paper')
  if (!paper || !paper.innerText.trim()) {
    error.value = t('reportBrowser.openWindowEmpty')
    return
  }
  const win = window.open('', '_blank')
  if (!win) {
    error.value = t('reportBrowser.openWindowBlocked')
    return
  }
  win.opener = null
  win.document.open()
  win.document.write(
    `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${esc(activeLabel.value)}</title>
<style>
  @page { size: A4 landscape; margin: 10mm 8mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; line-height: 1.45; color: #111; background: #fff; }
  .rpt-bar { position: sticky; top: 0; display: flex; justify-content: flex-end; gap: 8px; padding: 8px 12px; background: #eef1f6; z-index: 5; }
  .rpt-bar button { border: 1px solid #062a52; background: #062a52; color: #fff; border-radius: 5px; padding: 8px 16px; font-size: 13px; font-weight: 700; cursor: pointer; }
  .rpt-bar button:hover { background: #005eb8; }
  @media print { .rpt-bar { display: none !important; } }
  .sheet { padding: 4px 10px 10px; }
  .brand { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px double #062a52; padding-bottom: 10px; margin-bottom: 14px; }
  .brand h1 { font-size: 18px; text-transform: uppercase; letter-spacing: 1px; color: #062a52; margin: 0; }
  .brand .period { font-size: 12px; color: #444; }
  .rb-report-head h2, h2 { font-size: 14px; color: #062a52; margin: 14px 0 4px; }
  .rb-legend { font-size: 11.5px; color: #444; margin: 0 0 10px; }
  .rb-kpi-grid { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 12px; }
  .rb-kpi { flex: 1 1 160px; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 12px; background: #f8fafc; }
  .rb-kpi-value { display: block; font-size: 17px; color: #062a52; font-weight: 700; }
  .rb-kpi-label { font-size: 10.5px; text-transform: uppercase; letter-spacing: .5px; color: #475569; }
  .table-scroll { overflow: visible !important; margin: 0 0 14px; }
  table { width: 100%; border-collapse: collapse; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
  th, td { border: 1px solid #cbd5e1; padding: 5px 7px; vertical-align: top; }
  th { background: #062a52; color: #fff; font-size: 10.5px; text-transform: uppercase; letter-spacing: .4px; text-align: left; }
  td { font-size: 11px; }
  tbody tr:nth-child(even) td { background: #f1f5f9; }
  .num { text-align: right !important; }
  .rb-total-label { font-weight: 700; color: #475569; }
  .rb-table tfoot td { font-weight: 700; background: #f4f4f5; }
  .rb-empty { color: #64748b; font-style: italic; text-align: center !important; }
  tfoot { border-top: 2px solid #062a52; }
</style>
</head><body>
  <div class="rpt-bar"><button type="button" onclick="window.print()">${esc(t('reportBrowser.print'))}</button></div>
  <div class="sheet">
    <div class="brand">
      <h1>${esc(activeLabel.value)}</h1>
      <span class="period">${esc(windowLabel.value)}</span>
    </div>
    ${reportBodyHtml(paper.innerHTML)}
    <div style="margin-top: 10px; border-top: 1px solid #cbd5e1; padding-top: 6px; font-size: 10px; color: #64748b; display: flex; justify-content: space-between;">
      <span>Generated ${esc(new Date().toLocaleString())}</span>
      <span>${esc(activeLabel.value)}</span>
    </div>
  </div>
</body></html>`,
  )
  win.document.close()
  return win
}

async function exportTable() {
  if (!engine.value?.columns?.length) {
    error.value = t('reportBrowser.openWindowEmpty')
    return
  }
  exporting.value = true
  error.value = ''
  try {
    await new Promise((r) => setTimeout(r, 250))
    exportCSV(activeReport.value, engine.value.rows || [], engine.value.columns || [])
  } catch (err) {
    error.value = err?.message || t('common.loadError')
  } finally {
    exporting.value = false
  }
}

async function loadOutlets() {
  outletsLoading.value = true
  try {
    const res = await outletApi.index()
    const raw = res.data?.outlets ?? res.data?.data ?? res.data ?? []
    outlets.value = Array.isArray(raw) ? raw : []
  } catch {
    outlets.value = []
  } finally {
    outletsLoading.value = false
  }
}

async function loadDepartments() {
  departmentsLoading.value = true
  try {
    const res = await departmentApi.index()
    const raw = res.data?.departments ?? res.data?.data ?? res.data ?? []
    departments.value = Array.isArray(raw) ? raw : []
  } catch {
    departments.value = []
  } finally {
    departmentsLoading.value = false
  }
}

watch(activeReport, () => {
  filterValues.sub_category = ''
  filterValues.category_id = ''
  filterValues.payment = ''
  filterValues.voucher = ''
})

watch(usesDepartments, (now, before) => {
  if (before !== undefined && now !== before) {
    filterValues.outlet_id = ''
    filterValues.terminal_id = ''
  }
})

onMounted(() => {
  loadOutlets()
  loadDepartments()
  run()
})

function todayIso() {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

function prettyDate(iso) {
  if (!iso) return '—'
  const parts = iso.split('-')
  if (parts.length !== 3) return iso
  const [y, m, d] = parts
  return `${d}/${m}/${y}`
}

const money = (v) => {
  const num = Number(v || 0)
  return `TSh ${num.toLocaleString('en', { maximumFractionDigits: 2 })}`
}
</script>

<style scoped>
/* Reference toolbar: Mandatory Fields + Filter Options cards. */
.posr-toolbar {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
  align-items: flex-start;
}
.posr-block {
  flex: 1 1 240px;
  background: #fff;
  border: 1px solid #dbe4ef;
  border-radius: 8px;
  padding: 12px 14px;
  box-shadow: 0 1px 3px rgba(16, 42, 67, 0.08);
}
.posr-block-title {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--mrk-blue, #005eb8);
  margin-bottom: 10px;
}
.posr-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 10px;
}
.posr-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.posr-field > span,
.posr-col-caption {
  font-size: 12px;
  font-weight: 600;
  color: #475569;
}
.posr-check {
  flex-direction: row;
  align-items: center;
  gap: 8px;
}
.posr-check input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: var(--mrk-blue, #005eb8);
}
.posr-run {
  display: flex;
  align-items: flex-end;
  align-self: stretch;
  gap: 8px;
}
/* Custom report builder. */
.posr-builder {
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: #fff;
  border: 1px solid #dbe4ef;
  border-left: 3px solid var(--mrk-blue, #005eb8);
  border-radius: 8px;
  padding: 12px 14px;
  margin-bottom: 16px;
  box-shadow: 0 1px 3px rgba(16, 42, 67, 0.08);
}
.posr-builder-row {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  align-items: flex-start;
}
.posr-source {
  min-width: 220px;
}
.posr-cols {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  flex: 1 1 260px;
}
.posr-col {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: #334155;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 999px;
  padding: 3px 10px;
  cursor: pointer;
  user-select: none;
}
.posr-col input {
  accent-color: var(--mrk-blue, #005eb8);
}
/* Engine output (match the PMS Report Browser paper). */
.rb-report-head {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}
.rb-report-head h2 {
  margin: 0;
  font-size: 18px;
  color: var(--mrk-dark, #062a52);
}
.rb-legend {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  background: #f7fafd;
  border: 1px solid #e6ebf2;
  border-left: 3px solid var(--mrk-blue, #005eb8);
  color: #475569;
  font-size: 13px;
  padding: 10px 14px;
  border-radius: 6px;
  margin: 0 0 16px;
}
.rb-kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 10px;
  margin-bottom: 16px;
}
.rb-kpi {
  display: flex;
  flex-direction: column;
  gap: 2px;
  background: #f7fafd;
  border: 1px solid #e6ebf2;
  padding: 10px 14px;
  border-radius: 8px;
}
.rb-kpi-value {
  font-size: 17px;
  font-weight: 700;
  color: var(--mrk-dark, #062a52);
}
.rb-kpi-label {
  font-size: 11px;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}
.rb-loading,
.rb-error,
.rb-empty {
  padding: 24px;
  text-align: center;
  color: #64748b;
}
.rb-error {
  color: #dc2626;
}
.rb-input {
  padding: 7px 10px;
  border: 1px solid #cdd6e2;
  border-radius: 6px;
  font-size: 13px;
  background: #fff;
  color: #1e293b;
}
.rb-select {
  min-width: 120px;
  cursor: pointer;
}
.rb-btn {
  padding: 7px 14px;
  border: 1px solid var(--mrk-blue, #005eb8);
  background: var(--mrk-blue, #005eb8);
  color: #fff;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.rb-btn-reset {
  background: #fff;
  color: var(--mrk-blue, #005eb8);
}
.rb-btn-primary {
  align-self: flex-end;
}
.rb-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.rb-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.rb-table-wide {
  min-width: 680px;
}
.rb-table th {
  text-align: left;
  padding: 8px 10px;
  background: var(--mrk-pale, #e8f1fa);
  color: var(--mrk-dark, #062a52);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  border: 1px solid #dbe4ef;
}
.rb-table td {
  padding: 8px 10px;
  border: 1px solid #e6ebf2;
}
.rb-table .num {
  text-align: right;
}
.rb-total-label {
  font-weight: 600;
  color: #64748b;
}
.rb-table tfoot td {
  font-weight: 700;
  background: #f7fafd;
}
.rb-group-head td {
  background: #062a52;
  color: #fff;
  font-weight: 700;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  padding: 7px 10px;
}
.rb-group-head td i { margin-right: 6px; color: #b0cde9; }
.rb-group-foot td {
  background: #eef4fb;
  font-weight: 700;
  color: #1e3a5f;
  padding: 6px 10px;
}
.rb-subtotal-label { text-transform: uppercase; font-size: 11px; letter-spacing: 0.03em; }
.rb-subtotal-value { text-align: right; white-space: nowrap; }
.table-scroll {
  overflow-x: auto;
}
</style>