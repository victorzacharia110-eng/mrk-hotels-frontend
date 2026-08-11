/**
 * Laravel Echo (Reverb) WebSocket client, created as a lazy singleton.
 *
 * initEcho() runs after login; private-channel authorisation goes through the
 * backend's /broadcasting/auth endpoint via the shared axios instance, so the
 * bearer token is attached automatically. destroyEcho() runs on logout.
 */

import Echo from 'laravel-echo'
import Pusher from 'pusher-js'
import api from '@/api/axios'

// Lazily-created singleton Echo (Laravel Reverb) instance.
let echo = null

/**
 * Creates the Echo/Pusher client once and returns the shared instance.
 * @returns {object} The configured Echo instance.
 */
export function initEcho() {
  if (echo) return echo
  const scheme = import.meta.env.VITE_REVERB_SCHEME || 'http'
  // Pusher-js must be reachable as window.Pusher for Echo to find it.
  window.Pusher = Pusher
  echo = new Echo({
    broadcaster: 'reverb',
    key: import.meta.env.VITE_REVERB_APP_KEY || '',
    // Private channels are authorised via the backend's broadcasting/auth.
    authorizer: (channel) => ({
      authorize: (socketId, callback) => {
        api
          .post('/broadcasting/auth', {
            socket_id: socketId,
            channel_name: channel.name,
          })
          .then((response) => callback(false, response.data))
          .catch((error) => callback(true, error))
      },
    }),
    wsHost: import.meta.env.VITE_REVERB_HOST || '127.0.0.1',
    wsPort: Number(import.meta.env.VITE_REVERB_PORT) || 8080,
    wssPort: Number(import.meta.env.VITE_REVERB_PORT) || 443,
    forceTLS: scheme === 'https',
    enabledTransports: ['ws', 'wss'],
  })
  return echo
}

/**
 * Returns the shared Echo instance (null until initEcho has run).
 * @returns {object|null} The Echo instance, if initialised.
 */
export function getEcho() {
  return echo
}

/**
 * Disconnects the WebSocket and resets the singleton.
 */
export function destroyEcho() {
  if (echo) {
    echo.disconnect()
    echo = null
  }
}
