import type { ReactNode } from 'react';

type SectionHeaderProps = {
  title: string;
  rightSlot?: ReactNode;
};

export function SectionHeader({ title, rightSlot }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <h3 className="text-base font-medium text-foreground">{title}</h3>
      {rightSlot}
    </div>
  );
}
