import React, { useState } from 'react';
import { useModules } from '../hooks/useModules';
import { ModuleHost } from '../components/ModuleHost';
import { Settings } from './Settings';

type ViewType = 'module' | 'settings';

export const Dashboard: React.FC = () => {
  const { modules } = useModules();
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const [viewType, setViewType] = useState<ViewType>('module');

  // Activate first module automatically when list loads
  React.useEffect(() => {
    if (!activeModule && modules.length && viewType === 'module') {
      setActiveModule(modules[0].id);
    }
  }, [modules, activeModule, viewType]);

  const handleModuleClick = (moduleId: string) => {
    setActiveModule(moduleId);
    setViewType('module');
  };

  const handleSettingsClick = () => {
    setViewType('settings');
  };

  return (
    <div className="dashboard-root">
      {/* Sidebar */}
      <aside className="dashboard-sidebar">
        <div className="sidebar-section">
          <h3 className="sidebar-title">Modules</h3>
          {modules.map((m) => (
            <button
              key={m.id}
              className={`sidebar-item ${viewType === 'module' && activeModule === m.id ? 'active' : ''}`}
              onClick={() => handleModuleClick(m.id)}
            >
              <span className="sidebar-icon">{m.icon}</span>
              <span className="sidebar-label">{m.title}</span>
            </button>
          ))}
        </div>
        
        <div className="sidebar-section sidebar-bottom">
          <button
            className={`sidebar-item ${viewType === 'settings' ? 'active' : ''}`}
            onClick={handleSettingsClick}
          >
            <span className="sidebar-icon">⚙️</span>
            <span className="sidebar-label">Settings</span>
          </button>
        </div>
      </aside>

      {/* Content */}
      <main className="dashboard-content">
        {viewType === 'settings' ? (
          <Settings />
        ) : activeModule ? (
          <ModuleHost moduleId={activeModule} />
        ) : (
          <div className="empty-state">
            <p>Select a module to get started</p>
          </div>
        )}
      </main>
    </div>
  );
}; 