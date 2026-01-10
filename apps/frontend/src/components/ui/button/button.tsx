import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon, type IconName } from '@/components/ui/icon/icon';

type ButtonSize = 'xLarge' | 'large' | 'regular';
type ButtonTone =
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

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: ButtonSize;
  tone?: ButtonTone;
  leftIcon?: IconName;
  rightIcon?: IconName;
  children?: ReactNode;
};

const sizeStyles: Record<ButtonSize, { container: string; icon: number }> = {
  xLarge: { container: 'h-12 px-4 text-md gap-3', icon: 32 },
  large: { container: 'h-10 px-4 text-sm gap-2.5', icon: 28 },
  regular: { container: 'h-8 px-2 text-xs gap-2', icon: 24 },
};

const toneStyles: Record<ButtonTone, string> = {
  primary: 'bg-primary text-foreground hover:bg-muted-primary',
  muted: 'bg-muted-primary text-foreground hover:bg-primary',
  neutral: 'bg-layer02 text-foreground hover:bg-layer01',
  layer00: 'bg-layer00 text-foreground hover:bg-layer01',
  layer01: 'bg-layer01 text-foreground hover:bg-layer02',
  layer02: 'bg-layer02 text-foreground hover:bg-layer01',
  success: 'bg-success text-foreground hover:brightness-110',
  green: 'bg-green text-foreground hover:brightness-110',
  danger: 'bg-danger text-foreground hover:brightness-110',
  red: 'bg-red text-foreground hover:brightness-110',
};

export function Button({
  size = 'large',
  tone = 'primary',
  leftIcon,
  rightIcon,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  const sizeConfig = sizeStyles[size];

  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center rounded-full font-medium transition ${sizeConfig.container} ${
        toneStyles[tone]
      } ${disabled ? 'cursor-not-allowed opacity-60' : ''} ${className ?? ''}`}
      disabled={disabled}
      {...props}
    >
      {leftIcon ? <Icon name={leftIcon} size={sizeConfig.icon} aria-hidden /> : null}
      {children ? <span>{children}</span> : null}
      {rightIcon ? <Icon name={rightIcon} size={sizeConfig.icon} aria-hidden /> : null}
    </button>
  );
}
