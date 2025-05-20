import React, { useState } from 'react';
import { useModules } from '../hooks/useModules';
import { ModuleHost } from '../components/ModuleHost';

export const Dashboard: React.FC = () => {
  const { modules } = useModules();
  const [active, setActive] = useState<string | null>(null);

  // Activate first module automatically when list loads
  React.useEffect(() => {
    if (!active && modules.length) {
      setActive(modules[0].id);
    }
  }, [modules, active]);

  return (
    <div className="dashboard-root" style={{ display: 'flex', height: '100vh' }}>
      {/* Sidebar */}
      <aside
        style={{
          width: 200,
          borderRight: '1px solid var(--border-color, #444)',
          padding: 8,
          boxSizing: 'border-box',
        }}
      >
        {modules.map((m) => (
          <button
            key={m.id}
            style={{
              display: 'block',
              width: '100%',
              padding: '8px 12px',
              marginBottom: 4,
              textAlign: 'left',
              background: active === m.id ? 'var(--accent-color, #555)' : 'transparent',
              color: 'inherit',
              border: 'none',
              cursor: 'pointer',
            }}
            onClick={() => setActive(m.id)}
          >
            <span style={{ marginRight: 6 }}>{m.icon}</span>
            {m.title}
          </button>
        ))}
      </aside>

      {/* Content */}
      <main style={{ flex: 1, overflow: 'auto' }}>
        {active ? <ModuleHost moduleId={active} /> : <p>Select a module…</p>}
      </main>
    </div>
  );
}; 