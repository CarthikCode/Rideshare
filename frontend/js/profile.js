import { api } from './api.js';
import { requireAuth, renderNav, saveSession, getToken } from './auth.js';
import { qs, el, toast, setButtonLoading, showLoading, emptyState, formatIST } from './ui.js';

const user = await requireAuth();
if (!user) throw new Error('redirecting to login');
renderNav('profile');

async function loadProfile() {
  try {
    const data = await api('/api/users/me');
    qs('nameInput').value = data.user.name;
    qs('emailReadout').textContent = data.user.email;
    qs('joinedReadout').textContent = `Member since ${formatIST(data.user.createdAt)}`;
    saveSession(getToken(), data.user);
  } catch (err) {
    toast(err.message, 'error');
  }
}

qs('profileForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = qs('saveBtn');
  setButtonLoading(btn, true, 'Saving…');
  try {
    const data = await api('/api/users/me', {
      method: 'PATCH',
      body: { name: qs('nameInput').value.trim() },
    });
    saveSession(getToken(), data.user);
    toast('Profile updated', 'success');
    renderNav('profile');
  } catch (err) {
    toast(err.details?.[0]?.message || err.message, 'error');
  } finally {
    setButtonLoading(btn, false);
  }
});

async function loadBlocks() {
  const host = qs('blockedList');
  showLoading(host);
  try {
    const data = await api('/api/users/me/blocks');
    host.innerHTML = '';
    if (!data.blocks.length) {
      host.appendChild(emptyState('You have not blocked anyone.', '🛡️'));
      return;
    }
    for (const b of data.blocks) {
      const row = el('div', 'ride-card');
      const line = el('div', 'card-row');
      line.appendChild(el('strong', '', b.user.displayName));
      const unblock = el('button', 'btn btn-sm btn-outline', 'Unblock');
      unblock.addEventListener('click', async () => {
        try {
          await api(`/api/users/${b.user.id}/block`, { method: 'DELETE' });
          toast('User unblocked', 'success');
          loadBlocks();
        } catch (err) {
          toast(err.message, 'error');
        }
      });
      line.appendChild(unblock);
      row.appendChild(line);
      host.appendChild(row);
    }
  } catch (err) {
    host.innerHTML = '';
    host.appendChild(emptyState(err.message, '⚠️'));
  }
}

loadProfile();
loadBlocks();
