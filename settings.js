ল/* ============================================================
   NEXUS SOCIAL — settings.js
   Settings page: account, privacy, notifications, appearance,
   security, danger zone.
   ============================================================ */

'use strict';

const Settings = (() => {
  const { DB, Storage, Toast, Modal, Theme, escapeHtml } = window.NexusApp;

  const SECTIONS = [
    { id: 'account',       label: 'Account',       icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>' },
    { id: 'privacy',       label: 'Privacy',       icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>' },
    { id: 'notifications', label: 'Notifications', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>' },
    { id: 'appearance',    label: 'Appearance',    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="10.5" r="2.5"/><circle cx="8.5" cy="7.5" r="2.5"/><circle cx="6.5" cy="12.5" r="2.5"/><path d="M12 2a10 10 0 1 0 0 20c1.1 0 2-.9 2-2v-1a2 2 0 0 1 2-2h1a3 3 0 0 0 3-3c0-1-.5-2-1.3-2.8A10 10 0 0 0 12 2Z"/></svg>' },
    { id: 'security',      label: 'Security',      icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/></svg>' },
    { id: 'danger',        label: 'Danger Zone',   icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3Z"/><path d="M12 9v4M12 17h.01"/></svg>' },
  ];

  let active = 'account';

  function render() {
    renderNav();
    renderSection(active);
  }

  function renderNav() {
    const nav = document.getElementById('settingsNav');
    if (!nav) return;
    nav.innerHTML = `
      <nav class="sidebar-nav">
        ${SECTIONS.map((s) => `
          <button class="sidebar-item ${active === s.id ? 'active' : ''}" data-section="${s.id}">
            <span class="icon-box">${s.icon}</span>
            ${s.label}
          </button>
        `).join('')}
      </nav>
    `;
    nav.querySelectorAll('[data-section]').forEach((btn) =>
      btn.addEventListener('click', () => {
        active = btn.getAttribute('data-section');
        renderNav();
        renderSection(active);
      })
    );
  }

  function renderSection(section) {
    const main = document.getElementById('settingsMain');
    if (!main) return;
    const user = DB.getCurrentUser();
    if (!user) return;
    const settings = DB.getSettings();

    if (section === 'account') {
      main.innerHTML = `
        <div class="card card-pad settings-section">
          <h3>Account</h3>
          <p class="desc">Manage your profile details and login credentials.</p>

          <div class="setting-row">
            <div class="info">
              <div class="title">Profile information</div>
              <div class="sub">Name, bio, location, and more</div>
            </div>
            <button class="btn btn-secondary" id="editProfileFromSettings">Edit Profile</button>
          </div>

          <div class="setting-row">
            <div class="info">
              <div class="title">Username</div>
              <div class="sub">@${escapeHtml(user.username)}</div>
            </div>
            <button class="btn btn-secondary" id="changeUsernameBtn">Change</button>
          </div>

          <div class="setting-row">
            <div class="info">
              <div class="title">Email address</div>
              <div class="sub">${escapeHtml(user.email)}</div>
            </div>
            <button class="btn btn-secondary" id="changeEmailBtn">Change</button>
          </div>

          <div class="setting-row">
            <div class="info">
              <div class="title">Password</div>
              <div class="sub">Last changed: not tracked in demo</div>
            </div>
            <button class="btn btn-secondary" id="changePasswordBtn">Change</button>
          </div>
        </div>
      `;

      main.querySelector('#editProfileFromSettings')?.addEventListener('click', () => {
        window.location.href = 'profile.html';
      });
      main.querySelector('#changeUsernameBtn')?.addEventListener('click', changeUsername);
      main.querySelector('#changeEmailBtn')?.addEventListener('click', changeEmail);
      main.querySelector('#changePasswordBtn')?.addEventListener('click', changePassword);
    }

    if (section === 'privacy') {
      const privacy = settings.privacy || {
        profileVisibility: 'public',
        postVisibility: 'friends',
        whoCanFriend: 'everyone',
        whoCanMessage: 'friends',
      };
      main.innerHTML = `
        <div class="card card-pad settings-section">
          <h3>Privacy</h3>
          <p class="desc">Control who can see your content and contact you.</p>

          <div class="setting-row">
            <div class="info">
              <div class="title">Profile visibility</div>
              <div class="sub">Who can see your profile page</div>
            </div>
            <select class="select" style="max-width:180px;" data-priv="profileVisibility">
              <option value="public"${privacy.profileVisibility === 'public' ? ' selected' : ''}>Everyone</option>
              <option value="friends"${privacy.profileVisibility === 'friends' ? ' selected' : ''}>Friends</option>
              <option value="private"${privacy.profileVisibility === 'private' ? ' selected' : ''}>Only Me</option>
            </select>
          </div>

          <div class="setting-row">
            <div class="info">
              <div class="title">Default post visibility</div>
              <div class="sub">Who can see new posts by default</div>
            </div>
            <select class="select" style="max-width:180px;" data-priv="postVisibility">
              <option value="public"${privacy.postVisibility === 'public' ? ' selected' : ''}>Public</option>
              <option value="friends"${privacy.postVisibility === 'friends' ? ' selected' : ''}>Friends</option>
              <option value="private"${privacy.postVisibility === 'private' ? ' selected' : ''}>Only Me</option>
            </select>
          </div>

          <div class="setting-row">
            <div class="info">
              <div class="title">Who can send friend requests</div>
              <div class="sub">Control who can add you</div>
            </div>
            <select class="select" style="max-width:180px;" data-priv="whoCanFriend">
              <option value="everyone"${privacy.whoCanFriend === 'everyone' ? ' selected' : ''}>Everyone</option>
              <option value="friends"${privacy.whoCanFriend === 'friends' ? ' selected' : ''}>Friends of friends</option>
              <option value="none"${privacy.whoCanFriend === 'none' ? ' selected' : ''}>No one</option>
            </select>
          </div>

          <div class="setting-row">
            <div class="info">
              <div class="title">Who can message me</div>
              <div class="sub">Control your inbox</div>
            </div>
            <select class="select" style="max-width:180px;" data-priv="whoCanMessage">
              <option value="everyone"${privacy.whoCanMessage === 'everyone' ? ' selected' : ''}>Everyone</option>
              <option value="friends"${privacy.whoCanMessage === 'friends' ? ' selected' : ''}>Friends</option>
              <option value="none"${privacy.whoCanMessage === 'none' ? ' selected' : ''}>No one</option>
            </select>
          </div>
        </div>
      `;

      main.querySelectorAll('[data-priv]').forEach((sel) =>
        sel.addEventListener('change', () => {
          const key = sel.getAttribute('data-priv');
          DB.updateSettings({ privacy: { ...privacy, [key]: sel.value } });
          Toast.success('Privacy settings updated.');
        })
      );
    }

    if (section === 'notifications') {
      const notifs = settings.notifications || {
        likes: true, comments: true, friendRequests: true, messages: true,
      };
      main.innerHTML = `
        <div class="card card-pad settings-section">
          <h3>Notifications</h3>
          <p class="desc">Choose what you want to be notified about.</p>

          ${[
            ['likes', 'Likes', 'When someone likes your post'],
            ['comments', 'Comments', 'When someone comments on your post'],
            ['friendRequests', 'Friend requests', 'When someone sends you a friend request'],
            ['messages', 'Messages', 'When you receive a new message'],
          ].map(([key, title, sub]) => `
            <div class="setting-row">
              <div class="info">
                <div class="title">${title}</div>
                <div class="sub">${sub}</div>
              </div>
              <button class="switch ${notifs[key] ? 'on' : ''}" data-toggle="${key}" role="switch" aria-checked="${notifs[key]}" aria-label="Toggle ${title}"></button>
            </div>
          `).join('')}
        </div>
      `;

      main.querySelectorAll('[data-toggle]').forEach((sw) =>
        sw.addEventListener('click', () => {
          const key = sw.getAttribute('data-toggle');
          const next = !sw.classList.contains('on');
          sw.classList.toggle('on', next);
          sw.setAttribute('aria-checked', next);
          DB.updateSettings({ notifications: { ...notifs, [key]: next } });
          Toast.success('Notification settings updated.');
        })
      );
    }

    if (section === 'appearance') {
      const appearance = settings.appearance || { dark: false, compact: false };
      main.innerHTML = `
        <div class="card card-pad settings-section">
          <h3>Appearance</h3>
          <p class="desc">Customize how Nexus looks on this device.</p>

          <div class="setting-row">
            <div class="info">
              <div class="title">Dark mode</div>
              <div class="sub">Easier on the eyes at night</div>
            </div>
            <button class="switch ${Theme.current() === 'dark' ? 'on' : ''}" data-appearance="dark" role="switch" aria-checked="${Theme.current() === 'dark'}" aria-label="Toggle dark mode"></button>
          </div>

          <div class="setting-row">
            <div class="info">
              <div class="title">Compact mode</div>
              <div class="sub">Show more content with tighter spacing</div>
            </div>
            <button class="switch ${appearance.compact ? 'on' : ''}" data-appearance="compact" role="switch" aria-checked="${appearance.compact}" aria-label="Toggle compact mode"></button>
          </div>
        </div>
      `;

      main.querySelectorAll('[data-appearance]').forEach((sw) =>
        sw.addEventListener('click', () => {
          const key = sw.getAttribute('data-appearance');
          if (key === 'dark') {
            Theme.toggle();
            sw.classList.toggle('on', Theme.current() === 'dark');
            DB.updateSettings({ appearance: { ...appearance, dark: Theme.current() === 'dark' } });
            Toast.success(Theme.current() === 'dark' ? 'Dark mode enabled.' : 'Light mode enabled.');
          } else {
            const next = !sw.classList.contains('on');
            sw.classList.toggle('on', next);
            DB.updateSettings({ appearance: { ...appearance, compact: next } });
            Toast.success(next ? 'Compact mode enabled.' : 'Compact mode disabled.');
          }
        })
      );
    }

    if (section === 'security') {
      main.innerHTML = `
        <div class="card card-pad settings-section">
          <h3>Security</h3>
          <p class="desc">Review your sessions and sign out of devices.</p>

          <div class="setting-row">
            <div class="info">
              <div class="title">Current session</div>
              <div class="sub">This browser · ${navigator.userAgent.includes('Mobile') ? 'Mobile' : 'Desktop'}</div>
            </div>
            <span class="btn btn-secondary" style="pointer-events:none;">Active now</span>
          </div>

          <div class="setting-row">
            <div class="info">
              <div class="title">Log out of this session</div>
              <div class="sub">You will need to log in again</div>
            </div>
            <button class="btn btn-secondary" id="logoutCurrentBtn">Log Out</button>
          </div>

          <div class="setting-row">
            <div class="info">
              <div class="title">Log out of all devices</div>
              <div class="sub">Ends all active sessions (demo)</div>
            </div>
            <button class="btn btn-outline" id="logoutAllBtn">Log Out All</button>
          </div>
        </div>
      `;

      main.querySelector('#logoutCurrentBtn')?.addEventListener('click', () => Auth.logout());
      main.querySelector('#logoutAllBtn')?.addEventListener('click', () => {
        Toast.success('Signed out of all devices (demo).');
        setTimeout(() => Auth.logout(), 500);
      });
    }

    if (section === 'danger') {
      main.innerHTML = `
        <div class="card card-pad danger-zone">
          <h3>Danger Zone</h3>
          <p class="desc">These actions are permanent and cannot be undone.</p>

          <div class="setting-row">
            <div class="info">
              <div class="title">Clear local data</div>
              <div class="sub">Removes all Nexus data from this browser</div>
            </div>
            <button class="btn btn-outline" id="clearDataBtn">Clear Data</button>
          </div>

          <div class="setting-row" style="border-bottom:none;">
            <div class="info">
              <div class="title">Delete account</div>
              <div class="sub">Permanently delete your Nexus account</div>
            </div>
            <button class="btn btn-danger" id="deleteAccountBtn">Delete Account</button>
          </div>
        </div>
      `;

      main.querySelector('#clearDataBtn')?.addEventListener('click', async () => {
        const ok = await Modal.confirm({
          title: 'Clear all local data?',
          message: 'This removes your account, posts, messages and settings from this browser. You will be logged out.',
          confirmText: 'Clear Everything', danger: true,
        });
        if (ok) {
          Storage.clearAll();
          Toast.success('All local data cleared.');
          setTimeout(() => window.location.replace('signup.html'), 600);
        }
      });

      main.querySelector('#deleteAccountBtn')?.addEventListener('click', async () => {
        const ok = await Modal.confirm({
          title: 'Delete your account?',
          message: 'This will permanently remove your profile and all your content from this browser. This action cannot be undone.',
          confirmText: 'Delete Account', danger: true,
        });
        if (ok) {
          const user = DB.getCurrentUser();
          if (user) {
            // Remove user
            DB.setUsers(DB.getUsers().filter((u) => u.id !== user.id));
            // Remove their posts and comments
            DB.setPosts(DB.getPosts().filter((p) => p.authorId !== user.id));
            DB.setComments(DB.getComments().filter((c) => c.authorId !== user.id));
          }
          DB.clearCurrentUser();
          Toast.success('Account deleted.');
          setTimeout(() => window.location.replace('signup.html'), 700);
        }
      });
    }
  }

  /* ---------- Account change dialogs ---------- */

  function changeUsername() {
    const user = DB.getCurrentUser();
    const modal = Modal.open(`
      <div class="modal-header">
        <div class="modal-title">Change Username</div>
        <button class="modal-close" aria-label="Close"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
      </div>
      <div class="modal-body">
        <div class="field">
          <label for="newUsername">New username</label>
          <input type="text" id="newUsername" class="input" value="${escapeHtml(user.username)}" />
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" data-modal-close>Cancel</button>
        <button class="btn btn-primary" id="saveUsername">Save</button>
      </div>
    `, { size: 'modal-sm' });

    modal.querySelector('#saveUsername').addEventListener('click', () => {
      const val = modal.querySelector('#newUsername').value.trim();
      if (!/^[a-zA-Z0-9_]{3,20}$/.test(val)) {
        Toast.error('Username must be 3–20 characters (letters, numbers, underscore).');
        return;
      }
      if (val !== user.username && DB.getUserByUsername(val)) {
        Toast.error('That username is already taken.');
        return;
      }
      user.username = val;
      DB.saveUser(user);
      Modal.close();
      Toast.success('Username updated.');
      render();
      window.NexusApp.TopNav.render();
    });
  }

  function changeEmail() {
    const user = DB.getCurrentUser();
    const modal = Modal.open(`
      <div class="modal-header">
        <div class="modal-title">Change Email</div>
        <button class="modal-close" aria-label="Close"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
      </div>
      <div class="modal-body">
        <div class="field">
          <label for="newEmail">New email</label>
          <input type="email" id="newEmail" class="input" value="${escapeHtml(user.email)}" />
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" data-modal-close>Cancel</button>
        <button class="btn btn-primary" id="saveEmail">Save</button>
      </div>
    `, { size: 'modal-sm' });

    modal.querySelector('#saveEmail').addEventListener('click', () => {
      const val = modal.querySelector('#newEmail').value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val)) {
        Toast.error('Please enter a valid email address.');
        return;
      }
      if (val !== user.email && DB.getUserByEmail(val)) {
        Toast.error('That email is already registered.');
        return;
      }
      user.email = val;
      DB.saveUser(user);
      Modal.close();
      Toast.success('Email updated.');
      render();
    });
  }

  function changePassword() {
    const user = DB.getCurrentUser();
    const modal = Modal.open(`
      <div class="modal-header">
        <div class="modal-title">Change Password</div>
        <button class="modal-close" aria-label="Close"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
      </div>
      <div class="modal-body">
        <div class="field">
          <label for="currentPass">Current password</label>
          <input type="password" id="currentPass" class="input" />
        </div>
        <div class="field">
          <label for="newPass">New password</label>
          <input type="password" id="newPass" class="input" placeholder="At least 8 characters" />
        </div>
        <div class="field">
          <label for="confirmPass">Confirm new password</label>
          <input type="password" id="confirmPass" class="input" />
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" data-modal-close>Cancel</button>
        <button class="btn btn-primary" id="savePassword">Save</button>
      </div>
    `, { size: 'modal-sm' });

    modal.querySelector('#savePassword').addEventListener('click', () => {
      const cur = modal.querySelector('#currentPass').value;
      const np = modal.querySelector('#newPass').value;
      const cp = modal.querySelector('#confirmPass').value;

      if (cur !== user.password) { Toast.error('Current password is incorrect.'); return; }
      if (np.length < 8) { Toast.error('New password must be at least 8 characters.'); return; }
      if (np !== cp) { Toast.error('New passwords do not match.'); return; }

      user.password = np;
      DB.saveUser(user);
      Modal.close();
      Toast.success('Password updated.');
    });
  }

  return { render };
})();

window.Settings = Settings;
