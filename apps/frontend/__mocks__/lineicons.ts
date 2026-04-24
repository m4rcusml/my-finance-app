import React from 'react';

export function Lineicons({ icon, size, ...props }: { icon: unknown; size?: number; [key: string]: unknown }) {
  return React.createElement('span', { 'data-testid': 'lineicon', ...props }, String(icon));
}
