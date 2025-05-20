/// <reference types="vite/client" />
// src/renderer/components/ModuleHost.tsx
import React, { Suspense } from 'react';

/* 1. Compile-time map of UI entry points */
const moduleUiMap = import.meta.glob(
  '/src/modules/*/ui.tsx'
) as Record<string, () => Promise<{ default: React.ComponentType<any> }>>;

/* 2. Helper */
function loadUi(moduleId: string) {
  const importer = moduleUiMap[`/src/modules/${moduleId}/ui.tsx`];
  if (!importer) throw new Error(`UI not found for "${moduleId}"`);
  return importer;            // () => Promise<{ default: Comp }>
}

export const ModuleHost: React.FC<{ moduleId: string }> = ({ moduleId }) => {
  const LazyComp = React.lazy(loadUi(moduleId));   // ✅ Pass loader directly
  return (
    <Suspense fallback={<div style={{ padding: 16 }}>Loading…</div>}>
      <LazyComp />
    </Suspense>
  );
};
