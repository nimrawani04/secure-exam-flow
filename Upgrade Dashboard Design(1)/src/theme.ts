import { createContext, useContext } from 'react';

export const LIGHT = {
  bg:          '#f7f4ef',
  bgHover:     '#ede9e2',
  panel:       '#ffffff',
  panelHover:  '#faf9f7',
  sidebar:     '#ffffff',
  sidebarFoot: '#f7f4ef',
  border:      '#e8e2da',
  borderSoft:  '#f0ece6',
  ink:         '#18202e',
  inkMid:      '#64748b',
  inkDim:      '#a0aec0',
  teal:        '#0d7a6b',
  tealBright:  '#0fa88f',
  tealSoft:    '#eaf6f4',
  tealMid:     'rgba(13,122,107,0.10)',
  amber:       '#92400e',
  amberSoft:   '#fef8ee',
  amberLine:   '#f59e0b',
  rose:        '#9f1239',
  roseSoft:    '#fef2f5',
  roseLine:    '#f43f5e',
  violet:      '#5b21b6',
  violetSoft:  '#f5f3ff',
  violetLine:  '#8b5cf6',
  emerald:     '#065f46',
  emeraldSoft: '#ecfdf5',
  emeraldLine: '#10b981',
  headerBg:    'rgba(247,244,239,0.92)',
};

export const DARK = {
  bg:          '#0c1118',
  bgHover:     '#131c27',
  panel:       '#101820',
  panelHover:  '#141f2c',
  sidebar:     '#0d1420',
  sidebarFoot: '#0a1019',
  border:      '#1c2d3d',
  borderSoft:  '#172130',
  ink:         '#e2eaf4',
  inkMid:      '#6b8299',
  inkDim:      '#3d5166',
  teal:        '#2dd4bf',
  tealBright:  '#5eead4',
  tealSoft:    'rgba(45,212,191,0.08)',
  tealMid:     'rgba(45,212,191,0.14)',
  amber:       '#fbbf24',
  amberSoft:   'rgba(251,191,36,0.08)',
  amberLine:   '#f59e0b',
  rose:        '#fb7185',
  roseSoft:    'rgba(251,113,133,0.08)',
  roseLine:    '#f43f5e',
  violet:      '#a78bfa',
  violetSoft:  'rgba(167,139,250,0.08)',
  violetLine:  '#8b5cf6',
  emerald:     '#34d399',
  emeraldSoft: 'rgba(52,211,153,0.08)',
  emeraldLine: '#10b981',
  headerBg:    'rgba(12,17,24,0.90)',
};

export type Palette = typeof LIGHT;

export const ThemeCtx = createContext<{ T: Palette; dark: boolean; toggle: () => void }>({
  T: LIGHT, dark: false, toggle: () => {},
});

export const useT = () => useContext(ThemeCtx);
