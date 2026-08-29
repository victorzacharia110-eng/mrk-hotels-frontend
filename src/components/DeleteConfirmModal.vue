<!--
  DeleteConfirmModal: confirm a destructive action by typing a word in CAPS.
  The confirm button stays disabled until the typed word matches `word`.

  Props:
    modelValue  - open/close (v-model)
    title       - modal heading (default: common.confirmDeleteTitle)
    message     - explanation body (defaults to a translated common message with count)
    count       - number of rows being deleted
    word        - the CAPS word to type (default "DELETE")
    busy        - disables the confirm button while deleting

  Emits:
    update:modelValue, confirm, cancel
-->
<template>
  <div v-if="modelValue" class="del-modal-overlay" @click.self="cancel">
    <div class="del-modal" role="dialog" aria-modal="true">
      <div class="del-modal-head">
        <h2><i class="fas fa-triangle-exclamation"></i> {{ title }}</h2>
        <button type="button" class="del-modal-close" aria-label="Close" @click="cancel">
          <i class="fas fa-xmark"></i>
        </button>
      </div>

      <div class="del-modal-body">
        <p>
          {{
            message ||
            $t('common.confirmDeleteMessage', { count: count, word: word })
          }}
        </p>
        <div class="form-group">
          <label>{{ $t('common.typeWordToConfirm', { word: word }) }}</label>
          <input
            v-model="typed"
            type="text"
            class="input del-confirm-input"
            :placeholder="word"
            autocomplete="off"
            autocapitalize="characters"
            spellcheck="false"
            @keyup.enter="submit"
          />
        </div>
      </div>

      <div class="del-modal-foot">
        <button type="button" class="btn btn-secondary" :disabled="busy" @click="cancel">
          {{ $t('common.cancel') }}
        </button>
        <button type="button" class="btn btn-danger" :disabled="!matched || busy" @click="submit">
          <i class="fas fa-trash"></i>
          {{ busy ? $t('common.deleting') : $t('common.deleteSelected') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, default: '' },
  message: { type: String, default: '' },
  count: { type: Number, default: 0 },
  word: { type: String, default: 'DELETE' },
  busy: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue', 'confirm', 'cancel'])

const typed = ref('')

const matched = computed(() => typed.value.trim() === props.word)

watch(
  () => props.modelValue,
  (open) => {
    if (open) typed.value = ''
  },
)

function cancel() {
  if (props.busy) return
  emit('cancel')
  emit('update:modelValue', false)
}

function submit() {
  if (!matched.value || props.busy) return
  emit('confirm')
}
</script>

<style scoped>
.del-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.del-modal {
  background: #fff;
  border-radius: 8px;
  width: 100%;
  max-width: 460px;
  padding: 24px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
}

.del-modal-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.del-modal-head h2 {
  font-size: 18px;
  font-weight: 800;
  display: flex;
  align-items: center;
  gap: 8px;
}

.del-modal-head h2 i {
  color: #dc3545;
}

.del-modal-close {
  background: none;
  border: none;
  font-size: 18px;
  color: #757575;
  cursor: pointer;
  padding: 4px;
}

.del-modal-body p {
  color: #424242;
  line-height: 1.5;
  margin-bottom: 16px;
}

.del-confirm-input {
  letter-spacing: 1px;
}

.del-modal-foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}
</style>