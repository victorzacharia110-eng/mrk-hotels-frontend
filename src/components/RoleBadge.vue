<!--
  RoleBadge — the signed-in user's role, readable in every panel header.

  Reads the real role from the auth store (never a hardcoded panel label) and
  renders it as a small pill next to the user's name, so a hotel admin can
  tell "who is this session" no matter which panel they signed into.
-->

<template>
  <span class="role-badge" :class="{ dark }">
    <i class="fas fa-user-shield" aria-hidden="true"></i>
    {{ label }}
  </span>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'

const props = defineProps({
  /** Light (header) or dark (sidebar) background variant. */
  dark: { type: Boolean, default: false },
})

const authStore = useAuthStore()
const { t } = useI18n()

const ROLE_LABELS = {
  superadmin: () => 'Superadmin',
  owner: () => 'Owner',
  hotel_admin: () => t('common.roles.hotelAdmin'),
  manager: () => t('common.roles.manager'),
  accountant: () => t('common.roles.accountant'),
  store_manager: () => t('common.roles.storeManager'),
  procurement_officer: () => t('common.roles.procurementOfficer'),
  receptionist: () => t('common.roles.receptionist'),
  housekeeping: () => t('common.roles.housekeeping'),
  kitchen: () => t('common.roles.kitchen'),
  waiter: () => t('common.roles.waiter'),
  bartender: () => t('common.roles.bartender'),
  cashier: () => t('common.roles.cashier'),
  staff: () => t('common.roles.staff'),
}

const label = computed(() => {
  const fn = ROLE_LABELS[authStore.user?.user_role]
  return fn ? fn() : (ROLE_LABELS.staff ? ROLE_LABELS.staff() : 'Staff')
})
</script>

<style scoped>
.role-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  padding: 4px 10px;
  border-radius: 999px;
  white-space: nowrap;
  background: #e8f1fa;
  color: #00468c;
  border: 1px solid #b0cde9;
}

.role-badge.dark {
  background: #062a52;
  color: #e8f1fa;
  border-color: #1269bd;
}
</style>