<!--
  MessagesPage.vue
  WhatsApp-style staff messaging hub (route /app/messages). Direct and group
  chats (hotel or global scope) with: text/media/voice messages, view-once
  media, reactions, replies, pins, stars, polls, translation, templates,
  scheduling, forwarding, in-chat search, CSV export, @mentions, calls,
  status rings, room linking, and a tenant "workspace" panel (announcements,
  meetings, shift handovers, escalations, nearby staff, guest SMS, retention
  policies, notification preferences, SOS alerts). Realtime via Laravel Echo
  (private user, tenant and per-thread channels).
-->

<template>
  <div class="dashboard-page container">
    <!-- Page header: workspace shortcut, refresh, new message / new group -->
    <div class="page-head" @click="headMenuOpen = false">
      <div>
        <h1><i class="fas fa-comments"></i> {{ $t('messages.title') }}</h1>
        <p class="muted">{{ $t('messages.subtitle') }}</p>
      </div>
      <div class="head-actions">
        <button class="btn btn-secondary" @click="openWorkspace()">
          <i class="fas fa-briefcase"></i> {{ $t('messages.workspace') }}
        </button>
        <button class="btn btn-secondary" @click="refreshAll">
          <i class="fas fa-rotate"></i> {{ $t('common.refresh') }}
        </button>
        <button class="btn btn-primary" @click="openNewMessage">
          <i class="fas fa-paper-plane"></i> {{ $t('messages.newMessage') }}
        </button>
        <button class="btn btn-primary btn-group" @click="openNewGroup">
          <i class="fas fa-users"></i> {{ $t('messages.newGroup') }}
        </button>
      </div>
      <!-- Mobile: collapse the header actions into a dropdown -->
      <div class="head-actions-mobile">
        <button type="button" class="btn btn-secondary head-actions-toggle" :class="{ active: headMenuOpen }"
          :title="$t('messages.moreActions')" @click.stop="headMenuOpen = !headMenuOpen">
          <i class="fas fa-ellipsis-vertical"></i>
        </button>
        <div v-if="headMenuOpen" class="composer-tools-menu head-actions-menu" @click.stop>
          <button v-for="action in headActions" :key="action.key" type="button" class="composer-tool-item"
            @click="headAction(action)">
            <i class="fas" :class="action.icon"></i>
            <span>{{ action.label }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Global success / error feedback banners -->
    <div v-if="success" class="alert alert-success">{{ success }}</div>
    <div v-if="error" class="alert alert-error">{{ error }}</div>

    <!-- Two-pane chat layout: list on the left, active thread on the right (stacked on mobile) -->
    <div class="chat-shell">
      <!-- Conversation + group list -->
      <aside class="chat-list" :class="{ 'hidden-xs': activeChat }">
        <div class="chat-list-search">
          <input v-model="listSearch" type="text" class="input" :placeholder="$t('messages.searchPlaceholder')"
            @input="onListSearch" />
        </div>

        <!-- "My status" entry pinned above the chat list (tap + to compose) -->
        <button class="chat-item status-entry" @click="openMyStatus">
          <span class="avatar status-my" :class="myStatusHas ? 'status-ring unviewed' : ''">
            {{ initials(me.full_name) }}
            <span class="status-add" :title="$t('statuses.newStatus')" @click.stop="openStatusCompose">
              <i class="fas fa-plus"></i>
            </span>
          </span>
          <span class="chat-item-body">
            <span class="chat-item-top">
              <strong>{{ $t('statuses.myStatus') }}</strong>
            </span>
            <span class="chat-item-sub">
              <span class="muted chat-preview">{{
                myStatusHas ? $t('statuses.viewHint') : $t('statuses.addStatusHint')
              }}</span>
            </span>
          </span>
        </button>

        <div v-if="loadingConvs" class="alert alert-info">{{ $t('common.loading') }}</div>

        <div v-else-if="!chats.length" class="chat-empty muted">
          {{ $t('messages.noConversations') }}
        </div>

        <button v-for="chat in chats" :key="chat.kind + chat.id" class="chat-item"
          :class="{ active: chat.kind === activeKind && chat.id === activeId }" @click="openChat(chat)">
          <span class="avatar" :class="[
            chat.kind === 'group'
              ? 'avatar-group'
              : chat.scope === 'global'
                ? 'avatar-global'
                : '',
            avatarStatusClass(chat),
          ]" @click.stop="avatarStatusClass(chat) ? openUserStatus(chat.participant_id) : null">
            <i v-if="chat.kind === 'group'" class="fas fa-users"></i>
            <template v-else>{{ initials(chat.name) }}</template>
            <span v-if="chat.kind === 'direct' && isOnline(chat.participant_id)" class="online-dot"
              :title="$t('messages.online')"></span>
          </span>
          <span class="chat-item-body">
            <span class="chat-item-top">
              <strong>{{ chat.name }}</strong>
              <span class="muted">{{ formatTime(chat.last_message_at || chat.created_at) }}</span>
            </span>
            <span class="chat-item-sub">
              <span class="muted chat-preview">{{ lastPreview(chat) }}</span>
              <span v-if="chat.unread_count > 0" class="unread-badge">{{ chat.unread_count }}</span>
            </span>
            <span class="chat-item-meta">
              <span class="badge" :class="chat.scope === 'global' ? 'badge-purple' : 'badge-blue'">
                <i class="fas" :class="chat.scope === 'global' ? 'fa-globe' : 'fa-building'"></i>
                {{ chat.scope === 'global' ? $t('messages.global') : $t('messages.hotel') }}
              </span>
              <span v-if="chat.kind === 'group'" class="muted hotel-name">
                <i class="fas fa-user"></i> {{ chat.member_count || 0 }}
              </span>
              <span v-else-if="chat.scope === 'global' && chat.hotel_name" class="muted hotel-name">
                {{ chat.hotel_name }}
              </span>
            </span>
          </span>
        </button>

        <!-- Load-more pager for the chat list -->
        <div v-if="hasMore" class="chat-load-more">
          <button class="btn btn-sm btn-secondary" :disabled="loadingConvs" @click="loadMoreChats">
            {{ $t('common.next') }}
          </button>
        </div>
      </aside>

      <!-- Thread -->
      <section class="chat-thread" :class="{ 'hidden-xs': !activeChat }">
        <template v-if="activeChat">
          <!-- Thread header: participant info plus call/pinned/search/room-link/mute/group actions -->
          <header class="chat-thread-head" @click="threadHeadMenuOpen = false">
            <button class="btn btn-sm btn-secondary back-btn" @click="closeThread">
              <i class="fas fa-arrow-left"></i>
            </button>
            <span class="avatar" :class="[
              activeChat.kind === 'group'
                ? 'avatar-group'
                : activeChat.scope === 'global'
                  ? 'avatar-global'
                  : '',
              avatarStatusClass(activeChat),
            ]" @click="
              avatarStatusClass(activeChat) ? openUserStatus(activeChat.participant_id) : null
              ">
              <i v-if="activeChat.kind === 'group'" class="fas fa-users"></i>
              <template v-else>{{ initials(activeChat.name) }}</template>
            </span>
            <div class="chat-thread-who">
              <strong>{{ activeChat.name }}</strong>
              <div>
                <span v-if="
                  activeChat.kind === 'direct' && isOnline(activeChat.participant_id)
                " class="badge badge-green chat-online">
                  <i class="fas fa-circle"></i> {{ $t('messages.online') }}
                </span>
                <span class="badge" :class="activeChat.scope === 'global' ? 'badge-purple' : 'badge-blue'">
                  <i class="fas" :class="activeChat.scope === 'global' ? 'fa-globe' : 'fa-building'"></i>
                  {{ activeChat.scope === 'global' ? $t('messages.global') : $t('messages.hotel') }}
                </span>
                <span v-if="activeChat.kind === 'group'" class="muted">
                  {{ $t('messages.memberCount', { count: activeChat.member_count || 0 }) }}
                </span>
                <span v-else-if="activeChat.hotel_name" class="muted">{{
                  activeChat.hotel_name
                }}</span>
              </div>
            </div>
            <!-- Thread actions: inline on desktop, collapsed into a dropdown on mobile -->
            <div class="thread-head-actions">
              <button v-for="tool in threadHeadTools" :key="tool.key" type="button"
                class="btn btn-sm btn-secondary members-btn" :title="tool.label" @click="tool.handler"
                :disabled="tool.busy">
                <i class="fas" :class="tool.busy ? 'fa-spinner fa-spin' : tool.icon"></i>
                <span v-if="tool.key === 'members'">{{ tool.label }}</span>
              </button>
            </div>
            <div class="thread-head-actions-mobile">
              <button type="button" class="btn btn-sm btn-secondary members-btn thread-head-toggle"
                :class="{ active: threadHeadMenuOpen }" :title="$t('messages.moreActions')"
                @click.stop="threadHeadMenuOpen = !threadHeadMenuOpen">
                <i class="fas fa-ellipsis-vertical"></i>
              </button>
              <div v-if="threadHeadMenuOpen" class="composer-tools-menu thread-head-menu" @click.stop>
                <button v-for="tool in threadHeadTools" :key="tool.key" type="button" class="composer-tool-item"
                  @click="threadHeadAction(tool)" :disabled="tool.busy">
                  <i class="fas" :class="tool.busy ? 'fa-spinner fa-spin' : tool.icon"></i>
                  <span>{{ tool.label }}</span>
                </button>
              </div>
            </div>
          </header>

          <div v-if="loadingMsgs" class="alert alert-info">{{ $t('common.loading') }}</div>

          <!-- Message bubbles: text, media, view-once, polls, reactions, reply previews and read ticks -->
          <div v-else class="chat-messages">
            <div v-if="!messages.length" class="chat-empty muted">
              {{ $t('messages.noMessages') }}
            </div>
            <div v-for="msg in messages" :key="msg.message_id || msg.group_message_id" class="bubble"
              :id="'msg-' + (msg.message_id || msg.group_message_id)" :class="[
                msg.sender_id === me.user_id ? 'mine' : 'theirs',
                msg.priority === 'urgent' ? 'urgent' : '',
                isStarred(msg) ? 'starred-bubble' : '',
              ]" @contextmenu.prevent="openMsgMenu(msg, $event)">
              <div v-if="msg.sender_id !== me.user_id && activeChat.kind === 'group'" class="bubble-sender">
                {{ msg.sender?.full_name || '' }}
              </div>
              <div v-if="msg.deleted" class="deleted-note">
                <i class="fas fa-trash"></i> {{ $t('messages.messageDeleted') }}
              </div>
              <template v-else>
                <div class="bubble-tags">
                  <span v-if="isPinned(msg)" class="bubble-tag tag-pin" :title="$t('messages.pinnedMessages')">
                    <i class="fas fa-thumbtack"></i>
                  </span>
                  <span v-if="msg.priority === 'urgent'" class="bubble-tag tag-urgent">
                    <i class="fas fa-flag"></i> {{ $t('messages.urgent') }}
                  </span>
                  <span v-if="msg.is_task" class="bubble-tag tag-task">
                    <i class="fas fa-check-double"></i> {{ $t('messages.task') }}
                  </span>
                </div>
                <div v-if="msg.forwarded_from" class="forwarded-note">
                  <i class="fas fa-forward"></i> {{ $t('messages.forwarded') }}
                </div>
                <div v-if="msg.reply_to" class="reply-quote" @click.stop="scrollToMessage(msg)">
                  <span v-if="msg.reply_to.sender_id === me.user_id" class="reply-quote-author">{{
                    $t('messages.you')
                  }}</span>
                  <span v-else class="reply-quote-author">{{
                    msg.reply_to.sender?.full_name || $t('messages.unknownSender')
                  }}</span>
                  <span class="reply-quote-text">{{
                    msg.reply_to.body || $t('messages.attachment')
                  }}</span>
                </div>
                <div class="bubble-text">
                  <button v-if="
                    msg.view_once &&
                    !msg.media_url &&
                    !msg.viewed_at &&
                    msg.sender_id !== me.user_id
                  " class="view-once-btn" :disabled="viewOnceLoading === msgId(msg)" @click="openViewOnce(msg)">
                    <i class="fas fa-eye"></i>
                    {{
                      viewOnceLoading === msgId(msg)
                        ? $t('common.loading')
                        : $t('messages.viewOnceTap')
                    }}
                  </button>
                  <div v-else-if="msg.view_once && !msg.media_url && msg.viewed_at" class="view-once-open">
                    <i class="fas fa-check-circle"></i> {{ $t('messages.viewOnceOpened') }}
                  </div>
                  <div v-else-if="msg.view_once && !msg.media_url" class="view-once-open">
                    <i class="fas fa-lock"></i> {{ $t('messages.viewOnceMine') }}
                  </div>
                  <audio v-if="msg.type === 'audio' && msg.media_url" controls :src="msg.media_url"
                    class="bubble-audio"></audio>
                  <img v-else-if="msg.type === 'image' && msg.media_url" :src="msg.media_url" class="bubble-image"
                    alt="attachment" />
                  <a v-else-if="msg.type === 'file' && msg.media_url" :href="msg.media_url" target="_blank"
                    rel="noopener" class="bubble-file">
                    <i class="fas fa-paperclip"></i> {{ msg.body || $t('messages.attachment') }}
                  </a>
                  <span v-if="msg.body && !msg.view_once">
                    <template v-for="(part, i) in renderBody(msg)" :key="i">
                      <span v-if="part.isMention" class="mention-chip">@{{ part.text }}</span>
                      <template v-else>{{ part.text }}</template>
                    </template>
                  </span>
                  <div v-if="msg.translation && msg.translation !== msg.body" class="translation-box">
                    <i class="fas fa-language"></i> {{ msg.translation }}
                    <span class="muted"> ({{ langLabel(msg.translated_lang) }}<template v-if="msg.translation_provider === 'google'"> · Google</template>)</span>
                  </div>
                </div>
                <div v-if="msg.poll" class="bubble-poll">
                  <strong class="poll-question">{{ msg.poll.question }}</strong>
                  <span class="poll-count muted">{{ msg.poll.total_votes || 0 }} {{ $t('messages.votes') }}</span>
                  <div v-for="opt in msg.poll.options" :key="opt.poll_option_id" class="poll-option"
                    :class="{ mine: msg.poll.my_vote === opt.poll_option_id }" @click.stop="votePoll(msg, opt)">
                    <span class="poll-option-label">{{ opt.label }}</span>
                    <span class="poll-option-pct">{{ opt.pct ?? 0 }}%</span>
                    <span class="poll-option-bar" :style="{ width: (opt.pct ?? 0) + '%' }"></span>
                    <span v-if="msg.poll.my_vote === opt.poll_option_id" class="poll-check"><i
                        class="fas fa-check"></i></span>
                  </div>
                </div>
                <div class="bubble-reactions" v-if="msg.reactions?.length">
                  <span v-for="r in msg.reactions" :key="r.reaction" class="bubble-reaction" :class="{ mine: r.mine }"
                    @click.stop="toggleReaction(msg, r.reaction)">
                    {{ r.reaction }}<span class="bubble-reaction-count">{{ r.count }}</span>
                  </span>
                </div>
              </template>
              <div class="bubble-meta">
                <span>{{
                  msg.sender_id === me.user_id ? $t('messages.you') : msg.sender?.full_name || ''
                }}</span>
                <span>·</span>
                <span>{{ formatTime(msg.created_at) }}</span>
                <span v-if="msg.disappears_at" class="disappear-chip" :title="$t('messages.disappearHint')">
                  <i class="fas fa-hourglass-half"></i>
                  {{ countdownTick >= 0 ? disappearCountdown(msg.disappears_at) : '' }}
                </span>
                <button v-if="translateLoading === (msg.message_id || msg.group_message_id)" class="bubble-translate"
                  disabled>
                  <i class="fas fa-language"></i>
                </button>
                <button v-else-if="msg.body" class="bubble-translate" :title="$t('messages.translate')"
                  @click.stop="translateMessage(msg)">
                  <i class="fas fa-language"></i>
                </button>
                <span v-if="msg.sender_id === me.user_id" class="ticks">
                  <i v-if="msgTicks(msg) === 'read'" class="fas fa-check-double tick-read"
                    :title="seenByTitle(msg)"></i>
                  <i v-else-if="msgTicks(msg) === 'delivered'" class="fas fa-check tick"
                    :title="$t('messages.delivered')"></i>
                </span>
                <button class="bubble-more" :title="$t('messages.more')" @click.stop="openMsgMenu(msg, $event)">
                  <i class="fas fa-ellipsis-h"></i>
                </button>
              </div>
            </div>
          </div>

          <!-- Composer: recording/file previews, reply bar, priority toggle, attachments and emoji -->
          <form class="chat-composer" @submit.prevent="sendMessage" @click="composerMenuOpen = false">
            <template v-if="recordingPreview">
              <audio controls :src="recordingUrl" class="bubble-audio"></audio>
              <div class="recording-actions">
                <button type="button" class="btn btn-sm btn-danger" @click="cancelRecording">
                  <i class="fas fa-xmark"></i> {{ $t('common.cancel') }}
                </button>
                <button type="button" class="btn btn-sm btn-primary" :disabled="sending" @click="sendRecording">
                  <i class="fas fa-paper-plane"></i> {{ $t('messages.send') }}
                </button>
              </div>
            </template>

            <div v-else-if="filePreview" class="attachment-preview">
              <img v-if="filePreview.type.startsWith('image/')" :src="filePreviewUrl" class="attachment-preview-media"
                alt="preview" />
              <video v-else-if="filePreview.type.startsWith('video/')" :src="filePreviewUrl" controls
                class="attachment-preview-media"></video>
              <audio v-else-if="filePreview.type.startsWith('audio/')" :src="filePreviewUrl" controls
                class="bubble-audio"></audio>
              <div v-else class="attachment-preview-file">
                <i class="fas fa-file"></i>
                <div>
                  <strong>{{ filePreview.name }}</strong>
                  <span>{{ formatFileSize(filePreview.size) }}</span>
                </div>
              </div>
              <label v-if="
                filePreview.type.startsWith('image/') || filePreview.type.startsWith('video/')
              " class="view-once-toggle">
                <input v-model="fileViewOnce" type="checkbox" />
                <i class="fas fa-eye"></i> {{ $t('messages.viewOnceSend') }}
              </label>
              <div class="recording-actions">
                <button type="button" class="btn btn-sm btn-danger" @click="cancelFilePreview">
                  <i class="fas fa-xmark"></i> {{ $t('common.cancel') }}
                </button>
                <button type="button" class="btn btn-sm btn-primary" :disabled="sending" @click="sendFilePreview">
                  <i class="fas fa-paper-plane"></i> {{ $t('messages.send') }}
                </button>
              </div>
            </div>

            <template v-else>
              <!-- Composer tools (emoji, attach, mic, poll, schedule, template, priority).
                   Inline on desktop; collapsed into the left dropdown on mobile. -->
              <div class="composer-tools">
                <button v-for="tool in composerTools" :key="tool.key" type="button" class="icon-btn"
                  :class="{ active: tool.active, recording: tool.key === 'mic' && isRecording }" :title="tool.title"
                  @click="tool.handler">
                  <i class="fas" :class="tool.icon"></i>
                  <span v-if="tool.key === 'mic' && isRecording" class="rec-timer">{{ recSeconds }}s</span>
                </button>
              </div>

              <!-- Mobile: dropdown that groups all composer tools (keeps the input wide) -->
              <div class="composer-tools-mobile">
                <button type="button" class="icon-btn composer-tools-toggle" :class="{ active: composerMenuOpen }"
                  :title="$t('messages.moreTools')" @click.stop="composerMenuOpen = !composerMenuOpen">
                  <i class="fas fa-plus"></i>
                </button>
                <div v-if="composerMenuOpen" class="composer-tools-menu" @click.stop>
                  <button v-for="tool in composerTools" :key="tool.key" type="button" class="composer-tool-item"
                    :class="{ active: tool.active }" @click="toolAction(tool)">
                    <i class="fas" :class="tool.icon"></i>
                    <span>{{ tool.title }}</span>
                  </button>
                </div>
              </div>

              <input ref="fileInput" type="file" class="hidden-input" @change="onFilePicked" />
              <textarea ref="draftInput" v-model="draft" rows="1" class="textarea"
                :placeholder="$t('messages.typeMessage')" @input="onDraftInput"
                @keydown.enter.exact.prevent="sendMessage"></textarea>
              <button type="submit" class="btn btn-primary composer-send"
                :disabled="sending || (!draft.trim() && !isRecording)">
                <i class="fas fa-paper-plane"></i>
                <span class="composer-send-label">{{
                  sending ? $t('messages.sending') : $t('messages.send')
                }}</span>
              </button>
            </template>

            <!-- Emoji picker popover -->
            <div v-if="showEmojiPicker" class="emoji-picker">
              <button v-for="emoji in EMOJIS" :key="emoji" type="button" class="emoji-item" @click="insertEmoji(emoji)">
                {{ emoji }}
              </button>
            </div>

            <!-- Disappearing-message duration picker (WhatsApp-style) -->
            <div v-if="showDisappearMenu" class="disappear-menu">
              <div class="disappear-menu-head">{{ $t('messages.disappearing') }}</div>
              <button v-for="opt in DISAPPEAR_OPTIONS" :key="opt" type="button" class="disappear-option"
                :class="{ selected: disappearIn === opt }" @click="setDisappear(opt)">
                <span>{{ disappearOptionLabel(opt) }}</span>
                <i v-if="disappearIn === opt" class="fas fa-check"></i>
              </button>
            </div>

            <div v-if="mentionSuggestions.length" class="mention-picker">
              <button v-for="u in mentionSuggestions" :key="u.user_id" type="button" class="mention-item"
                @mousedown.prevent="applyMention(u)">
                <span class="avatar">{{ initials(u.full_name) }}</span>
                <span class="mention-item-name">@{{ u.full_name }}</span>
              </button>
            </div>

            <div v-if="replyTo" class="reply-bar">
              <div class="reply-bar-body">
                <span class="reply-bar-author">
                  {{
                    replyTo.sender_id === me.user_id
                      ? $t('messages.you')
                      : replyTo.sender?.full_name || $t('messages.unknownSender')
                  }}
                </span>
                <span class="reply-bar-text">{{ replyTo.body || $t('messages.attachment') }}</span>
              </div>
              <button type="button" class="icon-btn" @click="cancelReply">
                <i class="fas fa-xmark"></i>
              </button>
            </div>

            <!-- Poll builder popover (question + dynamic options) -->
            <div v-if="showPollBuilder" class="poll-builder">
              <input v-model="pollQuestion" type="text" class="input"
                :placeholder="$t('messages.pollQuestionPlaceholder')" />
              <div v-for="(opt, i) in pollOptions" :key="i" class="poll-builder-option">
                <input v-model="pollOptions[i]" type="text" class="input"
                  :placeholder="`${$t('messages.pollOptionPlaceholder')} ${i + 1}`" />
                <button type="button" class="icon-btn" @click="removePollOption(i)">
                  <i class="fas fa-xmark"></i>
                </button>
              </div>
              <div class="poll-builder-actions">
                <button type="button" class="btn btn-sm btn-secondary" @click="addPollOption">
                  <i class="fas fa-plus"></i> {{ $t('messages.addOption') }}
                </button>
                <label class="poll-multiple-toggle">
                  <input v-model="pollMultiple" type="checkbox" />
                  {{ $t('messages.multipleVotes') }}
                </label>
              </div>
            </div>

            <div v-if="showScheduler" class="schedule-bar">
              <input v-model="scheduleAt" type="datetime-local" class="input" />
              <button type="button" class="btn btn-sm btn-primary" :disabled="savingFeature" @click="scheduleMessage">
                <i class="fas fa-clock"></i> {{ $t('messages.schedule') }}
              </button>
              <button type="button" class="btn btn-sm btn-secondary" @click="closeScheduler">
                <i class="fas fa-xmark"></i>
              </button>
            </div>

            <div v-if="showTemplatePicker" class="template-picker">
              <div class="template-picker-head">
                <select v-model="templateCategory" class="input" @change="loadTemplates">
                  <option value="">{{ $t('messages.allCategories') }}</option>
                  <option value="general">{{ $t('messages.catGeneral') }}</option>
                  <option value="housekeeping">{{ $t('messages.catHousekeeping') }}</option>
                  <option value="frontdesk">{{ $t('messages.catFrontdesk') }}</option>
                </select>
                <button type="button" class="btn btn-sm btn-secondary" @click="closeTemplatePicker">
                  <i class="fas fa-xmark"></i>
                </button>
              </div>
              <button v-for="tpl in templates" :key="tpl.id" type="button" class="template-item"
                @click="insertTemplate(tpl)">
                <strong>{{ tpl.name }}</strong>
                <span class="muted">{{ tpl.body }}</span>
              </button>
              <div v-if="!templates.length" class="muted template-empty">
                {{ $t('messages.noTemplates') }}
              </div>
            </div>
          </form>
        </template>

        <div v-else class="chat-thread-placeholder">
          <i class="fas fa-comments"></i>
          <p class="muted">{{ $t('messages.noConversations') }}</p>
          <div class="placeholder-actions">
            <button class="btn btn-primary" @click="openNewMessage">
              <i class="fas fa-paper-plane"></i> {{ $t('messages.newMessage') }}
            </button>
            <button class="btn btn-primary btn-group" @click="openNewGroup">
              <i class="fas fa-users"></i> {{ $t('messages.newGroup') }}
            </button>
          </div>
        </div>
      </section>
    </div>

    <!-- New direct message modal -->
    <div v-if="showNew" class="modal-overlay" @click.self="closeNewMessage">
      <div class="modal new-message-modal">
        <div class="modal-head">
          <h2><i class="fas fa-paper-plane"></i> {{ $t('messages.newMessage') }}</h2>
          <button class="modal-close" @click="closeNewMessage"><i class="fas fa-xmark"></i></button>
        </div>

        <div v-if="modalError" class="alert alert-error">{{ modalError }}</div>

        <p class="muted">{{ $t('messages.selectScope') }}</p>
        <div class="scope-cards">
          <button class="scope-card" :class="{ selected: newScope === 'hotel' }" @click="switchScope('hotel')">
            <span class="scope-icon"><i class="fas fa-building"></i></span>
            <span>
              <strong>{{ $t('messages.hotelMessaging') }}</strong>
              <span class="muted">{{ $t('messages.hintHotel', { hotel: hotelName }) }}</span>
            </span>
          </button>
          <button class="scope-card" :class="{ selected: newScope === 'global' }" @click="switchScope('global')">
            <span class="scope-icon"><i class="fas fa-globe"></i></span>
            <span>
              <strong>{{ $t('messages.globalMessaging') }}</strong>
              <span class="muted">{{ $t('messages.hintGlobal') }}</span>
            </span>
          </button>
        </div>

        <div class="form-group">
          <label>{{ $t('common.search') }}</label>
          <input v-model="userSearch" type="text" class="input" :placeholder="newScope === 'global' ? $t('messages.searchGlobal') : $t('messages.searchColleagues')
            " @input="searchUsers" />
        </div>

        <div v-if="searchingUsers" class="alert alert-info">{{ $t('common.loading') }}</div>

        <div v-else-if="userResults.length" class="user-results">
          <button v-for="u in userResults" :key="u.user_id" class="user-result" @click="startConversation(u)"
            :disabled="startingWith === u.user_id">
            <span class="avatar">
              {{ initials(u.full_name) }}
              <span v-if="isOnline(u.user_id)" class="online-dot" :title="$t('messages.online')"></span>
            </span>
            <span class="user-result-body">
              <strong>{{ u.full_name }}</strong>
              <span class="muted">
                {{ roleLabel(u.user_role) }}
                <span v-if="u.hotel_name"> · {{ u.hotel_name }}</span>
              </span>
            </span>
            <i class="fas fa-paper-plane user-result-go"></i>
          </button>
        </div>

        <div v-else-if="userSearch.trim()" class="chat-empty muted">
          {{ $t('messages.noUsers') }}
        </div>
      </div>
    </div>

    <!-- New group modal -->
    <div v-if="showNewGroup" class="modal-overlay" @click.self="closeNewGroup">
      <div class="modal new-message-modal">
        <div class="modal-head">
          <h2><i class="fas fa-users"></i> {{ $t('messages.createGroup') }}</h2>
          <button class="modal-close" @click="closeNewGroup"><i class="fas fa-xmark"></i></button>
        </div>

        <div v-if="modalError" class="alert alert-error">{{ modalError }}</div>

        <div class="form-group">
          <label>{{ $t('messages.groupName') }} *</label>
          <input v-model="groupName" type="text" class="input" :placeholder="$t('messages.groupNamePlaceholder')" />
        </div>

        <label class="task-group-toggle">
          <input v-model="isTaskGroupCreation" type="checkbox" />
          <i class="fas fa-check-double"></i> {{ $t('messages.taskGroup') }}
        </label>
        <div v-if="isTaskGroupCreation" class="form-group">
          <label>{{ $t('messages.taskType') }}</label>
          <select v-model="taskGroupType" class="input">
            <option value="housekeeping">{{ $t('messages.taskTypeHousekeeping') }}</option>
            <option value="laundry">{{ $t('messages.taskTypeLaundry') }}</option>
            <option value="food">{{ $t('messages.taskTypeFood') }}</option>
          </select>
        </div>

        <p class="muted">{{ $t('messages.selectScope') }}</p>
        <div class="scope-cards">
          <button class="scope-card" :class="{ selected: groupScope === 'hotel' }" @click="groupScope = 'hotel'">
            <span class="scope-icon"><i class="fas fa-building"></i></span>
            <span>
              <strong>{{ $t('messages.hotelMessaging') }}</strong>
              <span class="muted">{{ $t('messages.hintHotel', { hotel: hotelName }) }}</span>
            </span>
          </button>
          <button class="scope-card" :class="{ selected: groupScope === 'global' }" @click="groupScope = 'global'">
            <span class="scope-icon"><i class="fas fa-globe"></i></span>
            <span>
              <strong>{{ $t('messages.globalMessaging') }}</strong>
              <span class="muted">{{ $t('messages.hintGlobal') }}</span>
            </span>
          </button>
        </div>

        <div class="form-group">
          <label>{{ $t('messages.addMembers') }}
            <span class="muted">({{ $t('messages.selectMembersHint') }})</span></label>
          <input v-model="groupUserSearch" type="text" class="input" :placeholder="groupScope === 'global'
            ? $t('messages.searchGlobal')
            : $t('messages.searchColleagues')
            " @input="searchGroupUsers" />
        </div>

        <div v-if="searchingGroupUsers" class="alert alert-info">{{ $t('common.loading') }}</div>

        <div v-else-if="groupUserResults.length" class="user-results">
          <label v-for="u in groupUserResults" :key="u.user_id" class="user-result user-result-select">
            <input v-model="selectedGroupUsers" type="checkbox" :value="u.user_id" class="checkbox" />
            <span class="avatar">{{ initials(u.full_name) }}</span>
            <span class="user-result-body">
              <strong>{{ u.full_name }}</strong>
              <span class="muted">
                {{ roleLabel(u.user_role) }}
                <span v-if="u.hotel_name"> · {{ u.hotel_name }}</span>
              </span>
            </span>
          </label>
        </div>

        <div v-else-if="groupUserSearch.trim()" class="chat-empty muted">
          {{ $t('messages.noUsers') }}
        </div>

        <div class="modal-foot">
          <button type="button" class="btn btn-secondary" @click="closeNewGroup">
            {{ $t('common.cancel') }}
          </button>
          <button type="button" class="btn btn-primary" :disabled="creatingGroup || !groupName.trim()"
            @click="createGroup">
            <i class="fas fa-users"></i>
            {{ creatingGroup ? $t('common.saving') : $t('messages.createGroup') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Group members / manage modal -->
    <div v-if="showGroupManage" class="modal-overlay" @click.self="closeGroupManage">
      <div class="modal new-message-modal">
        <div class="modal-head">
          <h2>
            <i class="fas fa-user-group"></i> {{ $t('messages.membersManage') }} —
            {{ activeChat?.name }}
          </h2>
          <button class="modal-close" @click="closeGroupManage">
            <i class="fas fa-xmark"></i>
          </button>
        </div>

        <div v-if="modalError" class="alert alert-error">{{ modalError }}</div>
        <div v-if="modalSuccess" class="alert alert-success">{{ modalSuccess }}</div>

        <div class="form-group">
          <label>{{ $t('messages.addMembers') }}</label>
          <input v-model="groupUserSearch" type="text" class="input" :placeholder="activeChat?.scope === 'global'
            ? $t('messages.searchGlobal')
            : $t('messages.searchColleagues')
            " @input="searchGroupUsers" />
        </div>

        <div v-if="searchingGroupUsers" class="alert alert-info">{{ $t('common.loading') }}</div>

        <div v-else-if="groupUserResults.length" class="user-results">
          <label v-for="u in groupUserResults" :key="u.user_id" class="user-result user-result-select">
            <input v-model="selectedGroupUsers" type="checkbox" :value="u.user_id" class="checkbox" />
            <span class="avatar">{{ initials(u.full_name) }}</span>
            <span class="user-result-body">
              <strong>{{ u.full_name }}</strong>
              <span class="muted">{{ roleLabel(u.user_role) }}</span>
            </span>
          </label>
          <div class="user-results-foot">
            <button class="btn btn-sm btn-primary" :disabled="addingMembers || !selectedGroupUsers.length"
              @click="addSelectedMembers">
              <i class="fas fa-user-plus"></i> {{ $t('messages.addSelected') }}
            </button>
          </div>
        </div>

        <div v-else-if="groupUserSearch.trim()" class="chat-empty muted">
          {{ $t('messages.noUsers') }}
        </div>

        <h3 class="members-title">
          <i class="fas fa-users"></i> {{ $t('messages.membersManage') }}
        </h3>
        <div v-if="groupMembers.length" class="user-results">
          <div v-for="m in groupMembers" :key="m.user_id" class="user-result">
            <span class="avatar">
              {{ initials(m.full_name) }}
              <span v-if="isOnline(m.user_id)" class="online-dot" :title="$t('messages.online')"></span>
            </span>
            <span class="user-result-body">
              <strong>{{ m.full_name }}</strong>
              <span class="muted">
                {{ roleLabel(m.user_role) }}
                <span v-if="m.user_id === me.user_id"> · {{ $t('messages.you') }}</span>
                <span v-else-if="isOnline(m.user_id)" class="online-label">
                  · {{ $t('messages.online') }}
                </span>
              </span>
            </span>
            <button v-if="m.user_id === me.user_id" class="btn btn-sm btn-danger" :disabled="removingMember"
              @click="removeMember(m.user_id)">
              <i class="fas fa-sign-out-alt"></i> {{ $t('messages.leaveGroup') }}
            </button>
            <button v-else-if="isGroupCreator" class="btn btn-sm btn-secondary" :disabled="removingMember"
              @click="removeMember(m.user_id)">
              <i class="fas fa-user-minus"></i> {{ $t('messages.removeMember') }}
            </button>
          </div>
        </div>
        <div v-else class="chat-empty muted">{{ $t('messages.noGroups') }}</div>
      </div>
    </div>

    <!-- Message context menu -->
    <div v-if="msgMenu.open && msgMenu.msg" class="msg-menu" :style="{ left: msgMenu.x + 'px', top: msgMenu.y + 'px' }"
      @click.stop>
      <div class="msg-menu-reactions">
        <button v-for="e in REACTION_EMOJIS" :key="e" class="emoji-item" :title="$t('messages.react')"
          @click="toggleReaction(msgMenu.msg, e)">
          {{ e }}
        </button>
      </div>
      <button class="msg-menu-item" @click="deleteMessage(msgMenu.msg, 'me')">
        <i class="fas fa-user-minus"></i> {{ $t('messages.deleteForMe') }}
      </button>
      <button v-if="canDeleteEveryone(msgMenu.msg)" class="msg-menu-item danger"
        @click="deleteMessage(msgMenu.msg, 'everyone')">
        <i class="fas fa-trash"></i> {{ $t('messages.deleteEveryone') }}
      </button>
      <div class="msg-menu-divider"></div>
      <button class="msg-menu-item" @click="startReply(msgMenu.msg)">
        <i class="fas fa-reply"></i> {{ $t('messages.reply') }}
      </button>
      <button class="msg-menu-item" @click="togglePin(msgMenu.msg)">
        <i class="fas fa-thumbtack"></i>
        {{ isPinned(msgMenu.msg) ? $t('messages.unpinMessage') : $t('messages.pinMessage') }}
      </button>
      <button class="msg-menu-item" @click="toggleStar(msgMenu.msg)">
        <i class="fas fa-star"></i>
        {{ isStarred(msgMenu.msg) ? $t('messages.unstarMessage') : $t('messages.starMessage') }}
      </button>
      <button class="msg-menu-item" @click="openForwardPicker(msgMenu.msg)">
        <i class="fas fa-forward"></i> {{ $t('messages.forward') }}
      </button>
      <button v-if="msgMenu.msg.body" class="msg-menu-item" @click="saveAsTemplate(msgMenu.msg)">
        <i class="fas fa-rectangle-list"></i> {{ $t('messages.saveAsTemplate') }}
      </button>
      <button v-if="msgMenu.msg.body && !msgMenu.msg.view_once" class="msg-menu-item"
        @click="translateMessage(msgMenu.msg)">
        <i class="fas fa-language"></i> {{ $t('messages.translate') }}
      </button>
      <button v-if="msgMenu.msg.priority !== 'urgent'" class="msg-menu-item" @click="escalateMessage(msgMenu.msg)">
        <i class="fas fa-bell"></i> {{ $t('messages.escalate') }}
      </button>
      <button v-if="activeKind === 'group' && groupInfo?.is_task_group" class="msg-menu-item"
        @click="convertToTask(msgMenu.msg)">
        <i class="fas fa-check-double"></i> {{ $t('messages.convertToTask') }}
      </button>
    </div>

    <!-- View-once media viewer -->
    <div v-if="viewOncePreview" class="modal-overlay" @click.self="closeViewOncePreview">
      <div class="view-once-viewer">
        <button class="modal-close" @click="closeViewOncePreview">
          <i class="fas fa-xmark"></i>
        </button>
        <img v-if="viewOncePreview.url" :src="viewOncePreview.url" alt="view-once" />
        <p class="muted">{{ $t('messages.viewOnceOpened') }}</p>
      </div>
    </div>

    <!-- Call overlay -->
    <div v-if="callManager.call.visible" class="call-overlay">
      <div class="call-card" :class="{ 'call-video': callManager.call.kind !== 'audio' }">
        <video v-if="callManager.call.kind !== 'audio' && callManager.remoteVideoUrl" autoplay playsinline
          :src="callManager.remoteVideoUrl" class="call-remote"></video>
        <video v-if="callManager.call.kind !== 'audio' && callManager.localVideoUrl" autoplay playsinline muted
          :src="callManager.localVideoUrl" class="call-local"></video>

        <div class="call-body">
          <span class="avatar avatar-call">{{ initials(callManager.call.peerName) }}</span>
          <strong class="call-name">{{ callManager.call.peerName }}</strong>
          <span class="muted call-sub">
            <template v-if="callManager.call.status === 'ringing'">
              {{
                callManager.call.direction === 'outgoing'
                  ? $t('messages.calling')
                  : $t('messages.incomingCall', {
                    kind: $t('messages.kinds.' + callManager.call.kind),
                  })
              }}
            </template>
            <template v-else>{{ callManager.formatElapsed(callManager.elapsed) }}</template>
          </span>
        </div>

        <div class="call-actions">
          <template v-if="
            callManager.call.status === 'ringing' && callManager.call.direction === 'incoming'
          ">
            <button class="call-btn call-btn-decline" @click="callManager.declineIncoming">
              <i class="fas fa-phone-slash"></i>
            </button>
            <button class="call-btn call-btn-accept" @click="callManager.acceptIncoming">
              <i class="fas fa-phone"></i>
            </button>
          </template>
          <template v-else>
            <button v-if="callManager.call.kind !== 'audio'" class="call-btn"
              :class="{ 'call-btn-off': callManager.camOff }" @click="callManager.toggleCamera">
              <i class="fas" :class="callManager.camOff ? 'fa-video-slash' : 'fa-video'"></i>
            </button>
            <button class="call-btn" :class="{ 'call-btn-off': callManager.muted }" @click="callManager.toggleMute">
              <i class="fas" :class="callManager.muted ? 'fa-microphone-slash' : 'fa-microphone'"></i>
            </button>
            <button class="call-btn call-btn-decline" @click="callManager.hangup()">
              <i class="fas fa-phone-slash"></i>
            </button>
          </template>
        </div>
      </div>
    </div>

    <!-- Forward picker -->
    <div v-if="showForward" class="modal-overlay" @click.self="closeForwardPicker">
      <div class="modal forward-modal">
        <div class="modal-head">
          <h2><i class="fas fa-forward"></i> {{ $t('messages.forward') }}</h2>
          <button class="modal-close" @click="closeForwardPicker">
            <i class="fas fa-xmark"></i>
          </button>
        </div>
        <div v-if="modalError" class="alert alert-error">{{ modalError }}</div>
        <div class="form-group">
          <input v-model="forwardSearch" type="text" class="input" :placeholder="$t('messages.searchChats')"
            @input="searchForwardTargets" />
        </div>
        <div class="forward-list">
          <button v-for="target in forwardResults" :key="target.kind + target.id" class="forward-item"
            :disabled="forwarding" @click="forwardTo(target)">
            <span class="avatar" :class="target.kind === 'group' ? 'avatar-group' : ''">
              <i v-if="target.kind === 'group'" class="fas fa-users"></i>
              <template v-else>{{ initials(target.name) }}</template>
            </span>
            <span class="forward-item-name">{{ target.name }}</span>
            <i class="fas fa-paper-plane forward-go"></i>
          </button>
          <div v-if="!forwardResults.length" class="muted forward-empty">
            {{ $t('messages.noChats') }}
          </div>
        </div>
      </div>
    </div>

    <!-- Pinned messages panel -->
    <div v-if="showPinned" class="modal-overlay" @click.self="closePinnedPanel">
      <div class="modal side-modal">
        <div class="modal-head">
          <h2><i class="fas fa-thumbtack"></i> {{ $t('messages.pinnedMessages') }}</h2>
          <button class="modal-close" @click="closePinnedPanel">
            <i class="fas fa-xmark"></i>
          </button>
        </div>
        <div class="side-list">
          <button v-for="m in pinnedMsgs" :key="m.message_id" class="side-item" @click="closePinnedPanel">
            <span class="side-item-meta">{{ m.sender?.full_name || $t('messages.you') }}</span>
            <span class="side-item-body">{{ m.body || $t('messages.attachment') }}</span>
            <span class="muted">{{ formatTime(m.created_at) }}</span>
          </button>
          <div v-if="!pinnedMsgs.length" class="muted side-empty">
            {{ $t('messages.noPinned') }}
          </div>
        </div>
      </div>
    </div>

    <!-- Search in chat panel -->
    <div v-if="showSearchPanel" class="modal-overlay" @click.self="closeSearchPanel">
      <div class="modal side-modal">
        <div class="modal-head">
          <h2><i class="fas fa-magnifying-glass"></i> {{ $t('messages.searchInChat') }}</h2>
          <button class="modal-close" @click="closeSearchPanel">
            <i class="fas fa-xmark"></i>
          </button>
        </div>
        <div class="form-group">
          <div class="search-inline">
            <input v-model="searchQuery" type="text" class="input" :placeholder="$t('messages.searchQueryPlaceholder')"
              @keydown.enter="runSearch" />
            <button class="btn btn-primary" :disabled="searchingMessages" @click="runSearch">
              <i class="fas fa-magnifying-glass"></i>
            </button>
          </div>
        </div>
        <div class="side-list">
          <button v-for="m in searchResults" :key="m.message_id" class="side-item" @click="focusResult(m)">
            <span class="side-item-meta">{{ m.sender?.full_name || $t('messages.you') }} ·
              {{ formatTime(m.created_at) }}</span>
            <span class="side-item-body">{{ m.body || $t('messages.attachment') }}</span>
          </button>
          <div v-if="searchingMessages" class="muted side-empty">{{ $t('common.loading') }}</div>
          <div v-else-if="searchQuery && !searchResults.length" class="muted side-empty">
            {{ $t('messages.noResults') }}
          </div>
        </div>
      </div>
    </div>

    <!-- Link room modal -->
    <div v-if="showRoomLinkModal" class="modal-overlay" @click.self="closeRoomLinkModal">
      <div class="modal forward-modal">
        <div class="modal-head">
          <h2><i class="fas fa-hotel"></i> {{ $t('messages.linkRoom') }}</h2>
          <button class="modal-close" @click="closeRoomLinkModal">
            <i class="fas fa-xmark"></i>
          </button>
        </div>
        <div v-if="modalError" class="alert alert-error">{{ modalError }}</div>
        <div class="form-group">
          <input v-model="roomLinkSearch" type="text" class="input" :placeholder="$t('messages.searchRoomsPlaceholder')"
            @input="searchRooms" />
        </div>
        <div class="forward-list">
          <button v-for="room in roomLinkResults" :key="room.room_id" class="forward-item" @click="linkRoom(room)">
            <span class="avatar avatar-room"><i class="fas fa-bed"></i></span>
            <span class="forward-item-name">{{ room.room_number }} <span class="muted">{{ room.room_type || ''
            }}</span></span>
            <i class="fas fa-link forward-go"></i>
          </button>
          <div v-if="!roomLinkResults.length" class="muted forward-empty">
            {{ $t('messages.noRooms') }}
          </div>
        </div>
        <div v-if="roomLinks.length" class="room-link-list">
          <div v-for="link in roomLinks" :key="link.id" class="room-link-item">
            <i class="fas fa-bed"></i> {{ link.room?.room_number || link.room_number }}
            <button class="icon-btn" :title="$t('common.remove')" @click="unlinkRoom(link.id)">
              <i class="fas fa-xmark"></i>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Workspace panel (tenant-wide features) -->
    <div v-if="showWorkspace" class="modal-overlay" @click.self="closeWorkspace">
      <div class="modal workspace-modal">
        <div class="modal-head">
          <h2><i class="fas fa-briefcase"></i> {{ $t('messages.workspace') }}</h2>
          <button class="modal-close" @click="closeWorkspace"><i class="fas fa-xmark"></i></button>
        </div>
        <div v-if="modalError" class="alert alert-error">{{ modalError }}</div>
        <div class="workspace-tabs">
          <button class="workspace-tab" :class="{ active: workspaceTab === 'announcements' }"
            @click="workspaceTab = 'announcements'">
            <i class="fas fa-bullhorn"></i> {{ $t('messages.announcements') }}
          </button>
          <button class="workspace-tab" :class="{ active: workspaceTab === 'meetings' }"
            @click="workspaceTab = 'meetings'">
            <i class="fas fa-calendar-days"></i> {{ $t('messages.meetings') }}
          </button>
          <button class="workspace-tab" :class="{ active: workspaceTab === 'handovers' }"
            @click="workspaceTab = 'handovers'">
            <i class="fas fa-arrows-rotate"></i> {{ $t('messages.handovers') }}
          </button>
          <button class="workspace-tab" :class="{ active: workspaceTab === 'guest' }" @click="workspaceTab = 'guest'">
            <i class="fas fa-envelope"></i> {{ $t('messages.guestSms') }}
          </button>
          <button class="workspace-tab" :class="{ active: workspaceTab === 'nearby' }" @click="
            workspaceTab = 'nearby'; loadNearbyStaff()
            ">
            <i class="fas fa-location-dot"></i> {{ $t('messages.nearbyStaff') }}
          </button>
          <button class="workspace-tab" :class="{ active: workspaceTab === 'escalations' }" @click="
            workspaceTab = 'escalations'; loadEscalations()
            ">
            <i class="fas fa-bell"></i> {{ $t('messages.escalations') }}
          </button>
          <button class="workspace-tab" :class="{ active: workspaceTab === 'sos' }" @click="
            workspaceTab = 'sos'; loadSos()
            ">
            <i class="fas fa-shield-heart"></i> {{ $t('messages.sosAlerts') }}
          </button>
          <button class="workspace-tab" :class="{ active: workspaceTab === 'scheduled' }" @click="
            workspaceTab = 'scheduled'; loadScheduled()
            ">
            <i class="fas fa-clock"></i> {{ $t('messages.scheduledMessages') }}
          </button>
          <button class="workspace-tab" :class="{ active: workspaceTab === 'starred' }" @click="
            workspaceTab = 'starred'; loadStarred()
            ">
            <i class="fas fa-star"></i> {{ $t('messages.starredMessages') }}
          </button>
          <button v-if="isAdmin" class="workspace-tab" :class="{ active: workspaceTab === 'retention' }" @click="
            workspaceTab = 'retention'; loadPolicies()
            ">
            <i class="fas fa-shield"></i> {{ $t('messages.retention') }}
          </button>
        </div>

        <div class="workspace-body">
          <div v-if="workspaceTab === 'announcements'" class="ws-tab">
            <div class="ws-compose">
              <input v-model="announcementTitle" type="text" class="input"
                :placeholder="$t('messages.announcementTitle')" />
              <textarea v-model="announcementBody" rows="2" class="textarea"
                :placeholder="$t('messages.announcementBodyPlaceholder')"></textarea>
              <div class="ws-compose-actions">
                <select v-model="announcementPriority" class="input">
                  <option value="normal">{{ $t('messages.priorityNormal') }}</option>
                  <option value="urgent">{{ $t('messages.priorityUrgent') }}</option>
                </select>
                <button class="btn btn-primary btn-sm" :disabled="savingFeature || !announcementBody.trim()"
                  @click="postAnnouncement">
                  <i class="fas fa-paper-plane"></i> {{ $t('messages.post') }}
                </button>
              </div>
            </div>
            <div v-for="a in announcements" :key="a.id" class="ws-card" :class="{ urgent: a.priority === 'urgent' }">
              <div class="ws-card-head">
                <strong>{{ a.title || $t('messages.announcement') }}</strong>
                <span class="muted">{{ formatTime(a.created_at) }}</span>
              </div>
              <p class="ws-card-body">{{ a.body }}</p>
              <div class="ws-card-foot">
                <span class="muted">
                  {{ a.acknowledgements_count || 0 }} {{ $t('messages.acknowledged') }}
                </span>
                <button v-if="!(a.acknowledgements || []).length" class="btn btn-sm btn-secondary"
                  @click="ackAnnouncement(a.id)">
                  <i class="fas fa-check"></i> {{ $t('messages.acknowledge') }}
                </button>
                <span v-else class="badge badge-green"><i class="fas fa-check"></i> {{ $t('messages.acknowledged')
                }}</span>
              </div>
            </div>
            <div v-if="!announcements.length" class="muted side-empty">
              {{ $t('messages.noAnnouncements') }}
            </div>
          </div>

          <div v-if="workspaceTab === 'meetings'" class="ws-tab">
            <div class="ws-compose">
              <input v-model="meetingTitle" type="text" class="input"
                :placeholder="$t('messages.meetingTitlePlaceholder')" />
              <input v-model="meetingStart" type="datetime-local" class="input" />
              <input v-model="meetingUserSearch" type="text" class="input" :placeholder="$t('messages.searchInvitees')"
                @input="searchMeetingUsers" />
              <div v-if="meetingUserResults.length" class="mention-picker static">
                <button v-for="u in meetingUserResults" :key="u.user_id" type="button" class="mention-item"
                  @mousedown.prevent="toggleMeetingInvitee(u)">
                  <span class="avatar">{{ initials(u.full_name) }}</span>
                  <span class="mention-item-name">@{{ u.full_name }}</span>
                  <i v-if="meetingInvitees.some((invitee) => invitee.user_id === u.user_id)" class="fas fa-check"></i>
                </button>
              </div>
              <div v-if="meetingInvitees.length" class="meeting-invitees">
                <span v-for="u in meetingInvitees" :key="u.user_id" class="invitee-chip">
                  {{ u.full_name }} <i class="fas fa-xmark" @click="toggleMeetingInvitee(u)"></i>
                </span>
              </div>
              <button class="btn btn-primary btn-sm" :disabled="savingFeature || !meetingTitle.trim() || !meetingStart"
                @click="createMeeting">
                <i class="fas fa-calendar-plus"></i> {{ $t('messages.scheduleMeeting') }}
              </button>
            </div>
            <div v-for="m in meetings" :key="m.id" class="ws-card">
              <div class="ws-card-head">
                <strong>{{ m.title }}</strong>
                <span class="muted">{{ formatTime(m.start_at) }}</span>
              </div>
              <div class="ws-card-body">
                <span class="muted">{{ m.organizer?.full_name }}</span>
                <span class="invitee-chip" :class="inv.status" v-for="inv in m.invitees" :key="inv.id">
                  {{ inv.user?.full_name }} · {{ inv.status }}
                </span>
              </div>
              <div v-if="m.my_invitee" class="ws-card-foot">
                <button class="btn btn-sm btn-primary" :disabled="m.my_invitee.status === 'accepted'"
                  @click="respondMeeting(m, 'accepted')">
                  <i class="fas fa-check"></i> {{ $t('messages.accept') }}
                </button>
                <button class="btn btn-sm btn-secondary" :disabled="m.my_invitee.status === 'declined'"
                  @click="respondMeeting(m, 'declined')">
                  <i class="fas fa-xmark"></i> {{ $t('messages.decline') }}
                </button>
              </div>
            </div>
            <div v-if="!meetings.length" class="muted side-empty">
              {{ $t('messages.noMeetings') }}
            </div>
          </div>

          <div v-if="workspaceTab === 'handovers'" class="ws-tab">
            <div class="ws-compose">
              <input v-model="handoverTitle" type="text" class="input" :placeholder="$t('messages.handoverTitle')" />
              <textarea v-model="handoverNotes" rows="2" class="textarea"
                :placeholder="$t('messages.handoverNotesPlaceholder')"></textarea>
              <button class="btn btn-primary btn-sm" :disabled="savingFeature || !handoverNotes.trim()"
                @click="createHandover">
                <i class="fas fa-arrows-rotate"></i> {{ $t('messages.postHandover') }}
              </button>
            </div>
            <div v-for="h in handovers" :key="h.id" class="ws-card">
              <div class="ws-card-head">
                <strong>{{ h.title || $t('messages.shiftHandover') }}</strong>
                <span class="muted">{{ formatTime(h.created_at) }}</span>
              </div>
              <p class="ws-card-body">{{ h.notes }}</p>
              <div class="ws-card-foot">
                <span class="muted">{{ h.creator?.full_name || '' }} → {{ $t('messages.nextShift') }}</span>
                <button v-if="h.status !== 'acknowledged'" class="btn btn-sm btn-secondary" @click="ackHandover(h.id)">
                  <i class="fas fa-check"></i> {{ $t('messages.acknowledge') }}
                </button>
                <span v-else class="badge badge-green"><i class="fas fa-check"></i> {{ $t('messages.acknowledged')
                }}</span>
              </div>
            </div>
            <div v-if="!handovers.length" class="muted side-empty">
              {{ $t('messages.noHandovers') }}
            </div>
          </div>

          <div v-if="workspaceTab === 'guest'" class="ws-tab">
            <div class="ws-compose">
              <input v-model="guestPhone" type="text" class="input"
                :placeholder="$t('messages.guestPhonePlaceholder')" />
              <textarea v-model="guestBody" rows="2" class="textarea"
                :placeholder="$t('messages.guestBodyPlaceholder')"></textarea>
              <button class="btn btn-primary btn-sm"
                :disabled="savingFeature || !guestPhone.trim() || !guestBody.trim()" @click="sendGuestMessage">
                <i class="fas fa-envelope"></i> {{ $t('messages.sendGuestSms') }}
              </button>
            </div>

            <!-- Automated guest SMS toggles: which lifecycle events the hotel auto-texts -->
            <div v-if="notificationEvents.length" class="ws-tab-section">
              <div class="ws-section-head">
                <h4><i class="fas fa-bolt"></i> {{ $t('messages.autoGuestSms') }}</h4>
                <button class="btn btn-secondary btn-sm" :disabled="savingSettings" @click="saveNotificationSettings">
                  <i v-if="savingSettings" class="fas fa-spinner fa-spin" />
                  <i v-else class="fas fa-check" /> {{ $t('messages.saveSettings') }}
                </button>
              </div>
              <div v-if="settingsError" class="alert alert-error">{{ settingsError }}</div>
              <div class="ws-toggle-list">
                <label v-for="ev in notificationEvents" :key="ev.event" class="ws-toggle-row">
                  <span class="ws-toggle-label">{{ ev.label }}
                    <span v-if="ev.schedule_time" class="muted"> · {{ ev.schedule_time }}</span>
                  </span>
                  <input type="checkbox" class="toggle-check" v-model="ev.enabled" />
                </label>
              </div>
            </div>

            <div v-for="g in guestMessages" :key="g.id" class="ws-card">
              <div class="ws-card-head">
                <strong>{{ g.phone }}</strong>
                <span class="muted">{{ formatTime(g.created_at) }}</span>
              </div>
              <p class="ws-card-body">{{ g.body }}</p>
              <div class="ws-card-foot">
                <span class="badge" :class="g.status === 'delivered' ? 'badge-green' : 'badge-blue'">{{ g.status
                }}</span>
              </div>
            </div>
            <div v-if="!guestMessages.length" class="muted side-empty">
              {{ $t('messages.noGuestMessages') }}
            </div>
          </div>

          <div v-if="workspaceTab === 'nearby'" class="ws-tab">
            <div class="ws-compose">
              <div class="ws-compose-actions">
                <input v-model="myLocation" type="text" class="input"
                  :placeholder="$t('messages.myLocationPlaceholder')" />
                <input v-model="myFloor" type="text" class="input" :placeholder="$t('messages.myFloorPlaceholder')" />
                <button class="btn btn-primary btn-sm" @click="updateMyLocation">
                  <i class="fas fa-location-dot"></i> {{ $t('messages.updateLocation') }}
                </button>
              </div>
            </div>
            <div v-for="s in nearbyStaff" :key="s.user_id" class="ws-card">
              <div class="ws-card-head">
                <span class="avatar">{{ initials(s.user?.full_name || '?') }}</span>
                <strong>{{ s.user?.full_name || '' }}</strong>
                <span class="muted">{{ s.updated_at ? formatTime(s.updated_at) : '' }}</span>
              </div>
              <div class="ws-card-body">
                <span class="badge badge-blue"><i class="fas fa-location-dot"></i> {{ s.zone || '—' }}</span>
                <span v-if="s.floor" class="badge badge-blue">{{ s.floor }}</span>
              </div>
            </div>
            <div v-if="!nearbyStaff.length" class="muted side-empty">
              {{ $t('messages.noNearby') }}
            </div>
          </div>

          <div v-if="workspaceTab === 'escalations'" class="ws-tab">
            <div v-for="e in escalations" :key="e.id" class="ws-card">
              <div class="ws-card-head">
                <strong>{{
                  e.escalated_by ? e.escalated_by.full_name : e.escalatedBy?.full_name || ''
                }}</strong>
                <span class="badge badge-red">{{ $t('messages.urgent') }}</span>
                <span class="muted">{{ formatTime(e.escalated_at || e.created_at) }}</span>
              </div>
              <p class="ws-card-body">{{ e.message?.body || $t('messages.attachment') }}</p>
              <div class="ws-card-foot">
                <span class="muted">{{ $t('messages.open') }}</span>
                <button class="btn btn-sm btn-secondary" @click="resolveEscalation(e.id)">
                  <i class="fas fa-check"></i> {{ $t('messages.resolve') }}
                </button>
              </div>
            </div>
            <div v-if="!escalations.length" class="muted side-empty">
              {{ $t('messages.noEscalations') }}
            </div>
          </div>

          <div v-if="workspaceTab === 'sos'" class="ws-tab">
            <button class="btn btn-danger btn-block" :disabled="savingFeature" @click="initiateSos">
              <i class="fas fa-shield-heart"></i> {{ $t('messages.initiateSos') }}
            </button>
            <div v-for="s in sosAlerts" :key="s.id" class="ws-card" :class="{ urgent: s.status === 'active' }">
              <div class="ws-card-head">
                <strong>{{ s.initiator?.full_name || '' }}</strong>
                <span class="badge" :class="s.status === 'active' ? 'badge-red' : 'badge-green'">{{
                  s.status
                }}</span>
                <span class="muted">{{ formatTime(s.created_at) }}</span>
              </div>
              <div class="ws-card-body">
                <span v-if="s.message" class="badge badge-blue"><i class="fas fa-location-dot"></i> {{ s.message
                }}</span>
              </div>
              <div class="ws-card-foot">
                <span class="muted">{{ s.ack_count || 0 }} {{ $t('messages.acknowledged') }}</span>
                <button v-if="s.status === 'active' && !(s.ack_user_ids || []).includes(me.user_id)"
                  class="btn btn-sm btn-secondary" @click="ackSos(s.id)">
                  <i class="fas fa-check"></i> {{ $t('messages.acknowledge') }}
                </button>
                <button v-if="s.status === 'active'" class="btn btn-sm btn-danger" @click="resolveSos(s.id)">
                  <i class="fas fa-check-double"></i> {{ $t('messages.resolve') }}
                </button>
              </div>
            </div>
            <div v-if="!sosAlerts.length" class="muted side-empty">{{ $t('messages.noSos') }}</div>
          </div>

          <div v-if="workspaceTab === 'scheduled'" class="ws-tab">
            <div v-for="s in scheduledList" :key="s.id" class="ws-card">
              <div class="ws-card-head">
                <strong>{{ $t('messages.scheduledMessage') }}</strong>
                <span class="muted">{{ formatTime(s.send_at) }}</span>
              </div>
              <p class="ws-card-body">{{ s.body }}</p>
              <div class="ws-card-foot">
                <span class="badge badge-blue">{{ s.recurrence || 'none' }}</span>
                <button class="btn btn-sm btn-danger" @click="cancelScheduled(s.id)">
                  <i class="fas fa-xmark"></i> {{ $t('messages.cancelSchedule') }}
                </button>
              </div>
            </div>
            <div v-if="!scheduledList.length" class="muted side-empty">
              {{ $t('messages.noScheduled') }}
            </div>
          </div>

          <div v-if="workspaceTab === 'starred'" class="ws-tab">
            <div v-for="m in starredMsgs" :key="m.message_id" class="ws-card">
              <div class="ws-card-head">
                <strong>{{ m.sender?.full_name || $t('messages.you') }}</strong>
                <span class="muted">{{ formatTime(m.created_at) }}</span>
              </div>
              <p class="ws-card-body">{{ m.body || $t('messages.attachment') }}</p>
            </div>
            <div v-if="!starredMsgs.length" class="muted side-empty">
              {{ $t('messages.noStarred') }}
            </div>
          </div>

          <div v-if="workspaceTab === 'retention'" class="ws-tab">
            <div class="ws-compose">
              <div class="ws-compose-actions">
                <input v-model="retentionDays" type="number" min="1" class="input" />
                <button class="btn btn-primary btn-sm" :disabled="savingFeature" @click="saveRetention">
                  <i class="fas fa-shield"></i> {{ $t('messages.addPolicy') }}
                </button>
              </div>
            </div>
            <div v-for="p in policies" :key="p.id" class="ws-card">
              <div class="ws-card-head">
                <strong>{{ p.scope }}</strong>
                <span class="muted">{{ p.days }} {{ $t('messages.days') }}</span>
              </div>
              <div class="ws-card-foot">
                <button class="btn btn-sm btn-danger" @click="deleteRetention(p.id)">
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            </div>
            <div v-if="!policies.length" class="muted side-empty">
              {{ $t('messages.noPolicies') }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- SOS floating button (draggable so it never blocks the composer) -->
    <button
      ref="sosBtn"
      class="sos-floating"
      :class="{ active: activeSos, dragging: sosDragging }"
      :style="sosStyle"
      :title="$t('messages.sosDragHint')"
      @pointerdown="sosDragStart"
      @pointerup="sosDragEnd"
      @pointercancel="sosDragEnd"
      @click="onSosClick"
    >
      <i class="fas fa-shield-heart"></i>
    </button>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { conversationApi, groupApi, messageActionApi, statusApi } from '@/api'
import {
  featuresApi,
  templateApi,
  scheduledApi,
  announcementApi,
  escalationApi,
  handoverApi,
  preferenceApi,
  retentionApi,
  roomLinkApi,
  taskGroupApi,
  staffLocationApi,
  guestMessageApi,
  guestNotificationSettingsApi,
  meetingApi,
  sosApi,
} from '@/api'
import { initEcho, getEcho } from '@/plugins/echo'
import { useCallManager } from '@/composables/useCallManager'
import { isOnline } from '@/composables/usePresence'
import { toast as showToast, toastError } from '@/utils/toast'

const { t } = useI18n()
const router = useRouter()
const authStore = useAuthStore()
// Current-user shortcut, admin flag and tenant hotel name.
const me = computed(() => authStore.user || {})
const isAdmin = computed(() => ['superadmin', 'hotel_admin'].includes(me.value.user_role))
const hotelName = computed(() => authStore.user?.tenant?.hotel_name || 'MRK Hotels')

// Emoji palette offered by the composer picker (hotel-flavoured set).
const EMOJIS = [
  '😀',
  '😄',
  '😁',
  '😂',
  '🤣',
  '😊',
  '😇',
  '🙂',
  '😉',
  '😍',
  '🤩',
  '😘',
  '😎',
  '🤗',
  '🤔',
  '🙃',
  '😴',
  '🥳',
  '😢',
  '😭',
  '😡',
  '😱',
  '😅',
  '🤯',
  '😷',
  '🥺',
  '😤',
  '🤠',
  '😈',
  '💀',
  '👍',
  '👎',
  '👏',
  '🙌',
  '🤝',
  '💪',
  '👌',
  '✌️',
  '🤙',
  '🙏',
  '❤️',
  '🧡',
  '💛',
  '💚',
  '💙',
  '💜',
  '💯',
  '🔥',
  '✨',
  '⭐',
  '🎉',
  '🎊',
  '🎂',
  '🏆',
  '🚀',
  '🎯',
  '💰',
  '📌',
  '✅',
  '❌',
  '⏰',
  '📅',
  '📞',
  '📧',
  '📷',
  '🔒',
  '☕',
  '🍕',
  '🍔',
  '🍺',
  '😴',
  '🎧',
  '💼',
  '🏨',
  '🛎️',
  '🗝️',
  '🧳',
  '🛏️',
  '🚿',
  '🍽️',
]

// Quick-reaction emoji set shown in the message context menu.
const REACTION_EMOJIS = ['❤️', '👍', '👏', '😄', '😮', '😂']

// Core chat state: conversation/group lists with pagination, the active thread, composer draft and list search.
const conversations = ref([])
const groups = ref([])
const convPage = ref(1)
const groupPage = ref(1)
const convMeta = ref(null)
const groupMeta = ref(null)
const activeKind = ref('direct')
const activeId = ref(null)
const messages = ref([])
const groupInfo = ref(null)
const draft = ref('')
const sending = ref(false)
const loadingConvs = ref(false)
const loadingMsgs = ref(false)
const listSearch = ref('')
const error = ref('')
const success = ref('')

// "New direct message" modal state (hotel vs global scope user search).
const showNew = ref(false)
const newScope = ref('hotel')
const userSearch = ref('')
const userResults = ref([])
const searchingUsers = ref(false)
const startingWith = ref(null)

// "New group" modal state, including member selection.
const showNewGroup = ref(false)
const groupName = ref('')
const groupScope = ref('hotel')
const groupUserSearch = ref('')
const groupUserResults = ref([])
const selectedGroupUsers = ref([])
const searchingGroupUsers = ref(false)
const creatingGroup = ref(false)

// Group management modal state (add/remove members) and its feedback messages.
const showGroupManage = ref(false)
const addingMembers = ref(false)
const removingMember = ref(false)
const modalError = ref('')
const modalSuccess = ref('')

// Composer extras: attachment picker/preview, emoji popover and voice-recording state (MediaRecorder handles are non-reactive lets).
const fileInput = ref(null)
const draftInput = ref(null)
const showEmojiPicker = ref(false)
const filePreview = ref(null)
const filePreviewUrl = ref('')
const isRecording = ref(false)
const recordingBlob = ref(null)
const recordingUrl = ref('')
const recordingPreview = ref(false)
const recSeconds = ref(0)
let mediaRecorder = null
let recStream = null
let audioChunks = []
let recTimer = null
let recMimeType = 'audio/webm'

// Debounce handle shared by the list search and the user search inputs.
let searchTimer = null

// Echo channel of the currently open thread; unsubscribed on switch/unmount.
let activeThreadChannel = null

// Message context-menu position/target and view-once viewer state.
const msgMenu = ref({ open: false, x: 0, y: 0, msg: null })
const viewOnceLoading = ref('')
const viewOncePreview = ref(null)
const fileViewOnce = ref(false)
// Disappearing-message timer for outgoing messages (seconds; 0 = off).
const disappearIn = ref(0)
const DISAPPEAR_OPTIONS = [0, 3600, 86400, 604800]
// Whether the WhatsApp-style disappearing-message duration picker is open.
const showDisappearMenu = ref(false)
// Re-render trigger so countdown chips tick down every second.
const countdownTick = ref(0)
let disappearTimer = null
const mentionSuggestions = ref([])
const mentionQuery = ref('')
let mentionTriggerPos = -1

// --- Feature state ---
const replyTo = ref(null)
const sendPriority = ref('normal')
const showPollBuilder = ref(false)
const pollQuestion = ref('')
const pollOptions = ref([])
const pollMultiple = ref(false)
const showTemplatePicker = ref(false)
const templates = ref([])
const templateCategory = ref('')
const showScheduler = ref(false)
const scheduleAt = ref('')
/** Mobile-only dropdown that groups all composer tools. */
const composerMenuOpen = ref(false)

/** Mobile-only dropdown for the page-head actions (Workspace, Refresh, New Message, New Group). */
const headMenuOpen = ref(false)

/** Mobile-only dropdown that groups the thread-header actions. */
const threadHeadMenuOpen = ref(false)

/**
 * Thread-header actions (call/pinned/search/room-link/export/mute/members)
 * rendered inline on desktop and inside the mobile dropdown.
 * @returns {Array<{key: string, icon: string, label: string, handler: Function}>}
 */
// True while the active chat history is being exported, so the button shows a
// spinner and cannot be double-triggered.
const exporting = ref(false)

const threadHeadTools = computed(() => {
  const tools = [
    {
      key: 'search',
      icon: 'fa-magnifying-glass',
      label: t('messages.searchInChat'),
      handler: openSearchPanel,
    },
    {
      key: 'pinned',
      icon: 'fa-thumbtack',
      label: t('messages.pinnedMessages'),
      handler: openPinnedPanel,
    },
    {
      key: 'linkroom',
      icon: 'fa-hotel',
      label: t('messages.linkRoom'),
      handler: openRoomLinkModal,
    },
    {
      key: 'export',
      icon: 'fa-file-export',
      label: t('messages.exportChat'),
      handler: exportHistory,
      busy: exporting.value,
    },
    {
      key: 'mute',
      icon: isChatMuted() ? 'fa-volume-high' : 'fa-volume-xmark',
      label: isChatMuted() ? t('messages.unmuteChat') : t('messages.muteChat'),
      handler: muteCurrentChat,
    },
  ]
  if (activeChat.value?.kind === 'group') {
    tools.unshift({
      key: 'members',
      icon: 'fa-user-group',
      label: t('messages.membersManage'),
      handler: openGroupManage,
    })
  } else {
    tools.unshift(
      {
        key: 'call',
        icon: 'fa-phone',
        label: t('messages.audioCall'),
        handler: () => callManager.startCall('audio', activeChat.value?.id, activeChat.value?.name),
      },
      {
        key: 'video',
        icon: 'fa-video',
        label: t('messages.videoCall'),
        handler: () => callManager.startCall('video', activeChat.value?.id, activeChat.value?.name),
      },
      {
        key: 'share',
        icon: 'fa-display',
        label: t('messages.shareScreen'),
        handler: () => callManager.startCall('share', activeChat.value?.id, activeChat.value?.name),
      },
    )
  }
  return tools
})

/**
 * Runs a thread-header action from the mobile dropdown and closes the menu.
 * @param {{ handler: Function }} tool - The thread-head tool to run.
 */
function threadHeadAction(tool) {
  tool.handler()
  threadHeadMenuOpen.value = false
}

/**
 * Page-head actions rendered inline on desktop and inside the mobile dropdown.
 * @returns {Array<{key: string, icon: string, label: string, handler: Function}>}
 */
const headActions = computed(() => [
  {
    key: 'workspace',
    icon: 'fa-briefcase',
    label: t('messages.workspace'),
    handler: () => openWorkspace(),
  },
  { key: 'refresh', icon: 'fa-rotate', label: t('common.refresh'), handler: refreshAll },
  {
    key: 'newMessage',
    icon: 'fa-paper-plane',
    label: t('messages.newMessage'),
    handler: openNewMessage,
  },
  { key: 'newGroup', icon: 'fa-users', label: t('messages.newGroup'), handler: openNewGroup },
])

/**
 * Runs a page-head action from the mobile dropdown and closes the menu.
 * @param {{ handler: Function }} action - The head action to run.
 */
function headAction(action) {
  action.handler()
  headMenuOpen.value = false
}

/**
 * Composer tools rendered inline on desktop and inside the mobile dropdown.
 * @returns {Array<{key: string, icon: string, title: string, active: boolean, handler: Function}>}
 */
const composerTools = computed(() => [
  {
    key: 'emoji',
    icon: 'fa-face-smile',
    title: t('messages.emoji'),
    active: showEmojiPicker.value,
    handler: () => {
      showEmojiPicker.value = !showEmojiPicker.value
      showDisappearMenu.value = false
    },
  },
  {
    key: 'attach',
    icon: 'fa-paperclip',
    title: t('messages.attachment'),
    active: false,
    handler: () => fileInput.value?.click(),
  },
  {
    key: 'mic',
    icon: isRecording.value ? 'fa-stop' : 'fa-microphone',
    title: isRecording.value ? t('messages.stopRecording') : t('messages.recordVoice'),
    active: false,
    handler: () => (isRecording.value ? stopRecording() : startRecording()),
  },
  {
    key: 'poll',
    icon: 'fa-square-poll-vertical',
    title: t('messages.poll'),
    active: showPollBuilder.value,
    handler: () => {
      showPollBuilder.value = !showPollBuilder.value
      showDisappearMenu.value = false
    },
  },
  {
    key: 'schedule',
    icon: 'fa-clock',
    title: t('messages.scheduleMessage'),
    active: showScheduler.value,
    handler: () => {
      showScheduler.value = !showScheduler.value
      showDisappearMenu.value = false
    },
  },
  {
    key: 'template',
    icon: 'fa-rectangle-list',
    title: t('messages.templates'),
    active: showTemplatePicker.value,
    handler: openTemplatePicker,
  },
  {
    key: 'priority',
    icon: 'fa-flag',
    title:
      sendPriority.value === 'urgent' ? t('messages.priorityNormal') : t('messages.priorityUrgent'),
    active: sendPriority.value === 'urgent',
    handler: togglePriority,
  },
  {
    key: 'disappear',
    icon: 'fa-hourglass-half',
    title: disappearLabel.value,
    active: disappearIn.value > 0,
    handler: toggleDisappearMenu,
  },
])

/**
 * Runs a tool from the mobile dropdown and closes the menu.
 * @param {{ handler: Function }} tool - The composer tool to run.
 */
function toolAction(tool) {
  tool.handler()
  composerMenuOpen.value = false
}
const showForward = ref(false)
const forwardMsg = ref(null)
const forwardSearch = ref('')
const forwardResults = ref([])
const forwarding = ref(false)
const showSearchPanel = ref(false)
const searchQuery = ref('')
const searchResults = ref([])
const searchingMessages = ref(false)
const translateLoading = ref('')
const pinnedMsgs = ref([])
const showPinned = ref(false)
const starredMsgs = ref([])
const showWorkspace = ref(false)
const workspaceTab = ref('announcements')
const announcements = ref([])
const meetings = ref([])
const handovers = ref([])
const escalations = ref([])
const nearbyStaff = ref([])
const guestMessages = ref([])
const roomLinks = ref([])
const policies = ref([])
const preferences = ref([])
const scheduledList = ref([])
const meetingTitle = ref('')
const meetingStart = ref('')
const meetingInvitees = ref([])
const meetingUserSearch = ref('')
const meetingUserResults = ref([])
const handoverTitle = ref('')
const handoverNotes = ref('')
const announcementTitle = ref('')
const announcementBody = ref('')
const announcementPriority = ref('normal')
const guestPhone = ref('')
const guestBody = ref('')
const notificationEvents = ref([])
const savingSettings = ref(false)
const settingsError = ref('')
const retentionDays = ref(30)
const taskGroupType = ref('housekeeping')
const isTaskGroupCreation = ref(false)
const sosAlerts = ref([])
const activeSos = ref(null)
const myLocation = ref('')
const myFloor = ref('')
const showRoomLinkModal = ref(false)

// Draggable SOS floating button — kept clear of the composer/send button.
const SOS_STORAGE_KEY = 'mrk_sos_position'
const SOS_DRAG_THRESHOLD = 6
const sosBtn = ref(null)
const sosPos = ref(null) // { x, y } in viewport px, or null to use CSS defaults.
const sosPointerOffset = { x: 0, y: 0 }
const sosDragging = ref(false)
const sosMoved = ref(false)

const sosStyle = computed(() =>
  sosPos.value
    ? {
        position: 'fixed',
        top: `${sosPos.value.y}px`,
        left: `${sosPos.value.x}px`,
        right: 'auto',
        bottom: 'auto',
      }
    : null,
)

function loadSosPosition() {
  try {
    const raw = localStorage.getItem(SOS_STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw)
    if (Number.isFinite(parsed?.x) && Number.isFinite(parsed?.y)) sosPos.value = parsed
  } catch {
    /* Ignore malformed persisted position. */
  }
}

function persistSosPosition() {
  try {
    localStorage.setItem(SOS_STORAGE_KEY, JSON.stringify(sosPos.value))
  } catch {
    /* Ignore storage failures. */
  }
}

function clampSos(x, y) {
  const size = 54
  const pad = 8
  return {
    x: Math.min(Math.max(x, pad), window.innerWidth - size - pad),
    y: Math.min(Math.max(y, pad), window.innerHeight - size - pad),
  }
}

function sosDragStart(e) {
  if (e.pointerType === 'mouse' && e.button !== 0) return
  sosDragging.value = true
  sosMoved.value = false
  const rect = sosBtn.value?.getBoundingClientRect()
  sosPointerOffset.x = e.clientX - rect.left
  sosPointerOffset.y = e.clientY - rect.top
  e.target?.setPointerCapture?.(e.pointerId)
  const move = (ev) => {
    const { x, y } = clampSos(ev.clientX - sosPointerOffset.x, ev.clientY - sosPointerOffset.y)
    if (!sosMoved.value && Math.abs(ev.clientX - e.clientX) + Math.abs(ev.clientY - e.clientY) > SOS_DRAG_THRESHOLD) {
      sosMoved.value = true
    }
    sosPos.value = { x, y }
  }
  const up = () => {
    sosDragging.value = false
    persistSosPosition()
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
}

function sosDragEnd(e) {
  if (sosDragging.value) {
    try {
      e.target?.releasePointerCapture?.(e.pointerId)
    } catch {
      /* Ignore. */
    }
    sosDragging.value = false
    persistSosPosition()
  }
}

function onSosClick() {
  if (sosMoved.value) return
  openSosPanel()
}
const roomLinkSearch = ref('')
const roomLinkResults = ref([])
const savingFeature = ref(false)

// Voice/video call manager; call events surface as transient success banners.
const callManager = useCallManager({
  notify: (key) => {
    success.value = t(`messages.${key}`)
    setTimeout(() => {
      if (success.value === t(`messages.${key}`)) success.value = ''
    }, 4000)
  },
})

// The chat currently open in the thread pane (null when none is selected).
const activeChat = computed(
  () =>
    chats.value.find((chat) => chat.kind === activeKind.value && chat.id === activeId.value) ||
    null,
)

// Status-ring state: per-user has/unviewed flags plus whether I have a live status.
const statusByUser = ref({})
const myStatusHas = ref(false)

/**
 * Loads the status map used to draw avatar rings. Failures are swallowed:
 * statuses are decorative and must never break chat.
 * @returns {Promise<void>}
 */
async function loadStatusMap() {
  try {
    const res = await statusApi.index({ per_page: 100 })
    const map = {}
    let mine = false
    for (const s of res.data.data || []) {
      if (s.user_id === me.value.user_id) {
        mine = true
        continue
      }
      const entry = map[s.user_id] || (map[s.user_id] = { has: true, viewed: true })
      if (!s.viewed) entry.viewed = false
    }
    statusByUser.value = map
    myStatusHas.value = mine
  } catch {
    // statuses are optional adornment; a failed fetch must not break chat
  }
}

/**
 * Returns the status-ring class for a direct chat avatar ('viewed' | 'unviewed').
 * @param {Object} chat - Unified chat-list item.
 * @returns {string} Ring class, or '' for groups/users without a status.
 */
function avatarStatusClass(chat) {
  if (chat.kind !== 'direct') return ''
  const st = statusByUser.value[chat.participant_id]
  if (!st) return ''
  return st.viewed ? 'status-ring viewed' : 'status-ring unviewed'
}

/**
 * Navigates to the status viewer for the given user.
 * @param {number} userId - The user whose status should be shown.
 */
function openUserStatus(userId) {
  if (!userId) return
  router.push({ name: 'hotel-statuses', query: { user: userId } })
}

/** Opens my own status viewer, or the status composer when I have none live. */
function openMyStatus() {
  if (myStatusHas.value) {
    router.push({ name: 'hotel-statuses', query: { user: me.value.user_id } })
  } else {
    openStatusCompose()
  }
}

/** Navigates to the status composer. */
function openStatusCompose() {
  router.push({ name: 'hotel-statuses', query: { compose: 1 } })
}

// Unified chat list: direct conversations and groups normalized to one shape, newest activity first.
const chats = computed(() => {
  const all = [
    ...conversations.value.map((conversation) => ({
      kind: 'direct',
      id: conversation.conversation_id,
      name: conversation.other_participant?.full_name || '—',
      participant_id: conversation.other_participant?.user_id,
      scope: conversation.scope,
      hotel_name: conversation.other_participant?.hotel_name,
      unread_count: conversation.unread_count || 0,
      last_message_at: conversation.last_message_at || conversation.created_at,
      last_message: conversation.last_message,
      created_at: conversation.created_at,
    })),
    ...groups.value.map((group) => ({
      kind: 'group',
      id: group.group_conversation_id,
      name: group.name,
      scope: group.scope,
      unread_count: group.unread_count || 0,
      member_count: group.member_count || 0,
      last_message_at: group.last_message_at || group.created_at,
      last_message: group.last_message,
      created_at: group.created_at,
    })),
  ]
  return all.sort((itemA, itemB) =>
    String(itemB.last_message_at || '').localeCompare(String(itemA.last_message_at || '')),
  )
})

// True while either the conversation or the group list has another page.
const hasMore = computed(() =>
  convMeta.value?.next_page_url || groupMeta.value?.next_page_url ? true : false,
)

// Members of the active group (empty for direct chats).
const groupMembers = computed(() => groupInfo.value?.members || [])

// True when the current user created the active group (grants moderation rights).
const isGroupCreator = computed(
  () => activeChat.value?.kind === 'group' && groupInfo.value?.created_by === me.value.user_id,
)

// Users that can be @-mentioned in the active thread (group members, or the direct counterpart).
const mentionableUsers = computed(() => {
  if (!activeId.value) return []
  if (activeKind.value === 'group') {
    return groupMembers.value.filter((member) => member.user_id !== me.value.user_id)
  }
  const other = activeChat.value
  return other ? [{ user_id: other.id, full_name: other.name }] : []
})

/**
 * Builds up to two uppercase initials for an avatar placeholder.
 * @param {string} name - Full name to derive initials from.
 * @returns {string} The initials, or '?' when no name is available.
 */
function initials(name) {
  return (name || '?')
    .split(' ')
    .filter(Boolean)
    .map((word) => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

/**
 * Resolves a staff role key to its translated display label.
 * @param {string} role - Role key (e.g. 'manager', 'housekeeping').
 * @returns {string} Translated label, or the raw key when unknown.
 */
function roleLabel(role) {
  const map = {
    hotel_admin: t('common.roles.hotelAdmin'),
    manager: t('common.roles.manager'),
    accountant: t('common.roles.accountant'),
    receptionist: t('common.roles.receptionist'),
    procurement_officer: t('common.roles.procurementOfficer'),
    housekeeping: t('common.roles.housekeeping'),
    kitchen: t('common.roles.kitchen'),
    waiter: t('common.roles.waiter'),
    bartender: t('common.roles.bartender'),
    staff: t('common.roles.staff'),
  }
  return map[role] || role
}

/**
 * Formats a timestamp compactly: HH:mm today, "yesterday", else a short date.
 * @param {string} iso - ISO datetime string.
 * @returns {string} Display string ('' for missing/invalid input).
 */
function formatTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const now = new Date()
  const today = d.toDateString() === now.toDateString()
  if (today) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return t('messages.yesterday')
  return d.toLocaleDateString([], { day: '2-digit', month: 'short' })
}

/**
 * Formats the time left before a disappearing message self-destructs.
 * @param {string} iso - ISO deadline of the message.
 * @returns {string} Remaining time ("1h 04m", "23m 05s", "45s") or '' when gone/missing.
 */
function disappearCountdown(iso) {
  if (!iso) return ''
  const remaining = new Date(iso).getTime() - Date.now()
  if (remaining <= 0) return ''
  const total = Math.floor(remaining / 1000)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`
  if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, '0')}s`
  return `${seconds}s`
}

/**
 * Removes any message whose disappearing deadline has passed and nudges the
 * countdown chips to re-render. Runs once per second while a thread is open.
 */
function expireDisappearing() {
  if (!activeId.value) return
  const now = Date.now()
  for (let i = messages.value.length - 1; i >= 0; i--) {
    const msg = messages.value[i]
    if (msg.disappears_at && new Date(msg.disappears_at).getTime() <= now) {
      removeMessageLocally(msgId(msg), activeKind.value)
    }
  }
  countdownTick.value++
}

/**
 * Builds the one-line preview for a chat-list entry, with icon placeholders
 * for deleted/view-once/audio/image/file messages and a "You:" prefix for
 * messages sent by the current user.
 * @param {Object} chat - Unified chat-list item carrying last_message.
 * @returns {string} Preview text.
 */
function lastPreview(chat) {
  const lm = chat.last_message
  if (!lm) return ''
  const who = lm.sender_id === me.value.user_id ? `${t('messages.you')}: ` : ''
  if (lm.deleted) return `${who}${t('messages.messageDeleted')}`
  if (lm.view_once && !lm.media_url) return `${who}🕐 ${t('messages.viewOnceMessage')}`
  if (lm.type === 'audio') return `${who}🎤 ${t('messages.previewAudio')}`
  if (lm.type === 'image') return `${who}🖼️ ${t('messages.previewImage')}`
  if (lm.type === 'file') return `${who}📎 ${t('messages.previewFile')}`
  const disappearing = lm.disappears_at ? '⏳ ' : ''
  return `${who}${disappearing}${lm.body || ''}`
}

/**
 * Computes the WhatsApp-style tick state for an outgoing message.
 * Groups use the aggregate read count; direct chats use read/delivered timestamps.
 * @param {Object} msg - The message record.
 * @returns {string|null} 'read' | 'delivered' | null.
 */
function msgTicks(msg) {
  if (activeKind.value === 'group') {
    if (msg.read_by_count > 0) return 'read'
    if (msg.delivered_at) return 'delivered'
    return null
  }
  if (msg.read_at) return 'read'
  if (msg.delivered_at) return 'delivered'
  return null
}

/**
 * Tooltip for the read tick: "seen by N" in groups, plain "read" otherwise.
 * @param {Object} msg - The message record.
 * @returns {string} Localized tooltip text.
 */
function seenByTitle(msg) {
  if (activeKind.value === 'group' && msg.read_by_count > 0) {
    return t('messages.seenBy', { count: msg.read_by_count })
  }
  return t('messages.read')
}

/**
 * Returns the id field matching the active chat kind (direct vs group).
 * @param {Object} msg - The message record.
 * @returns {number|undefined} The message id for the active kind.
 */
function msgId(msg) {
  return activeKind.value === 'group' ? msg.group_message_id : msg.message_id
}

/**
 * Returns the API message-type discriminator for the active chat kind.
 * @returns {string} 'group' or 'conversation'.
 */
function messageType() {
  return activeKind.value === 'group' ? 'group' : 'conversation'
}

/**
 * Checks delete-for-everyone rights: own messages always; group creators may
 * also moderate other members' messages.
 * @param {Object} msg - The message record.
 * @returns {boolean}
 */
function canDeleteEveryone(msg) {
  return (
    msg.sender_id === me.value.user_id || (activeKind.value === 'group' && isGroupCreator.value)
  )
}

/**
 * Opens the message context menu at the click position; the next document
 * click closes it (once listener).
 * @param {Object} msg - The message the menu acts on.
 * @param {MouseEvent} event - The triggering click (provides x/y).
 */
function openMsgMenu(msg, event) {
  msgMenu.value = { open: true, x: event.clientX, y: event.clientY, msg }
  document.addEventListener('click', closeMsgMenu, { once: true })
}

/** Closes the message context menu and clears its target. */
function closeMsgMenu() {
  msgMenu.value = { open: false, x: 0, y: 0, msg: null }
}

/**
 * Deletes a message via the API, then mirrors the result locally.
 * @param {Object} msg - The message to delete.
 * @param {string} scope - 'me' (remove for myself) or 'everyone'.
 * @returns {Promise<void>}
 */
async function deleteMessage(msg, scope) {
  closeMsgMenu()
  try {
    const id = msgId(msg)
    if (activeKind.value === 'group')
      await messageActionApi.deleteGroupMessage(activeId.value, id, scope)
    else await messageActionApi.deleteConversationMessage(activeId.value, id, scope)
    applyDeletedLocally(msg, scope)
  } catch (err) {
    error.value = flattenError(err)
  }
}

/**
 * Applies a deletion to local state: removes the row entirely for 'me',
 * or scrubs body/media and flags it deleted for 'everyone'.
 * @param {Object} msg - The local message object to mutate.
 * @param {string} scope - 'me' | 'everyone'.
 */
function applyDeletedLocally(msg, scope) {
  const idx = messages.value.indexOf(msg)
  if (scope === 'me') {
    if (idx > -1) messages.value.splice(idx, 1)
    refreshThreadPreview()
  } else {
    msg.deleted = true
    msg.body = null
    msg.media_url = null
    msg.media_mime = null
    const chat = activeChat.value
    if (chat) {
      chat.last_message = {
        sender_id: msg.sender_id,
        type: msg.type,
        body: null,
        media_url: null,
        deleted: true,
        created_at: msg.created_at,
      }
    }
  }
}

/** Recomputes the active chat's list preview from the last remaining message. */
function refreshThreadPreview() {
  const chat = activeChat.value
  if (!chat) return
  const last = messages.value[messages.value.length - 1]
  chat.last_message = last
    ? {
      sender_id: last.sender_id,
      type: last.type,
      body: last.body,
      media_url: last.media_url,
      view_once: last.view_once,
      deleted: last.deleted,
      created_at: last.created_at,
    }
    : null
  chat.last_message_at = last ? last.created_at : chat.created_at
}

/**
 * Toggles an emoji reaction on a message and stores the returned summary.
 * @param {Object} msg - The message to react to.
 * @param {string} emoji - The reaction emoji.
 * @returns {Promise<void>}
 */
async function toggleReaction(msg, emoji) {
  try {
    const res = await messageActionApi.toggleReaction(messageType(), msgId(msg), emoji)
    msg.reactions = res.data.reactions || []
  } catch (err) {
    error.value = flattenError(err)
  }
}

/**
 * Opens a view-once message: marks it viewed server-side and shows the media
 * overlay. No-op for own, already-viewed or deleted messages.
 * @param {Object} msg - The view-once message.
 * @returns {Promise<void>}
 */
async function openViewOnce(msg) {
  if (msg.viewed_at || msg.deleted || msg.sender_id === me.value.user_id) return
  viewOnceLoading.value = msgId(msg)
  try {
    const res =
      activeKind.value === 'group'
        ? await messageActionApi.openGroupViewOnce(activeId.value, msg.group_message_id)
        : await messageActionApi.openViewOnce(activeId.value, msg.message_id)
    msg.viewed_at = res.data.viewed_at
    viewOncePreview.value = { url: res.data.media_url, msg }
  } catch (err) {
    error.value = flattenError(err)
  } finally {
    viewOnceLoading.value = ''
  }
}

/** Closes the view-once media overlay. */
function closeViewOncePreview() {
  viewOncePreview.value = null
}

// --- Feature actions ---
/**
 * Checks whether a message is pinned (flag on the record or in the pinned list).
 * @param {Object} msg - The message record.
 * @returns {boolean}
 */
function isPinned(msg) {
  return (
    !!msg.pinned_at || pinnedMsgs.value.some((pinnedMsg) => pinnedMsg.message_id === msgId(msg))
  )
}
/**
 * Checks whether a message is starred (flag on the record or in the starred list).
 * @param {Object} msg - The message record.
 * @returns {boolean}
 */
function isStarred(msg) {
  return (
    !!msg.starred_at || starredMsgs.value.some((starredMsg) => starredMsg.message_id === msgId(msg))
  )
}

/**
 * Pins or unpins a message and refreshes the pinned-panel data.
 * @param {Object} msg - The message to pin/unpin.
 * @returns {Promise<void>}
 */
async function togglePin(msg) {
  closeMsgMenu()
  const was = isPinned(msg)
  try {
    await (was
      ? featuresApi.unpin({ message_type: messageType(), message_id: msgId(msg) })
      : featuresApi.pin({ message_type: messageType(), message_id: msgId(msg) }))
    msg.pinned_at = was ? null : new Date().toISOString()
    loadPinned()
    toast(was ? t('messages.unpinned') : t('messages.pinned'))
  } catch (err) {
    toastError(flattenError(err))
  }
}

/**
 * Stars or unstars a message and refreshes the starred list.
 * @param {Object} msg - The message to star/unstar.
 * @returns {Promise<void>}
 */
async function toggleStar(msg) {
  closeMsgMenu()
  const was = isStarred(msg)
  try {
    await (was
      ? featuresApi.unstar({ message_type: messageType(), message_id: msgId(msg) })
      : featuresApi.star({ message_type: messageType(), message_id: msgId(msg) }))
    msg.starred_at = was ? null : new Date().toISOString()
    loadStarred()
    toast(was ? t('messages.unstarred') : t('messages.starred'))
  } catch (err) {
    toastError(flattenError(err))
  }
}

/** Loads the pinned messages of the active thread. @returns {Promise<void>} */
async function loadPinned() {
  if (!activeId.value) return
  try {
    const res = await featuresApi.pinned({
      chat_type: messageType(),
      chat_id: activeId.value,
    })
    pinnedMsgs.value = res.data.data || []
  } catch {
    /* Ignore: non-fatal. */
  }
}

/** Loads the current user's starred messages. @returns {Promise<void>} */
async function loadStarred() {
  try {
    const res = await featuresApi.starred()
    starredMsgs.value = res.data.data || []
  } catch {
    /* Ignore: non-fatal. */
  }
}

/** Opens the pinned-messages panel, lazy-loading its data. */
function openPinnedPanel() {
  showPinned.value = true
  loadPinned()
}
/** Closes the pinned-messages panel. */
function closePinnedPanel() {
  showPinned.value = false
}

/**
 * Casts a vote on a poll message and applies the returned poll state.
 * @param {Object} msg - The message carrying the poll.
 * @param {Object} option - The chosen poll option.
 * @returns {Promise<void>}
 */
async function votePoll(msg, option) {
  if (msg.poll.closed || msg.poll.my_vote === option.poll_option_id) return
  try {
    await featuresApi.vote({
      poll_id: msg.poll.poll_id,
      option_ids: [option.poll_option_id],
    })
    applyVoteLocally(msg, option.poll_option_id)
  } catch (err) {
    toastError(flattenError(err))
  }
}

/**
 * Updates the local poll state after a successful vote so the bubble reflects
 * the new tally and the caller's selection without a full re-fetch.
 * @param {Object} msg - The poll message.
 * @param {string} optionId - The newly selected poll option id.
 */
function applyVoteLocally(msg, optionId) {
  const previousVote = msg.poll.my_vote
  const options = msg.poll.options.map((opt) => {
    let votes = opt.votes
    if (opt.poll_option_id === optionId) votes = previousVote === optionId ? votes : votes + 1
    else if (opt.poll_option_id === previousVote) votes = votes - 1
    return { ...opt, votes, pct: 0 }
  })
  const total = options.reduce((sum, opt) => sum + opt.votes, 0)
  msg.poll = {
    ...msg.poll,
    my_vote: optionId,
    total_votes: total,
    options: options.map((opt) => ({
      ...opt,
      pct: total > 0 ? Math.round((opt.votes / total) * 100) : 0,
    })),
  }
}

/**
 * Translates a message body via the features API and stores the result on the
 * message; guarded against double-clicks while a translation is in flight.
 * @param {Object} msg - The message to translate.
 * @returns {Promise<void>}
 */
async function translateMessage(msg) {
  const id = msgId(msg)
  if (translateLoading.value === id) return
  translateLoading.value = id
  closeMsgMenu()
  try {
    const target = translateTarget(msg.body)
    const res = await featuresApi.translate({ text: msg.body, target })
    msg.translation = res.data.text
    msg.translated_lang = target
    msg.translation_provider = res.data.provider
  } catch (err) {
    toastError(flattenError(err))
  } finally {
    translateLoading.value = ''
  }
}

/** Swahili content words used to guess whether a message is written in Swahili. */
const SWAHILI_MARKERS = [
  'habari', 'karibu', 'asante', 'tafadhali', 'ndiyo', 'hapana', 'chumba', 'vyumba',
  'ufunguo', 'funguo', 'maji', 'chakula', 'kifungua', 'bili', 'malipo', 'mapokezi',
  'taulo', 'sabuni', 'shampuu', 'mto', 'blanketi', 'moto', 'baridi', 'kelele',
  'utulivu', 'choo', 'msaada', 'dharura', 'wifi', 'imeharibika', 'imekamilika',
  'nimekuja', 'tayari', 'haraka', 'sawa', 'kesho', 'leo', 'mgeni', 'wageni',
  'ukumbi', 'ghorofa', 'jikoni', 'vinywaji', 'kahawa', 'chai', 'sukari',
  'thibitisha', 'ghairi', 'fungua', 'funga', 'usalama', 'mlinzi', 'meneja',
  'nitaangalia', 'nimesoma', 'dozi', 'usafishaji', 'matengenezo', 'njoo',
]

/**
 * Picks the output language for a message so the service returns the
 * opposite-language translation: English text is sent with target 'sw' (EN→SW)
 * and Swahili text with target 'en' (SW→EN).
 * @param {string} text - The message body.
 * @returns {'en'|'sw'} The output language code to request.
 */
function translateTarget(text) {
  const normalized = (text || '').toLowerCase()
  const swahili = SWAHILI_MARKERS.some((word) => normalized.includes(word))
  return swahili ? 'en' : 'sw'
}

/**
 * Friendly, localized label for a translated message's language code.
 * @param {string} code - 'en' or 'sw'.
 * @returns {string} The language name.
 */
function langLabel(code) {
  return code === 'sw' ? t('messages.langSwahili') : t('messages.langEnglish')
}

/**
 * Saves a message body as a reusable quick template (name = first 40 chars).
 * @param {Object} msg - The message whose body becomes the template.
 * @returns {Promise<void>}
 */
async function saveAsTemplate(msg) {
  closeMsgMenu()
  try {
    await templateApi.store({ name: msg.body.slice(0, 40), category: 'general', body: msg.body })
    toast(t('messages.templateSaved'))
  } catch (err) {
    modalError.value = flattenError(err)
  }
}

/** Loads message templates, filtered by the selected category when set. @returns {Promise<void>} */
async function loadTemplates() {
  try {
    const res = await templateApi.index({ category: templateCategory.value || undefined })
    templates.value = res.data.data || []
  } catch {
    /* Ignore: non-fatal. */
  }
}
/** Opens the template picker and loads the template list. */
function openTemplatePicker() {
  showTemplatePicker.value = true
  showDisappearMenu.value = false
  loadTemplates()
}
/** Closes the template picker. */
function closeTemplatePicker() {
  showTemplatePicker.value = false
}
/**
 * Appends a template body to the draft and refocuses the composer.
 * @param {Object} tpl - The selected template record.
 */
function insertTemplate(tpl) {
  draft.value = (draft.value ? draft.value + ' ' : '') + tpl.body
  closeTemplatePicker()
  requestAnimationFrame(() => draftInput.value?.focus())
}

/** Closes the message scheduler popover. */
function closeScheduler() {
  showScheduler.value = false
}
/**
 * Schedules the current draft for later delivery; requires a send date and a
 * non-empty draft. Clears the draft and refreshes the scheduled list on success.
 * @returns {Promise<void>}
 */
async function scheduleMessage() {
  if (!scheduleAt.value || !draft.value.trim()) {
    modalError.value = t('messages.scheduleNeedsDate')
    return
  }
  savingFeature.value = true
  try {
    await scheduledApi.store({
      recipient_type: activeKind.value === 'group' ? 'group' : 'conversation',
      recipient_id: activeId.value,
      body: draft.value.trim(),
      send_at: new Date(scheduleAt.value).toISOString(),
    })
    draft.value = ''
    closeScheduler()
    loadScheduled()
    toast(t('messages.scheduled'))
  } catch (err) {
    modalError.value = flattenError(err)
  } finally {
    savingFeature.value = false
  }
}

/** Loads the user's scheduled (not yet sent) messages. @returns {Promise<void>} */
async function loadScheduled() {
  try {
    const res = await scheduledApi.index()
    scheduledList.value = res.data.data || []
  } catch {
    /* Ignore: non-fatal. */
  }
}
/**
 * Cancels a scheduled message and removes it from the local list.
 * @param {number} id - The scheduled-message id.
 * @returns {Promise<void>}
 */
async function cancelScheduled(id) {
  try {
    await scheduledApi.destroy(id)
    scheduledList.value = scheduledList.value.filter((scheduled) => scheduled.id !== id)
  } catch (err) {
    modalError.value = flattenError(err)
  }
}

/**
 * Opens the forward picker holding the given message as the payload.
 * @param {Object} msg - The message to forward.
 */
function openForwardPicker(msg) {
  forwardMsg.value = msg
  showForward.value = true
  forwardSearch.value = ''
  forwardResults.value = []
  searchForwardTargets()
}
/** Closes the forward picker and releases the held message. */
function closeForwardPicker() {
  showForward.value = false
  forwardMsg.value = null
}
/** Searches direct conversations and groups in parallel as forward targets. @returns {Promise<void>} */
async function searchForwardTargets() {
  try {
    const [c, g] = await Promise.all([
      conversationApi.index({ search: forwardSearch.value, per_page: 10 }),
      groupApi.index({ search: forwardSearch.value, per_page: 10 }),
    ])
    forwardResults.value = [
      ...(c.data.data || []).map((conversation) => ({
        kind: 'conversation',
        id: conversation.conversation_id,
        name: conversation.participant_name || t('messages.directChat'),
      })),
      ...(g.data.data || []).map((group) => ({
        kind: 'group',
        id: group.group_conversation_id,
        name: group.name,
      })),
    ]
  } catch {
    /* Ignore: non-fatal. */
  }
}
/**
 * Forwards the held message to the chosen target chat.
 * @param {Object} target - Forward target ({ kind: 'conversation'|'group', id }).
 * @returns {Promise<void>}
 */
async function forwardTo(target) {
  forwarding.value = true
  try {
    await featuresApi.forward({
      message_type: messageType(forwardMsg.value),
      message_id: msgId(forwardMsg.value),
      target_type: target.kind,
      target_id: target.id,
    })
    toast(t('messages.forwarded'))
    closeForwardPicker()
  } catch (err) {
    modalError.value = flattenError(err)
  } finally {
    forwarding.value = false
  }
}

/** Opens the in-chat search panel with a fresh query. */
function openSearchPanel() {
  showSearchPanel.value = true
  searchQuery.value = ''
  searchResults.value = []
}
/** Closes the in-chat search panel. */
function closeSearchPanel() {
  showSearchPanel.value = false
}
/** Runs the message search within the active chat. @returns {Promise<void>} */
async function runSearch() {
  if (!searchQuery.value.trim() || !activeId.value) return
  searchingMessages.value = true
  try {
    const res = await featuresApi.search({
      query: searchQuery.value.trim(),
      message_type: activeKind.value,
      chat_id: activeId.value,
    })
    searchResults.value = res.data.data || []
  } catch (err) {
    modalError.value = flattenError(err)
  } finally {
    searchingMessages.value = false
  }
}
/**
 * Closes the search panel and smooth-scrolls to the chosen result bubble.
 * @param {Object} message - A search-result message (needs message_id for the DOM anchor).
 */
function focusResult(message) {
  closeSearchPanel()
  const el = document.getElementById('msg-' + message.message_id)
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

/** Exports the active chat history as CSV and triggers a browser download. @returns {Promise<void>} */
async function exportHistory() {
  if (exporting.value) return
  exporting.value = true
  try {
    const res = await featuresApi.exportCsv({
      chat_type: activeKind.value === 'group' ? 'group' : 'conversation',
      chat_id: activeId.value,
    })
    const blob = new Blob([res.data], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'chat-export.csv'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    toast(t('messages.exported'))
  } catch (err) {
    toastError(flattenError(err))
  } finally {
    exporting.value = false
  }
}

/** Opens the room-link modal and pre-loads the room search. */
function openRoomLinkModal() {
  showRoomLinkModal.value = true
  roomLinkSearch.value = ''
  roomLinkResults.value = []
  searchRooms()
}
/** Closes the room-link modal. */
function closeRoomLinkModal() {
  showRoomLinkModal.value = false
}
/** Searches rooms by number for the link picker. @returns {Promise<void>} */
async function searchRooms() {
  try {
    const res = await roomLinkApi.searchRooms(roomLinkSearch.value)
    roomLinkResults.value = res.data.data || res.data || []
  } catch {
    /* Ignore: non-fatal. */
  }
}
/**
 * Maps the internal chat kind (direct|group) to the backend room-link API
 * values (conversation|group).
 * @param {string} kind - Internal chat kind.
 * @returns {string} Backend chat type accepted by the room-link endpoints.
 */
function roomLinkChatType(kind) {
  return kind === 'group' ? 'group' : 'conversation'
}
/**
 * Links a room to the active chat (used for service-request context).
 * @param {Object} room - The room record to link.
 * @returns {Promise<void>}
 */
async function linkRoom(room) {
  try {
    const res = await roomLinkApi.store({
      chat_type: roomLinkChatType(activeKind.value),
      chat_id: activeId.value,
      room_id: room.room_id,
    })
    if (!roomLinks.value.some((roomLink) => roomLink.id === res.data.item.id))
      roomLinks.value.push(res.data.item)
    closeRoomLinkModal()
    loadRoomLinks()
    toast(t('messages.roomLinked'))
  } catch (err) {
    modalError.value = flattenError(err)
  }
}
/**
 * Removes a room link from the active chat.
 * @param {number} id - The room-link id.
 * @returns {Promise<void>}
 */
async function unlinkRoom(id) {
  try {
    await roomLinkApi.destroy(id)
    roomLinks.value = roomLinks.value.filter((roomLink) => roomLink.id !== id)
  } catch (err) {
    modalError.value = flattenError(err)
  }
}
/** Loads the rooms linked to the active chat. @returns {Promise<void>} */
async function loadRoomLinks() {
  try {
    const res = await roomLinkApi.index({
      chat_type: roomLinkChatType(activeKind.value),
      chat_id: activeId.value,
    })
    roomLinks.value = res.data.data || []
  } catch {
    /* Ignore: non-fatal. */
  }
}

/**
 * Converts a message into a task on the (task) group after confirmation.
 * @param {Object} msg - The message to convert.
 * @returns {Promise<void>}
 */
async function convertToTask(msg) {
  closeMsgMenu()
  if (!confirm(t('messages.confirmConvertTask'))) return
  try {
    await taskGroupApi.convert(activeId.value, msgId(msg), { task_type: taskGroupType.value })
    toast(t('messages.taskConverted'))
  } catch (err) {
    modalError.value = flattenError(err)
  }
}

/**
 * Opens the tenant workspace panel on the given tab and loads its data.
 * @param {string} [tab] - Workspace tab key (defaults to 'announcements').
 */
function openWorkspace(tab) {
  workspaceTab.value = tab || 'announcements'
  showWorkspace.value = true
  loadWorkspace()
}
/** Closes the workspace panel. */
function closeWorkspace() {
  showWorkspace.value = false
}
/** Eagerly loads every workspace tab's data so tab switches are instant. @returns {Promise<void>} */
async function loadWorkspace() {
  loadAnnouncements()
  loadMeetings()
  loadHandovers()
  loadEscalations()
  loadNearbyStaff()
  loadGuestMessages()
  loadNotificationSettings()
  loadSos()
  loadPolicies()
  loadPreferences()
  loadScheduled()
}
/** Loads tenant announcements. @returns {Promise<void>} */
async function loadAnnouncements() {
  try {
    const res = await announcementApi.index()
    announcements.value = res.data.data || []
  } catch {
    /* Ignore: non-fatal. */
  }
}
/** Posts a new announcement (body required), then reloads the list. @returns {Promise<void>} */
async function postAnnouncement() {
  if (!announcementBody.value.trim()) return
  savingFeature.value = true
  try {
    await announcementApi.store({
      title: announcementTitle.value.trim() || null,
      body: announcementBody.value.trim(),
      priority: announcementPriority.value,
    })
    announcementTitle.value = ''
    announcementBody.value = ''
    loadAnnouncements()
    toast(t('messages.announcementPosted'))
  } catch (err) {
    modalError.value = flattenError(err)
  } finally {
    savingFeature.value = false
  }
}
/**
 * Acknowledges an announcement and reloads the list.
 * @param {number} id - The announcement id.
 * @returns {Promise<void>}
 */
async function ackAnnouncement(id) {
  try {
    await announcementApi.acknowledge(id)
    loadAnnouncements()
  } catch (err) {
    modalError.value = flattenError(err)
  }
}
/** Loads meetings the user is involved in. @returns {Promise<void>} */
async function loadMeetings() {
  try {
    const res = await meetingApi.index()
    meetings.value = res.data.data || []
  } catch {
    /* Ignore: non-fatal. */
  }
}
/** Searches inviteable users for the meeting form (clears results on empty query). @returns {Promise<void>} */
async function searchMeetingUsers() {
  if (!meetingUserSearch.value) {
    meetingUserResults.value = []
    return
  }
  try {
    const res = await meetingApi.searchUsers(meetingUserSearch.value)
    meetingUserResults.value = res.data.data || res.data || []
  } catch {
    /* Ignore: non-fatal. */
  }
}
/**
 * Toggles a user in/out of the meeting invitee selection.
 * @param {Object} user - The user record to toggle.
 */
function toggleMeetingInvitee(user) {
  const i = meetingInvitees.value.findIndex((invitee) => invitee.user_id === user.user_id)
  if (i >= 0) meetingInvitees.value.splice(i, 1)
  else meetingInvitees.value.push(user)
}
/** Creates a meeting (title + start required) and reloads the list. @returns {Promise<void>} */
async function createMeeting() {
  if (!meetingTitle.value.trim() || !meetingStart.value) {
    modalError.value = t('messages.meetingNeedsFields')
    return
  }
  savingFeature.value = true
  try {
    await meetingApi.store({
      title: meetingTitle.value.trim(),
      start_at: new Date(meetingStart.value).toISOString(),
      invitee_ids: meetingInvitees.value.map((invitee) => invitee.user_id),
    })
    meetingTitle.value = ''
    meetingStart.value = ''
    meetingInvitees.value = []
    loadMeetings()
    toast(t('messages.meetingCreated'))
  } catch (err) {
    modalError.value = flattenError(err)
  } finally {
    savingFeature.value = false
  }
}
/**
 * Responds to a meeting invitation (accept/decline), then reloads.
 * @param {Object} meeting - The meeting record.
 * @param {string} status - The response status.
 * @returns {Promise<void>}
 */
async function respondMeeting(meeting, status) {
  try {
    await meetingApi.respond(meeting.id, { status })
    loadMeetings()
  } catch (err) {
    modalError.value = flattenError(err)
  }
}
/** Loads shift handover notes. @returns {Promise<void>} */
async function loadHandovers() {
  try {
    const res = await handoverApi.index()
    handovers.value = res.data.data || []
  } catch {
    /* Ignore: non-fatal. */
  }
}
/** Posts a shift handover note (notes required), then reloads the list. @returns {Promise<void>} */
async function createHandover() {
  if (!handoverNotes.value.trim()) return
  savingFeature.value = true
  try {
    await handoverApi.store({
      title: handoverTitle.value.trim() || null,
      notes: handoverNotes.value.trim(),
    })
    handoverTitle.value = ''
    handoverNotes.value = ''
    loadHandovers()
    toast(t('messages.handoverPosted'))
  } catch (err) {
    modalError.value = flattenError(err)
  } finally {
    savingFeature.value = false
  }
}
/**
 * Acknowledges a handover note and reloads the list.
 * @param {number} id - The handover id.
 * @returns {Promise<void>}
 */
async function ackHandover(id) {
  try {
    await handoverApi.acknowledge(id)
    loadHandovers()
  } catch (err) {
    modalError.value = flattenError(err)
  }
}
/** Loads staff who recently reported their location (nearby tab). @returns {Promise<void>} */
async function loadNearbyStaff() {
  try {
    const res = await staffLocationApi.nearby()
    nearbyStaff.value = res.data.data || res.data || []
  } catch {
    /* Ignore: non-fatal. */
  }
}
/** Publishes my current zone/floor so colleagues can find me. @returns {Promise<void>} */
async function updateMyLocation() {
  try {
    await staffLocationApi.update({ zone: myLocation.value, floor: myFloor.value || null })
    toast(t('messages.locationUpdated'))
  } catch (err) {
    modalError.value = flattenError(err)
  }
}
/** Loads outbound guest SMS messages. @returns {Promise<void>} */
async function loadGuestMessages() {
  try {
    const res = await guestMessageApi.index()
    guestMessages.value = res.data.data || []
  } catch {
    /* Ignore: non-fatal. */
  }
}
/** Loads the automated guest-SMS toggles. @returns {Promise<void>} */
async function loadNotificationSettings() {
  try {
    const res = await guestNotificationSettingsApi.index()
    notificationEvents.value = res.data.events || []
  } catch {
    /* Ignore: non-fatal. */
  }
}
/** Persists the automated guest-SMS toggles. @returns {Promise<void>} */
async function saveNotificationSettings() {
  savingSettings.value = true
  settingsError.value = ''
  try {
    const res = await guestNotificationSettingsApi.update({
      events: notificationEvents.value.map((ev) => ({ event: ev.event, enabled: ev.enabled })),
    })
    notificationEvents.value = res.data.events || []
    toast(t('messages.settingsSaved'))
  } catch (err) {
    settingsError.value = err.response?.data?.message || err.message || t('common.actionFailed')
  } finally {
    savingSettings.value = false
  }
}
/** Sends an SMS to a guest phone number (phone + body required). @returns {Promise<void>} */
async function sendGuestMessage() {
  if (!guestPhone.value.trim() || !guestBody.value.trim()) return
  savingFeature.value = true
  try {
    await guestMessageApi.store({ phone: guestPhone.value.trim(), body: guestBody.value.trim() })
    guestBody.value = ''
    loadGuestMessages()
    toast(t('messages.guestSmsSent'))
  } catch (err) {
    modalError.value = flattenError(err)
  } finally {
    savingFeature.value = false
  }
}
/** Loads open message escalations. @returns {Promise<void>} */
async function loadEscalations() {
  try {
    const res = await escalationApi.index()
    escalations.value = res.data.data || []
  } catch {
    /* Ignore: non-fatal. */
  }
}
/**
 * Escalates a message to management.
 * @param {Object} msg - The message to escalate.
 * @returns {Promise<void>}
 */
async function escalateMessage(msg) {
  closeMsgMenu()
  try {
    await escalationApi.store({
      message_type: messageType(msg),
      message_id: msgId(msg),
    })
    toast(t('messages.escalated'))
  } catch (err) {
    modalError.value = flattenError(err)
  }
}
/**
 * Marks an escalation resolved (default resolution text), then reloads.
 * @param {number} id - The escalation id.
 * @returns {Promise<void>}
 */
async function resolveEscalation(id) {
  try {
    await escalationApi.resolve(id, { resolution: t('messages.escalationResolved') })
    loadEscalations()
  } catch (err) {
    modalError.value = flattenError(err)
  }
}
/** Loads message retention policies. @returns {Promise<void>} */
async function loadPolicies() {
  try {
    const res = await retentionApi.index()
    policies.value = res.data.data || []
  } catch {
    /* Ignore: non-fatal. */
  }
}
/** Saves the global retention window (in days), then reloads policies. @returns {Promise<void>} */
async function saveRetention() {
  savingFeature.value = true
  try {
    await retentionApi.store({ scope: 'global', days: retentionDays.value })
    loadPolicies()
    toast(t('messages.retentionSaved'))
  } catch (err) {
    modalError.value = flattenError(err)
  } finally {
    savingFeature.value = false
  }
}
/**
 * Deletes a retention policy, then reloads the list.
 * @param {number} id - The policy id.
 * @returns {Promise<void>}
 */
async function deleteRetention(id) {
  try {
    await retentionApi.destroy(id)
    loadPolicies()
  } catch (err) {
    modalError.value = flattenError(err)
  }
}
/** Loads the user's per-chat notification preferences. @returns {Promise<void>} */
async function loadPreferences() {
  try {
    const res = await preferenceApi.index()
    preferences.value = res.data || []
  } catch {
    /* Ignore: non-fatal. */
  }
}
/**
 * Toggles the muted flag of the active chat and toasts the outcome. @returns {Promise<void>} */
async function muteCurrentChat() {
  const scope = activeKind.value === 'group' ? 'group' : 'conversation'
  const pref = preferences.value.find(
    (preference) => preference.scope === scope && preference.target_id === activeId.value,
  )
  const next = !(pref && pref.muted)
  try {
    await preferenceApi.store({
      scope,
      target_id: activeId.value,
      muted: next,
    })
    await loadPreferences()
    toast(next ? t('messages.muted') : t('messages.unmuted'))
  } catch (err) {
    toastError(flattenError(err))
  }
}
/**
 * Checks whether the active chat is muted in the loaded preferences.
 * @returns {boolean}
 */
function isChatMuted() {
  const scope = activeKind.value === 'group' ? 'group' : 'conversation'
  return preferences.value.some(
    (preference) =>
      preference.scope === scope && preference.target_id === activeId.value && preference.muted,
  )
}
/** Loads SOS alerts for the tenant. @returns {Promise<void>} */
async function loadSos() {
  try {
    const res = await sosApi.index()
    sosAlerts.value = res.data.data || []
  } catch {
    /* Ignore: non-fatal. */
  }
}
/** Opens the workspace panel directly on the SOS tab. */
function openSosPanel() {
  openWorkspace('sos')
}
/** Triggers an SOS alert with my location after a confirmation prompt. @returns {Promise<void>} */
async function initiateSos() {
  if (!confirm(t('messages.confirmSos'))) return
  savingFeature.value = true
  try {
    const res = await sosApi.initiate({ message: myLocation.value || null })
    activeSos.value = res.data.sos_alert
    toast(t('messages.sosInitiated'))
  } catch (err) {
    modalError.value = flattenError(err)
  } finally {
    savingFeature.value = false
  }
}
/**
 * Acknowledges an SOS alert (someone is responding), then reloads.
 * @param {number} id - The SOS alert id.
 * @returns {Promise<void>}
 */
async function ackSos(id) {
  try {
    await sosApi.acknowledge(id)
    loadSos()
  } catch (err) {
    modalError.value = flattenError(err)
  }
}
/**
 * Resolves an SOS alert with the default resolution text; also clears the
 * floating banner when it was my own active alert.
 * @param {number} id - The SOS alert id.
 * @returns {Promise<void>}
 */
async function resolveSos(id) {
  try {
    await sosApi.resolve(id, { resolution: t('messages.sosResolvedDefault') })
    loadSos()
    if (activeSos.value && activeSos.value.id === id) activeSos.value = null
  } catch (err) {
    modalError.value = flattenError(err)
  }
}
/**
 * Shows a transient toast via the global helper (imported from utils/toast).
 * @param {string} text - Message to display.
 */
function toast(text) {
  showToast(text)
}

/**
 * Resolves a user id to a full name for @mention highlighting.
 * @param {number} userId - The mentioned user's id.
 * @returns {string|null} The full name, or null when not mentionable here.
 */
function mentionName(userId) {
  const u = mentionableUsers.value.find((user) => user.user_id === userId)
  return u ? u.full_name : null
}

/**
 * Splits a message body into segments, flagging @mentions for highlighted
 * rendering. Mention names are regex-escaped before matching.
 * @param {Object} msg - The message record (uses body + mentions).
 * @returns {Array<{text: string, isMention: boolean}>} Renderable segments.
 */
function renderBody(msg) {
  const body = msg.body || ''
  const names = (msg.mentions || []).map((mention) => mentionName(mention.user_id)).filter(Boolean)
  if (!names.length) return [{ text: body, isMention: false }]
  const esc = names.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const pattern = new RegExp('(@(?:' + esc.join('|') + '))\\b', 'gi')
  const parts = []
  let last = 0
  let m
  while ((m = pattern.exec(body)) !== null) {
    if (m.index > last) parts.push({ text: body.slice(last, m.index), isMention: false })
    parts.push({ text: body.slice(m.index + 1, m.index + m[1].length), isMention: true })
    last = m.index + m[1].length
  }
  if (last < body.length) parts.push({ text: body.slice(last), isMention: false })
  return parts
}

/**
 * Extracts the ids of users @-mentioned in a draft body.
 * @param {string} body - The raw draft text.
 * @returns {number[]} Mentioned user ids.
 */
function collectMentions(body) {
  const ids = []
  for (const u of mentionableUsers.value) {
    const pattern = new RegExp(`@${u.full_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
    if (pattern.test(body)) ids.push(u.user_id)
  }
  return ids
}

/** Detects an active "@query" at the caret and fills the mention suggestion list. */
function onDraftInput() {
  const el = draftInput.value
  const caret = el?.selectionStart ?? draft.value.length
  const before = draft.value.slice(0, caret)
  const match = before.match(/(^|\s)@([\w\s]*)$/)
  if (match) {
    mentionTriggerPos = match.index + match[1].length
    mentionQuery.value = match[2]
    mentionSuggestions.value = mentionableUsers.value.filter((user) =>
      user.full_name.toLowerCase().startsWith(mentionQuery.value.toLowerCase()),
    )
  } else {
    mentionSuggestions.value = []
    mentionTriggerPos = -1
  }
}

/**
 * Replaces the partial @query at the caret with the chosen user's full name.
 * @param {Object} user - The user picked from the suggestions.
 */
function applyMention(user) {
  if (mentionTriggerPos < 0) return
  const before = draft.value.slice(0, mentionTriggerPos)
  const rest = draft.value.slice(mentionTriggerPos + 1 + mentionQuery.value.length)
  draft.value = before + '@' + user.full_name + ' '
  if (rest) draft.value += rest
  mentionSuggestions.value = []
  mentionTriggerPos = -1
  requestAnimationFrame(() => draftInput.value?.focus())
}

/**
 * Flattens Laravel-style validation errors into a single readable message.
 * @param {Object} err - The caught Axios error.
 * @returns {string} Flattened error message (localized fallback included).
 */
function flattenError(err) {
  const errors = err.response?.data?.errors
  if (errors) return Object.values(errors).flat().join(' ')
  return err.response?.data?.message || t('common.actionFailed')
}

/** Scrolls the message list to the newest message (after the next paint). */
function scrollToBottom() {
  requestAnimationFrame(() => {
    const el = document.querySelector('.chat-messages')
    if (el) el.scrollTop = el.scrollHeight
  })
}

/**
 * Scrolls to the message the given one replies to, when present in the DOM.
 * @param {Object} msg - The message whose reply target should be revealed.
 */
function scrollToMessage(msg) {
  const id = msg.reply_to?.message_id
  if (!id) return
  const el = document.getElementById('msg-' + id)
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

/**
 * Normalizes a raw group record into the unified chat-list item shape.
 * @param {Object} group - The group record from the API.
 * @returns {Object} A chat-list item ({ kind: 'group', ... }).
 */
function toGroupItem(group) {
  return {
    kind: 'group',
    id: group.group_conversation_id,
    name: group.name,
    scope: group.scope,
    unread_count: group.unread_count || 0,
    member_count: group.member_count || 0,
    last_message_at: group.last_message_at || group.created_at,
    last_message: group.last_message,
    created_at: group.created_at,
  }
}

/**
 * Loads a page of direct conversations, honouring the list search.
 * @param {number} [page=1] - Page to fetch.
 * @param {boolean} [replace=true] - Replace the list; when false, append deduped.
 * @returns {Promise<void>}
 */
async function loadConversations(page = 1, replace = true) {
  loadingConvs.value = true
  error.value = ''
  try {
    const res = await conversationApi.index({ page, per_page: 20, search: listSearch.value })
    const items = res.data.data || []
    if (replace) conversations.value = items
    else {
      const ids = new Set(conversations.value.map((conversation) => conversation.conversation_id))
      conversations.value.push(
        ...items.filter((conversation) => !ids.has(conversation.conversation_id)),
      )
    }
    convPage.value = page
    convMeta.value = res.data
  } catch (err) {
    error.value = flattenError(err)
  } finally {
    loadingConvs.value = false
  }
}

/**
 * Loads a page of group conversations, honouring the list search.
 * @param {number} [page=1] - Page to fetch.
 * @param {boolean} [replace=true] - Replace the list; when false, append deduped.
 * @returns {Promise<void>}
 */
async function loadGroups(page = 1, replace = true) {
  loadingConvs.value = true
  error.value = ''
  try {
    const res = await groupApi.index({ page, per_page: 20, search: listSearch.value })
    const items = res.data.data || []
    if (replace) groups.value = items
    else {
      const ids = new Set(groups.value.map((group) => group.group_conversation_id))
      groups.value.push(...items.filter((group) => !ids.has(group.group_conversation_id)))
    }
    groupPage.value = page
    groupMeta.value = res.data
  } catch (err) {
    error.value = flattenError(err)
  } finally {
    loadingConvs.value = false
  }
}

/** Appends the next page of whichever chat lists have more results. */
function loadMoreChats() {
  if (convMeta.value?.next_page_url && convPage.value < (convMeta.value.last_page || 1)) {
    loadConversations(convPage.value + 1, false)
  }
  if (groupMeta.value?.next_page_url && groupPage.value < (groupMeta.value.last_page || 1)) {
    loadGroups(groupPage.value + 1, false)
  }
}

/** Debounced chat-list search (400ms) reloading both conversations and groups. */
function onListSearch() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(async () => {
    await loadConversations(1)
    await loadGroups(1)
  }, 400)
}

/**
 * Opens a chat: resets thread-local UI (recording, previews, menus), subscribes
 * to its realtime channel, loads messages (and group info), then marks it read.
 * @param {Object} chat - The unified chat-list item to open.
 * @returns {Promise<void>}
 */
async function openChat(chat) {
  activeKind.value = chat.kind
  activeId.value = chat.id
  subscribeThread()
  loadingMsgs.value = true
  error.value = ''
  recordingPreview.value = false
  cancelRecording()
  cancelFilePreview()
  showEmojiPicker.value = false
  showDisappearMenu.value = false
  composerMenuOpen.value = false
  threadHeadMenuOpen.value = false
  mentionSuggestions.value = []
  mentionTriggerPos = -1
  viewOncePreview.value = null
  replyTo.value = null
  showPinned.value = false
  showSearchPanel.value = false
  pinnedMsgs.value = []
  loadPinned()
  loadRoomLinks()
  loadPreferences()
  try {
    if (chat.kind === 'group') {
      const res = await groupApi.show(chat.id)
      messages.value = res.data.messages || []
      groupInfo.value = res.data.group || null
      if (groupInfo.value) {
        chat.last_message_at = groupInfo.value.last_message_at || chat.last_message_at
        chat.member_count = groupInfo.value.member_count || chat.member_count
      }
    } else {
      const res = await conversationApi.show(chat.id)
      messages.value = res.data.messages || []
      chat.last_message_at = res.data.conversation?.last_message_at || chat.last_message_at
      groupInfo.value = null
    }
    scrollToBottom()
    markReadSilently()
  } catch (err) {
    error.value = flattenError(err)
  } finally {
    loadingMsgs.value = false
  }
}

/** Closes the active thread, unsubscribing from its Echo channel first. */
function closeThread() {
  if (activeThreadChannel) {
    activeThreadChannel.unsubscribe()
    activeThreadChannel = null
  }
  if (disappearTimer) {
    clearInterval(disappearTimer)
    disappearTimer = null
  }
  activeId.value = null
  messages.value = []
  groupInfo.value = null
  mentionSuggestions.value = []
  mentionTriggerPos = -1
  viewOncePreview.value = null
  composerMenuOpen.value = false
  threadHeadMenuOpen.value = false
}

/** Marks the active thread read in the background and mirrors the read state locally (ticks/unread badge). */
function markReadSilently() {
  if (!activeId.value) return
  if (activeKind.value === 'group') {
    groupApi.markRead(activeId.value).catch(() => { })
    const chat = activeChat.value
    if (chat) chat.unread_count = 0
  } else {
    conversationApi.markRead(activeId.value).catch(() => { })
    const chat = activeChat.value
    if (chat) chat.unread_count = 0
    messages.value.forEach((message) => {
      if (message.sender_id !== me.value.user_id) message.read_at = new Date().toISOString()
    })
  }
}

/**
 * Updates the active chat's list preview with a just-sent message.
 * @param {Object} item - The sent message record.
 */
function updateActiveChatPreview(item) {
  const chat = activeChat.value
  if (!chat) return
  chat.last_message_at = item.created_at
  chat.last_message = {
    sender_id: item.sender_id,
    type: item.type,
    body: item.body,
    media_url: item.media_url,
    view_once: item.view_once,
    deleted: item.deleted,
    created_at: item.created_at,
  }
  chat.unread_count = 0
}

/**
 * Sends the current draft to the active chat, attaching mentions, priority,
 * an optional reply reference and an optional poll (>= 2 non-empty options).
 * @returns {Promise<void>}
 */
async function sendMessage() {
  const body = draft.value.trim()
  if (!body || !activeId.value) return
  sending.value = true
  error.value = ''
  try {
    const api = activeKind.value === 'group' ? groupApi : conversationApi
    const payload = { body, mention_ids: collectMentions(body), priority: sendPriority.value }
    if (replyTo.value) {
      payload.reply_to_id = msgId(replyTo.value)
    }
    if (disappearIn.value > 0) {
      payload.disappears_in = disappearIn.value
    }
    if (
      showPollBuilder.value &&
      pollQuestion.value.trim() &&
      pollOptions.value.filter((option) => option.trim()).length >= 2
    ) {
      payload.poll = {
        question: pollQuestion.value.trim(),
        options: pollOptions.value.filter((option) => option.trim()).map((option) => option.trim()),
        multiple: pollMultiple.value,
      }
    }
    const res = await api.send(activeId.value, payload)
    messages.value.push(res.data.item)
    draft.value = ''
    clearComposerExtras()
    updateActiveChatPreview(res.data.item)
    scrollToBottom()
  } catch (err) {
    error.value = flattenError(err)
  } finally {
    sending.value = false
  }
}

/** Resets composer extras (reply, poll, template picker, scheduler) after a successful send. */
function clearComposerExtras() {
  replyTo.value = null
  showPollBuilder.value = false
  pollQuestion.value = ''
  pollOptions.value = []
  pollMultiple.value = false
  showTemplatePicker.value = false
  showScheduler.value = false
  scheduleAt.value = ''
  showDisappearMenu.value = false
  disappearIn.value = 0
}

/**
 * Enters reply mode for a message and focuses the composer.
 * @param {Object} msg - The message being replied to.
 */
function startReply(msg) {
  replyTo.value = msg
  closeMsgMenu()
  requestAnimationFrame(() => draftInput.value?.focus())
}

/** Exits reply mode. */
function cancelReply() {
  replyTo.value = null
}

/** Toggles the outgoing message priority between 'normal' and 'urgent'. */
function togglePriority() {
  sendPriority.value = sendPriority.value === 'urgent' ? 'normal' : 'urgent'
}

/**
 * Label for the disappearing-message composer toggle (e.g. "Disappearing: 1 day").
 * @returns {string} Localized label for the currently selected duration.
 */
const disappearLabel = computed(() => {
  return `${t('messages.disappearing')}: ${disappearOptionLabel(disappearIn.value)}`
})

/**
 * Localized label for a disappearing-message duration option.
 * @param {number} seconds - Duration in seconds (0 = off).
 * @returns {string} Human-readable label for the option.
 */
function disappearOptionLabel(seconds) {
  const map = {
    0: t('messages.disappearOff'),
    3600: t('messages.disappear1h'),
    86400: t('messages.disappear1d'),
    604800: t('messages.disappear7d'),
  }
  return map[seconds] || t('messages.disappearOff')
}

/**
 * Opens/closes the disappearing-message duration picker, closing the other
 * composer popovers so only one is visible at a time.
 */
function toggleDisappearMenu() {
  showEmojiPicker.value = false
  showPollBuilder.value = false
  showScheduler.value = false
  showTemplatePicker.value = false
  showDisappearMenu.value = !showDisappearMenu.value
}

/**
 * Applies the chosen disappearing-message duration and closes the picker.
 * @param {number} seconds - Duration in seconds (0 disables it).
 */
function setDisappear(seconds) {
  disappearIn.value = seconds
  showDisappearMenu.value = false
}

/** Adds an empty option row to the poll builder. */
function addPollOption() {
  pollOptions.value.push('')
}

/**
 * Removes a poll-builder option row.
 * @param {number} index - Index of the option to remove.
 */
function removePollOption(index) {
  pollOptions.value.splice(index, 1)
}

/**
 * Shared upload path for attachments/voice notes: posts FormData to the active
 * chat, appends the returned message and updates the list preview.
 * @param {FormData} fd - The multipart payload.
 * @param {Function} [onDone] - Optional callback after a successful send.
 * @returns {Promise} The request promise chain.
 */
function sendFormData(fd, onDone) {
  sending.value = true
  error.value = ''
  const api = activeKind.value === 'group' ? groupApi : conversationApi
  return api
    .send(activeId.value, fd)
    .then((res) => {
      messages.value.push(res.data.item)
      updateActiveChatPreview(res.data.item)
      scrollToBottom()
      if (onDone) onDone(res)
    })
    .catch((err) => {
      error.value = flattenError(err)
    })
    .finally(() => {
      sending.value = false
    })
}

/**
 * Stages a picked file for preview before sending (10MB limit). The input is
 * reset immediately so picking the same file twice still fires change.
 * @param {Event} event - The file input change event.
 */
function onFilePicked(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  if (file.size > 10 * 1024 * 1024) {
    error.value = t('messages.fileTooLarge')
    return
  }
  if (filePreviewUrl.value) URL.revokeObjectURL(filePreviewUrl.value)
  filePreview.value = file
  filePreviewUrl.value = URL.createObjectURL(file)
  showEmojiPicker.value = false
}

/** Discards the staged attachment and revokes its object URL. */
function cancelFilePreview() {
  if (filePreviewUrl.value) URL.revokeObjectURL(filePreviewUrl.value)
  filePreview.value = null
  filePreviewUrl.value = ''
  fileViewOnce.value = false
}

/** Sends the staged attachment with an inferred type (audio/image/file) and the view-once flag. */
function sendFilePreview() {
  const file = filePreview.value
  if (!file || !activeId.value) return
  const fd = new FormData()
  fd.append('media', file)
  if (fileViewOnce.value) fd.append('view_once', 'true')
  if (disappearIn.value > 0) fd.append('disappears_in', String(disappearIn.value))
  if (file.type?.startsWith('audio/')) fd.append('type', 'audio')
  else if (file.type?.startsWith('image/')) fd.append('type', 'image')
  else fd.append('type', 'file')
  const url = filePreviewUrl.value
  sendFormData(fd).then(() => {
    if (url) URL.revokeObjectURL(url)
    filePreview.value = null
    filePreviewUrl.value = ''
    fileViewOnce.value = false
    disappearIn.value = 0
  })
}

/**
 * Formats a byte count as KB/MB for the attachment preview.
 * @param {number} bytes - File size in bytes.
 * @returns {string} Human-readable size ('' for 0/undefined).
 */
function formatFileSize(bytes) {
  if (!bytes) return ''
  const kb = bytes / 1024
  if (kb < 1024) return `${Math.round(kb)} KB`
  return `${(kb / 1024).toFixed(1)} MB`
}

/**
 * Inserts an emoji at the composer caret and restores focus/selection.
 * @param {string} emoji - The emoji to insert.
 */
function insertEmoji(emoji) {
  const el = draftInput.value
  const start = el?.selectionStart ?? draft.value.length
  const end = el?.selectionEnd ?? draft.value.length
  draft.value = draft.value.slice(0, start) + emoji + draft.value.slice(end)
  if (el) {
    requestAnimationFrame(() => {
      el.focus()
      el.selectionStart = el.selectionEnd = start + emoji.length
    })
  }
}

/**
 * Starts a voice-note recording via MediaRecorder and a 1s elapsed timer.
 * Surfaces a localized error when mic access/APIs are unavailable.
 * @returns {Promise<void>}
 */
async function startRecording() {
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
    error.value = t('messages.recordingUnsupported')
    return
  }
  cancelFilePreview()
  showEmojiPicker.value = false
  try {
    recStream = await navigator.mediaDevices.getUserMedia({ audio: true })
    mediaRecorder = new MediaRecorder(recStream)
    recMimeType = mediaRecorder.mimeType || 'audio/webm'
    audioChunks = []
    recordingBlob.value = null
    recordingUrl.value = ''
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size) audioChunks.push(event.data)
    }
    mediaRecorder.onstop = () => {
      const blob = new Blob(audioChunks, { type: recMimeType })
      recordingBlob.value = blob
      recordingUrl.value = URL.createObjectURL(blob)
    }
    mediaRecorder.start()
    isRecording.value = true
    recSeconds.value = 0
    recTimer = setInterval(() => {
      recSeconds.value += 1
    }, 1000)
  } catch {
    error.value = t('messages.recordingUnsupported')
  }
}

/** Stops the recording, releases the mic and opens the preview player. */
function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    try {
      mediaRecorder.stop()
    } catch {
      // Already stopped by the stream ending.
    }
  }
  if (recStream) recStream.getTracks().forEach((tr) => tr.stop())
  clearInterval(recTimer)
  isRecording.value = false
  recStream = null
  recordingPreview.value = true
}

/** Cancels the recording, releasing the mic and discarding all captured audio. */
function cancelRecording() {
  clearInterval(recTimer)
  if (recStream) recStream.getTracks().forEach((tr) => tr.stop())
  isRecording.value = false
  recStream = null
  mediaRecorder = null
  recordingBlob.value = null
  recordingUrl.value = ''
  recSeconds.value = 0
  recordingPreview.value = false
}

/** Sends the recorded voice note as an audio attachment, then resets the recorder. */
function sendRecording() {
  if (!recordingBlob.value || !activeId.value) return
  const fd = new FormData()
  fd.append('media', recordingBlob.value, `voice-${Date.now()}.webm`)
  fd.append('type', 'audio')
  const url = recordingUrl.value
  sendFormData(fd).then(() => {
    if (url) URL.revokeObjectURL(url)
    recordingPreview.value = false
    recordingBlob.value = null
    recordingUrl.value = ''
    recSeconds.value = 0
  })
}

/** Reloads conversations, groups and the status map in parallel. @returns {Promise<void>} */
async function refreshAll() {
  await Promise.all([loadConversations(1), loadGroups(1), loadStatusMap()])
}

/**
 * Subscribes to the user's private Echo channel (previews, deletions, calls,
 * statuses, meetings) and the tenant channel (announcements, SOS, handovers,
 * staff locations, guest messages, escalations).
 */
function subscribeUserChannel() {
  const echo = getEcho()
  if (!echo || !me.value.user_id) return
  echo.private(`user.${me.value.user_id}`).listen('.preview.updated', handlePreviewUpdated)
  echo.private(`user.${me.value.user_id}`).listen('.message.deleted', handleUserMessageDeleted)
  echo.private(`user.${me.value.user_id}`).listen('.call.invited', callManager.handleCallInvited)
  echo.private(`user.${me.value.user_id}`).listen('.status.posted', handleStatusPosted)
  echo.private(`user.${me.value.user_id}`).listen('.meeting.invited', handleMeetingInvited)
  echo.private(`user.${me.value.user_id}`).listen('.meeting.response', handleMeetingResponse)
  echo
    .private(`tenant.${me.value.tenant_id}`)
    .listen('.announcement.posted', handleAnnouncementPosted)
  echo
    .private(`tenant.${me.value.tenant_id}`)
    .listen('.announcement.acknowledged', handleAnnouncementPosted)
  echo.private(`tenant.${me.value.tenant_id}`).listen('.sos.initiated', handleSosInitiated)
  echo.private(`tenant.${me.value.tenant_id}`).listen('.sos.resolved', handleSosResolved)
  echo.private(`tenant.${me.value.tenant_id}`).listen('.handover.posted', handleHandoverPosted)
  echo
    .private(`tenant.${me.value.tenant_id}`)
    .listen('.handover.acknowledged', handleHandoverPosted)
  echo
    .private(`tenant.${me.value.tenant_id}`)
    .listen('.staff.location.updated', handleStaffLocationUpdated)
  echo.private(`tenant.${me.value.tenant_id}`).listen('.guest.message', handleGuestMessagePosted)
  echo.private(`tenant.${me.value.tenant_id}`).listen('.message.escalated', handleMessageEscalated)
}

// --- Websocket event handlers (Echo broadcasts) ---

/** Reloads announcements when one is posted or acknowledged. */
function handleAnnouncementPosted() {
  loadAnnouncements()
}
/**
 * Reloads SOS alerts on a new alert; toasts a warning when it is not my own.
 * @param {Object} data - Broadcast payload ({ user_id }).
 */
function handleSosInitiated(data) {
  loadSos()
  if (data?.user_id !== me.value.user_id) {
    toast(t('messages.sosIncoming'))
  }
}
/** Reloads SOS alerts when one is resolved. */
function handleSosResolved() {
  loadSos()
}
/** Reloads handovers when one is posted or acknowledged. */
function handleHandoverPosted() {
  loadHandovers()
}
/** Reloads meetings and toasts when I am invited to one. */
function handleMeetingInvited() {
  loadMeetings()
  toast(t('messages.meetingInvited'))
}
/** Reloads meetings when an invitee responds. */
function handleMeetingResponse() {
  loadMeetings()
}
/** Refreshes the nearby-staff tab when a location update arrives (only while viewing it). */
function handleStaffLocationUpdated() {
  if (workspaceTab.value === 'nearby') loadNearbyStaff()
}
/** Reloads guest messages and toasts on an inbound guest message. */
function handleGuestMessagePosted() {
  loadGuestMessages()
  toast(t('messages.guestMessageIncoming'))
}
/** Reloads escalations and toasts when a message is escalated. */
function handleMessageEscalated() {
  loadEscalations()
  toast(t('messages.escalationIncoming'))
}

/**
 * Updates the status-ring map when a contact posts a status; my own status
 * simply flips the myStatusHas flag.
 * @param {Object} data - Broadcast payload ({ status }).
 */
function handleStatusPosted(data) {
  const s = data?.status
  if (!s?.user_id) return
  if (s.user_id === me.value.user_id) {
    myStatusHas.value = true
    return
  }
  statusByUser.value = {
    ...statusByUser.value,
    [s.user_id]: { has: true, viewed: false },
  }
}

/**
 * Applies a chat-list preview broadcast: updates the entry in place, or reloads
 * the corresponding list when the chat is unknown locally. The open thread's
 * unread count is kept at zero.
 * @param {Object} data - Broadcast payload ({ kind, id, last_message, unread_count, ... }).
 */
function handlePreviewUpdated(data) {
  const isDirect = data.kind === 'direct'
  const isActive = activeKind.value === data.kind && activeId.value === data.id
  const list = isDirect ? conversations.value : groups.value
  const item = list.find((entry) =>
    isDirect ? entry.conversation_id === data.id : entry.group_conversation_id === data.id,
  )
  if (item) {
    item.last_message = data.last_message || null
    item.last_message_at = data.last_message_at || item.last_message_at
    item.unread_count = isActive ? 0 : data.unread_count || 0
  } else if (isDirect) {
    loadConversations(1)
  } else {
    loadGroups(1)
  }
}

/**
 * (Re)subscribes to the active thread's private Echo channel, replacing any
 * previous subscription, and binds all per-message broadcast events.
 */
function subscribeThread() {
  const echo = getEcho()
  if (activeThreadChannel) {
    activeThreadChannel.unsubscribe()
    activeThreadChannel = null
  }
  if (!echo || !activeId.value) return
  if (activeKind.value === 'group') {
    activeThreadChannel = echo.private(`group.${activeId.value}`)
    activeThreadChannel.listen('.group.message.sent', handleGroupMessageSent)
  } else {
    activeThreadChannel = echo.private(`conversation.${activeId.value}`)
    activeThreadChannel.listen('.message.sent', handleMessageSent)
  }
  activeThreadChannel.listen('.message.deleted', handleMessageDeleted)
  activeThreadChannel.listen('.message.reaction.updated', handleReactionUpdated)
  activeThreadChannel.listen('.message.viewed_once', handleViewedOnce)
  activeThreadChannel.listen('.reply.sent', handleReplySent)
  activeThreadChannel.listen('.message.pinned', (data) => setPinnedLocally(data, true))
  activeThreadChannel.listen('.message.unpinned', (data) => setPinnedLocally(data, false))
  activeThreadChannel.listen('.poll.created', handlePollVoted)
  activeThreadChannel.listen('.poll.voted', handlePollVoted)
  activeThreadChannel.listen('.task.converted', handleTaskConverted)
  activeThreadChannel.listen('.message.disappeared', handleMessageDisappeared)

  // Tick disappearing-message countdowns while this thread stays open.
  if (disappearTimer) clearInterval(disappearTimer)
  disappearTimer = setInterval(expireDisappearing, 1000)
}

/**
 * Applies a pin/unpin broadcast to the local message and refreshes the panel.
 * @param {Object} data - Broadcast payload ({ message_id }).
 * @param {boolean} pinned - New pinned state.
 */
function setPinnedLocally(data, pinned) {
  const msg = messages.value.find((message) => msgId(message) === data.message_id)
  if (msg) {
    msg.pinned_at = pinned ? new Date().toISOString() : null
    loadPinned()
  }
}

/**
 * Appends a reply broadcast from another participant to the open thread
 * (deduped, marks read, scrolls down). Own replies arrive via the send path.
 * @param {Object} data - Broadcast payload ({ item }).
 */
function handleReplySent(data) {
  const item = data?.item
  if (!item) return
  const isGroup = activeKind.value === 'group'
  const id = isGroup ? item.group_message_id : item.message_id
  if (item.sender_id === me.value.user_id) return
  if (messages.value.some((message) => msgId(message) === id)) return
  messages.value.push(item)
  if (isGroup) {
    if (activeId.value !== item.group_conversation_id) return
    markReadSilently()
  } else {
    if (activeId.value !== item.conversation_id) return
    markReadSilently()
  }
  scrollToBottom()
}

/**
 * Applies a poll created/voted broadcast to the matching message's poll state
 * (full poll payload, or per-option vote counts).
 * @param {Object} data - Broadcast payload ({ poll_id | poll, options, total_votes }).
 */
function handlePollVoted(data) {
  const msg = messages.value.find(
    (message) => message.poll && message.poll.poll_id === (data.poll_id || data.poll?.poll_id),
  )
  if (!msg) return
  if (data.poll) {
    msg.poll = { ...msg.poll, ...data.poll, options: data.poll.options }
  } else {
    const options = data.options || []
    msg.poll.options = msg.poll.options.map((option) => {
      const fresh = options.find((option) => option.poll_option_id === option.poll_option_id)
      return fresh ? { ...option, votes: fresh.votes, pct: fresh.pct } : option
    })
    msg.poll.total_votes = data.total_votes
  }
}

/**
 * Flags a message as converted-to-task when the broadcast arrives.
 * @param {Object} data - Broadcast payload ({ message_id, task }).
 */
function handleTaskConverted(data) {
  const msg = messages.value.find((message) => msgId(message) === data.message_id)
  if (msg) {
    msg.is_task = true
    msg.task_kind = data.task?.kind || msg.task_kind
    msg.task_status = data.task?.status || 'pending'
  }
}

/**
 * Handles a 'me'-scope deletion broadcast on the user channel: removes the
 * message locally when it belongs to the open thread.
 * @param {Object} data - Broadcast payload ({ scope, channel_id, message_id, message_type }).
 */
function handleUserMessageDeleted(data) {
  if (data.scope !== 'me' || !data.channel_id) return
  const inThread = activeKind.value === data.message_type && activeId.value === data.channel_id
  if (!inThread) return
  removeMessageLocally(data.message_id, data.message_type)
}

/**
 * Handles a thread-level deletion broadcast: scrubs content for 'everyone',
 * or removes the row when I deleted it for myself.
 * @param {Object} data - Broadcast payload ({ message_id, message_type, scope, deleted_by }).
 */
function handleMessageDeleted(data) {
  const msg = messages.value.find((message) => msgId(message) === data.message_id)
  if (!msg) return
  if (data.scope === 'everyone') {
    applyDeletedLocally(msg, 'everyone')
  } else if (data.deleted_by === me.value.user_id) {
    removeMessageLocally(data.message_id, data.message_type)
  }
}

/**
 * Applies a reaction-summary broadcast to the matching message.
 * @param {Object} data - Broadcast payload ({ message_id, reactions }).
 */
function handleReactionUpdated(data) {
  const msg = messages.value.find((message) => msgId(message) === data.message_id)
  if (msg) msg.reactions = data.reactions || []
}

/**
 * Stamps the viewed timestamp when a view-once message is opened (broadcast).
 * @param {Object} data - Broadcast payload ({ message_id, viewed_at }).
 */
function handleViewedOnce(data) {
  const msg = messages.value.find((message) => msgId(message) === data.message_id)
  if (msg) msg.viewed_at = data.viewed_at
}

/**
 * Removes a message whose disappearing timer lapsed (broadcast from the
 * server-side purge), mirroring the local countdown expiry.
 * @param {Object} data - Broadcast payload ({ message_id, message_type }).
 */
function handleMessageDisappeared(data) {
  removeMessageLocally(data.message_id, data.message_type)
}

/**
 * Removes a message from the open thread and refreshes the list preview.
 * @param {number} id - The message id to remove.
 * @param {string} kind - 'group' | 'conversation' (selects the id field).
 */
function removeMessageLocally(id, kind) {
  const key = kind === 'group' ? 'group_message_id' : 'message_id'
  const idx = messages.value.findIndex((message) => message[key] === id)
  if (idx > -1) {
    messages.value.splice(idx, 1)
    refreshThreadPreview()
  }
}

/**
 * Appends an incoming direct-message broadcast to the open thread (deduped);
 * marks the thread read when it came from the counterpart.
 * @param {Object} item - The broadcast message record.
 */
function handleMessageSent(item) {
  if (activeKind.value !== 'direct' || activeId.value !== item.conversation_id) return
  if (messages.value.some((message) => message.message_id === item.message_id)) return
  messages.value.push(item)
  if (item.sender_id !== me.value.user_id) markReadSilently()
  scrollToBottom()
}

/**
 * Appends an incoming group-message broadcast to the open group thread (deduped).
 * @param {Object} item - The broadcast group-message record.
 */
function handleGroupMessageSent(item) {
  if (activeKind.value !== 'group' || activeId.value !== item.group_conversation_id) return
  if (messages.value.some((message) => message.group_message_id === item.group_message_id)) return
  messages.value.push(item)
  scrollToBottom()
}

/** Opens the new-direct-message modal with a fresh search state. */
function openNewMessage() {
  showNew.value = true
  modalError.value = ''
  modalSuccess.value = ''
  userSearch.value = ''
  userResults.value = []
  newScope.value = 'hotel'
}

/** Closes the new-direct-message modal. */
function closeNewMessage() {
  showNew.value = false
}

/**
 * Switches the new-message scope (hotel/global) and resets the search.
 * @param {string} scope - The new scope key.
 */
function switchScope(scope) {
  newScope.value = scope
  userSearch.value = ''
  userResults.value = []
}

/** Debounced (300ms) user search for the new-message modal. @returns {Promise<void>} */
async function searchUsers() {
  clearTimeout(searchTimer)
  const q = userSearch.value.trim()
  if (!q) {
    userResults.value = []
    return
  }
  searchTimer = setTimeout(async () => {
    searchingUsers.value = true
    try {
      const res = await conversationApi.users({ scope: newScope.value, search: q, per_page: 20 })
      userResults.value = res.data.data || []
    } catch {
      userResults.value = []
    } finally {
      searchingUsers.value = false
    }
  }, 300)
}

/**
 * Creates (or reuses) a direct conversation with the chosen user, reloads the
 * list and opens the thread.
 * @param {Object} user - The user to chat with.
 * @returns {Promise<void>}
 */
async function startConversation(user) {
  startingWith.value = user.user_id
  modalError.value = ''
  modalSuccess.value = ''
  try {
    const res = await conversationApi.store({ recipient_id: user.user_id, scope: newScope.value })
    const conv = res.data.conversation
    success.value = t('messages.started')
    showNew.value = false
    startingWith.value = null
    await loadConversations(1)
    openChat({
      kind: 'direct',
      id: conv.conversation_id,
      name: conv.other_participant?.full_name || '—',
      scope: conv.scope,
      hotel_name: conv.other_participant?.hotel_name,
      unread_count: 0,
      last_message_at: conv.last_message_at || conv.created_at,
      last_message: conv.last_message,
      created_at: conv.created_at,
    })
  } catch (err) {
    modalError.value = flattenError(err)
    startingWith.value = null
  }
}

/** Opens the new-group modal with a fresh form state. */
function openNewGroup() {
  showNewGroup.value = true
  modalError.value = ''
  groupName.value = ''
  groupScope.value = 'hotel'
  groupUserSearch.value = ''
  groupUserResults.value = []
  selectedGroupUsers.value = []
}

/** Closes the new-group modal. */
function closeNewGroup() {
  showNewGroup.value = false
}

/** Debounced (300ms) member search for the new-group / manage-group modals. @returns {Promise<void>} */
async function searchGroupUsers() {
  clearTimeout(searchTimer)
  const q = groupUserSearch.value.trim()
  if (!q) {
    groupUserResults.value = []
    return
  }
  searchTimer = setTimeout(async () => {
    searchingGroupUsers.value = true
    try {
      const res = await conversationApi.users({ scope: groupScope.value, search: q, per_page: 20 })
      groupUserResults.value = res.data.data || []
    } catch {
      groupUserResults.value = []
    } finally {
      searchingGroupUsers.value = false
    }
  }, 300)
}

/**
 * Creates the group — a task group when isTaskGroupCreation is set, otherwise a
 * regular scoped group — then reloads the list and opens the new thread.
 * @returns {Promise<void>}
 */
async function createGroup() {
  const name = groupName.value.trim()
  if (!name) return
  creatingGroup.value = true
  modalError.value = ''
  try {
    const res = isTaskGroupCreation.value
      ? await taskGroupApi.store({
        name,
        task_type: taskGroupType.value,
        member_ids: selectedGroupUsers.value,
      })
      : await groupApi.store({
        name,
        scope: groupScope.value,
        member_ids: selectedGroupUsers.value,
      })
    success.value = t('messages.groupCreated')
    const group = res.data.group
    showNewGroup.value = false
    creatingGroup.value = false
    isTaskGroupCreation.value = false
    await loadGroups(1)
    openChat(toGroupItem(group))
  } catch (err) {
    modalError.value = flattenError(err)
    creatingGroup.value = false
  }
}

/** Opens the group management modal (member add/remove) with a fresh state. */
function openGroupManage() {
  modalError.value = ''
  modalSuccess.value = ''
  groupUserSearch.value = ''
  groupUserResults.value = []
  selectedGroupUsers.value = []
  showGroupManage.value = true
}

/** Closes the group management modal. */
function closeGroupManage() {
  showGroupManage.value = false
}

/** Adds the selected users to the active group and syncs the member count. @returns {Promise<void>} */
async function addSelectedMembers() {
  if (!selectedGroupUsers.value.length || !activeId.value) return
  addingMembers.value = true
  modalError.value = ''
  try {
    const res = await groupApi.addMembers(activeId.value, { member_ids: selectedGroupUsers.value })
    modalSuccess.value = t('messages.membersAdded')
    groupInfo.value = res.data.group
    selectedGroupUsers.value = []
    groupUserResults.value = []
    groupUserSearch.value = ''
    const chat = activeChat.value
    if (chat) chat.member_count = res.data.group?.member_count || chat.member_count
  } catch (err) {
    modalError.value = flattenError(err)
  } finally {
    addingMembers.value = false
  }
}

/**
 * Removes a member from the active group; removing myself additionally closes
 * the thread and reloads the group list.
 * @param {number} userId - The member's user id.
 * @returns {Promise<void>}
 */
async function removeMember(userId) {
  if (!activeId.value) return
  removingMember.value = true
  modalError.value = ''
  modalSuccess.value = ''
  const isSelf = userId === me.value.user_id
  try {
    const res = await groupApi.removeMember(activeId.value, userId)
    modalSuccess.value = isSelf ? t('messages.memberRemoved') : t('messages.memberRemoved')
    if (isSelf) {
      closeThread()
      closeGroupManage()
      await loadGroups(1)
    } else {
      groupInfo.value = res.data.group
      const chat = activeChat.value
      if (chat) chat.member_count = res.data.group?.member_count || chat.member_count
    }
  } catch (err) {
    modalError.value = flattenError(err)
  } finally {
    removingMember.value = false
  }
}

// Boot: connect Echo, subscribe to user/tenant channels and load the initial lists.
onMounted(() => {
  initEcho()
  subscribeUserChannel()
  loadConversations(1)
  loadGroups(1)
  loadStatusMap()
  loadSosPosition()
})

// Teardown: leave the thread channel, dispose the call manager and release
// timers/the microphone so nothing leaks after navigation. The Echo socket
// itself is owned by the layout (it also feeds presence), so it stays alive.
onUnmounted(() => {
  if (activeThreadChannel) {
    activeThreadChannel.unsubscribe()
    activeThreadChannel = null
  }
  callManager.dispose()
  clearTimeout(searchTimer)
  clearInterval(recTimer)
  clearInterval(disappearTimer)
  showDisappearMenu.value = false
  if (recStream) recStream.getTracks().forEach((tr) => tr.stop())
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

/* Mobile dropdown replacing the header action buttons. */
.head-actions-mobile {
  display: none;
  position: relative;
  align-items: center;
}

.head-actions-toggle {
  flex-shrink: 0;
}

.composer-tools-menu.head-actions-menu {
  left: auto;
  right: 0;
  top: calc(100% + 8px);
  bottom: auto;
}

.chat-shell {
  display: grid;
  grid-template-columns: 340px minmax(0, 1fr);
  gap: 16px;
  align-items: stretch;
  background: #fff;
  border: 1px solid #eee;
  border-radius: 10px;
  overflow: hidden;
  min-height: 620px;
}

/* Direct grid children must be allowed to shrink below their content width,
   otherwise a long message or wide media forces the shell to overflow. */
.chat-shell>* {
  min-width: 0;
}

.chat-list {
  border-right: 1px solid #eee;
  display: flex;
  flex-direction: column;
  max-height: 700px;
  overflow-y: auto;
  overflow-x: hidden;
  background: #fbfcfe;
}

.chat-list-search {
  padding: 12px;
  border-bottom: 1px solid #eee;
  position: sticky;
  top: 0;
  background: #fbfcfe;
  z-index: 2;
}

.chat-item {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  width: 100%;
  text-align: left;
  padding: 12px;
  border-bottom: 1px solid #f4f4f4;
  transition: background 0.15s;
}

.chat-item:hover {
  background: #f3f6fb;
}

.chat-item.active {
  background: #eaf4ff;
  border-left: 3px solid var(--brand);
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
  position: relative;
}

.online-dot {
  position: absolute;
  right: -1px;
  bottom: -1px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #2ecc40;
  border: 2px solid #fff;
}

.chat-online i {
  font-size: 8px;
  vertical-align: middle;
  color: #2ecc40;
}

.online-label {
  color: #2ecc40;
  font-weight: 600;
}

.avatar-global {
  background: #7d3c98;
}

.status-ring {
  cursor: pointer;
}

.status-ring.unviewed {
  box-shadow:
    0 0 0 2px #fff,
    0 0 0 5px #25d366;
}

.status-ring.viewed {
  box-shadow:
    0 0 0 2px #fff,
    0 0 0 5px #c0c0c0;
}

.status-my {
  position: relative;
}

.status-add {
  position: absolute;
  right: -3px;
  bottom: -3px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--brand);
  color: #fff;
  font-size: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 2px solid #fff;
  z-index: 2;
  cursor: pointer;
  transition: background 0.15s;
}

.status-add:hover {
  background: var(--brand-dark);
}

.avatar-group {
  background: #27ae60;
}

.avatar-group i {
  font-size: 16px;
}

.chat-item-body {
  flex: 1;
  min-width: 0;
}

.chat-item-top {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
}

.chat-item-top strong {
  font-size: 14px;
}

.chat-item-sub {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-top: 2px;
}

.chat-preview {
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.unread-badge {
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--brand);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.chat-item-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
}

.hotel-name {
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chat-load-more {
  padding: 12px;
  text-align: center;
}

.chat-thread {
  display: flex;
  flex-direction: column;
  min-height: 620px;
  min-width: 0;
  max-width: 100%;
}

.chat-thread-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-bottom: 1px solid #eee;
}

/* Desktop: thread actions render inline in the header (the wrapper has no box). */
.thread-head-actions {
  display: contents;
}

.thread-head-actions-mobile {
  display: none;
  position: relative;
  align-items: center;
}

.thread-head-toggle {
  flex-shrink: 0;
}

.composer-tools-menu.thread-head-menu {
  left: auto;
  right: 0;
  top: calc(100% + 4px);
  bottom: auto;
}

.chat-thread-who {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.chat-thread-who .muted {
  font-size: 12px;
  margin-left: 4px;
}

.back-btn {
  display: none;
}

.members-btn {
  flex-shrink: 0;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: #f7f9fc;
  min-width: 0;
  min-height: 0;
}

.chat-empty {
  padding: 40px 20px;
  text-align: center;
}

.bubble {
  max-width: 72%;
  padding: 9px 13px;
  border-radius: 14px;
  font-size: 14px;
  line-height: 1.45;
  word-break: break-word;
}

.bubble.mine {
  align-self: flex-end;
  background: var(--brand);
  color: #fff;
  border-bottom-right-radius: 4px;
}

.bubble.theirs {
  align-self: flex-start;
  background: #fff;
  border: 1px solid #e8e8e8;
  border-bottom-left-radius: 4px;
}

.bubble-sender {
  font-size: 11px;
  font-weight: 700;
  color: #7d3c98;
  margin-bottom: 2px;
}

.bubble-meta {
  display: flex;
  gap: 4px;
  align-items: center;
  font-size: 11px;
  margin-top: 3px;
  opacity: 0.75;
}

.disappear-chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  margin-left: 3px;
  padding: 1px 6px;
  border-radius: 8px;
  font-size: 10px;
  font-weight: 700;
  background: rgba(211, 84, 0, 0.12);
  color: #d35400;
  white-space: nowrap;
}

.bubble.mine .disappear-chip {
  background: rgba(255, 255, 255, 0.22);
  color: #fff;
}

.ticks {
  display: inline-flex;
  align-items: center;
  margin-left: 2px;
}

.ticks .tick {
  font-size: 11px;
}

.ticks .tick-read {
  font-size: 11px;
  color: #a3d8a3;
}

.bubble-audio {
  width: 100%;
  min-width: 200px;
  height: 36px;
  margin-bottom: 2px;
}

.bubble-image {
  max-width: 260px;
  max-height: 220px;
  border-radius: 8px;
  display: block;
  margin-bottom: 2px;
}

.bubble-file {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: inherit;
  text-decoration: underline;
}

.deleted-note {
  font-style: italic;
  opacity: 0.7;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}

.view-once-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 8px;
  border: 1px dashed rgba(128, 128, 128, 0.6);
  background: rgba(128, 128, 128, 0.08);
  color: inherit;
  font-size: 13px;
  cursor: pointer;
}

.view-once-open {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  opacity: 0.75;
}

.mention-chip {
  background: rgba(125, 60, 152, 0.15);
  color: #7d3c98;
  border-radius: 4px;
  padding: 0 3px;
  font-weight: 700;
}

.bubble.mine .mention-chip {
  background: rgba(255, 255, 255, 0.25);
  color: #fff;
}

.bubble-reactions {
  display: flex;
  gap: 4px;
  margin-top: 4px;
  flex-wrap: wrap;
}

.bubble-reaction {
  background: #fff;
  border: 1px solid #e2e2e2;
  border-radius: 999px;
  padding: 2px 8px;
  font-size: 13px;
  cursor: pointer;
  line-height: 1.4;
}

.bubble.mine .bubble-reaction {
  background: rgba(255, 255, 255, 0.92);
  border-color: rgba(255, 255, 255, 0.5);
  color: #333;
}

.bubble-reaction.mine {
  background: #eaf4ff;
  border-color: var(--brand);
}

.bubble-reaction-count {
  margin-left: 3px;
  font-size: 11px;
  font-weight: 700;
}

.bubble-more {
  background: none;
  border: none;
  color: inherit;
  opacity: 0.45;
  cursor: pointer;
  padding: 0 2px;
  font-size: 12px;
}

.bubble-more:hover {
  opacity: 1;
}

.msg-menu {
  position: fixed;
  z-index: 60;
  min-width: 180px;
  background: #fff;
  border: 1px solid #e2e2e2;
  border-radius: 12px;
  box-shadow: 0 10px 32px rgba(0, 0, 0, 0.18);
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.msg-menu-reactions {
  display: flex;
  gap: 2px;
  padding-bottom: 6px;
  border-bottom: 1px solid #f0f0f0;
  margin-bottom: 6px;
}

.msg-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  text-align: left;
  background: none;
  border: none;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 14px;
  cursor: pointer;
}

.msg-menu-item:hover {
  background: #f3f6fb;
}

.msg-menu-item.danger {
  color: #c0392b;
}

.view-once-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #555;
  cursor: pointer;
  flex-shrink: 0;
}

.view-once-toggle input {
  accent-color: var(--brand);
}

.view-once-viewer {
  position: relative;
  max-width: 640px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.view-once-viewer img {
  max-width: 100%;
  max-height: 70vh;
  border-radius: 12px;
}

.mention-picker {
  position: absolute;
  left: 12px;
  bottom: calc(100% + 8px);
  width: 260px;
  max-height: 220px;
  overflow-y: auto;
  background: #fff;
  border: 1px solid #e2e2e2;
  border-radius: 12px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.12);
  z-index: 20;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.mention-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  text-align: left;
  background: none;
  border: none;
  border-radius: 8px;
  padding: 6px 8px;
  cursor: pointer;
}

.mention-item:hover {
  background: #f3f6fb;
}

.mention-item .avatar {
  width: 28px;
  height: 28px;
  min-width: 28px;
  font-size: 12px;
}

.mention-item-name {
  font-size: 14px;
}

.call-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.call-card {
  position: relative;
  width: 100%;
  max-width: 380px;
  min-height: 420px;
  background: linear-gradient(180deg, #1b2a4a, #0f1830);
  color: #fff;
  border-radius: 18px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  padding: 28px 20px 22px;
  overflow: hidden;
}

.call-video {
  max-width: 760px;
  min-height: 480px;
}

.call-remote {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.call-local {
  position: absolute;
  top: 14px;
  right: 14px;
  width: 130px;
  border-radius: 12px;
  border: 2px solid rgba(255, 255, 255, 0.5);
  object-fit: cover;
  background: #000;
  z-index: 2;
}

.call-body {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.avatar-call {
  width: 84px;
  height: 84px;
  font-size: 28px;
  background: rgba(255, 255, 255, 0.15);
  border: 2px solid rgba(255, 255, 255, 0.4);
}

.call-name {
  font-size: 20px;
}

.call-sub {
  color: rgba(255, 255, 255, 0.75);
  font-size: 14px;
}

.call-actions {
  position: relative;
  z-index: 2;
  display: flex;
  gap: 18px;
  align-items: center;
}

.call-btn {
  width: 54px;
  height: 54px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.18);
  color: #fff;
  font-size: 20px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.call-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

.call-btn-accept {
  background: #1e8e3e;
}

.call-btn-accept:hover {
  background: #177a34;
}

.call-btn-decline {
  background: #c0392b;
}

.call-btn-decline:hover {
  background: #a93226;
}

.call-btn-off {
  background: rgba(255, 255, 255, 0.08);
  color: #ffb3a7;
}

.chat-composer {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding: 12px;
  border-top: 1px solid #eee;
  align-items: center;
  position: relative;
}

/* In-flow popovers (reply bar, poll/schedule/template builders, static mention
   list) wrap onto their own full-width row below the composer controls. */
.chat-composer>.reply-bar,
.chat-composer>.poll-builder,
.chat-composer>.schedule-bar,
.chat-composer>.template-picker,
.chat-composer>.mention-picker.static {
  flex: 1 1 100%;
}

.chat-composer .textarea {
  flex: 1;
  resize: none;
  min-height: 42px;
  max-height: 120px;
}

/* Desktop: composer tools render inline in the row (the wrapper itself has no box). */
.composer-tools {
  display: contents;
}

.composer-tools-mobile {
  display: none;
}

.composer-tools-toggle {
  flex-shrink: 0;
}

.composer-tools-menu {
  position: absolute;
  left: 0;
  bottom: calc(100% + 8px);
  min-width: 190px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  z-index: 30;
}

.composer-tool-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border: none;
  border-radius: 8px;
  background: transparent;
  font-size: 13px;
  color: #333;
  text-align: left;
  cursor: pointer;
}

.composer-tool-item:hover {
  background: #f3f4f6;
}

.composer-tool-item.active {
  color: var(--brand);
  background: #eaf4ff;
}

.composer-tool-item i {
  width: 18px;
  text-align: center;
}

.icon-btn {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  border: 1px solid #e2e2e2;
  background: #fff;
  color: var(--brand);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
}

.icon-btn:hover {
  background: #f3f6fb;
}

.icon-btn.emoji-toggle {
  background: #fff8e6;
  border-color: #f3d98b;
  color: #b8860b;
}

.icon-btn.mic {
  background: #eefaf1;
  border-color: #cde9d6;
  color: #1e8e3e;
}

.icon-btn.recording {
  color: #fff;
  background: #c0392b;
  border-color: #c0392b;
  animation: pulse 1.2s infinite;
}

.emoji-picker {
  position: absolute;
  left: 12px;
  bottom: calc(100% + 8px);
  width: 264px;
  max-height: 220px;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 2px;
  padding: 8px;
  background: #fff;
  border: 1px solid #e2e2e2;
  border-radius: 12px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.12);
  z-index: 20;
}

.emoji-item {
  background: none;
  border: none;
  border-radius: 8px;
  font-size: 20px;
  line-height: 1;
  padding: 6px 4px;
  cursor: pointer;
  transition: background 0.12s;
}

.emoji-item:hover {
  background: #f3f6fb;
}

/* WhatsApp-style disappearing-message duration picker. */
.disappear-menu {
  position: absolute;
  left: 12px;
  bottom: calc(100% + 8px);
  min-width: 200px;
  background: #fff;
  border: 1px solid #e2e2e2;
  border-radius: 12px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.12);
  padding: 6px;
  z-index: 20;
}

.disappear-menu-head {
  padding: 8px 12px 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--muted, #6b7280);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.disappear-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  padding: 10px 12px;
  border: none;
  border-radius: 8px;
  background: transparent;
  font-size: 13px;
  color: #333;
  text-align: left;
  cursor: pointer;
}

.disappear-option:hover {
  background: #f3f4f6;
}

.disappear-option.selected {
  color: var(--brand);
  background: #eaf4ff;
  font-weight: 600;
}

.disappear-option i {
  color: var(--brand);
}

.attachment-preview {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-width: 0;
}

.attachment-preview-media {
  max-width: 160px;
  max-height: 120px;
  border-radius: 8px;
  flex-shrink: 0;
}

.attachment-preview-file {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  flex: 1;
}

.attachment-preview-file>i {
  font-size: 34px;
  color: var(--brand);
  flex-shrink: 0;
}

.attachment-preview-file div {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.attachment-preview-file strong {
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.attachment-preview-file span {
  font-size: 12px;
  color: #757575;
}

@keyframes pulse {

  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(192, 57, 43, 0.4);
  }

  50% {
    box-shadow: 0 0 0 8px rgba(192, 57, 43, 0);
  }
}

.rec-timer {
  font-size: 11px;
  font-weight: 700;
}

.recording-preview {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
}

.recording-preview audio {
  flex: 1;
  min-width: 0;
}

.recording-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.hidden-input {
  display: none;
}

.chat-thread-placeholder {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #bbb;
}

.chat-thread-placeholder i {
  font-size: 42px;
}

.placeholder-actions {
  display: flex;
  gap: 10px;
}

.new-message-modal {
  max-width: 540px;
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

.user-results {
  max-height: 260px;
  overflow-y: auto;
  border: 1px solid #eee;
  border-radius: 8px;
}

.user-result {
  display: flex;
  gap: 10px;
  align-items: center;
  width: 100%;
  text-align: left;
  padding: 10px 12px;
  border-bottom: 1px solid #f4f4f4;
  background: #fff;
  transition: background 0.15s;
}

.user-result:last-child {
  border-bottom: none;
}

.user-result:hover {
  background: #f3f6fb;
}

.user-result:disabled {
  opacity: 0.5;
}

.user-result-select {
  cursor: pointer;
}

.user-result-select .checkbox {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  accent-color: var(--brand);
}

.user-results-foot {
  padding: 10px;
  border-top: 1px solid #eee;
  text-align: right;
}

.user-result-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.user-result-body .muted {
  font-size: 12px;
}

.user-result-go {
  color: var(--brand);
}

.members-title {
  font-size: 14px;
  margin: 16px 0 8px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.members-title i {
  color: var(--brand);
}

.modal-foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 16px;
}

@media (max-width: 768px) {
  .dashboard-page {
    padding: 12px 10px 10px;
    height: calc(100vh - 67px);
    height: calc(100dvh - 67px);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .page-head {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  /* Mobile: header actions move into the dropdown. */
  .head-actions {
    display: none;
  }

  .head-actions-mobile {
    display: flex;
  }

  /* Mobile: thread-header actions collapse into the dropdown. */
  .thread-head-actions {
    display: none;
  }

  .thread-head-actions-mobile {
    display: flex;
  }

  .chat-shell {
    grid-template-columns: 1fr;
    grid-auto-rows: minmax(0, 1fr);
    min-height: 0;
    height: auto;
    flex: 1 1 0;
  }

  .chat-list {
    border-right: none;
    max-height: none;
    min-height: 0;
  }

  .chat-thread {
    min-height: 0;
    height: 100%;
  }

  .chat-thread-head {
    flex-wrap: wrap;
    gap: 6px;
    padding: 8px 10px;
  }

  .chat-thread-head .members-btn {
    width: 34px;
    height: 34px;
    padding: 0;
  }

  .chat-list.hidden-xs,
  .chat-thread.hidden-xs {
    display: none;
  }

  .back-btn {
    display: inline-flex;
  }

  .chat-composer {
    padding: 8px;
    gap: 6px;
  }

  .chat-composer .icon-btn {
    width: 38px;
    height: 38px;
  }

  .chat-composer .textarea {
    min-height: 38px;
    font-size: 15px;
  }

  /* Mobile: collapse the composer tools into the left dropdown so the input widens. */
  .composer-tools {
    display: none;
  }

  .composer-tools-mobile {
    display: flex;
    position: relative;
    align-items: center;
  }

  .chat-composer .textarea {
    min-width: 0;
  }

  .chat-composer .composer-send {
    padding: 0;
    width: 42px;
    height: 42px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .chat-composer .composer-send-label {
    display: none;
  }

  .scope-cards {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 480px) {
  .chat-composer {
    gap: 4px;
  }

  .chat-composer .icon-btn {
    width: 34px;
    height: 34px;
  }

  .chat-composer .composer-send {
    width: 38px;
    height: 38px;
  }
}

/* Very narrow phones (320-360px): compact the headers so the pinned
   composer stays on screen. */
@media (max-width: 360px) {
  .page-head {
    gap: 8px;
    margin-bottom: 12px;
  }

  .page-head h1 {
    font-size: 18px;
    gap: 6px;
  }

  .page-head>div:first-child p.muted {
    display: none;
  }

  .chat-thread-head {
    gap: 4px;
    padding: 6px 8px;
  }

  .chat-thread-head .members-btn {
    width: 30px;
    height: 30px;
    padding: 0;
  }

  .chat-thread-who .muted {
    display: none;
  }

  .chat-thread-who strong {
    font-size: 13px;
  }

  .chat-composer {
    gap: 6px;
    padding: 8px;
  }

  .chat-composer .textarea {
    font-size: 13px;
    padding: 8px;
  }

  .chat-messages {
    padding: 8px 8px 4px;
  }
}

.task-group-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 4px 0 10px;
  font-weight: 600;
  cursor: pointer;
  font-size: 14px;
}

/* ---- Feature UI ---- */
.icon-btn.active {
  color: var(--brand);
  background: #eaf4ff;
}

.bubble-tags {
  display: flex;
  gap: 6px;
  margin-bottom: 4px;
  flex-wrap: wrap;
}

.bubble-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  padding: 2px 7px;
  border-radius: 999px;
  font-weight: 600;
}

.tag-pin {
  color: #7c6a00;
  background: #fff7cc;
}

.tag-urgent {
  color: #a00000;
  background: #ffe3e3;
}

.tag-task {
  color: #0a6b2d;
  background: #dcfce7;
}

.bubble.urgent {
  border-left: 3px solid #e11d48;
}

.bubble.starred-bubble {
  background-image: linear-gradient(rgba(255, 213, 0, 0.05), rgba(255, 213, 0, 0.05));
}

.forwarded-note {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #6b7280;
  margin-bottom: 4px;
}

.reply-quote {
  border-left: 3px solid var(--brand);
  background: rgba(13, 110, 253, 0.06);
  padding: 6px 10px;
  border-radius: 6px;
  margin-bottom: 6px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
}

.reply-quote-author {
  font-weight: 700;
  font-size: 12px;
  color: var(--brand);
}

.reply-quote-text {
  font-size: 12px;
  color: #444;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.translation-box {
  margin-top: 6px;
  padding: 6px 10px;
  background: #eef7ff;
  border-radius: 6px;
  font-size: 13px;
  border-left: 3px solid #0dcaf0;
}

.bubble-translate {
  background: none;
  border: none;
  color: #6b7280;
  cursor: pointer;
  padding: 0 2px;
  font-size: 12px;
}

.bubble-translate:hover {
  color: var(--brand);
}

.bubble-poll {
  margin-top: 8px;
  border-top: 1px dashed rgba(0, 0, 0, 0.12);
  padding-top: 8px;
}

.poll-question {
  display: block;
  margin-bottom: 6px;
}

.poll-count {
  display: block;
  font-size: 11px;
  margin-bottom: 6px;
}

.poll-option {
  position: relative;
  padding: 7px 10px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  margin-bottom: 6px;
  cursor: pointer;
  overflow: hidden;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.poll-option.mine {
  border-color: var(--brand);
}

.poll-option-bar {
  position: absolute;
  inset: 0;
  height: 100%;
  background: rgba(13, 110, 253, 0.08);
  z-index: 0;
}

.poll-option-label,
.poll-option-pct,
.poll-check {
  position: relative;
  z-index: 1;
}

.poll-option-pct {
  font-weight: 700;
  font-size: 12px;
}

.poll-check {
  color: var(--brand);
}

.reply-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #eef7ff;
  border-radius: 8px;
  padding: 6px 10px;
  margin-bottom: 6px;
}

.reply-bar-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.reply-bar-author {
  font-weight: 700;
  font-size: 12px;
  color: var(--brand);
}

.reply-bar-text {
  font-size: 12px;
  color: #444;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.poll-builder {
  background: #f8fafc;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 10px;
  margin-top: 6px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.poll-builder-option {
  display: flex;
  gap: 8px;
  align-items: center;
}

.poll-builder-actions {
  display: flex;
  align-items: center;
  gap: 14px;
}

.poll-multiple-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #555;
  cursor: pointer;
}

.schedule-bar {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-top: 6px;
  flex-wrap: wrap;
}

.template-picker {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
  padding: 10px;
  margin-top: 6px;
  max-height: 240px;
  overflow-y: auto;
}

.template-picker-head {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  align-items: center;
}

.template-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  width: 100%;
  text-align: left;
  padding: 8px;
  border: none;
  background: #f8fafc;
  border-radius: 6px;
  margin-bottom: 6px;
  cursor: pointer;
}

.template-item:hover {
  background: #eef7ff;
}

.template-empty {
  padding: 10px;
  text-align: center;
}

.msg-menu-divider {
  height: 1px;
  background: #eee;
  margin: 4px 0;
}

.msg-menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 12px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 13px;
  text-align: left;
}

.msg-menu-item:hover {
  background: #f0f4fa;
}

.msg-menu-item i {
  width: 16px;
  color: #5b6470;
}

.msg-menu-item.danger {
  color: #dc3545;
}

.forward-modal {
  width: 420px;
  max-width: 92vw;
}

.forward-list {
  max-height: 320px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.forward-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px;
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  background: #fbfcfe;
  cursor: pointer;
  width: 100%;
  text-align: left;
}

.forward-item:hover {
  background: #eef7ff;
}

.forward-item-name {
  flex: 1;
  font-weight: 600;
  font-size: 14px;
}

.forward-go {
  color: var(--brand);
}

.forward-empty,
.side-empty {
  padding: 14px;
  text-align: center;
}

.avatar-room {
  background: #eef0f3;
  color: #6b7280;
}

.room-link-list {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.room-link-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  background: #f8fafc;
  border-radius: 6px;
  font-size: 13px;
}

.side-modal {
  width: 460px;
  max-width: 94vw;
}

.side-list {
  max-height: 420px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.side-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
  padding: 10px;
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  background: #fbfcfe;
  cursor: pointer;
  width: 100%;
  text-align: left;
}

.side-item:hover {
  background: #eef7ff;
}

.side-item-meta {
  font-size: 11px;
  color: var(--brand);
  font-weight: 600;
}

.side-item-body {
  font-size: 13px;
  color: #333;
}

.search-inline {
  display: flex;
  gap: 8px;
}

.workspace-modal {
  width: 680px;
  max-width: 95vw;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
}

.workspace-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 0 0 12px;
  border-bottom: 1px solid #eee;
  margin-bottom: 12px;
}

.workspace-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid #e5e7eb;
  background: #fff;
  font-size: 12px;
  cursor: pointer;
  color: #444;
}

.workspace-tab.active {
  background: var(--brand);
  border-color: var(--brand);
  color: #fff;
}

.workspace-body {
  flex: 1;
  overflow-y: auto;
}

.ws-tab {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ws-compose {
  background: #f8fafc;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 8px;
}

.ws-compose-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}

.ws-tab-section {
  background: #f8fafc;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;
}

.ws-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.ws-section-head h4 {
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #005eb8;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 6px;
}

.ws-toggle-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ws-toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 0;
  border-bottom: 1px solid #eef0f3;
  font-size: 14px;
  cursor: pointer;
}

.ws-toggle-row:last-child {
  border-bottom: none;
}

.ws-toggle-label {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.toggle-check {
  width: 18px;
  height: 18px;
  accent-color: #005eb8;
  cursor: pointer;
}

.ws-card {
  border: 1px solid #eef0f3;
  border-radius: 8px;
  padding: 12px;
  background: #fff;
}

.ws-card.urgent {
  border-left: 3px solid #e11d48;
}

.ws-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}

.ws-card-body {
  margin: 8px 0;
  color: #333;
  font-size: 14px;
}

.ws-card-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}

.meeting-invitees {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.invitee-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 9px;
  border-radius: 999px;
  background: #eef7ff;
  color: var(--brand);
  font-size: 12px;
  font-weight: 600;
}

.invitee-chip i {
  cursor: pointer;
}

.invitee-chip.accepted {
  background: #dcfce7;
  color: #0a6b2d;
}

.invitee-chip.declined {
  background: #ffe3e3;
  color: #a00000;
}

.mention-picker.static {
  position: static;
  box-shadow: none;
}

.sos-floating {
  position: fixed;
  bottom: 24px;
  right: 24px;
  width: 54px;
  height: 54px;
  border-radius: 50%;
  border: none;
  background: #e11d48;
  color: #fff;
  font-size: 22px;
  cursor: grab;
  touch-action: none;
  box-shadow: 0 6px 18px rgba(225, 29, 72, 0.45);
  z-index: 90;
}

.sos-floating:active,
.sos-floating.dragging {
  cursor: grabbing;
}

.sos-floating.dragging {
  box-shadow: 0 10px 28px rgba(225, 29, 72, 0.55);
  user-select: none;
}

.sos-floating.active {
  animation: sos-pulse 1.4s infinite;
}

/* On mobile the composer is pinned at the bottom, so the SOS floats above it */
@media (max-width: 768px) {
  .sos-floating {
    bottom: 96px;
  }
}

@keyframes sos-pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(225, 29, 72, 0.5);
  }

  70% {
    box-shadow: 0 0 0 16px rgba(225, 29, 72, 0);
  }

  100% {
    box-shadow: 0 0 0 0 rgba(225, 29, 72, 0);
  }
}

.btn-block {
  width: 100%;
}

.badge-red {
  color: #a00000;
  background: #ffe3e3;
}

.badge-orange {
  color: #8a4b00;
  background: #ffedd5;
}

.badge-green {
  color: #0a6b2d;
  background: #dcfce7;
}
</style>
