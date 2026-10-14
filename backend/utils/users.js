export function displayName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'User';
  if (parts.length === 1) return parts[0];
  const lastInitial = parts[parts.length - 1][0].toUpperCase();
  return `${parts[0]} ${lastInitial}.`;
}
