/**
 * This file will automatically be loaded by vite and run in the "renderer" context.
 * To learn more about the differences between the "main" and the "renderer" context in
 * Electron, visit:
 *
 * https://electronjs.org/docs/tutorial/process-model
 *
 * By default, Node.js integration in this file is disabled. When enabling Node.js integration
 * in a renderer process, please be aware of potential security implications. You can read
 * more about security risks here:
 *
 * https://electronjs.org/docs/tutorial/security
 */

import './index.css';
import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
// We'll temporarily use GhostAnimator directly instead of App
import GhostAnimator from './components/GhostAnimator';

// Debug console logging function
const logToDebugConsole = (message: string) => {
  const debugConsole = document.getElementById('debug-console');
  if (debugConsole) {
    const timestamp = new Date().toLocaleTimeString();
    debugConsole.textContent = `[${timestamp}] ${message}\n${debugConsole.textContent}`;
  }
  console.log(message);
};

// Simple test component to verify React is working
const TestComponent = () => {
  const [visible, setVisible] = useState(true);
  const [platform, setPlatform] = useState<string>('unknown');
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  const [isTouchIdSupported, setIsTouchIdSupported] = useState<boolean>(false);
  const [isTouchIdEnabled, setIsTouchIdEnabled] = useState<boolean>(false);
  const [password, setPassword] = useState<string>('');
  
  // State for checking if database exists
  const [dbExists, setDbExists] = useState<boolean>(false);
  
  // Check database status
  const checkDatabaseStatus = async () => {
    if (window.electronAPI) {
      try {
        // Check if database exists
        if (window.electronAPI.databaseExists) {
          const exists = await window.electronAPI.databaseExists();
          setDbExists(exists);
          logToDebugConsole(`Database file exists: ${exists}`);
        }
        
        const unlocked = await window.electronAPI.isDatabaseUnlocked();
        setIsUnlocked(unlocked);
        logToDebugConsole(`Database status: ${unlocked ? 'UNLOCKED' : 'LOCKED'}`);
        
        // Only check Touch ID if database is locked (to avoid unnecessary permissions)
        if (!unlocked) {
          const touchIdSupported = await window.electronAPI.isTouchIdSupported();
          setIsTouchIdSupported(touchIdSupported);
          logToDebugConsole(`Touch ID supported: ${touchIdSupported}`);
          
          if (touchIdSupported) {
            const touchIdEnabled = await window.electronAPI.isTouchIdEnabled();
            setIsTouchIdEnabled(touchIdEnabled);
            logToDebugConsole(`Touch ID enabled: ${touchIdEnabled}`);
          }
        }
      } catch (error) {
        logToDebugConsole(`Error checking status: ${error}`);
      }
    }
  };

  // Unlock database with password
  const unlockDatabase = async () => {
    if (!window.electronAPI || !password) return;
    
    try {
      logToDebugConsole(`Attempting to unlock database with password...`);
      const success = await window.electronAPI.unlockDatabase(password);
      if (success) {
        logToDebugConsole('🔓 Database unlocked successfully!');
        setIsUnlocked(true);
      } else {
        logToDebugConsole('❌ Failed to unlock database. Invalid password?');
      }
    } catch (error) {
      logToDebugConsole(`Error unlocking database: ${error}`);
    }
  };
  
  // Lock database
  const lockDatabase = async () => {
    if (!window.electronAPI) return;
    
    try {
      logToDebugConsole(`Locking database...`);
      const success = await window.electronAPI.lockDatabase();
      if (success) {
        logToDebugConsole('🔒 Database locked successfully!');
        setIsUnlocked(false);
      } else {
        logToDebugConsole('❌ Failed to lock database.');
      }
    } catch (error) {
      logToDebugConsole(`Error locking database: ${error}`);
    }
  };
  
  // Authenticate with Touch ID
  const authenticateWithTouchID = async () => {
    if (!window.electronAPI) return;
    
    try {
      logToDebugConsole(`Authenticating with Touch ID...`);
      const success = await window.electronAPI.authenticateWithTouchId();
      if (success) {
        logToDebugConsole('👆 Touch ID authentication successful!');
        setIsUnlocked(true);
      } else {
        logToDebugConsole('❌ Touch ID authentication failed.');
      }
    } catch (error) {
      logToDebugConsole(`Error authenticating with Touch ID: ${error}`);
    }
  };
  
  useEffect(() => {
    logToDebugConsole('Component mounted - checking for electronAPI...');
    
    // Check if electronAPI is available
    if (window.electronAPI) {
      logToDebugConsole('electronAPI found! Setting up listeners...');
      setPlatform(window.electronAPI.getPlatform());
      
      const cleanup = window.electronAPI.onToggleChat(() => {
        logToDebugConsole('👻 Hotkey toggle event received!');
        setVisible(prev => !prev);
      });
      
      // Initial check of database status
      checkDatabaseStatus();
      
      return cleanup;
    } else {
      logToDebugConsole('❌ electronAPI not available!');
    }
  }, []);
  
  // Common button style
  const buttonStyle = {
    padding: '0.5rem 1rem',
    backgroundColor: '#6a5acd',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    margin: '0.25rem'
  };
  
  return (
    <div className="test-container" style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>GHOST Test Page</h1>
      <p>Platform: {platform} | Database: {isUnlocked ? '🔓 UNLOCKED' : '🔒 LOCKED'}</p>
      
      <div style={{ margin: '2rem 0', display: 'flex', justifyContent: 'center' }}>
        <GhostAnimator visible={visible} size={200} />
      </div>
      
      {/* Ghost Animation Controls */}
      <div style={{ 
        display: 'flex', 
        gap: '0.5rem', 
        justifyContent: 'center', 
        flexWrap: 'wrap',
        marginBottom: '1.5rem'
      }}>
        <button 
          onClick={() => setVisible(prev => !prev)}
          style={buttonStyle}
        >
          {visible ? 'Hide' : 'Show'} Ghost
        </button>
        
        <button 
          onClick={() => {
            console.log('Triggering test toggle chat event');
            if (window.electronAPI && window.electronAPI.testToggleChat) {
              window.electronAPI.testToggleChat();
            } else {
              console.error('Test toggle chat not available');
            }
          }}
          style={{...buttonStyle, backgroundColor: '#9370db'}}
        >
          Test Hotkey Event
        </button>
      </div>
      
      <p>
        Press <kbd>⌘⇧Space</kbd> to toggle visibility via hot key
      </p>
      
      {/* Database Controls */}
      <div style={{ 
        border: '1px solid #ddd', 
        padding: '1rem', 
        borderRadius: '8px',
        marginTop: '1.5rem'
      }}>
        <h3>Database Controls</h3>
        
        {isUnlocked ? (
          <div>
            <button 
              onClick={lockDatabase}
              style={{...buttonStyle, backgroundColor: '#dc3545'}}
            >
              Lock Database
            </button>
            <button 
              onClick={checkDatabaseStatus}
              style={{...buttonStyle, backgroundColor: '#6c757d'}}
            >
              Refresh Status
            </button>
          </div>
        ) : (
          <div>
            <div style={{ marginBottom: '0.5rem', fontWeight: 'bold' }}>
              The first password you enter will be used to create the database.
              Make sure you remember it!
            </div>
            
            <div style={{ marginBottom: '1rem' }}>
              <input
                type="password"
                placeholder="Master Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ 
                  padding: '0.5rem',
                  borderRadius: '4px',
                  border: '1px solid #ccc',
                  marginRight: '0.5rem'
                }}
              />
              <button 
                onClick={unlockDatabase}
                disabled={!password}
                style={{
                  ...buttonStyle, 
                  backgroundColor: password ? '#28a745' : '#cccccc',
                  cursor: password ? 'pointer' : 'not-allowed'
                }}
              >
                {dbExists ? 'Unlock Database' : 'Create & Unlock Database'}
              </button>
            </div>
            
            {isTouchIdSupported && (
              <button 
                onClick={authenticateWithTouchID}
                style={{...buttonStyle, backgroundColor: '#17a2b8'}}
              >
                Unlock with Touch ID
              </button>
            )}
          </div>
        )}
      </div>
      
      <div style={{ 
        marginTop: '2rem', 
        textAlign: 'left', 
        padding: '1rem', 
        backgroundColor: '#f0f0f0', 
        borderRadius: '4px', 
        maxHeight: '150px', 
        overflow: 'auto' 
      }}>
        <h3>Debug Console:</h3>
        <pre id="debug-console">Waiting for events...</pre>
      </div>
    </div>
  );
};

// Initialize React
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <TestComponent />
    </React.StrictMode>
  );
  
  console.log('🚀 React test component initialized');
} else {
  console.error('Could not find root element in the DOM!');
}
