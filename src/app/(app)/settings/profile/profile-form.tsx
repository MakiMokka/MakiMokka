'use client';

import { useActionState } from 'react';

import type { Dictionary } from '@/lib/i18n/dictionaries';

import { updateProfileAction, type ProfileFormState } from './actions';
import { ui } from '@/components/styles';

const INITIAL: ProfileFormState = { status: 'idle' };

export function ProfileForm({
  t,
  common,
  displayName,
  timeZone,
}: {
  t: Dictionary['profile'];
  common: Dictionary['common'];
  displayName: string;
  timeZone: string;
}) {
  const [state, action, pending] = useActionState(updateProfileAction, INITIAL);
  const message =
    state.status === 'saved'
      ? common.saved
      : state.status === 'error'
        ? state.field === 'timeZone'
          ? t.invalidTimeZone
          : state.field === 'displayName'
            ? t.invalidDisplayName
            : common.saveError
        : null;

  return (
    <form action={action} className="space-y-6">
      <section>
        <div className="surface-reading rounded-container [&>label+label]:border-line overflow-hidden [&>label+label]:border-t-[0.5px]">
          <label className="flex min-h-12 items-center gap-3 px-4">
            <span className="text-body text-fg w-32 shrink-0">{t.displayName}</span>
            <input
              name="displayName"
              defaultValue={state.values?.displayName ?? displayName}
              maxLength={100}
              autoComplete="name"
              className="text-fg min-w-0 flex-1 bg-transparent py-3 text-right outline-none"
            />
          </label>
          <label className="flex min-h-12 items-center gap-3 px-4">
            <span className="text-body text-fg w-32 shrink-0">{t.timeZone}</span>
            <input
              name="timeZone"
              defaultValue={state.values?.timeZone ?? timeZone}
              maxLength={64}
              autoCapitalize="none"
              spellCheck={false}
              className="text-fg min-w-0 flex-1 bg-transparent py-3 text-right outline-none"
            />
          </label>
        </div>
        <p className={ui.footnote}>
          {t.displayNameHint} {t.timeZoneHint}
        </p>
      </section>
      <button type="submit" disabled={pending} className={ui.buttonPrimary}>
        {common.save}
      </button>
      <p
        role={state.status === 'error' ? 'alert' : 'status'}
        className={`text-subhead min-h-5 text-center ${state.status === 'error' ? 'text-danger' : 'text-success'}`}
      >
        {message}
      </p>
    </form>
  );
}
