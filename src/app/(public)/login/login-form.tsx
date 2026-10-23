'use client';

import { useActionState } from 'react';

import { ui } from '@/components/styles';
import type { Dictionary } from '@/lib/i18n/dictionaries';

import { loginAction } from './actions';
import { INITIAL_LOGIN_STATE } from './state';

type LoginStrings = Dictionary['login'];

export function LoginForm({ t, next }: { t: LoginStrings; next: string }) {
  const [state, formAction, pending] = useActionState(loginAction, INITIAL_LOGIN_STATE);
  const isError = state.message !== null && state.message !== 'codeSent';

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={next} />
      {state.step === 'email' ? (
        <>
          <label className="block">
            <span className={ui.fieldLabel}>{t.email}</span>
            <input
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              required
              defaultValue={state.email}
              className={ui.input}
            />
          </label>
          <button
            type="submit"
            name="intent"
            value="request"
            disabled={pending}
            className={ui.buttonPrimary}
          >
            {t.sendCode}
          </button>
        </>
      ) : (
        <>
          <input type="hidden" name="email" value={state.email} />
          <label className="block">
            <span className={ui.fieldLabel}>{t.code}</span>
            <input
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={10}
              required
              autoFocus
              className={`${ui.input} tracking-[0.3em]`}
            />
          </label>
          <button
            type="submit"
            name="intent"
            value="verify"
            disabled={pending}
            className={ui.buttonPrimary}
          >
            {t.verify}
          </button>
          <button
            type="submit"
            name="intent"
            value="reset"
            disabled={pending}
            formNoValidate
            className="text-accent text-callout min-h-11 w-full font-medium"
          >
            {t.useDifferentEmail}
          </button>
        </>
      )}
      <p
        role={isError ? 'alert' : 'status'}
        aria-live="polite"
        className={`text-subhead min-h-5 px-1 ${isError ? 'text-danger' : 'text-fg-muted'}`}
      >
        {state.message ? t[state.message] : null}
      </p>
    </form>
  );
}
