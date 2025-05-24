import React, { createContext, useContext } from 'react';
import { supabase } from '../lib/supabaseClient';

const Ctx = createContext(supabase);
export const useSupabase = () => useContext(Ctx);

export default function SupabaseProvider({ children }: { children: React.ReactNode }) {
  return <Ctx.Provider value={supabase}>{children}</Ctx.Provider>;
}