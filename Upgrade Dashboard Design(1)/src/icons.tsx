export type SvgPath = string | string[];

export function Ico({ d, size = 16, stroke = 1.35, color }: { d: SvgPath; size?: number; stroke?: number; color?: string }) {
  const paths = Array.isArray(d) ? d : [d];
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden style={{ color: color ?? 'currentColor', flexShrink: 0 }}>
      {paths.map((p, i) => <path key={i} d={p} stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />)}
    </svg>
  );
}

export const I = {
  doc:     ['M3.5 2h6.5l3 3v9a.5.5 0 01-.5.5h-9a.5.5 0 01-.5-.5V2.5A.5.5 0 013.5 2z', 'M10 2v3.5h3', 'M6 8.5h4M6 11h2.5'],
  users:   ['M6 8a2.5 2.5 0 100-5 2.5 2.5 0 000 5z', 'M1.5 14c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4', 'M11 4a2.5 2.5 0 010 4M13.5 14c0-2-1.2-3.3-2.5-3.7'],
  bell:    ['M8 2a4 4 0 00-4 4v2.5L2.5 11h11L12 8.5V6a4 4 0 00-4-4z', 'M6.5 13.5a1.5 1.5 0 003 0'],
  lock:    ['M3.5 7.5h9v6a.5.5 0 01-.5.5h-8a.5.5 0 01-.5-.5v-6z', 'M5.5 7.5V5.5a2.5 2.5 0 015 0v2'],
  shield:  ['M8 1.5L2.5 4v3.5c0 3.5 2.5 5.8 5.5 7 3-1.2 5.5-3.5 5.5-7V4L8 1.5z', 'M5.5 8.2l1.8 1.8 3.2-3.5'],
  eye:     ['M1.5 8s2.5-5 6.5-5 6.5 5 6.5 5-2.5 5-6.5 5S1.5 8 1.5 8z', 'M8 10a2 2 0 100-4 2 2 0 000 4z'],
  warn:    ['M1.5 13.5L8 2.5l6.5 11H1.5z', 'M8 7v3', 'M8 12v.5'],
  check:   ['M2.5 8.5l4 4 7-8'],
  chevR:   ['M6 4l4 4-4 4'],
  logout:  ['M10 2H4.5A.5.5 0 004 2.5v11a.5.5 0 00.5.5H10', 'M13 8H7.5M11 5.5L13.5 8 11 10.5'],
  sun:     ['M8 11a3 3 0 100-6 3 3 0 000 6z', 'M8 1.5v1M8 13.5v1M1.5 8h1M13.5 8h1M3.4 3.4l.7.7M11.9 11.9l.7.7M3.4 12.6l.7-.7M11.9 4.1l.7-.7'],
  moon:    ['M6.5 2.5A5.5 5.5 0 1013 11 5 5 0 016.5 2.5z'],
  profile: ['M8 9a3.5 3.5 0 100-7 3.5 3.5 0 000 7z', 'M2 14.5c0-3 2.7-5 6-5s6 2 6 5'],
};
