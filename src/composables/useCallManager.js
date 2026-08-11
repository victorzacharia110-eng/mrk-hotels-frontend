/**
 * WebRTC audio/video call manager composable.
 *
 * Signalling is relayed through the backend REST API and a private Echo
 * channel (`call.{id}`); the media itself flows peer-to-peer. Used by the
 * messages page to place, receive and control calls between staff members.
 */

import { ref } from 'vue'
import { callApi } from '@/api'
import { getEcho } from '@/plugins/echo'

// Public STUN server used to gather ICE candidates for the peer connection.
const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }]

/**
 * WebRTC call manager: initiates/receives audio & video calls, exchanges
 * signalling through the backend, and exposes UI state for the call overlay.
 * @param {object} options - Dependency injection.
 * @param {Function} options.notify - Emits an i18n message key for UI toasts.
 * @returns {object} Reactive call state and control functions.
 */
export function useCallManager({ notify }) {
  // High-level call UI state (visibility, kind, status, peer info).
  const call = ref({ visible: false, kind: 'audio', status: '', callId: '', direction: '', peerName: '', peerId: '' })
  // Local camera/mic MediaStream from getUserMedia.
  const localStream = ref(null)
  // Remote peer MediaStream fed by RTCPeerConnection ontrack.
  const remoteStream = ref(null)
  const localVideoUrl = ref('')
  const remoteVideoUrl = ref('')
  const muted = ref(false)
  const camOff = ref(false)
  // Call duration in seconds.
  const elapsed = ref(0)

  // RTCPeerConnection for the active call.
  let pc = null
  // Echo private channel listening for the peer's call events.
  let callChannel = null
  // Interval handle driving the call timer.
  let timer = null
  // ICE candidates queued until the remote description is known.
  let candidateQueue = []

  /**
   * Frees the object URLs backing the preview <video> elements.
   */
  function revokeUrls() {
    if (localVideoUrl.value) {
      URL.revokeObjectURL(localVideoUrl.value)
      localVideoUrl.value = ''
    }
    if (remoteVideoUrl.value) {
      URL.revokeObjectURL(remoteVideoUrl.value)
      remoteVideoUrl.value = ''
    }
  }

  /**
   * Lazy-creates the RTCPeerConnection and wires its event handlers.
   * @returns {RTCPeerConnection} The active peer connection.
   */
  function peer() {
    if (pc) return pc
    pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    pc.onicecandidate = (e) => {
      if (e.candidate) sendSignal('candidate', { candidate: e.candidate })
    }
    pc.ontrack = (e) => {
      remoteStream.value = e.streams[0] || null
      if (remoteVideoUrl.value) URL.revokeObjectURL(remoteVideoUrl.value)
      remoteVideoUrl.value = remoteStream.value ? URL.createObjectURL(remoteStream.value) : ''
    }
    pc.onconnectionstatechange = () => {
      if (pc && ['failed', 'disconnected'].includes(pc.connectionState)) hangup(false, 'callDisconnected')
    }
    return pc
  }

  /**
   * Grabs the local camera/mic and feeds its tracks into the connection.
   * @returns {Promise<MediaStream>} The local stream.
   */
  async function attachLocal() {
    if (localStream.value) localStream.value.getTracks().forEach((tr) => tr.stop())
    localStream.value = await navigator.mediaDevices.getUserMedia({ audio: true, video: call.value.kind === 'video' })
    localStream.value.getTracks().forEach((tr) => peer().addTrack(tr, localStream.value))
    if (localVideoUrl.value) URL.revokeObjectURL(localVideoUrl.value)
    localVideoUrl.value = URL.createObjectURL(localStream.value)
    return localStream.value
  }

  /**
   * Subscribes to the private Echo channel for a call.
   * @param {string} callId - Call identifier used as the channel name.
   */
  function subscribeChannel(callId) {
    const echo = getEcho()
    if (!echo) return
    callChannel = echo.private(`call.${callId}`)
    callChannel.listen('.call.signal', onSignal)
    callChannel.listen('.call.accepted', onAccepted)
    callChannel.listen('.call.declined', onPeerDeclined)
    callChannel.listen('.call.cancelled', onPeerCancelled)
    callChannel.listen('.call.ended', onPeerEnded)
  }

  /**
   * Leaves the call's Echo channel, if subscribed.
   */
  function destroyChannel() {
    if (callChannel) {
      callChannel.unsubscribe()
      callChannel = null
    }
  }

  /**
   * Stops all media tracks, closes the peer connection and resets the timer.
   */
  function cleanupStreams() {
    if (localStream.value) {
      localStream.value.getTracks().forEach((tr) => tr.stop())
      localStream.value = null
    }
    remoteStream.value = null
    revokeUrls()
    if (pc) {
      pc.close()
      pc = null
    }
    candidateQueue = []
    clearInterval(timer)
    timer = null
    elapsed.value = 0
  }

  /**
   * Relays a signalling message for the current call through the API.
   * @param {string} type - Signal type (offer/answer/candidate).
   * @param {object} payload - Signal payload (sdp/candidate).
   */
  async function sendSignal(type, payload) {
    if (!call.value.callId) return
    try {
      await callApi.signal(call.value.callId, type, payload)
    } catch {
      // The peer may have hung up mid-signal; the call state will clean up.
    }
  }

  /**
   * Feeds queued ICE candidates to the connection now that it can use them.
   */
  function drainCandidates() {
    candidateQueue.forEach((c) => pc?.addIceCandidate(c).catch(() => {}))
    candidateQueue = []
  }

  /**
   * Places an outgoing call to a peer.
   * @param {string} kind - Call kind (audio/video).
   * @param {string|number} peerId - User identifier of the callee.
   * @param {string} peerName - Display name of the callee.
   */
  async function startCall(kind, peerId, peerName) {
    if (call.value.visible || !peerId) return
    call.value = { visible: true, kind, status: 'ringing', callId: '', direction: 'outgoing', peerName, peerId }
    muted.value = false
    camOff.value = false
    startTimer()
    try {
      const res = await callApi.initiate(kind, peerId)
      call.value.callId = res.data.call.call_id
      subscribeChannel(call.value.callId)
      await attachLocal()
    } catch {
      notify('callFailed')
      hangupCleanup()
    }
  }

  /**
   * Shows the incoming-call overlay when a peer starts a call.
   * @param {object} data - Echo event payload describing the call + caller.
   */
  async function handleCallInvited(data) {
    if (call.value.visible) {
      // Busy: decline the new call automatically.
      callApi.decline(data.call_id).catch(() => {})
      return
    }
    call.value = {
      visible: true,
      kind: data.kind,
      status: 'ringing',
      callId: data.call_id,
      direction: 'incoming',
      peerName: data.caller?.full_name || '',
      peerId: data.caller?.user_id || '',
    }
    muted.value = false
    camOff.value = false
    startTimer()
  }

  /**
   * Accepts an incoming call and drives the WebRTC offer/answer exchange.
   */
  async function acceptIncoming() {
    if (call.value.direction !== 'incoming' || !call.value.callId) return
    try {
      await callApi.accept(call.value.callId)
      call.value.status = 'ongoing'
      subscribeChannel(call.value.callId)
      await attachLocal()
      // As the callee, we create the offer and let the caller answer it.
      const offer = await peer().createOffer()
      await peer().setLocalDescription(offer)
      sendSignal('offer', { sdp: offer })
    } catch {
      notify('callFailed')
      hangupCleanup()
    }
  }

  /**
   * Declines an incoming call and cleans up local state.
   */
  async function declineIncoming() {
    try {
      if (call.value.callId) await callApi.decline(call.value.callId)
    } catch {
      // already handled by hangupCleanup below
    }
    hangupCleanup()
  }

  /**
   * Handles an incoming WebRTC signal from the peer.
   * @param {object} data - Signal event (type + payload).
   */
  async function onSignal(data) {
    if (!pc || !data?.payload) return
    if (data.type === 'offer') {
      // One offer per call; ignore repeats and glare.
      if (pc.remoteDescription) return
      await pc.setRemoteDescription({ type: 'offer', sdp: data.payload.sdp })
      drainCandidates()
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      sendSignal('answer', { sdp: answer })
    } else if (data.type === 'answer') {
      // The caller may already be stable if an answer raced with an offer.
      if (pc.signalingState !== 'stable') {
        await pc.setRemoteDescription({ type: 'answer', sdp: data.payload.sdp })
      }
      drainCandidates()
    } else if (data.type === 'candidate') {
      // Candidates before the remote description must wait in the queue.
      if (pc.remoteDescription) pc.addIceCandidate(data.payload.candidate).catch(() => {})
      else candidateQueue.push(data.payload.candidate)
    }
  }

  /**
   * The peer accepted our outgoing call — media flow can begin.
   */
  function onAccepted() {
    if (call.value.direction === 'outgoing' && call.value.status === 'ringing') {
      call.value.status = 'ongoing'
      drainCandidates()
    }
  }

  /**
   * The peer declined our call.
   */
  function onPeerDeclined() {
    notify('callDeclined')
    hangupCleanup()
  }

  /**
   * The peer cancelled before we answered.
   */
  function onPeerCancelled() {
    notify('callCancelled')
    hangupCleanup()
  }

  /**
   * The peer ended the call — clean up silently.
   */
  function onPeerEnded() {
    hangupCleanup()
  }

  /**
   * Ends the call, telling the backend the right terminal event first.
   * @param {boolean} notifyEnded - Whether to toast the end of the call.
   */
  async function hangup(notifyEnded = false) {
    if (call.value.callId) {
      const status = call.value.status
      try {
        if (status === 'ringing' && call.value.direction === 'outgoing') await callApi.cancel(call.value.callId)
        else if (status === 'ringing' && call.value.direction === 'incoming') await callApi.decline(call.value.callId)
        else if (status === 'ongoing') await callApi.end(call.value.callId)
      } catch {
        // peer may already have hung up; local cleanup proceeds regardless
      }
    }
    if (notifyEnded) notify('callEnded')
    hangupCleanup()
  }

  /**
   * Tears down every piece of call state for a fresh start.
   */
  function hangupCleanup() {
    destroyChannel()
    cleanupStreams()
    call.value = { visible: false, kind: 'audio', status: '', callId: '', direction: '', peerName: '', peerId: '' }
  }

  /**
   * Toggles the local microphone.
   */
  function toggleMute() {
    muted.value = !muted.value
    localStream.value?.getAudioTracks().forEach((tr) => {
      tr.enabled = !muted.value
    })
  }

  /**
   * Toggles the local camera.
   */
  function toggleCamera() {
    camOff.value = !camOff.value
    localStream.value?.getVideoTracks().forEach((tr) => {
      tr.enabled = !camOff.value
    })
  }

  /**
   * Starts (or restarts) the per-second call duration counter.
   */
  function startTimer() {
    clearInterval(timer)
    elapsed.value = 0
    timer = setInterval(() => {
      elapsed.value += 1
    }, 1000)
  }

  /**
   * Formats seconds as M:SS for the call overlay.
   * @param {number} seconds - Elapsed call seconds.
   * @returns {string} Formatted time string.
   */
  function formatElapsed(seconds) {
    const m = String(Math.floor(seconds / 60)).padStart(2, '0')
    const s = String(seconds % 60).padStart(2, '0')
    return `${m}:${s}`
  }

  /**
   * Final cleanup used when the composable owner is destroyed.
   */
  function dispose() {
    if (call.value.visible) hangup()
    destroyChannel()
  }

  return {
    call,
    localStream,
    remoteStream,
    localVideoUrl,
    remoteVideoUrl,
    muted,
    camOff,
    elapsed,
    formatElapsed,
    startCall,
    handleCallInvited,
    acceptIncoming,
    declineIncoming,
    hangup,
    toggleMute,
    toggleCamera,
    dispose,
  }
}
