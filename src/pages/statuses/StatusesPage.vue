<!--
  Statuses page (route: /app/statuses, name: hotel-statuses).
  WhatsApp-style ephemeral status board for hotel staff: post text/image/video
  updates (hotel or global scope), browse colleagues' statuses in a fullscreen
  auto-advancing viewer with likes and view counts, kept live over websockets.
-->
<template>
  <div class="dashboard-page container">
    <div class="page-head">
      <div>
        <h1><i class="fas fa-circle-dot"></i> {{ $t('statuses.title') }}</h1>
        <p class="muted">{{ $t('statuses.subtitle') }}</p>
      </div>
      <div class="head-actions">
        <button class="btn btn-secondary" @click="loadStatuses">
          <i class="fas fa-rotate"></i> {{ $t('common.refresh') }}
        </button>
        <button class="btn btn-primary" @click="openPost">
          <i class="fas fa-plus"></i> {{ $t('statuses.newStatus') }}
        </button>
      </div>
    </div>

    <div v-if="success" class="alert alert-success">{{ success }}</div>
    <div v-if="error" class="alert alert-error">{{ error }}</div>

    <div v-if="loading" class="alert alert-info">{{ $t('common.loading') }}</div>

    <!-- Status board: "my status" card plus one card per other user, with viewed/unviewed rings -->
    <div v-else class="status-board">
      <button class="status-card mine" @click="openMyStatus">
        <span class="avatar status-avatar mine-avatar" :class="myStatuses.length ? 'unviewed' : ''">
          <template v-if="myStatuses.length">{{ initials(me.full_name) }}</template>
          <i v-else class="fas fa-plus"></i>
          <span class="mine-add" :title="$t('statuses.newStatus')" @click.stop="openPost">
            <i class="fas fa-plus"></i>
          </span>
        </span>
        <span class="status-card-body">
          <strong>{{ $t('statuses.myStatus') }}</strong>
          <span class="muted">{{
            myStatuses.length ? timeAgo(myStatuses[0].created_at) : $t('statuses.addStatusHint')
          }}</span>
        </span>
      </button>

      <button v-for="g in others" :key="g.user.user_id" class="status-card" @click="openViewer(g)">
        <span class="avatar status-avatar" :class="g.allViewed ? 'viewed' : 'unviewed'">{{
          initials(g.user.full_name)
        }}</span>
        <span class="status-card-body">
          <strong>{{ g.user.full_name }}</strong>
          <span class="muted">{{ timeAgo(g.latest.created_at) }}</span>
        </span>
      </button>
    </div>

    <div v-if="!loading && !statuses.length" class="chat-empty muted">
      {{ $t('statuses.empty') }}
    </div>

    <!-- Post status modal -->
    <div v-if="showPost" class="modal-overlay" @click.self="closePost">
      <div class="modal status-modal">
        <div class="modal-head">
          <h2><i class="fas fa-plus"></i> {{ $t('statuses.newStatus') }}</h2>
          <button class="modal-close" @click="closePost"><i class="fas fa-xmark"></i></button>
        </div>

        <div class="form-group">
          <label>{{ $t('statuses.whatsHappening') }}</label>
          <textarea
            v-model="postBody"
            rows="3"
            class="textarea"
            :placeholder="$t('statuses.bodyPlaceholder')"
          ></textarea>
        </div>

        <div class="form-group">
          <label>{{ $t('statuses.media') }}</label>
          <button type="button" class="btn btn-secondary" @click="mediaInput?.click()">
            <i class="fas fa-image"></i>
            {{ postMedia ? postMedia.name : $t('statuses.chooseMedia') }}
          </button>
          <input
            ref="mediaInput"
            type="file"
            accept="image/*,video/*"
            class="hidden-input"
            @change="onMediaPicked"
          />
          <img
            v-if="postMediaUrl && postMedia?.type.startsWith('image/')"
            :src="postMediaUrl"
            class="status-media-preview"
            alt="preview"
          />
          <video
            v-else-if="postMediaUrl"
            :src="postMediaUrl"
            controls
            class="status-media-preview"
          ></video>
        </div>

        <!-- Audience scope picker: hotel-only vs global -->
        <p class="muted">{{ $t('statuses.selectScope') }}</p>
        <div class="scope-cards">
          <button
            class="scope-card"
            :class="{ selected: postScope === 'hotel' }"
            @click="postScope = 'hotel'"
          >
            <span class="scope-icon"><i class="fas fa-building"></i></span>
            <span>
              <strong>{{ $t('messages.hotelMessaging') }}</strong>
              <span class="muted">{{ $t('statuses.hintHotel') }}</span>
            </span>
          </button>
          <button
            class="scope-card"
            :class="{ selected: postScope === 'global' }"
            @click="postScope = 'global'"
          >
            <span class="scope-icon"><i class="fas fa-globe"></i></span>
            <span>
              <strong>{{ $t('messages.globalMessaging') }}</strong>
              <span class="muted">{{ $t('statuses.hintGlobal') }}</span>
            </span>
          </button>
        </div>

        <div class="modal-foot">
          <button type="button" class="btn btn-secondary" @click="closePost">
            {{ $t('common.cancel') }}
          </button>
          <button type="button" class="btn btn-primary" :disabled="posting" @click="postStatus">
            <i class="fas fa-paper-plane"></i>
            {{ posting ? $t('common.saving') : $t('statuses.post') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Status viewer -->
    <div v-if="viewer.open" class="status-viewer">
      <div class="status-progress">
        <div
          v-for="(s, i) in viewer.items"
          :key="s.status_id"
          class="progress-seg"
          :class="{ active: i === viewer.index, done: i < viewer.index }"
        ></div>
      </div>

      <div class="status-viewer-head">
        <span class="avatar">{{ initials(viewer.user?.full_name) }}</span>
        <div class="status-viewer-who">
          <strong>{{ viewer.user?.full_name }}</strong>
          <span class="muted">{{ timeAgo(currentStatus?.created_at) }}</span>
        </div>
        <button class="modal-close" @click="closeViewer"><i class="fas fa-xmark"></i></button>
      </div>

      <div class="status-slide" @click.self="nextStatus">
        <template v-if="currentStatus">
          <img
            v-if="currentStatus.type === 'image' && currentStatus.media_url"
            :src="currentStatus.media_url"
            class="status-media"
            :alt="currentStatus.body || $t('common.image')"
          />
          <video
            v-else-if="currentStatus.type === 'video' && currentStatus.media_url"
            :src="currentStatus.media_url"
            autoplay
            controls
            class="status-media"
          ></video>
          <p v-else class="status-text">{{ currentStatus.body }}</p>
        </template>
      </div>

      <div class="status-viewer-bottom">
        <template v-if="currentStatus?.user_id === me.user_id">
          <div class="status-viewers">
            <span class="muted"
              ><i class="fas fa-eye"></i> {{ currentStatus?.view_count || 0 }}</span
            >
            <span v-if="viewer.viewersLoading" class="muted">{{ $t('common.loading') }}</span>
            <span v-for="v in viewer.viewers" :key="v.user_id" class="viewer-chip">{{
              v.full_name
            }}</span>
          </div>
          <button class="btn btn-sm btn-danger" @click="deleteStatus(currentStatus)">
            <i class="fas fa-trash"></i> {{ $t('common.delete') }}
          </button>
        </template>
        <template v-else>
          <button
            class="status-like"
            :class="{ liked: currentStatus?.liked }"
            @click="toggleLike(currentStatus)"
          >
            <i class="fas fa-heart"></i>
            <span>{{ currentStatus?.like_count || 0 }}</span>
          </button>
          <div class="status-nav-btns">
            <button class="status-nav" @click="prevStatus">
              <i class="fas fa-chevron-left"></i>
            </button>
            <button class="status-nav" @click="nextStatus">
              <i class="fas fa-chevron-right"></i>
            </button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { statusApi } from '@/api'
import { initEcho, getEcho } from '@/plugins/echo'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
// The currently logged-in user (defaults to an empty object).
const me = computed(() => authStore.user || {})

// Main status board state: list rows, loading and feedback flags.
const loading = ref(false)
const error = ref('')
const success = ref('')
const statuses = ref([])

// Post-status modal state: body, audience scope, optional media file and submission flag.
const showPost = ref(false)
const postBody = ref('')
const postScope = ref('hotel')
const postMedia = ref(null)
const postMediaUrl = ref('')
const posting = ref(false)
const mediaInput = ref(null)

// Fullscreen status viewer state and the auto-advance timer.
const viewer = ref({
  open: false,
  user: null,
  items: [],
  index: 0,
  viewers: [],
  viewersLoading: false,
})
let viewerTimer = null

/** Builds a 1-2 letter uppercase monogram from a person's name. */
function initials(name) {
  return (name || '?')
    .split(' ')
    .filter(Boolean)
    .map((word) => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

/** Returns a human-readable relative time (just now/minutes/hours/days ago) for an ISO timestamp. */
function timeAgo(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const diff = Math.floor((Date.now() - d.getTime()) / 1000)
  if (diff < 60) return t('statuses.justNow')
  if (diff < 3600) return t('statuses.minutesAgo', { n: Math.floor(diff / 60) })
  if (diff < 86400) return t('statuses.hoursAgo', { n: Math.floor(diff / 3600) })
  return t('statuses.daysAgo', { n: Math.floor(diff / 86400) })
}

/**
 * Flattens a validation/API error into a single readable message string.
 * @param {Error} err - The thrown request error.
 * @returns {string} A space-joined error message or the generic failure text.
 */
function flattenError(err) {
  const errors = err.response?.data?.errors
  if (errors) return Object.values(errors).flat().join(' ')
  return err.response?.data?.message || t('common.actionFailed')
}

// The statuses posted by the current user.
const myStatuses = computed(() =>
  statuses.value.filter((status) => status.user_id === me.value.user_id),
)

/** Groups all statuses by author, sorted by latest first, with per-group viewing state. */
const grouped = computed(() => {
  const map = new Map()
  for (const s of statuses.value) {
    if (!map.has(s.user_id)) map.set(s.user_id, [])
    map.get(s.user_id).push(s)
  }
  return Array.from(map.values())
    .map((list) => ({
      user: list[0].user,
      items: list,
      latest: list[0],
      allViewed: list.every((status) => status.viewed),
    }))
    .sort((groupA, groupB) =>
      String(groupB.latest.created_at).localeCompare(String(groupA.latest.created_at)),
    )
})

// Status groups belonging to other users (i.e. not the current user).
const others = computed(() =>
  grouped.value.filter((group) => group.user && group.user.user_id !== me.value.user_id),
)

// The status currently shown in the viewer, based on the active group index.
const currentStatus = computed(() => viewer.value.items[viewer.value.index] || null)

/** Fetches the latest statuses from the API and stores them for the board. */
async function loadStatuses() {
  loading.value = true
  error.value = ''
  try {
    const res = await statusApi.index({ per_page: 50 })
    statuses.value = res.data.data || []
  } catch (err) {
    error.value = flattenError(err)
  } finally {
    loading.value = false
  }
}

/** Opens the current user's own statuses, or the composer when they have none yet. */
function openMyStatus() {
  if (!myStatuses.value.length) {
    openPost()
    return
  }
  openViewer({ user: myStatuses.value[0].user, items: myStatuses.value })
}

/** Opens the viewer for a group, marks the first status viewed and starts auto-advance. */
function openViewer(group) {
  if (!group?.items?.length) return
  viewer.value = {
    open: true,
    user: group.user,
    items: group.items,
    index: 0,
    viewers: [],
    viewersLoading: false,
  }
  const first = currentStatus.value
  markViewed(first)
  if (first?.user_id === me.value.user_id) loadViewers(first)
  startAutoAdvance()
}

/** Closes the viewer, stopping the auto-advance timer and resetting state. */
function closeViewer() {
  clearInterval(viewerTimer)
  viewerTimer = null
  viewer.value = {
    open: false,
    user: null,
    items: [],
    index: 0,
    viewers: [],
    viewersLoading: false,
  }
}

/** Moves to the next status, or closes the viewer at the end of the group. */
function nextStatus() {
  if (!viewer.value.open) return
  if (viewer.value.index < viewer.value.items.length - 1) {
    viewer.value.index += 1
    const item = currentStatus.value
    markViewed(item)
    if (item?.user_id === me.value.user_id) loadViewers(item)
  } else {
    closeViewer()
  }
}

/** Moves back to the previous status in the group. */
function prevStatus() {
  if (viewer.value.index > 0) viewer.value.index -= 1
}

/** Marks a status as viewed locally and notifies the API (best-effort call). */
async function markViewed(item) {
  if (!item || item.viewed || item.user_id === me.value.user_id) return
  item.viewed = true
  try {
    await statusApi.view(item.status_id)
  } catch {
    // viewing is best-effort; a failed call is not fatal
  }
}

/** Loads the list of viewers for the user's own status, if not already known. */
async function loadViewers(item) {
  if (!item) return
  viewer.value.viewersLoading = true
  try {
    const res = await statusApi.show(item.status_id)
    viewer.value.viewers = res.data.viewers || []
    item.view_count = res.data.status?.view_count ?? item.view_count
  } catch {
    // keep whatever viewers we already have
  } finally {
    viewer.value.viewersLoading = false
  }
}

/** Toggles the like state of a status and updates the count from the response. */
async function toggleLike(item) {
  if (!item) return
  try {
    const res = await statusApi.react(item.status_id)
    item.liked = res.data.liked
    item.like_count = res.data.like_count
  } catch (err) {
    error.value = flattenError(err)
  }
}

/** Deletes a status, then refreshes the board and closes the viewer. */
async function deleteStatus(item) {
  if (!item) return
  try {
    await statusApi.destroy(item.status_id)
    success.value = t('statuses.deleted')
    closeViewer()
    await loadStatuses()
  } catch (err) {
    error.value = flattenError(err)
  }
}

/** Starts the interval that auto-advances the viewer every 6 seconds. */
function startAutoAdvance() {
  clearInterval(viewerTimer)
  viewerTimer = setInterval(() => {
    if (viewer.value.open) nextStatus()
  }, 6000)
}

/** Opens the composer, resetting its fields and clearing prior errors. */
function openPost() {
  showPost.value = true
  error.value = ''
  postBody.value = ''
  postScope.value = 'hotel'
  postMedia.value = null
  postMediaUrl.value = ''
}

/** Closes the composer, revoking any preview object URL. */
function closePost() {
  showPost.value = false
  if (postMediaUrl.value) URL.revokeObjectURL(postMediaUrl.value)
}

/** Stores the picked media file and builds a preview object URL for it. */
function onMediaPicked(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  if (postMediaUrl.value) URL.revokeObjectURL(postMediaUrl.value)
  postMedia.value = file
  postMediaUrl.value = URL.createObjectURL(file)
}

/** Submits the status (body and/or media) as FormData and refreshes the board on success. */
async function postStatus() {
  if (!postBody.value.trim() && !postMedia.value) {
    error.value = t('statuses.bodyOrMedia')
    return
  }
  posting.value = true
  error.value = ''
  const fd = new FormData()
  if (postBody.value.trim()) fd.append('body', postBody.value.trim())
  if (postMedia.value) {
    fd.append('media', postMedia.value)
    const kind = postMedia.value.type?.startsWith('video/')
      ? 'video'
      : postMedia.value.type?.startsWith('image/')
        ? 'image'
        : 'file'
    fd.append('type', kind)
  }
  fd.append('scope', postScope.value)
  try {
    await statusApi.store(fd)
    success.value = t('statuses.posted')
    showPost.value = false
    if (postMediaUrl.value) URL.revokeObjectURL(postMediaUrl.value)
    await loadStatuses()
  } catch (err) {
    error.value = flattenError(err)
  } finally {
    posting.value = false
  }
}

onMounted(async () => {
  initEcho()
  subscribeUserChannel()
  await loadStatuses()
  openRequestedUserStatus()
})

// Echo channel subscription for live status updates targeted at this user.
let userChannel = null

/** Subscribes to the current user's private channel to receive new status events. */
function subscribeUserChannel() {
  const echo = getEcho()
  if (!echo || !me.value.user_id) return
  userChannel = echo.private(`user.${me.value.user_id}`)
  userChannel.listen('.status.posted', handleStatusPosted)
}

/** Prepends a newly posted status (received over the socket) to the board when it is new. */
function handleStatusPosted(data) {
  const posted = data?.status
  if (!posted?.status_id) return
  if (statuses.value.some((status) => status.status_id === posted.status_id)) return
  statuses.value = [
    { ...posted, viewed: false, view_count: 0, like_count: 0, liked: false, can_delete: false },
    ...statuses.value,
  ]
}

/** Handles deep links: opens the composer (?compose) or a specific user's statuses (?user=id). */
function openRequestedUserStatus() {
  if (route.query.compose) {
    openPost()
    router.replace({ name: 'hotel-statuses' })
    return
  }
  const userId = route.query.user
  if (!userId) return
  const group = grouped.value.find((group) => group.user?.user_id === userId)
  if (group) {
    openViewer(group)
    router.replace({ name: 'hotel-statuses' })
  }
}

onUnmounted(() => {
  clearInterval(viewerTimer)
  if (userChannel) {
    userChannel.unsubscribe()
    userChannel = null
  }
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
  font-size: 24px;
  font-weight: 800;
  display: flex;
  align-items: center;
  gap: 10px;
}

.page-head h1 i {
  color: var(--brand);
}

.head-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.status-board {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 14px;
}

.status-card {
  display: flex;
  gap: 12px;
  align-items: center;
  text-align: left;
  padding: 14px;
  background: #fff;
  border: 1px solid #eee;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.status-card:hover {
  border-color: #c9d6e8;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.06);
}

.status-card.mine {
  background: #eaf4ff;
  border-color: var(--brand);
}

.avatar {
  width: 40px;
  height: 40px;
  min-width: 40px;
  border-radius: 50%;
  background: var(--brand);
  color: #fff;
  font-weight: 700;
  font-size: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.status-avatar {
  width: 52px;
  height: 52px;
  min-width: 52px;
  font-size: 18px;
  position: relative;
}

.status-avatar.unviewed {
  box-shadow:
    0 0 0 2px #fff,
    0 0 0 5px #25d366;
}

.status-avatar.viewed {
  box-shadow:
    0 0 0 2px #fff,
    0 0 0 5px #c0c0c0;
}

.mine-avatar {
  background: var(--brand);
}

.mine-add {
  position: absolute;
  right: -3px;
  bottom: -3px;
  width: 19px;
  height: 19px;
  border-radius: 50%;
  background: var(--brand);
  color: #fff;
  font-size: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 2px solid #fff;
  cursor: pointer;
  z-index: 2;
  transition: background 0.15s;
}

.mine-add:hover {
  background: var(--brand-dark);
}

.status-card-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.status-card-body .muted {
  font-size: 12px;
}

.status-modal {
  max-width: 540px;
}

.status-media-preview {
  max-width: 100%;
  max-height: 260px;
  border-radius: 10px;
  margin-top: 10px;
  display: block;
}

.scope-cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin: 12px 0;
}

.scope-card {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  text-align: left;
  padding: 12px;
  border: 2px solid #eee;
  border-radius: 8px;
  background: #fff;
  transition: all 0.15s;
}

.scope-card:hover {
  border-color: #c9d6e8;
}

.scope-card.selected {
  border-color: var(--brand);
  background: #eaf4ff;
}

.scope-icon {
  font-size: 18px;
  color: var(--brand);
}

.scope-card span {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.scope-card .muted {
  font-size: 12px;
}

.modal-foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 16px;
}

.hidden-input {
  display: none;
}

.status-viewer {
  position: fixed;
  inset: 0;
  background: #000;
  z-index: 100;
  display: flex;
  flex-direction: column;
  color: #fff;
}

.status-progress {
  display: flex;
  gap: 4px;
  padding: 14px 16px 0;
}

.progress-seg {
  flex: 1;
  height: 3px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.3);
  transition: background 0.2s;
}

.progress-seg.active {
  background: #fff;
}

.progress-seg.done {
  background: rgba(255, 255, 255, 0.7);
}

.status-viewer-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
}

.status-viewer-who {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.status-viewer-who .muted {
  color: rgba(255, 255, 255, 0.7);
  font-size: 12px;
}

.modal-close {
  background: none;
  border: none;
  color: #fff;
  font-size: 20px;
  cursor: pointer;
}

.status-slide {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
  padding: 8px 16px;
}

.status-media {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 10px;
}

.status-text {
  font-size: 22px;
  text-align: center;
  padding: 24px;
  max-width: 720px;
}

.status-viewer-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px 22px;
}

.status-viewers {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  min-width: 0;
}

.status-viewers .muted {
  color: rgba(255, 255, 255, 0.7);
}

.viewer-chip {
  background: rgba(255, 255, 255, 0.14);
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 12px;
}

.status-like {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: 1px solid rgba(255, 255, 255, 0.4);
  color: #fff;
  border-radius: 999px;
  padding: 8px 14px;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.15s;
}

.status-like.liked {
  background: rgba(192, 57, 43, 0.85);
  border-color: #c0392b;
}

.status-nav-btns {
  display: flex;
  gap: 10px;
}

.status-nav {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.4);
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  font-size: 16px;
  cursor: pointer;
}

.status-nav:hover {
  background: rgba(255, 255, 255, 0.22);
}

@media (max-width: 768px) {
  .dashboard-page {
    padding: 20px 16px;
  }

  .page-head {
    flex-direction: column;
    align-items: flex-start;
  }

  .scope-cards {
    grid-template-columns: 1fr;
  }
}
</style>
