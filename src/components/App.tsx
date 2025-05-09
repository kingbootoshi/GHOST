import React, { useState, useEffect } from 'react';
import UnlockScreen from './UnlockScreen';
import ChatInterface from './ChatInterface';

/**
 * Main application component
 */
const App: React.FC = () => {
  // Application state
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  // Check if database is already unlocked on startup
  useEffect(() => {
    const checkDatabaseStatus = async () => {
      try {
        const unlocked = await window.electronAPI.isDatabaseUnlocked();
        setIsUnlocked(unlocked);
      } catch (error) {
        console.error('Failed to check database status:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkDatabaseStatus();
  }, []);
  
  // Handle database unlock
  const handleUnlock = async (password: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const success = await window.electronAPI.unlockDatabase(password);
      if (success) {
        setIsUnlocked(true);
      }
      return success;
    } catch (error) {
      console.error('Failed to unlock database:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle Touch ID authentication
  const handleTouchIdAuth = async (): Promise<boolean> => {
    setIsLoading(true);
    try {
      const success = await window.electronAPI.authenticateWithTouchId();
      if (success) {
        setIsUnlocked(true);
      }
      return success;
    } catch (error) {
      console.error('Failed to authenticate with Touch ID:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle database lock
  const handleLock = async () => {
    try {
      await window.electronAPI.lockDatabase();
      setIsUnlocked(false);
    } catch (error) {
      console.error('Failed to lock database:', error);
    }
  };
  
  if (isLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>Loading GHOST...</p>
      </div>
    );
  }
  
  // Render unlock screen or chat interface based on database status
  return (
    <div className="app-container">
      {!isUnlocked ? (
        <UnlockScreen 
          onUnlock={handleUnlock} 
          onTouchIdAuth={handleTouchIdAuth} 
        />
      ) : (
        <ChatInterface onLock={handleLock} />
      )}
    </div>
  );
};

export default App;