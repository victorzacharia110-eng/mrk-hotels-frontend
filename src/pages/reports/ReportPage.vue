<!--
  Reports page (route: /app/reports, name: hotel-reports).
  Hotel business reports: an overview tab (occupancy, revenue and room status
  over a date range) plus a lazy-loaded, filterable audit log tab.
-->
<template>
  <div class="dashboard-page container">
    <div class="page-head">
      <div>
        <h1>{{ $t('reports.title') }}</h1>
        <p class="muted">{{ $t('reports.subtitle') }}</p>
      </div>
      <div class="head-actions">
        <button class="btn btn-secondary" @click="reload">
          <i class="fas fa-rotate"></i> {{ $t('common.refresh') }}
        </button>
        <TableExportButton filename="audit-logs" :title="$t('reports.tabAudit')" :load-all="loadAllAuditLogs" />
      </div>
    </div>

    <div v-if="error" class="alert alert-error">{{ error }}</div>

    <!-- Print-only Ezee-style brand header shown on every printed report. -->
    <div class="print-brand-head">
      <div class="report-brand">
        <img v-if="reportLogo" :src="reportLogo" class="report-logo" alt="" />
        <h2>{{ reportHotel }}</h2>
      </div>
      <h3 class="report-title">{{ $t('reports.title') }}</h3>
      <span class="report-period">{{ stockFrom || '—' }} → {{ stockTo || '—' }}</span>
    </div>

    <!-- Tab switcher between the overview and audit-log views -->
    <div class="tabs">
      <button v-for="item in tabs" :key="item.key" class="tab-btn" :class="{ active: activeTab === item.key }"
        @click="switchTab(item.key)">
        <i :class="item.icon"></i> {{ $t(item.label) }}
      </button>
    </div>

    <!--
      Stock ledger tab: classic item-wise stock report. Opening balance is
      replayed from history, then every movement with running quantity and
      value at the item's configured purchase rate.
    -->
    <template v-if="activeTab === 'stock'">
      <div class="card filter-bar">
        <div class="filter-grid">
          <div class="form-group">
            <label>{{ $t('common.from') }}</label>
            <input v-model="stockFrom" type="date" class="input" @change="loadStockLedger" />
          </div>
          <div class="form-group">
            <label>{{ $t('common.to') }}</label>
            <input v-model="stockTo" type="date" class="input" @change="loadStockLedger" />
          </div>
          <div class="form-group">
            <label>{{ $t('reports.stockCategory') }}</label>
            <select v-model="stockCategory" class="input" @change="loadStockLedger">
              <option value="">{{ $t('reports.allCategories') }}</option>
              <option value="food">Food</option>
              <option value="beverage">Beverage</option>
              <option value="housekeeping">Housekeeping</option>
              <option value="maintenance">Maintenance</option>
              <option value="procurement">Procurement</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div class="form-group checkbox-group">
            <label class="checkbox-label">
              <input v-model="stockIgnoreZero" type="checkbox" @change="loadStockLedger" />
              {{ $t('reports.ignoreZero') }}
            </label>
          </div>
          <div class="form-group">
            <label>&nbsp;</label>
            <button class="btn btn-secondary" @click="printLedger">
              <i class="fas fa-print"></i> {{ $t('reports.printLedger') }}
            </button>
          </div>
        </div>
      </div>

      <div v-if="stockLoading" class="alert alert-info">{{ $t('reports.loading') }}</div>

      <div v-else-if="!stockData.items || !stockData.items.length" class="alert alert-info">
        {{ $t('reports.noStockData') }}
      </div>

      <div v-else id="stock-ledger-print" class="stock-ledger">
        <div class="ledger-head no-print-summary">
          <h2><i class="fas fa-warehouse"></i> {{ $t('reports.tabStock') }}</h2>
          <span>{{ stockData.from }} → {{ stockData.to }} · {{ $t('reports.costMethod') }}</span>
        </div>

        <article v-for="item in stockData.items" :key="item.item_id" class="card ledger-item">
          <header class="ledger-item-head">
            <h3>{{ item.item_name }} <small v-if="item.unit">({{ item.unit }})</small></h3>
            <span class="ledger-balance">
              {{ $t('reports.openingStock') }}: <strong>{{ item.opening_stock }}</strong>
              &nbsp;→&nbsp; {{ $t('reports.closingStock') }}: <strong>{{ item.closing_stock }}</strong>
            </span>
          </header>

          <table class="ledger-table" v-if="item.movements.length">
            <thead>
              <tr>
                <th>{{ $t('reports.date') }}</th>
                <th>{{ $t('reports.txnType') }}</th>
                <th>{{ $t('reports.ref') }}</th>
                <th class="num">{{ $t('reports.stockIn') }}</th>
                <th class="num">{{ $t('reports.stockOut') }}</th>
                <th class="num">{{ $t('reports.unitCost') }}</th>
                <th class="num">{{ $t('reports.value') }}</th>
                <th class="num">{{ $t('reports.stockCol') }}</th>
                <th class="num">{{ $t('reports.stockValueCol') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr class="opening-row">
                <td colspan="6">{{ $t('reports.openingStock') }}</td>
                <td class="num">{{ fmtMoney(item.opening_value) }}</td>
                <td class="num">{{ item.opening_stock }}</td>
                <td class="num">{{ fmtMoney(item.opening_value) }}</td>
              </tr>
              <tr v-for="(m, idx) in item.movements" :key="idx"
                  :class="{ 'movement-in': m.in !== null, 'movement-out': m.out !== null }">
                <td>{{ m.date }}</td>
                <td>{{ $t('reports.' + m.type) }}</td>
                <td class="mono">{{ m.ref || '—' }}</td>
                <td class="num in-cell">{{ m.in ?? '' }}</td>
                <td class="num out-cell">{{ m.out ?? '' }}</td>
                <td class="num">{{ fmtMoney(m.unit_cost) }}</td>
                <td class="num">{{ fmtMoney(m.value) }}</td>
                <td class="num">{{ m.stock }}</td>
                <td class="num">{{ fmtMoney(m.stock_value) }}</td>
              </tr>
            </tbody>
          </table>
          <p v-else class="no-movements">{{ $t('reports.noStockData') }}</p>
        </article>

        <div class="ledger-totals card">
          <span>{{ $t('reports.totalOpeningValue') }}: <strong>TZS {{ fmtMoney(stockData.totals.opening_value) }}</strong></span>
          <span>{{ $t('reports.totalClosingValue') }}: <strong>TZS {{ fmtMoney(stockData.totals.closing_value) }}</strong></span>
        </div>
      </div>
    </template>

    <!--
      Inventory tab: the stock register family (ledger summary, closing stock,
      low stock, movements, procurement registers) driven by a template picker.
    -->
    <template v-if="activeTab === 'inventory'">
      <div class="card filter-bar">
        <div class="filter-grid">
          <div class="form-group">
            <label>{{ $t('reports.invTemplate') }}</label>
            <select v-model="invTemplate" class="input" @change="loadInventoryReport">
              <option v-for="tpl in INV_TEMPLATES" :key="tpl.key" :value="tpl.key">
                {{ $t('reports.inv_' + tpl.key, tpl.fallbackLabel) }}
              </option>
            </select>
          </div>
          <div class="form-group">
            <label>{{ $t('common.from') }}</label>
            <input v-model="stockFrom" type="date" class="input" @change="loadInventoryReport" />
          </div>
          <div class="form-group">
            <label>{{ $t('common.to') }}</label>
            <input v-model="stockTo" type="date" class="input" @change="loadInventoryReport" />
          </div>
          <div v-if="invUsesCategory" class="form-group">
            <label>{{ $t('reports.stockCategory') }}</label>
            <select v-model="stockCategory" class="input" @change="loadInventoryReport">
              <option value="">{{ $t('reports.allCategories') }}</option>
              <option value="food">Food</option>
              <option value="beverage">Beverage</option>
              <option value="housekeeping">Housekeeping</option>
              <option value="maintenance">Maintenance</option>
              <option value="procurement">Procurement</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div v-if="invConfig?.supportsVoided" class="form-group">
            <label>{{ $t('reports.invVoided') }}</label>
            <select v-model="invVoided" class="input" @change="loadInventoryReport">
              <option :value="false">{{ $t('reports.invActive') }}</option>
              <option :value="true">{{ $t('reports.invVoidOnly') }}</option>
            </select>
          </div>
          <div class="form-group">
            <label>&nbsp;</label>
            <button class="btn btn-secondary" @click="loadInventoryReport">
              <i class="fas fa-rotate"></i> {{ $t('reports.reload') }}
            </button>
          </div>
        </div>
      </div>

      <div v-if="invLoading" class="alert alert-info">{{ $t('reports.loading') }}</div>
      <div v-else-if="!invRows.length" class="alert alert-info">{{ $t('reports.noStockData') }}</div>
      <div v-else class="card">
        <h2><i class="fas fa-boxes-stacked"></i> {{ invTitle }}</h2>
        <p class="hint muted">{{ stockData?.from || stockFrom }} → {{ stockData?.to || stockTo }}</p>
        <table class="ledger-table">
          <thead>
            <tr>
              <th v-for="c in invCols" :key="c.field" :class="{ num: c.num }">{{ c.label }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, i) in invRows" :key="i">
              <td v-for="c in invCols" :key="c.field" :class="{ num: c.num }">
                {{ c.money ? fmtMoney(row[c.field]) : row[c.field] ?? '—' }}
              </td>
            </tr>
          </tbody>
        </table>
        <div v-if="invTotalsText" class="ledger-totals">
          <span v-for="tot in invTotalsText" :key="tot.label">
            {{ tot.label }}: <strong>TZS {{ tot.value }}</strong>
          </span>
        </div>
      </div>
    </template>

    <!--
      Bookings tab: booking volumes and behaviour for the window — arrivals,
      departures, channel mix, cancellations and no-shows.
    -->
    <template v-if="activeTab === 'bookings'">
      <div class="card filter-bar">
        <div class="filter-grid">
          <div class="form-group">
            <label>{{ $t('common.from') }}</label>
            <input v-model="stockFrom" type="date" class="input" />
          </div>
          <div class="form-group">
            <label>{{ $t('common.to') }}</label>
            <input v-model="stockTo" type="date" class="input" />
          </div>
          <div class="form-group">
            <label>&nbsp;</label>
            <button class="btn btn-secondary" @click="loadBookings">
              <i class="fas fa-rotate"></i> {{ $t('reports.generate') }}
            </button>
          </div>
        </div>
      </div>

      <div v-if="bookingsLoading" class="alert alert-info">{{ $t('reports.loading') }}</div>
      <template v-else-if="bookingsData.booked_in_period !== undefined">
        <div class="stat-grid">
          <div class="stat-card"><span class="stat-label">{{ $t('reports.bookedInPeriod') }}</span><span class="stat-value">{{ bookingsData.booked_in_period }}</span></div>
          <div class="stat-card"><span class="stat-label">{{ $t('reports.arrivalsInPeriod') }}</span><span class="stat-value">{{ bookingsData.arrivals }}</span></div>
          <div class="stat-card"><span class="stat-label">{{ $t('reports.departuresInPeriod') }}</span><span class="stat-value">{{ bookingsData.departures }}</span></div>
          <div class="stat-card"><span class="stat-label">{{ $t('reports.inHouseNow') }}</span><span class="stat-value">{{ bookingsData.in_house_now }}</span></div>
          <div class="stat-card"><span class="stat-label">{{ $t('reports.upcomingNow') }}</span><span class="stat-value">{{ bookingsData.upcoming_now }}</span></div>
        </div>

        <div class="dash-grid">
          <div class="card dash-section">
            <h2><i class="fas fa-bullhorn"></i> {{ $t('reports.sourceMix') }}</h2>
            <div v-for="(count, source) in bookingsData.by_source" :key="source" class="method-row">
              <span>{{ $t('reports.source_' + source) }}</span>
              <div class="bar-track"><div class="bar-fill" :style="{ width: sourcePct(count) + '%' }"></div></div>
              <strong>{{ count }}</strong>
            </div>
          </div>

          <div class="card dash-section">
            <h2><i class="fas fa-chart-pie"></i> {{ $t('reports.bookingHealth') }}</h2>
            <div class="health-rows">
              <div class="method-row"><span>{{ $t('reports.cancellationRate') }}</span><strong :class="{ 'text-warn': bookingsData.cancellation_rate > 10 }">{{ bookingsData.cancellation_rate }}%</strong></div>
              <div class="method-row"><span>{{ $t('reports.noShowRate') }}</span><strong>{{ bookingsData.no_show_rate }}%</strong></div>
              <div class="method-row"><span>{{ $t('reports.avgLeadTime') }}</span><strong>{{ bookingsData.avg_lead_time_days }} {{ $t('stayview.days') }}</strong></div>
              <div class="method-row"><span>{{ $t('reports.cancellationsCount') }}</span><strong>{{ bookingsData.cancellations }}</strong></div>
            </div>
          </div>
        </div>
      </template>
    </template>

    <!-- F&B sales tab: department split, best sellers, waiter throughput. -->
    <template v-if="activeTab === 'fnb'">
      <div class="card filter-bar">
        <div class="filter-grid">
          <div class="form-group">
            <label>{{ $t('common.from') }}</label>
            <input v-model="stockFrom" type="date" class="input" @change="loadFnb" />
          </div>
          <div class="form-group">
            <label>{{ $t('common.to') }}</label>
            <input v-model="stockTo" type="date" class="input" @change="loadFnb" />
          </div>
          <div class="form-group">
            <label>&nbsp;</label>
            <button class="btn btn-secondary" @click="exportFnbs">
              <i class="fas fa-download"></i> {{ $t('reports.download') }}
            </button>
          </div>
        </div>
      </div>

      <div v-if="fnbLoading" class="alert alert-info">{{ $t('reports.loading') }}</div>
      <template v-else-if="fnbData.orders_total !== undefined">
        <div class="stat-grid">
          <div class="stat-card"><span class="stat-label">{{ $t('reports.fnbOrders') }}</span><span class="stat-value">{{ fnbData.orders_total }}</span></div>
          <div class="stat-card"><span class="stat-label">{{ $t('reports.fnbRevenue') }}</span><span class="stat-value">TZS {{ fmtMoney(fnbData.revenue_total) }}</span></div>
          <div class="stat-card"><span class="stat-label">{{ $t('reports.fnbCovers') }}</span><span class="stat-value">{{ fnbData.covers_total }}</span></div>
        </div>

        <div class="dash-grid">
          <div class="card dash-section">
            <h2><i class="fas fa-utensils"></i> {{ $t('reports.deptSplit') }}</h2>
            <div v-for="(stats, dept) in fnbData.by_department" :key="dept" class="method-row">
              <span>{{ $t('orders.' + dept) }}</span>
              <strong>{{ stats.orders }} · TZS {{ fmtMoney(stats.revenue) }}</strong>
            </div>
          </div>

          <div class="card dash-section">
            <div class="section-header-row">
              <h2><i class="fas fa-trophy"></i> {{ $t('reports.topItems') }}</h2>
              <button class="btn btn-secondary btn-sm" @click="exportTopItems">CSV</button>
            </div>
            <table class="mini-table">
              <thead><tr><th>{{ $t('menu.itemName') }}</th><th class="num">{{ $t('reports.qtySold') }}</th><th class="num">{{ $t('reports.value') }}</th></tr></thead>
              <tbody>
                <tr v-for="item in fnbData.top_items" :key="item.item_name">
                  <td>{{ item.item_name }}</td>
                  <td class="num">{{ item.qty }}</td>
                  <td class="num">{{ fmtMoney(item.revenue) }}</td>
                </tr>
                <tr v-if="!fnbData.top_items.length"><td colspan="3">{{ $t('reports.noStockData') }}</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="card dash-section">
          <div class="section-header-row">
            <h2><i class="fas fa-user-clock"></i> {{ $t('reports.perWaiter') }}</h2>
            <button class="btn btn-secondary btn-sm" @click="exportWaiters">CSV</button>
          </div>
          <table class="mini-table">
            <thead><tr><th>{{ $t('users.name') }}</th><th class="num">{{ $t('reports.fnbOrders') }}</th><th class="num">{{ $t('reports.value') }}</th></tr></thead>
            <tbody>
              <tr v-for="row in fnbData.per_waiter" :key="row.name">
                <td>{{ row.name }}</td>
                <td class="num">{{ row.orders }}</td>
                <td class="num">{{ fmtMoney(row.revenue) }}</td>
              </tr>
              <tr v-if="!fnbData.per_waiter.length"><td colspan="3">{{ $t('reports.noStockData') }}</td></tr>
            </tbody>
          </table>
        </div>
      </template>
    </template>

    <!-- Overview tab: date range filters and report dashboards -->
    <template v-if="activeTab === 'overview'">
      <div class="card filter-bar">
        <div class="filter-grid">
          <div class="form-group">
            <label>{{ $t('common.from') }}</label>
            <input v-model="from" type="date" class="input" @change="loadReports" />
          </div>
          <div class="form-group">
            <label>{{ $t('common.to') }}</label>
            <input v-model="to" type="date" class="input" @change="loadReports" />
          </div>
          <div class="form-group">
            <label>&nbsp;</label>
            <button class="btn btn-secondary" @click="setThisWeek">
              <i class="fas fa-calendar-week"></i> {{ $t('reports.thisWeek') }}
            </button>
          </div>
          <div class="form-group">
            <label>&nbsp;</label>
            <button class="btn btn-secondary" @click="setThisMonth">
              <i class="fas fa-calendar-days"></i> {{ $t('reports.thisMonth') }}
            </button>
          </div>
        </div>
      </div>

      <div v-if="loading" class="alert alert-info">{{ $t('reports.loading') }}</div>

      <template v-else>
        <!-- KPI summary cards for the selected period -->
        <div class="stats-grid">
          <div class="stat-card">
            <span class="stat-label">{{ $t('reports.occupancyAvg') }}</span>
            <span class="stat-value">{{ avgOccupancy }}%</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">{{ $t('reports.roomRevenuePeriod') }}</span>
            <span class="stat-value">TZS {{ fmtMoney(revenue.room_revenue) }}</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">{{ $t('reports.adr') }}</span>
            <span class="stat-value">TZS {{ fmtMoney(revenue.adr) }}</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">{{ $t('reports.revpar') }}</span>
            <span class="stat-value">TZS {{ fmtMoney(revenue.revpar) }}</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">{{ $t('reports.revenuePeriod') }}</span>
            <span class="stat-value">TZS {{ fmtMoney(revenue.total) }}</span>
          </div>
        </div>

        <!-- Room status breakdown plus revenue by payment method, side by side -->
        <div class="dash-grid">
          <div class="card dash-section">
            <div class="section-header-row">
              <h2><i class="fas fa-bed"></i> {{ $t('reports.roomStatus') }}</h2>
            </div>
            <div class="room-status-grid">
              <div v-for="(label, key) in ROOM_STATUS_LABELS" :key="key" class="room-status-item">
                <span class="room-status-dot" :class="key"></span>
                <span class="room-status-label">{{ label }}</span>
                <span class="room-status-value">{{ roomStatus.by_status?.[key] ?? 0 }}</span>
              </div>
            </div>
            <div v-if="roomStatus.by_type" class="type-breakdown">
              <h3>{{ $t('reports.byRoomType') }}</h3>
              <div class="type-row" v-for="(count, type) in roomStatus.by_type" :key="type">
                <span class="capitalize">{{ type }}</span>
                <div class="bar">
                  <div class="bar-fill" :style="{ width: typeBar(type) + '%' }"></div>
                </div>
                <span>{{ count }}</span>
              </div>
            </div>
          </div>

          <div class="card dash-section">
            <div class="section-header-row">
              <h2><i class="fas fa-chart-pie"></i> {{ $t('reports.revenueByMethod') }}</h2>
            </div>
            <div v-if="revenue.by_method && Object.keys(revenue.by_method).length" class="method-list">
              <div v-for="(amount, method) in revenue.by_method" :key="method" class="method-row">
                <span class="capitalize">{{ method.replace('_', ' ') }}</span>
                <span class="price">TZS {{ Number(amount).toLocaleString() }}</span>
              </div>
            </div>
            <div v-else class="muted">{{ $t('reports.noRevenue') }}</div>
          </div>
        </div>

        <!-- Daily occupancy rendered as a simple column chart -->
        <div class="card dash-section">
          <div class="section-header-row">
            <h2><i class="fas fa-chart-column"></i> {{ $t('reports.occupancyPerDay') }}</h2>
          </div>
          <div v-if="occupancy.length" class="occupancy-chart">
            <div v-for="row in occupancy" :key="row.date" class="occ-column">
              <div class="occ-bar-wrap">
                <div class="occ-bar" :style="{ height: Math.min(100, Number(row.occupancy_rate)) + '%' }"
                  :title="row.date"></div>
              </div>
              <span class="occ-label">{{ shortDate(row.date) }}</span>
              <span class="occ-value">{{ row.occupancy_rate }}%</span>
            </div>
          </div>
          <div v-else class="muted">{{ $t('reports.noOccupancyData') }}</div>
        </div>
      </template>
    </template>

    <!-- Audit tab: filterable audit log table with pagination -->
    <template v-else>
      <div class="card filter-bar">
        <div class="filter-grid audit-filters">
          <div class="form-group">
            <label>{{ $t('reports.auditAction') }}</label>
            <select v-model="auditFilters.action" class="input" @change="loadAuditLogs()">
              <option value="">{{ $t('reports.auditAllActions') }}</option>
              <option v-for="a in AUDIT_ACTIONS" :key="a" :value="a" class="capitalize">
                {{ a }}
              </option>
            </select>
          </div>
          <div class="form-group">
            <label>{{ $t('common.from') }}</label>
            <input v-model="auditFilters.from" type="date" class="input" @change="loadAuditLogs()" />
          </div>
          <div class="form-group">
            <label>{{ $t('common.to') }}</label>
            <input v-model="auditFilters.to" type="date" class="input" @change="loadAuditLogs()" />
          </div>
          <div class="form-group">
            <label>{{ $t('common.search') }}</label>
            <input v-model="auditFilters.search" type="text" class="input"
              :placeholder="$t('reports.auditSearchPlaceholder')" @keyup.enter="loadAuditLogs()" />
          </div>
          <div class="filter-actions">
            <button class="btn btn-secondary btn-sm" @click="loadAuditLogs()">
              <i class="fas fa-magnifying-glass"></i> {{ $t('common.search') }}
            </button>
          </div>
        </div>
      </div>

      <div v-if="auditLoading" class="alert alert-info">{{ $t('reports.loading') }}</div>

      <div v-else class="card dash-section">
        <table class="table">
          <thead>
            <tr>
              <th scope="col">{{ $t('reports.auditTime') }}</th>
              <th scope="col">{{ $t('reports.auditUser') }}</th>
              <th scope="col">{{ $t('reports.auditAction') }}</th>
              <th scope="col">{{ $t('reports.auditEntity') }}</th>
              <th scope="col">{{ $t('reports.auditIp') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="log in auditLogs" :key="log.log_id">
              <td class="muted">{{ formatDateTime(log.created_at) }}</td>
              <td>{{ log.user?.full_name || '—' }}</td>
              <td>
                <span class="badge" :class="actionBadge(log.action)">{{ log.action }}</span>
              </td>
              <td>
                <span class="capitalize">{{ log.entity_type || '—' }}</span><span v-if="log.entity_id"
                  class="muted mono">
                  · {{ log.entity_id.slice(0, 8) }}</span>
              </td>
              <td class="muted">{{ log.ip_address || '—' }}</td>
            </tr>
            <tr v-if="!auditLogs.length">
              <td colspan="5" class="muted">{{ $t('reports.auditEmpty') }}</td>
            </tr>
          </tbody>
        </table>

        <div v-if="auditMeta.total > auditMeta.per_page" class="pagination">
          <button class="btn btn-sm btn-secondary" :disabled="!auditMeta.prev_page_url"
            @click="loadAuditLogs(auditMeta.current_page - 1)">
            {{ $t('common.previous') }}
          </button>
          <span class="muted">{{
            $t('common.pageXOfY', { current: auditMeta.current_page, total: auditMeta.last_page })
            }}</span>
          <button class="btn btn-sm btn-secondary" :disabled="!auditMeta.next_page_url"
            @click="loadAuditLogs(auditMeta.current_page + 1)">
            {{ $t('common.next') }}
          </button>
        </div>
      </div>
    </template>

    <!-- Print-only footer with the person who ran the report, like Ezee. -->
    <footer class="print-brand-foot">
      {{ $t('reports.printedBy') }}: {{ reportUser }} · {{ printedAt }}
    </footer>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { reportApi, hotelSettingsApi } from '@/api'
import TableExportButton from '@/components/TableExportButton.vue'
import { collectAllRows, exportCSV } from '@/utils/export'
import { useAuthStore } from '@/stores/auth'

const { t } = useI18n()
const authStore = useAuthStore()
const reportHotel = computed(() => authStore.user?.tenant?.hotel_name || 'MRK Hotels')
const reportUser = computed(() => authStore.user?.name || authStore.user?.full_name || '—')
const reportLogo = ref('')

// Tab definitions and the currently active tab.
const tabs = [
  { key: 'overview', icon: 'fas fa-chart-line', label: 'reports.tabOverview' },
  { key: 'bookings', icon: 'fas fa-calendar-check', label: 'reports.tabBookings' },
  { key: 'fnb', icon: 'fas fa-utensils', label: 'reports.tabFnB' },
  { key: 'stock', icon: 'fas fa-warehouse', label: 'reports.tabStock' },
  { key: 'inventory', icon: 'fas fa-boxes-stacked', label: 'reports.tabInventory' },
  { key: 'audit', icon: 'fas fa-clipboard-list', label: 'reports.tabAudit' },
]
const activeTab = ref('overview')

// Mirrors the action enum on the audit_logs table.
const AUDIT_ACTIONS = ['create', 'update', 'delete', 'login', 'logout', 'other']
// Audit log tab state: rows, pagination meta, filters and lazy-load flags.
const auditLogs = ref([])
const auditMeta = ref({
  total: 0,
  per_page: 15,
  current_page: 1,
  last_page: 1,
  prev_page_url: null,
  next_page_url: null,
})
const auditFilters = reactive({ action: '', from: '', to: '', search: '' })
const auditLoading = ref(false)
const auditLoaded = ref(false)

/** Switches the active tab, lazy-loading the audit log the first time that tab is opened. */
function switchTab(tab) {
  activeTab.value = tab
  // Lazy-load: only hit an endpoint when its tab is first opened.
  if (tab === 'audit' && !auditLoaded.value) loadAuditLogs()
  if (tab === 'stock' && !stockLoaded.value) loadStockLedger()
  if (tab === 'bookings' && !bookingsLoaded.value) loadBookings()
  if (tab === 'fnb' && !fnbLoaded.value) loadFnb()
}

/* ---------------- Stock ledger tab ---------------- */

// Ledger filters and result payload (items with movement rows plus totals).
const stockFrom = ref(todayMinus(6))
const stockTo = ref(today())
const stockCategory = ref('beverage')
const stockIgnoreZero = ref(true)
const stockData = ref({ items: [], totals: { opening_value: 0, closing_value: 0 } })
const stockLoading = ref(false)
const stockLoaded = ref(false)

/** Loads the stock ledger for the selected range/category combination. */
async function loadStockLedger() {
  stockLoading.value = true
  error.value = ''
  try {
    const res = await reportApi.stockLedger({
      from: stockFrom.value,
      to: stockTo.value,
      category: stockCategory.value || undefined,
      ignore_zero: stockIgnoreZero.value ? 1 : 0,
    })
    stockData.value = res.data
    stockLoaded.value = true
  } catch (err) {
    error.value = err.response?.data?.message || t('reports.loadError')
  } finally {
    stockLoading.value = false
  }
}

/** Formats TZS amounts with thousands separators. */
function fmtMoney(value) {
  return Number(value || 0).toLocaleString('en-TZ', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

/** Opens the browser print dialog scoped to the ledger area. */
function printLedger() {
  window.print()
}


/* ---------------- Inventory report series ---------------- */

/**
 * Template catalogue for the inventory tab. `rows` names the array in the
 * response; `usesCategory` gates the category filter; money columns are
 * rendered through fmtMoney. Labels fall back to English via fallbackLabel.
 */
const INV_TEMPLATES = [
  {
    key: 'ledger-summary',
    rows: 'items',
    usesCategory: true,
    fallbackLabel: 'Stock Ledger Summary',
    cols: [
      { field: 'item_name', label: 'Item' },
      { field: 'unit', label: 'Unit' },
      { field: 'opening_stock', label: 'Opening', num: true },
      { field: 'received', label: 'Received', num: true },
      { field: 'issued', label: 'Issued', num: true },
      { field: 'closing_stock', label: 'Closing', num: true },
      { field: 'closing_value', label: 'Closing value (TZS)', num: true, money: true },
    ],
    totals: ['received_value', 'issued_value', 'closing_value'],
  },
  {
    key: 'closing-stock',
    rows: 'items',
    usesCategory: true,
    fallbackLabel: 'Closing Stock',
    cols: [
      { field: 'item_name', label: 'Item' },
      { field: 'category', label: 'Category' },
      { field: 'closing_stock', label: 'Qty on hand', num: true },
      { field: 'unit', label: 'Unit' },
      { field: 'unit_cost', label: 'Unit cost (TZS)', num: true, money: true },
      { field: 'closing_value', label: 'Value (TZS)', num: true, money: true },
    ],
    totals: ['closing_value'],
  },
  {
    key: 'low-stock',
    rows: 'items',
    usesCategory: true,
    noWindow: true,
    fallbackLabel: 'Low Stock',
    cols: [
      { field: 'item_name', label: 'Item' },
      { field: 'category', label: 'Category' },
      { field: 'in_stock', label: 'In stock', num: true },
      { field: 'reorder_level', label: 'Reorder level', num: true },
      { field: 'shortfall', label: 'Shortfall', num: true },
      { field: 'restock_cost', label: 'Restock cost (TZS)', num: true, money: true },
      { field: 'supplier', label: 'Supplier' },
    ],
    totals: ['restock_cost'],
  },
  {
    key: 'movement-detail',
    rows: 'movements',
    usesCategory: true,
    fallbackLabel: 'Stock Movement Detail',
    cols: [
      { field: 'date', label: 'Date' },
      { field: 'item_name', label: 'Item' },
      { field: 'direction', label: 'Direction' },
      { field: 'transaction', label: 'Transaction' },
      { field: 'quantity', label: 'Qty', num: true },
      { field: 'balance_after', label: 'Balance after', num: true },
      { field: 'value', label: 'Value (TZS)', num: true, money: true },
      { field: 'recorded_by', label: 'Recorded by' },
    ],
  },
  {
    key: 'transaction-summary',
    rows: 'transactions',
    usesCategory: false,
    fallbackLabel: 'Transaction Wise Summary',
    cols: [
      { field: 'transaction', label: 'Transaction' },
      { field: 'count', label: 'Count', num: true },
      { field: 'qty_in', label: 'Qty in', num: true },
      { field: 'qty_out', label: 'Qty out', num: true },
      { field: 'value', label: 'Value (TZS)', num: true, money: true },
    ],
  },
  {
    key: 'purchase-order-register',
    rows: 'orders',
    usesCategory: false,
    fallbackLabel: 'Purchase Order Register',
    cols: [
      { field: 'po_number', label: 'PO number' },
      { field: 'date', label: 'Date' },
      { field: 'supplier', label: 'Supplier' },
      { field: 'status', label: 'Status' },
      { field: 'total_amount', label: 'Amount (TZS)', num: true, money: true },
    ],
    totals: ['total_amount'],
  },
  {
    key: 'purchase-order-detail',
    rows: 'orders',
    usesCategory: false,
    fallbackLabel: 'Purchase Order Detail',
    cols: [
      { field: 'po_number', label: 'PO number' },
      { field: 'date', label: 'Date' },
      { field: 'supplier', label: 'Supplier' },
      { field: 'items_count', label: 'Lines', num: true },
      { field: 'total_amount', label: 'Amount (TZS)', num: true, money: true },
    ],
    totals: ['total_amount'],
  },
  {
    key: 'grn-register',
    rows: 'grns',
    usesCategory: false,
    fallbackLabel: 'Goods Receipt Note Register',
    cols: [
      { field: 'grn_number', label: 'GRN number' },
      { field: 'received_date', label: 'Received' },
      { field: 'inspection_status', label: 'Inspection' },
      { field: 'delivery_note_number', label: 'Delivery note' },
    ],
  },
  {
    key: 'grn-detail',
    rows: 'grns',
    usesCategory: false,
    fallbackLabel: 'Goods Receipt Note Detail',
    cols: [
      { field: 'grn_number', label: 'GRN number' },
      { field: 'received_date', label: 'Received' },
      { field: 'inspection_status', label: 'Inspection' },
      { field: 'lines_count', label: 'Lines', num: true },
    ],
  },  {
    key: 'transfer-register',
    rows: 'transfers',
    usesCategory: false,
    supportsVoided: true,
    fallbackLabel: 'Stock Transfer Register',
    cols: [
      { field: 'transfer_number', label: 'Transfer #' },
      { field: 'date', label: 'Date' },
      { field: 'from_department', label: 'From' },
      { field: 'to_department', label: 'To' },
      { field: 'status', label: 'Status' },
    ],
  },
  {
    key: 'transfer-detail',
    report: 'transfer-register',
    detailMode: true,
    rows: 'transfers',
    usesCategory: false,
    supportsVoided: true,
    fallbackLabel: 'Stock Transfer Detail',
    cols: [
      { field: 'transfer_number', label: 'Transfer #' },
      { field: 'date', label: 'Date' },
      { field: 'from_department', label: 'From' },
      { field: 'to_department', label: 'To' },
      { field: 'lines_count', label: 'Lines', num: true },
      { field: 'status', label: 'Status' },
      { field: 'void_reason', label: 'Void reason' },
    ],
  },
  {
    key: 'stock-take-detail',
    rows: 'takes',
    usesCategory: false,
    supportsVoided: true,
    fallbackLabel: 'Physical Stock Taking',
    cols: [
      { field: 'take_number', label: 'Take #' },
      { field: 'date', label: 'Date' },
      { field: 'counted_by', label: 'Counted by' },
      { field: 'lines_count', label: 'Items counted', num: true },
      { field: 'variance_qty', label: 'Variance qty', num: true },
      { field: 'status', label: 'Status' },
    ],
    totals: ['variance_qty'],
  },
  {
    key: 'manufacturing-detail',
    rows: 'runs',
    usesCategory: false,
    supportsVoided: true,
    fallbackLabel: 'Manufacturing / BOM',
    cols: [
      { field: 'run_number', label: 'Run #' },
      { field: 'date', label: 'Date' },
      { field: 'recipe', label: 'Recipe' },
      { field: 'batches', label: 'Batches', num: true },
      { field: 'product', label: 'Product' },
      { field: 'produced_qty', label: 'Produced qty', num: true },
      { field: 'status', label: 'Status' },
    ],
    totals: ['runs'],
  },
  {
    key: 'indent-register',
    rows: 'indents',
    usesCategory: false,
    fallbackLabel: 'Indent Register',
    cols: [
      { field: 'indent_number', label: 'Indent #' },
      { field: 'date', label: 'Date' },
      { field: 'department', label: 'Department' },
      { field: 'requested_by', label: 'Requested by' },
      { field: 'approved_at', label: 'Approved' },
      { field: 'lines_count', label: 'Lines', num: true },
      { field: 'status', label: 'Status' },
    ],
    totals: ['indents'],
  },
  {
    key: 'market-list-register',
    rows: 'market_lists',
    usesCategory: false,
    fallbackLabel: 'Market List Register',
    cols: [
      { field: 'ml_number', label: 'ML #' },
      { field: 'date', label: 'Date' },
      { field: 'from_indent', label: 'From indent' },
      { field: 'lines_count', label: 'Lines', num: true },
      { field: 'status', label: 'Status' },
    ],
    totals: ['market_lists'],
  },
  {
    key: 'goods-return-register',
    rows: 'returns',
    usesCategory: false,
    supportsVoided: true,
    fallbackLabel: 'Goods Return Register',
    cols: [
      { field: 'return_number', label: 'Return #' },
      { field: 'date', label: 'Date' },
      { field: 'reason', label: 'Reason' },
      { field: 'quantity', label: 'Qty', num: true },
      { field: 'value', label: 'Value (TZS)', num: true, money: true },
      { field: 'status', label: 'Status' },
    ],
    totals: ['quantity', 'value'],
  },
  {
    key: 'mms-consumption',
    rows: 'consumption',
    usesCategory: false,
    fallbackLabel: 'MMS Consumption',
    cols: [
      { field: 'item_name', label: 'Item' },
      { field: 'unit', label: 'Unit' },
      { field: 'reference_type', label: 'Transaction' },
      { field: 'quantity', label: 'Qty out', num: true },
      { field: 'value', label: 'Value (TZS)', num: true, money: true },
    ],
    totals: ['value'],
  },
  {
    key: 'mms-bill-passing',
    rows: 'bills',
    usesCategory: false,
    fallbackLabel: 'MMS Bill Passing',
    cols: [
      { field: 'grn_number', label: 'GRN number' },
      { field: 'received_date', label: 'Received' },
      { field: 'po_number', label: 'PO number' },
      { field: 'inspection_status', label: 'Inspection' },
      { field: 'passed', label: 'Passed' },
    ],
    totals: ['bills', 'passed', 'pending'],
  },
  {
    key: 'tax-detail',
    rows: 'bills',
    usesCategory: false,
    fallbackLabel: 'Tax Detail (VAT)',
    cols: [
      { field: 'grn_number', label: 'GRN number' },
      { field: 'received_date', label: 'Received' },
      { field: 'taxable_value', label: 'Taxable (TZS)', num: true, money: true },
      { field: 'vat_percent', label: 'VAT %', num: true },
      { field: 'vat_amount', label: 'VAT (TZS)', num: true, money: true },
      { field: 'total_with_vat', label: 'Total incl. VAT (TZS)', num: true, money: true },
    ],
    totals: ['taxable_value', 'vat_amount', 'total_with_vat'],
  },
]

// Inventory tab state: selected template, response payload and loading flag.
const invTemplate = ref('ledger-summary')
const invData = ref(null)
const invLoading = ref(false)
// Void audit view toggle (only rendered for templates that support it).
const invVoided = ref(false)

/** Config object for the currently selected inventory template. */
const invConfig = computed(() => INV_TEMPLATES.find((tpl) => tpl.key === invTemplate.value))

/** Whether the category filter applies to this template. */
const invUsesCategory = computed(() => !!invConfig.value?.usesCategory)

/** Display title for the active template. */
const invTitle = computed(() =>
  t('reports.inv_' + invTemplate.value, invConfig.value?.fallbackLabel || ''),
)

/** Rows extracted from whichever key the template reads. */
const invRows = computed(() => {
  const data = invData.value
  if (!data) return []
  // Detail registers carry a lines/items array per header row.
  const rowsKey = invConfig.value.rows
  return (data[rowsKey] || []).map((row) => ({
    ...row,
    items_count: Array.isArray(row.items) ? row.items.length : undefined,
    lines_count: Array.isArray(row.lines) ? row.lines.length : undefined,
    variance_qty: Array.isArray(row.lines) && row.lines.some((l) => l.variance !== undefined)
      ? Math.round(row.lines.reduce((sum, l) => sum + Number(l.variance || 0), 0) * 100) / 100
      : undefined,
    void_reason: row.void_info?.reason,
  }))
})

/** Column definitions for the active template. */
const invCols = computed(() => invConfig.value?.cols || [])

/** Totals footer entries (money keys formatted as TZS, plain numbers raw). */
const invTotalsText = computed(() => {
  const totals = invData.value?.totals || {}
  const moneyKeys = new Set(invConfig.value.cols?.filter((c) => c.money).map((c) => c.field) || [])
  const countKeys = ['count', 'transfers', 'runs', 'indents', 'market_lists', 'bills', 'passed', 'pending', 'quantity', 'variance_qty']
  return (invConfig.value?.totals || [])
    .filter((key) => totals[key] !== undefined)
    .map((key) => ({
      label: String(key).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      value: moneyKeys.has(key) || !countKeys.includes(key) ? fmtMoney(totals[key]) : String(totals[key]),
    }))
})

/** Loads the selected inventory report with the shared window filters. */
async function loadInventoryReport() {
  const tpl = invConfig.value
  if (!tpl) return
  invLoading.value = true
  error.value = ''
  try {
    const params = {}
    if (!tpl.noWindow) {
      params.from = stockFrom.value
      params.to = stockTo.value
    }
    if (tpl.key === 'closing-stock') params.as_of = stockTo.value
    else if (tpl.usesCategory && stockCategory.value) params.category = stockCategory.value
    if (tpl.supportsVoided && invVoided.value) params.voided = 1
    if (tpl.detailMode) params.detail = 1
    const res = await reportApi.inventoryReport(tpl.report || tpl.key, params)
    invData.value = res.data
  } catch (err) {
    error.value = err.response?.data?.message || t('reports.loadError')
  } finally {
    invLoading.value = false
  }
}


/* ---------------- Bookings + F&B tabs ---------------- */

// Both analytics tabs share the stock tab's date range fields; each keeps
// its own payload and lazy-load flag.
const bookingsData = ref({})
const bookingsLoading = ref(false)
const bookingsLoaded = ref(false)
const fnbData = ref({ top_items: [], per_waiter: [] })
const fnbLoading = ref(false)
const fnbLoaded = ref(false)

/** Loads booking volumes, channel mix and health figures. */
async function loadBookings() {
  bookingsLoading.value = true
  error.value = ''
  try {
    const res = await reportApi.bookings({ from: stockFrom.value, to: stockTo.value })
    bookingsData.value = res.data
    bookingsLoaded.value = true
  } catch (err) {
    error.value = err.response?.data?.message || t('reports.loadError')
  } finally {
    bookingsLoading.value = false
  }
}

/** Widest source bar defines the 100% reference for the mix chart. */
function sourcePct(count) {
  const max = Math.max(...Object.values(bookingsData.value.by_source || { a: 1 }), 1)
  return Math.round((count / max) * 100)
}

/** Loads F&B sales analytics. */
async function loadFnb() {
  fnbLoading.value = true
  error.value = ''
  try {
    const res = await reportApi.fnb({ from: stockFrom.value, to: stockTo.value })
    fnbData.value = res.data
    fnbLoaded.value = true
  } catch (err) {
    error.value = err.response?.data?.message || t('reports.loadError')
  } finally {
    fnbLoading.value = false
  }
}

/** CSV export of the best-seller table. */
function exportTopItems() {
  exportCSV('top-menu-items', fnbData.value.top_items || [], [
    { key: 'item_name', label: t('menu.itemName') },
    { key: 'qty', label: t('reports.qtySold') },
    { key: 'revenue', label: t('reports.value') },
  ])
}

/** CSV export of waiter throughput. */
function exportWaiters() {
  exportCSV('waiter-throughput', fnbData.value.per_waiter || [], [
    { key: 'name', label: t('users.name') },
    { key: 'orders', label: t('reports.fnbOrders') },
    { key: 'revenue', label: t('reports.value') },
  ])
}

/** CSV export of the whole F&B daily series. */
function exportFnbs() {
  exportCSV('fnb-daily-sales', fnbData.value.daily || [], [
    { key: 'date', label: t('reports.date') },
    { key: 'orders', label: t('reports.fnbOrders') },
    { key: 'revenue', label: t('reports.value') },
  ])
}

/**
 * Fetches a page of audit log entries matching the current audit filters.
 * @param {number} [page=1] - The page of audit logs to request.
 */
async function loadAuditLogs(page = 1) {
  auditLoading.value = true
  error.value = ''
  try {
    const res = await reportApi.auditLogs({
      action: auditFilters.action || undefined,
      from: auditFilters.from || undefined,
      to: auditFilters.to || undefined,
      search: auditFilters.search || undefined,
      page,
    })
    auditLogs.value = res.data.data
    auditMeta.value = res.data
    auditLoaded.value = true
  } catch (err) {
    error.value = err.response?.data?.message || t('reports.auditLoadError')
  } finally {
    auditLoading.value = false
  }
}

function loadAllAuditLogs() {
  return collectAllRows((page, perPage) =>
    reportApi.auditLogs({
      action: auditFilters.action || undefined,
      from: auditFilters.from || undefined,
      to: auditFilters.to || undefined,
      search: auditFilters.search || undefined,
      page,
      per_page: perPage,
    }),
  )
}

/** Formats a timestamp as a localized string, or an em dash when absent. */
function formatDateTime(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString()
}

/** Returns the CSS badge class for a given audit action. */
function actionBadge(action) {
  const map = {
    create: 'badge-green',
    update: 'badge-yellow',
    delete: 'badge-red',
    login: 'badge-blue',
    logout: 'badge-gray',
  }
  return map[action] || 'badge-gray'
}

// Display labels for each room status bucket in the breakdown grid.
const ROOM_STATUS_LABELS = {
  total: t('reports.statusTotal'),
  available: t('reports.statusAvailable'),
  occupied: t('reports.statusOccupied'),
  cleaning: t('reports.statusCleaning'),
  maintenance: t('reports.statusMaintenance'),
  dirty: t('reports.statusDirty'),
}

// Overview tab state: loading flags, date range and report datasets.
const loading = ref(false)
const error = ref('')
const from = ref(todayMinus(6))
const to = ref(today())
const occupancy = ref([])
const revenue = ref({})
const roomStatus = ref({})

/** Computes the average occupancy rate across the loaded occupancy rows. */
const avgOccupancy = computed(() => {
  if (!occupancy.value.length) return 0
  const total = occupancy.value.reduce((sum, row) => sum + Number(row.occupancy_rate), 0)
  return Math.round(total / occupancy.value.length)
})

/** Returns today's date as an ISO string (yyyy-mm-dd). */
function today() {
  return new Date().toISOString().slice(0, 10)
}

/** Returns the date `days` days before today as an ISO string. */
function todayMinus(days) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

/** Formats an ISO date as a short dd/mm label for the chart axis. */
function shortDate(isoDate) {
  const date = new Date(isoDate + 'T00:00:00')
  return `${date.getDate()}/${date.getMonth() + 1}`
}

/** Computes the percentage width of a room-type bar relative to the total room count. */
function typeBar(type) {
  const total = roomStatus.value.by_type?.total || roomStatus.value.total || 1
  const count = Number(roomStatus.value.by_type?.[type] || 0)
  return Math.round((count / total) * 100)
}

/** Sets the date range to the current week (Monday through today) and reloads reports. */
function setThisWeek() {
  const d = new Date()
  const day = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - day)
  from.value = d.toISOString().slice(0, 10)
  to.value = today()
  loadReports()
}

/** Sets the date range to the current calendar month and reloads reports. */
function setThisMonth() {
  from.value = new Date().toISOString().slice(0, 8) + '01'
  to.value = today()
  loadReports()
}

/** Fetches the current room status breakdown for the overview tab. */
async function loadRoomStatus() {
  try {
    const res = await reportApi.roomStatus()
    roomStatus.value = res.data
  } catch (err) {
    error.value = err.response?.data?.message || t('reports.failedRoomStatus')
  }
}

/** Loads occupancy and revenue reports for the selected date range in parallel. */
async function loadReports() {
  loading.value = true
  error.value = ''
  try {
    const [occ, rev] = await Promise.all([
      reportApi.occupancy({ from: from.value, to: to.value }),
      reportApi.revenue({ from: from.value, to: to.value }),
    ])
    occupancy.value = occ.data.occupancy || []
    revenue.value = rev.data
  } catch (err) {
    error.value = err.response?.data?.message || t('reports.loadError')
  } finally {
    loading.value = false
  }
}

/** Reloads whichever tab is active (audit log or overview reports). */
function reload() {
  if (activeTab.value === 'audit') {
    loadAuditLogs(auditMeta.value.current_page)
    return
  }
  if (activeTab.value === 'stock') {
    loadStockLedger()
    return
  }
  loadRoomStatus()
  loadReports()
}

// Timestamp captured for the printed-by footer.
const printedAt = new Date().toLocaleString()

// Load the hotel logo once so the branded print header can show it.
async function loadReportLogo() {
  try {
    const res = await hotelSettingsApi.show()
    reportLogo.value = res?.data?.hotel?.logo_url || ''
  } catch {
    reportLogo.value = ''
  }
}

onMounted(() => {
  reload()
  loadReportLogo()
})
</script>

<style scoped>
.dashboard-page {
  padding: 32px 20px;
}

.page-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
}

.page-head h1 {
  font-size: 28px;
  font-weight: 800;
}

.head-actions {
  display: flex;
  gap: 10px;
}

.filter-bar {
  margin-bottom: 16px;
  padding: 16px 20px;
}

.filter-grid {
  display: grid;
  grid-template-columns: repeat(4, auto);
  gap: 12px;
  align-items: end;
}

.audit-filters {
  grid-template-columns: repeat(4, 1fr) auto;
}

.filter-actions {
  display: flex;
  gap: 8px;
  padding-bottom: 1px;
}

.tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.tab-btn {
  padding: 10px 16px;
  border: 1px solid #e2e2e2;
  background: #fff;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  color: #555;
  display: flex;
  align-items: center;
  gap: 8px;
}

.tab-btn.active {
  background: #005eb8;
  border-color: #005eb8;
  color: #fff;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-top: 20px;
}

.mono {
  font-family: monospace;
}

.capitalize {
  text-transform: capitalize;
}

.dash-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  margin-bottom: 24px;
}

.dash-section {
  padding: 24px;
}

.dash-section h2 {
  font-size: 17px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.dash-section h2 i {
  color: #005eb8;
}

.section-header-row {
  margin-bottom: 16px;
}

.room-status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
  gap: 12px;
}

.room-status-item {
  background: #fafafa;
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.room-status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #bbb;
}

.room-status-dot.total {
  background: #6c757d;
}

.room-status-dot.available {
  background: #27ae60;
}

.room-status-dot.occupied {
  background: #005eb8;
}

.room-status-dot.cleaning {
  background: #005eb8;
}

.room-status-dot.maintenance {
  background: #7f8c8d;
}

.room-status-dot.dirty {
  background: #c0392b;
}

.room-status-label {
  font-size: 12px;
  color: #757575;
}

.room-status-value {
  font-size: 20px;
  font-weight: 700;
}

.type-breakdown {
  margin-top: 20px;
}

.type-breakdown h3 {
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #005eb8;
  margin-bottom: 10px;
}

.type-row {
  display: grid;
  grid-template-columns: 120px 1fr 40px;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
  font-size: 13px;
}

.capitalize {
  text-transform: capitalize;
}

.bar {
  background: #f1f1f1;
  border-radius: 4px;
  height: 8px;
  overflow: hidden;
}

.bar-fill {
  background: #005eb8;
  height: 100%;
  border-radius: 4px;
}

.method-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.method-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 10px;
  border-bottom: 1px solid #f5f5f5;
  font-size: 14px;
}

.method-row:last-child {
  border-bottom: none;
}

.price {
  font-weight: 700;
  color: #005eb8;
}

.occupancy-chart {
  display: flex;
  align-items: flex-end;
  gap: 6px;
  height: 220px;
  padding-top: 10px;
  overflow-x: auto;
}

.occ-column {
  flex: 1;
  min-width: 34px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  height: 100%;
}

.occ-bar-wrap {
  flex: 1;
  width: 100%;
  display: flex;
  align-items: flex-end;
}

.occ-bar {
  width: 100%;
  min-height: 4px;
  background: linear-gradient(180deg, #005eb8, #005eb8);
  border-radius: 4px 4px 0 0;
}

.occ-label {
  font-size: 10px;
  color: #757575;
  white-space: nowrap;
}

.occ-value {
  font-size: 11px;
  font-weight: 600;
  color: #333;
}

.muted {
  color: #757575;
  font-size: 13px;
}

@media (max-width: 768px) {
  .dashboard-page {
    padding: 20px 16px;
  }

  .page-head {
    flex-direction: column;
    align-items: flex-start;
  }

  .filter-grid {
    grid-template-columns: 1fr;
  }

  .dash-grid {
    grid-template-columns: 1fr;
  }
}

/* ---------------- Bookings + F&B analytics ---------------- */

.bar-track {
  flex: 1;
  height: 8px;
  border-radius: 4px;
  background: rgba(107, 114, 128, 0.15);
  overflow: hidden;
  margin: 0 10px;
}

.bar-fill {
  height: 100%;
  background: #3b82f6;
  border-radius: 4px;
}

.health-rows {
  display: grid;
  gap: 6px;
}

.text-warn {
  color: #ff6b6b;
}

.mini-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.mini-table th,
.mini-table td {
  padding: 7px 10px;
  border-bottom: 1px solid var(--border, #e5e7eb);
  text-align: left;
}

.mini-table .num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

/* ---------------- Stock ledger ---------------- */

.checkbox-group {
  display: flex;
  align-items: flex-end;
}

.checkbox-label {
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 0.9rem;
  cursor: pointer;
}

.stock-ledger {
  display: grid;
  gap: 16px;
}

.ledger-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 8px;
}

.ledger-head h2 {
  margin: 0;
  font-size: 1.2rem;
}

.ledger-head span {
  color: var(--text-muted, #6b7280);
  font-size: 0.9rem;
}

.ledger-item-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 6px;
  padding: 10px 14px;
  background: rgba(59, 130, 246, 0.08);
  border-bottom: 1px solid var(--border, #e5e7eb);
}

.ledger-item-head h3 {
  margin: 0;
  font-size: 1rem;
}

.ledger-balance {
  font-size: 0.85rem;
  color: var(--text-muted, #6b7280);
}

.ledger-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}

.ledger-table th,
.ledger-table td {
  padding: 6px 10px;
  border-bottom: 1px solid var(--border, #e5e7eb);
  text-align: left;
  white-space: nowrap;
}

.ledger-table th {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--text-muted, #6b7280);
}

.ledger-table .num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.ledger-table .mono {
  font-family: monospace;
  font-size: 0.8rem;
}

.opening-row td {
  font-style: italic;
  color: var(--text-muted, #6b7280);
  background: rgba(107, 114, 128, 0.06);
}

.in-cell { color: #28c76f; font-weight: 600; }
.out-cell { color: #ff6b6b; font-weight: 600; }

.no-movements {
  padding: 10px 14px;
  color: var(--text-muted, #6b7280);
  font-size: 0.9rem;
}

.ledger-totals {
  display: flex;
  justify-content: flex-end;
  gap: 24px;
  flex-wrap: wrap;
  padding: 12px 16px;
  font-size: 1rem;
}

/* Screen: the branded print header/footer are hidden on screen. */
.print-brand-head,
.print-brand-foot { display: none; }

/* Print: only the report content survives, in Ezee style — brand header,
   lines between every table row, and a printed-by footer. */
@media print {
  body * {
    visibility: hidden;
  }

  #stock-ledger-print,
  #stock-ledger-print *,
  .print-brand-head,
  .print-brand-head *,
  .print-brand-foot,
  .print-brand-foot *,
  .card:has(table) .ledger-table,
  .card:has(table) .ledger-table * {
    visibility: visible;
  }

  #stock-ledger-print,
  .print-brand-head,
  .print-brand-foot {
    position: absolute;
    width: 100%;
  }

  .print-brand-head {
    inset: 0 0 auto 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    text-align: center;
    margin-bottom: 14px;
  }
  .print-brand-head .report-brand { display: flex; align-items: center; gap: 10px; }
  .print-brand-head .report-logo { height: 40px; max-width: 160px; object-fit: contain; }
  .print-brand-head .report-brand h2 {
    margin: 0; font-size: 20px; letter-spacing: 0.5px; text-transform: uppercase; color: #0b1f33;
  }
  .print-brand-head .report-title {
    margin: 0; font-size: 15px; text-transform: uppercase; letter-spacing: 1px; color: #00468c;
  }
  .print-brand-head .report-period { font-size: 12px; color: #555; }

  .print-brand-foot {
    inset: auto 0 0 0;
    margin-top: 14px;
    font-size: 12px;
    color: #555;
    display: block;
  }

  .print-brand-head { position: relative; display: flex; }

  .ledger-table { border-collapse: collapse; width: 100%; }
  .ledger-table th {
    border: 1px solid #222;
    background: #0b1f33 !important;
    color: #fff;
    padding: 6px 8px;
    font-size: 12px;
    text-transform: uppercase;
  }
  .ledger-table td {
    border: 1px solid #999;
    padding: 5px 8px;
  }
  .ledger-table tbody tr { border-bottom: 1px solid #666; }
  .ledger-table tfoot td,
  .ledger-table .totals-row td {
    border: 1px solid #222;
    font-weight: 700;
    background: #f0f0f0;
  }

  .no-print-summary .btn,
  .tabs,
  .filter-bar,
  .page-head,
  .head-actions {
    display: none !important;
  }

  @page {
    size: A4 portrait;
    margin: 12mm;
  }
}
</style>
