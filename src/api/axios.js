import axios from 'axios'

// Shared axios instance for every API call in the app.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
})

// Outgoing request interceptor: stamps auth + tenant headers on each call.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  // Owner hotel-switching: view a owned hotel's panel under its tenant context.
  const ownerHotel = sessionStorage.getItem('owner_viewing_hotel')
  if (ownerHotel) {
    config.headers['X-Tenant-ID'] = ownerHotel
  }
  // Let the browser set the boundary for multipart uploads.
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type']
  }
  return config
})

// Incoming response interceptor: flattens Laravel pagination metadata onto the
// payload and bounces the user to /login when the session expires.
api.interceptors.response.use(
  (response) => {
    const data = response.data
    if (data && Array.isArray(data.data) && data.meta) {
      response.data = {
        ...data,
        ...data.meta,
        first_page_url: data.links?.first || null,
        last_page_url: data.links?.last || null,
        prev_page_url: data.links?.prev || null,
        next_page_url: data.links?.next || null,
      }
    }
    return response
  },
  (error) => {
    const token = localStorage.getItem('auth_token')
    if (error.response?.status === 401 && token) {
      localStorage.removeItem('auth_token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
