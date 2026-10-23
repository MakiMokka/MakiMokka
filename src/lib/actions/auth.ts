'use server';

import { redirect } from 'next/navigation';

import { audit } from '@/lib/audit';
import { getAuthContext } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/** Sign out this device ("local") or every session of the user ("global"). */
export async function signOutAction(formData: FormData): Promise<void> {
  const scope = formData.get('scope') === 'global' ? 'global' : 'local';
  const auth = await getAuthContext();
  const supabase =
    auth.status === 'authorized' ? auth.supabase : await createSupabaseServerClient();
  if (auth.status === 'authorized') {
    await audit({
      userId: auth.userId,
      actor: 'user',
      eventType: scope === 'global' ? 'auth.sign_out_everywhere' : 'auth.sign_out',
      metadata: { scope },
    });
  }
  await supabase.auth.signOut({ scope });
  redirect('/login');
}
