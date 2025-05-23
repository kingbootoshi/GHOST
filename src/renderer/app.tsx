import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { Onboarding } from './views/Onboarding';
import { Unlock } from './views/Unlock';
import { Dashboard } from './views/Dashboard';
import { BiometricAuth } from './views/BiometricAuth';
import SupabaseProvider from './components/SupabaseProvider';
import './index.css';
import { AuthState } from '../types';

type AppView = 'loading' | 'onboarding' | 'unlock' | 'biometricAuth' | 'dashboard';

function App() {
  const [currentView, setCurrentView] = useState<AppView>('loading');
  const [authState, setAuthState] = useState<AuthState | null>(null);
  const [bioAttempted, setBioAttempted] = useState(false);

  useEffect(() => {
    checkAuthState();

    // Listen for auto biometric done event sent from the main process.
    const doneHandler = (e: Event) => {
      const detail = (e as CustomEvent<{ success: boolean }>).detail;
      console.debug('[App] auto-bio-done', detail);
      if (detail?.success) {
        setCurrentView('dashboard');
      } else {
        setCurrentView('unlock');
      }
      checkAuthState();
    };

    window.addEventListener('ghost:auto-bio-done', doneHandler);
    return () => window.removeEventListener('ghost:auto-bio-done', doneHandler);
  }, []);

  const checkAuthState = async () => {
    try {
      console.debug('[App] getAuthState()');
      const state = await window.ghost.getAuthState();
      console.debug('[App] AuthState', state);
      setAuthState(state);
      
      if (state.isFirstRun) {
        setCurrentView('onboarding');
      } else if (!state.isUnlocked) {
        if (state.biometricEnabled && !bioAttempted) {
          setCurrentView('biometricAuth');
        } else {
          setCurrentView('unlock');
        }
      } else {
        // After local auth is complete, show the main dashboard
        setCurrentView('dashboard');
      }
    } catch (error) {
      console.error('Failed to check auth state:', error);
      setCurrentView('onboarding');
    }
  };

  const handlePasswordCreated = () => {
    checkAuthState();
  };

  const handleUnlocked = () => {
    setCurrentView('dashboard');
  };

  const handleLocked = () => {
    setCurrentView('unlock');
  };

  if (currentView === 'loading') {
    return (
      <div className="loading-container">
        <h1>GHOST</h1>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="app">
      {currentView === 'onboarding' && (
        <Onboarding onPasswordCreated={handlePasswordCreated} />
      )}
      {currentView === 'unlock' && (
        <Unlock 
          onUnlocked={handleUnlocked}
          canUseBiometric={authState?.canUseBiometric}
          biometricEnabled={authState?.biometricEnabled}
        />
      )}
      {currentView === 'dashboard' && (
        <Dashboard />
      )}
      {currentView === 'biometricAuth' && (
        <BiometricAuth onResult={(success) => {
          // Mark that we've attempted biometric auth for this session
          setBioAttempted(true);
          if (success) {
            setCurrentView('dashboard');
            checkAuthState();
          } else {
            setCurrentView('unlock');
          }
        }} />
      )}
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <SupabaseProvider>
    <App />
  </SupabaseProvider>
);