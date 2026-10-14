import { api } from './api.js';
import { saveSession, renderNav } from './auth.js';
import { qs, toast, setButtonLoading } from './ui.js';

renderNav('register');

const form = qs('registerForm');
const errorBox = qs('authError');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorBox.classList.remove('visible');
  const name = qs('name').value.trim();
  const email = qs('email').value.trim();
  const password = qs('password').value;
  if (password.length < 8) {
    errorBox.textContent = 'Password must be at least 8 characters.';
    errorBox.classList.add('visible');
    return;
  }
  const btn = qs('registerBtn');
  setButtonLoading(btn, true, 'Creating account…');
  try {
    const data = await api('/api/auth/register', {
      method: 'POST',
      auth: false,
      body: { name, email, password },
    });
    saveSession(data.token, data.user);
    toast('Account created. Welcome to RideShare!', 'success');
    location.href = 'dashboard.html';
  } catch (err) {
    errorBox.textContent = err.details?.[0]?.message || err.message;
    errorBox.classList.add('visible');
  } finally {
    setButtonLoading(btn, false);
  }
});
