// ── Auth ─────────────────────────────────────────────
const Auth = {
  getToken:    () => localStorage.getItem('fp_token'),
  setToken:    (t) => localStorage.setItem('fp_token', t),
  getUser:     () => { try { return JSON.parse(localStorage.getItem('fp_user')); } catch { return null; } },
  setUser:     (u) => localStorage.setItem('fp_user', JSON.stringify(u)),
  clear:       () => { localStorage.removeItem('fp_token'); localStorage.removeItem('fp_user'); },
  isLogged:    () => !!localStorage.getItem('fp_token'),
  isPremium:   () => { const u = Auth.getUser(); return u?.subscription_expires && new Date(u.subscription_expires) > new Date(); },
  requireAuth: () => { if (!Auth.isLogged()) { window.location.href = '/pages/login.html'; return false; } return true; },
  requireGuest:() => { if (Auth.isLogged()) { window.location.href = '/pages/dashboard.html'; return false; } return true; }
};


// API_BASE автоматически определяется из текущего хоста
const API_BASE = window.location.origin === "file://" ? "http://localhost:3000" : window.location.origin;
// ── Base fetch ────────────────────────────────────────
async function request(url, method = 'GET', body = null) {
  const headers = { 'Content-Type': 'application/json' };
  const token = Auth.getToken();
  if (token) headers['Authorization'] = 'Bearer ' + token;

  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(API_BASE + url, opts);
  const data = await res.json();

  if (!res.ok) {
    if (res.status === 401) { Auth.clear(); window.location.href = '/pages/login.html'; }
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

// ── API ───────────────────────────────────────────────
const api = {
  // Auth
  register:    (d) => request('/api/auth/register', 'POST', d),
  login:       (d) => request('/api/auth/login', 'POST', d),
  me:          ()  => request('/api/auth/me'),
  updateProfile: (d) => request('/api/auth/profile', 'PUT', d),

  // Users
  getUserCount: ()    => fetch('/api/users/count').then(r => r.json()),
  getUsers:    (p={}) => request('/api/users?' + new URLSearchParams(p)),
  getNewUsers: ()     => request('/api/users/new'),
  getUser:     (id)   => request('/api/users/' + id),
  toggleLike:  (id)   => request('/api/users/' + id + '/like', 'POST'),

  // Messages
  getConversations: () => request('/api/messages/conversations'),
  getMessages:  (uid) => request('/api/messages/' + uid),
  sendMessage:  (uid, content) => request('/api/messages/' + uid, 'POST', { content }),
  getUnread:    () => request('/api/messages/unread'),

  // Subscription
  getPlans:    () => request('/api/subscription/plans'),
  getSubStatus:() => request('/api/subscription/status'),
  activateSub: (plan_id, kaspi_phone) => request('/api/subscription/activate', 'POST', { plan_id, kaspi_phone }),

  // Contact
  sendContact: (d) => request('/api/contact/send', 'POST', d),
  getContactInfo: () => request('/api/contact/info')
};

// ── Toast ─────────────────────────────────────────────
function toast(msg, type = 'info') {
  let c = document.getElementById('toast-container');
  if (!c) { c = document.createElement('div'); c.id = 'toast-container'; document.body.appendChild(c); }
  const icons = { success:'✓', error:'✕', info:'ℹ' };
  const el = document.createElement('div');
  el.className = 'toast toast-' + type;
  el.innerHTML = `<span>${icons[type]||'ℹ'}</span>${msg}`;
  c.appendChild(el);
  setTimeout(() => { el.style.opacity='0'; el.style.transform='translateX(100%)'; }, 3500);
  setTimeout(() => el.remove(), 4000);
}

// ── Helpers ───────────────────────────────────────────
function val(id) { return document.getElementById(id)?.value?.trim() || ''; }

function setLoading(btn, loading, text = '') {
  if (loading) { btn.disabled = true; btn._orig = btn.innerHTML; btn.innerHTML = `<span class="spinner"></span>${text}`; }
  else { btn.disabled = false; btn.innerHTML = btn._orig || text; }
}

function initials(name) {
  return (name||'?').split(' ').map(n => n[0]||'').join('').toUpperCase().slice(0,2) || '?';
}

function timeAgo(d) {
  if (!d) return '';
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff/60000);
  if (m < 1) return 'сейчас';
  if (m < 60) return m + ' мин назад';
  const h = Math.floor(m/60);
  if (h < 24) return h + ' ч назад';
  return Math.floor(h/24) + ' дн назад';
}

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('ru-RU', { day:'numeric', month:'long', year:'numeric' });
}

function formatTime(d) {
  if (!d) return '';
  return new Date(d).toLocaleTimeString('ru-RU', { hour:'2-digit', minute:'2-digit' });
}

const LEVELS  = { beginner:'Новичок', intermediate:'Средний', advanced:'Продвинутый' };
const GENDERS = { male:'Мужской', female:'Женский' };

function avatarEl(user, size = 'md') {
  if (user.avatar) {
    return `<img src="${user.avatar}" class="avatar-img-${size}" alt="">`;
  }
  const isF = user.gender === 'female';
  return `<div class="avatar avatar-${size} ${isF ? 'avatar-female' : ''}">${initials(user.name)}</div>`;
}

// ── Unread badge ──────────────────────────────────────
async function updateUnreadBadge() {
  try {
    const data = await api.getUnread();
    const badge = document.getElementById('msg-badge');
    if (!badge) return;
    badge.textContent = data.total;
    badge.classList.toggle('show', data.total > 0);
  } catch {}
}

// ── Nav active state ──────────────────────────────────
function setNavActive() {
  const path = window.location.pathname;
  document.querySelectorAll('.nav-item[data-page]').forEach(el => {
    el.classList.toggle('active', path.includes(el.dataset.page));
  });
}

// ── Premium check modal ───────────────────────────────
function showPremiumModal() {
  const modal = document.getElementById('modal-premium');
  if (modal) modal.classList.add('open');
  else window.location.href = '/pages/subscription.html';
}

// ── Animate counter ───────────────────────────────────
function animateNum(id, to, dur = 1800) {
  const el = document.getElementById(id);
  if (!el || to === 0) { if (el) el.textContent = '0'; return; }
  const step = to / (dur / 16);
  let cur = 0;
  const t = setInterval(() => {
    cur = Math.min(cur + step, to);
    el.textContent = Math.floor(cur);
    if (cur >= to) clearInterval(t);
  }, 16);
}

// ── Init ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setNavActive();
  if (Auth.isLogged()) updateUnreadBadge();
});
