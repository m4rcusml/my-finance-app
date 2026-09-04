'use client';

import { useId } from 'react';

/**
 * Form primitives with the accessibility wiring built in: every control gets a
 * real `<label for>`, errors are linked through `aria-describedby` and marked
 * `aria-invalid`, and hints are announced rather than being visual-only.
 */

interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: (props: { id: string; describedBy: string | undefined; invalid: boolean }) => React.ReactNode;
}

export function Field({ label, hint, error, required, children }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
        {required ? (
          <span className="ml-1 text-danger-text" aria-hidden="true">
            *
          </span>
        ) : null}
        {required ? <span className="sr-only"> (obrigatório)</span> : null}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-xs font-medium text-danger-text">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const CONTROL_CLASS =
  'min-h-11 w-full rounded-xl border bg-layer02 px-3.5 py-2.5 text-sm text-foreground placeholder:text-placeholder transition hover:border-muted-primary/70 disabled:cursor-not-allowed disabled:opacity-60';

export function controlClassName(invalid?: boolean, extra = ''): string {
  return `${CONTROL_CLASS} ${invalid ? 'border-danger' : 'border-border-strong'} ${extra}`.trim();
}

export function TextInput({
  invalid,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return <input {...props} aria-invalid={invalid || undefined} className={controlClassName(invalid, className)} />;
}

export function Select({
  invalid,
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <select {...props} aria-invalid={invalid || undefined} className={controlClassName(invalid, className)}>
      {children}
    </select>
  );
}

export function TextArea({
  invalid,
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return <textarea {...props} aria-invalid={invalid || undefined} className={controlClassName(invalid, className)} />;
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-foreground hover:bg-muted-primary',
  secondary: 'border border-border-strong bg-layer02 text-foreground hover:bg-layer03',
  ghost: 'text-muted-foreground hover:bg-layer02 hover:text-foreground',
  danger: 'bg-danger text-foreground hover:brightness-110',
};

/**
 * Every button carries a text label or an explicit `aria-label`; the type is
 * enforced at the boundary so an icon-only button can never ship nameless.
 */
export function ActionButton({
  variant = 'primary',
  className,
  children,
  loading,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; loading?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      disabled={props.disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${className ?? ''}`}
    >
      {loading ? (
        <span
          aria-hidden="true"
          className="size-3.5 animate-spin rounded-full border-2 border-current/40 border-t-current"
        />
      ) : null}
      {children}
    </button>
  );
}

export type IconButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Required: this is the button's accessible name. */
  label: string;
  variant?: ButtonVariant;
};

export function IconButton({ label, variant = 'ghost', className, children, ...props }: IconButtonProps) {
  return (
    <button
      type="button"
      {...props}
      aria-label={label}
      title={label}
      className={`inline-flex size-10 items-center justify-center rounded-xl transition disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${className ?? ''}`}
    >
      <span aria-hidden="true" className="flex items-center justify-center">
        {children}
      </span>
    </button>
  );
}
