/* ============================================================
   NEXUS SOCIAL — notifications.js
   Notification dropdown rendering, read/unread state, badge.
   ============================================================ */

'use strict';

const Notifications = (() => {
  const { DB, Toast, Time, avatarHTML, escapeHtml } = window.NexusApp;

  /* ---------- Boot ---------- */
  function init() {
    refreshBadge();
  }

  /* ---------- Badge ---------- */
  function refreshBadge() {
    const unread = DB.getNotifications().filter((n) => !n.read).length;
    const bell = document.getElementById('notifBellBtn');
    if (!bell) return;
    let badge = bell.querySelector('#notifBadge');
    if (unread > 0) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'nav-badge';
        badge.id = 'notifBadge';
        bell.appendChild(badge);
      }
      badge.textContent = unread > 99 ? '99+' : unread;
    } else if (badge) {
      badge.remove();
    }
  }

  /* ---------- Dropdown renderer ---------- */
  function renderDropdown(container) {
    const list = DB.getNotifications();
    const user = DB.getCurrentUser();

    container.innerHTML = `
      <div class="dropdown-header">
        Notifications
        ${list.length > 0 ? `<button class="widget-link" id="markAllRead">Mark all as read</button>` : ''}
      </div>
      <div class="dropdown-divider" style="margin:0 0 8px;"></div>
      <div id="notifList" style="max-height:420px; overflow-y:auto;"></div>
      ${list.length > 0 ? `
        <div class="dropdown-divider"></div>
        <button class="dropdown-item" id="clearNotifs" style="justify-content:center; color:var(--error);">
          <div class="item-title">Clear notifications</div>
        </button>
      ` : ''}
    `;

    const listBox = container.querySelector('#notifList');

    if (list.length === 0) {
      listBox.innerHTML = `
        <div class="empty-state" style="padding:32px 16px;">
          <div class="es-icon" style="width:56px; height:56px; margin-bottom:12px;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
          </div>
          <p style="margin:0; font-size:13px;">You're all caught up.</p>
        </div>
      `;
    } else {
      listBox.innerHTML = list.map((n) => notificationHTML(n, user)).join('');
      listBox.querySelectorAll('[data-notif]').forEach((row) =>
        row.addEventListener('click', () => {
          const id = row.getAttribute('data-notif');
          markRead(id);
          row.classList.remove('unread');
        })
      );
    }

    container.querySelector('#markAllRead')?.addEventListener('click', (e) => {
      e.stopPropagation();
      markAllRead();
      renderDropdown(container);
      Toast.success('All notifications marked as read.');
    });

    container.querySelector('#clearNotifs')?.addEventListener('click', (e) => {
      e.stopPropagation();
      DB.setNotifications([]);
      refreshBadge();
      renderDropdown(container);
      Toast.success('Notifications cleared.');
    });
  }

  function notificationHTML(n, currentUser) {
    let actor = n.actorId ? DB.getUserById(n.actorId) : null;
    let text = '';

    if (n.type === 'welcome') {
      return `
        <div class="dropdown-item ${n.read ? '' : 'unread'}" data-notif="${n.id}" style="${n.read ? '' : 'background:var(--brand-primary-light);'}">
          <span class="item-icon" style="background:var(--brand-primary); color:#fff;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
          </span>
          <div style="flex:1; min-width:0;">
            <div class="item-title">${escapeHtml(n.text || 'Welcome to Nexus!')}</div>
            <div class="item-sub">${Time.relative(n.createdAt)}</div>
          </div>
        </div>
      `;
    }

    const actorName = actor ? escapeHtml(actor.fullName) : 'Someone';

    if (n.type === 'like') {
      text = `<b>${actorName}</b> liked your post.`;
    } else if (n.type === 'comment') {
      text = `<b>${actorName}</b> commented: "${escapeHtml((n.text || '').slice(0, 40))}${(n.text || '').length > 40 ? '…' : ''}"`;
    } else if (n.type === 'friend_request') {
      text = `<b>${actorName}</b> sent you a friend request.`;
    } else if (n.type === 'friend_accept') {
      text = `<b>${actorName}</b> accepted your friend request.`;
    } else if (n.type === 'follow') {
      text = `<b>${actorName}</b> started following you.`;
    } else if (n.type === 'share') {
      text = `<b>${actorName}</b> shared your post.`;
    } else {
      text = `<b>${actorName}</b> interacted with your content.`;
    }

    const avatar = actor ? avatarHTML(actor, 'avatar-sm') : `
      <span class="avatar-sm avatar-fallback" style="background:var(--brand-primary);">N</span>
    `;

    return `
      <div class="dropdown-item ${n.read ? '' : 'unread'}" data-notif="${n.id}" style="${n.read ? '' : 'background:var(--brand-primary-light);'}">
        <span class="avatar-wrap">${avatar}</span>
        <div style="flex:1; min-width:0;">
          <div class="item-sub" style="font-size:14px; color:var(--text-primary); line-height:1.5;">${text}</div>
          <div class="item-sub" style="margin-top:2px;">${Time.relative(n.createdAt)}</div>
        </div>
        ${!n.read ? '<span style="width:8px; height:8px; border-radius:50%; background:var(--brand-primary); flex-shrink:0;"></span>' : ''}
      </div>
    `;
  }

  /* ---------- State helpers ---------- */
  function markRead(id) {
    const list = DB.getNotifications();
    const n = list.find((x) => x.id === id);
    if (n && !n.read) {
      n.read = true;
      DB.setNotifications(list);
      refreshBadge();
    }
  }

  function markAllRead() {
    const list = DB.getNotifications();
    list.forEach((n) => (n.read = true));
    DB.setNotifications(list);
    refreshBadge();
  }

  return { init, refreshBadge, renderDropdown, markRead, markAllRead };
})();

window.Notifications = Notifications;
