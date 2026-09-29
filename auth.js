/* ============================================================
   FRIENDIABD SOCIAL — auth.js
   Frontend-only authentication (localStorage).
   ------------------------------------------------------------
   ⚠️  SECURITY NOTE
   This module is a DEMO. Passwords are stored as-is in
   localStorage, which is NOT secure and must NEVER be used in
   a real product. To connect a real backend:
     • Replace Auth.signup()  with POST /api/auth/register
     • Replace Auth.login()   with POST /api/auth/login
     • Replace Auth.logout()  with POST /api/auth/logout
     • Store the returned session token (httpOnly cookie preferred)
     • Verify the session on every page load via GET /api/auth/me
   ============================================================ */

'use strict';

const Auth = (() => {
  const { DB, Storage, Toast, Theme } = window.FriendiabdApp;

  /* ---------- Validation helpers ---------- */
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
  const MIN_PASSWORD = 8;

  function showFieldError(id, msg) {
    const box = document.getElementById(id);
    if (!box) return;
    box.textContent = msg;
    box.classList.toggle('show', Boolean(msg));
    const input = box.previousElementSibling;
    if (input && input.classList) input.classList.toggle('error', Boolean(msg));
  }

  function clearErrors(ids) {
    ids.forEach((id) => showFieldError(id, ''));
  }

  /* ---------- Signup ---------- */
  async function signup({ fullName, username, email, password, dob, gender }) {
    // Validate
    if (!fullName || fullName.trim().length < 2) {
      return { ok: false, field: 'signupNameError', msg: 'Please enter your full name.' };
    }
    if (!USERNAME_RE.test(username)) {
      return { ok: false, field: 'signupUsernameError', msg: 'Username must be 3–20 characters (letters, numbers, underscore).' };
    }
    if (DB.getUserByUsername(username)) {
      return { ok: false, field: 'signupUsernameError', msg: 'That username is already taken.' };
    }
    if (!EMAIL_RE.test(email)) {
      return { ok: false, field: 'signupEmailError', msg: 'Please enter a valid email address.' };
    }
    if (DB.getUserByEmail(email)) {
      return { ok: false, field: 'signupEmailError', msg: 'An account with that email already exists.' };
    }
    if (!password || password.length < MIN_PASSWORD) {
      return { ok: false, field: 'signupPasswordError', msg: `Password must be at least ${MIN_PASSWORD} characters.` };
    }
    if (!dob) {
      return { ok: false, field: 'signupDobError', msg: 'Please enter your date of birth.' };
    }

    // NOTE: In a real app, this is where you'd POST to /api/auth/register.
    const user = {
      id: uid('user'),
      fullName: fullName.trim(),
      username: username.trim(),
      email: email.trim().toLowerCase(),
      // ⚠️ NEVER store plaintext passwords in production.
      password,
      dob,
      gender,
      bio: '',
      location: '',
      website: '',
      avatar: null,
      cover: null,
      joinedAt: Date.now(),
      isDemo: false,
    };

    DB.saveUser(user);

    // Add a welcome notification
    DB.addNotification({
      type: 'welcome',
      actorId: null,
      createdAt: Date.now(),
      read: false,
      text: 'Welcome to Nexus! Complete your profile to get started.',
    });

    // Auto-login
    DB.setCurrentUser(user.id);
    return { ok: true, user };
  }

  /* ---------- Login ---------- */
  async function login({ email, password }) {
    if (!email || !EMAIL_RE.test(email)) {
      return { ok: false, field: 'loginEmailError', msg: 'Please enter a valid email address.' };
    }
    if (!password) {
      return { ok: false, field: 'loginPasswordError', msg: 'Please enter your password.' };
    }

    // NOTE: In a real app, this is where you'd POST to /api/auth/login.
    const user = DB.getUserByEmail(email);
    if (!user || user.password !== password) {
      return { ok: false, field: 'loginPasswordError', msg: 'Incorrect email or password.' };
    }

    DB.setCurrentUser(user.id);
    return { ok: true, user };
  }

  /* ---------- Logout ---------- */
  function logout() {
    DB.clearCurrentUser();
    Toast.success('Logged out successfully.');
    setTimeout(() => window.location.replace('login.html'), 400);
  }

  /* ---------- Demo login ---------- */
  function demoLogin() {
    // Ensure demo data exists
    window.Friendiabd.DemoData.seed();
    const demo = DB.getUsers().find((u) => u.isDemo);
    if (!demo) {
      Toast.error('Demo data could not be loaded.');
      return;
    }
    DB.setCurrentUser(demo.id);
    Toast.success(`Welcome back, ${demo.fullName.split(' ')[0]}!`);
    setTimeout(() => window.location.replace('index.html'), 500);
  }

  /* ---------- Page initializers ---------- */
  function initLoginPage() {
    // Redirect if already logged in
    if (AuthGuard.redirectIfLoggedIn()) return;

    // Seed demo data so the "Try demo" button works
    window.FriendiabdApp.DemoData.seed();
    Theme.init();

    const form = document.getElementById('loginForm');
    const passInput = document.getElementById('loginPassword');
    const toggle = document.getElementById('toggleLoginPass');

    // Password visibility toggle
    toggle.addEventListener('click', () => {
      const isPassword = passInput.type === 'password';
      passInput.type = isPassword ? 'text' : 'password';
      toggle.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
      toggle.innerHTML = isPassword
        ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><path d="M2 2l20 20"/></svg>'
        : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearErrors(['loginEmailError', 'loginPasswordError']);

      const btn = document.getElementById('loginBtn');
      btn.disabled = true;
      btn.textContent = 'Logging in…';

      const email = document.getElementById('loginEmail').value.trim();
      const password = passInput.value;
      const remember = document.getElementById('rememberMe').checked;

      const result = await login({ email, password });

      btn.disabled = false;
      btn.textContent = 'Log In';

      if (!result.ok) {
        showFieldError(result.field, result.msg);
        Toast.error(result.msg);
        return;
      }

      // "Remember me" simply controls whether the session survives
      // browser restart. In this demo the session is always persisted.
      if (!remember) {
        // (Demo: we still persist for simplicity)
      }

      Toast.success(`Welcome back, ${result.user.fullName.split(' ')[0]}!`);
      setTimeout(() => window.location.replace('index.html'), 500);
    });

    document.getElementById('demoLoginBtn').addEventListener('click', demoLogin);
  }

  function initSignupPage() {
    if (AuthGuard.redirectIfLoggedIn()) return;
    window.FriendiabdApp.DemoData.seed();
    Theme.init();

    const form = document.getElementById('signupForm');
    const passInput = document.getElementById('signupPassword');
    const toggle = document.getElementById('toggleSignupPass');

    toggle.addEventListener('click', () => {
      const isPassword = passInput.type === 'password';
      passInput.type = isPassword ? 'text' : 'password';
      toggle.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
      toggle.innerHTML = isPassword
        ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><path d="M2 2l20 20"/></svg>'
        : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
    });

    // Gender selector
    document.querySelectorAll('.gender-option').forEach((opt) => {
      opt.addEventListener('click', () => {
        document.querySelectorAll('.gender-option').forEach((o) => o.classList.remove('selected'));
        opt.classList.add('selected');
        opt.querySelector('input').checked = true;
      });
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearErrors([
        'signupNameError', 'signupUsernameError', 'signupEmailError',
        'signupPasswordError', 'signupDobError', 'signupTermsError',
      ]);

      const terms = document.getElementById('signupTerms');
      if (!terms.checked) {
        showFieldError('signupTermsError', 'Please accept the Terms to continue.');
        Toast.error('Please accept the Terms to continue.');
        return;
      }

      const btn = document.getElementById('signupBtn');
      btn.disabled = true;
      btn.textContent = 'Creating account…';

      const data = {
        fullName: document.getElementById('signupName').value.trim(),
        username: document.getElementById('signupUsername').value.trim(),
        email: document.getElementById('signupEmail').value.trim(),
        password: passInput.value,
        dob: document.getElementById('signupDob').value,
        gender: document.querySelector('.gender-option.selected input').value,
      };

      const result = await signup(data);

      btn.disabled = false;
      btn.textContent = 'Create Account';

      if (!result.ok) {
        showFieldError(result.field, result.msg);
        Toast.error(result.msg);
        return;
      }

      Toast.success('Account created! Welcome to Friendiabd.');
      setTimeout(() => window.location.replace('index.html'), 700);
    });
  }

  return { signup, login, logout, demoLogin, initLoginPage, initSignupPage };
})();

window.Auth = Auth;
