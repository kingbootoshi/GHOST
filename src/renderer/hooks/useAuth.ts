import { useState, useEffect, useCallback } from 'react';
import { AuthState } from '../../types';

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshAuthState = useCallback(async () => {
    try {
      const state = await window.ghost.getAuthState();
      setAuthState(state);
    } catch (error) {
      console.error('Failed to get auth state:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshAuthState();
  }, [refreshAuthState]);

  return {
    authState,
    loading,
    refreshAuthState,
  };
}