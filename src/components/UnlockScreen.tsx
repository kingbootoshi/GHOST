import React, { useState, useEffect } from 'react';
import GhostAnimator from './GhostAnimator';

interface UnlockScreenProps {
  onUnlock: (password: string) => Promise<boolean>;
  onTouchIdAuth: () => Promise<boolean>;
}

/**
 * Unlock screen component for database authentication
 */
const UnlockScreen: React.FC<UnlockScreenProps> = ({ onUnlock, onTouchIdAuth }) => {
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isTouchIdSupported, setIsTouchIdSupported] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isCreatingNew, setIsCreatingNew] = useState<boolean>(false);
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showGhost, setShowGhost] = useState<boolean>(false);
  
  // Check if Touch ID is supported
  useEffect(() => {
    const checkTouchIdSupport = async () => {
      try {
        const isSupported = await window.electronAPI.isTouchIdSupported();
        const isEnabled = await window.electronAPI.isTouchIdEnabled();
        setIsTouchIdSupported(isSupported && isEnabled);
      } catch (error) {
        console.error('Failed to check Touch ID support:', error);
      }
    };
    
    checkTouchIdSupport();
    
    // Show ghost animation after a short delay
    const timer = setTimeout(() => {
      setShowGhost(true);
    }, 300);
    
    return () => clearTimeout(timer);
  }, []);
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (isCreatingNew) {
      // Creating a new database
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
      
      if (password.length < 8) {
        setError('Password must be at least 8 characters long');
        return;
      }
    }
    
    setIsLoading(true);
    
    try {
      const success = await onUnlock(password);
      
      if (!success) {
        setError('Invalid password');
      }
    } catch (error) {
      setError('An error occurred. Please try again.');
      console.error('Error unlocking database:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle Touch ID authentication
  const handleTouchIdAuth = async () => {
    setError('');
    setIsLoading(true);
    
    try {
      const success = await onTouchIdAuth();
      
      if (!success) {
        setError('Touch ID authentication failed');
      }
    } catch (error) {
      setError('An error occurred with Touch ID. Please try again or use password.');
      console.error('Error with Touch ID:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="unlock-container">
      <div className="unlock-logo">
        <GhostAnimator visible={showGhost} size={200} />
        <h1>GHOST</h1>
        <p>Your secure AI assistant</p>
      </div>
      
      <form className="password-form" onSubmit={handleSubmit}>
        <h2>{isCreatingNew ? 'Create Password' : 'Enter Password'}</h2>
        
        {error && <p className="error-message">{error}</p>}
        
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={isLoading}
        />
        
        {isCreatingNew && (
          <input
            type="password"
            placeholder="Confirm Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            disabled={isLoading}
          />
        )}
        
        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Loading...' : isCreatingNew ? 'Create' : 'Unlock'}
        </button>
        
        {isTouchIdSupported && !isCreatingNew && (
          <button 
            type="button" 
            className="touch-id-button"
            onClick={handleTouchIdAuth}
            disabled={isLoading}
          >
            <span>Unlock with Touch ID</span>
          </button>
        )}
        
        <button 
          type="button" 
          className="switch-mode-link"
          onClick={() => {
            setIsCreatingNew(!isCreatingNew);
            setError('');
          }}
          disabled={isLoading}
        >
          {isCreatingNew ? 'Back to Login' : 'First time? Create a new password'}
        </button>
      </form>
    </div>
  );
};

export default UnlockScreen;