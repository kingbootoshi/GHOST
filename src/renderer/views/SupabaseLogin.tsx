import React, { useEffect } from 'react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { useSupabase } from '../components/SupabaseProvider';

interface SupabaseLoginProps {
  onAuthenticated: () => void;
}

export function SupabaseLogin({ onAuthenticated }: SupabaseLoginProps) {
  const supabase = useSupabase();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_evt, session) => {
      if (session) {
        console.log('Supabase auth successful');
        onAuthenticated();
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase, onAuthenticated]);

  return (
    <div className="h-screen flex items-center justify-center bg-gray-100">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold text-center mb-6">Login to GHOST</h1>
        <Auth 
          supabaseClient={supabase} 
          appearance={{ theme: ThemeSupa }} 
          providers={[]} 
          redirectTo={undefined}
        />
      </div>
    </div>
  );
}