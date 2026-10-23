'use client';

import { useActionState } from 'react';

import type { Dictionary } from '@/lib/i18n/dictionaries';

import { loginAction } from './actions';
import { INITIAL_LOGIN_STATE } from './state';

type LoginStrings = Dictionary['login'];

const inputClass =
  'bg-cell w-full rounded-[10px] px-4 py-3 text-[17px] outline-none placeholder:text-tertiary-label focus-visible:ring-2 focus-visible:ring-tint';
const primaryButton =
  'bg-tint w-full min-h-[50px] rounded-[12px] text-[17px] font-semibold text-white disabled:opacity-50';

export function LoginForm({ t, next }: { t: LoginStrings; next: string }) {
  const [state, formAction, pending] = useActionState(loginAction, INITIAL_LOGIN_STATE);
  const isError = state.message !== null && state.message !== 'codeSent';

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={next} />
      {state.step === 'email' ? (
        <>
          <label className="block">
            <span className="text-secondary-label mb-1.5 block px-1 text-[13px]">{t.email}</span>
            <input
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              required
              defaultValue={state.email}
              className={inputClass}
            />
          </label>
          <button
            type="submit"
            name="intent"
            value="request"
            disabled={pending}
            className={primaryButton}
          >
            {t.sendCode}
          </button>
        </>
      ) : (
        <>
          <input type="hidden" name="email" value={state.email} />
          <label className="block">
            <span className="text-secondary-label mb-1.5 block px-1 text-[13px]">{t.code}</span>
            <input
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={10}
              required
              autoFocus
              className={`${inputClass} tracking-[0.3em]`}
            />
          </label>
          <button
            type="submit"
            name="intent"
            value="verify"
            disabled={pending}
            className={primaryButton}
          >
            {t.verify}
          </button>
          <button
            type="submit"
            name="intent"
            value="reset"
            disabled={pending}
            formNoValidate
            className="text-tint min-h-11 w-full text-[15px]"
          >
            {t.useDifferentEmail}
          </button>
        </>
      )}
      <p
        role={isError ? 'alert' : 'status'}
        aria-live="polite"
        className={`min-h-5 px-1 text-[13px] ${isError ? 'text-destructive' : 'text-secondary-label'}`}
      >
        {state.message ? t[state.message] : null}
      </p>
    </form>
  );
}
