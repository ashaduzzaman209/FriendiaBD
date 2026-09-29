/* ============================================================
   FRIENDIABD SOCIAL — profile.js
   Profile page rendering, editing, avatar/cover uploads,
   friend/follow actions.
   ============================================================ */

'use strict';

const Profile = (() => {
  const { DB, Toast, Modal, Time, avatarHTML, escapeHtml, uid, ImageUpload } = window.FriendiabdApp;

  let activeTab = 'posts';
  let viewingUserId = null;

  /* ---------- Entry point ---------- */

  function render(container) {
    if (!container) return;
    const currentUser = DB.getCurrentUser();
    if (!currentUser) return;

    // Determine whose profile we're viewing
    const params = new URLSearchParams(window.location.search);
    const uParam = params.get('u');
    viewingUserId = uParam || currentUser.id;

    const user = DB.getUserById(viewingUserId);
    if (!user) {
      container.innerHTML = `
        <div class="card">
          <div class="empty-state">
            <div class="es-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
            </div>
            <h3>User not found</h3>
            <p>The profile you're looking for doesn't exist.</p>
            <a href="index.html" class="btn btn-primary">Back to Home</a>
          </div>
        </div>
      `;
      return;
    }

    const isOwn = user.id === currentUser.id;
    const isFriend = DB.areFriends(currentUser.id, user.id);
    const isFollowing = DB.isFollowing(currentUser.id, user.id);
    const friendCount = (DB.getFriends()[user.id] || []).length;
    const followerCount = DB.getFollowers(user.id).length;
    const followingCount = DB.getFollowing(user.id).length;

    container.innerHTML = `
      <div class="card" style="overflow:hidden; padding:0;">
        <div class="profile-cover" id="profileCover">
          ${user.cover
            ? `<img src="${user.cover}" alt="Cover photo of ${escapeHtml(user.fullName)}" />`
            : ''}
          ${isOwn ? `
            <button class="btn btn-sm cover-edit-btn" id="coverEditBtn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
              ${user.cover ? 'Change cover' : 'Add cover photo'}
            </button>
          ` : ''}
        </div>

        <div class="profile-header-card">
          <div class="profile-top-row">
            <div class="profile-avatar-big" id="profileAvatarBig">
              ${avatarHTML(user, 'avatar-2xl')}
              ${isOwn ? `
                <div class="avatar-edit-overlay" id="avatarEditOverlay" title="Change profile picture">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                </div>
              ` : ''}
            </div>

            <div class="profile-info-main">
              <h1 class="profile-name">${escapeHtml(user.fullName)}</h1>
              <div class="profile-username">@${escapeHtml(user.username)}</div>
              ${user.bio ? `<p class="profile-bio">${escapeHtml(user.bio)}</p>` : ''}

              <div class="profile-meta-row">
                ${user.location ? `
                  <span class="item">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                    ${escapeHtml(user.location)}
                  </span>
                ` : ''}
                ${user.website ? `
                  <span class="item">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z"/></svg>
                    <a href="https://${escapeHtml(user.website)}" target="_blank" rel="noopener">${escapeHtml(user.website)}</a>
                  </span>
                ` : ''}
                <span class="item">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
                  Joined ${Time.dateOnly(user.joinedAt)}
                </span>
              </div>

              <div class="profile-stats">
                <div class="profile-stat" data-stat="friends">
                  <div class="num">${friendCount}</div>
                  <div class="label">Friends</div>
                </div>
                <div class="profile-stat" data-stat="followers">
                  <div class="num">${followerCount}</div>
                  <div class="label">Followers</div>
                </div>
                <div class="profile-stat" data-stat="following">
                  <div class="num">${followingCount}</div>
                  <div class="label">Following</div>
                </div>
              </div>

              <div class="profile-actions">
                ${isOwn ? `
                  <button class="btn btn-primary" id="editProfileBtn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                    Edit Profile
                  </button>
                  <button class="btn btn-secondary" id="shareProfileBtn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="m16 6-4-4-4 4"/><path d="M12 2v13"/></svg>
                    Share Profile
                  </button>
                ` : `
                  ${!isFriend ? `
                    <button class="btn btn-primary" id="addFriendBtn">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/></svg>
                      Add Friend
                    </button>
                  ` : `
                    <button class="btn btn-secondary" id="removeFriendBtn">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 11h-6"/></svg>
                      Friends
                    </button>
                  `}
                  <button class="btn btn-secondary" id="messageBtn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                    Message
                  </button>
                  <button class="btn ${isFollowing ? 'btn-secondary' : 'btn-outline'}" id="followBtn">
                    ${isFollowing ? 'Following' : 'Follow'}
                  </button>
                `}
              </div>
            </div>
          </div>

          <nav class="profile-tabs" role="tablist">
            ${['posts', 'about', 'friends', 'photos', 'saved'].map((t) => `
              <button class="profile-tab ${activeTab === t ? 'active' : ''}" data-tab="${t}" role="tab" aria-selected="${activeTab === t}">
                ${t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            `).join('')}
          </nav>
        </div>
      </div>

      <div id="profileTabContent" style="margin-top:20px;"></div>
    `;

    bindProfileEvents(user, isOwn, isFriend, isFollowing);
    renderTab(activeTab, user, isOwn);
  }

  /* ---------- Tab rendering ---------- */

  function renderTab(tab, user, isOwn) {
    activeTab = tab;
    document.querySelectorAll('.profile-tab').forEach((t) => {
      const isActive = t.getAttribute('data-tab') === tab;
      t.classList.toggle('active', isActive);
      t.setAttribute('aria-selected', isActive);
    });

    const content = document.getElementById('profileTabContent');
    if (!content) return;

    if (tab === 'posts') {
      content.innerHTML = `<div id="profilePostsFeed" data-user-id="${user.id}"></div>`;
      const feed = document.getElementById('profilePostsFeed');
      Posts.render(feed, { mode: 'profile', userId: user.id });

      // If own profile and no posts, show composer prompt
      if (isOwn && Posts.getFeedPosts({ mode: 'profile', userId: user.id }).length === 0) {
        feed.innerHTML = `
          <div class="card">
            <div class="empty-state">
              <div class="es-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
              </div>
              <h3>No posts yet</h3>
              <p>Share your first post with your friends.</p>
              <button class="btn btn-primary" onclick="Posts.openComposer()">Create Post</button>
            </div>
          </div>
        `;
      }
    }

    if (tab === 'about') {
      content.innerHTML = `
        <div class="card card-pad">
          <h3 style="margin:0 0 16px;">About</h3>
          <div class="about-grid">
            <div class="about-item">
              <span class="ai-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></span>
              <div>
                <div class="ai-label">Full name</div>
                <div class="ai-value">${escapeHtml(user.fullName)}</div>
              </div>
            </div>
            <div class="about-item">
              <span class="ai-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16v16H4z"/><path d="M4 12h16"/></svg></span>
              <div>
                <div class="ai-label">Username</div>
                <div class="ai-value">@${escapeHtml(user.username)}</div>
              </div>
            </div>
            <div class="about-item">
              <span class="ai-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg></span>
              <div>
                <div class="ai-label">Date of birth</div>
                <div class="ai-value">${user.dob ? Time.dateOnly(new Date(user.dob).getTime()) : 'Not set'}</div>
              </div>
            </div>
            <div class="about-item">
              <span class="ai-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/></svg></span>
              <div>
                <div class="ai-label">Gender</div>
                <div class="ai-value">${user.gender ? user.gender.charAt(0).toUpperCase() + user.gender.slice(1) : 'Not set'}</div>
              </div>
            </div>
            <div class="about-item">
              <span class="ai-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z"/><circle cx="12" cy="10" r="3"/></svg></span>
              <div>
                <div class="ai-label">Location</div>
                <div class="ai-value">${user.location ? escapeHtml(user.location) : 'Not set'}</div>
              </div>
            </div>
            <div class="about-item">
              <span class="ai-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/></svg></span>
              <div>
                <div class="ai-label">Website</div>
                <div class="ai-value">${user.website ? `<a href="https://${escapeHtml(user.website)}" target="_blank" rel="noopener" style="color:var(--brand-primary);">${escapeHtml(user.website)}</a>` : 'Not set'}</div>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    if (tab === 'friends') {
      const friendIds = DB.getFriends()[user.id] || [];
      const friends = friendIds.map((id) => DB.getUserById(id)).filter(Boolean);

      if (friends.length === 0) {
        content.innerHTML = `
          <div class="card">
            <div class="empty-state">
              <div class="es-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
              </div>
              <h3>No friends yet</h3>
              <p>${isOwn ? 'Add friends to see them here.' : 'This user hasn\'t added any friends yet.'}</p>
            </div>
          </div>
        `;
      } else {
        content.innerHTML = `
          <div class="card card-pad">
            <h3 style="margin:0 0 16px;">${friends.length} friend${friends.length === 1 ? '' : 's'}</h3>
            <div class="friends-grid">
              ${friends.map((f) => `
                <div class="friend-card">
                  <a href="profile.html?u=${encodeURIComponent(f.id)}">${avatarHTML(f, 'avatar-md')}</a>
                  <div class="meta">
                    <a href="profile.html?u=${encodeURIComponent(f.id)}" class="name" style="display:block;">${escapeHtml(f.fullName)}</a>
                    <div class="sub">@${escapeHtml(f.username)}</div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }
    }

    if (tab === 'photos') {
      const posts = DB.getPosts().filter((p) => p.authorId === user.id && p.image);
      if (posts.length === 0) {
        content.innerHTML = `
          <div class="card">
            <div class="empty-state">
              <div class="es-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
              </div>
              <h3>No photos yet</h3>
              <p>Photos from posts will appear here.</p>
            </div>
          </div>
        `;
      } else {
        content.innerHTML = `
          <div class="card card-pad">
            <h3 style="margin:0 0 16px;">Photos</h3>
            <div class="photo-grid">
              ${posts.map((p) => `
                <div class="photo-item" data-photo="${p.id}">
                  <img src="${p.image}" alt="Photo by ${escapeHtml(user.fullName)}" />
                </div>
              `).join('')}
            </div>
          </div>
        `;
        content.querySelectorAll('[data-photo]').forEach((item) =>
          item.addEventListener('click', () => {
            const post = DB.getPostById(item.getAttribute('data-photo'));
            if (post?.image) Modal.previewImage(post.image, 'Photo');
          })
        );
      }
    }

    if (tab === 'saved') {
      if (!isOwn) {
        content.innerHTML = `
          <div class="card">
            <div class="empty-state">
              <div class="es-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              </div>
              <h3>This section is private</h3>
              <p>Only ${escapeHtml(user.fullName.split(' ')[0])} can see their saved posts.</p>
            </div>
          </div>
        `;
      } else {
        content.innerHTML = `<div id="savedPostsFeed"></div>`;
        Posts.render(document.getElementById('savedPostsFeed'), { mode: 'saved' });
      }
    }
  }

  /* ---------- Event binding ---------- */

  function bindProfileEvents(user, isOwn, isFriend, isFollowing) {
    // Tabs
    document.querySelectorAll('.profile-tab').forEach((tab) =>
      tab.addEventListener('click', () => renderTab(tab.getAttribute('data-tab'), user, isOwn))
    );

    // Stats click
    document.querySelectorAll('.profile-stat').forEach((stat) =>
      stat.addEventListener('click', () => {
        const kind = stat.getAttribute('data-stat');
        if (kind === 'friends') renderTab('friends', user, isOwn);
      })
    );

    // Edit profile
    if (isOwn) {
      document.getElementById('editProfileBtn')?.addEventListener('click', () => openEditProfile());
      document.getElementById('coverEditBtn')?.addEventListener('click', () => openCoverUploader());
      document.getElementById('avatarEditOverlay')?.addEventListener('click', () => openAvatarUploader());
      document.getElementById('shareProfileBtn')?.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}?u=${user.id}`);
          Toast.success('Profile link copied.');
        } catch { Toast.error('Could not copy link.'); }
      });
    }

    // Add friend
    document.getElementById('addFriendBtn')?.addEventListener('click', () => {
      const currentUser = DB.getCurrentUser();
      const existing = DB.getFriendRequests().find(
        (r) => r.from === currentUser.id && r.to === user.id && r.status === 'pending'
      );
      if (existing) {
        Toast.info('Friend request already sent.');
        return;
      }
      const reqs = DB.getFriendRequests();
      reqs.push({
        id: uid('fr'), from: currentUser.id, to: user.id,
        status: 'pending', createdAt: Date.now(),
      });
      DB.setFriendRequests(reqs);
      DB.addNotification({
        type: 'friend_request', actorId: currentUser.id,
        createdAt: Date.now(), read: false,
      });
      Toast.success('Friend request sent.');
      const btn = document.getElementById('addFriendBtn');
      btn.textContent = 'Request Sent';
      btn.disabled = true;
    });

    // Remove friend
    document.getElementById('removeFriendBtn')?.addEventListener('click', async () => {
      const currentUser = DB.getCurrentUser();
      const ok = await Modal.confirm({
        title: `Remove ${user.fullName}?`,
        message: 'They will be removed from your friends list.',
        confirmText: 'Remove', danger: true,
      });
      if (ok) {
        DB.removeFriendship(currentUser.id, user.id);
        Toast.success('Friend removed.');
        render(document.getElementById('profileMain'));
      }
    });

    // Message
    document.getElementById('messageBtn')?.addEventListener('click', () => {
      window.NexusApp.openMessenger(user.id);
    });

    // Follow
    document.getElementById('followBtn')?.addEventListener('click', (e) => {
      const currentUser = DB.getCurrentUser();
      const nowFollowing = DB.toggleFollow(currentUser.id, user.id);
      e.target.textContent = nowFollowing ? 'Following' : 'Follow';
      e.target.className = `btn ${nowFollowing ? 'btn-secondary' : 'btn-outline'}`;
      Toast.success(nowFollowing ? `Now following ${user.fullName.split(' ')[0]}.` : `Unfollowed.`);
      if (nowFollowing) {
        DB.addNotification({
          type: 'follow', actorId: currentUser.id,
          createdAt: Date.now(), read: false,
        });
      }
    });
  }

  /* ---------- Edit Profile ---------- */

  function openEditProfile() {
    const user = DB.getCurrentUser();
    if (!user) return;

    const modal = Modal.open(`
      <div class="modal-header">
        <div class="modal-title">Edit Profile</div>
        <button class="modal-close" aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="modal-body">
        <div class="field">
          <label for="editFullName">Full name</label>
          <input type="text" id="editFullName" class="input" value="${escapeHtml(user.fullName)}" />
        </div>
        <div class="field">
          <label for="editUsername">Username</label>
          <input type="text" id="editUsername" class="input" value="${escapeHtml(user.username)}" />
        </div>
        <div class="field">
          <label for="editBio">Bio</label>
          <textarea id="editBio" class="textarea" placeholder="Tell people about yourself…" maxlength="200">${escapeHtml(user.bio || '')}</textarea>
        </div>
        <div class="form-row">
          <div class="field">
            <label for="editLocation">Location</label>
            <input type="text" id="editLocation" class="input" value="${escapeHtml(user.location || '')}" placeholder="City, Country" />
          </div>
          <div class="field">
            <label for="editWebsite">Website</label>
            <input type="text" id="editWebsite" class="input" value="${escapeHtml(user.website || '')}" placeholder="example.com" />
          </div>
        </div>
        <div class="form-row">
          <div class="field">
            <label for="editDob">Date of birth</label>
            <input type="date" id="editDob" class="input" value="${user.dob || ''}" />
          </div>
          <div class="field">
            <label>Gender</label>
            <div class="gender-group" id="editGenderGroup">
              ${['female', 'male', 'other'].map((g) => `
                <label class="gender-option ${user.gender === g ? 'selected' : ''}" data-gender="${g}">
                  <input type="radio" name="editGender" value="${g}" ${user.gender === g ? 'checked' : ''} /> ${g.charAt(0).toUpperCase() + g.slice(1)}
                </label>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" data-modal-close>Cancel</button>
        <button class="btn btn-primary" id="saveProfileBtn">Save Changes</button>
      </div>
    `);

    // Gender selector
    modal.querySelectorAll('.gender-option').forEach((opt) => {
      opt.addEventListener('click', () => {
        modal.querySelectorAll('.gender-option').forEach((o) => o.classList.remove('selected'));
        opt.classList.add('selected');
        opt.querySelector('input').checked = true;
      });
    });

    modal.querySelector('#saveProfileBtn').addEventListener('click', () => {
      const newUsername = modal.querySelector('#editUsername').value.trim();
      if (newUsername !== user.username && DB.getUserByUsername(newUsername)) {
        Toast.error('That username is already taken.');
        return;
      }
      if (!/^[a-zA-Z0-9_]{3,20}$/.test(newUsername)) {
        Toast.error('Username must be 3–20 characters (letters, numbers, underscore).');
        return;
      }

      user.fullName = modal.querySelector('#editFullName').value.trim() || user.fullName;
      user.username = newUsername;
      user.bio = modal.querySelector('#editBio').value.trim();
      user.location = modal.querySelector('#editLocation').value.trim();
      user.website = modal.querySelector('#editWebsite').value.trim();
      user.dob = modal.querySelector('#editDob').value;
      user.gender = modal.querySelector('#editGenderGroup .gender-option.selected input').value;

      DB.saveUser(user);
      Modal.close();
      Toast.success('Profile updated.');
      render(document.getElementById('profileMain'));
      window.NexusApp.TopNav.render();
    });
  }

  /* ---------- Avatar uploader ---------- */

  function openAvatarUploader() {
    const user = DB.getCurrentUser();
    if (!user) return;

    let newImage = null;

    const modal = Modal.open(`
      <div class="modal-header">
        <div class="modal-title">Profile Picture</div>
        <button class="modal-close" aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="modal-body">
        <div style="display:flex; justify-content:center; margin-bottom:16px;">
          <div class="profile-avatar-big" style="width:180px; height:180px;" id="avatarPreview">
            ${avatarHTML(user, 'avatar-2xl')}
          </div>
        </div>
        <input type="file" accept="image/jpeg,image/png,image/webp" id="avatarFile" class="hidden" />
        <div style="display:flex; gap:8px;">
          <button class="btn btn-secondary" style="flex:1;" id="avatarChooseBtn">Choose Photo</button>
          ${user.avatar ? `<button class="btn btn-outline" style="flex:1;" id="avatarRemoveBtn">Remove</button>` : ''}
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" data-modal-close>Cancel</button>
        <button class="btn btn-primary" id="avatarSaveBtn" ${user.avatar ? '' : 'disabled'}>Save</button>
      </div>
    `, { size: 'modal-sm' });

    const fileInput = modal.querySelector('#avatarFile');
    const preview = modal.querySelector('#avatarPreview');
    const saveBtn = modal.querySelector('#avatarSaveBtn');

    modal.querySelector('#avatarChooseBtn').addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      const err = ImageUpload.validate(file);
      if (err) { Toast.error(err); fileInput.value = ''; return; }
      try {
        newImage = await ImageUpload.read(file);
        preview.innerHTML = `<img src="${newImage}" alt="Avatar preview" style="width:100%; height:100%; object-fit:cover;" />`;
        saveBtn.disabled = false;
      } catch {
        Toast.error('Could not read image.');
      }
    });

    modal.querySelector('#avatarRemoveBtn')?.addEventListener('click', () => {
      newImage = null;
      preview.innerHTML = avatarHTML({ ...user, avatar: null }, 'avatar-2xl');
      saveBtn.disabled = false;
      saveBtn.setAttribute('data-remove', 'true');
    });

    saveBtn.addEventListener('click', () => {
      if (saveBtn.getAttribute('data-remove') === 'true') {
        user.avatar = null;
      } else if (newImage) {
        user.avatar = newImage;
      } else {
        return;
      }
      DB.saveUser(user);
      Modal.close();
      Toast.success('Profile picture updated.');
      render(document.getElementById('profileMain'));
      window.NexusApp.TopNav.render();
    });
  }

  /* ---------- Cover uploader ---------- */

  function openCoverUploader() {
    const user = DB.getCurrentUser();
    if (!user) return;

    let newImage = null;

    const modal = Modal.open(`
      <div class="modal-header">
        <div class="modal-title">Cover Photo</div>
        <button class="modal-close" aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="modal-body">
        <div id="coverPreview" style="border-radius:14px; overflow:hidden; background:var(--bg-input); min-height:180px; display:flex; align-items:center; justify-content:center; margin-bottom:16px;">
          ${user.cover ? `<img src="${user.cover}" alt="Cover preview" style="width:100%; max-height:280px; object-fit:cover;" />` : `
            <div class="empty-state" style="padding:40px 20px;">
              <div class="es-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
              </div>
              <p style="margin:0;">Choose a cover image</p>
            </div>
          `}
        </div>
        <input type="file" accept="image/jpeg,image/png,image/webp" id="coverFile" class="hidden" />
        <div style="display:flex; gap:8px;">
          <button class="btn btn-secondary" style="flex:1;" id="coverChooseBtn">Choose Photo</button>
          ${user.cover ? `<button class="btn btn-outline" style="flex:1;" id="coverRemoveBtn">Remove</button>` : ''}
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" data-modal-close>Cancel</button>
        <button class="btn btn-primary" id="coverSaveBtn" ${user.cover ? '' : 'disabled'}>Save</button>
      </div>
    `, { size: 'modal-sm' });

    const fileInput = modal.querySelector('#coverFile');
    const preview = modal.querySelector('#coverPreview');
    const saveBtn = modal.querySelector('#coverSaveBtn');

    modal.querySelector('#coverChooseBtn').addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      const err = ImageUpload.validate(file);
      if (err) { Toast.error(err); fileInput.value = ''; return; }
      try {
        newImage = await ImageUpload.read(file);
        preview.innerHTML = `<img src="${newImage}" alt="Cover preview" style="width:100%; max-height:280px; object-fit:cover;" />`;
        saveBtn.disabled = false;
      } catch {
        Toast.error('Could not read image.');
      }
    });

    modal.querySelector('#coverRemoveBtn')?.addEventListener('click', () => {
      newImage = null;
      preview.innerHTML = `
        <div class="empty-state" style="padding:40px 20px;">
          <div class="es-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
          </div>
          <p style="margin:0;">No cover photo</p>
        </div>
      `;
      saveBtn.disabled = false;
      saveBtn.setAttribute('data-remove', 'true');
    });

    saveBtn.addEventListener('click', () => {
      if (saveBtn.getAttribute('data-remove') === 'true') {
        user.cover = null;
      } else if (newImage) {
        user.cover = newImage;
      } else {
        return;
      }
      DB.saveUser(user);
      Modal.close();
      Toast.success('Cover photo updated.');
      render(document.getElementById('profileMain'));
    });
  }

  return { render };
})();

window.Profile = Profile;
