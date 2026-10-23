'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { audit } from '@/lib/audit';
import { requireAuthorizedUser } from '@/lib/auth/session';
import { updateProfilePreferences } from '@/lib/db/queries';
import { isValidTimeZone } from '@/lib/i18n/format';

export type ProfileFormState = {
  status: 'idle' | 'saved' | 'error';
  field?: 'displayName' | 'timeZone';
  /** Echo of the submitted values: React resets the form after an action, so
   * the fields re-render from these instead of losing the user's input. */
  values?: { displayName: string; timeZone: string };
};

const schema = z.object({
  displayName: z
    .string()
    .trim()
    .max(100)
    .transform((value) => (value === '' ? null : value)),
  timeZone: z.string().trim().min(1).max(64).refine(isValidTimeZone),
});

export async function updateProfileAction(
  _previous: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const auth = await requireAuthorizedUser();
  const values = {
    displayName: String(formData.get('displayName') ?? '').slice(0, 200),
    timeZone: String(formData.get('timeZone') ?? '').slice(0, 200),
  };
  const parsed = schema.safeParse(values);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0] === 'timeZone' ? 'timeZone' : 'displayName';
    return { status: 'error', field, values };
  }
  const result = await updateProfilePreferences(auth, {
    display_name: parsed.data.displayName,
    time_zone: parsed.data.timeZone,
  });
  if (!result.ok) return { status: 'error', values };
  await audit({
    userId: auth.userId,
    actor: 'user',
    eventType: 'settings.profile_updated',
    metadata: { fields: ['display_name', 'time_zone'] },
  });
  revalidatePath('/', 'layout');
  return { status: 'saved', values };
}
