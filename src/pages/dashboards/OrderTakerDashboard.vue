<!--
  Waiter / bartender landing dashboard, styled after the classic touch-POS
  order screen (eachdepartmentdata.png): a single column with the order
  header (No, waiter, diners, VIP, transaction type), the order-lines table
  (Qty / Item / Price / Amount), Page start / Page end paginators and a
  grid of big category buttons. Tapping a category pops up its items;
  tapping an item adds it to the order - one click, nothing else.
  The job here is strictly to TAKE orders: no editing, deleting, printing
  or settling - those stay with the manager on the orders module.
-->
<template>
  <div class="taker-page">
    <!-- One-place tabs: take a new order or work the open ones (single tap) -->
    <nav class="pos-tabs">
      <button
        type="button"
        class="pos-tab"
        :class="{ active: activeTab === 'new' }"
        @click="activeTab = 'new'"
      >
        <i class="fas fa-utensils" aria-hidden="true"></i> {{ $t('orderTaker.tabNewOrder') }}
      </button>
      <button
        type="button"
        class="pos-tab"
        :class="{ active: activeTab === 'open' }"
        @click="switchToOpen"
      >
        <i class="fas fa-list-check" aria-hidden="true"></i> {{ $t('orderTaker.tabOpenOrders') }}
        <span v-if="openOrders.length" class="pos-tab-badge">{{ openOrders.length }}</span>
      </button>
      <button
        type="button"
        class="pos-tab"
        :class="{ active: activeTab === 'summary' }"
        @click="switchToSummary"
      >
        <i class="fas fa-chart-simple" aria-hidden="true"></i> {{ $t('orderTaker.tabOrderSummary') }}
      </button>

      <!-- Department switch: flips menu categories, open orders and defaults -->
      <div class="dept-toggle" role="group" :aria-label="$t('orderTaker.department')">
        <button
          type="button"
          :class="{ active: department === 'restaurant' }"
          :aria-pressed="department === 'restaurant'"
          @click="switchDepartment('restaurant')"
        >
          <i class="fas fa-utensils" aria-hidden="true"></i> {{ $t('orderTaker.restaurant') }}
        </button>
        <button
          type="button"
          :class="{ active: department === 'bar' }"
          :aria-pressed="department === 'bar'"
          @click="switchDepartment('bar')"
        >
          <i class="fas fa-martini-glass" aria-hidden="true"></i> {{ $t('orderTaker.bar') }}
        </button>
      </div>
    </nav>

    <template v-if="activeTab === 'new'">
    <div class="taker-split">
      <!-- LEFT: categories + search + inline items (Ezee-style picker) -->
      <div class="ts-left">
        <!-- Big category buttons, like the department buttons of the reference -->
        <div class="cat-panel">
          <div class="cat-panel-head">
            <i class="fas fa-th-large" aria-hidden="true"></i> {{ $t('orderTaker.categories') }}
            <span class="cat-dept">{{ $t(`orderTaker.${department}`) }}</span>
            <input
              v-model.trim="searchQuery"
              type="search"
              class="cat-search"
              :placeholder="$t('orderTaker.searchPlaceholder')"
              @focus="openCategory('')"
              @keydown.esc="closeCategory"
            />
          </div>
          <div v-if="menuLoading" class="cat-loading"><i class="fas fa-spinner fa-spin" aria-hidden="true"></i></div>
          <div v-else-if="categories.length" class="cat-grid">
            <button
              v-for="cat in categories"
              :key="cat"
              type="button"
              class="cat-btn"
              :class="{ active: activeCategory === cat }"
              @click="openCategory(cat)"
            >
              {{ cat }}
            </button>
          </div>
          <p v-else class="cat-empty">{{ $t('orderTaker.noCategories') }}</p>
        </div>

        <!-- Inline items for the active category / search result (non-blocking) -->
        <div v-if="activeCategory || searchQuery" class="inline-items">
          <header class="inline-items-head">
            <strong>{{ searchQuery ? $t('orderTaker.searchTitle') : activeCategory }}</strong>
            <button type="button" class="line-remove" :title="$t('orderTaker.close')" @click="closeCategory">
              <i class="fas fa-times" aria-hidden="true"></i>
            </button>
          </header>
          <div v-if="popupItems.length" class="cat-pop-grid inline-grid">
            <button
              v-for="item in popupItems"
              :key="item.menu_item_id"
              type="button"
              class="cat-item"
              :class="{ 'on-order': lineFor(item) }"
              @click="addItem(item)"
            >
              <span class="cat-item-name">{{ item.item_name }}</span>
              <span class="cat-item-price">TZS {{ money(item.price) }}</span>
              <span v-if="qtyFor(item)" class="cat-item-qty">×{{ qtyFor(item) }}</span>
            </button>
          </div>
          <p v-else class="cat-empty">{{ $t('orderTaker.emptyCategory') }}</p>
        </div>

        <!-- Dine-in table map: which tables are free vs occupied (and by whom) -->
        <div class="table-map" v-if="tables.length">
          <div class="cat-panel-head">
            <i class="fas fa-chair" aria-hidden="true"></i> {{ $t('orderTaker.tablesLabel') }}
            <span class="cat-dept"></span>
          </div>
          <div class="table-map-grid">
            <button
              v-for="tbl in tables"
              :key="tbl.table_id"
              type="button"
              class="table-chip"
              :class="tableOccupiedByOther(tbl.table_name) ? 'occupied' : 'free'"
              :disabled="tableOccupiedByOther(tbl.table_name)"
              @click="selectTable(tbl)"
            >
              <span class="table-chip-name">{{ tbl.table_name }}</span>
              <span v-if="tableOccupiedByOther(tbl.table_name)" class="table-chip-occ">
                {{ $t('orderTaker.occupiedBy', { waiter: occupiedTables.get(String(tbl.table_name)) }) }}
              </span>
              <span v-else class="table-chip-free">{{ $t('orderTaker.tableFree') }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- RIGHT: the selected order panel, like the Ezee order book -->
      <div class="ts-right">
        <!-- Order header: No, waiter, diners, VIP, transaction type -->
        <header class="order-header">
          <div class="oh-field">
            <label>{{ $t('orderTaker.orderNo') }}</label>
            <span class="oh-static">-</span>
          </div>
          <div class="oh-field">
            <label>{{ $t('orderTaker.waiter') }}</label>
            <span class="oh-static">{{ waiterName }}</span>
          </div>
          <div class="oh-field">
            <label>{{ $t('orderTaker.diners') }}</label>
            <div class="covers-step">
              <button type="button" :disabled="!form.covers" @click="form.covers = Math.max(0, form.covers - 1)">-</button>
              <span>{{ form.covers }}</span>
              <button type="button" @click="form.covers = Math.min(999, form.covers + 1)">+</button>
            </div>
          </div>
          <div class="oh-field">
            <label>{{ $t('orderTaker.table') }}</label>
            <SearchableSelect
              v-model="form.table_number"
              :options="tableOptions"
              :empty-label="$t('orderTaker.selectTable')"
              force-search
            />
          </div>
          <label class="oh-check">
            <input type="checkbox" disabled />
            <span>{{ $t('orderTaker.vip') }}</span>
          </label>
          <button
            v-if="canManageTables"
            type="button"
            class="oh-manage"
            @click="openTableManager"
          >
            <i class="fas fa-chair" aria-hidden="true"></i> {{ $t('orderTaker.manageTables') }}
          </button>
        </header>

        <!-- Order lines table: Qty / Item / Price / Amount -->
        <div class="lines-wrap">
          <table class="lines-table">
            <thead>
              <tr>
                <th class="col-qty">{{ $t('orderTaker.qty') }}</th>
                <th>{{ $t('orderTaker.item') }}</th>
                <th class="col-price">{{ $t('orderTaker.price') }}</th>
                <th class="col-amount">{{ $t('orderTaker.amount') }}</th>
                <th class="col-x"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="line in pagedLines" :key="line.key || line.menu_item_id">
                <td class="col-qty">
                  <div class="qty-step">
                    <button type="button" :disabled="line.quantity <= 1" @click="stepQty(line, -1)">-</button>
                    <span>{{ line.quantity }}</span>
                    <button type="button" @click="stepQty(line, 1)">+</button>
                  </div>
                </td>
                <td>{{ line.item_name }}</td>
                <td class="col-price">{{ money(line.unit_price) }}</td>
                <td class="col-amount">{{ money(line.subtotal) }}</td>
                <td class="col-x">
                  <button type="button" class="line-remove" :title="$t('orderTaker.removeLine')" @click="removeLine(line)">
                    <i class="fas fa-times" aria-hidden="true"></i>
                  </button>
                </td>
              </tr>
              <tr v-if="!orderLines.length">
                <td colspan="5" class="empty-cell">{{ $t('orderTaker.empty') }}</td>
              </tr>
            </tbody>
          </table>
          <input v-model.trim="form.notes" type="text" class="notes-line" :placeholder="$t('orderTaker.notesPlaceholder')" />
        </div>

        <!-- Page start / page end + total + send -->
        <div class="pager-row">
          <button type="button" class="pager-btn" :disabled="page <= 1" @click="setPage(1)">
            <i class="fas fa-angles-left" aria-hidden="true"></i> {{ $t('orderTaker.pageStart') }}
          </button>
          <div class="total-bar">
            <span>{{ $t('orderTaker.total') }}</span>
            <strong>TZS {{ money(grandTotal) }}</strong>
          </div>
          <button type="button" class="pager-btn" :disabled="page >= pageCount" @click="setPage(pageCount)">
            {{ $t('orderTaker.pageEnd') }} <i class="fas fa-angles-right" aria-hidden="true"></i>
          </button>
        </div>

        <p v-if="sendError" class="send-error">{{ sendError }}</p>

        <button type="button" class="send-btn" :disabled="!orderLines.length || sending" @click="sendOrder">
          <i v-if="sending" class="fas fa-circle-notch fa-spin" aria-hidden="true"></i>
          <i v-else class="fas fa-paper-plane" aria-hidden="true"></i>
          {{ sending ? $t('orderTaker.sending') : $t('orderTaker.send') }}
        </button>
      </div>
    </div>
    </template>

    <!-- Open orders: the whole service lifecycle on one screen, single taps -->
    <div v-else-if="activeTab === 'open'" class="open-panel">
      <div class="open-head">
        <h2>{{ $t('orderTaker.tabOpenOrders') }} · {{ $t(`orderTaker.${department}`) }}</h2>
        <button type="button" class="oh-manage" @click="loadOpenOrders">
          <i class="fas fa-rotate" aria-hidden="true"></i> {{ $t('orderTaker.refresh') }}
        </button>
      </div>
      <p v-if="openError" class="send-error">{{ openError }}</p>
      <div v-if="openLoading" class="cat-loading"><i class="fas fa-spinner fa-spin" aria-hidden="true"></i></div>
      <p v-else-if="!openOrders.length" class="cat-empty">{{ $t('orderTaker.noOpenOrders') }}</p>
      <div v-else class="open-grid">
        <article v-for="order in openOrders" :key="order.order_id" class="open-card">
          <header class="open-card-head">
            <strong>{{ order.order_number }}</strong>
            <span class="open-badge" :class="statusBadge(order.status)">{{ statusLabel(order.status) }}</span>
          </header>
          <p class="open-meta">
            <i class="fas fa-location-dot" aria-hidden="true"></i>
            {{ order.table_number ? $t('orders.tableN', { number: order.table_number })
              : order.room_number ? $t('orders.roomN', { number: order.room_number })
              : order.guest_name || '—' }}
            · {{ order.waiter_name || '—' }}
          </p>
          <ul class="open-items">
            <li v-for="item in order.items || []" :key="item.order_item_id">
              {{ item.quantity }}× {{ item.item_name }}<template v-if="item.accompaniment"> · {{ item.accompaniment }}</template>
            </li>
          </ul>
          <p class="open-total">{{ $t('orderTaker.orderTotal') }}: <strong>TZS {{ money(order.total_amount) }}</strong>
            · <span :class="order.payment_status === 'unpaid' ? 'pay-unpaid' : 'pay-ok'">{{ order.payment_status }}</span>
          </p>
          <!-- Single-tap lifecycle: next status, payment, bill to room -->
          <div class="open-actions">
            <button
              v-if="order.status === 'pending'"
              type="button"
              class="open-btn warn"
              @click="advanceOrder(order, 'preparing')"
            >
              <i class="fas fa-fire-burner" aria-hidden="true"></i> {{ $t('orderTaker.markPreparing') }}
            </button>
            <button
              v-else-if="['preparing', 'in_progress', 'processing'].includes(order.status)"
              type="button"
              class="open-btn info"
              @click="advanceOrder(order, 'ready')"
            >
              <i class="fas fa-bell-concierge" aria-hidden="true"></i> {{ $t('orderTaker.markReady') }}
            </button>
            <button
              v-else-if="order.status === 'ready'"
              type="button"
              class="open-btn ok"
              @click="advanceOrder(order, 'served')"
            >
              <i class="fas fa-utensils" aria-hidden="true"></i> {{ $t('orderTaker.markServed') }}
            </button>
            <template v-if="order.payment_status === 'unpaid' && canCollect">
              <button type="button" class="open-btn pay" @click="openPay(order)">
                <i class="fas fa-money-bill-wave" aria-hidden="true"></i> {{ $t('orderTaker.collectPayment') }}
              </button>
              <button
                v-if="order.room_number && canBillToRoom"
                type="button"
                class="open-btn room"
                @click="billToRoom(order)"
              >
                <i class="fas fa-bed" aria-hidden="true"></i> {{ $t('orderTaker.billToRoom') }}
              </button>
            </template>
            <button
              v-if="order.status === 'served' && order.payment_status !== 'unpaid'"
              type="button"
              class="open-btn done"
              @click="advanceOrder(order, 'completed')"
            >
              <i class="fas fa-check" aria-hidden="true"></i> {{ $t('orderTaker.markCompleted') }}
            </button>
          </div>
        </article>
      </div>
    </div>

    <!-- Order Summary: the signed-in waiter's tickets and totals for today -->
    <div v-else class="summary-panel">
      <div class="open-head">
        <h2><i class="fas fa-chart-simple" aria-hidden="true"></i> {{ $t('orderTaker.summaryTitle') }}</h2>
        <button type="button" class="oh-manage" @click="loadOrderSummary">
          <i class="fas fa-rotate" aria-hidden="true"></i> {{ $t('orderTaker.refresh') }}
        </button>
      </div>
      <p v-if="summaryLoading" class="cat-loading"><i class="fas fa-spinner fa-spin" aria-hidden="true"></i></p>
      <template v-else>
        <p v-if="summaryError" class="send-error">{{ summaryError }}</p>
        <div class="summary-kpis">
          <div class="summary-kpi kpi-running">
            <span class="sk-label">{{ $t('orderTaker.summaryRunning') }}</span>
            <strong>{{ summaryRunning }}</strong>
          </div>
          <div class="summary-kpi kpi-settled">
            <span class="sk-label">{{ $t('orderTaker.summarySettled') }}</span>
            <strong>{{ summarySettled }}</strong>
          </div>
          <div class="summary-kpi kpi-voided">
            <span class="sk-label">{{ $t('orderTaker.summaryVoided') }}</span>
            <strong>{{ summaryVoided }}</strong>
          </div>
          <div class="summary-kpi kpi-total">
            <span class="sk-label">{{ $t('orderTaker.summaryTotalToday') }}</span>
            <strong>TZS {{ money(summaryTotal) }}</strong>
          </div>
        </div>

        <div class="summary-quick">
          <router-link to="/app/messages" class="summary-link"><i class="fas fa-comments" aria-hidden="true"></i> {{ $t('orderTaker.summaryMessages') }}</router-link>
          <router-link to="/app/statuses" class="summary-link"><i class="fas fa-circle-dot" aria-hidden="true"></i> {{ $t('orderTaker.summaryStatuses') }}</router-link>
          <router-link to="/app/issue-reports" class="summary-link"><i class="fas fa-flag" aria-hidden="true"></i> {{ $t('orderTaker.summaryIssueReports') }}</router-link>
        </div>

        <div class="panel table-card">
          <p v-if="!myOrders.length" class="cat-empty">{{ $t('orderTaker.summaryNoOrders') }}</p>
          <div v-else class="table-scroll">
            <table class="lines-table summary-table">
              <thead>
                <tr>
                  <th>{{ $t('orderTaker.summaryOrder') }}</th>
                  <th>{{ $t('orderTaker.summaryTime') }}</th>
                  <th>{{ $t('orderTaker.summaryWaiter') }}</th>
                  <th>{{ $t('orderTaker.summaryType') }}</th>
                  <th>{{ $t('orderTaker.summaryStatus') }}</th>
                  <th class="col-amount">{{ $t('orderTaker.summaryAmount') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="order in myOrders" :key="order.order_id">
                  <td><strong>{{ order.order_number }}</strong></td>
                  <td>{{ timeOf(order.created_at) }}</td>
                  <td>{{ order.waiter_name || '—' }}</td>
                  <td>{{ orderTypeLabel(order) }}</td>
                  <td><span class="badge" :class="statusBadge(order.status)">{{ statusLabel(order.status) }}</span></td>
                  <td class="col-amount"><strong>TZS {{ money(order.total_amount) }}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </template>
    </div>

    <!-- Collect payment popup (single tap on a method) -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="payOrder" class="cat-pop" role="dialog" :aria-label="$t('orderTaker.payTitle')">
          <div class="cat-pop-backdrop" @click="payOrder = null"></div>
          <div class="cat-pop-panel accomp-panel">
            <header class="cat-pop-head">
              <strong>{{ $t('orderTaker.payTitle') }} · {{ payOrder.order_number }}</strong>
              <button type="button" class="cat-pop-close" :aria-label="$t('orderTaker.close')" @click="payOrder = null">
                <i class="fas fa-times" aria-hidden="true"></i>
              </button>
            </header>
            <p class="accomp-hint">TZS {{ money(payOrder.total_amount) }}</p>
            <div class="accomp-grid">
              <button
                v-for="method in paymentMethodOptions"
                :key="method.value"
                type="button"
                class="accomp-option"
                :disabled="paying"
                @click="pay(method.value)"
              >
                {{ method.label }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Receipt: the proof of what was paid (printable) -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="receipt" class="cat-pop" role="dialog" :aria-label="$t('orderTaker.receiptTitle')">
          <div class="cat-pop-backdrop" @click="receipt = null"></div>
          <div class="cat-pop-panel receipt-panel">
            <div id="pos-receipt" class="receipt">
              <h3>{{ authStore.user?.tenant?.hotel_name || 'MRK Hotels' }}</h3>
              <p class="rc-line">{{ $t('orderTaker.receiptTitle') }}</p>
              <p class="rc-line">{{ receipt.order_number }} · {{ new Date(receipt.paid_at).toLocaleString() }}</p>
              <hr />
              <p class="rc-total">TZS {{ money(receipt.total) }}</p>
              <p class="rc-line">{{ $t('paymentFields.method') }}: {{ methodLabel(receipt.method) }}</p>
              <p class="rc-line">{{ $t('orderTaker.receiptRef') }}: {{ receipt.transaction_reference }}</p>
              <p class="rc-line">{{ $t('orderTaker.receiptBy') }}: {{ receipt.collected_by }}</p>
              <p class="rc-thanks">{{ $t('orderTaker.receiptThanks') }}</p>
            </div>
            <div class="receipt-actions no-print">
              <button type="button" class="btn btn-secondary" @click="printReceipt">
                <i class="fas fa-print" aria-hidden="true"></i> {{ $t('common.print') }}
              </button>
              <button type="button" class="btn btn-primary" @click="receipt = null">
                {{ $t('common.close') }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- "Served with" popup: single-tap side dish for grill mains (Beef Mshikaki → Wali/Ugali…) -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="accompItem" class="cat-pop" role="dialog" :aria-label="$t('orders.servedWithTitle')">
          <div class="cat-pop-backdrop" @click="skipAccompaniment"></div>
          <div class="cat-pop-panel accomp-panel">
            <header class="cat-pop-head">
              <strong>{{ $t('orders.servedWithTitle') }}</strong>
              <button type="button" class="cat-pop-close" :aria-label="$t('orderTaker.close')" @click="skipAccompaniment">
                <i class="fas fa-times" aria-hidden="true"></i>
              </button>
            </header>
            <p class="accomp-hint">
              {{ $t('orders.servedWithHint', { item: accompItem.item_name }) }}
            </p>
            <div class="accomp-grid">
              <button
                v-for="option in accompanimentOptions"
                :key="option.value"
                type="button"
                class="accomp-option"
                @click="chooseAccompaniment(option.value)"
              >
                {{ option.label }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Manager-only table management modal (CRUD for the table list) -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="tableManagerOpen" class="cat-pop" @click.self="tableManagerOpen = false">
          <div class="cat-pop-backdrop" @click="tableManagerOpen = false"></div>
          <div class="cat-pop-panel tm-pop" role="dialog" :aria-label="$t('orderTaker.manageTables')">
            <header class="cat-pop-head">
              <strong>{{ $t('orderTaker.manageTables') }}</strong>
              <button type="button" class="cat-pop-close" @click="tableManagerOpen = false">
                <i class="fas fa-times" aria-hidden="true"></i>
              </button>
            </header>
            <form class="tm-form" @submit.prevent="saveTable">
              <input
                v-model.trim="tableForm.table_name"
                type="text"
                class="tm-input"
                :placeholder="$t('orderTaker.tableName')"
                required
              />
              <select v-model="tableForm.section" class="tm-input">
                <option v-for="sec in sectionOptions" :key="sec" :value="sec">
                  {{ $t('orderTaker.' + sec, sec) }}
                </option>
              </select>
              <input
                v-model.number="tableForm.capacity"
                type="number"
                min="1"
                max="50"
                class="tm-input tm-cap"
                :placeholder="$t('orderTaker.capacity')"
              />
              <button type="submit" class="tm-add" :disabled="tableSaving">
                <i class="fas" :class="tableForm.table_id ? 'fa-save' : 'fa-plus'" aria-hidden="true"></i>
                {{ tableForm.table_id ? $t('common.update') : $t('common.add') }}
              </button>
              <button
                v-if="tableForm.table_id"
                type="button"
                class="tm-cancel"
                @click="resetTableForm"
              >
                {{ $t('common.cancel') }}
              </button>
            </form>
            <p v-if="tableError" class="tm-error">{{ tableError }}</p>
            <ul class="tm-list">
              <li v-for="tbl in tables" :key="tbl.table_id" class="tm-row">
                <span class="tm-name">{{ tbl.table_name }}</span>
                <span class="tm-meta">{{ $t('orderTaker.' + tbl.section, tbl.section) }} · {{ tbl.capacity }}</span>
                <button type="button" class="tm-btn" @click="editTable(tbl)">
                  <i class="fas fa-pen" aria-hidden="true"></i>
                </button>
                <button type="button" class="tm-btn danger" @click="deleteTable(tbl)">
                  <i class="fas fa-trash" aria-hidden="true"></i>
                </button>
              </li>
              <li v-if="!tables.length" class="tm-empty">{{ $t('orderTaker.noTables') }}</li>
            </ul>

            <div v-if="canManageTables" class="tm-locs">
              <div class="tm-locs-head">
                <strong>{{ $t('orderTaker.tableLocations') }}</strong>
                <span class="tm-locs-hint">{{ $t('orderTaker.tableLocationsHint') }}</span>
              </div>
              <form class="tm-locs-form" @submit.prevent="addLocation">
                <input
                  v-model.trim="locationInput"
                  type="text"
                  class="tm-input"
                  :placeholder="$t('orderTaker.locationPlaceholder')"
                />
                <button type="submit" class="tm-add" :disabled="locationSaving || !locationInput">
                  <i class="fas fa-plus" aria-hidden="true"></i>
                  {{ $t('common.add') }}
                </button>
              </form>
              <p v-if="locationError" class="tm-error">{{ locationError }}</p>
              <ul class="tm-chip-list">
                <li v-for="loc in tableLocations" :key="loc.location_id" class="tm-chip">
                  <span>{{ $t('orderTaker.' + loc.name, loc.name) }}</span>
                  <button
                    type="button"
                    class="tm-chip-del"
                    :aria-label="$t('common.delete')"
                    @click="removeLocation(loc)"
                  >
                    <i class="fas fa-times" aria-hidden="true"></i>
                  </button>
                </li>
                <li v-if="!tableLocations.length" class="tm-empty">{{ $t('orderTaker.noLocations') }}</li>
              </ul>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Success toast -->
    <Transition name="fade">
      <div v-if="sentToast" class="toast"><i class="fas fa-check-circle" aria-hidden="true"></i> {{ sentToast }}</div>
    </Transition>
  </div>
</template>
<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { orderApi, menuItemApi, tableApi, tableLocationApi } from '@/api'
import SearchableSelect from '@/components/SearchableSelect.vue'
import { PAYMENT_METHODS } from '@/utils/payments'
import { restorePrinter } from '@/utils/printer'
import { usePrintSettingsStore } from '@/stores/printSettings'
import { displayLines } from '@/utils/receipts'
import { toast } from '@/utils/toast'

const { t } = useI18n()
const authStore = useAuthStore()
const printStore = usePrintSettingsStore()

// The department defaults from the staff role (bartenders start on the bar)
// but can be switched at any time with the Restaurant / Bar toggle.
const role = computed(() => authStore.user?.user_role || '')
const department = ref(role.value === 'bartender' ? 'bar' : 'restaurant')

/** The order type the API accepts for the current department (dine_in / at_bar). */
function defaultOrderType() {
  return department.value === 'bar' ? 'at_bar' : 'dine_in'
}

/** Flips between restaurant and bar: clears the ticket, resets category and reloads. */
function switchDepartment(dept) {
  if (department.value === dept) return
  department.value = dept
  activeCategory.value = ''
  orderLines.value = []
  form.value = { table_number: '', covers: 0, order_type: defaultOrderType(), notes: '' }
  loadMenu()
  loadOpenOrders()
}

/* ---------------- One-place tabs: new order vs open orders ---------------- */

// Which side of the POS is showing: 'new' (take order) or 'open' (work orders).
const activeTab = ref('new')
const openOrders = ref([])
const openLoading = ref(false)
const openError = ref('')

// Waiters and bartenders take orders but never settle bills; settlements are
// left to the cashier's Order Summary. Only receptionist (level 60) and above
// may collect payment on a ticket.
const canCollect = computed(() => authStore.can(60))

// Floor staff (waiters/bartenders) only see and work their own tickets; the
// Open Orders board is scoped to them so they never touch another waiter's.
const isFloorStaff = computed(() => ['waiter', 'bartender'].includes(role.value))

// Bill-to-room posts to a guest folio, so it stays at receptionist level (60)
// and up — same gate as the backend's `level:60` middleware on that route.
const canBillToRoom = computed(() => authStore.can(60) && authStore.canOperate)

const paymentMethodOptions = PAYMENT_METHODS.map((method) => ({
  value: method,
  label: t(`paymentFields.methods.${method}`),
}))

/** Switches to the open-orders tab and refreshes it. */
function switchToOpen() {
  activeTab.value = 'open'
  loadOpenOrders()
}

/* ---------------- Waiter account: order summary + quick links ---------------- */

// The waiter's own orders for the day, plus their totals.
const myOrders = ref([])
const summaryLoading = ref(false)
const summaryError = ref('')

/** Whether the given order belongs to the currently signed-in waiter. */
function isMine(order) {
  const me = String(waiterName.value || '').trim().toLowerCase()
  if (!me) return true
  const theirs = String(order.waiter_name || '').trim().toLowerCase()
  return !theirs || theirs === me
}

const summaryRunning = computed(
  () => myOrders.value.filter((o) => !['completed', 'cancelled'].includes(o.status)).length,
)
const summarySettled = computed(
  () => myOrders.value.filter((o) => o.status === 'completed' || o.payment_status !== 'unpaid').length,
)
const summaryVoided = computed(
  () => myOrders.value.filter((o) => o.status === 'cancelled').length,
)
const summaryTotal = computed(() =>
  myOrders.value.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0),
)

/** Switches to the order-summary tab and refreshes the waiter's tickets. */
function switchToSummary() {
  activeTab.value = 'summary'
  loadOrderSummary()
}

/** Loads today's orders and keeps only those attributed to this waiter. */
async function loadOrderSummary() {
  summaryLoading.value = true
  summaryError.value = ''
  try {
    const res = await orderApi.index({ department: department.value, per_page: 100 })
    const rows = Array.isArray(res.data) ? res.data : res.data?.data || []
    myOrders.value = rows.filter(isMine)
  } catch (err) {
    summaryError.value = err.response?.data?.message || t('orderTaker.loadOrdersError')
    myOrders.value = []
  } finally {
    summaryLoading.value = false
  }
}

/** Human time from an ISO string. */
function timeOf(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

/** Reads the order type, falling back to the room/table to label DINE IN etc. */
function orderTypeLabel(order) {
  const type = order.order_type
  if (type) return type.replace('_', ' ').toUpperCase()
  if (order.room_number) return t('orderTaker.orderTypeRoom')
  if (order.table_number) return t('orderTaker.orderTypeDineIn')
  return t('orderTaker.orderTypeTakeAway')
}

/** Loads today's still-open orders for this department (the kitchen queue). */
async function loadOpenOrders() {
  openLoading.value = true
  openError.value = ''
  try {
    const res = await orderApi.index({ department: department.value, per_page: 50 })
    const rows = Array.isArray(res.data) ? res.data : res.data?.data || []
    openOrders.value = rows
      .filter((order) => !['completed', 'cancelled'].includes(order.status))
      .filter((order) => (isFloorStaff.value ? isMine(order) : true))
  } catch (err) {
    openError.value = err.response?.data?.message || t('orderTaker.loadOrdersError')
    openOrders.value = []
  } finally {
    openLoading.value = false
  }
}

/** Translates an order status code into its display label. */
function statusLabel(status) {
  const map = {
    pending: t('orders.statusPending'),
    in_progress: t('orders.statusInProgress'),
    processing: t('orders.statusProcessing'),
    preparing: t('orders.statusPreparing'),
    ready: t('orders.statusReady'),
    served: t('orders.statusServed'),
    completed: t('orders.statusCompleted'),
    cancelled: t('orders.statusCancelled'),
  }
  return map[status] || status
}

/** Maps an order status to its badge CSS class. */
function statusBadge(status) {
  const map = {
    pending: 'badge-yellow',
    in_progress: 'badge-red',
    processing: 'badge-yellow',
    preparing: 'badge-blue',
    ready: 'badge-blue',
    served: 'badge-green',
    completed: 'badge-green',
    cancelled: 'badge-red',
  }
  return map[status] || 'badge-gray'
}

/** Advances an order one step in its lifecycle with a single tap. */
async function advanceOrder(order, status) {
  openError.value = ''
  try {
    await orderApi.update(order.order_id, { status })
    sentToast.value = t('orderTaker.orderUpdated', { number: order.order_number })
    setTimeout(() => (sentToast.value = ''), 3000)
    await loadOpenOrders()
    // Cloud Print Settings: print a void receipt when an order is cancelled.
    if (status === 'cancelled' && printStore.printOnVoid && order) {
      const hotel = authStore.user?.tenant?.hotel_name || 'MRK Hotels'
      if (!(await printStore.print(displayLines(order, 'receipt', { hotel })))) {
        toast(t('orderTaker.noPrinter'), 'error')
      }
    }
  } catch (err) {
    openError.value = err.response?.data?.message || t('common.actionFailed')
  }
}

// Collect-payment popup state.
const payOrder = ref(null)

// Proof of payment shown after collecting (also printable).
const receipt = ref(null)
const paying = ref(false)

/** Opens the payment popup for an unpaid order. */
function openPay(order) {
  payOrder.value = order
}

/** Records the payment with the tapped method and closes the popup. */
async function pay(method) {
  if (!payOrder.value || paying.value) return
  paying.value = true
  openError.value = ''
  try {
    const res = await orderApi.pay(payOrder.value.order_id, { method })
    const payment = res.data?.payment || {}
    const order = { ...payOrder.value, _payment: payment }
    if (!order.items?.length) {
      try {
        const { data } = await orderApi.show(order.order_id)
        order.items = data.order?.items || []
      } catch {
        /* receipt still prints with whatever items we have */
      }
    }
    receipt.value = {
      order_number: order.order_number,
      total: order.total_amount,
      paid_at: payment.paid_at || new Date().toISOString(),
      method: payment.method,
      transaction_reference: payment.transaction_reference,
      collected_by: payment.collected_by,
      order,
    }
    // Silent till printing — no browser dialog.
    if (printStore.printOnSettle) {
      const hotel = authStore.user?.tenant?.hotel_name || 'MRK Hotels'
      if (!(await printStore.print(displayLines(order, 'receipt', { hotel })))) {
        toast(t('orderTaker.noPrinter'), 'error')
      }
    }
    sentToast.value = t('orders.paymentCollected')
    setTimeout(() => (sentToast.value = ''), 3000)
    payOrder.value = null
    await loadOpenOrders()
  } catch (err) {
    openError.value = err.response?.data?.message || t('common.actionFailed')
  } finally {
    paying.value = false
  }
}

/** Display label for a payment method code. */
function methodLabel(code) {
  return paymentMethodOptions.find((m) => m.value === code)?.label || code
}

/** Prints the receipt of the last collection silently on the till printer. */
async function printReceipt() {
  const order = receipt.value?.order
  if (!order) return
  const hotel = authStore.user?.tenant?.hotel_name || 'MRK Hotels'
  const sent = await printStore.print(displayLines(order, 'receipt', { hotel }))
  if (!sent) toast(t('orderTaker.noPrinter'), 'error')
}

/** Bills an unpaid room order to the guest's room account with one tap. */
async function billToRoom(order) {
  openError.value = ''
  try {
    await orderApi.billToRoom(order.order_id, {})
    sentToast.value = t('orders.billedToRoom')
    setTimeout(() => (sentToast.value = ''), 3000)
    await loadOpenOrders()
  } catch (err) {
    openError.value = err.response?.data?.message || t('common.actionFailed')
  }
}

// Keep the open-orders board fresh while that tab is showing.
let openPoll = null

// The waiter name is auto-stamped from the logged-in staff member — the
// order belongs to them; they cannot impersonate another waiter.
const waiterName = computed(
  () =>
    authStore.user?.full_name ||
    [authStore.user?.first_name, authStore.user?.last_name].filter(Boolean).join(' ') ||
    authStore.user?.email ||
    '',
)

// The order being built: header fields plus the item lines.
const form = ref({
  table_number: '',
  covers: 0,
  order_type: defaultOrderType(),
  notes: '',
})
const orderLines = ref([])
const sending = ref(false)
const sendError = ref('')
const sentToast = ref('')
// When a waiter re-opens one of their own tables, this holds the running order
// id so sendOrder() appends the new lines instead of creating a duplicate order.
const continueOrderId = ref(null)

// Physical tables managed by the manager; the waiter only picks one.
const tables = ref([])

// Registrable table locations backing the "second dropdown" in the table
// manager. Defaults (restaurant/bar/lounge/terrace) are seeded server-side.
const tableLocations = ref([])
const DEFAULT_LOCATIONS = ['restaurant', 'bar', 'lounge', 'terrace']

// Tables currently held by an open, unpaid order (occupied until the bill is
// settled) — map of table name -> waiter who occupies it. Shared from the
// open-orders board so a waiter can never double-book a live table.
const occupiedTables = computed(() => {
  const map = new Map()
  for (const order of openOrders.value) {
    if (!order.table_number) continue
    if (['completed', 'cancelled'].includes(order.status)) continue
    if (order.payment_status === 'paid') continue
    const key = String(order.table_number)
    if (!map.has(key)) map.set(key, order.waiter_name || t('orderTaker.otherWaiter'))
  }
  return map
})
/** True when the named table has any live (running, unpaid) order. */
function tableHasLiveOrder(name) {
  return occupiedTables.value.has(String(name))
}

/** True when the named table is occupied by someone else (not this waiter), so
 *  a waiter's own occupied table stays selectable for continuing its ticket. */
function tableOccupiedByOther(name) {
  const occupant = occupiedTables.value.get(String(name))
  if (!occupant) return false
  return String(occupant).toLowerCase() !== String(waiterName.value).toLowerCase()
}

/** The waiter's own running order sitting on the named table, if any. */
function ownLiveOrderForTable(name) {
  return openOrders.value.find(
    (o) =>
      String(o.table_number) === String(name) &&
      String(o.waiter_name || '').toLowerCase() === String(waiterName.value).toLowerCase() &&
      !['completed', 'cancelled'].includes(o.status),
  )
}

/** Selects a table for the ticket. Re-opening the waiter's own occupied table
 *  loads its existing lines so they can continue that ticket (issue 7); any
 *  other table starts a fresh order. */
function selectTable(tbl) {
  const name = tbl.table_name
  const continueTarget = ownLiveOrderForTable(name)

  if (continueTarget) {
    continueOrderId.value = continueTarget.order_id
    orderLines.value = (continueTarget.items || []).map((item) => ({
      key: `${item.menu_item_id}|${item.accompaniment || ''}`,
      menu_item_id: item.menu_item_id,
      item_name: item.item_name,
      accompaniment: item.accompaniment || '',
      unit_price: Number(item.unit_price) || 0,
      quantity: Number(item.quantity) || 1,
      subtotal: Number(item.subtotal) || 0,
      existing: true,
    }))
  } else {
    continueOrderId.value = null
  }

  form.value.table_number = name
  form.value.covers = continueTarget?.covers || form.value.covers || 0
  page.value = pageCount.value
}

/** Active tables as searchable options (name + section for context). Occupied
 *  tables are listed (with the occupant's name) but disabled for other waiters. */
const tableOptions = computed(() =>
  tables.value.map((tbl) => {
    const name = String(tbl.table_name)
    const occupant = occupiedTables.value.get(name)
    const isSelf = occupant && String(occupant).toLowerCase() === String(waiterName.value).toLowerCase()
    const disabled = Boolean(occupant) && !isSelf
    const label = tbl.section ? `${tbl.table_name} · ${tbl.section}` : tbl.table_name
    return {
      value: tbl.table_name,
      label: occupant && disabled ? `${label} — ${t('orderTaker.occupiedBy', { waiter: occupant })}` : label,
      disabled,
      _occupant: occupant,
    }
  }),
)
const canManageTables = computed(() => ['hotel_admin', 'manager'].includes(role.value))

/** Loads the active tables for the table picker (all staff can read them). */
async function loadTables() {
  try {
    const res = await tableApi.index({ is_active: 1 })
    const d = res.data
    tables.value = Array.isArray(d) ? d : d?.data || []
  } catch {
    tables.value = []
  }
}

/* ---------------- Manager: table CRUD ---------------- */

const tableManagerOpen = ref(false)
const tableSaving = ref(false)
const tableError = ref('')
const tableForm = ref({ table_id: null, table_name: '', section: 'restaurant', capacity: 4 })

/** Opens the table manager and refreshes the list. */
function openTableManager() {
  resetTableForm()
  tableManagerOpen.value = true
  loadTables()
  loadTableLocations()
}

/** Loads the registrable locations for the section dropdown (all staff can read). */
async function loadTableLocations() {
  try {
    const res = await tableLocationApi.index()
    const d = res.data
    tableLocations.value = Array.isArray(d) ? d : d?.data || []
  } catch {
    tableLocations.value = []
  }
}

/** Order-preserving fallback so a bare select never renders empty: registered
 *  locations first, then the built-in defaults for anything missing. */
const sectionOptions = computed(() => {
  const names = tableLocations.value.map((l) => String(l.name))
  const extras = DEFAULT_LOCATIONS.filter((n) => !names.includes(n))
  return [...tableLocations.value.map((l) => l.name), ...extras]
})

/** Clears the table form back to "add" mode. */
function resetTableForm() {
  tableForm.value = { table_id: null, table_name: '', section: 'restaurant', capacity: 4 }
  tableError.value = ''
}

/** Loads an existing table into the form for editing. */
function editTable(tbl) {
  tableForm.value = {
    table_id: tbl.table_id,
    table_name: tbl.table_name,
    section: tbl.section,
    capacity: tbl.capacity,
  }
}

/** Creates or updates a table, then refreshes the picker list. */
async function saveTable() {
  tableSaving.value = true
  tableError.value = ''
  try {
    const payload = {
      table_name: tableForm.value.table_name,
      section: tableForm.value.section,
      capacity: tableForm.value.capacity,
    }
    if (tableForm.value.table_id) {
      await tableApi.update(tableForm.value.table_id, payload)
    } else {
      await tableApi.store(payload)
    }
    resetTableForm()
    await loadTables()
  } catch (err) {
    tableError.value = err.response?.data?.message || t('orderTaker.tableSaveError')
  } finally {
    tableSaving.value = false
  }
}

/** Deletes a table and refreshes the picker list. */
async function deleteTable(tbl) {
  tableError.value = ''
  try {
    await tableApi.destroy(tbl.table_id)
    await loadTables()
  } catch (err) {
    tableError.value = err.response?.data?.message || t('orderTaker.tableSaveError')
  }
}

/* ---------------- Manager: table locations (registrable dropdown) ---------------- */

const locationInput = ref('')
const locationSaving = ref(false)
const locationError = ref('')

/** Adds a new location so it becomes available in the section dropdown. */
async function addLocation() {
  const name = locationInput.value.trim()
  if (!name) return
  locationSaving.value = true
  locationError.value = ''
  try {
    await tableLocationApi.store({ name })
    locationInput.value = ''
    await loadTableLocations()
  } catch (err) {
    locationError.value = err.response?.data?.message || t('orderTaker.locationSaveError')
  } finally {
    locationSaving.value = false
  }
}

/** Removes a location from the dropdown (tables already using it keep their section). */
async function removeLocation(loc) {
  locationError.value = ''
  try {
    await tableLocationApi.destroy(loc.location_id)
    if (tableForm.value.section === loc.name) {
      tableForm.value.section = sectionOptions.value.find((s) => s !== loc.name) || 'restaurant'
    }
    await loadTableLocations()
  } catch (err) {
    locationError.value = err.response?.data?.message || t('orderTaker.locationSaveError')
  }
}

// Menu items for this department, grouped into tappable categories
// (like the department buttons of the reference POS screenshot).
const menu = ref([])
const menuLoading = ref(true)
const activeCategory = ref('')

/** All available items of this department. */
const availableMenu = computed(() => menu.value.filter((item) => item.is_available))

/** Category buttons (distinct categories of this department's menu, ordered by sort_order). */
const categories = computed(() => {
  const seen = new Map()
  availableMenu.value.forEach((item) => {
    if (!item.category || seen.has(item.category)) return
    seen.set(item.category, item.category_order || 0)
  })
  return [...seen.entries()]
    .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
    .map(([name]) => name)
})

/** Items shown in the popup for the active category. */
const categoryItems = computed(() => {
  if (!activeCategory.value) return []
  return availableMenu.value.filter((item) => item.category === activeCategory.value)
})

// Universal search: lets the waiter look up an item (or category) across the
// whole department menu without having to reopen category by category.
const searchQuery = ref('')
/** Items that match the universal search across every category. */
const searchResults = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return []
  return availableMenu.value.filter(
    (item) =>
      item.item_name.toLowerCase().includes(q) ||
      (item.category || '').toLowerCase().includes(q),
  )
})
/** When a search is active we show results from every category at once. */
const popupItems = computed(() =>
  searchQuery.value.trim() ? searchResults.value : categoryItems.value,
)

// Lines table window: the reference shows 8 rows with PÁG. INICIO/FINAL.
const LINES_PER_PAGE = 8
const page = ref(1)

/** Number of pages of order lines. */
const pageCount = computed(() => Math.max(1, Math.ceil(orderLines.value.length / LINES_PER_PAGE)))

/** The order lines visible on the current page. */
const pagedLines = computed(() => {
  const start = (page.value - 1) * LINES_PER_PAGE
  return orderLines.value.slice(start, start + LINES_PER_PAGE)
})

/** Grand total of the current ticket. */
const grandTotal = computed(() =>
  orderLines.value.reduce((sum, l) => sum + l.subtotal, 0),
)

/** Formats a money value with thousands separators. */
function money(value) {
  return Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/** Jumps to the first or last page of order lines. */
function setPage(p) {
  page.value = Math.min(Math.max(1, p), pageCount.value)
}

/** Opens the popup listing the items of a category (and clears any search). */
function openCategory(cat) {
  activeCategory.value = cat
  searchQuery.value = ''
}

/** Closes the category popup and clears any active search. */
function closeCategory() {
  activeCategory.value = ''
  searchQuery.value = ''
}

/** The existing line for a menu item (any accompaniment), or undefined. */
function lineFor(item) {
  return orderLines.value.find((l) => l.menu_item_id === item.menu_item_id)
}

/** Quantity of a menu item across all its lines (for the ×N badge). */
function qtyFor(item) {
  return orderLines.value
    .filter((l) => l.menu_item_id === item.menu_item_id)
    .reduce((sum, l) => sum + l.quantity, 0)
}

// ---------------------------------------------------------------------------
// "Served with" accompaniments: grill-style mains (mshikaki, nyama choma,
// kuku, samaki…) need a side (wali, ugali, chips…). Tapping such an item
// pops a quick single-tap prompt before it lands on the ticket.
// ---------------------------------------------------------------------------

/** Accompaniment choices shown in the "served with" prompt. */
const accompanimentOptions = computed(() => [
  { value: 'wali', label: t('orders.accompWali') },
  { value: 'ugali', label: t('orders.accompUgali') },
  { value: 'chips', label: t('orders.accompChips') },
  { value: 'chapati', label: t('orders.accompChapati') },
  { value: 'ndizi', label: t('orders.accompNdizi') },
  { value: 'maharage', label: t('orders.accompMaharage') },
  { value: '', label: t('orders.accompNone') },
])

/** Name keywords that mark a menu item as a grill-style main needing a side. */
const GRILL_KEYWORDS = ['mshikaki', 'mishkaki', 'choma', 'kuku', 'nyama', 'samaki', 'maini', 'grill']

// The grill item waiting for its accompaniment choice.
const accompItem = ref(null)

/** True when a menu item is a grill-style main (needs a side dish). */
function isGrillItem(item) {
  const name = (item.item_name || '').toLowerCase()
  return GRILL_KEYWORDS.some((keyword) => name.includes(keyword))
}

/** Translates a stored accompaniment code back into its display label. */
function accompanimentLabel(value) {
  return accompanimentOptions.value.find((option) => option.value === value)?.label || value
}

/** Adds a menu item to the ticket (or bumps its quantity).
 * Grill-style mains in the restaurant first ask what they're served with
 * (wali, ugali, chips…) - one extra tap, then the item lands on the ticket.
 */
function addItem(item) {
  if (department.value === 'restaurant' && isGrillItem(item)) {
    accompItem.value = item
    return
  }
  commitItem(item, '')
}

/** Actually places the item on the ticket with the chosen accompaniment. */
function commitItem(item, accompaniment) {
  const key = `${item.menu_item_id}|${accompaniment}`
  const line = orderLines.value.find((l) => l.key === key)
  if (line) {
    line.quantity++
    line.subtotal = line.unit_price * line.quantity
  } else {
    orderLines.value.push({
      key,
      menu_item_id: item.menu_item_id,
      item_name: accompaniment
        ? `${item.item_name} · ${accompanimentLabel(accompaniment)}`
        : item.item_name,
      accompaniment,
      unit_price: Number(item.price),
      quantity: 1,
      subtotal: Number(item.price),
    })
  }
  // Keep the newest line visible in the 8-row window.
  page.value = pageCount.value
}

/** Records the chosen accompaniment (or none) and puts the item on the ticket. */
function chooseAccompaniment(value) {
  const item = accompItem.value
  accompItem.value = null
  if (item) commitItem(item, value)
}

/** Cancels the "served with" prompt without adding the item. */
function skipAccompaniment() {
  accompItem.value = null
}

/** Steps a line's quantity (never below 1). */
function stepQty(line, delta) {
  line.quantity = Math.max(1, line.quantity + delta)
  line.subtotal = line.unit_price * line.quantity
}

/** Removes a line from the ticket before it is sent. */
function removeLine(line) {
  orderLines.value = orderLines.value.filter((l) => (l.key || l.menu_item_id) !== (line.key || line.menu_item_id))
}

/** Sends the ticket to the kitchen/bar. For a fresh order it creates one; for
 *  a table the waiter already opened (continueOrderId) it appends the new
 *  lines to that same order so nothing is ever duplicated. */
async function sendOrder() {
  if (!orderLines.value.length || sending.value) return
  // Creating a brand-new order on a table that already has a live ticket is
  // blocked; continuing an ongoing ticket (continueOrderId) is allowed.
  if (form.value.table_number && tableHasLiveOrder(form.value.table_number) && !continueOrderId.value) {
    sendError.value = t('orderTaker.tableOccupied')
    return
  }
  sending.value = true
  sendError.value = ''
  try {
    const newLines = orderLines.value.filter((l) => !l.existing)
    const itemsPayload = newLines.map((l) => ({
      menu_item_id: l.menu_item_id,
      quantity: l.quantity,
      accompaniment: l.accompaniment || null,
    }))

    if (continueOrderId.value) {
      if (itemsPayload.length) {
        const res = await orderApi.addItems(continueOrderId.value, { items: itemsPayload })
        const number = res.data?.order?.order_number || ''
        sentToast.value = t('orderTaker.sent', { number })
      }
      // The just-sent lines become part of the existing ticket so they are not
      // re-appended next time; the waiter keeps adding to the same order.
      orderLines.value = orderLines.value.map((l) => (l.existing ? l : { ...l, existing: true }))
    } else {
      const res = await orderApi.store({
        department: department.value,
        table_number: form.value.table_number || null,
        covers: form.value.covers || null,
        waiter_name: waiterName.value,
        order_type: defaultOrderType(),
        notes: form.value.notes || null,
        items: itemsPayload,
      })
      const number = res.data?.order?.order_number || ''
      sentToast.value = t('orderTaker.sent', { number })
      orderLines.value = []
      form.value = { table_number: '', covers: 0, order_type: defaultOrderType(), notes: '' }
    }
    setTimeout(() => (sentToast.value = ''), 4000)
    loadOpenOrders()
  } catch (err) {
    sendError.value = err.response?.data?.message || t('orderTaker.sendError')
  } finally {
    sending.value = false
  }
}

/** Loads this department's menu items (the API caps pages at 100 rows). */
async function loadMenu() {
  menuLoading.value = true
  try {
    const params = { department: department.value, is_available: 1, per_page: 100 }
    const first = await menuItemApi.index({ ...params, page: 1 })
    const rows = [...(Array.isArray(first.data) ? first.data : first.data?.data || [])]
    const lastPage = first.data?.meta?.last_page || first.data?.last_page || 1
    for (let p = 2; p <= lastPage; p++) {
      const res = await menuItemApi.index({ ...params, page: p })
      const d = res.data
      rows.push(...(Array.isArray(d) ? d : d?.data || []))
    }
    menu.value = rows
  } catch {
    menu.value = []
  } finally {
    menuLoading.value = false
  }
}

onMounted(() => {
  restorePrinter()
  loadMenu()
  loadTables()
  loadOpenOrders()
  // While the open-orders tab is showing, keep the board fresh every 30s.
  openPoll = setInterval(() => {
    if (activeTab.value === 'open') loadOpenOrders()
  }, 30000)
  document.addEventListener('keydown', onKey)
})

onUnmounted(() => {
  clearInterval(openPoll)
  document.removeEventListener('keydown', onKey)
})

/** Esc closes the category popup (and clears any search) — one tap to back out. */
function onKey(e) {
  if (e.key === 'Escape') {
    if (activeCategory.value || searchQuery.value) closeCategory()
    else if (payOrder.value) payOrder.value = null
    else if (tableManagerOpen.value) tableManagerOpen.value = false
  }
}
</script>

<style scoped>
/* Classic touch-POS surface: light neutral background, big tappable buttons */
.taker-page {
  min-height: 100vh;
  background: #e9e9ec;
  padding: 12px 16px 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Ezee-style split: left = category/item picker, right = the selected order. */
.taker-split {
  display: grid;
  grid-template-columns: 1.1fr 1fr;
  gap: 14px;
  align-items: start;
}
.ts-left,
.ts-right {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}
.ts-right {
  position: sticky;
  top: 12px;
}

.inline-items {
  background: #fff;
  border: 1px solid #d4d4d8;
  border-radius: 10px;
  overflow: hidden;
}
.inline-items-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 14px;
  background: #3f3f46;
  color: #fff;
  font-size: 14px;
  font-weight: 700;
}
.inline-items-head strong { text-transform: uppercase; letter-spacing: 0.03em; }
.inline-items-head .line-remove { color: #fff; background: none; border: none; font-size: 16px; cursor: pointer; }
.inline-grid { max-height: none; }

.cat-btn.active {
  background: #b8860b;
  color: #fff;
  border-color: #b8860b;
}

/* ---- Dine-in table map ---- */
.table-map {
  background: #fff;
  border: 1px solid #d4d4d8;
  border-radius: 10px;
  padding: 12px 14px;
}
.table-map-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 10px;
  max-height: 520px;
  overflow-y: auto;
  padding-right: 4px;
}
.table-chip {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid;
  text-align: left;
  cursor: pointer;
  transition: transform 0.12s, border-color 0.12s;
}
.table-chip:disabled { cursor: not-allowed; }
.table-chip.free {
  background: #f0fdf4;
  border-color: #86efac;
}
.table-chip.free:hover:not(:disabled) {
  transform: translateY(-2px);
  border-color: #16a34a;
}
.table-chip.occupied {
  background: #fef2f2;
  border-color: #fecaca;
}
.table-chip-name {
  font-weight: 700;
  font-size: 14px;
  color: #27272a;
}
.table-chip-occ {
  font-size: 11px;
  color: #b91c1c;
}
.table-chip-free {
  font-size: 11px;
  color: #15803d;
  font-weight: 600;
}

@media (max-width: 820px) {
  .taker-split { grid-template-columns: 1fr; }
  .ts-right { position: static; }
}

/* ---- Order header ---- */
.order-header {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  align-items: flex-end;
  background: #fff;
  border: 1px solid #d4d4d8;
  border-radius: 10px;
  padding: 12px 16px;
}

.oh-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 120px;
}

.oh-field label,
.oh-check span {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #71717a;
}

/* Covers (diner head-count) stepper in the order header */
.covers-step {
  display: flex;
  align-items: center;
  border: 1px solid #d4d4d8;
  border-radius: 6px;
  overflow: hidden;
}

.covers-step button {
  width: 34px;
  padding: 8px 0;
  font-size: 16px;
  font-weight: 700;
  background: #fafafa;
  border: none;
  cursor: pointer;
}

.covers-step button:disabled {
  opacity: 0.4;
  cursor: default;
}

.covers-step span {
  min-width: 40px;
  text-align: center;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.oh-static {
  font-weight: 700;
  color: #27272a;
  padding: 6px 0;
}

/* Table select matches the other header inputs */
.oh-select {
  cursor: pointer;
}

.oh-manage {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #c9a227;
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.oh-manage:hover { background: #a8871e; }

/* Manager table modal */
.tm-pop {
  width: 520px;
  max-width: 94vw;
}

.tm-form {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  padding: 14px;
  border-bottom: 1px solid #eee;
}

.tm-input {
  background: #fff;
  border: 1px solid #d4d4d8;
  border-radius: 6px;
  color: #1f2937;
  padding: 8px 10px;
  font-size: 13px;
  flex: 1;
  min-width: 120px;
}

.tm-cap { max-width: 90px; }

.tm-add {
  background: #2e7d32;
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.tm-add:disabled { opacity: 0.5; cursor: wait; }

.tm-cancel {
  background: #f1f5f9;
  color: #334155;
  border: 1px solid #d4d4d8;
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 13px;
  cursor: pointer;
}

.tm-error { color: #dc2626; font-size: 13px; padding: 8px 14px 0; }

.tm-list {
  list-style: none;
  margin: 0;
  padding: 10px 14px 14px;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tm-row {
  display: flex;
  align-items: center;
  gap: 10px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 9px 12px;
}

.tm-name { font-weight: 600; color: #1f2937; }

.tm-meta { color: #64748b; font-size: 12px; flex: 1; text-transform: capitalize; }

.tm-btn {
  background: #fff;
  color: #475569;
  border: 1px solid #d4d4d8;
  border-radius: 5px;
  padding: 5px 9px;
  cursor: pointer;
  font-size: 12px;
}

.tm-btn:hover { background: #f1f5f9; color: #1f2937; }
.tm-btn.danger { color: #dc2626; }
.tm-btn.danger:hover { background: #fef2f2; color: #b91c1c; }

.tm-empty { color: #94a3b8; font-size: 13px; text-align: center; padding: 14px; }

.tm-locs {
  border-top: 1px solid #eee;
  padding: 12px 14px 14px;
  background: #fafafa;
}

.tm-locs-head { display: flex; flex-direction: column; gap: 2px; margin-bottom: 10px; }
.tm-locs-head strong { font-size: 13px; color: #1f2937; }
.tm-locs-hint { font-size: 11px; color: #94a3b8; }

.tm-locs-form { display: flex; gap: 8px; margin-bottom: 8px; }

.tm-chip-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tm-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 999px;
  padding: 5px 6px 5px 12px;
  font-size: 12px;
  color: #1f2937;
}

.tm-chip-del {
  border: none;
  background: #f1f5f9;
  color: #64748b;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  cursor: pointer;
  font-size: 11px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.tm-chip-del:hover { background: #fee2e2; color: #b91c1c; }

.oh-input {
  border: 1px solid #d4d4d8;
  border-radius: 7px;
  padding: 6px 10px;
  font-size: 14px;
  min-width: 140px;
}

.oh-input:focus {
  outline: none;
  border-color: #b8860b;
}

.oh-check {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 0;
  cursor: default;
}

.type-toggle {
  display: flex;
  border: 1px solid #d4d4d8;
  border-radius: 7px;
  overflow: hidden;
}

.type-toggle button {
  border: none;
  background: #fff;
  padding: 7px 14px;
  font-size: 13px;
  font-weight: 600;
  color: #52525b;
  cursor: pointer;
}

.type-toggle button.active {
  background: #b8860b;
  color: #fff;
}

/* ---- Order lines table ---- */
.lines-wrap {
  background: #fff;
  border: 1px solid #d4d4d8;
  border-radius: 10px;
  overflow: hidden;
}

.lines-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.lines-table th {
  background: #3f3f46;
  color: #fff;
  text-align: left;
  padding: 10px 12px;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.lines-table td {
  padding: 10px 12px;
  border-bottom: 1px solid #ececf0;
  color: #27272a;
}

.lines-table tr:last-child td {
  border-bottom: none;
}

.col-qty { width: 150px; }
.col-price,
.col-amount { width: 130px; text-align: right; }
.col-x { width: 44px; }

.qty-step {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  border: 1px solid #d4d4d8;
  border-radius: 7px;
  overflow: hidden;
}

.qty-step button {
  border: none;
  background: #f4f4f5;
  width: 30px;
  height: 30px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  color: #3f3f46;
}

.qty-step button:disabled {
  opacity: 0.35;
  cursor: default;
}

.qty-step span {
  min-width: 28px;
  text-align: center;
  font-weight: 700;
}

.line-remove {
  border: none;
  background: none;
  color: #dc2626;
  cursor: pointer;
  font-size: 14px;
}

.empty-cell {
  text-align: center;
  color: #a1a1aa;
  padding: 34px 12px !important;
}

.notes-line {
  width: 100%;
  border: none;
  border-top: 1px solid #ececf0;
  padding: 10px 12px;
  font-size: 13px;
  color: #52525b;
  background: #fafafa;
}

.notes-line:focus {
  outline: none;
  background: #fffbeb;
}

/* ---- Pager + total ---- */
.pager-row {
  display: flex;
  align-items: stretch;
  gap: 10px;
}

.pager-btn {
  border: 1px solid #d4d4d8;
  background: #fff;
  border-radius: 8px;
  padding: 10px 16px;
  font-size: 13px;
  font-weight: 700;
  color: #3f3f46;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.pager-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

.total-bar {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #b8860b;
  color: #fff;
  border-radius: 8px;
  padding: 10px 18px;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.03em;
}

.total-bar strong {
  font-size: 20px;
}

.send-error {
  color: #dc2626;
  font-size: 13px;
  margin: 0;
  text-align: center;
}

.send-btn {
  border: none;
  background: #16a34a;
  color: #fff;
  border-radius: 10px;
  padding: 16px;
  font-size: 17px;
  font-weight: 800;
  letter-spacing: 0.04em;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  transition: background 0.15s;
}

.send-btn:hover:not(:disabled) {
  background: #15803d;
}

.send-btn:disabled {
  opacity: 0.45;
  cursor: default;
}

/* ---- Category buttons ---- */
.cat-panel {
  background: #fff;
  border: 1px solid #d4d4d8;
  border-radius: 10px;
  padding: 12px 14px;
}

.cat-panel-head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #71717a;
  margin-bottom: 10px;
}

.cat-dept {
  margin-left: auto;
  background: #fef3c7;
  color: #92400e;
  padding: 3px 12px;
  border-radius: 999px;
}

.cat-search {
  flex: 1 1 100%;
  width: 100%;
  border: 1px solid #d4d4d8;
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 14px;
  text-transform: none;
  letter-spacing: normal;
  font-weight: 500;
  color: #27272a;
  background: #fafafa;
}
.cat-search:focus {
  outline: none;
  border-color: #b8860b;
  background: #fff;
}

.cat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 10px;
}

.cat-btn {
  border: 1px solid #d4d4d8;
  background: linear-gradient(180deg, #fafafa, #f0f0f2);
  border-radius: 9px;
  padding: 22px 10px;
  font-size: 14px;
  font-weight: 700;
  color: #27272a;
  cursor: pointer;
  transition: transform 0.12s, border-color 0.12s, box-shadow 0.12s;
}

.cat-btn:hover {
  transform: translateY(-2px);
  border-color: #b8860b;
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.1);
}

.cat-loading {
  text-align: center;
  padding: 26px;
  color: #b8860b;
  font-size: 20px;
}

.cat-empty {
  text-align: center;
  color: #a1a1aa;
  padding: 20px;
  margin: 0;
}

/* ---- Category items popup ---- */
.cat-pop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cat-pop-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
}

.cat-pop-panel {
  position: relative;
  background: #fff;
  border-radius: 12px;
  width: min(760px, 94vw);
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
}

.cat-pop-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 14px 18px;
  background: #3f3f46;
  color: #fff;
  font-size: 16px;
}

.cat-pop-close {
  border: none;
  background: none;
  color: #fff;
  font-size: 18px;
  cursor: pointer;
}

.cat-pop-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: 10px;
  padding: 16px;
  overflow-y: auto;
}

.cat-item {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 6px;
  border: 1px solid #d4d4d8;
  background: #fff;
  border-radius: 9px;
  padding: 16px 12px;
  cursor: pointer;
  text-align: left;
  transition: transform 0.12s, border-color 0.12s;
}

.cat-item:hover {
  transform: translateY(-2px);
  border-color: #b8860b;
}

.cat-item.on-order {
  border-color: #b8860b;
  background: #fffbeb;
}

.cat-item-name {
  font-weight: 700;
  color: #27272a;
  font-size: 14px;
}

.cat-item-price {
  color: #b8860b;
  font-weight: 700;
  font-size: 13px;
}

.cat-item-qty {
  position: absolute;
  top: 8px;
  right: 8px;
  background: #b8860b;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
}

/* ---- Toast & transitions ---- */
.toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  background: #16a34a;
  color: #fff;
  padding: 12px 22px;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
  z-index: 1100;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* ---- "Served with" popup (single-tap side dish) ---- */
.accomp-panel {
  width: min(560px, 94vw);
}

.accomp-hint {
  margin: 0;
  padding: 12px 18px 0;
  color: #71717a;
  font-size: 13px;
}

.accomp-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 10px;
  padding: 16px;
}

.accomp-option {
  border: 1px solid #d4d4d8;
  background: linear-gradient(180deg, #fafafa, #f0f0f2);
  border-radius: 9px;
  padding: 20px 10px;
  font-size: 15px;
  font-weight: 700;
  color: #27272a;
  cursor: pointer;
  transition: transform 0.12s, border-color 0.12s, box-shadow 0.12s;
}

.accomp-option:hover {
  transform: translateY(-2px);
  border-color: #b8860b;
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.1);
}

/* ---- One-place tabs: New Order / Open Orders ---- */
.pos-tabs {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
}

/* ---- Department switch (Restaurant / Bar) ---- */
.dept-toggle {
  display: flex;
  border: 1px solid #d4d4d8;
  border-radius: 9px;
  overflow: hidden;
  min-width: 220px;
}

.dept-toggle button {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 16px 12px;
  font-size: 15px;
  font-weight: 700;
  color: #52525b;
  background: linear-gradient(180deg, #fafafa, #f0f0f2);
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}

.dept-toggle button + button {
  border-left: 1px solid #d4d4d8;
}

.dept-toggle button.active {
  background: #b8860b;
  color: #fff;
}


.pos-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid #d4d4d8;
  background: linear-gradient(180deg, #fafafa, #f0f0f2);
  border-radius: 9px;
  padding: 16px 10px;
  font-size: 15px;
  font-weight: 700;
  color: #52525b;
  cursor: pointer;
  transition: transform 0.12s, border-color 0.12s;
}

.pos-tab.active {
  background: #3f3f46;
  border-color: #3f3f46;
  color: #fff;
}

.pos-tab-badge {
  background: #b8860b;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  padding: 2px 9px;
  border-radius: 999px;
}

/* ---- Open orders board ---- */
.open-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.open-head h2 {
  font-size: 17px;
  font-weight: 800;
  color: #27272a;
}

.open-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}

.open-card {
  background: #fff;
  border: 1px solid #d4d4d8;
  border-radius: 12px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.open-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 15px;
  color: #27272a;
}

/* Waiter account order summary */
.summary-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.summary-kpis {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}
.summary-kpi {
  background: #fff;
  border: 1px solid #d4d4d8;
  border-left: 4px solid #ccc;
  border-radius: 10px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.summary-kpi strong { font-size: 24px; color: #18181b; }
.sk-label { font-size: 12px; color: #71717a; font-weight: 600; }
.kpi-running { border-left-color: #f59e0b; }
.kpi-settled { border-left-color: #16a34a; }
.kpi-voided { border-left-color: #ef4444; }
.kpi-total { border-left-color: #2563eb; }
.summary-quick {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.summary-link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: #f4f4f5;
  border: 1px solid #d4d4d8;
  border-radius: 999px;
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 600;
  color: #27272a;
  text-decoration: none;
}
.summary-link:hover { background: #e4e4e7; }
.summary-table th, .summary-table td { padding: 10px 12px; }

@media (max-width: 768px) {
  .summary-kpis { grid-template-columns: repeat(2, 1fr); }
}

.open-badge {
  font-size: 11px;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 999px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.badge-yellow { background: #fef9c3; color: #854d0e; }
.badge-blue { background: #dbeafe; color: #1e40af; }
.badge-green { background: #dcfce7; color: #166534; }
.badge-red { background: #fee2e2; color: #991b1b; }
.badge-gray { background: #f4f4f5; color: #52525b; }

.open-meta {
  margin: 0;
  font-size: 13px;
  color: #71717a;
}

.open-items {
  margin: 0;
  padding: 0 0 0 18px;
  font-size: 13px;
  color: #3f3f46;
}

.open-total {
  margin: 0;
  font-size: 13px;
  color: #52525b;
}

.pay-unpaid { color: #b91c1c; font-weight: 700; }
.pay-ok { color: #15803d; font-weight: 700; }

.open-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
}

.open-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: none;
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 13px;
  font-weight: 700;
  color: #fff;
  cursor: pointer;
}

.open-btn.warn { background: #d97706; }
.open-btn.info { background: #2563eb; }
.open-btn.ok { background: #16a34a; }
.open-btn.pay { background: #0f766e; }
.open-btn.room { background: #7c3aed; }
.open-btn.done { background: #3f3f46; }

/* ---- Responsive: phones / small tablets ---- */
@media (max-width: 768px) {
  .taker-page {
    padding: 8px 10px 20px;
    gap: 10px;
  }

  /* Tabs stack: department switch takes the full top row */
  .pos-tabs {
    flex-wrap: wrap;
  }

  .dept-toggle {
    order: -1;
    width: 100%;
    min-width: 0;
  }

  .pos-tab,
  .dept-toggle button {
    padding: 12px 8px;
    font-size: 14px;
  }

  .order-header {
    gap: 10px;
    padding: 10px 12px;
  }

  /* Header fields pair up two-per-row */
  .oh-field {
    flex: 1 1 calc(50% - 5px);
    min-width: calc(50% - 5px);
  }

  .covers-step button {
    width: 42px;
    padding: 12px 0;
  }

  /* Order-lines table scrolls sideways instead of squashing */
  .lines-wrap {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .lines-table {
    min-width: 480px;
  }

  .pager-row {
    flex-wrap: wrap;
    gap: 8px;
  }

  .pager-btn {
    padding: 10px 12px;
  }

  .send-btn {
    width: 100%;
    padding: 14px;
    font-size: 16px;
  }

  .cat-grid {
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 8px;
  }

  .cat-btn {
    padding: 16px 8px;
    font-size: 13px;
  }
}

@media (max-width: 420px) {
  .oh-field {
    flex-basis: 100%;
    min-width: 100%;
  }
}


/* ---- Receipt (proof of payment) ---- */
.receipt-panel {
  max-width: 340px;
  background: #fff;
  color: #27272a;
  border-radius: 12px;
  padding: 18px;
}

.receipt h3 {
  margin: 0 0 4px;
  text-align: center;
  font-size: 16px;
}

.receipt .rc-line {
  font-size: 12px;
  color: #52525b;
  margin: 2px 0;
}

.receipt .rc-total {
  text-align: center;
  font-size: 22px;
  font-weight: 800;
  margin: 8px 0;
}

.receipt .rc-thanks {
  text-align: center;
  font-size: 12px;
  color: #71717a;
  margin-top: 10px;
}

.receipt-actions {
  display: flex;
  gap: 8px;
  justify-content: center;
  margin-top: 14px;
}

@media print {
  body * {
    visibility: hidden !important;
  }

  #pos-receipt,
  #pos-receipt * {
    visibility: visible !important;
  }

  #pos-receipt {
    position: fixed;
    inset: 0;
    margin: auto;
    width: 280px;
  }

  .no-print {
    display: none !important;
  }
}
</style>
