import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { Onboarding } from './views/Onboarding';
import { Unlock } from './views/Unlock';
import { Chat } from './views/Chat';
import './index.css';
import { AuthState } from '../types';

type AppView = 'loading' | 'onboarding' | 'unlock' | 'chat';

function App() {
  const [currentView, setCurrentView] = useState<AppView>('loading');
  const [authState, setAuthState] = useState<AuthState | null>(null);

  useEffect(() => {
    checkAuthState();
  }, []);

  const checkAuthState = async () => {
    try {
      const state = await window.ghost.getAuthState();
      setAuthState(state);
      
      if (state.isFirstRun) {
        setCurrentView('onboarding');
      } else if (!state.isUnlocked) {
        setCurrentView('unlock');
      } else {
        setCurrentView('chat');
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
    setCurrentView('chat');
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
      {currentView === 'chat' && (
        <Chat onLock={handleLocked} />
      )}
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);