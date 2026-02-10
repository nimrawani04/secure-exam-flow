export const DEFAULT_ACCENT_HEX = '#1fb3a1';

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

export const setAccentFromHex = (hex: string) => {
  const hsl = hexToHslString(hex);
  if (!hsl) return false;
  const root = document.documentElement;
  root.style.setProperty('--accent', hsl);
  root.style.setProperty('--ring', hsl);

  const [h, s] = hsl.split(' ');
  root.style.setProperty('--dashboard-bg', `${h} ${s} 98%`);
  root.style.setProperty('--dashboard-bg-dark', `${h} ${s} 12%`);

  localStorage.setItem('accent-color', hex);
  return true;
};

export const applyStoredAccent = () => {
  if (typeof window === 'undefined') return;
  const stored = localStorage.getItem('accent-color') || DEFAULT_ACCENT_HEX;
  setAccentFromHex(stored);
};

export const getContrastText = (hex: string) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return '#ffffff';
  const { r, g, b } = rgb;
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.6 ? '#0b1220' : '#ffffff';
};
