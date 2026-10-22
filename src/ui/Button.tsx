import type { LucideIcon } from 'lucide-react';
import { forwardRef, type AnchorHTMLAttributes, type ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'tinted' | 'plain' | 'destructive';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'md' | 'lg';
  icon?: LucideIcon;
  block?: boolean;
}

export function buttonClass(variant: ButtonVariant = 'secondary', size: 'md' | 'lg' = 'md', block = false, extra = '') {
  return ['btn', `btn--${variant}`, size === 'lg' && 'btn--lg', block && 'btn--block', extra].filter(Boolean).join(' ');
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon: Icon, block, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} className={buttonClass(variant, size, block, className)} {...rest}>
      {Icon && <Icon size={18} aria-hidden />}
      <span>{children}</span>
    </button>
  );
});

interface LinkButtonProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: ButtonVariant;
  icon?: LucideIcon;
}

export function LinkButton({ variant = 'plain', icon: Icon, className, children, ...rest }: LinkButtonProps) {
  return (
    <a className={buttonClass(variant, 'md', false, className)} {...rest}>
      {Icon && <Icon size={18} aria-hidden />}
      <span>{children}</span>
    </a>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  label: string;
  variant?: 'plain' | 'filled';
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon: Icon, label, variant = 'plain', className, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={['icon-btn', `icon-btn--${variant}`, className].filter(Boolean).join(' ')}
      {...rest}
    >
      <Icon size={20} aria-hidden />
    </button>
  );
});
