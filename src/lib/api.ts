export const API_BASE = import.meta.env.VITE_API_BASE || '';

export function toApi(urlOrPath: string): string {
  if (!API_BASE) {
    // Fallback to direct Spotify API in case env isn't set
    if (urlOrPath.startsWith('https://api.spotify.com/v1/')) return urlOrPath;
    if (urlOrPath.startsWith('/')) return `https://api.spotify.com/v1${urlOrPath}`;
    return `https://api.spotify.com/v1/${urlOrPath}`;
  }

  if (urlOrPath.startsWith('https://api.spotify.com/v1/')) {
    return `${API_BASE}/api/spotify/${urlOrPath.slice('https://api.spotify.com/v1/'.length)}`;
  }
  if (urlOrPath.startsWith('/')) {
    return `${API_BASE}/api/spotify${urlOrPath}`;
  }
  if (!urlOrPath.startsWith('http')) {
    return `${API_BASE}/api/spotify/${urlOrPath}`;
  }
  return urlOrPath;
}
