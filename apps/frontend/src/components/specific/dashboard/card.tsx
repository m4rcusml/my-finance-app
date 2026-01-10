import type { ReactNode } from 'react';

type CardProps = {
  children: ReactNode;
  className?: string;
};

export function Card({ children, className }: CardProps) {
  return (
    <div
      className={`rounded-3xl border border-foreground/10 shadow-2xl shadow-layer00/60 ${className ?? 'bg-layer01'}`}
    >
      {children}
    </div>
  );
}
