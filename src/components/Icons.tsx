import type { SVGProps } from 'react';
const base = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const;
export const HeartIcon = ({ filled, ...p }: SVGProps<SVGSVGElement> & { filled?: boolean }) => (
  <svg {...base} {...p} fill={filled ? 'currentColor' : 'none'}><path d="M20.8 5.6a5.2 5.2 0 0 0-7.4 0L12 7l-1.4-1.4a5.2 5.2 0 0 0-7.4 7.4L12 21.8l8.8-8.8a5.2 5.2 0 0 0 0-7.4z" /></svg>
);
export const SearchIcon = (p: SVGProps<SVGSVGElement>) => <svg {...base} {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>;
export const SunIcon = (p: SVGProps<SVGSVGElement>) => <svg {...base} {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>;
export const MoonIcon = (p: SVGProps<SVGSVGElement>) => <svg {...base} {...p}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>;
export const MenuIcon = (p: SVGProps<SVGSVGElement>) => <svg {...base} {...p}><path d="M4 6h16M4 12h16M4 18h16" /></svg>;
export const DownloadIcon = (p: SVGProps<SVGSVGElement>) => <svg {...base} {...p}><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 21h16" /></svg>;
export const LockIcon = (p: SVGProps<SVGSVGElement>) => <svg {...base} {...p}><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>;
