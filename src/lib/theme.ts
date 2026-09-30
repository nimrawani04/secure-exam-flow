export const DEFAULT_ACCENT_HEX = '#1fb3a1';

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const hexToRgb = (hex: string) => {
  const cleaned = hex.replace('#', '').trim();
  if (cleaned.length === 3) {
    const r = parseInt(cleaned[0] + cleaned[0], 16);
    const g = parseInt(cleaned[1] + cleaned[1], 16);
    const b = parseInt(cleaned[2] + cleaned[2], 16);
    return { r, g, b };
  }
  if (cleaned.length !== 6) return null;
  const r = parseInt(cleaned.slice(0, 2), 16);
  const g = parseInt(cleaned.slice(2, 4), 16);
  const b = parseInt(cleaned.slice(4, 6), 16);
  return { r, g, b };
};

const rgbToHsl = (r: number, g: number, b: number) => {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = (gn - bn) / d + (gn < bn ? 6 : 0);
        break;
      case gn:
        h = (bn - rn) / d + 2;
        break;
      case bn:
        h = (rn - gn) / d + 4;
        break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
};

export const hexToHslString = (hex: string) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const { h, s, l } = rgbToHsl(rgb.r, rgb.g, rgb.b);
  return `${h} ${s}% ${l}%`;
};

const toRgba = (hex: string, alpha: number) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return `rgba(31, 179, 161, ${alpha})`;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
};

const darkenHex = (hex: string, amount = 0.12) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const r = clamp(Math.round(rgb.r * (1 - amount)), 0, 255);
  const g = clamp(Math.round(rgb.g * (1 - amount)), 0, 255);
  const b = clamp(Math.round(rgb.b * (1 - amount)), 0, 255);
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
};

export const getContrastText = (hex: string) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return '#ffffff';
  const { r, g, b } = rgb;
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.6 ? '#0b1220' : '#ffffff';
};

export const getAccentStorageKey = (userId?: string | null) =>
  userId ? `accent-color:${userId}` : 'accent-color';

export const setAccentFromHex = (hex: string, userId?: string | null) => {
  const hsl = hexToHslString(hex);
  if (!hsl) return false;
  const root = document.documentElement;

  // Set HSL variables
  root.style.setProperty('--accent', hsl);
  root.style.setProperty('--ring', hsl);

  // Set Hex & RGBA CSS variables globally on root element
  root.style.setProperty('--accent-color', hex);
  root.style.setProperty('--accent-soft', toRgba(hex, 0.12));
  root.style.setProperty('--accent-ring', toRgba(hex, 0.25));
  root.style.setProperty('--accent-hover', darkenHex(hex, 0.12));
  root.style.setProperty('--accent-contrast', getContrastText(hex));

  const [h, s] = hsl.split(' ');
  root.style.setProperty('--dashboard-bg', `${h} ${s} 96%`);
  root.style.setProperty('--dashboard-bg-dark', `${h} ${s} 12%`);
  root.style.setProperty('--sidebar-primary', hsl);
  root.style.setProperty('--sidebar-ring', hsl);
  root.style.setProperty('--sidebar-accent', `${h} ${s} 22%`);
  root.style.setProperty('--sidebar-border', `${h} ${s} 28%`);

  // Persist both globally and per-user
  localStorage.setItem('accent-color', hex);
  if (userId) {
    localStorage.setItem(getAccentStorageKey(userId), hex);
  }
  return true;
};

export const applyInitialTheme = () => {
  if (typeof window === 'undefined') return;
  const userExplicitDark = localStorage.getItem('theme_user_explicit') === 'dark';
  if (userExplicitDark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
    localStorage.setItem('theme', 'light');
  }
};

export const applyStoredAccent = () => {
  if (typeof window === 'undefined') return;
  const stored = localStorage.getItem('accent-color') || DEFAULT_ACCENT_HEX;
  setAccentFromHex(stored);
};

export const applyStoredAccentForUser = (userId?: string | null) => {
  if (typeof window === 'undefined') return;
  const key = getAccentStorageKey(userId);
  const stored = localStorage.getItem(key) || localStorage.getItem('accent-color') || DEFAULT_ACCENT_HEX;
  setAccentFromHex(stored, userId);
};
