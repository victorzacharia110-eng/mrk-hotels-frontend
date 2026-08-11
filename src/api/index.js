/**
 * API endpoint registry, grouped per backend resource.
 *
 * Each export is a plain object of thin methods over the shared axios
 * instance (see ./axios for the base URL, auth/tenant headers and error
 * handling). Every path is prefixed with the /v1 API version segment, and
 * methods return the axios promise unchanged so callers read response.data
 * directly.
 */

import api from './axios'

// API version segment prepended to every endpoint path below.
const v1 = '/v1'

/** Public storefront endpoints: hotel directory, availability, bookings and guest self-service. No auth required. */
export const publicApi = {
  /**
   * Fetches the list of hotels shown on the public hotel directory.
   * @param {object} params - Query params (search, filters, pagination).
   * @returns {Promise} Axios response with the paginated hotel list.
   */
  hotels(params) {
    return api.get(`${v1}/public/hotels`, { params })
  },
  /**
   * Fetches a single hotel's public-facing details.
   * @param {string|number} id - Hotel identifier.
   * @returns {Promise} Axios response with the hotel record.
   */
  hotelShow(id) {
    return api.get(`${v1}/public/hotels/${id}`)
  },
  /**
   * Queries public room availability for a date range.
   * @param {object} params - Query params (check-in, check-out, guests, hotel).
   * @returns {Promise} Axios response with the available rooms.
   */
  availability(params) {
    return api.get(`${v1}/public/availability`, { params })
  },
  /**
   * Submits a booking requisition from the public site.
   * @param {object} data - Requisition payload.
   * @returns {Promise} Axios response with the created requisition.
   */
  bookingRequisition(data) {
    return api.post(`${v1}/public/booking-requisitions`, data)
  },
  /**
   * Places a public reservation directly.
   * @param {object} data - Reservation payload.
   * @returns {Promise} Axios response with the created reservation.
   */
  reservations(data) {
    return api.post(`${v1}/public/reservations`, data)
  },
  /**
   * Checks a booking requisition's status by reference.
   * @param {object} params - Query params (booking reference, phone).
   * @returns {Promise} Axios response with the requisition status.
   */
  bookingStatus(params) {
    return api.get(`${v1}/public/booking-requisitions/status`, { params })
  },
  /**
   * Downloads an invoice through the guest self-service flow; identity is
   * verified server-side from the booking reference + phone.
   * @param {object} params - Query params (booking reference, phone).
   * @returns {Promise} Axios response with the PDF blob.
   */
  // Guest self-service invoice download (booking reference + phone verified).
  invoiceDownload(params) {
    return api.get(`${v1}/public/invoices/download`, { params, responseType: 'blob' })
  },
  /**
   * Fetches public dropdown/select options used by the booking forms.
   * @returns {Promise} Axios response with the options data.
   */
  options() {
    return api.get(`${v1}/public/options`)
  },
  /**
   * Initiates a payment (e.g. ClickPesa) for a public booking.
   * @param {object} data - Payment initiation payload.
   * @returns {Promise} Axios response with the initiation result.
   */
  initiatePayment(data) {
    return api.post(`${v1}/public/payments/initiate`, data)
  },
}

/** Authentication: login/logout, the current user's profile and password. */
export const authApi = {
  /**
   * Authenticates a user and returns the token + profile.
   * @param {object} data - Login credentials (email, password).
   * @returns {Promise} Axios response with token, user and permissions.
   */
  login(data) {
    return api.post(`${v1}/auth/login`, data)
  },
  /**
   * Ends the authenticated session on the server.
   * @returns {Promise} Axios response confirming logout.
   */
  logout() {
    return api.post(`${v1}/auth/logout`)
  },
  /**
   * Fetches the current user's profile and permissions.
   * @returns {Promise} Axios response with the authenticated user.
   */
  me() {
    return api.get(`${v1}/auth/me`)
  },
  /**
   * Changes the current user's password.
   * @param {object} data - Current + new password fields.
   * @returns {Promise} Axios response confirming the change.
   */
  changePassword(data) {
    return api.post(`${v1}/auth/change-password`, data)
  },
  /**
   * Updates the current user's profile fields.
   * @param {object} data - Profile fields to update.
   * @returns {Promise} Axios response with the updated user.
   */
  updateProfile(data) {
    return api.post(`${v1}/auth/update-profile`, data)
  },
}

/** Hotel reporting: dashboard KPIs, overview, occupancy, revenue and audit trail. */
export const reportApi = {
  /**
   * KPIs for the admin dashboard.
   * @param {object} params - Query params (period, hotel).
   * @returns {Promise} Axios response with dashboard figures.
   */
  dashboard(params) {
    return api.get(`${v1}/reports/dashboard`, { params })
  },
  /**
   * High-level operational overview figures.
   * @param {object} params - Query params (period).
   * @returns {Promise} Axios response with overview data.
   */
  overview(params) {
    return api.get(`${v1}/reports/overview`, { params })
  },
  /**
   * Room occupancy rates over the requested period.
   * @param {object} params - Query params (from, to).
   * @returns {Promise} Axios response with occupancy data.
   */
  occupancy(params) {
    return api.get(`${v1}/reports/occupancy`, { params })
  },
  /**
   * Revenue figures over the requested period.
   * @param {object} params - Query params (from, to).
   * @returns {Promise} Axios response with revenue data.
   */
  revenue(params) {
    return api.get(`${v1}/reports/revenue`, { params })
  },
  /**
   * Current status of every room.
   * @param {object} params - Query params (floor, status filters).
   * @returns {Promise} Axios response with per-room status.
   */
  roomStatus(params) {
    return api.get(`${v1}/reports/room-status`, { params })
  },
  /**
   * Paginated audit trail entries.
   * @param {object} params - Query params (filters, pagination).
   * @returns {Promise} Axios response with audit log entries.
   */
  auditLogs(params) {
    return api.get(`${v1}/reports/audit-logs`, { params })
  },
}

/** Accounting reports: general ledger, trial balance and balance sheet. */
export const accountingApi = {
  /**
   * Fetches general ledger entries.
   * @param {object} params - Query params (period, account filters).
   * @returns {Promise} Axios response with ledger entries.
   */
  generalLedger(params) {
    return api.get(`${v1}/accounting/general-ledger`, { params })
  },
  /**
   * Fetches the trial balance report.
   * @param {object} params - Query params (period).
   * @returns {Promise} Axios response with the trial balance.
   */
  trialBalance(params) {
    return api.get(`${v1}/accounting/trial-balance`, { params })
  },
  /**
   * Fetches the balance sheet report.
   * @param {object} params - Query params (as-of date).
   * @returns {Promise} Axios response with the balance sheet.
   */
  balanceSheet(params) {
    return api.get(`${v1}/accounting/balance-sheet`, { params })
  },
}

/** Staff user management: CRUD plus activation, invites, resets and attachments. */
export const userApi = {
  /**
   * Paginated list of staff users.
   * @param {object} params - Query params (search, role, pagination).
   * @returns {Promise} Axios response with the user list.
   */
  index(params) {
    return api.get(`${v1}/users`, { params })
  },
  /**
   * Creates a new user.
   * @param {object} data - User payload (name, email, role, ...).
   * @returns {Promise} Axios response with the created user.
   */
  store(data) {
    return api.post(`${v1}/users`, data)
  },
  /**
   * Fetches a single user.
   * @param {string|number} id - User identifier.
   * @returns {Promise} Axios response with the user record.
   */
  show(id) {
    return api.get(`${v1}/users/${id}`)
  },
  /**
   * Updates a user.
   * @param {string|number} id - User identifier.
   * @param {object} data - Fields to update.
   * @returns {Promise} Axios response with the updated user.
   */
  update(id, data) {
    return api.put(`${v1}/users/${id}`, data)
  },
  /**
   * Deletes a user.
   * @param {string|number} id - User identifier.
   * @returns {Promise} Axios response confirming deletion.
   */
  destroy(id) {
    return api.delete(`${v1}/users/${id}`)
  },
  /**
   * Activates a previously deactivated user.
   * @param {string|number} id - User identifier.
   * @returns {Promise} Axios response confirming activation.
   */
  activate(id) {
    return api.post(`${v1}/users/${id}/activate`)
  },
  /**
   * Sends an invitation email to a user.
   * @param {string|number} id - User identifier.
   * @returns {Promise} Axios response confirming the invite.
   */
  invite(id) {
    return api.post(`${v1}/users/${id}/invite`)
  },
  /**
   * Triggers a password reset for a user.
   * @param {string|number} id - User identifier.
   * @returns {Promise} Axios response confirming the reset.
   */
  resetPassword(id) {
    return api.post(`${v1}/users/${id}/reset-password`)
  },
  /**
   * Attaches a file (e.g. ID copy) to a user.
   * @param {string|number} id - User identifier.
   * @param {object} data - Attachment payload / FormData.
   * @returns {Promise} Axios response with the created attachment.
   */
  attach(id, data) {
    return api.post(`${v1}/users/${id}/attachments`, data)
  },
  /**
   * Removes an attachment from a user.
   * @param {string|number} id - User identifier.
   * @param {string|number} attachmentId - Attachment identifier.
   * @returns {Promise} Axios response confirming removal.
   */
  removeAttachment(id, attachmentId) {
    return api.delete(`${v1}/users/${id}/attachments/${attachmentId}`)
  },
}

/** Staff issue reports with comment threads and management responses. */
export const issueReportApi = {
  /**
   * Paginated list of issue reports.
   * @param {object} params - Query params (status, filters, pagination).
   * @returns {Promise} Axios response with the issue list.
   */
  index(params) {
    return api.get(`${v1}/issue-reports`, { params })
  },
  /**
   * Fetches a single issue report with its thread.
   * @param {string|number} id - Issue report identifier.
   * @returns {Promise} Axios response with the report.
   */
  show(id) {
    return api.get(`${v1}/issue-reports/${id}`)
  },
  /**
   * Creates a new issue report.
   * @param {object} data - Issue report payload.
   * @returns {Promise} Axios response with the created report.
   */
  store(data) {
    return api.post(`${v1}/issue-reports`, data)
  },
  /**
   * Adds a comment to an issue report thread.
   * @param {string|number} id - Issue report identifier.
   * @param {object} data - Comment payload.
   * @returns {Promise} Axios response with the created comment.
   */
  comment(id, data) {
    return api.post(`${v1}/issue-reports/${id}/comments`, data)
  },
  /**
   * Responds to (closes/acknowledges) an issue report.
   * @param {string|number} id - Issue report identifier.
   * @param {object} data - Response payload.
   * @returns {Promise} Axios response with the updated report.
   */
  respond(id, data) {
    return api.post(`${v1}/issue-reports/${id}/respond`, data)
  },
}

/** Room directory: CRUD plus operational status changes. */
export const roomApi = {
  /**
   * Paginated list of rooms.
   * @param {object} params - Query params (floor, status, pagination).
   * @returns {Promise} Axios response with the room list.
   */
  index(params) {
    return api.get(`${v1}/rooms`, { params })
  },
  /**
   * Creates a new room.
   * @param {object} data - Room payload (number, type, rate, ...).
   * @returns {Promise} Axios response with the created room.
   */
  store(data) {
    return api.post(`${v1}/rooms`, data)
  },
  /**
   * Fetches a single room.
   * @param {string|number} id - Room identifier.
   * @returns {Promise} Axios response with the room record.
   */
  show(id) {
    return api.get(`${v1}/rooms/${id}`)
  },
  /**
   * Updates a room.
   * @param {string|number} id - Room identifier.
   * @param {object} data - Fields to update.
   * @returns {Promise} Axios response with the updated room.
   */
  update(id, data) {
    return api.put(`${v1}/rooms/${id}`, data)
  },
  /**
   * Changes a room's status (dirty, clean, out of service).
   * @param {string|number} id - Room identifier.
   * @param {object} data - Status change payload.
   * @returns {Promise} Axios response with the updated room.
   */
  updateStatus(id, data) {
    return api.post(`${v1}/rooms/${id}/status`, data)
  },
  /**
   * Deletes a room.
   * @param {string|number} id - Room identifier.
   * @returns {Promise} Axios response confirming deletion.
   */
  destroy(id) {
    return api.delete(`${v1}/rooms/${id}`)
  },
}

/** Guest registry: CRUD plus the cross-hotel returning-guest lookup. */
export const guestApi = {
  /**
   * Paginated list of guests.
   * @param {object} params - Query params (search, pagination).
   * @returns {Promise} Axios response with the guest list.
   */
  index(params) {
    return api.get(`${v1}/guests`, { params })
  },
  /**
   * Searches for an existing guest by phone/name so data can be reused.
   * @param {string} search - Search term (phone, name, email).
   * @returns {Promise} Axios response with matching guests.
   */
  // Recognises a returning guest across every hotel on the platform.
  lookup(search) {
    return api.get(`${v1}/guests/lookup`, { params: { search } })
  },
  /**
   * Creates a new guest record.
   * @param {object} data - Guest payload (name, phone, nationality, ...).
   * @returns {Promise} Axios response with the created guest.
   */
  store(data) {
    return api.post(`${v1}/guests`, data)
  },
  /**
   * Fetches a single guest.
   * @param {string|number} id - Guest identifier.
   * @returns {Promise} Axios response with the guest record.
   */
  show(id) {
    return api.get(`${v1}/guests/${id}`)
  },
  /**
   * Updates a guest.
   * @param {string|number} id - Guest identifier.
   * @param {object} data - Fields to update.
   * @returns {Promise} Axios response with the updated guest.
   */
  update(id, data) {
    return api.put(`${v1}/guests/${id}`, data)
  },
  /**
   * Deletes a guest.
   * @param {string|number} id - Guest identifier.
   * @returns {Promise} Axios response confirming deletion.
   */
  destroy(id) {
    return api.delete(`${v1}/guests/${id}`)
  },
}

/** Reservations: CRUD plus the check-in / check-out / no-show lifecycle. */
export const reservationApi = {
  /**
   * Paginated list of reservations.
   * @param {object} params - Query params (status, dates, pagination).
   * @returns {Promise} Axios response with the reservation list.
   */
  index(params) {
    return api.get(`${v1}/reservations`, { params })
  },
  /**
   * Creates a new reservation.
   * @param {object} data - Reservation payload (guest, room, dates, ...).
   * @returns {Promise} Axios response with the created reservation.
   */
  store(data) {
    return api.post(`${v1}/reservations`, data)
  },
  /**
   * Fetches a single reservation.
   * @param {string|number} id - Reservation identifier.
   * @returns {Promise} Axios response with the reservation record.
   */
  show(id) {
    return api.get(`${v1}/reservations/${id}`)
  },
  /**
   * Updates a reservation.
   * @param {string|number} id - Reservation identifier.
   * @param {object} data - Fields to update.
   * @returns {Promise} Axios response with the updated reservation.
   */
  update(id, data) {
    return api.put(`${v1}/reservations/${id}`, data)
  },
  /**
   * Cancels a reservation.
   * @param {string|number} id - Reservation identifier.
   * @returns {Promise} Axios response confirming the cancellation.
   */
  cancel(id) {
    return api.post(`${v1}/reservations/${id}/cancel`)
  },
  /**
   * Hard-deletes a reservation; extra data can carry the reason.
   * @param {string|number} id - Reservation identifier.
   * @param {object} data - Optional deletion payload.
   * @returns {Promise} Axios response confirming deletion.
   */
  destroy(id, data) {
    return api.delete(`${v1}/reservations/${id}`, { data })
  },
  /**
   * Checks a guest into their reserved room.
   * @param {string|number} id - Reservation identifier.
   * @returns {Promise} Axios response confirming check-in.
   */
  checkIn(id) {
    return api.post(`${v1}/reservations/${id}/check-in`)
  },
  /**
   * Checks a guest out and finalises the folio.
   * @param {string|number} id - Reservation identifier.
   * @param {object} data - Check-out payload (settlements, ...).
   * @returns {Promise} Axios response confirming check-out.
   */
  checkOut(id, data) {
    return api.post(`${v1}/reservations/${id}/check-out`, data)
  },
  /**
   * Marks a reservation as a no-show.
   * @param {string|number} id - Reservation identifier.
   * @returns {Promise} Axios response confirming the no-show.
   */
  noShow(id) {
    return api.post(`${v1}/reservations/${id}/no-show`)
  },
  /**
   * Fetches dropdown options for the reservation forms.
   * @returns {Promise} Axios response with form options.
   */
  options() {
    return api.get(`${v1}/reservations/options`)
  },
}

/** Payments: capture, confirmation of guest-pushed transfers, refunds and ClickPesa. */
export const paymentApi = {
  /**
   * Paginated list of payments.
   * @param {object} params - Query params (status, method, pagination).
   * @returns {Promise} Axios response with the payment list.
   */
  index(params) {
    return api.get(`${v1}/payments`, { params })
  },
  /**
   * Records a new payment.
   * @param {object} data - Payment payload (amount, method, provider, ...).
   * @returns {Promise} Axios response with the created payment.
   */
  store(data) {
    return api.post(`${v1}/payments`, data)
  },
  /**
   * Fetches a single payment.
   * @param {string|number} id - Payment identifier.
   * @returns {Promise} Axios response with the payment record.
   */
  show(id) {
    return api.get(`${v1}/payments/${id}`)
  },
  /**
   * Deletes a payment.
   * @param {string|number} id - Payment identifier.
   * @returns {Promise} Axios response confirming deletion.
   */
  destroy(id) {
    return api.delete(`${v1}/payments/${id}`)
  },
  /**
   * Refunds a completed payment.
   * @param {string|number} id - Payment identifier.
   * @param {object} data - Refund payload (amount, reason).
   * @returns {Promise} Axios response with the refund result.
   */
  refund(id, data) {
    return api.post(`${v1}/payments/${id}/refund`, data)
  },
  /**
   * Marks an awaiting-confirmation payment as verified and credited.
   * @param {string|number} id - Payment identifier.
   * @param {object} data - Confirmation payload (transaction ref, ...).
   * @returns {Promise} Axios response with the confirmed payment.
   */
  // A receptionist verifies a mobile money transfer pushed by the guest.
  confirm(id, data) {
    return api.post(`${v1}/payments/${id}/confirm`, data)
  },
  /**
   * Rejects a payment awaiting confirmation.
   * @param {string|number} id - Payment identifier.
   * @param {object} data - Rejection payload (reason).
   * @returns {Promise} Axios response with the rejected payment.
   */
  reject(id, data) {
    return api.post(`${v1}/payments/${id}/reject`, data)
  },
  /**
   * Initiates a ClickPesa payment session.
   * @param {object} data - ClickPesa initiation payload.
   * @returns {Promise} Axios response with the checkout reference.
   */
  clickPesaInitiate(data) {
    return api.post(`${v1}/payments/clickpesa/initiate`, data)
  },
  /**
   * Fetches dropdown options for the payment forms.
   * @returns {Promise} Axios response with form options.
   */
  options() {
    return api.get(`${v1}/payments/options`)
  },
}

/** Invoices: listing, folio invoice generation and PDF download. */
export const invoiceApi = {
  /**
   * Paginated list of invoices.
   * @param {object} params - Query params (status, dates, pagination).
   * @returns {Promise} Axios response with the invoice list.
   */
  index(params) {
    return api.get(`${v1}/invoices`, { params })
  },
  /**
   * Fetches a single invoice.
   * @param {string|number} id - Invoice identifier.
   * @returns {Promise} Axios response with the invoice record.
   */
  show(id) {
    return api.get(`${v1}/invoices/${id}`)
  },
  /**
   * Generates (or refreshes) the folio invoice for a reservation.
   * @param {string|number} reservationId - Reservation identifier.
   * @returns {Promise} Axios response with the created/updated invoice.
   */
  // Generates (or refreshes) the folio invoice for a reservation.
  generate(reservationId) {
    return api.post(`${v1}/reservations/${reservationId}/invoice`)
  },
  /**
   * Streams the PDF; the caller turns the blob into a browser download.
   * @param {string|number} id - Invoice identifier.
   * @returns {Promise} Axios response with the PDF blob.
   */
  // Streams the PDF; the caller turns the blob into a browser download.
  download(id) {
    return api.get(`${v1}/invoices/${id}/download`, { responseType: 'blob' })
  },
}

/** Housekeeping tasks with the assign → start → confirm → verify → complete workflow. */
export const housekeepingApi = {
  /**
   * Paginated list of housekeeping tasks.
   * @param {object} params - Query params (status, assignee, pagination).
   * @returns {Promise} Axios response with the task list.
   */
  index(params) {
    return api.get(`${v1}/housekeeping-tasks`, { params })
  },
  /**
   * Creates a new housekeeping task.
   * @param {object} data - Task payload (room, type, priority, ...).
   * @returns {Promise} Axios response with the created task.
   */
  store(data) {
    return api.post(`${v1}/housekeeping-tasks`, data)
  },
  /**
   * Fetches a single housekeeping task.
   * @param {string|number} id - Task identifier.
   * @returns {Promise} Axios response with the task record.
   */
  show(id) {
    return api.get(`${v1}/housekeeping-tasks/${id}`)
  },
  /**
   * Updates a housekeeping task.
   * @param {string|number} id - Task identifier.
   * @param {object} data - Fields to update.
   * @returns {Promise} Axios response with the updated task.
   */
  update(id, data) {
    return api.put(`${v1}/housekeeping-tasks/${id}`, data)
  },
  /**
   * Assigns a staff member to a task.
   * @param {string|number} id - Task identifier.
   * @param {object} data - Assignee payload.
   * @returns {Promise} Axios response with the updated task.
   */
  assign(id, data) {
    return api.post(`${v1}/housekeeping-tasks/${id}/assign`, data)
  },
  /**
   * Marks a task as started by the assignee.
   * @param {string|number} id - Task identifier.
   * @returns {Promise} Axios response with the updated task.
   */
  start(id) {
    return api.post(`${v1}/housekeeping-tasks/${id}/start`)
  },
  /**
   * Confirms the work is done.
   * @param {string|number} id - Task identifier.
   * @returns {Promise} Axios response with the updated task.
   */
  confirm(id) {
    return api.post(`${v1}/housekeeping-tasks/${id}/confirm`)
  },
  /**
   * Verifies the completed work (e.g. by a supervisor).
   * @param {string|number} id - Task identifier.
   * @returns {Promise} Axios response with the updated task.
   */
  verify(id) {
    return api.post(`${v1}/housekeeping-tasks/${id}/verify`)
  },
  /**
   * Completes the task after verification.
   * @param {string|number} id - Task identifier.
   * @returns {Promise} Axios response with the updated task.
   */
  complete(id) {
    return api.post(`${v1}/housekeeping-tasks/${id}/complete`)
  },
  /**
   * Deletes a housekeeping task.
   * @param {string|number} id - Task identifier.
   * @returns {Promise} Axios response confirming deletion.
   */
  destroy(id) {
    return api.delete(`${v1}/housekeeping-tasks/${id}`)
  },
}

/** Inventory items, stock adjustments and movement history. */
export const inventoryApi = {
  /**
   * Paginated list of inventory items.
   * @param {object} params - Query params (search, category, pagination).
   * @returns {Promise} Axios response with the inventory list.
   */
  index(params) {
    return api.get(`${v1}/inventory`, { params })
  },
  /**
   * Creates a new inventory item.
   * @param {object} data - Item payload (name, unit, quantity, ...).
   * @returns {Promise} Axios response with the created item.
   */
  store(data) {
    return api.post(`${v1}/inventory`, data)
  },
  /**
   * Fetches a single inventory item.
   * @param {string|number} id - Item identifier.
   * @returns {Promise} Axios response with the item record.
   */
  show(id) {
    return api.get(`${v1}/inventory/${id}`)
  },
  /**
   * Updates an inventory item.
   * @param {string|number} id - Item identifier.
   * @param {object} data - Fields to update.
   * @returns {Promise} Axios response with the updated item.
   */
  update(id, data) {
    return api.put(`${v1}/inventory/${id}`, data)
  },
  /**
   * Records a stock adjustment (in/out) with a reason.
   * @param {string|number} id - Item identifier.
   * @param {object} data - Adjustment payload (quantity, reason).
   * @returns {Promise} Axios response with the adjusted item.
   */
  adjust(id, data) {
    return api.post(`${v1}/inventory/${id}/adjust`, data)
  },
  /**
   * Fetches an item's stock movement history.
   * @param {string|number} id - Item identifier.
   * @param {object} params - Query params (pagination, filters).
   * @returns {Promise} Axios response with the movement list.
   */
  movements(id, params) {
    return api.get(`${v1}/inventory/${id}/movements`, { params })
  },
  /**
   * Deletes an inventory item.
   * @param {string|number} id - Item identifier.
   * @returns {Promise} Axios response confirming deletion.
   */
  destroy(id) {
    return api.delete(`${v1}/inventory/${id}`)
  },
}

/** Supplier records for procurement. */
export const supplierApi = {
  /**
   * Paginated list of suppliers.
   * @param {object} params - Query params (search, pagination).
   * @returns {Promise} Axios response with the supplier list.
   */
  index(params) {
    return api.get(`${v1}/suppliers`, { params })
  },
  /**
   * Creates a new supplier.
   * @param {object} data - Supplier payload (name, contact, ...).
   * @returns {Promise} Axios response with the created supplier.
   */
  store(data) {
    return api.post(`${v1}/suppliers`, data)
  },
  /**
   * Fetches a single supplier.
   * @param {string|number} id - Supplier identifier.
   * @returns {Promise} Axios response with the supplier record.
   */
  show(id) {
    return api.get(`${v1}/suppliers/${id}`)
  },
  /**
   * Updates a supplier.
   * @param {string|number} id - Supplier identifier.
   * @param {object} data - Fields to update.
   * @returns {Promise} Axios response with the updated supplier.
   */
  update(id, data) {
    return api.put(`${v1}/suppliers/${id}`, data)
  },
  /**
   * Deletes a supplier.
   * @param {string|number} id - Supplier identifier.
   * @returns {Promise} Axios response confirming deletion.
   */
  destroy(id) {
    return api.delete(`${v1}/suppliers/${id}`)
  },
}

/** Food & beverage menu items. */
export const menuItemApi = {
  /**
   * Paginated list of menu items.
   * @param {object} params - Query params (category, search, pagination).
   * @returns {Promise} Axios response with the menu item list.
   */
  index(params) {
    return api.get(`${v1}/menu-items`, { params })
  },
  /**
   * Creates a new menu item.
   * @param {object} data - Menu item payload (name, price, category, ...).
   * @returns {Promise} Axios response with the created item.
   */
  store(data) {
    return api.post(`${v1}/menu-items`, data)
  },
  /**
   * Fetches a single menu item.
   * @param {string|number} id - Menu item identifier.
   * @returns {Promise} Axios response with the menu item record.
   */
  show(id) {
    return api.get(`${v1}/menu-items/${id}`)
  },
  /**
   * Updates a menu item.
   * @param {string|number} id - Menu item identifier.
   * @param {object} data - Fields to update.
   * @returns {Promise} Axios response with the updated item.
   */
  update(id, data) {
    return api.put(`${v1}/menu-items/${id}`, data)
  },
  /**
   * Deletes a menu item.
   * @param {string|number} id - Menu item identifier.
   * @returns {Promise} Axios response confirming deletion.
   */
  destroy(id) {
    return api.delete(`${v1}/menu-items/${id}`)
  },
}

/** F&B orders: cash/room-folio settlement and per-item kitchen status. */
export const orderApi = {
  /**
   * Paginated list of food & beverage orders.
   * @param {object} params - Query params (status, date, pagination).
   * @returns {Promise} Axios response with the order list.
   */
  index(params) {
    return api.get(`${v1}/orders`, { params })
  },
  /**
   * Fetches the order form's dropdown data.
   * @returns {Promise} Axios response with form options.
   */
  // In-house guests (to bill to a room) and serving staff (to record the waiter).
  formOptions() {
    return api.get(`${v1}/orders/form-options`)
  },
  /**
   * Creates a new order.
   * @param {object} data - Order payload (items, table, guest, ...).
   * @returns {Promise} Axios response with the created order.
   */
  store(data) {
    return api.post(`${v1}/orders`, data)
  },
  /**
   * Fetches a single order.
   * @param {string|number} id - Order identifier.
   * @returns {Promise} Axios response with the order record.
   */
  show(id) {
    return api.get(`${v1}/orders/${id}`)
  },
  /**
   * Updates an order.
   * @param {string|number} id - Order identifier.
   * @param {object} data - Fields to update.
   * @returns {Promise} Axios response with the updated order.
   */
  update(id, data) {
    return api.put(`${v1}/orders/${id}`, data)
  },
  /**
   * Settles an order in cash/mobile money.
   * @param {string|number} id - Order identifier.
   * @param {object} data - Payment payload.
   * @returns {Promise} Axios response with the settled order.
   */
  pay(id, data) {
    return api.post(`${v1}/orders/${id}/pay`, data)
  },
  /**
   * Charges an in-house guest's order to their room folio.
   * @param {string|number} id - Order identifier.
   * @param {object} data - Room/folio payload.
   * @returns {Promise} Axios response with the updated order.
   */
  billToRoom(id, data) {
    return api.post(`${v1}/orders/${id}/bill-to-room`, data)
  },
  /**
   * Kitchen marks a single line item ready or served without moving the whole order.
   * @param {string|number} id - Order identifier.
   * @param {string|number} itemId - Order item identifier.
   * @param {string} status - New item status (preparing, ready, served).
   * @returns {Promise} Axios response with the updated item.
   */
  // Kitchen marks a single line item ready or served without moving the whole order.
  markItemStatus(id, itemId, status) {
    return api.patch(`${v1}/orders/${id}/items/${itemId}/status`, { status })
  },
}

/** Guest laundry orders. */
export const laundryApi = {
  /**
   * Paginated list of laundry orders.
   * @param {object} params - Query params (status, date, pagination).
   * @returns {Promise} Axios response with the laundry order list.
   */
  index(params) {
    return api.get(`${v1}/laundry-orders`, { params })
  },
  /**
   * Creates a new laundry order.
   * @param {object} data - Laundry order payload (items, guest, room, ...).
   * @returns {Promise} Axios response with the created order.
   */
  store(data) {
    return api.post(`${v1}/laundry-orders`, data)
  },
  /**
   * Fetches a single laundry order.
   * @param {string|number} id - Laundry order identifier.
   * @returns {Promise} Axios response with the order record.
   */
  show(id) {
    return api.get(`${v1}/laundry-orders/${id}`)
  },
  /**
   * Updates a laundry order.
   * @param {string|number} id - Laundry order identifier.
   * @param {object} data - Fields to update.
   * @returns {Promise} Axios response with the updated order.
   */
  update(id, data) {
    return api.put(`${v1}/laundry-orders/${id}`, data)
  },
  /**
   * Deletes a laundry order.
   * @param {string|number} id - Laundry order identifier.
   * @returns {Promise} Axios response confirming deletion.
   */
  destroy(id) {
    return api.delete(`${v1}/laundry-orders/${id}`)
  },
}

/** Staff attendance: clock-in/out, current status and per-user history. */
export const attendanceApi = {
  /**
   * Records the current user's clock-in.
   * @param {object} data - Clock-in payload (device, note).
   * @returns {Promise} Axios response with the attendance record.
   */
  clockIn(data) {
    return api.post(`${v1}/attendance/clock-in`, data)
  },
  /**
   * Records the current user's clock-out.
   * @param {object} data - Clock-out payload (note, ...).
   * @returns {Promise} Axios response with the attendance record.
   */
  clockOut(data) {
    return api.post(`${v1}/attendance/clock-out`, data)
  },
  /**
   * Fetches the current user's attendance status (on shift or not).
   * @returns {Promise} Axios response with the current status.
   */
  status() {
    return api.get(`${v1}/attendance/status`)
  },
  /**
   * Lists staff currently on shift.
   * @param {object} params - Query params (department, ...).
   * @returns {Promise} Axios response with the on-shift staff list.
   */
  onShift(params) {
    return api.get(`${v1}/attendance/on-shift`, { params })
  },
  /**
   * Fetches one staff member's attendance history.
   * @param {string|number} userId - User identifier.
   * @param {object} params - Query params (period, pagination).
   * @returns {Promise} Axios response with the attendance history.
   */
  history(userId, params) {
    return api.get(`${v1}/attendance/users/${userId}/history`, { params })
  },
}

/** Guest fun-game activities. */
export const funGameApi = {
  /**
   * Paginated list of fun games (guest activities).
   * @param {object} params - Query params (search, pagination).
   * @returns {Promise} Axios response with the game list.
   */
  index(params) {
    return api.get(`${v1}/fun-games`, { params })
  },
  /**
   * Creates a new fun game.
   * @param {object} data - Game payload (name, price, description, ...).
   * @returns {Promise} Axios response with the created game.
   */
  store(data) {
    return api.post(`${v1}/fun-games`, data)
  },
  /**
   * Fetches a single fun game.
   * @param {string|number} id - Game identifier.
   * @returns {Promise} Axios response with the game record.
   */
  show(id) {
    return api.get(`${v1}/fun-games/${id}`)
  },
  /**
   * Updates a fun game.
   * @param {string|number} id - Game identifier.
   * @param {object} data - Fields to update.
   * @returns {Promise} Axios response with the updated game.
   */
  update(id, data) {
    return api.put(`${v1}/fun-games/${id}`, data)
  },
  /**
   * Deletes a fun game.
   * @param {string|number} id - Game identifier.
   * @returns {Promise} Axios response confirming deletion.
   */
  destroy(id) {
    return api.delete(`${v1}/fun-games/${id}`)
  },
}

/** Purchase requisitions with the approve / reject / cancel workflow. */
export const purchaseRequisitionApi = {
  /**
   * Paginated list of purchase requisitions.
   * @param {object} params - Query params (status, pagination).
   * @returns {Promise} Axios response with the requisition list.
   */
  index(params) {
    return api.get(`${v1}/purchase-requisitions`, { params })
  },
  /**
   * Creates a new purchase requisition.
   * @param {object} data - Requisition payload (items, department, ...).
   * @returns {Promise} Axios response with the created requisition.
   */
  store(data) {
    return api.post(`${v1}/purchase-requisitions`, data)
  },
  /**
   * Fetches a single purchase requisition.
   * @param {string|number} id - Requisition identifier.
   * @returns {Promise} Axios response with the requisition record.
   */
  show(id) {
    return api.get(`${v1}/purchase-requisitions/${id}`)
  },
  /**
   * Cancels a purchase requisition.
   * @param {string|number} id - Requisition identifier.
   * @returns {Promise} Axios response confirming the cancellation.
   */
  cancel(id) {
    return api.post(`${v1}/purchase-requisitions/${id}/cancel`)
  },
  /**
   * Approves a purchase requisition.
   * @param {string|number} id - Requisition identifier.
   * @returns {Promise} Axios response with the updated requisition.
   */
  approve(id) {
    return api.post(`${v1}/purchase-requisitions/${id}/approve`)
  },
  /**
   * Rejects a purchase requisition with a reason.
   * @param {string|number} id - Requisition identifier.
   * @param {object} data - Rejection payload (reason).
   * @returns {Promise} Axios response with the updated requisition.
   */
  reject(id, data) {
    return api.post(`${v1}/purchase-requisitions/${id}/reject`, data)
  },
}

/** Purchase orders with two-level approval. */
export const purchaseOrderApi = {
  /**
   * Paginated list of purchase orders.
   * @param {object} params - Query params (status, pagination).
   * @returns {Promise} Axios response with the purchase order list.
   */
  index(params) {
    return api.get(`${v1}/purchase-orders`, { params })
  },
  /**
   * Creates a new purchase order (usually from an approved requisition).
   * @param {object} data - Purchase order payload.
   * @returns {Promise} Axios response with the created order.
   */
  store(data) {
    return api.post(`${v1}/purchase-orders`, data)
  },
  /**
   * Fetches a single purchase order.
   * @param {string|number} id - Purchase order identifier.
   * @returns {Promise} Axios response with the order record.
   */
  show(id) {
    return api.get(`${v1}/purchase-orders/${id}`)
  },
  /**
   * Cancels a purchase order.
   * @param {string|number} id - Purchase order identifier.
   * @returns {Promise} Axios response confirming the cancellation.
   */
  cancel(id) {
    return api.post(`${v1}/purchase-orders/${id}/cancel`)
  },
  /**
   * First-level approval of a purchase order.
   * @param {string|number} id - Purchase order identifier.
   * @returns {Promise} Axios response with the updated order.
   */
  approve(id) {
    return api.post(`${v1}/purchase-orders/${id}/approve`)
  },
  /**
   * Second-level (manager) approval of a purchase order.
   * @param {string|number} id - Purchase order identifier.
   * @returns {Promise} Axios response with the updated order.
   */
  managerApprove(id) {
    return api.post(`${v1}/purchase-orders/${id}/manager-approve`)
  },
}

/** Goods received notes recorded against purchase orders. */
export const goodsReceivedNoteApi = {
  /**
   * Paginated list of goods received notes.
   * @param {object} params - Query params (status, pagination).
   * @returns {Promise} Axios response with the GRN list.
   */
  index(params) {
    return api.get(`${v1}/goods-received-notes`, { params })
  },
  /**
   * Records a goods received note against a purchase order.
   * @param {object} data - GRN payload (purchase order, items, ...).
   * @returns {Promise} Axios response with the created GRN.
   */
  store(data) {
    return api.post(`${v1}/goods-received-notes`, data)
  },
  /**
   * Fetches a single goods received note.
   * @param {string|number} id - GRN identifier.
   * @returns {Promise} Axios response with the GRN record.
   */
  show(id) {
    return api.get(`${v1}/goods-received-notes/${id}`)
  },
}

/** Booking requisitions sent by the public site, answered by the hotel. */
export const bookingRequisitionApi = {
  /**
   * Paginated list of booking requisitions received by the hotel.
   * @param {object} params - Query params (status, pagination).
   * @returns {Promise} Axios response with the requisition list.
   */
  index(params) {
    return api.get(`${v1}/booking-requisitions`, { params })
  },
  /**
   * Fetches a single booking requisition.
   * @param {string|number} id - Requisition identifier.
   * @returns {Promise} Axios response with the requisition record.
   */
  show(id) {
    return api.get(`${v1}/booking-requisitions/${id}`)
  },
  /**
   * Responds to a booking requisition (accept/decline).
   * @param {string|number} id - Requisition identifier.
   * @param {object} data - Response payload (decision, reason).
   * @returns {Promise} Axios response with the updated requisition.
   */
  respond(id, data) {
    return api.post(`${v1}/booking-requisitions/${id}/respond`, data)
  },
  /**
   * Deletes a booking requisition.
   * @param {string|number} id - Requisition identifier.
   * @returns {Promise} Axios response confirming deletion.
   */
  destroy(id) {
    return api.delete(`${v1}/booking-requisitions/${id}`)
  },
}

/** Superadmin tenant (hotel) management: lifecycle, subscription, branding and owners. */
export const tenantApi = {
  /**
   * Paginated list of tenants (hotels) managed by the superadmin.
   * @param {object} params - Query params (search, status, pagination).
   * @returns {Promise} Axios response with the tenant list.
   */
  index(params) {
    return api.get(`${v1}/tenants`, { params })
  },
  /**
   * Registers a new tenant hotel.
   * @param {object} data - Tenant payload (name, subscription, ...).
   * @returns {Promise} Axios response with the created tenant.
   */
  store(data) {
    return api.post(`${v1}/tenants`, data)
  },
  /**
   * Fetches a single tenant.
   * @param {string|number} id - Tenant identifier.
   * @returns {Promise} Axios response with the tenant record.
   */
  show(id) {
    return api.get(`${v1}/tenants/${id}`)
  },
  /**
   * Updates a tenant.
   * @param {string|number} id - Tenant identifier.
   * @param {object} data - Fields to update.
   * @returns {Promise} Axios response with the updated tenant.
   */
  update(id, data) {
    return api.put(`${v1}/tenants/${id}`, data)
  },
  /**
   * Approves a pending tenant application.
   * @param {string|number} id - Tenant identifier.
   * @returns {Promise} Axios response with the updated tenant.
   */
  approve(id) {
    return api.post(`${v1}/tenants/${id}/approve`)
  },
  /**
   * Rejects a pending tenant application.
   * @param {string|number} id - Tenant identifier.
   * @returns {Promise} Axios response with the updated tenant.
   */
  reject(id) {
    return api.post(`${v1}/tenants/${id}/reject`)
  },
  /**
   * Suspends an active tenant.
   * @param {string|number} id - Tenant identifier.
   * @returns {Promise} Axios response with the updated tenant.
   */
  suspend(id) {
    return api.post(`${v1}/tenants/${id}/suspend`)
  },
  /**
   * Reactivates a suspended tenant.
   * @param {string|number} id - Tenant identifier.
   * @returns {Promise} Axios response with the updated tenant.
   */
  reactivate(id) {
    return api.post(`${v1}/tenants/${id}/reactivate`)
  },
  /**
   * Updates a tenant's subscription plan.
   * @param {string|number} id - Tenant identifier.
   * @param {object} data - Subscription payload (plan, ...).
   * @returns {Promise} Axios response with the updated tenant.
   */
  updateSubscription(id, data) {
    return api.post(`${v1}/tenants/${id}/subscription`, data)
  },
  /**
   * Uploads the tenant's invoice branding.
   * @param {string|number} id - Tenant identifier.
   * @param {FormData} formData - Multipart body with image files / remove flags.
   * @returns {Promise} Axios response with the updated tenant.
   */
  // Multipart: signature/stamp image files, or remove_signature/remove_stamp flags.
  uploadBranding(id, formData) {
    return api.post(`${v1}/tenants/${id}/branding`, formData)
  },
  /**
   * Lists the platform's hotel owners.
   * @returns {Promise} Axios response with the owner list.
   */
  owners() {
    return api.get(`${v1}/owners`)
  },
  /**
   * Creates a new hotel owner account.
   * @param {object} data - Owner payload (name, email, ...).
   * @returns {Promise} Axios response with the created owner.
   */
  createOwner(data) {
    return api.post(`${v1}/owners`, data)
  },
}

/** Superadmin platform-wide reports and per-tenant analytics. */
export const superadminReportApi = {
  /**
   * Platform-wide KPIs for the superadmin dashboard.
   * @returns {Promise} Axios response with the dashboard figures.
   */
  dashboard() {
    return api.get(`${v1}/reports/superadmin/dashboard`)
  },
  /**
   * Analytics for a single tenant hotel.
   * @param {string|number} id - Tenant identifier.
   * @returns {Promise} Axios response with the tenant's analytics.
   */
  tenantAnalytics(id) {
    return api.get(`${v1}/reports/tenants/${id}/analytics`)
  },
}

/** Owner dashboard and owned-hotel views. */
export const ownerApi = {
  /**
   * KPIs for the owner's dashboard.
   * @returns {Promise} Axios response with the owner dashboard figures.
   */
  dashboard() {
    return api.get(`${v1}/owner/dashboard`)
  },
  /**
   * Lists the hotels the owner manages.
   * @returns {Promise} Axios response with the owned hotels.
   */
  hotels() {
    return api.get(`${v1}/owner/hotels`)
  },
  /**
   * Fetches a single hotel's owner view.
   * @param {string|number} id - Hotel identifier.
   * @returns {Promise} Axios response with the hotel's owner data.
   */
  hotel(id) {
    return api.get(`${v1}/owner/hotels/${id}`)
  },
}

/** 1:1 staff conversations and their messages. */
export const conversationApi = {
  /**
   * Paginated list of 1:1 conversations.
   * @param {object} params - Query params (search, pagination).
   * @returns {Promise} Axios response with the conversation list.
   */
  index(params) {
    return api.get(`${v1}/messages/conversations`, { params })
  },
  /**
   * Starts a new conversation with a user.
   * @param {object} data - Conversation payload (user_id, first message).
   * @returns {Promise} Axios response with the created conversation.
   */
  store(data) {
    return api.post(`${v1}/messages/conversations`, data)
  },
  /**
   * Fetches a single conversation.
   * @param {string|number} id - Conversation identifier.
   * @returns {Promise} Axios response with the conversation record.
   */
  show(id) {
    return api.get(`${v1}/messages/conversations/${id}`)
  },
  /**
   * Paginated messages within a conversation.
   * @param {string|number} id - Conversation identifier.
   * @param {object} params - Query params (before_id, pagination).
   * @returns {Promise} Axios response with the message list.
   */
  messages(id, params) {
    return api.get(`${v1}/messages/conversations/${id}/messages`, { params })
  },
  /**
   * Sends a message in a conversation.
   * @param {string|number} id - Conversation identifier.
   * @param {object} data - Message payload (body, attachments, ...).
   * @returns {Promise} Axios response with the created message.
   */
  send(id, data) {
    return api.post(`${v1}/messages/conversations/${id}/messages`, data)
  },
  /**
   * Marks a conversation's messages as read.
   * @param {string|number} id - Conversation identifier.
   * @returns {Promise} Axios response confirming the read receipt.
   */
  markRead(id) {
    return api.post(`${v1}/messages/conversations/${id}/read`)
  },
  /**
   * Searches users to start a conversation with.
   * @param {object} params - Query params (search term).
   * @returns {Promise} Axios response with matching users.
   */
  users(params) {
    return api.get(`${v1}/messages/users`, { params })
  },
  /**
   * Total unread messages across conversations.
   * @returns {Promise} Axios response with the unread count.
   */
  unreadCount() {
    return api.get(`${v1}/messages/unread-count`)
  },
}

/** Staff chat groups, their messages and membership. */
export const groupApi = {
  /**
   * Paginated list of chat groups.
   * @param {object} params - Query params (search, pagination).
   * @returns {Promise} Axios response with the group list.
   */
  index(params) {
    return api.get(`${v1}/messages/groups`, { params })
  },
  /**
   * Creates a new chat group.
   * @param {object} data - Group payload (name, member ids, ...).
   * @returns {Promise} Axios response with the created group.
   */
  store(data) {
    return api.post(`${v1}/messages/groups`, data)
  },
  /**
   * Fetches a single group.
   * @param {string|number} id - Group identifier.
   * @returns {Promise} Axios response with the group record.
   */
  show(id) {
    return api.get(`${v1}/messages/groups/${id}`)
  },
  /**
   * Paginated messages within a group.
   * @param {string|number} id - Group identifier.
   * @param {object} params - Query params (before_id, pagination).
   * @returns {Promise} Axios response with the message list.
   */
  messages(id, params) {
    return api.get(`${v1}/messages/groups/${id}/messages`, { params })
  },
  /**
   * Sends a message in a group.
   * @param {string|number} id - Group identifier.
   * @param {object} data - Message payload (body, attachments, ...).
   * @returns {Promise} Axios response with the created message.
   */
  send(id, data) {
    return api.post(`${v1}/messages/groups/${id}/messages`, data)
  },
  /**
   * Marks a group's messages as read.
   * @param {string|number} id - Group identifier.
   * @returns {Promise} Axios response confirming the read receipt.
   */
  markRead(id) {
    return api.post(`${v1}/messages/groups/${id}/read`)
  },
  /**
   * Adds members to a group.
   * @param {string|number} id - Group identifier.
   * @param {object} data - Member ids payload.
   * @returns {Promise} Axios response with the updated group.
   */
  addMembers(id, data) {
    return api.post(`${v1}/messages/groups/${id}/members`, data)
  },
  /**
   * Removes a member from a group.
   * @param {string|number} id - Group identifier.
   * @param {string|number} userId - User identifier to remove.
   * @returns {Promise} Axios response confirming the removal.
   */
  removeMember(id, userId) {
    return api.delete(`${v1}/messages/groups/${id}/members/${userId}`)
  },
}

/** Message-level actions: deletion, view-once and reactions. */
export const messageActionApi = {
  /**
   * Deletes a message in a 1:1 conversation.
   * @param {string|number} conversationId - Conversation identifier.
   * @param {string|number} messageId - Message identifier.
   * @param {string} scope - Deletion scope (everyone/me).
   * @returns {Promise} Axios response confirming deletion.
   */
  deleteConversationMessage(conversationId, messageId, scope) {
    return api.post(`${v1}/messages/conversations/${conversationId}/messages/${messageId}/delete`, { scope })
  },
  /**
   * Deletes a message in a group.
   * @param {string|number} groupId - Group identifier.
   * @param {string|number} messageId - Message identifier.
   * @param {string} scope - Deletion scope (everyone/me).
   * @returns {Promise} Axios response confirming deletion.
   */
  deleteGroupMessage(groupId, messageId, scope) {
    return api.post(`${v1}/messages/groups/${groupId}/messages/${messageId}/delete`, { scope })
  },
  /**
   * Opens a view-once message in a conversation.
   * @param {string|number} conversationId - Conversation identifier.
   * @param {string|number} messageId - Message identifier.
   * @returns {Promise} Axios response with the view-once content.
   */
  openViewOnce(conversationId, messageId) {
    return api.post(`${v1}/messages/conversations/${conversationId}/messages/${messageId}/view-once`)
  },
  /**
   * Opens a view-once message in a group.
   * @param {string|number} groupId - Group identifier.
   * @param {string|number} messageId - Message identifier.
   * @returns {Promise} Axios response with the view-once content.
   */
  openGroupViewOnce(groupId, messageId) {
    return api.post(`${v1}/messages/groups/${groupId}/messages/${messageId}/view-once`)
  },
  /**
   * Adds or removes a reaction on a message.
   * @param {string} messageType - Message container type (conversation/group).
   * @param {string|number} messageId - Message identifier.
   * @param {string} reaction - Emoji reaction key.
   * @returns {Promise} Axios response with the new reaction state.
   */
  toggleReaction(messageType, messageId, reaction) {
    return api.post(`${v1}/messages/reactions`, { message_type: messageType, message_id: messageId, reaction })
  },
}

/** Ephemeral staff status updates with views and reactions. */
export const statusApi = {
  /**
   * Paginated list of ephemeral status updates.
   * @param {object} params - Query params (pagination, filters).
   * @returns {Promise} Axios response with the status list.
   */
  index(params) {
    return api.get(`${v1}/statuses`, { params })
  },
  /**
   * Posts a new status update.
   * @param {object} data - Status payload (body, media, visibility).
   * @returns {Promise} Axios response with the created status.
   */
  store(data) {
    return api.post(`${v1}/statuses`, data)
  },
  /**
   * Fetches a single status.
   * @param {string|number} id - Status identifier.
   * @returns {Promise} Axios response with the status record.
   */
  show(id) {
    return api.get(`${v1}/statuses/${id}`)
  },
  /**
   * Deletes a status.
   * @param {string|number} id - Status identifier.
   * @returns {Promise} Axios response confirming deletion.
   */
  destroy(id) {
    return api.delete(`${v1}/statuses/${id}`)
  },
  /**
   * Records that a user viewed a status.
   * @param {string|number} id - Status identifier.
   * @returns {Promise} Axios response confirming the view.
   */
  view(id) {
    return api.post(`${v1}/statuses/${id}/view`)
  },
  /**
   * Adds/removes a reaction on a status.
   * @param {string|number} id - Status identifier.
   * @returns {Promise} Axios response with the new reaction state.
   */
  react(id) {
    return api.post(`${v1}/statuses/${id}/react`)
  },
}

/** Messaging extras: pins, stars, polls, search, export, translation and forwarding. */
export const featuresApi = {
  /**
   * Pins a message.
   * @param {object} data - Pin payload (message type + id).
   * @returns {Promise} Axios response confirming the pin.
   */
  pin(data) {
    return api.post(`${v1}/messages/pin`, data)
  },
  /**
   * Unpins a pinned message.
   * @param {object} data - Pin payload (message type + id).
   * @returns {Promise} Axios response confirming the unpin.
   */
  unpin(data) {
    return api.post(`${v1}/messages/unpin`, data)
  },
  /**
   * Stars a message.
   * @param {object} data - Star payload (message type + id).
   * @returns {Promise} Axios response confirming the star.
   */
  star(data) {
    return api.post(`${v1}/messages/star`, data)
  },
  /**
   * Unstars a starred message.
   * @param {object} data - Star payload (message type + id).
   * @returns {Promise} Axios response confirming the unstar.
   */
  unstar(data) {
    return api.post(`${v1}/messages/unstar`, data)
  },
  /**
   * Lists pinned messages.
   * @param {object} params - Query params (scope, pagination).
   * @returns {Promise} Axios response with the pinned message list.
   */
  pinned(params) {
    return api.get(`${v1}/messages/pinned`, { params })
  },
  /**
   * Lists starred messages.
   * @param {object} params - Query params (scope, pagination).
   * @returns {Promise} Axios response with the starred message list.
   */
  starred(params) {
    return api.get(`${v1}/messages/starred`, { params })
  },
  /**
   * Casts a vote in a message poll.
   * @param {object} data - Vote payload (poll id, option id).
   * @returns {Promise} Axios response with the updated poll.
   */
  vote(data) {
    return api.post(`${v1}/messages/polls/vote`, data)
  },
  /**
   * Full-text search across messages.
   * @param {object} params - Query params (query, scope, pagination).
   * @returns {Promise} Axios response with matching messages.
   */
  search(params) {
    return api.get(`${v1}/messages/search`, { params })
  },
  /**
   * Exports messages to a CSV blob.
   * @param {object} params - Query params (scope, filters).
   * @returns {Promise} Axios response with the CSV blob.
   */
  exportCsv(params) {
    return api.get(`${v1}/messages/export`, { params, responseType: 'blob' })
  },
  /**
   * Translates a message into another language.
   * @param {object} data - Translate payload (message type + id, language).
   * @returns {Promise} Axios response with the translation.
   */
  translate(data) {
    return api.post(`${v1}/messages/translate`, data)
  },
  /**
   * Forwards a message to another conversation/group.
   * @param {object} data - Forward payload (message type + id, target).
   * @returns {Promise} Axios response with the forwarded message.
   */
  forward(data) {
    return api.post(`${v1}/messages/forward`, data)
  },
}

/** Reusable message templates. */
export const templateApi = {
  /**
   * Paginated list of message templates.
   * @param {object} params - Query params (search, pagination).
   * @returns {Promise} Axios response with the template list.
   */
  index(params) {
    return api.get(`${v1}/messages/templates`, { params })
  },
  /**
   * Creates a message template.
   * @param {object} data - Template payload (name, body, ...).
   * @returns {Promise} Axios response with the created template.
   */
  store(data) {
    return api.post(`${v1}/messages/templates`, data)
  },
  /**
   * Updates a message template.
   * @param {string|number} id - Template identifier.
   * @param {object} data - Fields to update.
   * @returns {Promise} Axios response with the updated template.
   */
  update(id, data) {
    return api.put(`${v1}/messages/templates/${id}`, data)
  },
  /**
   * Deletes a message template.
   * @param {string|number} id - Template identifier.
   * @returns {Promise} Axios response confirming deletion.
   */
  destroy(id) {
    return api.delete(`${v1}/messages/templates/${id}`)
  },
}

/** Messages scheduled for later delivery. */
export const scheduledApi = {
  /**
   * Lists the current user's scheduled messages.
   * @returns {Promise} Axios response with the scheduled message list.
   */
  index() {
    return api.get(`${v1}/messages/scheduled`)
  },
  /**
   * Schedules a message for a future time.
   * @param {object} data - Schedule payload (body, send_at, target).
   * @returns {Promise} Axios response with the created schedule.
   */
  store(data) {
    return api.post(`${v1}/messages/scheduled`, data)
  },
  /**
   * Cancels a scheduled message.
   * @param {string|number} id - Scheduled message identifier.
   * @returns {Promise} Axios response confirming deletion.
   */
  destroy(id) {
    return api.delete(`${v1}/messages/scheduled/${id}`)
  },
}

/** Announcements with read acknowledgements. */
export const announcementApi = {
  /**
   * Paginated list of announcements.
   * @param {object} params - Query params (pagination, filters).
   * @returns {Promise} Axios response with the announcement list.
   */
  index(params) {
    return api.get(`${v1}/messages/announcements`, { params })
  },
  /**
   * Creates a new announcement.
   * @param {object} data - Announcement payload (title, body, audience).
   * @returns {Promise} Axios response with the created announcement.
   */
  store(data) {
    return api.post(`${v1}/messages/announcements`, data)
  },
  /**
   * Acknowledges having read an announcement.
   * @param {string|number} id - Announcement identifier.
   * @returns {Promise} Axios response confirming the acknowledgement.
   */
  acknowledge(id) {
    return api.post(`${v1}/messages/announcements/${id}/acknowledge`)
  },
}

/** Conversation escalations to higher support levels. */
export const escalationApi = {
  /**
   * Lists open escalations for the current user.
   * @returns {Promise} Axios response with the escalation list.
   */
  index() {
    return api.get(`${v1}/messages/escalations`)
  },
  /**
   * Escalates a conversation to a higher level.
   * @param {object} data - Escalation payload (reason, level, conversation).
   * @returns {Promise} Axios response with the created escalation.
   */
  store(data) {
    return api.post(`${v1}/messages/escalations`, data)
  },
  /**
   * Resolves an escalation.
   * @param {string|number} id - Escalation identifier.
   * @param {object} data - Resolution payload (outcome, note).
   * @returns {Promise} Axios response with the updated escalation.
   */
  resolve(id, data) {
    return api.post(`${v1}/messages/escalations/${id}/resolve`, data)
  },
}

/** Shift handover notes with acknowledgement. */
export const handoverApi = {
  /**
   * Paginated list of shift handover notes.
   * @param {object} params - Query params (shift, pagination).
   * @returns {Promise} Axios response with the handover list.
   */
  index(params) {
    return api.get(`${v1}/messages/handovers`, { params })
  },
  /**
   * Creates a shift handover note.
   * @param {object} data - Handover payload (summary, items, ...).
   * @returns {Promise} Axios response with the created handover.
   */
  store(data) {
    return api.post(`${v1}/messages/handovers`, data)
  },
  /**
   * Acknowledges a handover note as received.
   * @param {string|number} id - Handover identifier.
   * @returns {Promise} Axios response confirming the acknowledgement.
   */
  acknowledge(id) {
    return api.post(`${v1}/messages/handovers/${id}/acknowledge`)
  },
}

/** Per-user messaging preferences. */
export const preferenceApi = {
  /**
   * Lists the current user's messaging preferences.
   * @returns {Promise} Axios response with the preference list.
   */
  index() {
    return api.get(`${v1}/messages/preferences`)
  },
  /**
   * Creates a messaging preference rule.
   * @param {object} data - Preference payload (type, settings).
   * @returns {Promise} Axios response with the created preference.
   */
  store(data) {
    return api.post(`${v1}/messages/preferences`, data)
  },
  /**
   * Updates a messaging preference.
   * @param {string|number} id - Preference identifier.
   * @param {object} data - Fields to update.
   * @returns {Promise} Axios response with the updated preference.
   */
  update(id, data) {
    return api.put(`${v1}/messages/preferences/${id}`, data)
  },
  /**
   * Deletes a messaging preference.
   * @param {string|number} id - Preference identifier.
   * @returns {Promise} Axios response confirming deletion.
   */
  destroy(id) {
    return api.delete(`${v1}/messages/preferences/${id}`)
  },
}

/** Chat retention policies. */
export const retentionApi = {
  /**
   * Lists the chat retention policies.
   * @returns {Promise} Axios response with the policy list.
   */
  index() {
    return api.get(`${v1}/messages/retention-policies`)
  },
  /**
   * Creates a retention policy.
   * @param {object} data - Policy payload (duration, scope).
   * @returns {Promise} Axios response with the created policy.
   */
  store(data) {
    return api.post(`${v1}/messages/retention-policies`, data)
  },
  /**
   * Deletes a retention policy.
   * @param {string|number} id - Policy identifier.
   * @returns {Promise} Axios response confirming deletion.
   */
  destroy(id) {
    return api.delete(`${v1}/messages/retention-policies/${id}`)
  },
}

/** Links between hotel rooms and chats. */
export const roomLinkApi = {
  /**
   * Paginated list of rooms linked to chats.
   * @param {object} params - Query params (pagination, filters).
   * @returns {Promise} Axios response with the room link list.
   */
  index(params) {
    return api.get(`${v1}/messages/rooms`, { params })
  },
  /**
   * Searches rooms to link to a chat.
   * @param {string} search - Room search term.
   * @returns {Promise} Axios response with matching rooms.
   */
  searchRooms(search) {
    return api.get(`${v1}/messages/rooms/search`, { params: { search } })
  },
  /**
   * Links a room to a chat.
   * @param {object} data - Link payload (room id, conversation/group).
   * @returns {Promise} Axios response with the created link.
   */
  store(data) {
    return api.post(`${v1}/messages/rooms`, data)
  },
  /**
   * Unlinks a room from a chat.
   * @param {string|number} id - Room link identifier.
   * @returns {Promise} Axios response confirming the removal.
   */
  destroy(id) {
    return api.delete(`${v1}/messages/rooms/${id}`)
  },
}

/** Tasks created from chat context. */
export const taskGroupApi = {
  /**
   * Creates a task from chat context.
   * @param {object} data - Task payload (title, assignee, due date, ...).
   * @returns {Promise} Axios response with the created task.
   */
  store(data) {
    return api.post(`${v1}/messages/task-groups`, data)
  },
  /**
   * Converts a group message into a task.
   * @param {string|number} groupId - Group identifier.
   * @param {string|number} messageId - Message identifier.
   * @param {object} data - Task payload (title, assignee, ...).
   * @returns {Promise} Axios response with the created task.
   */
  convert(groupId, messageId, data) {
    return api.post(`${v1}/messages/groups/${groupId}/messages/${messageId}/convert-task`, data)
  },
}

/** Staff location sharing and nearby lookup. */
export const staffLocationApi = {
  /**
   * Updates the current user's shared location.
   * @param {object} data - Location payload (lat, lng).
   * @returns {Promise} Axios response confirming the update.
   */
  update(data) {
    return api.put(`${v1}/messages/location`, data)
  },
  /**
   * Lists staff members near a location.
   * @param {object} params - Query params (lat, lng, radius).
   * @returns {Promise} Axios response with nearby staff.
   */
  nearby(params) {
    return api.get(`${v1}/messages/nearby`, { params })
  },
}

/** In-room guest chat messages. */
export const guestMessageApi = {
  /**
   * Paginated list of guest chat messages.
   * @param {object} params - Query params (room, pagination).
   * @returns {Promise} Axios response with the message list.
   */
  index(params) {
    return api.get(`${v1}/messages/guest-messages`, { params })
  },
  /**
   * Sends a message to a guest's in-room chat.
   * @param {object} data - Message payload (room, body).
   * @returns {Promise} Axios response with the created message.
   */
  store(data) {
    return api.post(`${v1}/messages/guest-messages`, data)
  },
}

/** Staff meetings with invites and responses. */
export const meetingApi = {
  /**
   * Paginated list of meetings.
   * @param {object} params - Query params (status, pagination).
   * @returns {Promise} Axios response with the meeting list.
   */
  index(params) {
    return api.get(`${v1}/messages/meetings`, { params })
  },
  /**
   * Schedules a meeting.
   * @param {object} data - Meeting payload (title, time, attendees).
   * @returns {Promise} Axios response with the created meeting.
   */
  store(data) {
    return api.post(`${v1}/messages/meetings`, data)
  },
  /**
   * Accepts or declines a meeting invite.
   * @param {string|number} id - Meeting identifier.
   * @param {string} status - Response (accepted/declined).
   * @returns {Promise} Axios response with the updated meeting.
   */
  respond(id, status) {
    return api.post(`${v1}/messages/meetings/${id}/respond`, { status })
  },
  /**
   * Searches users to invite to a meeting.
   * @param {string} search - User search term.
   * @returns {Promise} Axios response with matching users.
   */
  searchUsers(search) {
    return api.get(`${v1}/messages/meetings/users`, { params: { search } })
  },
}

/** SOS alerts raised by staff. */
export const sosApi = {
  /**
   * Paginated list of SOS alerts.
   * @param {object} params - Query params (status, pagination).
   * @returns {Promise} Axios response with the alert list.
   */
  index(params) {
    return api.get(`${v1}/messages/sos`, { params })
  },
  /**
   * Raises an SOS alert.
   * @param {object} data - Alert payload (location, note).
   * @returns {Promise} Axios response with the created alert.
   */
  initiate(data) {
    return api.post(`${v1}/messages/sos`, data)
  },
  /**
   * Acknowledges an SOS alert as being handled.
   * @param {string|number} id - Alert identifier.
   * @returns {Promise} Axios response with the updated alert.
   */
  acknowledge(id) {
    return api.post(`${v1}/messages/sos/${id}/acknowledge`)
  },
  /**
   * Marks an SOS alert as resolved.
   * @param {string|number} id - Alert identifier.
   * @returns {Promise} Axios response with the updated alert.
   */
  resolve(id) {
    return api.post(`${v1}/messages/sos/${id}/resolve`)
  },
}

/** WebRTC call lifecycle: initiate, signal, accept/decline, end/cancel. */
export const callApi = {
  /**
   * Starts a call to a peer.
   * @param {string} kind - Call kind (audio/video).
   * @param {string|number} calleeId - User identifier being called.
   * @returns {Promise} Axios response with the created call.
   */
  initiate(kind, calleeId) {
    return api.post(`${v1}/calls`, { kind, callee_id: calleeId })
  },
  /**
   * Relays a WebRTC signalling message through the server.
   * @param {string} callId - Call identifier.
   * @param {string} type - Signal type (offer/answer/candidate).
   * @param {object} payload - Signal payload (sdp/candidate).
   * @returns {Promise} Axios response confirming the relay.
   */
  signal(callId, type, payload) {
    return api.post(`${v1}/calls/${callId}/signal`, { type, payload })
  },
  /**
   * Accepts an incoming call.
   * @param {string} callId - Call identifier.
   * @returns {Promise} Axios response with the accepted call.
   */
  accept(callId) {
    return api.post(`${v1}/calls/${callId}/accept`)
  },
  /**
   * Declines an incoming call.
   * @param {string} callId - Call identifier.
   * @returns {Promise} Axios response with the declined call.
   */
  decline(callId) {
    return api.post(`${v1}/calls/${callId}/decline`)
  },
  /**
   * Ends an ongoing call.
   * @param {string} callId - Call identifier.
   * @returns {Promise} Axios response with the ended call.
   */
  end(callId) {
    return api.post(`${v1}/calls/${callId}/end`)
  },
  /**
   * Cancels an outgoing call while still ringing.
   * @param {string} callId - Call identifier.
   * @returns {Promise} Axios response with the cancelled call.
   */
  cancel(callId) {
    return api.post(`${v1}/calls/${callId}/cancel`)
  },
}
