import { CircleAlert } from 'lucide-react';
import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

interface FieldShellProps {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  children: ReactNode;
  className?: string;
}

function FieldShell({ id, label, hint, error, optional, children, className }: FieldShellProps) {
  return (
    <div className={['field', error && 'field--invalid', className].filter(Boolean).join(' ')}>
      <label className="field__label" htmlFor={id}>
        {label}
        {optional && <span className="field__optional"> (opcional)</span>}
      </label>
      {children}
      {error ? (
        <p className="field__error" id={`${id}-error`} role="alert">
          <CircleAlert size={15} aria-hidden />
          <span>{error}</span>
        </p>
      ) : (
        hint && (
          <p className="field__hint" id={`${id}-hint`}>
            {hint}
          </p>
        )
      )}
    </div>
  );
}

function describedBy(id: string, error?: string, hint?: ReactNode) {
  if (error) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label: string;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  prefix?: string;
  suffix?: string;
  onValueChange: (value: string) => void;
  fieldClassName?: string;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, hint, error, optional, prefix, suffix, onValueChange, fieldClassName, id: idProp, ...rest },
  ref,
) {
  const auto = useId();
  const id = idProp ?? auto;
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} optional={optional} className={fieldClassName}>
      <div className="control">
        {prefix && (
          <span className="control__affix" aria-hidden>
            {prefix}
          </span>
        )}
        <input
          ref={ref}
          id={id}
          className="control__input"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, error, hint)}
          onChange={(e) => onValueChange(e.target.value)}
          {...rest}
        />
        {suffix && (
          <span className="control__affix control__affix--end" aria-hidden>
            {suffix}
          </span>
        )}
      </div>
    </FieldShell>
  );
});

type MoneyFieldProps = Omit<TextFieldProps, 'prefix' | 'inputMode' | 'type'>;

export const MoneyField = forwardRef<HTMLInputElement, MoneyFieldProps>(function MoneyField(props, ref) {
  return <TextField ref={ref} prefix="$" inputMode="decimal" autoComplete="off" placeholder="0.00" {...props} />;
});

interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  label: string;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  onValueChange: (value: string) => void;
  children: ReactNode;
  fieldClassName?: string;
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(
  { label, hint, error, optional, onValueChange, children, fieldClassName, id: idProp, ...rest },
  ref,
) {
  const auto = useId();
  const id = idProp ?? auto;
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} optional={optional} className={fieldClassName}>
      <div className="control control--select">
        <select
          ref={ref}
          id={id}
          className="control__input"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, error, hint)}
          onChange={(e) => onValueChange(e.target.value)}
          {...rest}
        >
          {children}
        </select>
      </div>
    </FieldShell>
  );
});

interface TextAreaFieldProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
  label: string;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  onValueChange: (value: string) => void;
  fieldClassName?: string;
}

export function TextAreaField({ label, hint, error, optional, onValueChange, fieldClassName, id: idProp, ...rest }: TextAreaFieldProps) {
  const auto = useId();
  const id = idProp ?? auto;
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} optional={optional} className={fieldClassName}>
      <div className="control control--textarea">
        <textarea
          id={id}
          rows={3}
          className="control__input"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, error, hint)}
          onChange={(e) => onValueChange(e.target.value)}
          {...rest}
        />
      </div>
    </FieldShell>
  );
}

/** Resumen de errores para lectores de pantalla y para orientar al usuario. */
export function FormErrorSummary({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <div className="form-error-summary" role="alert">
      <CircleAlert size={18} aria-hidden />
      <span>{count === 1 ? 'Revisa el campo marcado.' : `Revisa los ${count} campos marcados.`}</span>
    </div>
  );
}
