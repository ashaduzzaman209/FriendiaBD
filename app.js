/* ============================================================
   FRIENDIABD SOCIAL — app.js
   Core application layer:
     • Storage abstraction (localStorage helpers)
     • Demo data seeding
     • Safe DOM helpers
     • Toast notification system
     • Modal system
     • Layout renderers (topnav, sidebars, mobile nav)
     • Search
   ------------------------------------------------------------
   IMPORTANT: This is a frontend-only demo. All persistence
   uses localStorage and is NOT secure for real users. When
   connecting a real backend, replace the Storage.* helpers
   with API calls (see comments below).
   ============================================================ */

'use strict';

/* ============================================================
   1. SAFE STORAGE LAYER
   ============================================================ */

const Storage = (() => {
  const NS = 'nexus_';

  function key(k) { return NS + k; }

  function get(k, fallback = null) {
    try {
      const raw = localStorage.getItem(key(k));
      if (raw === null) return fallback;
      return JSON.parse(raw);
    } catch (err) {
      console.warn(`[Storage] Corrupted data for "${k}", using fallback.`, err);
      try { localStorage.removeItem(key(k)); } catch (_) {}
      return fallback;
    }
  }

  function set(k, value) {
    try {
      localStorage.setItem(key(k), JSON.stringify(value));
      return true;
    } catch (err) {
      console.error('[Storage] Failed to save (quota?).', err);
      return false;
    }
  }

  function remove(k) {
    try { localStorage.removeItem(key(k)); } catch (_) {}
  }

  function clearAll() {
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith(NS))
        .forEach((k) => localStorage.removeItem(k));
    } catch (_) {}
  }

  // Convenience helper: read-modify-write
  function update(k, mutator, fallback = []) {
    const current = get(k, fallback);
    const next = mutator(current);
    set(k, next);
    return next;
  }

  return { get, set, remove, clearAll, update };
})();

/* ============================================================
   2. UNIQUE ID GENERATOR
   ============================================================ */

function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

/* ============================================================
   3. DOM SAFETY HELPERS
   ============================================================ */

/** Escape a string so it can be safely inserted into HTML. */
function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Shorthand query selectors. */
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/** Create an element with attributes and children. */
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null) continue;
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const c of children) {
    if (c == null) continue;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

/* ============================================================
   4. DATE / TIME FORMATTING
   ============================================================ */

const Time = {
  now: () => Date.now(),

  relative(ts) {
    const diff = Date.now() - ts;
    const s = Math.floor(diff / 1000);
    if (s < 5) return 'Just now';
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${d}d`;
    const w = Math.floor(d / 7);
    if (w < 5) return `${w}w`;
    return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  },

  full(ts) {
    return new Date(ts).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit',
    });
  },

  dateOnly(ts) {
    return new Date(ts).toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
    });
  },
};

/* ============================================================
   5. TOAST NOTIFICATION SYSTEM
   ============================================================ */

const Toast = (() => {
  const ICONS = {
    success: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    error:   '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/></svg>',
    warning: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3Z"/><path d="M12 9v4M12 17h.01"/></svg>',
    info:    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>',
  };

  function getContainer() {
    let c = document.getElementById('toastContainer');
    if (!c) {
      c = el('div', { class: 'toast-container', id: 'toastContainer', 'aria-live': 'polite' });
      document.body.appendChild(c);
    }
    return c;
  }

  function show(message, type = 'info', duration = 3200) {
    const container = getContainer();
    const toast = el('div', { class: `toast ${type}`, role: 'status' });
    toast.innerHTML = `
      <span class="toast-icon">${ICONS[type] || ICONS.info}</span>
      <span class="toast-msg">${escapeHtml(message)}</span>
      <button class="toast-close" aria-label="Close notification">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
      </button>
    `;

    const dismiss = () => {
      toast.classList.add('leaving');
      setTimeout(() => toast.remove(), 220);
    };

    toast.querySelector('.toast-close').addEventListener('click', dismiss);
    container.appendChild(toast);

    if (duration > 0) setTimeout(dismiss, duration);
    return toast;
  }

  return {
    show,
    success: (m, d) => show(m, 'success', d),
    error:   (m, d) => show(m, 'error', d),
    warning: (m, d) => show(m, 'warning', d),
    info:    (m, d) => show(m, 'info', d),
  };
})();

/* ============================================================
   6. MODAL SYSTEM
   ============================================================ */

const Modal = (() => {
  let activeModal = null;

  function open(innerHTML, opts = {}) {
    close(); // only one at a time

    const overlay = el('div', {
      class: 'modal-overlay',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': opts.label || 'Dialog',
    });

    const modal = el('div', { class: `modal ${opts.size || ''}` });
    modal.innerHTML = innerHTML;
    overlay.appendChild(modal);

    // Close on backdrop click (unless disabled)
    if (opts.closeOnBackdrop !== false) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close();
      });
    }

    // Close buttons inside the modal
    $$('.modal-close', modal).forEach((btn) =>
      btn.addEventListener('click', () => close())
    );
    $$('[data-modal-close]', modal).forEach((btn) =>
      btn.addEventListener('click', () => close())
    );

    // Escape key
    const escHandler = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', escHandler);

    document.getElementById('modalRoot').appendChild(overlay);
    document.body.style.overflow = 'hidden';

    activeModal = { overlay, modal, escHandler };
    return modal;
  }

  function close() {
    if (!activeModal) return;
    document.removeEventListener('keydown', activeModal.escHandler);
    activeModal.overlay.remove();
    document.body.style.overflow = '';
    activeModal = null;
  }

  /** Confirmation dialog helper. */
  function confirm({ title, message, confirmText = 'Confirm', cancelText = 'Cancel', danger = false }) {
    return new Promise((resolve) => {
      const modal = open(`
        <div class="modal-header">
          <div class="modal-title">${escapeHtml(title)}</div>
          <button class="modal-close" aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="modal-body">
          <p style="margin:0; color: var(--text-secondary); line-height:1.6;">${escapeHtml(message)}</p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" data-cancel>${escapeHtml(cancelText)}</button>
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-confirm>${escapeHtml(confirmText)}</button>
        </div>
      `, { size: 'modal-sm' });

      modal.querySelector('[data-cancel]').addEventListener('click', () => {
        Modal.close(); resolve(false);
      });
      modal.querySelector('[data-confirm]').addEventListener('click', () => {
        Modal.close(); resolve(true);
      });
      // Overlay/esc close = false
      const observer = new MutationObserver(() => {
        if (!document.body.contains(modal)) { resolve(false); observer.disconnect(); }
      });
      observer.observe(document.getElementById('modalRoot'), { childList: true });
    });
  }

  /** Image preview modal. */
  function previewImage(src, alt = '') {
    open(`
      <div class="modal-header">
        <div class="modal-title">Photo</div>
        <button class="modal-close" aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="modal-body" style="padding: 0;">
        <img src="${src}" alt="${escapeHtml(alt)}" style="width:100%; max-height:80vh; object-fit:contain; background:#000;" />
      </div>
    `, { size: 'modal-lg', closeOnBackdrop: true });
  }

  return { open, close, confirm, previewImage };
})();

/* ============================================================
   7. IMAGE VALIDATION + FILE READER
   ============================================================ */

const ImageUpload = (() => {
  const ALLOWED = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const MAX_BYTES = 4 * 1024 * 1024; // 4 MB

  function validate(file) {
    if (!file) return 'No file selected.';
    if (!ALLOWED.includes(file.type)) {
      return 'Invalid file type. Please choose a JPG, PNG or WEBP image.';
    }
    if (file.size > MAX_BYTES) {
      return 'Image is too large. Maximum size is 4 MB.';
    }
    return null;
  }

  /** Reads a File and returns a Promise<dataURL>. */
  function read(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Failed to read file.'));
      reader.readAsDataURL(file);
    });
  }

  return { validate, read, ALLOWED, MAX_BYTES };
})();

/* ============================================================
   8. AVATAR RENDERING HELPER
   ============================================================ */

/** Returns an <img> or fallback div string for a given user. */
function avatarHTML(user, sizeClass = 'avatar') {
  if (!user) {
    return `<div class="${sizeClass} avatar-fallback">?</div>`;
  }
  const name = user.fullName || user.username || '?';
  if (user.avatar) {
    return `<img class="${sizeClass}" src="${user.avatar}" alt="${escapeHtml(name)}" />`;
  }
  const initials = name.split(' ').map((w) => w[0]).slice(0, 2).join('');
  return `<div class="${sizeClass} avatar-fallback">${escapeHtml(initials)}</div>`;
}

/** Returns avatar HTML wrapped in a relative container with online dot. */
function avatarWithStatus(user, sizeClass = 'avatar', online = false) {
  return `
    <span class="avatar-wrap">
      ${avatarHTML(user, sizeClass)}
      ${online ? '<span class="online-dot"></span>' : ''}
    </span>
  `;
}

/* ============================================================
   9. DATA ACCESS LAYER
   ------------------------------------------------------------
   All reads/writes of app data go through these helpers.
   To connect a real backend, replace each function body with
   fetch() calls to your API.
   ============================================================ */

const DB = {
  /* ----- Users ----- */
  getUsers()       { return Storage.get('users', []); },
  setUsers(list)   { Storage.set('users', list); },
  getUserById(id)  { return this.getUsers().find((u) => u.id === id) || null; },
  getUserByEmail(email) {
    return this.getUsers().find((u) => u.email.toLowerCase() === String(email).toLowerCase()) || null;
  },
  getUserByUsername(username) {
    return this.getUsers().find((u) => u.username.toLowerCase() === String(username).toLowerCase()) || null;
  },
  saveUser(user) {
    const users = this.getUsers();
    const idx = users.findIndex((u) => u.id === user.id);
    if (idx >= 0) users[idx] = user; else users.push(user);
    this.setUsers(users);
  },

  /* ----- Current session ----- */
  getCurrentUser() {
    const id = Storage.get('currentUserId', null);
    if (!id) return null;
    return this.getUserById(id);
  },
  setCurrentUser(id) { Storage.set('currentUserId', id); },
  clearCurrentUser() { Storage.remove('currentUserId'); },

  /* ----- Posts ----- */
  getPosts()       { return Storage.get('posts', []); },
  setPosts(list)   { Storage.set('posts', list); },
  getPostById(id)  { return this.getPosts().find((p) => p.id === id) || null; },
  savePost(post) {
    const posts = this.getPosts();
    const idx = posts.findIndex((p) => p.id === post.id);
    if (idx >= 0) posts[idx] = post; else posts.unshift(post);
    this.setPosts(posts);
  },
  deletePost(id) {
    this.setPosts(this.getPosts().filter((p) => p.id !== id));
    // Cascade delete comments
    this.setComments(this.getComments().filter((c) => c.postId !== id));
  },

  /* ----- Comments ----- */
  getComments()          { return Storage.get('comments', []); },
  setComments(list)      { Storage.set('comments', list); },
  getCommentsForPost(pid){ return this.getComments().filter((c) => c.postId === pid); },
  saveComment(comment) {
    this.setComments([...this.getComments(), comment]);
  },
  deleteComment(id) {
    this.setComments(this.getComments().filter((c) => c.id !== id));
  },

  /* ----- Likes (per post, array of userIds) ----- */
  getLikes()      { return Storage.get('likes', {}); },
  setLikes(obj)   { Storage.set('likes', obj); },
  isLiked(postId, userId) {
    const likes = this.getLikes();
    return (likes[postId] || []).includes(userId);
  },
  toggleLike(postId, userId) {
    const likes = this.getLikes();
    const arr = likes[postId] || [];
    const idx = arr.indexOf(userId);
    if (idx >= 0) arr.splice(idx, 1); else arr.push(userId);
    likes[postId] = arr;
    this.setLikes(likes);
    return idx < 0; // true if now liked
  },

  /* ----- Comment likes ----- */
  getCommentLikes()      { return Storage.get('commentLikes', {}); },
  setCommentLikes(obj)   { Storage.set('commentLikes', obj); },
  isCommentLiked(cid, uid) {
    return (this.getCommentLikes()[cid] || []).includes(uid);
  },
  toggleCommentLike(cid, uid) {
    const all = this.getCommentLikes();
    const arr = all[cid] || [];
    const idx = arr.indexOf(uid);
    if (idx >= 0) arr.splice(idx, 1); else arr.push(uid);
    all[cid] = arr;
    this.setCommentLikes(all);
    return idx < 0;
  },

  /* ----- Saved posts ----- */
  getSaved()          { return Storage.get('savedPosts', []); },
  setSaved(list)      { Storage.set('savedPosts', list); },
  isSaved(postId, uid) { return this.getSaved().some((s) => s.postId === postId && s.userId === uid); },
  toggleSave(postId, uid) {
    const list = this.getSaved();
    const idx = list.findIndex((s) => s.postId === postId && s.userId === uid);
    if (idx >= 0) { list.splice(idx, 1); this.setSaved(list); return false; }
    list.push({ postId, userId: uid, savedAt: Date.now() });
    this.setSaved(list);
    return true;
  },

  /* ----- Friends / requests ----- */
  getFriends()          { return Storage.get('friends', {}); }, // { userId: [friendIds] }
  setFriends(obj)       { Storage.set('friends', obj); },
  getFriendRequests()   { return Storage.get('friendRequests', []); }, // [{id, from, to, status, createdAt}]
  setFriendRequests(l)  { Storage.set('friendRequests', l); },
  areFriends(a, b)      { return (this.getFriends()[a] || []).includes(b); },
  addFriendship(a, b) {
    const f = this.getFriends();
    f[a] = Array.from(new Set([...(f[a] || []), b]));
    f[b] = Array.from(new Set([...(f[b] || []), a]));
    this.setFriends(f);
  },
  removeFriendship(a, b) {
    const f = this.getFriends();
    f[a] = (f[a] || []).filter((id) => id !== b);
    f[b] = (f[b] || []).filter((id) => id !== a);
    this.setFriends(f);
  },

  /* ----- Follows ----- */
  getFollows()       { return Storage.get('follows', {}); }, // { userId: [followedIds] }
  setFollows(obj)    { Storage.set('follows', obj); },
  isFollowing(a, b)  { return (this.getFollows()[a] || []).includes(b); },
  toggleFollow(a, b) {
    const f = this.getFollows();
    const arr = f[a] || [];
    const idx = arr.indexOf(b);
    if (idx >= 0) { arr.splice(idx, 1); f[a] = arr; this.setFollows(f); return false; }
    arr.push(b); f[a] = arr; this.setFollows(f); return true;
  },
  getFollowers(userId) {
    const f = this.getFollows();
    return Object.keys(f).filter((uid) => f[uid].includes(userId));
  },
  getFollowing(userId) { return this.getFollows()[userId] || []; },

  /* ----- Notifications ----- */
  getNotifications()         { return Storage.get('notifications', []); },
  setNotifications(list)     { Storage.set('notifications', list); },
  addNotification(notif) {
    const list = this.getNotifications();
    list.unshift({ id: uid('n'), createdAt: Date.now(), read: false, ...notif });
    this.setNotifications(list);
  },

  /* ----- Messages ----- */
  getConversations()      { return Storage.get('conversations', []); },
  setConversations(list)  { Storage.set('conversations', list); },
  getMessages()           { return Storage.get('messages', []); },
  setMessages(list)       { Storage.set('messages', list); },
  getMessagesForConv(cid) { return this.getMessages().filter((m) => m.conversationId === cid); },
  saveMessage(msg)        { this.setMessages([...this.getMessages(), msg]); },

  /* ----- Stories ----- */
  getStories()      { return Storage.get('stories', []); },
  setStories(list)  { Storage.set('stories', list); },
  addStory(story)   { this.setStories([...this.getStories(), story]); },

  /* ----- Settings ----- */
  getSettings()           { return Storage.get('settings', {}); },
  setSettings(obj)        { Storage.set('settings', obj); },
  updateSettings(partial) {
    const s = { ...this.getSettings(), ...partial };
    this.setSettings(s);
    return s;
  },

  /* ----- Theme ----- */
  getTheme()      { return Storage.get('theme', 'light'); },
  setTheme(theme) { Storage.set('theme', theme); },
};

/* ============================================================
   10. DEMO DATA SEEDING
   ------------------------------------------------------------
   Populates realistic demo content the first time the app runs.
   Demo users have a `isDemo: true` flag.
   ============================================================ */

const SEED_KEY = 'seeded_v1';

const DemoData = (() => {
  const DEMO_AVATARS = [
    'https://i.pravatar.cc/200?img=5',
    'https://i.pravatar.cc/200?img=12',
    'https://i.pravatar.cc/200?img=32',
    'https://i.pravatar.cc/200?img=45',
    'https://i.pravatar.cc/200?img=68',
    'https://i.pravatar.cc/200?img=13',
  ];
  const DEMO_COVERS = [
    'https://picsum.photos/seed/nexus1/1200/400',
    'https://picsum.photos/seed/nexus2/1200/400',
    'https://picsum.photos/seed/nexus3/1200/400',
    'https://picsum.photos/seed/nexus4/1200/400',
  ];
  const DEMO_POST_IMAGES = [
    'https://picsum.photos/seed/post1/900/600',
    'https://picsum.photos/seed/post2/900/600',
    'https://picsum.photos/seed/post3/900/600',
    'https://picsum.photos/seed/post4/900/600',
  ];

  function seed() {
    if (Storage.get(SEED_KEY)) return;

    // ----- Demo users -----
    const demoUsers = [
      {
        id: 'demo_alex', fullName: 'Alex Rivera', username: 'alexr',
        email: 'alex@demo.nexus', password: 'demo1234',
        dob: '1996-04-12', gender: 'other',
        bio: 'Product designer · Coffee enthusiast · Building things on the web.',
        location: 'Lisbon, Portugal', website: 'alexrivera.design',
        avatar: DEMO_AVATARS[0], cover: DEMO_COVERS[0],
        joinedAt: Date.now() - 1000 * 60 * 60 * 24 * 420,
        isDemo: true,
      },
      {
        id: 'demo_maya', fullName: 'Maya Chen', username: 'mayac',
        email: 'maya@demo.nexus', password: 'demo1234',
        dob: '1994-09-08', gender: 'female',
        bio: 'Photographer capturing everyday light. Currently in Tokyo.',
        location: 'Tokyo, Japan', website: 'maya-shoots.com',
        avatar: DEMO_AVATARS[1], cover: DEMO_COVERS[1],
        joinedAt: Date.now() - 1000 * 60 * 60 * 24 * 300,
        isDemo: true,
      },
      {
        id: 'demo_sam', fullName: 'Sam Okafor', username: 'samo',
        email: 'sam@demo.nexus', password: 'demo1234',
        dob: '1992-01-22', gender: 'male',
        bio: 'Full-stack developer. I write code and lift heavy things.',
        location: 'Lagos, Nigeria', website: 'samokafor.dev',
        avatar: DEMO_AVATARS[2], cover: DEMO_COVERS[2],
        joinedAt: Date.now() - 1000 * 60 * 60 * 24 * 250,
        isDemo: true,
      },
      {
        id: 'demo_priya', fullName: 'Priya Nair', username: 'priyan',
        email: 'priya@demo.nexus', password: 'demo1234',
        dob: '1998-06-30', gender: 'female',
        bio: 'UX researcher · Avid reader · Tea over coffee, always.',
        location: 'Bangalore, India', website: '',
        avatar: DEMO_AVATARS[3], cover: DEMO_COVERS[3],
        joinedAt: Date.now() - 1000 * 60 * 60 * 24 * 180,
        isDemo: true,
      },
      {
        id: 'demo_liam', fullName: 'Liam Walsh', username: 'liamw',
        email: 'liam@demo.nexus', password: 'demo1234',
        dob: '1995-11-15', gender: 'male',
        bio: 'Music producer by night, marketing by day.',
        location: 'Dublin, Ireland', website: '',
        avatar: DEMO_AVATARS[4], cover: DEMO_COVERS[0],
        joinedAt: Date.now() - 1000 * 60 * 60 * 24 * 120,
        isDemo: true,
      },
    ];
    DB.setUsers(demoUsers);

    // ----- Friend graph between demo users -----
    DB.setFriends({
      demo_alex: ['demo_maya', 'demo_sam', 'demo_priya'],
      demo_maya: ['demo_alex', 'demo_sam', 'demo_priya', 'demo_liam'],
      demo_sam:  ['demo_alex', 'demo_maya'],
      demo_priya:['demo_alex', 'demo_maya'],
      demo_liam: ['demo_maya'],
    });

    // ----- Follows -----
    DB.setFollows({
      demo_alex: ['demo_maya', 'demo_sam'],
      demo_maya: ['demo_alex'],
      demo_sam:  ['demo_alex', 'demo_maya'],
      demo_priya:['demo_maya'],
    });

    // ----- Posts -----
    const now = Date.now();
    const posts = [
      {
        id: 'post_1', authorId: 'demo_maya',
        text: 'Golden hour in Shibuya never gets old. Spent an hour just watching the light change across the crossing. 🌇',
        image: DEMO_POST_IMAGES[0],
        privacy: 'public',
        createdAt: now - 1000 * 60 * 45,
      },
      {
        id: 'post_2', authorId: 'demo_sam',
        text: 'Shipped a new feature today after three weeks of refactoring. There is nothing quite like the feeling of deleting more code than you added.',
        image: null, privacy: 'public',
        createdAt: now - 1000 * 60 * 60 * 3,
      },
      {
        id: 'post_3', authorId: 'demo_alex',
        text: 'Working on a new design system for a client. Here is a sneak peek at the color tokens — soft, warm, and surprisingly hard to get right.',
        image: DEMO_POST_IMAGES[1],
        privacy: 'public',
        createdAt: now - 1000 * 60 * 60 * 8,
      },
      {
        id: 'post_4', authorId: 'demo_priya',
        text: 'Finished reading "The Design of Everyday Things" for the third time. Still the best book on why some things just feel *right* to use.',
        image: null, privacy: 'public',
        createdAt: now - 1000 * 60 * 60 * 20,
      },
      {
        id: 'post_5', authorId: 'demo_liam',
        text: 'Late night session in the studio. Sometimes the best ideas only show up after midnight.',
        image: DEMO_POST_IMAGES[2],
        privacy: 'public',
        createdAt: now - 1000 * 60 * 60 * 26,
      },
      {
        id: 'post_6', authorId: 'demo_maya',
        text: 'Reminder to self: rest is part of the work.',
        image: null, privacy: 'public',
        createdAt: now - 1000 * 60 * 60 * 40,
      },
    ];
    DB.setPosts(posts);

    // ----- Likes -----
    DB.setLikes({
      post_1: ['demo_alex', 'demo_sam', 'demo_priya', 'demo_liam'],
      post_2: ['demo_maya', 'demo_alex'],
      post_3: ['demo_maya', 'demo_priya', 'demo_sam'],
      post_4: ['demo_alex'],
      post_5: ['demo_maya', 'demo_priya'],
      post_6: [],
    });

    // ----- Comments -----
    DB.setComments([
      { id: 'c1', postId: 'post_1', authorId: 'demo_alex', text: 'The colors here are unreal. What lens?', createdAt: now - 1000 * 60 * 30, parentId: null },
      { id: 'c2', postId: 'post_1', authorId: 'demo_maya', text: 'Thank you! 35mm, my go-to.', createdAt: now - 1000 * 60 * 25, parentId: 'c1' },
      { id: 'c3', postId: 'post_2', authorId: 'demo_priya', text: 'Deleting code is underrated.', createdAt: now - 1000 * 60 * 60 * 2, parentId: null },
      { id: 'c4', postId: 'post_3', authorId: 'demo_sam', text: 'Those warm neutrals 😍', createdAt: now - 1000 * 60 * 60 * 7, parentId: null },
      { id: 'c5', postId: 'post_5', authorId: 'demo_alex', text: 'Midnight sessions hit different.', createdAt: now - 1000 * 60 * 60 * 24, parentId: null },
    ]);
    DB.setCommentLikes({ c1: ['demo_maya'], c3: ['demo_alex'] });

    // ----- Notifications -----
    DB.setNotifications([
      { id: uid('n'), type: 'like', actorId: 'demo_maya', postId: 'post_3', createdAt: now - 1000 * 60 * 5, read: false },
      { id: uid('n'), type: 'comment', actorId: 'demo_sam', postId: 'post_3', text: 'Those warm neutrals 😍', createdAt: now - 1000 * 60 * 60 * 7, read: false },
      { id: uid('n'), type: 'follow', actorId: 'demo_priya', createdAt: now - 1000 * 60 * 60 * 14, read: true },
    ]);

    // ----- Messages -----
    const conv1 = { id: 'conv_1', participants: ['demo_alex', 'demo_maya'], updatedAt: now - 1000 * 60 * 20 };
    const conv2 = { id: 'conv_2', participants: ['demo_alex', 'demo_sam'], updatedAt: now - 1000 * 60 * 60 * 5 };
    DB.setConversations([conv1, conv2]);
    DB.setMessages([
      { id: uid('m'), conversationId: 'conv_1', senderId: 'demo_maya', text: 'Hey! Did you see the new brief?', createdAt: now - 1000 * 60 * 90 },
      { id: uid('m'), conversationId: 'conv_1', senderId: 'demo_alex', text: 'Yes, just read it. Looks exciting!', createdAt: now - 1000 * 60 * 80 },
      { id: uid('m'), conversationId: 'conv_1', senderId: 'demo_maya', text: 'Want to jump on a call later?', createdAt: now - 1000 * 60 * 20 },
      { id: uid('m'), conversationId: 'conv_2', senderId: 'demo_sam', text: 'Deployed the fix. Should be stable now.', createdAt: now - 1000 * 60 * 60 * 5 },
    ]);

    // ----- Stories -----
    DB.setStories([
      { id: 'story_1', authorId: 'demo_maya', image: DEMO_POST_IMAGES[0], createdAt: now - 1000 * 60 * 30, viewers: [] },
      { id: 'story_2', authorId: 'demo_sam', image: DEMO_POST_IMAGES[3], createdAt: now - 1000 * 60 * 120, viewers: [] },
      { id: 'story_3', authorId: 'demo_priya', image: DEMO_POST_IMAGES[2], createdAt: now - 1000 * 60 * 200, viewers: [] },
    ]);

    Storage.set(SEED_KEY, true);
  }

  return { seed };
})();

/* ============================================================
   11. THEME
   ============================================================ */

const Theme = (() => {
  function apply(theme) {
    document.body.classList.toggle('theme-dark', theme === 'dark');
    DB.setTheme(theme);
  }
  function current() { return DB.getTheme(); }
  function toggle() {
    const next = current() === 'dark' ? 'light' : 'dark';
    apply(next);
    return next;
  }
  function init() { apply(current()); }
  return { init, apply, toggle, current };
})();

/* ============================================================
   12. AUTH GUARD
   ============================================================ */

const AuthGuard = {
  requireLogin(redirectTo = 'login.html') {
    if (!DB.getCurrentUser()) {
      window.location.replace(redirectTo);
      return false;
    }
    return true;
  },
  redirectIfLoggedIn(to = 'index.html') {
    if (DB.getCurrentUser()) {
      window.location.replace(to);
      return true;
    }
    return false;
  },
};

/* ============================================================
   13. LAYOUT RENDERERS — Top Navigation
   ============================================================ */

const TopNav = (() => {
  const ICONS = {
    home: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></svg>',
    friends: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    messages: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    bell: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>',
    search: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>',
    chevron: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
    user: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    settings: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>',
    moon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>',
    help: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>',
    logout: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></svg>',
  };

  function render() {
    const header = document.getElementById('topnav');
    if (!header) return;
    const user = DB.getCurrentUser();
    if (!user) { header.innerHTML = ''; return; }

    const unreadNotifs = DB.getNotifications().filter((n) => !n.read).length;
    const unreadMsgs = DB.getConversations().length; // demo value

    header.innerHTML = `
      <div class="nav-brand">
        <a href="index.html" class="brand-logo" aria-label="Friendiabd home">
          <span class="brand-mark">F</span>
          <span class="brand-text">Friendiabd</span>
        </a>
      </div>

      <div class="nav-search" role="search">
        <span class="search-icon">${ICONS.search}</span>
        <input type="search" id="globalSearch" placeholder="Search Nexus" aria-label="Search Friendiabd" autocomplete="off" />
        <div id="searchResults" class="search-results hidden"></div>
      </div>

      <nav class="nav-actions" aria-label="User actions">
        <a href="index.html" class="nav-icon-btn active" aria-label="Home">${ICONS.home}</a>
        <button class="nav-icon-btn" data-nav="friends" aria-label="Friends">${ICONS.friends}</button>
        <button class="nav-icon-btn" data-nav="messages" aria-label="Messages">
          ${ICONS.messages}
          ${unreadMsgs ? `<span class="nav-badge">${unreadMsgs}</span>` : ''}
        </button>
        <div class="dropdown-wrap">
          <button class="nav-icon-btn" data-nav="notifications" id="notifBellBtn" aria-label="Notifications" aria-haspopup="true" aria-expanded="false">
            ${ICONS.bell}
            ${unreadNotifs ? `<span class="nav-badge" id="notifBadge">${unreadNotifs}</span>` : ''}
          </button>
          <div class="dropdown wide hidden" id="notifDropdown" role="menu"></div>
        </div>
        <div class="dropdown-wrap">
          <button class="nav-avatar-btn" id="profileMenuBtn" aria-label="Account menu" aria-haspopup="true" aria-expanded="false">
            ${avatarHTML(user, 'avatar')}
          </button>
          <div class="dropdown hidden" id="profileDropdown" role="menu">
            <a href="profile.html" class="dropdown-item">
              <span class="item-icon">${ICONS.user}</span>
              <div>
                <div class="item-title">View Profile</div>
                <div class="item-sub">@${escapeHtml(user.username)}</div>
              </div>
            </a>
            <a href="settings.html" class="dropdown-item">
              <span class="item-icon">${ICONS.settings}</span>
              <div class="item-title">Settings</div>
            </a>
            <div class="dropdown-divider"></div>
            <button class="dropdown-item" id="darkModeToggle">
              <span class="item-icon">${ICONS.moon}</span>
              <div class="item-title">Dark Mode</div>
              <span class="switch ${Theme.current() === 'dark' ? 'on' : ''}" id="darkSwitch"></span>
            </button>
            <button class="dropdown-item" id="helpBtn">
              <span class="item-icon">${ICONS.help}</span>
              <div class="item-title">Help &amp; Support</div>
            </button>
            <div class="dropdown-divider"></div>
            <button class="dropdown-item" id="logoutBtn">
              <span class="item-icon">${ICONS.logout}</span>
              <div class="item-title">Log Out</div>
            </button>
          </div>
        </div>
      </nav>
    `;

    bindNavEvents();
  }

  function bindNavEvents() {
    const profileBtn = $('#profileMenuBtn');
    const profileDropdown = $('#profileDropdown');
    const notifBtn = $('#notifBellBtn');
    const notifDropdown = $('#notifDropdown');

    profileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeAllDropdowns();
      profileDropdown.classList.toggle('hidden');
      profileBtn.setAttribute('aria-expanded', !profileDropdown.classList.contains('hidden'));
    });

    notifBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeAllDropdowns();
      notifDropdown.classList.toggle('hidden');
      notifBtn.setAttribute('aria-expanded', !notifDropdown.classList.contains('hidden'));
      if (!notifDropdown.classList.contains('hidden')) {
        Notifications.renderDropdown(notifDropdown);
      }
    });

    // Dark mode toggle
    $('#darkModeToggle').addEventListener('click', (e) => {
      e.stopPropagation();
      const next = Theme.toggle();
      $('#darkSwitch').classList.toggle('on', next === 'dark');
      Toast.success(next === 'dark' ? 'Dark mode enabled' : 'Light mode enabled');
    });

    // Help
    $('#helpBtn').addEventListener('click', () => {
      closeAllDropdowns();
      Modal.open(`
        <div class="modal-header">
          <div class="modal-title">Help &amp; Support</div>
          <button class="modal-close" aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="modal-body">
          <p style="color:var(--text-secondary); line-height:1.6; margin-top:0;">Friendiabd is a frontend demo platform. If you have questions or feedback about how it works, this is the place.</p>
          <ul style="color:var(--text-secondary); line-height:1.9; padding-left:20px; margin:0;">
            <li>All data is stored locally in your browser.</li>
            <li>Nothing is sent to any server.</li>
            <li>Clearing browser data will reset your demo account.</li>
          </ul>
        </div>
      `, { size: 'modal-sm' });
    });

    // Logout
    $('#logoutBtn').addEventListener('click', async () => {
      closeAllDropdowns();
      const ok = await Modal.confirm({
        title: 'Log out of Nexus?',
        message: 'You can log back in at any time with your email and password.',
        confirmText: 'Log Out',
        danger: true,
      });
      if (ok) Auth.logout();
    });

    // Nav shortcuts
    $$('[data-nav="friends"]').forEach((b) => b.addEventListener('click', () => {
      Toast.info('Friends page is coming soon.');
    }));
    $$('[data-nav="messages"]').forEach((b) => b.addEventListener('click', () => {
      openMessenger();
    }));

    // Global search
    const searchInput = $('#globalSearch');
    if (searchInput) Search.bind(searchInput, $('#searchResults'));
  }

  function closeAllDropdowns() {
    $$('.dropdown').forEach((d) => d.classList.add('hidden'));
    $$('[aria-haspopup="true"]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
  }

  return { render, closeAllDropdowns, ICONS };
})();

/* Close dropdowns on outside click */
document.addEventListener('click', (e) => {
  if (!e.target.closest('.dropdown-wrap')) {
    TopNav.closeAllDropdowns();
  }
});

/* ============================================================
   14. LAYOUT RENDERERS — Left Sidebar
   ============================================================ */

const LeftSidebar = (() => {
  const ITEMS = [
    { id: 'home',     label: 'Home',       icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></svg>' },
    { id: 'friends',  label: 'Friends',    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>' },
    { id: 'groups',   label: 'Groups',     icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z"/></svg>' },
    { id: 'saved',    label: 'Saved',      icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>' },
    { id: 'memories', label: 'Memories',   icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>' },
    { id: 'events',   label: 'Events',     icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>' },
    { id: 'watch',    label: 'Watch',      icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 8-6 4 6 4V8Z"/><rect x="2" y="6" width="14" height="12" rx="2"/></svg>' },
    { id: 'market',   label: 'Marketplace',icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9h18l-2 11H5L3 9Z"/><path d="M3 9 5 3h14l2 6"/></svg>' },
    { id: 'settings', label: 'Settings',   icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>' },
  ];

  function render(container) {
    if (!container) return;
    const user = DB.getCurrentUser();
    if (!user) return;

    container.innerHTML = `
      <nav class="sidebar-nav" aria-label="Primary">
        <a href="index.html" class="sidebar-item active">
          <span class="icon-box">${ITEMS[0].icon}</span>
          Home
        </a>
        ${ITEMS.slice(1).map((it) => `
          <a class="sidebar-item" data-nav="${it.id}">
            <span class="icon-box">${it.icon}</span>
            ${it.label}
          </a>
        `).join('')}
      </nav>
      <div class="sidebar-divider"></div>
      <div class="sidebar-title">Your shortcuts</div>
      <nav class="sidebar-nav" id="shortcutsNav"></nav>
      <div class="sidebar-divider"></div>
      <div class="sidebar-title">Saved posts</div>
      <div id="sidebarSaved"></div>
    `;

    // Shortcuts: friends avatars
    const friends = (DB.getFriends()[user.id] || []).slice(0, 4)
      .map((id) => DB.getUserById(id)).filter(Boolean);

    const shortcuts = container.querySelector('#shortcutsNav');
    if (friends.length === 0) {
      shortcuts.innerHTML = `<div class="empty-state" style="padding:20px 10px;">
        <p style="margin:0; font-size:13px;">No shortcuts yet.</p>
      </div>`;
    } else {
      shortcuts.innerHTML = friends.map((f) => `
        <a href="profile.html?u=${encodeURIComponent(f.id)}" class="sidebar-item">
          <span class="avatar-wrap">${avatarHTML(f, 'avatar-sm')}</span>
          ${escapeHtml(f.fullName)}
        </a>
      `).join('');
    }

    // Saved posts count
    const savedCount = DB.getSaved().filter((s) => s.userId === user.id).length;
    const savedBox = container.querySelector('#sidebarSaved');
    savedBox.innerHTML = `
      <a class="sidebar-item" data-nav="saved">
        <span class="icon-box">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
        </span>
        Saved (${savedCount})
      </a>
    `;

    container.querySelectorAll('[data-nav]').forEach((btn) =>
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const nav = btn.getAttribute('data-nav');
        App.handleSidebarNav(nav);
      })
    );
  }

  return { render };
})();

/* ============================================================
   15. LAYOUT RENDERERS — Right Sidebar
   ============================================================ */

const RightSidebar = (() => {
  function render(container) {
    if (!container) return;
    const user = DB.getCurrentUser();
    if (!user) return;

    // Friend suggestions (demo users not yet friends)
    const friends = DB.getFriends()[user.id] || [];
    const suggestions = DB.getUsers()
      .filter((u) => u.id !== user.id && !friends.includes(u.id))
      .slice(0, 3);

    // Online friends (demo: first two friends)
    const onlineFriends = friends.map((id) => DB.getUserById(id)).filter(Boolean).slice(0, 5);

    // Birthdays (demo static)
    const birthdayFriends = DB.getUsers().slice(0, 2);

    container.innerHTML = `
      <div class="card">
        <div class="widget">
          <div class="widget-title">
            Sponsored
            <span class="widget-link">See all</span>
          </div>
          <div class="friend-row" style="cursor:pointer;">
            <div style="width:80px; height:60px; border-radius:10px; background:var(--brand-gradient); flex-shrink:0; display:flex; align-items:center; justify-content:center; color:#fff; font-weight:800;">AD</div>
            <div>
              <div class="name">Build modern web apps</div>
              <div class="sub">learnwithnexus.io</div>
            </div>
          </div>
          <div class="friend-row" style="cursor:pointer;">
            <div style="width:80px; height:60px; border-radius:10px; background:linear-gradient(135deg,#22c55e,#3b82f6); flex-shrink:0; display:flex; align-items:center; justify-content:center; color:#fff; font-weight:800;">AD</div>
            <div>
              <div class="name">Design systems course</div>
              <div class="sub">uicollective.co</div>
            </div>
          </div>
        </div>

        <div class="widget">
          <div class="widget-title">
            Friend requests
            <span class="widget-link" data-nav="requests">See all</span>
          </div>
          <div id="friendRequestsBox"></div>
        </div>

        <div class="widget">
          <div class="widget-title">Birthdays</div>
          ${birthdayFriends.map((f) => `
            <div class="birthday-row">
              <div class="birthday-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8"/><path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1"/><path d="M2 21h20"/><path d="M7 8v3M12 8v3M17 8v3"/></svg>
              </div>
              <div style="flex:1;">
                <div style="font-size:14px; font-weight:600;">${escapeHtml(f.fullName)}</div>
                <div style="font-size:13px; color:var(--text-muted);">Celebrating today 🎂</div>
              </div>
            </div>
          `).join('')}
        </div>

        <div class="widget">
          <div class="widget-title">Contacts</div>
          <div id="contactsList"></div>
        </div>
      </div>
    `;

    // Friend requests
    renderFriendRequests(container.querySelector('#friendRequestsBox'), user);

    // Contacts (online)
    const contactsList = container.querySelector('#contactsList');
    if (onlineFriends.length === 0) {
      contactsList.innerHTML = `<div class="empty-state" style="padding:20px 0;">
        <p style="margin:0; font-size:13px;">No contacts yet.</p>
      </div>`;
    } else {
      contactsList.innerHTML = onlineFriends.map((f) => `
        <div class="friend-row" data-open-chat="${f.id}">
          ${avatarWithStatus(f, 'avatar', true)}
          <div>
            <div class="name">${escapeHtml(f.fullName)}</div>
          </div>
        </div>
      `).join('');
      contactsList.querySelectorAll('[data-open-chat]').forEach((row) =>
        row.addEventListener('click', () => openMessenger(row.getAttribute('data-open-chat')))
      );
    }

    container.querySelectorAll('[data-nav]').forEach((btn) =>
      btn.addEventListener('click', () => App.handleSidebarNav(btn.getAttribute('data-nav')))
    );
  }

  function renderFriendRequests(box, user) {
    const requests = DB.getFriendRequests().filter(
      (r) => r.to === user.id && r.status === 'pending'
    );
    if (requests.length === 0) {
      box.innerHTML = `<div class="empty-state" style="padding:16px 0;">
        <p style="margin:0; font-size:13px;">No new friend requests.</p>
      </div>`;
      return;
    }
    box.innerHTML = requests.map((r) => {
      const from = DB.getUserById(r.from);
      if (!from) return '';
      return `
        <div class="friend-row" style="align-items:flex-start;">
          <a href="profile.html?u=${encodeURIComponent(from.id)}">${avatarHTML(from, 'avatar-lg')}</a>
          <div style="flex:1;">
            <div class="name">${escapeHtml(from.fullName)}</div>
            <div class="sub">${escapeHtml(from.username)}</div>
            <div style="display:flex; gap:6px; margin-top:8px;">
              <button class="btn btn-primary btn-sm" data-accept="${r.id}">Accept</button>
              <button class="btn btn-secondary btn-sm" data-decline="${r.id}">Decline</button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    box.querySelectorAll('[data-accept]').forEach((b) =>
      b.addEventListener('click', () => App.acceptFriendRequest(b.getAttribute('data-accept')))
    );
    box.querySelectorAll('[data-decline]').forEach((b) =>
      b.addEventListener('click', () => App.declineFriendRequest(b.getAttribute('data-decline')))
    );
  }

  return { render, renderFriendRequests };
})();

/* ============================================================
   16. LAYOUT RENDERERS — Mobile Bottom Nav
   ============================================================ */

const MobileNav = (() => {
  const ICONS = {
    home: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></svg>',
    friends: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>',
    create: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg>',
    messages: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    profile: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  };

  function render(container) {
    if (!container) return;
    const unreadNotifs = DB.getNotifications().filter((n) => !n.read).length;
    container.innerHTML = `
      <a href="index.html" class="active" aria-label="Home">${ICONS.home}<span>Home</span></a>
      <button data-nav="friends" aria-label="Friends">${ICONS.friends}<span>Friends</span></button>
      <button data-nav="create" aria-label="Create post">${ICONS.create}<span>Create</span></button>
      <button data-nav="messages" aria-label="Messages">
        ${ICONS.messages}<span>Chats</span>
        ${unreadNotifs ? `<span class="nav-badge">${unreadNotifs}</span>` : ''}
      </button>
      <a href="profile.html" aria-label="Profile">${ICONS.profile}<span>Profile</span></a>
    `;

    container.querySelectorAll('[data-nav]').forEach((b) =>
      b.addEventListener('click', () => App.handleSidebarNav(b.getAttribute('data-nav')))
    );
  }

  return { render };
})();

/* ============================================================
   17. GLOBAL SEARCH
   ============================================================ */

const Search = (() => {
  function bind(input, resultsBox) {
    if (!input || !resultsBox) return;
    let debounceTimer;

    input.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => runQuery(input.value.trim(), resultsBox), 180);
    });

    input.addEventListener('focus', () => {
      if (input.value.trim()) runQuery(input.value.trim(), resultsBox);
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.nav-search')) resultsBox.classList.add('hidden');
    });
  }

  function runQuery(q, box) {
    if (!q) { box.classList.add('hidden'); box.innerHTML = ''; return; }

    const users = DB.getUsers().filter((u) =>
      u.fullName.toLowerCase().includes(q.toLowerCase()) ||
      u.username.toLowerCase().includes(q.toLowerCase())
    ).slice(0, 5);

    const posts = DB.getPosts().filter((p) =>
      (p.text || '').toLowerCase().includes(q.toLowerCase())
    ).slice(0, 4);

    const groups = [
      { id: 'g1', name: 'Web Developers', members: '12.4k members' },
      { id: 'g2', name: 'Design Critique', members: '8.1k members' },
      { id: 'g3', name: 'Photography Club', members: '5.7k members' },
    ].filter((g) => g.name.toLowerCase().includes(q.toLowerCase()));

    if (!users.length && !posts.length && !groups.length) {
      box.innerHTML = `<div class="empty-state" style="padding:24px 10px;">
        <div class="es-icon" style="width:48px; height:48px; margin-bottom:12px;">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        </div>
        <p style="margin:0; font-size:14px;">No results found for "<b>${escapeHtml(q)}</b>"</p>
      </div>`;
      box.classList.remove('hidden');
      return;
    }

    let html = '';
    if (users.length) {
      html += `<div class="sidebar-title" style="padding:8px 8px 4px;">People</div>`;
      html += users.map((u) => `
        <div class="search-result-item" data-user="${u.id}">
          ${avatarHTML(u, 'avatar-sm')}
          <div class="meta">
            <div class="name">${escapeHtml(u.fullName)}</div>
            <div class="sub">@${escapeHtml(u.username)}</div>
          </div>
        </div>
      `).join('');
    }
    if (posts.length) {
      html += `<div class="sidebar-title" style="padding:12px 8px 4px;">Posts</div>`;
      html += posts.map((p) => {
        const author = DB.getUserById(p.authorId);
        return `
          <div class="search-result-item" data-post="${p.id}">
            <div style="width:36px; height:36px; border-radius:10px; background:var(--bg-input); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
            </div>
            <div class="meta">
              <div class="name" style="font-size:14px;">${escapeHtml((p.text || '').slice(0, 60))}${(p.text || '').length > 60 ? '…' : ''}</div>
              <div class="sub">${author ? escapeHtml(author.fullName) : 'Unknown'} · ${Time.relative(p.createdAt)}</div>
            </div>
          </div>
        `;
      }).join('');
    }
    if (groups.length) {
      html += `<div class="sidebar-title" style="padding:12px 8px 4px;">Groups</div>`;
      html += groups.map((g) => `
        <div class="search-result-item" data-group="${g.id}">
          <div style="width:36px; height:36px; border-radius:50%; background:var(--brand-primary-light); display:flex; align-items:center; justify-content:center; flex-shrink:0; color:var(--brand-primary); font-weight:700;">G</div>
          <div class="meta">
            <div class="name">${escapeHtml(g.name)}</div>
            <div class="sub">${escapeHtml(g.members)}</div>
          </div>
        </div>
      `).join('');
    }

    box.innerHTML = html;
    box.classList.remove('hidden');

    box.querySelectorAll('[data-user]').forEach((r) =>
      r.addEventListener('click', () => {
        window.location.href = `profile.html?u=${r.getAttribute('data-user')}`;
      })
    );
    box.querySelectorAll('[data-post]').forEach((r) =>
      r.addEventListener('click', () => {
        box.classList.add('hidden');
        Toast.info('Opening post…');
        // Scroll to the post if present on the page
        const pid = r.getAttribute('data-post');
        const postEl = document.querySelector(`[data-post-id="${pid}"]`);
        if (postEl) postEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      })
    );
    box.querySelectorAll('[data-group]').forEach((r) =>
      r.addEventListener('click', () => Toast.info('Groups are coming soon.'))
    );
  }

  return { bind, runQuery };
})();

/* ============================================================
   18. MESSENGER (demo UI)
   ============================================================ */

function openMessenger(openWithUserId = null) {
  const user = DB.getCurrentUser();
  if (!user) return;
  const convos = DB.getConversations().filter((c) => c.participants.includes(user.id));

  const listHTML = convos.map((c) => {
    const otherId = c.participants.find((id) => id !== user.id);
    const other = DB.getUserById(otherId);
    if (!other) return '';
    const msgs = DB.getMessagesForConv(c.id);
    const last = msgs[msgs.length - 1];
    return `
      <div class="conversation" data-conv="${c.id}">
        ${avatarWithStatus(other, 'avatar-md', true)}
        <div class="conv-meta">
          <div class="conv-name">${escapeHtml(other.fullName)}</div>
          <div class="conv-preview">${last ? escapeHtml(last.text) : 'Start a conversation'}</div>
        </div>
        <div class="conv-time">${last ? Time.relative(last.createdAt) : ''}</div>
      </div>
    `;
  }).join('');

  const modal = Modal.open(`
    <div class="modal-header">
      <div class="modal-title">Messages</div>
      <button class="modal-close" aria-label="Close">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
      </button>
    </div>
    <div class="modal-body" style="padding:0; display:grid; grid-template-columns: 280px 1fr; height: 520px; max-height:80vh;">
      <div style="border-right:1px solid var(--border-color); overflow-y:auto;">
        <div class="messenger-list-header" style="padding:12px; border-bottom:1px solid var(--border-color);">
          <input class="input" placeholder="Search conversations" id="convSearch" style="font-size:13px;" />
        </div>
        <div id="convList">${listHTML || '<div class="empty-state" style="padding:24px 10px;"><p style="margin:0; font-size:13px;">No conversations yet.</p></div>'}</div>
      </div>
      <div id="chatPane" style="display:flex; flex-direction:column;">
        <div class="empty-state" style="flex:1; justify-content:center;">
          <p style="margin:0;">Select a conversation to start chatting.</p>
        </div>
      </div>
    </div>
  `, { size: 'modal-lg' });

  // Responsive tweak for small screens
  if (window.innerWidth < 640) {
    const body = modal.querySelector('.modal-body');
    body.style.gridTemplateColumns = '1fr';
    body.style.height = '80vh';
  }

  const convList = modal.querySelector('#convList');
  const chatPane = modal.querySelector('#chatPane');

  modal.querySelector('#convSearch').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    convList.querySelectorAll('.conversation').forEach((el) => {
      const name = el.querySelector('.conv-name').textContent.toLowerCase();
      el.style.display = name.includes(q) ? '' : 'none';
    });
  });

  convList.querySelectorAll('.conversation').forEach((el) =>
    el.addEventListener('click', () => openChat(el.getAttribute('data-conv')))
  );

  function openChat(convId) {
    convList.querySelectorAll('.conversation').forEach((c) =>
      c.classList.toggle('active', c.getAttribute('data-conv') === convId)
    );

    const conv = DB.getConversations().find((c) => c.id === convId);
    const otherId = conv.participants.find((id) => id !== user.id);
    const other = DB.getUserById(otherId);
    if (!other) return;

    const msgs = DB.getMessagesForConv(convId);
    chatPane.innerHTML = `
      <div class="chat-header">
        ${avatarWithStatus(other, 'avatar-md', true)}
        <div>
          <div class="name">${escapeHtml(other.fullName)}</div>
          <div class="status">Online</div>
        </div>
      </div>
      <div class="chat-body" id="chatBody">
        ${msgs.map((m) => messageHTML(m, user)).join('')}
        <div id="typingRow"></div>
      </div>
      <form class="chat-input-row" id="chatForm">
        <input class="chat-input" id="chatInput" placeholder="Type a message…" autocomplete="off" />
        <button type="submit" class="btn btn-primary" aria-label="Send">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
        </button>
      </form>
    `;
    const body = chatPane.querySelector('#chatBody');
    body.scrollTop = body.scrollHeight;

    chatPane.querySelector('#chatForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const input = chatPane.querySelector('#chatInput');
      const text = input.value.trim();
      if (!text) return;
      const msg = {
        id: uid('m'), conversationId: convId,
        senderId: user.id, text, createdAt: Date.now(),
      };
      DB.saveMessage(msg);
      // Update conversation timestamp
      const convos = DB.getConversations();
      const idx = convos.findIndex((c) => c.id === convId);
      if (idx >= 0) { convos[idx].updatedAt = Date.now(); DB.setConversations(convos); }
      // Append message
      const div = document.createElement('div');
      div.innerHTML = messageHTML(msg, user);
      body.insertBefore(div.firstElementChild, chatPane.querySelector('#typingRow'));
      input.value = '';
      body.scrollTop = body.scrollHeight;
    });
  }

  function messageHTML(m, currentUser) {
    const mine = m.senderId === currentUser.id;
    return `
      <div class="message-row ${mine ? 'me' : ''}">
        <div class="message-bubble">${escapeHtml(m.text)}</div>
        <div class="message-time">${Time.relative(m.createdAt)}</div>
      </div>
    `;
  }

  // Auto-open a conversation if requested
  if (openWithUserId) {
    let convo = DB.getConversations().find(
      (c) => c.participants.includes(user.id) && c.participants.includes(openWithUserId)
    );
    if (!convo) {
      convo = { id: uid('conv'), participants: [user.id, openWithUserId], updatedAt: Date.now() };
      DB.setConversations([...DB.getConversations(), convo]);
    }
    openChat(convo.id);
  }
}

/* ============================================================
   19. APP ORCHESTRATOR
   ============================================================ */

const App = {
  /* ---- Boot home page ---- */
  bootHomePage() {
    if (!AuthGuard.requireLogin()) return;
    Theme.init();
    TopNav.render();
    LeftSidebar.render(document.getElementById('leftSidebar'));
    RightSidebar.render(document.getElementById('rightSidebar'));
    MobileNav.render(document.getElementById('mobileNav'));

    const user = DB.getCurrentUser();
    const composerAvatar = document.getElementById('composerAvatar');
    if (composerAvatar) {
      const tmp = document.createElement('div');
      tmp.innerHTML = avatarHTML(user, 'avatar');
      composerAvatar.replaceWith(tmp.firstElementChild);
    }

    Stories.render(document.getElementById('storiesSection'));
    Posts.render(document.getElementById('postsFeed'), { mode: 'home' });
    Posts.bindComposer();
    Notifications.init();
  },

  /* ---- Boot profile page ---- */
  bootProfilePage() {
    if (!AuthGuard.requireLogin()) return;
    Theme.init();
    TopNav.render();
    MobileNav.render(document.getElementById('mobileNav'));
    Profile.render(document.getElementById('profileMain'));
    Notifications.init();
  },

  /* ---- Boot settings page ---- */
  bootSettingsPage() {
    if (!AuthGuard.requireLogin()) return;
    Theme.init();
    TopNav.render();
    MobileNav.render(document.getElementById('mobileNav'));
    Settings.render();
    Notifications.init();
  },

  /* ---- Sidebar navigation dispatcher ---- */
  handleSidebarNav(nav) {
    switch (nav) {
      case 'home':
        window.location.href = 'index.html';
        break;
      case 'profile':
        window.location.href = 'profile.html';
        break;
      case 'settings':
        window.location.href = 'settings.html';
        break;
      case 'messages':
        openMessenger();
        break;
      case 'friends':
        Toast.info('Friends page is coming soon.');
        break;
      case 'groups':
        Toast.info('Groups are coming soon.');
        break;
      case 'watch':
        Toast.info('Watch is coming soon.');
        break;
      case 'market':
        Toast.info('Marketplace is coming soon.');
        break;
      case 'memories':
        Toast.info('Memories are coming soon.');
        break;
      case 'events':
        Toast.info('Events are coming soon.');
        break;
      case 'saved':
        Posts.render(document.getElementById('postsFeed') || document.getElementById('profileMain'), { mode: 'saved' });
        break;
      case 'requests':
        Toast.info('Showing friend requests in the sidebar.');
        break;
      case 'create':
        Posts.openComposer();
        break;
      default:
        Toast.info('This section is not available in the demo.');
    }
  },

  /* ---- Friend request actions ---- */
  acceptFriendRequest(reqId) {
    const user = DB.getCurrentUser();
    const reqs = DB.getFriendRequests();
    const req = reqs.find((r) => r.id === reqId);
    if (!req) return;
    req.status = 'accepted';
    DB.setFriendRequests(reqs);
    DB.addFriendship(req.from, req.to);
    DB.addNotification({
      type: 'friend_accept', actorId: req.to,
      createdAt: Date.now(), read: false,
    });
    Toast.success('Friend request accepted.');
    RightSidebar.render(document.getElementById('rightSidebar'));
    LeftSidebar.render(document.getElementById('leftSidebar'));
  },

  declineFriendRequest(reqId) {
    const reqs = DB.getFriendRequests();
    const req = reqs.find((r) => r.id === reqId);
    if (!req) return;
    req.status = 'declined';
    DB.setFriendRequests(reqs);
    Toast.info('Friend request declined.');
    RightSidebar.render(document.getElementById('rightSidebar'));
  },
};

/* ============================================================
   20. STORIES MODULE
   ============================================================ */

const Stories = (() => {
  const DAY_MS = 1000 * 60 * 60 * 24;

  function render(container) {
    if (!container) return;
    const user = DB.getCurrentUser();
    if (!user) return;

    const stories = DB.getStories().filter((s) => Date.now() - s.createdAt < DAY_MS);
    const grouped = {};
    stories.forEach((s) => {
      if (!grouped[s.authorId]) grouped[s.authorId] = [];
      grouped[s.authorId].push(s);
    });

    const cards = Object.entries(grouped).map(([authorId, items]) => {
      const author = DB.getUserById(authorId);
      if (!author) return '';
      const latest = items[items.length - 1];
      return `
        <div class="story-card" data-story-author="${authorId}">
          <img src="${latest.image}" alt="Story by ${escapeHtml(author.fullName)}" />
          <div class="story-avatar-ring">${avatarHTML(author, 'avatar-sm')}</div>
          <div class="story-name">${escapeHtml(author.fullName)}</div>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div class="card">
        <div class="stories-scroll">
          <div class="story-card story-create" id="addStoryBtn">
            <div class="story-cover" id="storyCreatePreview">
              <div style="width:100%; height:100%; background:var(--brand-gradient);"></div>
            </div>
            <div class="story-footer">
              <div class="plus-btn">+</div>
              <div class="label">Create story</div>
            </div>
          </div>
          ${cards}
        </div>
      </div>
    `;

    container.querySelector('#addStoryBtn').addEventListener('click', openCreateStory);
    container.querySelectorAll('[data-story-author]').forEach((card) =>
      card.addEventListener('click', () => openStoryViewer(card.getAttribute('data-story-author')))
    );
  }

  function openCreateStory() {
    let selectedImage = null;

    const modal = Modal.open(`
      <div class="modal-header">
        <div class="modal-title">Create Story</div>
        <button class="modal-close" aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="modal-body">
        <div id="storyPreviewArea" class="image-preview-box" style="min-height:280px; margin-bottom:16px;">
          <div class="empty-state" style="padding:40px 20px;">
            <div class="es-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
            </div>
            <p style="margin:0;">Choose a photo for your story</p>
          </div>
        </div>
        <input type="file" accept="image/jpeg,image/png,image/webp" id="storyFile" class="hidden" />
        <button class="btn btn-secondary btn-block" id="storyChooseBtn">Choose Photo</button>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" data-modal-close>Cancel</button>
        <button class="btn btn-primary" id="storyShareBtn" disabled>Share Story</button>
      </div>
    `, { size: 'modal-sm', label: 'Create story' });

    const fileInput = modal.querySelector('#storyFile');
    const previewArea = modal.querySelector('#storyPreviewArea');
    const shareBtn = modal.querySelector('#storyShareBtn');

    modal.querySelector('#storyChooseBtn').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      const err = ImageUpload.validate(file);
      if (err) { Toast.error(err); fileInput.value = ''; return; }
      try {
        selectedImage = await ImageUpload.read(file);
        previewArea.innerHTML = `<img src="${selectedImage}" alt="Story preview" />`;
        shareBtn.disabled = false;
      } catch (ex) {
        Toast.error('Failed to read image.');
      }
    });

    shareBtn.addEventListener('click', () => {
      if (!selectedImage) return;
      const user = DB.getCurrentUser();
      DB.addStory({
        id: uid('story'),
        authorId: user.id,
        image: selectedImage,
        createdAt: Date.now(),
        viewers: [],
      });
      Modal.close();
      Toast.success('Story published for 24 hours.');
      Stories.render(document.getElementById('storiesSection'));
    });
  }

  function openStoryViewer(authorId) {
    const stories = DB.getStories().filter((s) => s.authorId === authorId)
      .sort((a, b) => a.createdAt - b.createdAt);
    if (!stories.length) return;

    let index = 0;
    const author = DB.getUserById(authorId);

    const viewer = el('div', { class: 'story-viewer' });
    viewer.innerHTML = `
      <div class="story-viewer-inner">
        <div class="story-progress-track" id="storyProgress"></div>
        <div class="story-viewer-header">
          <span class="avatar-wrap">${avatarHTML(author, 'avatar-sm')}</span>
          <div>
            <div class="name">${escapeHtml(author.fullName)}</div>
            <div class="time" id="storyTime"></div>
          </div>
        </div>
        <img id="storyImage" src="" alt="Story" />
        <button class="story-viewer-nav prev" id="storyPrev" aria-label="Previous story">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <button class="story-viewer-nav next" id="storyNext" aria-label="Next story">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
        </button>
        <button class="modal-close" id="storyClose" style="position:absolute; top:12px; right:12px; color:#fff; background:rgba(255,255,255,0.15);" aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
    `;
    document.body.appendChild(viewer);
    document.body.style.overflow = 'hidden';

    const imgEl = viewer.querySelector('#storyImage');
    const timeEl = viewer.querySelector('#storyTime');
    const progressEl = viewer.querySelector('#storyProgress');

    // Build progress segments
    progressEl.innerHTML = stories.map(() => `<div class="story-progress-seg"><div class="fill"></div></div>`).join('');

    let timer = null;
    let animStart = 0;
    const DURATION = 5000;

    function show(i) {
      index = i;
      const story = stories[i];
      imgEl.src = story.image;
      timeEl.textContent = Time.relative(story.createdAt);

      // Mark as viewed
      const currentUser = DB.getCurrentUser();
      if (currentUser && !story.viewers.includes(currentUser.id)) {
        story.viewers.push(currentUser.id);
        const all = DB.getStories();
        const idx = all.findIndex((s) => s.id === story.id);
        if (idx >= 0) { all[idx] = story; DB.setStories(all); }
      }

      // Update progress bars
      const segs = progressEl.querySelectorAll('.story-progress-seg .fill');
      segs.forEach((fill, idx) => {
        if (idx < i) fill.style.width = '100%';
        else if (idx > i) fill.style.width = '0%';
        else fill.style.width = '0%';
      });

      // Animate current progress
      const currentFill = segs[i];
      animStart = performance.now();
      cancelAnimationFrame(timer);
      function step(now) {
        const pct = Math.min(100, ((now - animStart) / DURATION) * 100);
        currentFill.style.width = pct + '%';
        if (pct < 100) timer = requestAnimationFrame(step);
        else next();
      }
      timer = requestAnimationFrame(step);
    }

    function next() {
      if (index < stories.length - 1) show(index + 1);
      else closeViewer();
    }
    function prev() {
      if (index > 0) show(index - 1);
      else show(0);
    }
    function closeViewer() {
      cancelAnimationFrame(timer);
      viewer.remove();
      document.body.style.overflow = '';
    }

    viewer.querySelector('#storyPrev').addEventListener('click', (e) => { e.stopPropagation(); prev(); });
    viewer.querySelector('#storyNext').addEventListener('click', (e) => { e.stopPropagation(); next(); });
    viewer.querySelector('#storyClose').addEventListener('click', closeViewer);
    viewer.addEventListener('click', (e) => {
      if (e.target === viewer) closeViewer();
    });
    document.addEventListener('keydown', function onKey(e) {
      if (e.key === 'Escape') { closeViewer(); document.removeEventListener('keydown', onKey); }
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    });

    show(0);
  }

  return { render, openCreateStory, openStoryViewer };
})();

/* ============================================================
   21. EXPORTS (global namespace)
   ============================================================ */

window.FriendiabdApp = {
  Storage, DB, Toast, Modal, Time, Theme, AuthGuard,
  avatarHTML, avatarWithStatus, escapeHtml, uid, el, $, $$,
  ImageUpload, DemoData, TopNav, LeftSidebar, RightSidebar, MobileNav,
  Search, Stories, openMessenger, App,
};
