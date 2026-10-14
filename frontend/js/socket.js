import { SOCKET_URL } from './config.js';
import { TOKEN_KEY } from './api.js';

export function connectSocket() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token || typeof io === 'undefined') return null;
  return io(SOCKET_URL, { auth: { token } });
}
