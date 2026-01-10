import type { HTMLAttributes, ReactNode } from 'react';
import { Icon, type IconName } from '@/components/ui/icon/icon';

type LabelSize = 'large' | 'regular' | 'small';
type LabelTone =
  | 'primary'
  | 'muted'
  | 'neutral'
  | 'layer00'
  | 'layer01'
  | 'layer02'
  | 'success'
  | 'green'
  | 'danger'
  | 'red';

type LabelProps = HTMLAttributes<HTMLDivElement> & {
  size?: LabelSize;
  tone?: LabelTone;
  leftIcon?: IconName;
  rightIcon?: IconName;
  children?: ReactNode;
};

const sizeStyles: Record<LabelSize, { container: string; icon: number }> = {
  large: { container: 'h-10 px-4 text-sm gap-2.5', icon: 28 },
  regular: { container: 'h-8 px-2 text-xs gap-2', icon: 24 },
  small: { container: 'h-6 px-2 text-xs gap-1.5', icon: 16 },
};

const toneStyles: Record<LabelTone, string> = {
  primary: 'bg-primary text-foreground',
  muted: 'bg-muted-primary text-foreground',
  neutral: 'bg-layer02 text-foreground',
  layer00: 'bg-layer00 text-foreground',
  layer01: 'bg-layer01 text-foreground',
  layer02: 'bg-layer02 text-foreground',
  success: 'bg-success text-foreground',
  green: 'bg-green text-foreground',
  danger: 'bg-danger text-foreground',
  red: 'bg-red text-foreground',
};

export function Label({
  size = 'small',
  tone = 'neutral',
  leftIcon,
  rightIcon,
  className,
  children,
  ...props
}: LabelProps) {
  const sizeConfig = sizeStyles[size];

  return (
    <div
      className={`inline-flex items-center justify-center rounded-full font-medium transition ${sizeConfig.container} ${
        toneStyles[tone]
      } ${className ?? ''}`}
      {...props}
    >
      {leftIcon ? <Icon name={leftIcon} size={sizeConfig.icon} aria-hidden /> : null}
      {children ? <span>{children}</span> : null}
      {rightIcon ? <Icon name={rightIcon} size={sizeConfig.icon} aria-hidden /> : null}
    </div>
  );
}
