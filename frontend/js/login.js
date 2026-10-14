import { api } from './api.js';
import { saveSession, renderNav } from './auth.js';
import { qs, toast, setButtonLoading } from './ui.js';

renderNav('login');

const next = new URLSearchParams(location.search).get('next') || 'dashboard.html';
const form = qs('loginForm');
const errorBox = qs('authError');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorBox.classList.remove('visible');
  const btn = qs('loginBtn');
  setButtonLoading(btn, true, 'Logging in…');
  try {
    const data = await api('/api/auth/login', {
      method: 'POST',
      auth: false,
      body: {
        email: qs('email').value.trim(),
        password: qs('password').value,
      },
    });
    saveSession(data.token, data.user);
    toast(`Welcome back, ${data.user.name.split(' ')[0]}!`, 'success');
    location.href = next;
  } catch (err) {
    errorBox.textContent = err.message;
    errorBox.classList.add('visible');
  } finally {
    setButtonLoading(btn, false);
  }
});
