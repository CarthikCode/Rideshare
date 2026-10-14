import { api, TOKEN_KEY } from './api.js';

const USER_KEY = 'rideshare_user';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function saveSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function currentUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY));
  } catch {
    return null;
  }
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  location.href = 'login.html';
}

function loginRedirect() {
  const here = location.pathname.split('/').pop() || 'index.html';
  location.href = `login.html?next=${encodeURIComponent(here + location.search)}`;
}

export async function requireAuth() {
  if (!getToken()) {
    loginRedirect();
    return null;
  }
  let user = currentUser();
  if (!user) {
    try {
      const data = await api('/api/users/me');
      user = data.user;
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch (err) {
      if (err.status === 401) {
        logout();
        return null;
      }
    }
  }
  return user;
}

export async function refreshPendingBadge() {
  const badge = document.getElementById('navBadge');
  if (!badge || !getToken()) return;
  try {
    const data = await api('/api/requests/incoming');
    const count = data.requests.filter((r) => r.status === 'PENDING').length;
    badge.textContent = count > 9 ? '9+' : String(count);
    badge.classList.toggle('visible', count > 0);
  } catch {
    /* badge is best-effort */
  }
}

export async function renderNav(active = '') {
  const host = document.getElementById('navbar');
  if (!host) return;
  const loggedIn = Boolean(getToken());
  const user = currentUser();

  host.innerHTML = '';
  const bar = document.createElement('nav');
  bar.className = 'navbar';
  const inner = document.createElement('div');
  inner.className = 'navbar-inner';

  const logo = document.createElement('a');
  logo.className = 'nav-logo';
  logo.href = 'index.html';
  logo.textContent = '🚗 RideShare';
  inner.appendChild(logo);

  const toggle = document.createElement('button');
  toggle.className = 'nav-toggle';
  toggle.setAttribute('aria-label', 'Menu');
  toggle.innerHTML = '<span></span><span></span><span></span>';
  inner.appendChild(toggle);

  const links = document.createElement('div');
  links.className = 'nav-links';

  const addLink = (href, label, key) => {
    const a = document.createElement('a');
    a.href = href;
    a.textContent = label;
    if (key === active) a.classList.add('active');
    links.appendChild(a);
    return a;
  };

  if (loggedIn) {
    const dash = addLink('dashboard.html', 'Dashboard', 'dashboard');
    const badge = document.createElement('span');
    badge.className = 'nav-badge';
    badge.id = 'navBadge';
    dash.appendChild(badge);
    addLink('search-rides.html', 'Search', 'search');
    addLink('create-ride.html', 'Post a ride', 'create');
    addLink('profile.html', user ? user.name.split(' ')[0] : 'Profile', 'profile');
    const out = document.createElement('button');
    out.className = 'nav-link';
    out.textContent = 'Logout';
    out.addEventListener('click', logout);
    links.appendChild(out);
  } else {
    addLink('index.html', 'Home', 'home');
    addLink('login.html', 'Login', 'login');
    addLink('register.html', 'Register', 'register');
  }

  toggle.addEventListener('click', () => {
    toggle.classList.toggle('open');
    links.classList.toggle('open');
  });

  inner.appendChild(links);
  bar.appendChild(inner);
  host.appendChild(bar);

  if (loggedIn) refreshPendingBadge();
}
