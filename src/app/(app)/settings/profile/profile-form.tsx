'use client';

import { useActionState } from 'react';

import type { Dictionary } from '@/lib/i18n/dictionaries';

import { updateProfileAction, type ProfileFormState } from './actions';

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
        <div className="bg-cell [&>label+label]:border-separator overflow-hidden rounded-[10px] [&>label+label]:border-t-[0.5px]">
          <label className="flex min-h-11 items-center gap-3 px-4">
            <span className="w-32 shrink-0 text-[17px]">{t.displayName}</span>
            <input
              name="displayName"
              defaultValue={state.values?.displayName ?? displayName}
              maxLength={100}
              autoComplete="name"
              className="min-w-0 flex-1 bg-transparent py-2.5 text-right outline-none"
            />
          </label>
          <label className="flex min-h-11 items-center gap-3 px-4">
            <span className="w-32 shrink-0 text-[17px]">{t.timeZone}</span>
            <input
              name="timeZone"
              defaultValue={state.values?.timeZone ?? timeZone}
              maxLength={64}
              autoCapitalize="none"
              spellCheck={false}
              className="min-w-0 flex-1 bg-transparent py-2.5 text-right outline-none"
            />
          </label>
        </div>
        <p className="text-secondary-label px-4 pt-1.5 text-[13px]">
          {t.displayNameHint} {t.timeZoneHint}
        </p>
      </section>
      <button
        type="submit"
        disabled={pending}
        className="bg-tint min-h-[50px] w-full rounded-[12px] text-[17px] font-semibold text-white disabled:opacity-50"
      >
        {common.save}
      </button>
      <p
        role={state.status === 'error' ? 'alert' : 'status'}
        className={`min-h-5 text-center text-[13px] ${state.status === 'error' ? 'text-destructive' : 'text-success'}`}
      >
        {message}
      </p>
    </form>
  );
}
