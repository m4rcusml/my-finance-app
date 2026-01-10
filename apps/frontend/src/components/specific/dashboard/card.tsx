import type { ReactNode } from 'react';

type CardProps = {
  children: ReactNode;
  className?: string;
};

export function Card({ children, className }: CardProps) {
  return (
    <div
      className={`rounded-3xl border border-foreground/10 bg-layer01 shadow-2xl shadow-layer00/60 ${
        className ?? ''
      }`}
    >
      {children}
    </div>
  );
}
