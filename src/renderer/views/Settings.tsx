import React, { useState, useEffect } from 'react';
import { useSupabaseAuth } from '../hooks/useSupabaseAuth';
import { SupabaseLogin } from './SupabaseLogin';

interface SettingsState {
  supabaseEnabled: boolean;
}

interface SyncStatus {
  enabled: boolean;
  lastSyncedAt: number | null;
  pendingBytes: number;
}

export const Settings: React.FC = () => {
  const [settings, setSettings] = useState<SettingsState>({
    supabaseEnabled: false
  });
  const [showSupabaseLogin, setShowSupabaseLogin] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [syncing, setSyncing] = useState(false);
  const { user, signOut, session } = useSupabaseAuth();

  useEffect(() => {
    // Load settings from localStorage
    const savedSettings = localStorage.getItem('ghost-settings');
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings));
    }
    
    // Check sync status
    window.ghost.getSyncStatus().then(setSyncStatus);
  }, []);

  const handleToggleSupabase = async () => {
    if (!session?.access_token) return;
    
    setSyncing(true);
    const newValue = !settings.supabaseEnabled;
    
    try {
      if (newValue) {
        // Enable sync
        const result = await window.ghost.enableSync(session.access_token);
        if (result.success) {
          const newSettings = { ...settings, supabaseEnabled: newValue };
          setSettings(newSettings);
          localStorage.setItem('ghost-settings', JSON.stringify(newSettings));
          const status = await window.ghost.getSyncStatus();
          setSyncStatus(status);
        } else {
          console.error('Failed to enable sync:', result.error);
        }
      } else {
        // Disable sync
        const result = await window.ghost.disableSync();
        if (result.success) {
          const newSettings = { ...settings, supabaseEnabled: newValue };
          setSettings(newSettings);
          localStorage.setItem('ghost-settings', JSON.stringify(newSettings));
          const status = await window.ghost.getSyncStatus();
          setSyncStatus(status);
        }
      }
    } catch (error) {
      console.error('Sync toggle error:', error);
    } finally {
      setSyncing(false);
    }
  };

  const handleLoginClick = () => {
    setShowSupabaseLogin(true);
  };

  const handleLogout = async () => {
    await signOut();
    // Disable Supabase sync on logout
    const newSettings = { ...settings, supabaseEnabled: false };
    setSettings(newSettings);
    localStorage.setItem('ghost-settings', JSON.stringify(newSettings));
  };

  const handleSupabaseLoginComplete = () => {
    // After successful login, enable the setting
    const newSettings = { ...settings, supabaseEnabled: true };
    setSettings(newSettings);
    localStorage.setItem('ghost-settings', JSON.stringify(newSettings));
    setShowSupabaseLogin(false);
  };

  if (showSupabaseLogin) {
    return (
      <div className="settings-container">
        <div className="settings-header">
          <button 
            onClick={() => setShowSupabaseLogin(false)}
            className="back-button"
          >
            ← Back to Settings
          </button>
        </div>
        <SupabaseLogin onAuthenticated={handleSupabaseLoginComplete} />
      </div>
    );
  }

  return (
    <div className="settings-container">
      <h1>Settings</h1>
      
      <section className="settings-section">
        <h2>Sync & Backup</h2>
        
        <div className="setting-item">
          <div className="setting-info">
            <h3>Supabase Account</h3>
            <p>Connect your Supabase account for cloud sync</p>
            {user && (
              <p className="setting-status">Logged in as: {user.email}</p>
            )}
          </div>
          
          {!user ? (
            <button 
              onClick={handleLoginClick}
              className="settings-button primary"
            >
              Login with Supabase
            </button>
          ) : (
            <button 
              onClick={handleLogout}
              className="settings-button secondary"
            >
              Logout
            </button>
          )}
        </div>

        {user && (
          <div className="setting-item">
            <div className="setting-info">
              <h3>Enable Sync</h3>
              <p>Sync your data across devices with PowerSync</p>
              {syncStatus && syncStatus.enabled && (
                <p className="setting-status">
                  {syncStatus.lastSyncedAt 
                    ? `Last synced: ${new Date(syncStatus.lastSyncedAt).toLocaleString()}`
                    : 'Sync pending...'
                  }
                </p>
              )}
            </div>
            
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={syncStatus?.enabled || false}
                onChange={handleToggleSupabase}
                disabled={syncing}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
        )}
      </section>

      <section className="settings-section">
        <h2>Module Settings</h2>
        <p className="settings-note">
          Module-specific settings will appear here when modules are installed.
        </p>
      </section>
    </div>
  );
};