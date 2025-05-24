import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  // Vite exposes env vars that start with `VITE_` via `import.meta.env`.
  // Cast to string because these are defined at build-time.
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string
);