<!--
  CashierLayout — dedicated point-of-sale panel for the cashier role.
  Dark sidebar with the POS sections (Ordering / Order Summary / Manager),
  top bar carrying the outlet selector and the profile menu at the far end.
  On first entry the outlet gate forces a choice
  between the property's outlets (e.g. "Brand Hotel" vs "BAR OUT").
-->

<template>
  <div class="pos-layout" :class="{ collapsed: sidebarCollapsed, 'mobile-open': mobileOpen }">
    <div v-if="mobileOpen" class="pos-backdrop" @click="mobileOpen = false"></div>
    <aside class="pos-sidebar">
      <router-link :to="{ name: 'cashier-dine-in' }" class="pos-brand">
        <img src="/MRK_logo_transparent.png" alt="MRK Hotels" class="pos-brand-logo" />
        <span class="pos-brand-text" v-show="!sidebarCollapsed"><strong>MRK</strong> {{ $t('cashier.panelTitle') }}</span>
      </router-link>

      <nav class="pos-nav">
        <button type="button" class="pos-nav-heading pos-group" :class="{ open: isOpen('ordering') }"
          @click="toggleGroup('ordering')" v-show="!sidebarCollapsed"
          :aria-expanded="isOpen('ordering')">
          {{ $t('cashier.nav.ordering') }}
          <i class="fas fa-chevron-down pos-chevron" aria-hidden="true"></i>
        </button>
        <div class="pos-group-items" :class="{ open: isOpen('ordering') }">
          <div class="pos-group-inner">
          <router-link v-for="item in orderingNav" :key="item.to" :to="item.to" class="pos-nav-link"
            :class="{ active: isActive(item.to) }" :title="$t(item.labelKey)" @click="mobileOpen = false">
            <i :class="item.icon" aria-hidden="true"></i>
            <span v-show="!sidebarCollapsed">{{ $t(item.labelKey) }}</span>
          </router-link>
          </div>
        </div>

        <router-link :to="{ name: 'cashier-requisitions' }" class="pos-nav-link"
          :class="{ active: isActive('/cashier/requisitions') }" @click="mobileOpen = false"
          :title="$t('cashier.nav.requisitions')">
          <i class="fas fa-file-signature" aria-hidden="true"></i>
          <span v-show="!sidebarCollapsed">{{ $t('cashier.nav.requisitions') }}</span>
        </router-link>

        <router-link :to="{ name: 'cashier-order-summary' }" class="pos-nav-link"
          :class="{ active: isActive('/cashier/order-summary') }" @click="mobileOpen = false"
          :title="$t('cashier.nav.orderSummary')">
          <i class="fas fa-list-ul" aria-hidden="true"></i>
          <span v-show="!sidebarCollapsed">{{ $t('cashier.nav.orderSummary') }}</span>
        </router-link>

        <button type="button" class="pos-nav-heading pos-group" :class="{ open: isOpen('reports') }"
          @click="toggleGroup('reports')" v-show="!sidebarCollapsed"
          :aria-expanded="isOpen('reports')">
          {{ $t('cashier.nav.reports') }}
          <i class="fas fa-chevron-down pos-chevron" aria-hidden="true"></i>
        </button>
        <div class="pos-group-items" :class="{ open: isOpen('reports') }">
          <div class="pos-group-inner">
          <router-link :to="{ name: 'cashier-reports' }" class="pos-nav-link"
            :class="{ active: isActive('/cashier/reports') }" @click="mobileOpen = false"
            :title="$t('cashier.nav.summaryReport')">
            <i class="fas fa-chart-simple" aria-hidden="true"></i>
            <span v-show="!sidebarCollapsed">{{ $t('cashier.nav.summaryReport') }}</span>
          </router-link>
          <router-link :to="{ name: 'cashier-pos-reports' }" class="pos-nav-link"
            :class="{ active: isActive('/cashier/pos-report-browser') }" @click="mobileOpen = false"
            :title="$t('cashier.nav.posReports')">
            <i class="fas fa-utensils" aria-hidden="true"></i>
            <span v-show="!sidebarCollapsed">{{ $t('cashier.nav.posReports') }}</span>
          </router-link>
          </div>
        </div>

        <button type="button" class="pos-nav-heading pos-group" :class="{ open: isOpen('manager') }"
          @click="toggleGroup('manager')" v-show="!sidebarCollapsed"
          :aria-expanded="isOpen('manager')">
          {{ $t('cashier.nav.managerGroup') }}
          <i class="fas fa-chevron-down pos-chevron" aria-hidden="true"></i>
        </button>
        <div class="pos-group-items" :class="{ open: isOpen('manager') }">
          <div class="pos-group-inner">
          <router-link :to="{ name: 'cashier-item-lookup' }" class="pos-nav-link"
            :class="{ active: isActive('/cashier/item-lookup') }" @click="mobileOpen = false">
            <i class="fas fa-book-open" aria-hidden="true"></i>
            <span v-show="!sidebarCollapsed">{{ $t('cashier.nav.itemLookup') }}</span>
          </router-link>
          <router-link :to="{ name: 'cashier-ingredients' }" class="pos-nav-link"
            :class="{ active: isActive('/cashier/ingredients') }" @click="mobileOpen = false">
            <i class="fas fa-flask" aria-hidden="true"></i>
            <span v-show="!sidebarCollapsed">{{ $t('cashier.nav.ingredients') }}</span>
          </router-link>
          <router-link :to="{ name: 'cashier-shift-manager' }" class="pos-nav-link"
            :class="{ active: isActive('/cashier/shift-manager') }" @click="mobileOpen = false">
            <i class="fas fa-cash-register" aria-hidden="true"></i>
            <span v-show="!sidebarCollapsed">{{ $t('cashier.nav.shiftManager') }}</span>
          </router-link>
          <router-link :to="{ name: 'cashier-day-close' }" class="pos-nav-link"
            :class="{ active: isActive('/cashier/day-close') }" @click="mobileOpen = false">
            <i class="fas fa-calendar-check" aria-hidden="true"></i>
            <span v-show="!sidebarCollapsed">{{ $t('cashier.nav.dayClose') }}</span>
          </router-link>
          <router-link :to="{ name: 'cashier-transaction-lock' }" class="pos-nav-link"
            :class="{ active: isActive('/cashier/transaction-lock') }" @click="mobileOpen = false">
            <i class="fas fa-lock" aria-hidden="true"></i>
            <span v-show="!sidebarCollapsed">{{ $t('cashier.nav.transactionLock') }}</span>
          </router-link>
          <router-link :to="{ name: 'cashier-account-lookup' }" class="pos-nav-link"
            :class="{ active: isActive('/cashier/account-lookup') }" @click="mobileOpen = false">
            <i class="fas fa-users" aria-hidden="true"></i>
            <span v-show="!sidebarCollapsed">{{ $t('cashier.nav.accountLookup') }}</span>
          </router-link>
          </div>
        </div>

        <button type="button" class="pos-nav-heading pos-group" :class="{ open: isOpen('inventory') }"
          @click="toggleGroup('inventory')" v-show="!sidebarCollapsed"
          :aria-expanded="isOpen('inventory')">
          {{ $t('cashier.nav.inventoryGroup') }}
          <i class="fas fa-chevron-down pos-chevron" aria-hidden="true"></i>
        </button>
        <div class="pos-group-items" :class="{ open: isOpen('inventory') }">
          <div class="pos-group-inner">
          <router-link :to="{ name: 'cashier-low-stock' }" class="pos-nav-link"
            :class="{ active: isActive('/cashier/inventory/low-stock') }" @click="mobileOpen = false">
            <i class="fas fa-triangle-exclamation" aria-hidden="true"></i>
            <span v-show="!sidebarCollapsed">{{ $t('cashier.nav.lowStock') }}</span>
          </router-link>
          <router-link :to="{ name: 'cashier-stock-transfers' }" class="pos-nav-link"
            :class="{ active: isActive('/cashier/inventory/transfers') }" @click="mobileOpen = false">
            <i class="fas fa-right-left" aria-hidden="true"></i>
            <span v-show="!sidebarCollapsed">{{ $t('cashier.nav.stockTransfers') }}</span>
          </router-link>
          <router-link :to="{ name: 'cashier-stock-counts' }" class="pos-nav-link"
            :class="{ active: isActive('/cashier/inventory/stock-counts') }" @click="mobileOpen = false">
            <i class="fas fa-clipboard-list" aria-hidden="true"></i>
            <span v-show="!sidebarCollapsed">{{ $t('cashier.nav.stockCounts') }}</span>
          </router-link>
          <router-link :to="{ name: 'cashier-stock-adjust' }" class="pos-nav-link"
            :class="{ active: isActive('/cashier/inventory/stock-adjust') }" @click="mobileOpen = false">
            <i class="fas fa-sliders" aria-hidden="true"></i>
            <span v-show="!sidebarCollapsed">{{ $t('cashier.nav.stockAdjust') }}</span>
          </router-link>
          </div>
        </div>

        <button type="button" class="pos-nav-heading pos-group" :class="{ open: isOpen('printer') }"
          @click="toggleGroup('printer')" v-show="!sidebarCollapsed"
          :aria-expanded="isOpen('printer')">
          {{ $t('cashier.nav.printerGroup') }}
          <i class="fas fa-chevron-down pos-chevron" aria-hidden="true"></i>
        </button>
        <div class="pos-group-items" :class="{ open: isOpen('printer') }">
          <div class="pos-group-inner">
          <router-link :to="{ name: 'cashier-printer' }" class="pos-nav-link"
            :class="{ active: isActive('/cashier/printer') }" @click="mobileOpen = false">
            <i class="fas fa-print" aria-hidden="true"></i>
            <span v-show="!sidebarCollapsed">{{ $t('cashier.nav.printer') }}</span>
          </router-link>
          <router-link :to="{ name: 'cashier-print-settings' }" class="pos-nav-link"
            :class="{ active: isActive('/cashier/print-settings') }" @click="mobileOpen = false">
            <i class="fas fa-cloud-arrow-up" aria-hidden="true"></i>
            <span v-show="!sidebarCollapsed">{{ $t('cashier.nav.printSettings') }}</span>
          </router-link>
          </div>
        </div>

        <button type="button" class="pos-nav-heading pos-group" :class="{ open: isOpen('comm') }"
          @click="toggleGroup('comm')" v-show="!sidebarCollapsed"
          :aria-expanded="isOpen('comm')">
          {{ $t('cashier.nav.communication') }}
          <i class="fas fa-chevron-down pos-chevron" aria-hidden="true"></i>
        </button>
        <div class="pos-group-items" :class="{ open: isOpen('comm') }">
          <div class="pos-group-inner">
          <router-link :to="{ name: 'hotel-messages' }" class="pos-nav-link"
            :class="{ active: isActive('/app/messages') }" @click="mobileOpen = false"
            :title="$t('cashier.nav.messages')">
            <i class="fas fa-comments" aria-hidden="true"></i>
            <span v-show="!sidebarCollapsed">{{ $t('cashier.nav.messages') }}</span>
          </router-link>
          <router-link :to="{ name: 'hotel-statuses' }" class="pos-nav-link"
            :class="{ active: isActive('/app/statuses') }" @click="mobileOpen = false"
            :title="$t('cashier.nav.statuses')">
            <i class="fas fa-circle-dot" aria-hidden="true"></i>
            <span v-show="!sidebarCollapsed">{{ $t('cashier.nav.statuses') }}</span>
          </router-link>
          </div>
        </div>
      </nav>

      <div class="pos-sidebar-footer">
        <button @click="switchOutlet" class="pos-nav-link">
          <i class="fas fa-right-left" aria-hidden="true"></i>
          <span v-show="!sidebarCollapsed">{{ $t('cashier.topbar.switchOutlet') }}</span>
        </button>
        <button @click="handleLogout" class="pos-nav-link pos-logout">
          <i class="fas fa-right-from-bracket" aria-hidden="true"></i>
          <span v-show="!sidebarCollapsed">{{ $t('common.logout') }}</span>
        </button>
      </div>
    </aside>

    <div class="pos-main">
      <header class="pos-topbar">
        <div class="pos-topbar-main">
          <button class="pos-collapse" @click="toggleSidebar" :aria-label="$t('nav.menuToggle')">
            <i class="fas fa-bars" aria-hidden="true"></i>
          </button>
          <h1 class="pos-page-title">{{ pageTitle }}</h1>
        </div>
        <div class="pos-topbar-sub">
          <button v-if="selectedOutlet" class="pos-outlet-select" @click="switchOutlet"
            :title="$t('cashier.topbar.switchOutlet')">
            <i class="fas fa-store" aria-hidden="true"></i> {{ selectedOutlet.name }}
            <i class="fas fa-chevron-down" aria-hidden="true"></i>
          </button>
          <div class="sm-user" style="position: relative;">
            <button type="button" class="sm-user-trigger" @click="toggleProfile" aria-haspopup="true" :aria-expanded="profileOpen">
              <span class="sm-user-avatar" aria-hidden="true">{{ userInitials }}</span>
            </button>
            <div v-if="profileOpen" class="sm-profile-backdrop" @click="closeProfile"></div>
            <div v-if="profileOpen" class="sm-profile-panel">
              <div class="sm-profile-head">
                <span class="sm-user-avatar" aria-hidden="true">{{ userInitials }}</span>
                <div>
                  <strong>{{ authStore.user?.name }}</strong>
                  <small>{{ authStore.user?.email }}</small>
                </div>
              </div>
              <button type="button" class="sm-profile-link" @click="goToUserManual">
                <i class="fas fa-book" aria-hidden="true"></i>
                {{ $t('cashier.profile.userManual') || 'User Manual' }}
              </button>
              <button type="button" class="sm-profile-link" @click="goToProfile">
                <i class="fas fa-user" aria-hidden="true"></i>
                {{ $t('cashier.profile.myProfile') || 'My Profile' }}
              </button>
              <button type="button" class="sm-profile-link" @click="toggleDarkMode">
                <i class="fas fa-moon" aria-hidden="true"></i>
                {{ $t('cashier.profile.darkMode') || 'Dark Mode' }}
              </button>
              <div class="sm-profile-lang">
                <button type="button" class="sm-lang-btn" :class="{ active: locale === 'en' }" @click="switchLanguage('en')">EN</button>
                <button type="button" class="sm-lang-btn" :class="{ active: locale === 'sw' }" @click="switchLanguage('sw')">SW</button>
              </div>
              <button type="button" class="sm-profile-link sm-profile-logout" @click="handleLogout">
                <i class="fas fa-right-from-bracket" aria-hidden="true"></i>
                {{ $t('cashier.profile.logout') || $t('common.logout') }}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main class="pos-content" id="main-content">
        <router-view />
      </main>
    </div>

    <!-- Outlet gate: pick the selling-point type first, then the exact counter
         when a property runs more than one bar or restaurant. Each counter owns
         its own stock shelf, so the second step is what scopes the whole panel.
         The gate always opens after login, even for a single outlet, and asks
         for that counter's access code before the cashier can start working. -->
    <div v-if="gateOpen" class="sm-modal-backdrop">
      <div class="sm-modal" role="dialog" aria-modal="true">
        <div class="sm-modal-head">
          <button v-if="canGoBack" type="button" class="gate-back" @click="goBack">
            <i class="fas fa-arrow-left" aria-hidden="true"></i>
            <span>{{ $t('cashier.outletGate.back') }}</span>
          </button>
          <h3>
            <i :class="gateTitleIcon" aria-hidden="true"></i>
            {{ gateTitle }}
          </h3>
        </div>

        <p v-if="gateStep === 'type' || gateStep === 'point'" class="gate-hint">
          {{ $t('cashier.outletGate.hint', { hotel: hotelName }) }}
        </p>

        <div v-if="gateStep === 'type'" class="outlet-gate-list">
          <button v-for="group in outletTypeGroups" :key="group.type" class="outlet-option"
            @click="chooseType(group)">
            <span class="ico"><i :class="group.icon" aria-hidden="true"></i></span>
            <span class="gate-option-copy">
              <strong>{{ group.label }}</strong>
              <small>{{ $t('cashier.outletGate.pointCount', { count: group.outlets.length }) }}</small>
            </span>
            <i class="fas fa-chevron-right gate-option-arrow" aria-hidden="true"></i>
          </button>

          <div v-if="outletTypeGroups.length === 0" class="gate-empty">
            <i class="fas fa-store-slash" aria-hidden="true"></i>
            <p>{{ $t('cashier.outletGate.noCounters') }}</p>
          </div>

          <button type="button" class="gate-create-link" @click="startCreate">
            <i class="fas fa-plus" aria-hidden="true"></i>
            {{ $t('cashier.outletGate.createSellingPoint') }}
          </button>
        </div>

        <div v-else-if="gateStep === 'point'" class="outlet-gate-list">
          <button v-for="outlet in gateOutlets" :key="outlet.outlet_id" class="outlet-option"
            @click="beginUnlock(outlet)">
            <span class="ico"><i :class="gateTypeIcon" aria-hidden="true"></i></span>
            <span class="gate-option-copy">
              <strong>{{ outlet.name }}</strong>
              <small>
                {{ outlet.stock_department?.name || $t('cashier.outletGate.noShelf') }}
              </small>
              <small v-if="outlet.created_by_name" class="gate-meta">
                {{ $t('cashier.outletGate.createdByOn', {
                  name: outlet.created_by_name,
                  when: formatStamp(outlet.created_at),
                }) }}
              </small>
            </span>
            <i class="fas fa-chevron-right gate-option-arrow" aria-hidden="true"></i>
          </button>
        </div>

        <div v-else-if="gateStep === 'create'" class="gate-form">
          <p class="gate-hint">{{ $t('cashier.outletGate.createHint') }}</p>
          <label for="gate-counter-name">{{ $t('cashier.outletGate.nameLabel') }}</label>
          <input id="gate-counter-name" v-model="createForm.name" type="text" maxlength="100"
            :placeholder="$t('cashier.outletGate.namePlaceholder')" @keyup.enter="createSellingPoint" />
          <label for="gate-counter-type">{{ $t('cashier.outletGate.typeLabel') }}</label>
          <select id="gate-counter-type" v-model="createForm.type">
            <option value="bar">{{ $t('cashier.outletGate.barType') }}</option>
            <option value="restaurant">{{ $t('cashier.outletGate.restaurantType') }}</option>
          </select>
          <p v-if="gateError" class="gate-error">{{ gateError }}</p>
          <button type="button" class="sm-btn" :disabled="gateBusy || !createForm.name.trim()"
            @click="createSellingPoint">
            <i class="fas fa-plus" aria-hidden="true"></i>
            {{ gateBusy ? $t('cashier.outletGate.creating') : $t('cashier.outletGate.createButton') }}
          </button>
        </div>

        <div v-else-if="gateStep === 'unlock'" class="gate-form">
          <div class="gate-counter">
            <strong><i :class="gateTypeIcon" aria-hidden="true"></i> {{ pendingOutlet?.name }}</strong>
            <small v-if="pendingOutlet?.created_by_name">
              {{ $t('cashier.outletGate.createdByOn', {
                name: pendingOutlet.created_by_name,
                when: formatStamp(pendingOutlet.created_at),
              }) }}
            </small>
          </div>

          <template v-if="pendingOutlet?.has_access_code">
            <p class="gate-hint">{{ $t('cashier.outletGate.accessHint') }}</p>
            <label for="gate-access-code">{{ $t('cashier.outletGate.accessLabel') }}</label>
            <div class="gate-code-field">
              <input id="gate-access-code" v-model="accessCodeInput" :type="showAccessCode ? 'text' : 'password'"
                maxlength="100" autocomplete="off"
                :placeholder="$t('cashier.outletGate.accessPlaceholder')"
                @keyup.enter="unlockCounter" />
              <button type="button" class="gate-code-toggle"
                :aria-label="$t(showAccessCode ? 'cashier.outletGate.hideCode' : 'cashier.outletGate.showCode')"
                :title="$t(showAccessCode ? 'cashier.outletGate.hideCode' : 'cashier.outletGate.showCode')"
                @click="showAccessCode = !showAccessCode">
                <i :class="showAccessCode ? 'fas fa-eye-slash' : 'fas fa-eye'" aria-hidden="true"></i>
              </button>
            </div>
            <p v-if="gateError" class="gate-error">{{ gateError }}</p>
            <button type="button" class="sm-btn" :disabled="gateBusy || !accessCodeInput.trim()"
              @click="unlockCounter">
              <i class="fas fa-lock-open" aria-hidden="true"></i>
              {{ gateBusy ? $t('cashier.outletGate.unlocking') : $t('cashier.outletGate.unlockButton') }}
            </button>
          </template>

          <template v-else>
            <p class="gate-hint">{{ $t('cashier.outletGate.noCodeHint') }}</p>
            <p v-if="gateError" class="gate-error">{{ gateError }}</p>
            <button type="button" class="sm-btn" :disabled="gateBusy" @click="claimCounter">
              <i class="fas fa-key" aria-hidden="true"></i>
              {{ gateBusy ? $t('cashier.outletGate.creatingCode') : $t('cashier.outletGate.createDefaultCode') }}
            </button>
          </template>
        </div>

        <div v-else-if="gateStep === 'code'" class="gate-form">
          <p class="gate-hint">{{ $t('cashier.outletGate.codeOnceHint') }}</p>
          <div class="gate-code-wrap">
            <div class="gate-code" role="status">{{ createdCode }}</div>
            <button type="button" class="gate-code-copy"
              :aria-label="$t('cashier.outletGate.copyCode')"
              :title="$t('cashier.outletGate.copyCode')"
              @click="copyCreatedCode">
              <i :class="codeCopied ? 'fas fa-check' : 'fas fa-copy'" aria-hidden="true"></i>
            </button>
          </div>
          <p v-if="codeCopied" class="gate-copied">{{ $t('cashier.outletGate.codeCopied') }}</p>
          <p class="gate-hint">{{ $t('cashier.outletGate.codeSaveHint') }}</p>
          <button type="button" class="sm-btn" @click="continueAfterCode">
            <i class="fas fa-check" aria-hidden="true"></i>
            {{ $t('cashier.outletGate.codeContinue') }}
          </button>
        </div>

        <div v-else-if="gateStep === 'duplicate'" class="gate-form">
          <p class="gate-hint">
            {{ $t('cashier.outletGate.duplicateHint', {
              name: duplicateOutlet?.created_by_name || '—',
              when: formatStamp(duplicateOutlet?.created_at),
            }) }}
          </p>
          <div class="gate-counter">
            <strong><i class="fas fa-store" aria-hidden="true"></i> {{ duplicateOutlet?.name }}</strong>
            <small v-if="duplicateOutlet?.stock_department?.name">
              {{ duplicateOutlet.stock_department.name }}
            </small>
          </div>
          <p v-if="gateError" class="gate-error">{{ gateError }}</p>
          <button type="button" class="sm-btn" @click="beginUnlock(duplicateOutlet)">
            <i class="fas fa-lock-open" aria-hidden="true"></i>
            {{ $t('cashier.outletGate.openExisting') }}
          </button>
          <button type="button" class="sm-btn ghost" @click="startCreate">
            <i class="fas fa-pen" aria-hidden="true"></i>
            {{ $t('cashier.outletGate.tryAnotherName') }}
          </button>
        </div>
        <div class="gate-foot">
          <button type="button" class="gate-logout" :disabled="gateBusy" @click="handleLogout">
            <i class="fas fa-right-from-bracket" aria-hidden="true"></i>
            {{ $t('common.logout') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Day Close reminder (review item 18): a new calendar day started but
         the open business day has not been closed, so every order taken now
         still joins the running orders of the open day. The modal is shared
         with the other panels so it can never appear twice at once. -->
    <DayCloseReminderModal
      proceed-route="cashier-day-close"
      :can-proceed-roles="DAY_CLOSE_ROLES"
      :role="authStore.user?.user_role"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { outletApi } from '@/api'
import { useAuthStore } from '@/stores/auth'
import { useWorkingDateStore } from '@/stores/workingDate'
import { selectedOutlet } from '@/pages/cashier/outlet-context'
import { useOutletContext } from '@/composables/useOutletContext'
import { restorePrinter } from '@/utils/printer'
import { useThemeStore } from '@/stores/theme'
import DayCloseReminderModal from '@/components/cashier/DayCloseReminderModal.vue'

const route = useRoute()
const router = useRouter()
const { t, locale } = useI18n()
const authStore = useAuthStore()

const workingDateStore = useWorkingDateStore()
const themeStore = useThemeStore()

// The panel and the POS now share one outlet selection, so this layout reads
// the same list rather than keeping a private copy that could disagree with it.
const { outlets, loadOutlets: loadOutletList, selectOutlet } = useOutletContext()
const gateOpen = ref(false)
const gateStep = ref('type')
const gateType = ref('')
const pendingOutlet = ref(null)
const duplicateOutlet = ref(null)
const accessCodeInput = ref('')
const showAccessCode = ref(false)
const createdCode = ref('')
const codeCopied = ref(false)
const gateError = ref('')
const gateBusy = ref(false)
const createForm = reactive({ name: '', type: 'bar' })
const UNLOCKED_OUTLETS_KEY = 'cashier_unlocked_outlets'
const unlockedOutletIds = ref(new Set(readUnlockedOutlets()))
const sidebarCollapsed = ref(true)
const mobileOpen = ref(false)
// Accordion groups in the sidebar are exclusive: opening one smoothly closes
// the others, so only the targeted group ever stays expanded. An empty string
// means every group is closed. Ordering starts expanded as the home section.
const openGroup = ref('ordering')
const profileOpen = ref(false)

function toggleProfile() {
  profileOpen.value = !profileOpen.value
}

function closeProfile() {
  profileOpen.value = false
}

function goToUserManual() {
  closeProfile()
  router.push({ name: 'user-manual' })
}

function goToProfile() {
  closeProfile()
  router.push({ name: 'hotel-profile' })
}

function toggleDarkMode() {
  closeProfile()
  themeStore.toggleTheme()
}

function switchLanguage(lang) {
  closeProfile()
  locale.value = lang
  localStorage.setItem('locale', lang)
}

/** Whether the given accordion group is currently expanded. */
function isOpen(key) {
  return openGroup.value === key
}

/** Opens the targeted accordion group and closes every other one. */
function toggleGroup(key) {
  openGroup.value = openGroup.value === key ? '' : key
}

function toggleSidebar() {
  if (window.matchMedia('(max-width: 900px)').matches) mobileOpen.value = !mobileOpen.value
  else sidebarCollapsed.value = !sidebarCollapsed.value
}

watch(() => route.path, () => {
  mobileOpen.value = false
  // Keep the parent group open so the active item stays visible (exclusive:
  // navigating to another group's page expands that group instead).
  if (route.path.startsWith('/cashier/item-lookup') || route.path.startsWith('/cashier/ingredients')
    || route.path.startsWith('/cashier/shift-manager') || route.path.startsWith('/cashier/blocked-devices')
    || route.path.startsWith('/cashier/transaction-lock') || route.path.startsWith('/cashier/account-lookup')
    || route.path.startsWith('/cashier/day-close')) {
    openGroup.value = 'manager'
  } else if (route.path.startsWith('/cashier/inventory')) {
    openGroup.value = 'inventory'
  } else if (route.path.startsWith('/cashier/printer') || route.path.startsWith('/cashier/print-settings')) {
    openGroup.value = 'printer'
  } else if (route.path.startsWith('/cashier/reports') || route.path.startsWith('/cashier/report-browser')) {
    openGroup.value = 'reports'
  } else if (route.path.startsWith('/cashier/dine-in') || route.path.startsWith('/cashier/take-away') || route.path.startsWith('/cashier/room-service') || route.path.startsWith('/cashier/delivery') || route.path.startsWith('/cashier/no-charge')) {
    openGroup.value = 'ordering'
  }
})

const orderingNav = [
  { to: '/cashier/dine-in', icon: 'fas fa-chair', labelKey: 'cashier.nav.dineIn' },
  { to: '/cashier/take-away', icon: 'fas fa-bag-shopping', labelKey: 'cashier.nav.takeAway' },
  { to: '/cashier/room-service', icon: 'fas fa-bed', labelKey: 'cashier.nav.roomService' },
  { to: '/cashier/delivery', icon: 'fas fa-motorcycle', labelKey: 'cashier.nav.delivery' },
  { to: '/cashier/no-charge', icon: 'fas fa-gift', labelKey: 'cashier.nav.noCharge' },
]

const pageTitle = computed(() => (route.meta.titleKey ? t(route.meta.titleKey) : t('cashier.panelTitle')))
const userInitials = computed(() => {
  const full =
    authStore.user?.name ||
    authStore.user?.full_name ||
    [authStore.user?.first_name, authStore.user?.last_name].filter(Boolean).join(' ') ||
    (authStore.user?.email || '').split('@')[0] ||
    ''
  const parts = full.split(' ').filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (authStore.user?.user_role || 'CS').slice(0, 2).toUpperCase()
})
const hotelName = computed(() => authStore.tenant?.hotel_name || '')

const OUTLET_TYPE_META = {
  bar: { icon: 'fas fa-martini-glass-citrus', labelKey: 'cashier.outletGate.barType' },
  restaurant: { icon: 'fas fa-utensils', labelKey: 'cashier.outletGate.restaurantType' },
  laundry: { icon: 'fas fa-shirt', labelKey: 'outlets.typeLaundry' },
  swimming: { icon: 'fas fa-person-swimming', labelKey: 'outlets.typeSwimming' },
  spa: { icon: 'fas fa-spa', labelKey: 'outlets.typeSpa' },
  kitchen: { icon: 'fas fa-kitchen-set', labelKey: 'outlets.typeKitchen' },
  store: { icon: 'fas fa-warehouse', labelKey: 'outlets.typeStore' },
  other: { icon: 'fas fa-store', labelKey: 'outlets.typeOther' },
}

function outletTypeMeta(type) {
  return OUTLET_TYPE_META[String(type || 'other').toLowerCase()] || OUTLET_TYPE_META.other
}

const outletTypeGroups = computed(() => {
  const groups = new Map()
  for (const outlet of outlets.value) {
    const type = String(outlet.type || 'other').toLowerCase()
    if (!groups.has(type)) groups.set(type, [])
    groups.get(type).push(outlet)
  }
  return [...groups.entries()]
    .map(([type, list]) => ({
      type,
      outlets: list,
      icon: outletTypeMeta(type).icon,
      label: t(outletTypeMeta(type).labelKey),
    }))
    .sort((a, b) => a.label.localeCompare(b.label))
})

const gateOutlets = computed(
  () => outletTypeGroups.value.find((group) => group.type === gateType.value)?.outlets || [],
)
const gateTypeLabel = computed(
  () => outletTypeGroups.value.find((group) => group.type === gateType.value)?.label || '',
)
const gateTypeIcon = computed(() => outletTypeMeta(gateType.value).icon)
const gateTitle = computed(() => {
  if (gateStep.value === 'type') return t('cashier.outletGate.chooseType')
  if (gateStep.value === 'point') return t('cashier.outletGate.choosePoint', { type: gateTypeLabel.value })
  if (gateStep.value === 'create') return t('cashier.outletGate.createTitle')
  if (gateStep.value === 'unlock') return t('cashier.outletGate.accessTitle')
  if (gateStep.value === 'code') return t('cashier.outletGate.codeOnceTitle')
  return t('cashier.outletGate.duplicateTitle')
})
const gateTitleIcon = computed(() => {
  if (gateStep.value === 'type') return 'fas fa-store'
  if (gateStep.value === 'create') return 'fas fa-plus'
  if (gateStep.value === 'unlock') return 'fas fa-lock'
  if (gateStep.value === 'code') return 'fas fa-key'
  if (gateStep.value === 'duplicate') return 'fas fa-triangle-exclamation'
  return gateTypeIcon.value
})
const canGoBack = computed(
  () => gateStep.value !== 'type' && gateStep.value !== 'code',
)

/** Formats the creator timestamp the same way in the gate and duplicate view. */
function formatStamp(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(locale.value, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function isActive(to) {
  return route.path.startsWith(to)
}

/** Reads the counters already unlocked in this browser tab. */
function readUnlockedOutlets() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(UNLOCKED_OUTLETS_KEY) || '[]')
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string' && id) : []
  } catch {
    return []
  }
}

/** True when this tab has already passed this counter's access gate. */
function isOutletUnlocked(outlet) {
  return Boolean(outlet?.outlet_id) && unlockedOutletIds.value.has(outlet.outlet_id)
}

/** Remembers a counter as unlocked until the user signs out or closes the tab. */
function markOutletUnlocked(outlet) {
  if (!outlet?.outlet_id) return
  const next = new Set(unlockedOutletIds.value)
  next.add(outlet.outlet_id)
  unlockedOutletIds.value = next
  sessionStorage.setItem(UNLOCKED_OUTLETS_KEY, JSON.stringify([...next]))
}

/** Drops every remembered unlock, so the next sign-in asks for the code again. */
function clearUnlockedOutlets() {
  unlockedOutletIds.value = new Set()
  sessionStorage.removeItem(UNLOCKED_OUTLETS_KEY)
}

/** Loads outlets and opens the gate only when the restored counter is still locked. */
async function loadOutlets() {
  await loadOutletList({ sellingOnly: true })
  resetGate()
  if (selectedOutlet.value && isOutletUnlocked(selectedOutlet.value)) {
    gateOpen.value = false
    return
  }
  gateOpen.value = true
}

function resetGate() {
  gateStep.value = 'type'
  gateType.value = ''
  pendingOutlet.value = null
  duplicateOutlet.value = null
  accessCodeInput.value = ''
  showAccessCode.value = false
  createdCode.value = ''
  codeCopied.value = false
  gateError.value = ''
  createForm.name = ''
  createForm.type = 'bar'
}

function rememberOutlet(outlet) {
  if (!outlet?.outlet_id) return
  const exists = outlets.value.some((row) => row.outlet_id === outlet.outlet_id)
  const next = exists
    ? outlets.value.map((row) => (row.outlet_id === outlet.outlet_id ? { ...row, ...outlet } : row))
    : [...outlets.value, outlet]
  outlets.value = next.sort((a, b) => a.name.localeCompare(b.name))
}

function applyOutlet(outlet) {
  rememberOutlet(outlet)
  selectOutlet(outlet)
  markOutletUnlocked(outlet)
  gateOpen.value = false
  resetGate()
}

function chooseType(group) {
  gateType.value = group.type
  // Always show the exact counter, even when the type currently has one, so
  // the cashier sees which bar/restaurant they are unlocking.
  gateStep.value = 'point'
}

function beginUnlock(outlet) {
  if (!outlet) return
  if (isOutletUnlocked(outlet)) {
    applyOutlet(outlet)
    return
  }
  pendingOutlet.value = outlet
  duplicateOutlet.value = null
  accessCodeInput.value = ''
  showAccessCode.value = false
  gateError.value = ''
  gateStep.value = 'unlock'
}

async function unlockCounter() {
  if (!pendingOutlet.value || !accessCodeInput.value.trim()) return
  gateBusy.value = true
  gateError.value = ''
  try {
    const { data } = await outletApi.verifyAccess(pendingOutlet.value.outlet_id, {
      access_code: accessCodeInput.value.trim(),
    })
    applyOutlet(data.outlet || pendingOutlet.value)
  } catch (error) {
    gateError.value = error.response?.data?.message || t('cashier.outletGate.invalidCode')
  } finally {
    gateBusy.value = false
  }
}

async function claimCounter() {
  if (!pendingOutlet.value) return
  gateBusy.value = true
  gateError.value = ''
  try {
    const { data } = await outletApi.claimAccess(pendingOutlet.value.outlet_id)
    pendingOutlet.value = data.outlet || pendingOutlet.value
    createdCode.value = data.access_code
    codeCopied.value = false
    gateStep.value = 'code'
  } catch (error) {
    gateError.value = error.response?.data?.message || t('cashier.outletGate.claimFailed')
  } finally {
    gateBusy.value = false
  }
}

function startCreate() {
  duplicateOutlet.value = null
  gateError.value = ''
  createForm.name = ''
  createForm.type = gateType.value === 'restaurant' ? 'restaurant' : 'bar'
  gateStep.value = 'create'
}

async function createSellingPoint() {
  const name = createForm.name.trim()
  if (!name) return
  gateBusy.value = true
  gateError.value = ''
  try {
    const { data } = await outletApi.storeSellingPoint({ name, type: createForm.type })
    pendingOutlet.value = data.outlet
    createdCode.value = data.access_code
    codeCopied.value = false
    gateStep.value = 'code'
  } catch (error) {
    const existing = error.response?.data?.existing
    if (existing) {
      duplicateOutlet.value = existing
      gateError.value = ''
      gateStep.value = 'duplicate'
    } else {
      gateError.value = error.response?.data?.message || t('cashier.outletGate.createFailed')
    }
  } finally {
    gateBusy.value = false
  }
}

async function copyCreatedCode() {
  if (!createdCode.value) return
  try {
    await navigator.clipboard.writeText(createdCode.value)
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = createdCode.value
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    try {
      document.execCommand('copy')
    } finally {
      document.body.removeChild(textarea)
    }
  }
  codeCopied.value = true
  setTimeout(() => {
    codeCopied.value = false
  }, 1500)
}

function continueAfterCode() {
  if (pendingOutlet.value) applyOutlet(pendingOutlet.value)
}

function goBack() {
  if (gateStep.value === 'point' || gateStep.value === 'create') {
    gateStep.value = 'type'
    gateType.value = ''
    gateError.value = ''
    return
  }
  if (gateStep.value === 'unlock') {
    gateStep.value = gateType.value ? 'point' : 'type'
    gateError.value = ''
    return
  }
  if (gateStep.value === 'duplicate') {
    startCreate()
  }
}

function switchOutlet() {
  resetGate()
  gateOpen.value = true
}

async function handleLogout() {
  gateOpen.value = false
  clearUnlockedOutlets()
  await authStore.logout()
  router.push({ name: 'login' })
}

// Roles the review lets walk from the reminder into Day Close: the cashier,
// the bar tender and the panels above them. A waiter may only CONFIRM.
const DAY_CLOSE_ROLES = ['cashier', 'bartender', 'waiter', 'store_manager', 'hotel_admin', 'manager']

onMounted(() => {
  loadOutlets()
  restorePrinter()
  workingDateStore.initDayCloseReminder()
})
</script>

<style>
@import '@/pages/cashier/cashier-shared.css';
</style>

<style scoped>
.pos-layout {
  --mrk-blue: #005eb8;
  --mrk-blue-bright: #1269bd;
  --mrk-blue-deep: #00468c;
  --mrk-blue-tint: #b0cde9;
  --mrk-blue-pale: #e8f1fa;
  --mrk-charcoal: #333333;
  display: flex;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  background: #f3f6fa;
  font-family: 'Inter', sans-serif;
  color: #1f2937;
}
.pos-sidebar {
  width: 230px;
  flex-shrink: 0;
  background: linear-gradient(180deg, var(--mrk-blue) 0%, var(--mrk-blue-deep) 100%);
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  overflow-y: auto;
  transition: width 0.2s ease;
}
.collapsed .pos-sidebar { width: 72px; }
.collapsed .pos-brand { justify-content: center; padding-inline: 8px; }
.pos-collapse {
  border: 1px solid #e2e8f0;
  background: #fff;
  border-radius: 8px;
  width: 36px;
  height: 36px;
  cursor: pointer;
  color: var(--mrk-blue);
  font-size: 15px;
  flex-shrink: 0;
}
.pos-collapse:hover { background: var(--mrk-blue-pale); }
.pos-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px 16px;
  text-decoration: none;
  color: #fff;
  background: var(--mrk-blue-dark);
  border-bottom: 3px solid var(--mrk-blue-tint);
}
.pos-brand-logo {
  width: 40px;
  height: 40px;
  object-fit: contain;
  background: #fff;
  border-radius: 10px;
  padding: 4px;
  flex-shrink: 0;
}
.pos-brand-text { font-size: 15px; white-space: nowrap; color: #d7e6f9; }
.pos-brand-text strong { color: #fff; }
.pos-nav { flex: 1; padding: 12px 10px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; }
.pos-nav-heading {
  margin: 10px 8px 2px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #b0cde9;
}
.pos-group {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  border: none;
  background: none;
  width: calc(100% - 16px);
  cursor: pointer;
  font-family: inherit;
  padding-inline: 8px;
  text-align: left;
}
.pos-group:hover { color: #fff; }
.pos-group .pos-chevron { transition: transform 0.2s ease; font-size: 12px; }
.pos-group.open .pos-chevron { transform: rotate(180deg); }
/* Smooth exclusive accordion: the group collapses to a 0-high row and grows
   open with a height animation instead of popping in/out. */
.pos-group-items {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.3s ease;
}
.pos-group-items.open { grid-template-rows: 1fr; }
.pos-group-inner { overflow: hidden; min-height: 0; display: flex; flex-direction: column; gap: 4px; padding-block: 4px; }
.pos-nav-link {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 14px;
  border-radius: 10px;
  color: #dbeafe;
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  border: none;
  background: none;
  width: 100%;
  text-align: left;
  cursor: pointer;
  font-family: inherit;
  border-left: 3px solid transparent;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.pos-nav-link i { width: 20px; text-align: center; font-size: 16px; flex-shrink: 0; }
.pos-nav-link:hover { background: rgba(255, 255, 255, 0.08); color: #fff; }
.pos-nav-link.router-link-active {
  background: #fff;
  border-left-color: var(--mrk-blue-bright);
  color: var(--mrk-blue-deep);
  font-weight: 700;
  box-shadow: 0 4px 14px rgba(6, 42, 82, 0.45);
}
.pos-sidebar-footer { flex-shrink: 0; padding: 10px; padding-bottom: calc(10px + env(safe-area-inset-bottom, 0px)); border-top: 1px solid rgba(255, 255, 255, 0.2); display: flex; flex-direction: column; gap: 4px; }
.pos-logout:hover { background: rgba(220, 38, 38, 0.25); color: #fca5a5; }
.pos-main { flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; }
.pos-topbar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 13px 24px;
  background: #fff;
  border-bottom: 1px solid #e2e8f0;
  box-shadow: inset 0 -3px 0 var(--mrk-blue);
  z-index: 20;
}
.pos-topbar-main {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}
.pos-topbar-sub {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  flex-wrap: wrap;
  flex-shrink: 0;
}
.pos-page-title { font-size: 18px; font-weight: 700; margin: 0; flex: 1; color: var(--mrk-charcoal); }
.pos-outlet-select {
  display: inline-flex; align-items: center; gap: 9px;
  background: var(--mrk-blue-pale); color: var(--mrk-blue-deep);
  border: 1px solid var(--mrk-blue); border-radius: 999px;
  padding: 8px 14px; font-size: 13px; font-weight: 700;
  cursor: pointer; font-family: inherit;
}
.pos-outlet-select:hover { background: var(--mrk-blue-tint); }
.pos-waiter-btn {
  display: inline-flex; align-items: center; gap: 8px;
  background: var(--mrk-charcoal); color: #fff;
  border-radius: 999px; padding: 8px 14px;
  font-size: 13px; font-weight: 700; text-decoration: none;
}
.pos-waiter-btn:hover { background: #444444; }
.sm-user { display: flex; align-items: center; gap: 10px; }
.sm-user-avatar {
  width: 38px; height: 38px; border-radius: 50%;
  background: var(--mrk-blue); color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 14px;
}
.sm-user-trigger {
  display: flex;
  align-items: center;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  font-family: inherit;
}
.sm-profile-backdrop {
  position: fixed;
  inset: 0;
  z-index: 95;
  background: transparent;
}
.sm-profile-panel {
  position: absolute;
  right: 0;
  top: calc(100% + 8px);
  width: 260px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  box-shadow: 0 20px 40px rgba(15, 23, 42, 0.12);
  z-index: 96;
  overflow: hidden;
}
.sm-profile-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-bottom: 1px solid #f1f5f9;
}
.sm-profile-head strong {
  display: block;
  font-size: 14px;
  color: var(--mrk-charcoal);
}
.sm-profile-head small {
  display: block;
  font-size: 12px;
  color: #64748b;
}
.sm-profile-link {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 14px;
  background: none;
  border: none;
  text-align: left;
  font-size: 13px;
  color: #334155;
  cursor: pointer;
  font-family: inherit;
}
.sm-profile-link i {
  width: 18px;
  text-align: center;
  color: #64748b;
}
.sm-profile-link:hover {
  background: #f8fafc;
}
.sm-profile-lang {
  display: flex;
  gap: 8px;
  padding: 10px 14px;
  border-top: 1px solid #f1f5f9;
  border-bottom: 1px solid #f1f5f9;
}
.sm-lang-btn {
  flex: 1;
  padding: 6px 0;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fff;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.sm-lang-btn.active {
  background: var(--mrk-blue-pale);
  border-color: var(--mrk-blue);
  color: var(--mrk-blue-deep);
}
.sm-profile-logout {
  color: #dc2626;
}
.sm-profile-logout i {
  color: #dc2626;
}
html[data-theme='dark'] .sm-profile-panel {
  background: #1e293b;
  border-color: #334155;
}
html[data-theme='dark'] .sm-profile-head {
  border-bottom-color: #334155;
}
html[data-theme='dark'] .sm-profile-head strong {
  color: #e2e8f0;
}
html[data-theme='dark'] .sm-profile-link {
  color: #cbd5e1;
}
html[data-theme='dark'] .sm-profile-link:hover {
  background: #334155;
}
html[data-theme='dark'] .sm-profile-lang {
  border-color: #334155;
}
html[data-theme='dark'] .sm-lang-btn {
  background: #1e293b;
  border-color: #475569;
  color: #cbd5e1;
}
html[data-theme='dark'] .sm-lang-btn.active {
  background: rgba(18, 105, 189, 0.3);
  border-color: #60a5fa;
  color: #bfdbfe;
}
.pos-content { flex: 1; min-height: 0; overflow-y: auto; padding: 24px; }
.gate-hint { color: #64748b; font-size: 13px; margin: 4px 0 16px; }
.gate-back {
  display: inline-flex; align-items: center; gap: 7px;
  border: 0; background: transparent; color: #64748b;
  font: inherit; font-size: 12px; font-weight: 700; cursor: pointer;
  padding: 0; margin-bottom: 8px;
}
.gate-back:hover { color: var(--mrk-blue-deep); }
.gate-foot {
  display: flex; justify-content: flex-end; margin-top: 16px; padding-top: 14px;
  border-top: 1px solid #e2e8f0;
}
.gate-logout {
  display: inline-flex; align-items: center; gap: 7px; border: 0; background: none;
  color: #64748b; font: inherit; font-size: 13px; font-weight: 700; cursor: pointer;
}
.gate-logout:hover { color: #b91c1c; }
.gate-logout:disabled { opacity: .6; cursor: not-allowed; }
.gate-option-copy { flex: 1; min-width: 0; }
.gate-option-copy small { display: block; margin-top: 2px; }
.gate-option-copy .gate-meta { color: #94a3b8; font-size: 11.5px; }
.gate-option-arrow { color: #94a3b8; font-size: 12px; }
.gate-empty {
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  padding: 22px 16px; border: 1px dashed #cbd5e1; border-radius: 14px;
  color: #64748b; text-align: center; font-size: 13px;
}
.gate-empty i { font-size: 22px; color: var(--mrk-blue); }
.gate-empty p { margin: 0; }
.gate-create-link {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  border: 1px dashed var(--mrk-blue); background: transparent; color: var(--mrk-blue);
  border-radius: 12px; padding: 12px 16px; font: inherit; font-size: 13px;
  font-weight: 700; cursor: pointer; margin-top: 2px;
}
.gate-create-link:hover { background: var(--mrk-blue-pale); }
.gate-form { display: flex; flex-direction: column; gap: 9px; }
.gate-form label { font-size: 12px; font-weight: 700; color: var(--mrk-charcoal); }
.gate-form input,
.gate-form select {
  width: 100%; box-sizing: border-box; border: 1px solid #cbd5e1; border-radius: 10px;
  padding: 10px 12px; font: inherit; font-size: 14px; color: var(--mrk-charcoal);
  background: #fff;
}
.gate-form input:focus,
.gate-form select:focus { outline: 2px solid var(--mrk-blue-tint); border-color: var(--mrk-blue); }
.gate-code-field { position: relative; }
.gate-code-field input { padding-right: 42px; }
.gate-code-toggle {
  position: absolute; top: 50%; right: 8px; transform: translateY(-50%);
  display: inline-flex; align-items: center; justify-content: center;
  width: 30px; height: 30px; border: 0; border-radius: 8px;
  background: transparent; color: #64748b; cursor: pointer;
}
.gate-code-toggle:hover { background: var(--mrk-blue-pale); color: var(--mrk-blue); }
.gate-form .sm-btn { justify-content: center; margin-top: 4px; }
.gate-error { margin: 0; color: #b91c1c; font-size: 12.5px; font-weight: 600; }
.gate-counter {
  display: flex; flex-direction: column; gap: 3px;
  background: var(--mrk-blue-pale); border-radius: 12px; padding: 12px 14px;
}
.gate-counter strong { display: flex; align-items: center; gap: 8px; color: var(--mrk-blue-deep); }
.gate-counter small { color: #64748b; font-size: 12px; }
.gate-code-wrap { position: relative; }
.gate-code {
  border: 1px dashed var(--mrk-blue); background: #fff; border-radius: 12px;
  padding: 16px 48px; text-align: center; font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 20px; font-weight: 700; letter-spacing: 0.08em; color: var(--mrk-blue-deep);
  word-break: break-all;
}
.gate-code-copy {
  position: absolute; top: 50%; right: 10px; transform: translateY(-50%);
  display: inline-flex; align-items: center; justify-content: center;
  width: 32px; height: 32px; border: 0; border-radius: 8px;
  background: transparent; color: #64748b; cursor: pointer;
}
.gate-code-copy:hover { background: var(--mrk-blue-pale); color: var(--mrk-blue); }
.gate-copied { margin: 0; color: #15803d; font-size: 12.5px; font-weight: 600; }
.pos-backdrop { display: none; }
@media (max-width: 900px) {
  .pos-sidebar {
    position: fixed;
    inset: 0 auto 0 0;
    z-index: 60;
    transform: translateX(-100%);
    transition: transform 0.2s ease;
    box-shadow: 8px 0 24px rgba(6, 42, 82, 0.35);
    width: 230px;
  }
  .mobile-open .pos-sidebar { transform: translateX(0); }
  .collapsed .pos-sidebar { width: 230px; }
  .collapsed .pos-brand { justify-content: flex-start; padding-inline: 16px; }
  .pos-backdrop {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 55;
    background: rgba(33, 33, 33, 0.5);
  }
  .pos-page-title { font-size: 16px; }

  /* Header collapses into two tidy rows: title above, then the outlet and
     profile controls below. */
  .pos-topbar {
    flex-wrap: wrap;
    gap: 8px 12px;
    padding: 12px 16px;
  }
  .pos-topbar-main {
    flex: 1 1 100%;
    padding-bottom: 8px;
    border-bottom: 1px dashed #dbe4ef;
  }
  .pos-topbar-main .pos-page-title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .pos-topbar-sub {
    flex: 1 1 100%;
    gap: 10px;
    justify-content: space-between;
  }
  .pos-outlet-select {
    flex: 1 1 auto;
    min-width: 0;
    padding: 6px 12px;
    font-size: 12px;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .pos-waiter-btn {
    padding: 6px 12px;
    font-size: 12px;
  }
}
@media (max-width: 480px) {
  .pos-topbar { padding: 10px 12px; }
  .pos-collapse { width: 32px; height: 32px; }
}
</style>
