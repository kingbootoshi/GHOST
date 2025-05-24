import { supabase } from './supabaseClient';

export async function fetchWithAuth<T>(
  url: string,
  init: RequestInit = {}
): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('No session');
  const res = await fetch(
    process.env.NEXT_PUBLIC_API_URL + url,
    {
      ...init,
      headers: {
        ...init.headers,
        Authorization: `Bearer ${session.access_token}`,
      },
    }
  );
  if (!res.ok) {
    console.error('API fail', res.status, await res.text());
    throw new Error(res.statusText);
  }
  return res.json();
}