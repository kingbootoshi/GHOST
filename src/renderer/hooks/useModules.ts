/**
 * React hook that provides convenient access to the module registry exposed by
 * the preload script.  Consumes `window.ghost.listModules` once and keeps the
 * result in state so React components can render a module dashboard.
 */
import { useEffect, useState, useCallback } from 'react';

export interface ModuleMeta {
  id: string;
  title: string;
  icon?: string;
}

/**
 * Returns the list of available modules and an `invoke` helper.
 */
export function useModules() {
  const [modules, setModules] = useState<ModuleMeta[]>([]);

  useEffect(() => {
    let mounted = true;
    // Fetch once on mount
    (async () => {
      try {
        const res = await window.ghost.listModules();
        if (mounted) setModules(res);
      } catch (err) {
        console.error('[useModules] Failed to fetch modules', err);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const invoke = useCallback(
    (moduleId: string, fn: string, args: any) => {
      return window.ghost.invokeModule(moduleId, fn, args);
    },
    []
  );

  return { modules, invoke } as const;
} 