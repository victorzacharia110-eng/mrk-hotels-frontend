<!--
  Staff profile page (route: /app/profile, name: hotel-profile).
  The logged-in user's own account: editable personal info with photo upload,
  read-only system attributes, attendance clock in/out (geofenced + optional
  entrance QR), and — for managers — the rotating clock-in QR and office
  attendance settings for the hotel.
-->
<template>
  <div>
    <div class="page-head">
      <h1>{{ $t('profile.title') }}</h1>
    </div>

    <!-- Account card: avatar summary, editable info and read-only system info -->
    <div class="card">
      <h2 class="card-title"><i class="fas fa-id-card"></i> {{ $t('profile.account') }}</h2>
      <!-- Avatar and summary of the logged-in user pulled from the auth store -->
      <div class="profile-header">
        <div class="avatar">
          <img
            v-if="avatarSrc"
            :src="avatarSrc"
            :alt="form.full_name || authStore.user?.full_name || 'Profile'"
          />
          <span v-else class="avatar-initials">{{ avatarInitials }}</span>
        </div>
        <div class="profile-header-info">
          <span class="profile-name">{{ form.full_name || [form.first_name, form.last_name].filter(Boolean).join(' ') }}</span>
          <span class="profile-sub">{{ authStore.user?.user_role }}</span>
          <span class="badge" :class="authStore.user?.is_active ? 'badge-green' : 'badge-red'">
            {{ authStore.user?.is_active ? $t('profile.active') : $t('profile.inactive') }}
          </span>
        </div>
      </div>

      <p v-if="message" class="alert" :class="error ? 'alert-error' : 'alert-success'">
        {{ message }}
      </p>

      <!-- Editable personal information form -->
      <form @submit.prevent="save">
        <h3 class="form-section-title">
          <i class="fas fa-pen"></i> {{ $t('profile.personalInfo') }}
        </h3>
        <div class="profile-grid profile-form-grid">
          <div class="form-group">
            <label>{{ $t('profile.firstName') }}</label>
            <input v-model="form.first_name" class="input" />
          </div>
          <div class="form-group">
            <label>{{ $t('profile.lastName') }}</label>
            <input v-model="form.last_name" class="input" />
          </div>
          <div class="form-group">
            <label>{{ $t('profile.email') }}</label>
            <input v-model="form.email" type="email" class="input" />
          </div>
          <div class="form-group">
            <label>{{ $t('profile.phone') }}</label>
            <PhoneInput v-model="form.phone" v-model:countryCode="form.country_code" />
          </div>
          <div class="form-group">
            <label>{{ $t('profile.idType') }}</label>
            <select v-model="form.id_type" class="input">
              <option value="">{{ $t('common.none') }}</option>
              <option v-for="opt in idTypeOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
          </div>
          <div class="form-group">
            <label>{{ $t('profile.idNumber') }}</label>
            <input v-model="form.id_number" class="input" />
          </div>
          <div class="form-group">
            <label>{{ $t('profile.position') }}</label>
            <select v-model="form.position" class="input">
              <option value="">{{ $t('common.none') }}</option>
              <option v-for="pos in positionOptions" :key="pos" :value="pos">{{ pos }}</option>
            </select>
          </div>
          <div class="form-group form-full">
            <label>{{ $t('profile.profilePhoto') }}</label>
            <input ref="photoInput" type="file" accept="image/*" class="input" @change="onPhoto" />
            <small v-if="photo" class="muted">{{ photo.name }}</small>
            <button v-if="avatarSrc" type="button" class="btn btn-danger btn-sm" :disabled="saving" @click="removePhoto">
              <i class="fas fa-trash"></i> {{ $t('profile.removePhoto') }}
            </button>
          </div>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary" :disabled="saving">
            <i class="fas fa-save"></i> {{ saving ? $t('common.saving') : $t('common.save') }}
          </button>
        </div>
      </form>

      <!-- Read-only system attributes supplied by the backend, shown for reference -->
      <h3 class="form-section-title"><i class="fas fa-lock"></i> {{ $t('profile.systemInfo') }}</h3>
      <p class="muted">{{ $t('profile.systemInfoHint') }}</p>
      <div class="profile-grid">
        <div class="form-group">
          <label>{{ $t('profile.registrationNumber') }}</label>
          <input :value="authStore.user?.registration_number || '-'" class="input" disabled />
        </div>
        <div class="form-group">
          <label>{{ $t('profile.role') }}</label>
          <input :value="authStore.user?.user_role || '-'" class="input" disabled />
        </div>
        <div class="form-group">
          <label>{{ $t('profile.roleLevel') }}</label>
          <input :value="authStore.user?.role_level ?? '-'" class="input" disabled />
        </div>
        <div class="form-group">
          <label>{{ $t('common.department') }}</label>
          <input :value="authStore.user?.department || '-'" class="input" disabled />
        </div>
        <div class="form-group">
          <label>{{ $t('profile.hotel') }}</label>
          <input :value="authStore.user?.tenant?.hotel_name || '-'" class="input" disabled />
        </div>
        <div class="form-group">
          <label>{{ $t('profile.subManager') }}</label>
          <input
            :value="authStore.user?.is_sub_manager ? $t('profile.yes') : $t('profile.no')"
            class="input"
            disabled
          />
        </div>
        <div class="form-group">
          <label>{{ $t('profile.lastLogin') }}</label>
          <input :value="formatDateTime(authStore.user?.last_login)" class="input" disabled />
        </div>
        <div class="form-group">
          <label>{{ $t('profile.memberSince') }}</label>
          <input :value="formatDate(authStore.user?.created_at)" class="input" disabled />
        </div>
      </div>
    </div>

    <!-- Attendance card: current shift state with clock in/out actions -->
    <div class="card">
      <h2 class="card-title"><i class="fas fa-user-clock"></i> {{ $t('attendance.title') }}</h2>
      <div v-if="attendanceError" class="alert alert-error">{{ attendanceError }}</div>
      <div class="attendance-row">
        <div class="attendance-state">
          <span class="badge" :class="onShift ? 'badge-green' : 'badge-red'">
            {{ onShift ? $t('attendance.onShift') : $t('attendance.offShift') }}
          </span>
          <span v-if="clockInAt" class="muted"
            >{{ $t('attendance.since') }} {{ formatDateTime(clockInAt) }}</span
          >
        </div>
        <button v-if="onShift" class="btn btn-danger" :disabled="acting" @click="handleClockOut">
          <i class="fas fa-right-from-bracket"></i> {{ $t('attendance.clockOut') }}
        </button>
        <button v-else class="btn btn-primary" :disabled="acting" @click="handleClockIn">
          <i class="fas fa-right-to-bracket"></i> {{ $t('attendance.clockIn') }}
        </button>
      </div>
      <p v-if="!onShift && requirements.office_configured" class="muted attendance-hint">
        {{
          requirements.requires_qr
            ? $t('attendance.clockInHint')
            : $t('attendance.officeSettingsHint')
        }}
      </p>

      <!-- Absence claim: sick/emergency excuse filed with evidence -->
      <div class="absence-claim">
        <h3 class="form-section-title">
          <i class="fas fa-notes-medical"></i> {{ $t('attendance.absenceTitle') }}
        </h3>
        <p class="muted attendance-hint">{{ $t('attendance.absenceHint') }}</p>
        <div v-if="absenceError" class="alert alert-error">{{ absenceError }}</div>
        <div v-if="absenceMessage" class="alert alert-success">{{ absenceMessage }}</div>
        <form @submit.prevent="submitAbsence">
          <div class="absence-grid">
            <select v-model="absenceForm.type" class="input">
              <option value="sick">{{ $t('attendance.absenceSick') }}</option>
              <option value="emergency">{{ $t('attendance.absenceEmergency') }}</option>
              <option value="transport">{{ $t('attendance.absenceTransport') }}</option>
              <option value="family">{{ $t('attendance.absenceFamily') }}</option>
              <option value="other">{{ $t('attendance.absenceOther') }}</option>
            </select>
            <input v-model="absenceForm.startsAt" type="date" class="input" />
            <input v-model="absenceForm.endsAt" type="date" class="input" />
          </div>
          <input
            v-model="absenceForm.reason"
            type="text"
            class="input"
            :placeholder="$t('attendance.absenceReasonPlaceholder')"
          />
          <input
            ref="absenceFilesInput"
            type="file"
            multiple
            accept="image/jpeg,image/png,application/pdf"
            class="input"
            @change="onAbsenceFiles"
          />
          <button class="btn btn-primary" type="submit" :disabled="absenceSaving">
            <i class="fas fa-paper-plane"></i>
            {{ absenceSaving ? $t('common.saving') : $t('attendance.absenceSubmit') }}
          </button>
        </form>
        <ul v-if="myAbsences.length" class="security-list">
          <li v-for="a in myAbsences" :key="a.request_id">
            <div>
              <strong>{{ absenceTypeLabel(a.absence_type) }}</strong>
              <span class="muted"
                >{{ formatDate(a.starts_at) }} &rarr; {{ formatDate(a.ends_at) }}</span
              >
              <span v-if="a.suspicious" class="badge badge-warning">{{
                suspicionLabels(a.suspicion_reasons).join(', ')
              }}</span>
            </div>
            <em class="badge" :class="statusBadge(a.status)">{{ statusLabel(a.status) }}</em>
          </li>
        </ul>
      </div>
    </div>

    <!-- Clock-in QR scanner modal, opened when the entrance QR is required -->
    <AttendanceQrScanner v-if="showScanner" @scanned="onScanned" @close="onScannerClose" />

    <!-- Clock-in selfie modal, opened when the hotel requires photo proof -->
    <AttendanceSelfieCapture
      v-if="showSelfie"
      @captured="onSelfieCaptured"
      @close="onSelfieClose"
    />

    <!-- Rotating clock-in QR, shown to managers for display at the entrance -->
    <div v-if="canManageQr" class="card">
      <h2 class="card-title"><i class="fas fa-qrcode"></i> {{ $t('attendance.officeQr') }}</h2>
      <p class="muted">{{ $t('attendance.officeQrHint') }}</p>
      <div class="qr-layout">
        <div class="qr-frame">
          <canvas v-if="qrToken" ref="qrCanvasEl" class="qr-canvas"></canvas>
          <div v-else class="qr-loading"><i class="fas fa-spinner fa-spin"></i></div>
        </div>
        <div class="qr-meta">
          <div class="qr-countdown" :class="qrCountdown <= 10 ? 'qr-countdown-urgent' : ''">
            <i class="fas fa-rotate"></i> {{ $t('attendance.qrExpiresIn', { s: qrCountdown }) }}
          </div>
          <button class="btn btn-secondary" :disabled="qrLoading" @click="issueQr">
            <i class="fas fa-arrows-rotate"></i> {{ $t('attendance.refresh') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Office attendance settings, editable by the hotel admin -->
    <div v-if="canManageSettings" class="card">
      <h2 class="card-title">
        <i class="fas fa-location-dot"></i> {{ $t('attendance.officeSettings') }}
      </h2>
      <p class="muted">{{ $t('attendance.officeSettingsHint') }}</p>
      <div v-if="settingsError" class="alert alert-error">{{ settingsError }}</div>
      <div v-if="settingsMessage" class="alert alert-success">{{ settingsMessage }}</div>
      <form @submit.prevent="saveSettings">
        <div class="profile-grid">
          <div class="form-group">
            <label>{{ $t('attendance.officeLat') }}</label>
            <input v-model.number="settings.lat" type="number" step="any" class="input" />
          </div>
          <div class="form-group">
            <label>{{ $t('attendance.officeLng') }}</label>
            <input v-model.number="settings.lng" type="number" step="any" class="input" />
          </div>
          <div class="form-group">
            <label>{{ $t('attendance.officeRadius') }}</label>
            <input
              v-model.number="settings.radius"
              type="number"
              min="50"
              max="5000"
              class="input"
            />
          </div>
          <div class="form-group">
            <label class="check-label">
              <input v-model="settings.qrEnabled" type="checkbox" class="input-check" />
              {{ $t('attendance.qrEnabled') }}
            </label>
          </div>
          <div class="form-group">
            <label class="check-label">
              <input v-model="settings.photoRequired" type="checkbox" class="input-check" />
              {{ $t('attendance.photoEnabled') }}
            </label>
          </div>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary" :disabled="savingSettings">
            <i class="fas fa-save"></i>
            {{ savingSettings ? $t('common.saving') : $t('common.save') }}
          </button>
        </div>
      </form>
    </div>

    <!-- Session / PIN inactivity — editable by managers and owners (level 80+) -->
    <div v-if="canManageHotel" class="card">
      <h2 class="card-title">
        <i class="fas fa-lock"></i> {{ $t('sessionSettings.title') }}
      </h2>
      <p class="muted">{{ $t('sessionSettings.hint') }}</p>
      <div v-if="sessionSettingsError" class="alert alert-error">{{ sessionSettingsError }}</div>
      <div v-if="sessionSettingsSuccess" class="alert alert-success">{{ sessionSettingsSuccess }}</div>
      <form @submit.prevent="saveSessionSettings">
        <div class="profile-grid">
          <div class="form-group">
            <label>{{ $t('sessionSettings.idleTimeoutLabel') }}</label>
            <div class="input-row" style="display:flex; align-items:center; gap:8px; max-width: 260px;">
              <input
                v-model.number="sessionSettingsDraft.idleTimeoutMinutes"
                type="number"
                min="1"
                max="120"
                class="input"
              />
              <span class="muted">{{ $t('sessionSettings.minutes') }}</span>
            </div>
            <small class="muted">{{ $t('sessionSettings.idleTimeoutHint') }}</small>
          </div>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary" :disabled="savingSessionSettings">
            <i class="fas fa-save"></i>
            {{ savingSessionSettings ? $t('common.saving') : $t('common.save') }}
          </button>
        </div>
      </form>
    </div>

    <!-- Hotel business details — editable by managers and owners (level 80+) -->
    <div v-if="canManageHotel" class="card">
      <h2 class="card-title">
        <i class="fas fa-building"></i> {{ $t('hotelSettings.title') }}
      </h2>
      <p class="muted">{{ $t('hotelSettings.hint') }}</p>
      <div v-if="hotelSettingsError" class="alert alert-error">{{ hotelSettingsError }}</div>
      <div v-if="hotelSettingsSuccess" class="alert alert-success">{{ hotelSettingsSuccess }}</div>
      <form @submit.prevent="saveHotelSettings">
        <div class="profile-grid narrow-inputs">
          <div class="form-group">
            <label>{{ $t('hotelSettings.hotelName') }}</label>
            <input v-model.trim="hotelForm.hotel_name" type="text" class="input" required />
          </div>
          <div class="form-group">
            <label>{{ $t('hotelSettings.registrationCode') }}</label>
            <div class="static-value mono">{{ hotelForm.registration_code || '—' }}</div>
            <small class="muted">{{ $t('hotelSettings.registrationHint', '6-digit property code generated by the superadmin.') }}</small>
          </div>
          <div class="form-group">
            <label>{{ $t('hotelSettings.contactPerson') }}</label>
            <input v-model.trim="hotelForm.contact_person" type="text" class="input" />
          </div>
          <div class="form-group">
            <label>{{ $t('hotelSettings.email') }}</label>
            <input v-model.trim="hotelForm.email" type="email" class="input" />
          </div>
          <div class="form-group">
            <label>{{ $t('hotelSettings.phone') }}</label>
            <input v-model.trim="hotelForm.phone" type="text" class="input" />
          </div>
          <div class="form-group">
            <label>{{ $t('hotelSettings.city') }}</label>
            <input v-model.trim="hotelForm.city" type="text" class="input" />
          </div>
          <div class="form-group">
            <label>{{ $t('hotelSettings.country') }}</label>
            <input v-model.trim="hotelForm.country" type="text" class="input" />
          </div>
          <div class="form-group">
            <label>{{ $t('hotelSettings.addressCoordinates', 'Coordinates') }}</label>
            <input v-model.trim="hotelForm.address_coordinates" type="text" class="input" placeholder="e.g. -6.7924, 39.2083" />
          </div>
          <div class="form-group">
            <label>{{ $t('hotelSettings.addressPoBox', 'P.O. Box') }}</label>
            <input v-model.trim="hotelForm.address_po_box" type="text" class="input" placeholder="P.O. Box" />
          </div>
          <div class="form-group form-full">
            <label>{{ $t('hotelSettings.addressStreet', 'Street address') }}</label>
            <input v-model.trim="hotelForm.address_street" type="text" class="input" placeholder="Street address" />
          </div>
          <div class="form-group">
            <label>TIN</label>
            <input v-model.trim="hotelForm.tin" type="text" class="input" placeholder="Taxpayer Identification Number" />
          </div>
          <div class="form-group">
            <label>VRN</label>
            <input v-model.trim="hotelForm.vrn" type="text" class="input" placeholder="VAT Registration Number" />
          </div>
        </div>

        <div class="hotel-subsection">
          <div class="hotel-subsection-head">
            <div>
              <h3 class="card-subtitle">{{ $t('hotelSettings.acceptedMethods') }}</h3>
              <p class="muted">{{ $t('hotelSettings.methodsHint', 'Add custom payment methods (name and description).') }}</p>
            </div>
            <button type="button" class="btn btn-secondary btn-sm" @click="addMethod">
              <i class="fas fa-plus"></i> {{ $t('hotelSettings.addMethod', 'Add method') }}
            </button>
          </div>
          <div v-if="hotelForm.payment_methods.length" class="custom-list">
            <div v-for="(method, idx) in hotelForm.payment_methods" :key="method._id || idx" class="custom-row method-row">
              <label class="checkbox-label compact-check">
                <input type="checkbox" v-model="method.enabled" />
                {{ $t('hotelSettings.enabled', 'Enabled') }}
              </label>
              <div class="form-group">
                <label>{{ $t('common.name', 'Name') }}</label>
                <input v-model.trim="method.label" type="text" class="input" placeholder="e.g. CASH, MOBILE MONEY" @input="syncMethodValue(method)" />
              </div>
              <div class="form-group">
                <label>{{ $t('common.description', 'Description') }}</label>
                <input v-model.trim="method.description" type="text" class="input" placeholder="Description" />
              </div>
              <button type="button" class="btn btn-danger btn-sm icon-btn" @click="removeMethod(idx)" :title="$t('common.remove', 'Remove')">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
          <p v-else class="muted">{{ $t('hotelSettings.noMethods', 'No payment methods configured.') }}</p>
        </div>

        <div class="hotel-subsection">
          <div class="hotel-subsection-head">
            <div>
              <h3 class="card-subtitle">{{ $t('hotelSettings.providersAccounts', 'Payment Providers & Accounts') }}</h3>
              <p class="muted">{{ $t('hotelSettings.providersHint', 'Add provider/account details and link each to a registered payment method.') }}</p>
            </div>
            <button type="button" class="btn btn-secondary btn-sm" @click="addProviderAccount">
              <i class="fas fa-plus"></i> {{ $t('hotelSettings.addProvider', 'Add provider') }}
            </button>
          </div>
          <div v-if="hotelForm.payment_accounts_list.length" class="custom-list">
            <div v-for="(acc, idx) in hotelForm.payment_accounts_list" :key="acc._id || idx" class="custom-row provider-row">
              <div class="form-group">
                <label>{{ $t('common.name', 'Name') }}</label>
                <input v-model.trim="acc.provider_name" type="text" class="input" placeholder="Provider name" @input="syncAccountKey(acc)" />
              </div>
              <div class="form-group">
                <label>{{ $t('hotelSettings.accountPlaceholder') }}</label>
                <input v-model.trim="acc.number" type="text" class="input" :placeholder="$t('hotelSettings.accountPlaceholder')" />
              </div>
              <div class="form-group">
                <label>{{ $t('hotelSettings.linkedMethod', 'Payment method') }}</label>
                <select v-model="acc.method" class="input">
                  <option value="">{{ $t('common.select', 'Select') }}</option>
                  <option v-for="m in enabledMethodOptions" :key="m.value" :value="m.value">{{ m.label }}</option>
                </select>
              </div>
              <div class="form-group">
                <label>{{ $t('hotelSettings.lipaNumberLabel') }}</label>
                <input v-model.trim="acc.lipa_number" type="text" class="input" :placeholder="$t('hotelSettings.lipaNumberPlaceholder')" />
              </div>
              <div class="form-group">
                <label>{{ $t('hotelSettings.receiverNameLabel') }}</label>
                <input v-model.trim="acc.name" type="text" class="input" :placeholder="$t('hotelSettings.receiverNamePlaceholder')" />
              </div>
              <button type="button" class="btn btn-danger btn-sm icon-btn" @click="removeProviderAccount(idx)" :title="$t('common.remove', 'Remove')">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
          <p v-else class="muted">{{ $t('hotelSettings.noProviders', 'No payment provider accounts configured.') }}</p>
        </div>

        <div class="form-actions">
          <button type="submit" class="btn btn-primary" :disabled="savingHotelSettings">
            <i class="fas fa-check"></i>
            {{ savingHotelSettings ? $t('common.saving') : $t('common.save') }}
          </button>
        </div>
      </form>
    </div>

    <!-- Attendance security oversight, visible to managers -->
    <div v-if="canManageSecurity" class="card">
      <h2 class="card-title">
        <i class="fas fa-shield-halved"></i> {{ $t('attendance.securityTitle') }}
      </h2>
      <p class="muted">{{ $t('attendance.securityHint') }}</p>
      <div v-if="securityError" class="alert alert-error">{{ securityError }}</div>

      <div class="security-block">
        <div class="security-subtitle-row">
          <h3 class="security-subtitle">{{ $t('attendance.devicesTitle') }}</h3>
          <TableExportButton
            filename="attendance-devices"
            :title="$t('attendance.devicesTitle')"
            :rows="security.devices"
          />
        </div>
        <div class="table-scroll">
        <table class="security-table">
          <thead>
            <tr>
              <th scope="col">{{ $t('attendance.deviceStaff') }}</th>
              <th scope="col">{{ $t('attendance.deviceName') }}</th>
              <th scope="col">{{ $t('attendance.deviceLastSeen') }}</th>
              <th scope="col"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="d in security.devices" :key="d.device_row_id">
              <td>{{ d.user?.full_name || '—' }}</td>
              <td>
                {{ d.device_name || d.device_id }}
                <span v-if="d.revoked" class="badge badge-danger">{{
                  $t('attendance.revoked')
                }}</span>
              </td>
              <td>{{ formatDateTime(d.last_seen_at) }}</td>
              <td class="security-actions">
                <button
                  v-if="!d.revoked"
                  class="btn btn-sm btn-danger"
                  @click="revokeDevice(d.device_row_id)"
                >
                  {{ $t('attendance.revoke') }}
                </button>
              </td>
            </tr>
            <tr v-if="!security.devices.length">
              <td colspan="4" class="muted">{{ $t('attendance.noDevices') }}</td>
            </tr>
          </tbody>
        </table>
        </div>
      </div>

      <div class="security-block">
        <h3 class="security-subtitle">{{ $t('attendance.suspiciousTitle') }}</h3>
        <ul class="security-list">
          <li v-for="r in security.suspicious" :key="r.attendance_id">
            <div>
              <strong>{{ r.user?.full_name || '—' }}</strong>
              <span class="muted">{{ formatDateTime(r.clock_in_at) }}</span>
            </div>
            <em class="badge badge-warning">{{
              suspicionLabels(r.suspicion_reasons).join(', ')
            }}</em>
          </li>
          <li v-if="!security.suspicious.length" class="muted">
            {{ $t('attendance.noSuspicious') }}
          </li>
        </ul>
      </div>

      <div class="security-block">
        <h3 class="security-subtitle">
          <i class="fas fa-file-medical"></i> {{ $t('attendance.absenceClaimsTitle') }}
        </h3>
        <div v-if="claimsError" class="alert alert-error">{{ claimsError }}</div>
        <ul class="security-list">
          <li v-for="c in absenceClaims" :key="c.request_id">
            <div>
              <strong>{{ c.user?.full_name || '—' }}</strong>
              <span class="muted">
                {{ absenceTypeLabel(c.absence_type) }} &middot; {{ formatDate(c.starts_at) }} &rarr;
                {{ formatDate(c.ends_at) }}
              </span>
              <span class="muted"
                >{{ $t('attendance.absenceClaimedAt') }} {{ formatDateTime(c.submitted_at) }}</span
              >
              <span v-if="c.suspicious" class="badge badge-warning">{{
                suspicionLabels(c.suspicion_reasons).join(', ')
              }}</span>
              <span v-if="c.attachments?.length" class="badge">
                <i class="fas fa-paperclip"></i> {{ c.attachments.length }}
                <span class="muted">{{ $t('attendance.absenceEvidenceHashed') }}</span>
              </span>
              <button
                v-if="c.attachments?.length"
                class="btn-link"
                type="button"
                @click="viewEvidence(c.attachments[0].attachment_id)"
              >
                <i class="fas fa-paperclip"></i> {{ $t('attendance.openEvidence') }}
              </button>
            </div>
            <div class="claim-actions">
              <em class="badge" :class="statusBadge(c.status)">{{ statusLabel(c.status) }}</em>
              <template v-if="c.status === 'pending'">
                <button
                  class="btn btn-sm btn-primary"
                  :disabled="decidingClaim"
                  @click="decideAbsence(c.request_id, 'approve')"
                >
                  {{ $t('attendance.absenceApprove') }}
                </button>
                <button
                  class="btn btn-sm btn-danger"
                  :disabled="decidingClaim"
                  @click="decideAbsence(c.request_id, 'reject')"
                >
                  {{ $t('attendance.absenceReject') }}
                </button>
              </template>
            </div>
          </li>
          <li v-if="!absenceClaims.length" class="muted">{{ $t('attendance.noAbsenceClaims') }}</li>
        </ul>
      </div>
    </div>

    <!-- Password change section delegated to a shared form component.
         Panel roles (waiter/cashier/kitchen) have no password-change
         privilege — the API refuses them too, so the card stays hidden. -->
    <div v-if="canChangePassword" class="card">
      <h2 class="card-title">{{ $t('profile.changePassword') }}</h2>
      <ChangePasswordForm />
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import QRCode from 'qrcode'
import { useAuthStore } from '@/stores/auth'
import { avatarUrl } from '@/utils/format'
import { useSessionSettingsStore } from '@/stores/sessionSettings'
import { attendanceApi, authApi, hotelSettingsApi } from '@/api'
import ChangePasswordForm from '@/components/ChangePasswordForm.vue'
import PhoneInput from '@/components/PhoneInput.vue'
import AttendanceQrScanner from '@/components/AttendanceQrScanner.vue'
import AttendanceSelfieCapture from '@/components/AttendanceSelfieCapture.vue'
import TableExportButton from '@/components/TableExportButton.vue'
import {
  getDeviceId,
  getDeviceFingerprint,
  getDeviceSecret,
  setDeviceSecret,
  clearDeviceSecret,
} from '@/utils/device'

const { t, te } = useI18n()
const authStore = useAuthStore()

// Attendance section state: shift status, clock-in time, in-flight flag and errors.
const onShift = ref(false)
const clockInAt = ref(null)
const acting = ref(false)
const attendanceError = ref('')
const requirements = reactive({
  office_configured: false,
  requires_location: false,
  requires_qr: false,
  requires_photo: false,
  device_policy: 'off',
  device_registered: true,
})
const showScanner = ref(false)
let qrResolve = null

// Clock-in selfie state (required when the hotel asks for photo proof).
const showSelfie = ref(false)
let selfieResolve = null

// Manager security oversight: registered devices + suspicious clock-ins.
const security = reactive({ devices: [], suspicious: [], loading: false })
const securityError = ref('')

// Absence claim state: the staff form plus the manager verification ledger.
const absenceForm = reactive({ type: 'sick', startsAt: '', endsAt: '', reason: '' })
const absenceFiles = ref([])
const absenceFilesInput = ref(null)
const absenceSaving = ref(false)
const absenceError = ref('')
const absenceMessage = ref('')
const myAbsences = ref([])
const absenceClaims = ref([])
const claimsError = ref('')
const decidingClaim = ref(false)

// Rotating office QR state (managers).
const qrToken = ref('')
const qrCountdown = ref(0)
const qrLoading = ref(false)
const qrCanvasEl = ref(null)
let qrTimer = 0

// Office attendance settings state (hotel admin).
const settings = reactive({
  lat: null,
  lng: null,
  radius: 100,
  qrEnabled: false,
  photoRequired: false,
})
const savingSettings = ref(false)
const settingsError = ref('')
const settingsMessage = ref('')

// Session / idle-timeout settings (defaults to 15 minutes per the review).
const sessionSettingsStore = useSessionSettingsStore()
const sessionSettingsDraft = ref({ idleTimeoutMinutes: sessionSettingsStore.idleTimeoutMinutes })
const savingSessionSettings = ref(false)
const sessionSettingsError = ref('')
const sessionSettingsSuccess = ref('')

function saveSessionSettings() {
  savingSessionSettings.value = true
  sessionSettingsError.value = ''
  sessionSettingsSuccess.value = ''
  try {
    sessionSettingsStore.saveSettings({ idleTimeoutMinutes: sessionSettingsDraft.value.idleTimeoutMinutes })
    sessionSettingsDraft.value.idleTimeoutMinutes = sessionSettingsStore.idleTimeoutMinutes
    sessionSettingsSuccess.value = sessionSettingsDraft.value.idleTimeoutMinutes
      ? t('sessionSettings.saved', { minutes: sessionSettingsStore.idleTimeoutMinutes })
      : t('common.updateSuccess')
  } catch {
    sessionSettingsError.value = t('common.error')
  } finally {
    savingSessionSettings.value = false
  }
}

// Only managers and above mint the entrance QR; only hotel admins edit the fence.
const canManageQr = computed(() => authStore.can(80))
const canManageSettings = computed(() => authStore.can(90))
const canManageSecurity = computed(() => authStore.can(80))
const canManageHotel = computed(() => authStore.can(80))
// Waiter/cashier/kitchen panels may not rotate their own passwords — their
// credentials are issued and rotated by a manager (the API returns 403).
const canChangePassword = computed(() => !['waiter', 'cashier', 'kitchen'].includes(authStore.user?.user_role))

// Hotel business details form state (aligned with hotel settings contract).
function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}
function slugify(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}
function parseAddress(raw) {
  if (raw && typeof raw === 'object') {
    return {
      coordinates: raw.coordinates || raw.coords || '',
      po_box: raw.po_box || raw.pobox || raw.poBox || '',
      street: raw.street || raw.street_address || raw.streetAddress || raw.address || '',
    }
  }
  const text = String(raw || '').trim()
  if (!text) return { coordinates: '', po_box: '', street: '' }
  try {
    const parsed = JSON.parse(text)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parseAddress(parsed)
  } catch {
    return { coordinates: '', po_box: '', street: text }
  }
  return { coordinates: '', po_box: '', street: text }
}
function serializeAddress() {
  const payload = {
    coordinates: (hotelForm.address_coordinates || '').trim(),
    po_box: (hotelForm.address_po_box || '').trim(),
    street: (hotelForm.address_street || '').trim(),
  }
  if (!payload.coordinates && !payload.po_box && !payload.street) return ''
  return JSON.stringify(payload)
}
const DEFAULT_METHODS = [
  { value: 'cash', label: 'CASH', description: '' },
  { value: 'mobile_money', label: 'MOBILE MONEY', description: '' },
  { value: 'bank', label: 'BANKs', description: '' },
  { value: 'card', label: 'CARD', description: '' },
  { value: 'digital_wallets', label: 'DIGITAL WALLETS', description: '' },
]
function normalizeMethodEntry(entry) {
  if (typeof entry === 'string') {
    const value = slugify(entry) || entry
    return { _id: uid('m'), enabled: true, value, label: entry.toUpperCase?.() || entry, description: '' }
  }
  if (entry && typeof entry === 'object') {
    const label = String(entry.label || entry.name || entry.value || entry.key || '').trim()
    const value = slugify(entry.value || entry.key || label)
    return { _id: uid('m'), enabled: entry.enabled !== false, value: value || label || uid('method'), label: label || value || 'METHOD', description: String(entry.description || '').trim() }
  }
  return null
}
function normalizeMethods(methods) {
  const list = Array.isArray(methods) ? methods : []
  const out = []
  const seen = new Set()
  for (const item of list) {
    const m = normalizeMethodEntry(item)
    if (!m) continue
    const key = slugify(m.value || m.label)
    if (!key || seen.has(key)) continue
    seen.add(key); m.value = key; out.push(m)
  }
  if (!out.length) return DEFAULT_METHODS.map((m) => ({ _id: uid('m'), enabled: true, ...m }))
  return out
}
function normalizeAccountsList(accounts) {
  const list = []
  if (Array.isArray(accounts)) {
    for (const a of accounts) {
      if (!a || typeof a !== 'object') continue
      const key = String(a.key || a.provider || slugify(a.provider_name || a.name || '')).trim()
      list.push({ _id: uid('a'), key: key || uid('provider'), provider_name: String(a.provider_name || a.name || a.provider || a.key || '').trim(), number: String(a.number || a.account_number || '').trim(), lipa_number: String(a.lipa_number || '').trim(), name: String(a.name || a.receiver_name || '').trim(), method: String(a.method || a.payment_method || '').trim(), description: String(a.description || '').trim() })
    }
    return list
  }
  if (accounts && typeof accounts === 'object') {
    for (const [key, value] of Object.entries(accounts)) {
      if (!value) continue
      if (typeof value === 'string') {
        list.push({ _id: uid('a'), key, provider_name: key.replace(/_/g, ' ').toUpperCase(), number: value, lipa_number: '', name: '', method: '', description: '' })
        continue
      }
      if (typeof value === 'object') {
        list.push({ _id: uid('a'), key: String(key), provider_name: String(value.provider_name || key.replace(/_/g, ' ').toUpperCase()).trim(), number: String(value.number || '').trim(), lipa_number: String(value.lipa_number || '').trim(), name: String(value.name || '').trim(), method: String(value.method || value.payment_method || '').trim(), description: String(value.description || '').trim() })
      }
    }
  }
  return list
}

const hotelForm = reactive({
  hotel_name: '',
  registration_code: '',
  contact_person: '',
  email: '',
  phone: '',
  address_coordinates: '',
  address_po_box: '',
  address_street: '',
  city: '',
  country: '',
  tin: '',
  vrn: '',
  payment_methods: DEFAULT_METHODS.map((m) => ({ _id: uid('m'), enabled: true, ...m })),
  payment_accounts_list: [],
})
const savingHotelSettings = ref(false)
const hotelSettingsError = ref('')
const hotelSettingsSuccess = ref('')

const enabledMethodOptions = computed(() =>
  (hotelForm.payment_methods || []).filter((m) => m.enabled && (m.label || m.value)).map((m) => ({ value: slugify(m.value || m.label), label: m.label || m.value }))
)
function addMethod() { hotelForm.payment_methods.push({ _id: uid('m'), enabled: true, value: '', label: '', description: '' }) }
function removeMethod(idx) { hotelForm.payment_methods.splice(idx, 1) }
function syncMethodValue(method) { if (!method._touchedValue) method.value = slugify(method.label) }
function addProviderAccount() { hotelForm.payment_accounts_list.push({ _id: uid('a'), key: '', provider_name: '', number: '', lipa_number: '', name: '', method: enabledMethodOptions.value[0]?.value || '', description: '' }) }
function removeProviderAccount(idx) { hotelForm.payment_accounts_list.splice(idx, 1) }
function syncAccountKey(acc) { if (!acc._touchedKey) acc.key = slugify(acc.provider_name) || uid('provider') }
function serializeMethods() {
  const out = []; const seen = new Set()
  for (const m of hotelForm.payment_methods) {
    const label = String(m.label || '').trim()
    const value = slugify(m.value || label)
    if (!label && !value) continue
    const key = value || slugify(label)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push({ value: key, label: label || key.toUpperCase(), description: String(m.description || '').trim(), enabled: !!m.enabled })
  }
  return out.filter((m) => m.enabled).map((m) => ({ value: m.value, label: m.label, description: m.description }))
}
function serializeAccounts() {
  const out = {}
  for (const acc of hotelForm.payment_accounts_list) {
    const providerName = String(acc.provider_name || '').trim()
    const key = slugify(acc.key || providerName)
    const number = String(acc.number || '').trim()
    const lipa = String(acc.lipa_number || '').trim()
    const receiver = String(acc.name || '').trim()
    const method = String(acc.method || '').trim()
    const description = String(acc.description || '').trim()
    if (!key && !providerName && !number && !lipa && !receiver && !method) continue
    const finalKey = key || uid('provider')
    const entry = {}
    if (number) entry.number = number
    if (lipa) entry.lipa_number = lipa
    if (receiver) entry.name = receiver
    if (providerName) entry.provider_name = providerName
    if (method) entry.method = method
    if (description) entry.description = description
    if (Object.keys(entry).length) out[finalKey] = entry
  }
  return out
}
// Profile form config: allowed ID types and the editable fields.
const idTypeOptions = computed(() => [
  { value: 'national_id', label: t('profile.idTypes.national_id') },
  { value: 'passport', label: t('profile.idTypes.passport') },
  { value: 'drivers_license', label: t('profile.idTypes.drivers_license') },
])
const positionOptions = [
  'Hotel Admin',
  'Manager',
  'Accountant',
  'Receptionist',
  'Cashier',
  'Bartender',
  'Waiter',
  'Kitchen',
  'Housekeeping',
  'Store Manager',
  'Director',
  'Supervisor',
]
const form = reactive({
  first_name: '',
  last_name: '',
  full_name: '',
  email: '',
  phone: '',
  country_code: '',
  id_type: '',
  id_number: '',
  position: '',
})
// Save state: optional photo file, in-flight flag and feedback message.
const photo = ref(null)
const photoInput = ref(null)
const photoPreview = ref('')
const saving = ref(false)
const message = ref('')
const error = ref(false)

const avatarSrc = computed(() => photoPreview.value || avatarUrl(authStore.user?.profile_picture))
const avatarInitials = computed(() => {
  const parts = [form.first_name || authStore.user?.first_name, form.last_name || authStore.user?.last_name].filter(Boolean)
  const initials = parts.map((p) => String(p)[0]?.toUpperCase() || '').join('').slice(0, 2)
  return initials || 'U'
})

/** Copies the current user's data from the auth store into the editable form. */
function fillForm() {
  const u = authStore.user || {}
  form.first_name = u.first_name || ''
  form.last_name = u.last_name || ''
  form.full_name = u.full_name || ''
  form.email = u.email || ''
  form.phone = u.phone || ''
  form.country_code = u.country_code || ''
  form.id_type = u.id_type || ''
  form.id_number = u.id_number || ''
  form.position = u.position || ''
}

/** Stores the photo file picked in the file input. */
function onPhoto(event) {
  photo.value = event.target.files?.[0] || null
  if (photoPreview.value) URL.revokeObjectURL(photoPreview.value)
  photoPreview.value = photo.value ? URL.createObjectURL(photo.value) : ''
}

async function removePhoto() {
  saving.value = true
  message.value = ''
  error.value = false
  try {
    const fd = new FormData()
    fd.append('remove_profile_picture', '1')

    const { data } = await authApi.updateProfile(fd)
    authStore.user = data.user
    await authStore.fetchProfile().catch(() => {})
    photo.value = null
    if (photoInput.value) photoInput.value.value = ''
    if (photoPreview.value) URL.revokeObjectURL(photoPreview.value)
    photoPreview.value = ''
    message.value = t('profile.photoRemoved')
  } catch (err) {
    error.value = true
    message.value = flattenError(err)
  } finally {
    saving.value = false
  }
}

/** Submits the profile form (with optional photo) and refreshes the user in the auth store. */
async function save() {
  saving.value = true
  message.value = ''
  error.value = false
  try {
    const fd = new FormData()
    fd.append('first_name', form.first_name || '')
    fd.append('last_name', form.last_name || '')
    fd.append('email', form.email || '')
    fd.append('phone', form.phone || '')
    fd.append('country_code', form.country_code || '')
    fd.append('id_type', form.id_type || '')
    fd.append('id_number', form.id_number || '')
    fd.append('position', form.position || '')
    if (photo.value) fd.append('profile_picture', photo.value)

    const { data } = await authApi.updateProfile(fd)
    authStore.user = data.user
    await authStore.fetchProfile().catch(() => {})
    fillForm()
    photo.value = null
    if (photoInput.value) photoInput.value.value = ''
    if (photoPreview.value) URL.revokeObjectURL(photoPreview.value)
    photoPreview.value = ''
    message.value = data.message || t('profile.saved')
  } catch (err) {
    error.value = true
    message.value = flattenError(err)
  } finally {
    saving.value = false
  }
}

/** Formats an ISO datetime string for display, or '-' when absent. */
function formatDateTime(date) {
  return date ? String(date).slice(0, 16).replace('T', ' ') : '-'
}

/** Formats an ISO date string (date only) for display, or '-' when absent. */
function formatDate(date) {
  return date ? String(date).slice(0, 10) : '-'
}

/**
 * Flattens a validation/API error into a single readable message string.
 * @param {Error} err - The thrown request error.
 * @returns {string} A space-joined error message or the generic failure text.
 */
function flattenError(err) {
  const messages = err.response?.data?.errors
  return messages
    ? Object.values(messages).flat().join(' ')
    : err.response?.data?.message || t('common.actionFailed')
}

/** Applies attendance data to the UI, defaulting the shift state from clock timestamps. */
function applyAttendance(attendance, clockedIn) {
  onShift.value = clockedIn ?? (!!attendance && !attendance.clock_out_at)
  clockInAt.value = attendance?.clock_in_at || null
}

/** Queries the current attendance status and reflects it in the UI. */
async function refreshStatus() {
  attendanceError.value = ''
  try {
    const res = await attendanceApi.status()
    applyAttendance(res.data.attendance, !!res.data.clocked_in)
  } catch (err) {
    attendanceError.value = flattenError(err)
  }
}

/** Loads the hotel's clock-in requirements so the UI can prompt the right steps. */
async function loadRequirements() {
  try {
    const { data } = await attendanceApi.requirements()
    requirements.office_configured = !!data.office_configured
    requirements.requires_location = !!data.requires_location
    requirements.requires_qr = !!data.requires_qr
    requirements.requires_photo = !!data.requires_photo
    requirements.device_policy = data.device_policy || 'off'
    requirements.device_registered = data.device_registered !== false
  } catch {
    // Non-fatal: fall back to a plain clock-in.
  }
}

/**
 * Resolves the device's current position, or null when unavailable/denied.
 * @returns {Promise<object|null>} { lat, lng, accuracy_m, positioned_at }.
 */
function getPosition() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy_m: Math.round(pos.coords.accuracy) || null,
          positioned_at: new Date().toISOString(),
        }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    )
  })
}

/** Opens the QR scanner and resolves with the scanned token (or null when cancelled). */
function scanQr() {
  return new Promise((resolve) => {
    qrResolve = resolve
    showScanner.value = true
  })
}

/** Called when the scanner decodes a QR code. */
function onScanned(token) {
  showScanner.value = false
  if (qrResolve) {
    qrResolve(token)
    qrResolve = null
  }
}

/** Called when the scanner is closed without a scan. */
function onScannerClose() {
  showScanner.value = false
  if (qrResolve) {
    qrResolve(null)
    qrResolve = null
  }
}

/** Opens the selfie camera and resolves with the captured file (or null when cancelled). */
function captureSelfie() {
  return new Promise((resolve) => {
    selfieResolve = resolve
    showSelfie.value = true
  })
}

/** Called when the selfie is captured. */
function onSelfieCaptured(file) {
  showSelfie.value = false
  if (selfieResolve) {
    selfieResolve(file)
    selfieResolve = null
  }
}

/** Called when the selfie modal is closed without capturing. */
function onSelfieClose() {
  showSelfie.value = false
  if (selfieResolve) {
    selfieResolve(null)
    selfieResolve = null
  }
}

/**
 * Ensures the device is registered when the hotel runs the strict policy,
 * so a first clock-in from an unregistered browser is not silently refused.
 * @returns {Promise<boolean>} True when the device may be used.
 */
async function ensureDeviceRegistered() {
  if (requirements.device_policy !== 'strict' || requirements.device_registered) return true
  try {
    const res = await attendanceApi.registerDevice({
      device_id: getDeviceId(),
      device_fingerprint: getDeviceFingerprint(),
      device_name: navigator.userAgent?.slice(0, 60) || 'Web browser',
    })
    if (res.data.device_secret) setDeviceSecret(res.data.device_secret)
    requirements.device_registered = true
    return true
  } catch (err) {
    attendanceError.value = flattenError(err)
    return false
  }
}

/** Geofenced clock-in: location (+ QR + selfie when required) then submit. */
async function handleClockIn() {
  if (acting.value) return
  attendanceError.value = ''
  // mark we are acting early to prevent duplicate starts while awaiting user/device prompts
  acting.value = true

  if (!(await ensureDeviceRegistered())) {
    acting.value = false
    return
  }

  const position = await getPosition()
  if (!position && requirements.requires_location) {
    attendanceError.value = t('attendance.gpsUnavailable')
    acting.value = false
    return
  }

  const payload = {
    ...position,
    device_id: getDeviceId(),
    device_fingerprint: getDeviceFingerprint(),
  }

  const deviceSecret = getDeviceSecret()
  if (deviceSecret) payload.device_secret = deviceSecret

  if (requirements.requires_qr) {
    const token = await scanQr()
    if (!token) {
      acting.value = false
      return
    }
    payload.qr_token = token
  }

  let photo = null
  if (requirements.requires_photo) {
    photo = await captureSelfie()
    if (!photo) {
      acting.value = false
      return
    }
  }
  // already marked acting above; proceed to the network request
  try {
    let res
    if (photo) {
      const fd = new FormData()
      Object.entries(payload).forEach(([key, value]) => {
        if (value !== null && value !== undefined) fd.append(key, value)
      })
      fd.append('photo', photo)
      res = await attendanceApi.clockIn(fd)
    } else {
      res = await attendanceApi.clockIn(payload)
    }
    applyAttendance(res.data.attendance)
    if (res.data.device_secret) setDeviceSecret(res.data.device_secret)
    if (res.data.device_status === 'new_registered') await loadRequirements()
  } catch (err) {
    attendanceError.value = flattenError(err)
  } finally {
    acting.value = false
  }
}

/** Clocks out, attaching a best-effort location fix if one is available. */
async function handleClockOut() {
  if (acting.value) return
  attendanceError.value = ''
  const position = await getPosition()
  acting.value = true
  try {
    const res = await attendanceApi.clockOut({ ...position })
    applyAttendance(res.data.attendance)
  } catch (err) {
    attendanceError.value = flattenError(err)
  } finally {
    acting.value = false
  }
}

/** Mints a fresh entrance QR token and renders it on the canvas. */
async function issueQr() {
  qrLoading.value = true
  try {
    const res = await attendanceApi.qrToken()
    qrToken.value = res.data.token
    qrCountdown.value = res.data.ttl_seconds ?? 60
    await nextTick()
    if (qrCanvasEl.value && qrToken.value) {
      await QRCode.toCanvas(qrCanvasEl.value, qrToken.value, { width: 240, margin: 1 })
    }
  } catch {
    // Ignore the error but avoid immediate tight retry storms by backing off the countdown.
    qrCountdown.value = Math.max(qrCountdown.value, 10)
  } finally {
    qrLoading.value = false
  }
}

/** Counts down the QR's lifetime and mints a new token when it expires. */
function startQrRotation() {
  clearInterval(qrTimer)
  qrTimer = setInterval(() => {
    if (qrCountdown.value > 1) {
      qrCountdown.value -= 1
    } else {
      issueQr()
    }
  }, 1000)
}

/** Loads the hotel's attendance settings into the admin form. */
async function loadSettings() {
  try {
    const { data } = await attendanceApi.settings()
    settings.lat = data.office_lat
    settings.lng = data.office_lng
    settings.radius = data.office_radius_m ?? 100
    settings.qrEnabled = !!data.attendance_qr_enabled
    settings.photoRequired = !!data.attendance_require_photo
  } catch {
    // Non-fatal: leave the form at defaults.
  }
}

/** Saves the hotel's attendance settings. */
async function saveSettings() {
  savingSettings.value = true
  settingsError.value = ''
  settingsMessage.value = ''
  try {
    const { data } = await attendanceApi.updateSettings({
      office_lat: settings.lat || null,
      office_lng: settings.lng || null,
      office_radius_m: settings.radius || null,
      attendance_qr_enabled: settings.qrEnabled,
      attendance_require_photo: settings.photoRequired,
    })
    settings.lat = data.office_lat
    settings.lng = data.office_lng
    settings.radius = data.office_radius_m ?? 100
    settings.qrEnabled = !!data.attendance_qr_enabled
    settings.photoRequired = !!data.attendance_require_photo
    settingsMessage.value = t('attendance.settingsSaved')
    loadRequirements()
  } catch (err) {
    settingsError.value = flattenError(err)
  } finally {
    savingSettings.value = false
  }
}

/** Loads the hotel's business details into the form. */
async function loadHotelSettings() {
  try {
    const { data } = await hotelSettingsApi.show()
    const h = data.hotel || {}
    const addr = parseAddress(h.address)
    hotelForm.hotel_name = h.hotel_name || ''
    hotelForm.registration_code = h.registration_code || ''
    hotelForm.contact_person = h.contact_person || ''
    hotelForm.email = h.email || ''
    hotelForm.phone = h.phone || ''
    hotelForm.address_coordinates = addr.coordinates || ''
    hotelForm.address_po_box = addr.po_box || ''
    hotelForm.address_street = addr.street || ''
    hotelForm.city = h.city || ''
    hotelForm.country = h.country || ''
    hotelForm.tin = h.tin || ''
    hotelForm.vrn = h.vrn || ''
    hotelForm.payment_methods = normalizeMethods(h.payment_method_definitions || h.payment_methods)
    hotelForm.payment_accounts_list = normalizeAccountsList(h.payment_accounts_list || h.payment_accounts)
  } catch {
    // Silently ignore — the card simply won't show data.
  }
}

/** Saves the hotel's business details. */
async function saveHotelSettings() {
  savingHotelSettings.value = true
  hotelSettingsError.value = ''
  hotelSettingsSuccess.value = ''
  try {
    const payload = {
      hotel_name: hotelForm.hotel_name,
      contact_person: hotelForm.contact_person,
      email: hotelForm.email,
      phone: hotelForm.phone,
      address: serializeAddress(),
      city: hotelForm.city,
      country: hotelForm.country,
      tin: hotelForm.tin,
      vrn: hotelForm.vrn,
      payment_methods: serializeMethods(),
      payment_accounts: serializeAccounts(),
    }
    const { data } = await hotelSettingsApi.update(payload)
    hotelSettingsSuccess.value = data.message || t('hotelSettings.saved')
    await loadHotelSettings()
  } catch (err) {
    hotelSettingsError.value = flattenError(err)
  } finally {
    savingHotelSettings.value = false
  }
}

/** Loads the manager security oversight: registered devices + suspicious clock-ins. */
async function loadSecurity() {
  security.loading = true
  // ensure lists are empty by default so we don't show stale data on error
  security.devices = []
  security.suspicious = []
  try {
    const [dev, sus] = await Promise.all([
      attendanceApi.attendanceDevices({ per_page: 100 }),
      attendanceApi.suspicious({ per_page: 50 }),
    ])
    security.devices = dev.data.data || []
    security.suspicious = sus.data.data || []
  } catch {
    // Non-fatal: keep the lists empty when the request fails.
  } finally {
    security.loading = false
  }
}

/** Revokes a device so it can no longer clock in. */
async function revokeDevice(deviceRowId) {
  securityError.value = ''
  try {
    const res = await attendanceApi.revokeDevice(deviceRowId)
    if (res.data.device?.device_id === getDeviceId()) clearDeviceSecret()
    await loadSecurity()
  } catch (err) {
    securityError.value = flattenError(err)
  }
}

/** Localized label for a suspicion reason code. */
function suspicionLabel(reason) {
  const key = `attendance.suspicionReasons.${reason}`
  return te(key) ? t(key) : reason
}

/** Renders localized labels for a list of suspicion reason codes. */
function suspicionLabels(reasons) {
  return (reasons || []).map(suspicionLabel)
}

/** Opens a private evidence attachment in a new tab via the authenticated blob endpoint. */
async function viewEvidence(attachmentId) {
  try {
    const res = await attendanceApi.attachment(attachmentId)
    const url = URL.createObjectURL(res.data)
    window.open(url, '_blank', 'noopener,noreferrer')
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  } catch {
    securityError.value = t('common.actionFailed')
  }
}

/** Localized label for an absence type code. */
function absenceTypeLabel(type) {
  const map = {
    sick: 'attendance.absenceSick',
    emergency: 'attendance.absenceEmergency',
    transport: 'attendance.absenceTransport',
    family: 'attendance.absenceFamily',
    other: 'attendance.absenceOther',
  }
  return t(map[type] || map.other)
}

/** Localized label for a claim status code. */
function statusLabel(status) {
  return t(`attendance.status_${status}`)
}

/** CSS badge class for a claim status. */
function statusBadge(status) {
  if (status === 'approved') return 'badge-green'
  if (status === 'rejected') return 'badge-red'
  return 'badge-warning'
}

/** Collects the selected evidence files into the form state. */
function onAbsenceFiles(event) {
  absenceFiles.value = Array.from(event.target.files || [])
}

/** The current user's own absence claims, refreshed after submitting. */
async function loadMyAbsences() {
  try {
    const { data } = await attendanceApi.myAbsenceRequests()
    myAbsences.value = data.data
  } catch {
    // Non-fatal: the list simply stays empty.
  }
}

/** Files an absence claim with location, device and optional evidence. */
async function submitAbsence() {
  absenceSaving.value = true
  absenceError.value = ''
  absenceMessage.value = ''
  try {
    const position = await getPosition()
    const fd = new FormData()
    fd.append('absence_type', absenceForm.type)
    fd.append('reason', absenceForm.reason || '')
    fd.append('starts_at', absenceForm.startsAt)
    fd.append('ends_at', absenceForm.endsAt)
    fd.append('device_id', getDeviceId())
    fd.append('device_fingerprint', getDeviceFingerprint())
    if (position) {
      Object.entries(position).forEach(([key, value]) => {
        if (value !== null && value !== undefined) fd.append(key, value)
      })
    }
    absenceFiles.value.forEach((file) => fd.append('attachments[]', file))
    await attendanceApi.reportAbsence(fd)
    absenceForm.reason = ''
    absenceForm.startsAt = ''
    absenceForm.endsAt = ''
    absenceFiles.value = []
    if (absenceFilesInput.value) absenceFilesInput.value.value = ''
    absenceMessage.value = t('attendance.absenceSubmitted')
    await loadMyAbsences()
  } catch (err) {
    absenceError.value = flattenError(err)
  } finally {
    absenceSaving.value = false
  }
}

/** Loads every absence claim for the manager verification ledger. */
async function loadAbsenceClaims() {
  claimsError.value = ''
  try {
    const { data } = await attendanceApi.absenceRequests({ per_page: 50, status: 'pending' })
    absenceClaims.value = data.data
  } catch {
    // Non-fatal: the ledger simply stays empty.
  }
}

/** Approves or rejects an absence claim and refreshes the ledger. */
async function decideAbsence(requestId, decision) {
  decidingClaim.value = true
  claimsError.value = ''
  try {
    await attendanceApi.decideAbsenceRequest(requestId, { decision })
    await loadAbsenceClaims()
  } catch (err) {
    claimsError.value = flattenError(err)
  } finally {
    decidingClaim.value = false
  }
}

onMounted(() => {
  fillForm()
  refreshStatus()
  loadRequirements()
  loadMyAbsences()
  if (canManageQr.value) {
    issueQr()
    startQrRotation()
  }
  if (canManageSettings.value) loadSettings()
  if (canManageHotel.value) loadHotelSettings()
  if (canManageSecurity.value) {
    loadSecurity()
    loadAbsenceClaims()
  }
})

onUnmounted(() => {
  clearInterval(qrTimer)
  if (photoPreview.value) URL.revokeObjectURL(photoPreview.value)
})
</script>

<style scoped>
.profile-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}

.form-section-title {
  margin: 20px 0 10px;
  font-size: 15px;
  color: #334155;
}

.form-actions {
  margin-top: 14px;
  display: flex;
  gap: 10px;
}

.profile-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}

.avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: #005eb8;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  overflow: hidden;
  flex-shrink: 0;
}

.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-initials {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 0.5px;
}

.profile-form-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.profile-header-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.profile-name {
  font-size: 17px;
  font-weight: 600;
  color: #0f172a;
}

.profile-sub {
  font-size: 13px;
  color: #64748b;
  text-transform: capitalize;
}

.attendance-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.attendance-state {
  display: flex;
  align-items: center;
  gap: 12px;
}

.attendance-hint {
  margin-top: 10px;
}

.check-label {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 6px;
  cursor: pointer;
}

.qr-layout {
  display: flex;
  align-items: center;
  gap: 24px;
  flex-wrap: wrap;
  margin-top: 14px;
}

.qr-frame {
  width: 260px;
  height: 260px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
}

.qr-canvas {
  width: 100%;
  height: 100%;
}

.qr-loading {
  color: #005eb8;
  font-size: 24px;
}

.qr-meta {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.qr-countdown {
  font-size: 15px;
  font-weight: 600;
  color: #334155;
  display: flex;
  align-items: center;
  gap: 8px;
}

.qr-countdown-urgent {
  color: #dc2626;
}

.security-block {
  margin-top: 16px;
}

.security-subtitle {
  font-size: 14px;
  font-weight: 600;
  color: #334155;
  margin: 0 0 8px;
}

.security-subtitle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.security-subtitle-row .security-subtitle {
  margin-bottom: 0;
}

.security-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.table-scroll .security-table { min-width: 560px; }

.security-table th,
.security-table td {
  text-align: left;
  padding: 8px 10px;
  border-bottom: 1px solid #e2e8f0;
  vertical-align: middle;
}

.security-table th {
  color: #64748b;
  font-weight: 600;
  background: #f8fafc;
}

.security-actions {
  text-align: right;
}

.security-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.security-list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid #e2e8f0;
}

.security-list li > div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
}

.badge-danger {
  background: #fee2e2;
  color: #b91c1c;
}

.badge-warning {
  background: #fef3c7;
  color: #b45309;
  font-style: normal;
}

.absence-claim {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #e2e8f0;
}

.absence-claim form {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 10px;
}

.absence-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 10px;
}

.claim-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-link {
  align-self: flex-start;
  padding: 0;
  border: none;
  background: none;
  color: #2563eb;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  text-decoration: underline;
}

.btn-link:hover {
  color: #1e40af;
}

.card-subtitle {
  font-size: 15px;
  font-weight: 600;
  color: #334155;
  margin: 20px 0 10px;
  padding-top: 16px;
  border-top: 1px solid #e2e8f0;
}

.form-full {
  grid-column: 1 / -1;
}

.narrow-inputs .form-group .input { max-width: 420px; width: 100%; }
.static-value { min-height: 38px; display: flex; align-items: center; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 6px; background: #f8fafc; font-weight: 700; letter-spacing: 1px; }
.hotel-subsection { margin-top: 16px; padding-top: 16px; border-top: 1px solid #e2e8f0; }
.hotel-subsection-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
.hotel-subsection-head .card-subtitle { margin: 0 0 4px; padding-top: 0; border-top: 0; }
.custom-list { display: flex; flex-direction: column; gap: 12px; }
.custom-row { display: grid; gap: 10px; align-items: end; padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; }
.method-row { grid-template-columns: auto minmax(180px, 280px) minmax(220px, 1fr) auto; }
.provider-row { grid-template-columns: repeat(3, minmax(160px, 260px)) auto; }
.checkbox-label { display: flex; align-items: center; gap: 6px; font-size: 14px; cursor: pointer; }
.checkbox-label input[type="checkbox"] { width: 16px; height: 16px; accent-color: #005eb8; }
.compact-check { padding-bottom: 8px; white-space: nowrap; }
.icon-btn { height: 38px; align-self: end; }
@media (max-width: 900px) {
  .method-row, .provider-row { grid-template-columns: 1fr; }
  .icon-btn { width: fit-content; }
}
</style>
