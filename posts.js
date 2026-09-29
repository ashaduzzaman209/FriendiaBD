/* ============================================================
   FRIENDIABD SOCIAL — posts.js
   Post rendering, composer, likes, comments, share, save,
   three-dot menu, story-level filtering.
   ============================================================ */

'use strict';

const Posts = (() => {
  const { DB, Toast, Modal, Time, avatarHTML, escapeHtml, uid, ImageUpload } = window.FriendiabdApp;

  /* ---------- Feed rendering ---------- */

  function getFeedPosts({ mode = 'home', userId = null } = {}) {
    const currentUser = DB.getCurrentUser();
    if (!currentUser) return [];

    const all = DB.getPosts();
    const friendIds = DB.getFriends()[currentUser.id] || [];

    let list;
    if (mode === 'profile' && userId) {
      list = all.filter((p) => p.authorId === userId);
      // Only show public posts (or own posts) on others' profiles
      if (userId !== currentUser.id) {
        list = list.filter((p) => p.privacy === 'public' || friendIds.includes(userId));
      }
    } else if (mode === 'saved') {
      const saved = DB.getSaved().filter((s) => s.userId === currentUser.id).map((s) => s.postId);
      list = all.filter((p) => saved.includes(p.id));
    } else {
      // Home feed: public posts + friends' posts + own posts
      list = all.filter((p) => {
        if (p.authorId === currentUser.id) return true;
        if (p.privacy === 'public') return true;
        if (p.privacy === 'friends' && friendIds.includes(p.authorId)) return true;
        return false;
      });
    }

    return list.sort((a, b) => b.createdAt - a.createdAt);
  }

  function render(container, options = {}) {
    if (!container) return;
    const currentUser = DB.getCurrentUser();
    if (!currentUser) return;

    const posts = getFeedPosts(options);

    if (posts.length === 0) {
      container.innerHTML = `
        <div class="card">
          <div class="empty-state">
            <div class="es-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h6M9 17h6"/></svg>
            </div>
            <h3>${options.mode === 'saved' ? 'No saved posts yet' : 'No posts to show'}</h3>
            <p>${options.mode === 'saved'
              ? 'Posts you save will appear here for later.'
              : 'When you or your friends share something, it will appear here.'}</p>
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = posts.map((p) => postHTML(p, currentUser)).join('');
    posts.forEach((p) => bindPostEvents(p.id, options));
  }

  /* ---------- Single post markup ---------- */

  function postHTML(post, currentUser) {
    const author = DB.getUserById(post.authorId);
    if (!author) return '';
    const likes = (DB.getLikes()[post.id] || []).length;
    const liked = DB.isLiked(post.id, currentUser.id);
    const saved = DB.isSaved(post.id, currentUser.id);
    const comments = DB.getCommentsForPost(post.id);
    const isOwner = post.authorId === currentUser.id;

    const privacyIcon = {
      public: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z"/></svg>',
      friends: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>',
      private: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
    }[post.privacy];

    return `
      <article class="card post" data-post-id="${post.id}">
        <header class="post-header">
          <a href="profile.html?u=${encodeURIComponent(author.id)}">${avatarHTML(author, 'avatar-md')}</a>
          <div class="post-meta">
            <a href="profile.html?u=${encodeURIComponent(author.id)}" class="post-author">${escapeHtml(author.fullName)}</a>
            <div class="post-sub">
              <span>@${escapeHtml(author.username)}</span>
              <span class="dot">•</span>
              <span>${Time.relative(post.createdAt)}</span>
              <span class="dot">•</span>
              <span aria-label="${post.privacy} post">${privacyIcon}</span>
            </div>
          </div>
          <div class="dropdown-wrap">
            <button class="nav-icon-btn" data-post-menu="${post.id}" aria-label="Post options" aria-haspopup="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/></svg>
            </button>
          </div>
        </header>

        <div class="post-body">
          ${post.text ? `<div class="post-text">${escapeHtml(post.text)}</div>` : ''}
          ${post.image ? `<div class="post-image"><img src="${post.image}" alt="Post image" data-preview="${post.id}" /></div>` : ''}
        </div>

        <div class="post-stats">
          <div class="reactions">
            ${likes > 0 ? `
              <span class="reaction-pill">👍</span>
              <span>${likes}</span>
            ` : '<span></span>'}
          </div>
          <div>
            ${comments.length ? `<button data-toggle-comments="${post.id}" style="font-size:13px; color:var(--text-muted); font-weight:600;">${comments.length} comment${comments.length === 1 ? '' : 's'}</button>` : ''}
          </div>
        </div>

        <div class="post-actions">
          <button class="post-action ${liked ? 'liked' : ''}" data-like="${post.id}" aria-pressed="${liked}">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="${liked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z"/></svg>
            Like
          </button>
          <button class="post-action" data-comment="${post.id}">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            Comment
          </button>
          <button class="post-action" data-share="${post.id}">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="m16 6-4-4-4 4"/><path d="M12 2v13"/></svg>
            Share
          </button>
          <button class="post-action ${saved ? 'saved' : ''}" data-save="${post.id}" aria-pressed="${saved}">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="${saved ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
            ${saved ? 'Saved' : 'Save'}
          </button>
        </div>

        <div class="comments-section hidden" data-comments-section="${post.id}">
          <div data-comments-list="${post.id}">
            ${comments.map((c) => commentHTML(c, currentUser)).join('')}
          </div>
          <form class="comment-input-row" data-comment-form="${post.id}">
            ${avatarHTML(currentUser, 'avatar-xs')}
            <input class="comment-input" placeholder="Write a comment…" autocomplete="off" aria-label="Write a comment" />
          </form>
        </div>
      </article>
    `;
  }

  /* ---------- Comment markup ---------- */

  function commentHTML(comment, currentUser, depth = 0) {
    const author = DB.getUserById(comment.authorId);
    if (!author) return '';
    const isOwner = comment.authorId === currentUser.id;
    const liked = DB.isCommentLiked(comment.id, currentUser.id);
    const likes = (DB.getCommentLikes()[comment.id] || []).length;
    const replies = DB.getComments().filter((c) => c.parentId === comment.id);

    return `
      <div class="comment" data-comment-id="${comment.id}">
        ${avatarHTML(author, 'avatar-xs')}
        <div class="comment-main">
          <div class="comment-bubble">
            <a href="profile.html?u=${encodeURIComponent(author.id)}" class="comment-author">${escapeHtml(author.fullName)}</a>
            <div class="comment-text">${escapeHtml(comment.text)}</div>
          </div>
          <div class="comment-meta">
            <button data-comment-like="${comment.id}" class="${liked ? 'liked' : ''}">${liked ? 'Liked' : 'Like'}${likes ? ` · ${likes}` : ''}</button>
            <button data-comment-reply="${comment.id}">Reply</button>
            ${isOwner ? `<button data-comment-delete="${comment.id}">Delete</button>` : ''}
            <span>${Time.relative(comment.createdAt)}</span>
          </div>
          ${replies.length ? `<div class="replies-container">${replies.map((r) => commentHTML(r, currentUser, depth + 1)).join('')}</div>` : ''}
          <form class="comment-input-row hidden" data-reply-form="${comment.id}" style="margin-top:8px;">
            ${avatarHTML(currentUser, 'avatar-xs')}
            <input class="comment-input" placeholder="Write a reply…" autocomplete="off" />
          </form>
        </div>
      </div>
    `;
  }

  /* ---------- Event binding ---------- */

  function bindPostEvents(postId, options) {
    const postEl = document.querySelector(`[data-post-id="${postId}"]`);
    if (!postEl) return;

    // Like
    const likeBtn = postEl.querySelector(`[data-like="${postId}"]`);
    if (likeBtn) {
      likeBtn.addEventListener('click', () => {
        const user = DB.getCurrentUser();
        const nowLiked = DB.toggleLike(postId, user.id);
        const count = (DB.getLikes()[postId] || []).length;
        likeBtn.classList.toggle('liked', nowLiked);
        likeBtn.setAttribute('aria-pressed', nowLiked);
        likeBtn.classList.add('like-anim');
        setTimeout(() => likeBtn.classList.remove('like-anim'), 350);
        likeBtn.querySelector('svg').setAttribute('fill', nowLiked ? 'currentColor' : 'none');
        const stats = postEl.querySelector('.reactions');
        stats.innerHTML = count > 0 ? `<span class="reaction-pill">👍</span><span>${count}</span>` : '<span></span>';

        // Notify post author
        const post = DB.getPostById(postId);
        if (post && post.authorId !== user.id && nowLiked) {
          DB.addNotification({
            type: 'like', actorId: user.id, postId, createdAt: Date.now(), read: false,
          });
          Notifications.refreshBadge();
        }
      });
    }

    // Save
    const saveBtn = postEl.querySelector(`[data-save="${postId}"]`);
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        const user = DB.getCurrentUser();
        const saved = DB.toggleSave(postId, user.id);
        saveBtn.classList.toggle('saved', saved);
        saveBtn.setAttribute('aria-pressed', saved);
        saveBtn.querySelector('svg').setAttribute('fill', saved ? 'currentColor' : 'none');
        saveBtn.lastChild.textContent = saved ? ' Saved' : ' Save';
        Toast.success(saved ? 'Post saved.' : 'Post removed from saved.');
        if (options.mode === 'saved') {
          render(document.getElementById('postsFeed'), options);
        }
      });
    }

    // Comment toggle
    const commentBtn = postEl.querySelector(`[data-comment="${postId}"]`);
    const commentsSection = postEl.querySelector(`[data-comments-section="${postId}"]`);
    const toggleComments = () => commentsSection.classList.toggle('hidden');
    commentBtn?.addEventListener('click', () => {
      toggleComments();
      if (!commentsSection.classList.contains('hidden')) {
        commentsSection.querySelector('input')?.focus();
      }
    });
    postEl.querySelector(`[data-toggle-comments="${postId}"]`)?.addEventListener('click', toggleComments);

    // Comment submit
    const commentForm = postEl.querySelector(`[data-comment-form="${postId}"]`);
    commentForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = commentForm.querySelector('input');
      const text = input.value.trim();
      if (!text) return;
      addComment(postId, text);
      input.value = '';
    });

    // Share
    postEl.querySelector(`[data-share="${postId}"]`)?.addEventListener('click', () => openShareModal(postId));

    // Image preview
    postEl.querySelector(`[data-preview="${postId}"]`)?.addEventListener('click', () => {
      const post = DB.getPostById(postId);
      if (post?.image) Modal.previewImage(post.image, 'Post image');
    });

    // Three-dot menu
    postEl.querySelector(`[data-post-menu="${postId}"]`)?.addEventListener('click', (e) => {
      e.stopPropagation();
      openPostMenu(postId, e.currentTarget);
    });

    // Comment interactions (like, reply, delete)
    postEl.querySelectorAll('[data-comment-like]').forEach((btn) =>
      btn.addEventListener('click', () => {
        const user = DB.getCurrentUser();
        const cid = btn.getAttribute('data-comment-like');
        const liked = DB.toggleCommentLike(cid, user.id);
        const count = (DB.getCommentLikes()[cid] || []).length;
        btn.classList.toggle('liked', liked);
        btn.textContent = `${liked ? 'Liked' : 'Like'}${count ? ` · ${count}` : ''}`;
      })
    );

    postEl.querySelectorAll('[data-comment-reply]').forEach((btn) =>
      btn.addEventListener('click', () => {
        const cid = btn.getAttribute('data-comment-reply');
        const form = postEl.querySelector(`[data-reply-form="${cid}"]`);
        form?.classList.toggle('hidden');
        form?.querySelector('input')?.focus();
      })
    );

    postEl.querySelectorAll('[data-reply-form]').forEach((form) =>
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = form.querySelector('input');
        const text = input.value.trim();
        if (!text) return;
        const parentId = form.getAttribute('data-reply-form');
        addComment(postId, text, parentId);
        input.value = '';
        form.classList.add('hidden');
      })
    );

    postEl.querySelectorAll('[data-comment-delete]').forEach((btn) =>
      btn.addEventListener('click', async () => {
        const cid = btn.getAttribute('data-comment-delete');
        const ok = await Modal.confirm({
          title: 'Delete comment?',
          message: 'This action cannot be undone.',
          confirmText: 'Delete', danger: true,
        });
        if (ok) {
          DB.deleteComment(cid);
          Toast.success('Comment deleted.');
          refreshComments(postId);
        }
      })
    );
  }

  /* ---------- Add comment ---------- */

  function addComment(postId, text, parentId = null) {
    const user = DB.getCurrentUser();
    const comment = {
      id: uid('c'), postId, authorId: user.id,
      text, createdAt: Date.now(), parentId,
    };
    DB.saveComment(comment);

    // Notify post author (if not self)
    const post = DB.getPostById(postId);
    if (post && post.authorId !== user.id) {
      DB.addNotification({
        type: 'comment', actorId: user.id, postId, text,
        createdAt: Date.now(), read: false,
      });
      Notifications.refreshBadge();
    }

    Toast.success('Comment added.');
    refreshComments(postId);
  }

  function refreshComments(postId) {
    const postEl = document.querySelector(`[data-post-id="${postId}"]`);
    if (!postEl) return;
    const currentUser = DB.getCurrentUser();
    const comments = DB.getCommentsForPost(postId);
    const list = postEl.querySelector(`[data-comments-list="${postId}"]`);
    if (list) list.innerHTML = comments.map((c) => commentHTML(c, currentUser)).join('');
    // Re-bind comment events
    bindPostEvents(postId, {});
  }

  /* ---------- Post menu ---------- */

  function openPostMenu(postId, anchorEl) {
    const post = DB.getPostById(postId);
    if (!post) return;
    const user = DB.getCurrentUser();
    const isOwner = post.authorId === user.id;
    const saved = DB.isSaved(postId, user.id);

    // Remove any existing menu
    document.querySelectorAll('.post-menu-floating').forEach((m) => m.remove());

    const menu = document.createElement('div');
    menu.className = 'dropdown post-menu-floating';
    menu.style.position = 'fixed';
    menu.style.zIndex = '300';

    menu.innerHTML = `
      <button class="dropdown-item" data-action="save">
        <span class="item-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg></span>
        <div class="item-title">${saved ? 'Unsave post' : 'Save post'}</div>
      </button>
      ${isOwner ? `
        <button class="dropdown-item" data-action="edit">
          <span class="item-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></span>
          <div class="item-title">Edit post</div>
        </button>
      ` : ''}
      <button class="dropdown-item" data-action="hide">
        <span class="item-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><path d="M2 2l20 20"/></svg></span>
        <div class="item-title">Hide post</div>
      </button>
      <button class="dropdown-item" data-action="copy">
        <span class="item-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></span>
        <div class="item-title">Copy link</div>
      </button>
      <button class="dropdown-item" data-action="mute">
        <span class="item-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg></span>
        <div class="item-title">Turn off notifications</div>
      </button>
      ${isOwner ? `
        <div class="dropdown-divider"></div>
        <button class="dropdown-item" data-action="delete" style="color:var(--error);">
          <span class="item-icon" style="color:var(--error);"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></span>
          <div class="item-title">Delete post</div>
        </button>
      ` : ''}
    `;

    document.body.appendChild(menu);
    const rect = anchorEl.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    let top = rect.bottom + 6;
    let left = rect.right - menuRect.width;
    if (left < 8) left = 8;
    if (top + menuRect.height > window.innerHeight - 8) {
      top = rect.top - menuRect.height - 6;
    }
    menu.style.top = `${top}px`;
    menu.style.left = `${left}px`;

    const close = () => menu.remove();
    const outsideHandler = (e) => {
      if (!menu.contains(e.target)) { close(); document.removeEventListener('click', outsideHandler); }
    };
    setTimeout(() => document.addEventListener('click', outsideHandler), 0);

    menu.querySelectorAll('[data-action]').forEach((btn) =>
      btn.addEventListener('click', async () => {
        const action = btn.getAttribute('data-action');
        close();
        if (action === 'save') {
          const saved = DB.toggleSave(postId, user.id);
          Toast.success(saved ? 'Post saved.' : 'Post removed from saved.');
          rerender();
        }
        if (action === 'edit') openEditPost(postId);
        if (action === 'hide') {
          Toast.info('Post hidden from your feed.');
          const postEl = document.querySelector(`[data-post-id="${postId}"]`);
          if (postEl) { postEl.style.transition = 'opacity .3s'; postEl.style.opacity = '0'; setTimeout(() => postEl.remove(), 300); }
        }
        if (action === 'copy') {
          copyPostLink(postId);
        }
        if (action === 'mute') {
          Toast.success('Notifications turned off for this post.');
        }
        if (action === 'delete') {
          const ok = await Modal.confirm({
            title: 'Delete this post?',
            message: 'This will permanently remove the post and all its comments. This cannot be undone.',
            confirmText: 'Delete', danger: true,
          });
          if (ok) {
            DB.deletePost(postId);
            Toast.success('Post deleted.');
            rerender();
          }
        }
      })
    );
  }

  /* ---------- Edit post ---------- */

  function openEditPost(postId) {
    const post = DB.getPostById(postId);
    if (!post) return;

    const modal = Modal.open(`
      <div class="modal-header">
        <div class="modal-title">Edit Post</div>
        <button class="modal-close" aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="modal-body">
        <div class="field">
          <label for="editPostText">Post text</label>
          <textarea id="editPostText" class="textarea" placeholder="What's on your mind?">${escapeHtml(post.text || '')}</textarea>
        </div>
        <div class="field">
          <label for="editPostPrivacy">Privacy</label>
          <select id="editPostPrivacy" class="select">
            <option value="public"${post.privacy === 'public' ? ' selected' : ''}>Public</option>
            <option value="friends"${post.privacy === 'friends' ? ' selected' : ''}>Friends</option>
            <option value="private"${post.privacy === 'private' ? ' selected' : ''}>Only Me</option>
          </select>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" data-modal-close>Cancel</button>
        <button class="btn btn-primary" id="saveEditBtn">Save Changes</button>
      </div>
    `);

    modal.querySelector('#saveEditBtn').addEventListener('click', () => {
      post.text = modal.querySelector('#editPostText').value.trim();
      post.privacy = modal.querySelector('#editPostPrivacy').value;
      DB.savePost(post);
      Modal.close();
      Toast.success('Post updated.');
      rerender();
    });
  }

  /* ---------- Share modal ---------- */

  function openShareModal(postId) {
    const modal = Modal.open(`
      <div class="modal-header">
        <div class="modal-title">Share Post</div>
        <button class="modal-close" aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="modal-body" style="padding: 12px;">
        <button class="dropdown-item" data-share-action="feed">
          <span class="item-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9h18l-2 11H5L3 9Z"/><path d="M3 9 5 3h14l2 6"/></svg></span>
          <div class="item-title">Share to Feed</div>
        </button>
        <button class="dropdown-item" data-share-action="profile">
          <span class="item-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></span>
          <div class="item-title">Share to Profile</div>
        </button>
        <button class="dropdown-item" data-share-action="copy">
          <span class="item-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></span>
          <div class="item-title">Copy Link</div>
        </button>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary btn-block" data-modal-close>Cancel</button>
      </div>
    `, { size: 'modal-sm' });

    modal.querySelectorAll('[data-share-action]').forEach((btn) =>
      btn.addEventListener('click', async () => {
        const action = btn.getAttribute('data-share-action');
        if (action === 'copy') {
          await copyPostLink(postId);
        } else if (action === 'feed') {
          const user = DB.getCurrentUser();
          const original = DB.getPostById(postId);
          const shared = {
            id: uid('post'), authorId: user.id,
            text: `Shared a post from ${DB.getUserById(original.authorId)?.fullName || 'someone'}.`,
            image: original.image, privacy: 'public', createdAt: Date.now(),
          };
          DB.savePost(shared);
          Toast.success('Post shared to your feed.');
          Modal.close();
          rerender();
        } else if (action === 'profile') {
          Toast.success('Post shared to your profile.');
          Modal.close();
        }
      })
    );
  }

  async function copyPostLink(postId) {
    const url = `${window.location.origin}${window.location.pathname}#post-${postId}`;
    try {
      await navigator.clipboard.writeText(url);
      Toast.success('Link copied to clipboard.');
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); Toast.success('Link copied to clipboard.'); }
      catch { Toast.error('Could not copy link.'); }
      ta.remove();
    }
  }

  /* ---------- Composer ---------- */

  function bindComposer() {
    document.getElementById('openComposerBtn')?.addEventListener('click', () => openComposer());
    document.querySelectorAll('[data-composer-type="photo"]').forEach((b) =>
      b.addEventListener('click', () => openComposer({ focusImage: true }))
    );
    document.querySelectorAll('[data-composer-type="video"]').forEach((b) =>
      b.addEventListener('click', () => Toast.info('Video uploads are coming soon.'))
    );
    document.querySelectorAll('[data-composer-type="event"]').forEach((b) =>
      b.addEventListener('click', () => Toast.info('Events are coming soon.'))
    );
  }

  function openComposer({ focusImage = false } = {}) {
    const user = DB.getCurrentUser();
    if (!user) return;

    let selectedImage = null;

    const modal = Modal.open(`
      <div class="modal-header">
        <div class="modal-title">Create Post</div>
        <button class="modal-close" aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="modal-body composer-modal-body">
        <div class="composer-user">
          ${avatarHTML(user, 'avatar-md')}
          <div>
            <div class="name">${escapeHtml(user.fullName)}</div>
            <button class="privacy-pill" id="privacyBtn">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z"/></svg>
              <span id="privacyLabel">Public</span>
            </button>
          </div>
        </div>

        <textarea class="composer-textarea" id="composerText" placeholder="What's on your mind, ${escapeHtml(user.fullName.split(' ')[0])}?" aria-label="Post text"></textarea>

        <div id="composerPreviewWrap"></div>

        <div class="composer-toolbar">
          <span class="label">Add to your post</span>
          <div class="tools">
            <button class="tool-btn" id="composerPhotoBtn" aria-label="Add photo" title="Add photo">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
            </button>
          </div>
        </div>
        <input type="file" accept="image/jpeg,image/png,image/webp" id="composerFile" class="hidden" />
      </div>
      <div class="modal-footer">
   <button class="btn btn-secondary" data-modal-close>Cancel</button>
        <button class="btn btn-primary" id="publishBtn" disabled>Post</button>
      </div>
    `, { size: 'modal-sm', label: 'Create post' });

    const textArea = modal.querySelector('#composerText');
    const publishBtn = modal.querySelector('#publishBtn');
    const fileInput = modal.querySelector('#composerFile');
    const previewWrap = modal.querySelector('#composerPreviewWrap');
    const privacyLabel = modal.querySelector('#privacyLabel');
    const privacyBtn = modal.querySelector('#privacyBtn');
    let privacy = 'public';

    function updatePublishState() {
      const hasText = textArea.value.trim().length > 0;
      publishBtn.disabled = !hasText && !selectedImage;
    }

    textArea.addEventListener('input', updatePublishState);
    textArea.focus();

    if (focusImage) fileInput.click();

    modal.querySelector('#composerPhotoBtn').addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      const err = ImageUpload.validate(file);
      if (err) { Toast.error(err); fileInput.value = ''; return; }
      try {
        selectedImage = await ImageUpload.read(file);
        previewWrap.innerHTML = `
          <div class="image-preview-box">
            <img src="${selectedImage}" alt="Selected image preview" />
            <button class="image-remove-btn" id="removeImageBtn" aria-label="Remove image">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>
        `;
        previewWrap.querySelector('#removeImageBtn').addEventListener('click', () => {
          selectedImage = null;
          previewWrap.innerHTML = '';
          fileInput.value = '';
          updatePublishState();
        });
        updatePublishState();
      } catch {
        Toast.error('Could not read that image.');
      }
    });

    // Privacy selector
    privacyBtn.addEventListener('click', () => {
      const modal2 = Modal.open(`
        <div class="modal-header">
          <div class="modal-title">Who can see your post?</div>
          <button class="modal-close" aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="modal-body" style="padding:8px;">
          <button class="dropdown-item" data-priv="public">
            <span class="item-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z"/></svg></span>
            <div><div class="item-title">Public</div><div class="item-sub">Anyone on Nexus</div></div>
          </button>
          <button class="dropdown-item" data-priv="friends">
            <span class="item-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg></span>
            <div><div class="item-title">Friends</div><div class="item-sub">Only your friends</div></div>
          </button>
          <button class="dropdown-item" data-priv="private">
            <span class="item-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></span>
            <div><div class="item-title">Only Me</div><div class="item-sub">Just you</div></div>
          </button>
        </div>
      `, { size: 'modal-sm' });

      modal2.querySelectorAll('[data-priv]').forEach((b) =>
        b.addEventListener('click', () => {
          privacy = b.getAttribute('data-priv');
          privacyLabel.textContent = { public: 'Public', friends: 'Friends', private: 'Only Me' }[privacy];
          Modal.close();
        })
      );
    });

    // Publish
    publishBtn.addEventListener('click', () => {
      const text = textArea.value.trim();
      if (!text && !selectedImage) {
        Toast.error('Add something to your post first.');
        return;
      }
      const post = {
        id: uid('post'),
        authorId: user.id,
        text,
        image: selectedImage,
        privacy,
        createdAt: Date.now(),
      };
      DB.savePost(post);
      Modal.close();
      Toast.success('Post published successfully.');
      rerender();
    });
  }

  /* ---------- Helpers ---------- */

  function rerender() {
    const feed = document.getElementById('postsFeed');
    if (feed) render(feed, { mode: 'home' });
    const profileFeed = document.getElementById('profilePostsFeed');
    if (profileFeed) {
      const profileUserId = profileFeed.getAttribute('data-user-id');
      render(profileFeed, { mode: 'profile', userId: profileUserId });
    }
  }

  return {
    render, bindComposer, openComposer, openShareModal, addComment,
    openPostMenu, getFeedPosts, openEditPost, rerender,
  };
})();

window.FriendiabdApp.Post  = Posts;
