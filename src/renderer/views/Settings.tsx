import React, { useState, useEffect } from 'react';
import { useSupabaseAuth } from '../hooks/useSupabaseAuth';
import { SupabaseLogin } from './SupabaseLogin';

interface Settings {
  supabaseEnabled: boolean;
}

export const Settings: React.FC = () => {
  const [settings, setSettings] = useState<Settings>({
    supabaseEnabled: false
  });
  const [showSupabaseLogin, setShowSupabaseLogin] = useState(false);
  const { user, signOut } = useSupabaseAuth();

  useEffect(() => {
    // Load settings from localStorage
    const savedSettings = localStorage.getItem('ghost-settings');
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings));
    }
  }, []);

  const handleToggleSupabase = () => {
    const newValue = !settings.supabaseEnabled;
    // Update settings
    const newSettings = { ...settings, supabaseEnabled: newValue };
    setSettings(newSettings);
    localStorage.setItem('ghost-settings', JSON.stringify(newSettings));
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
            </div>
            
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={settings.supabaseEnabled}
                onChange={handleToggleSupabase}
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