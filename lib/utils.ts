import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function fmtPoints(n: number): string {
  return n.toLocaleString('en-US');
}

export type PositionCode = 'F' | 'D' | 'G' | 'FD';

export function positionLabel(p: PositionCode): string {
  if (p === 'F') return 'Forward';
  if (p === 'D') return 'Defenseman';
  if (p === 'G') return 'Goalie';
  return 'Forward / Defenseman';
}

// Short badge label — keeps 1 char for F/D/G, 2 chars for F/D hybrids.
export function positionBadge(p: PositionCode): string {
  return p === 'FD' ? 'F/D' : p;
}

// Tailwind class fragment for the color-coded position badge.
export function positionBadgeClass(p: PositionCode): string {
  if (p === 'G') return 'bg-amber-500/20 text-amber-300';
  if (p === 'D') return 'bg-sky-500/20 text-sky-300';
  if (p === 'FD') return 'bg-violet-500/20 text-violet-300';
  return 'bg-rose-500/20 text-rose-300';
}
