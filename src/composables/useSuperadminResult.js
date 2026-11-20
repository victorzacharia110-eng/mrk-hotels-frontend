import { reactive } from 'vue'

const state = reactive({
  show: false,
  title: '',
  message: '',
  type: 'success',
})

function closeResult() {
  state.show = false
  state.title = ''
  state.message = ''
}

function showResult({ title = '', message = '', type = 'success' } = {}) {
  state.title = title
  state.message = message
  state.type = type === 'error' ? 'error' : 'success'
  state.show = true
}

function actionError(err, fallback) {
  const data = err?.response?.data
  if (typeof data === 'string') return data
  return data?.message || data?.error || fallback
}

export function useSuperadminResult() {
  return {
    state,
    closeResult,
    showResult,
    showSuccess(message, title = '') {
      showResult({ title, message, type: 'success' })
    },
    showError(message, title = '') {
      showResult({ title, message, type: 'error' })
    },
    actionError,
  }
}

export function showSuperadminSuccess(message, title = '') {
  showResult({ title, message, type: 'success' })
}

export function showSuperadminError(message, title = '') {
  showResult({ title, message, type: 'error' })
}

export { state, closeResult }
