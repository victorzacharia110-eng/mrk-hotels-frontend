<template>
  <div class="card invoice-card">
    <h2 class="card-title"><i class="fas fa-file-invoice"></i> {{ $t('invoiceDownload.title') }}</h2>
    <p class="muted">{{ $t('invoiceDownload.subtitle') }}</p>

    <form class="invoice-form" @submit.prevent="download">
      <input
        v-model.trim="reference"
        type="text"
        class="input"
        :placeholder="$t('invoiceDownload.referencePlaceholder')"
        required
      />
      <input
        v-model.trim="phone"
        type="tel"
        class="input"
        :placeholder="$t('invoiceDownload.phonePlaceholder')"
        required
      />
      <button class="btn btn-primary" :disabled="downloading">
        {{ downloading ? $t('invoiceDownload.preparing') : $t('invoiceDownload.button') }}
      </button>
    </form>

    <div v-if="error" class="alert alert-error">{{ error }}</div>
    <div v-if="success" class="alert alert-success">{{ success }}</div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { publicApi } from '@/api'
import { saveBlob } from '@/utils/download'

const { t } = useI18n()

// Download form state: the reference/phone inputs, the downloading flag that
// drives the button, and the success/error alerts.
const reference = ref('')
const phone = ref('')
const downloading = ref(false)
const error = ref('')
const success = ref('')

/**
 * Requests the invoice PDF for a reference + phone pair and saves it locally.
 * Derives the filename from the Content-Disposition header when present, and
 * maps the error response (which arrives as a blob) by HTTP status.
 *
 * @returns {Promise<void>}
 */
async function download() {
  error.value = ''
  success.value = ''
  downloading.value = true
  try {
    const res = await publicApi.invoiceDownload({ reference: reference.value, phone: phone.value })
    // The server names the file after the invoice number (e.g. INV-2026-0001.pdf).
    const disposition = res.headers?.['content-disposition'] || ''
    const filename = disposition.match(/filename="?([^";]+)"?/)?.[1] || `${reference.value}.pdf`
    saveBlob(res.data, filename)
    success.value = t('invoiceDownload.downloaded')
  } catch (err) {
    // Error responses arrive as blobs here; map by status instead of body.
    error.value = err.response?.status === 404
      ? t('invoiceDownload.notFound')
      : t('invoiceDownload.failed')
  } finally {
    downloading.value = false
  }
}
</script>

<style scoped>
.invoice-card {
  margin-top: 24px;
  padding: 20px 24px;
}

.card-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
}

.invoice-form {
  display: flex;
  gap: 10px;
  margin: 12px 0;
  max-width: 720px;
  flex-wrap: wrap;
}

.invoice-form .input {
  flex: 1;
  min-width: 220px;
}

@media (max-width: 768px) {
  .invoice-form {
    flex-direction: column;
  }

  .invoice-form .input {
    min-width: 0;
  }
}
</style>
