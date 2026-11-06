export const resolvePersonnelPhotoUrl = (filePath?: string | null): string => {
  const normalized = String(filePath || '').trim();
  if (!normalized) return '';
  if (/^(data:image\/|blob:|https?:\/\/|file:\/\/)/i.test(normalized)) {
    return normalized;
  }
  return `file:///${encodeURI(normalized.replace(/\\/g, '/').replace(/^\/+/, ''))}`;
};

export const getPersonnelPhotoFallbackText = (name?: string | null): string => {
  const normalized = String(name || '').trim();
  if (!normalized) return '人';
  const chars = Array.from(normalized);
  return chars.slice(Math.max(chars.length - 2, 0)).join('');
};
