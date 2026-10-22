import { Search, X } from 'lucide-react';
import { useId, useRef, type KeyboardEvent } from 'react';

interface Option<T extends string> {
  value: T;
  label: string;
  count?: number;
}

/** Control segmentado (vistas excluyentes). Navegable con flechas. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: KeyboardEvent, index: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = (index + (e.key === 'ArrowRight' ? 1 : -1) + options.length) % options.length;
    onChange(options[next]!.value);
    refs.current[next]?.focus();
  };
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o, i) => {
        const checked = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            className={`segmented__item${checked ? ' is-selected' : ''}`}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKey(e, i)}
          >
            {o.label}
            {o.count !== undefined && <span className="segmented__count num">{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Filtros como fichas que se acomodan en varias líneas (sin desplazamiento horizontal). */
export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="chips" role="group" aria-label={label}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={selected}
            className={`chip${selected ? ' is-selected' : ''}`}
            onClick={() => onChange(o.value)}
          >
            {o.label}
            {o.count !== undefined && <span className="chip__count num">{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  label: string;
}) {
  const id = useId();
  return (
    <div className="search" role="search">
      <label htmlFor={id} className="visually-hidden">
        {label}
      </label>
      <Search size={18} aria-hidden className="search__icon" />
      <input
        id={id}
        type="search"
        className="search__input"
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        enterKeyHint="search"
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button type="button" className="search__clear" aria-label="Borrar búsqueda" onClick={() => onChange('')}>
          <X size={16} aria-hidden />
        </button>
      )}
    </div>
  );
}
