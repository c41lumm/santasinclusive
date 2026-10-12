/** Line icons from the designs. Decorative: the text next to each one says what it means. */
const base = { width: 28, height: 28, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8,
  strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
type P = { size?: number; color?: string };
const props = ({ size = 28, color = '#067E3E' }: P) => ({ ...base, width: size, height: size, style: { color, flex: 'none' as const } });

export const Calendar = (p: P) => <svg {...props(p)}><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M8 3v4M16 3v4M3 10h18" /></svg>;
export const Pin = (p: P) => <svg {...props(p)}><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>;
export const Gift = (p: P) => <svg {...props(p)}><rect x="3" y="8" width="18" height="13" rx="2" /><path d="M12 8v13M3 12.5h18M12 8c-2-4-6-4-6-1.5S10 8 12 8zm0 0c2-4 6-4 6-1.5S14 8 12 8z" /></svg>;
export const Family = (p: P) => <svg {...props(p)}><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.4" /><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6M15 14.5c3 0 6 1.5 6 5" /></svg>;
export const Heart = (p: P) => <svg {...props(p)}><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" /></svg>;
export const Sparkle = (p: P) => <svg {...props(p)}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /></svg>;
export const Clock = (p: P) => <svg {...props(p)}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
export const Check = (p: P) => <svg {...props(p)}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
export const Bell = (p: P) => <svg {...props(p)}><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z" /><path d="M10 20a2 2 0 0 0 4 0" /></svg>;
export const Map = (p: P) => <svg {...props(p)}><path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z" /><path d="M9 4v14M15 6v14" /></svg>;
export const QuoteMark = () => (
  <svg className="quote-mark" width="40" height="32" viewBox="0 0 40 32" aria-hidden="true">
    <path d="M0 32V19C0 8 6 1.5 16 0l2 5c-6 2-9 6-9 11h7v16H0zm22 0V19c0-11 6-17.5 16-19l2 5c-6 2-9 6-9 11h7v16H22z" fill="#DE000C" fillOpacity="0.85" />
  </svg>
);
