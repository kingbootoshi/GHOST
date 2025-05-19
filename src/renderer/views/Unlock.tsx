import React, { useState } from 'react';

interface UnlockProps {
  onUnlocked: () => void;
  canUseBiometric?: boolean;
  biometricEnabled?: boolean;
}

export function Unlock({ onUnlocked, canUseBiometric, biometricEnabled }: UnlockProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePasswordUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await window.ghost.unlock(password);
      if (result.success) {
        onUnlocked();
      } else {
        setError(result.error || 'Invalid password');
      }
    } catch (error) {
      setError('Failed to unlock');
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricUnlock = async () => {
    setError('');
    setLoading(true);

    try {
      const result = await window.ghost.unlock();
      if (result.success) {
        onUnlocked();
      } else {
        setError(result.error || 'Biometric unlock failed');
      }
    } catch (error) {
      setError('Failed to unlock with biometric');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="unlock-container">
      <h1>GHOST</h1>
      <p>Unlock to continue</p>

      <form onSubmit={handlePasswordUnlock}>
        <div className="form-group">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            disabled={loading}
            required
          />
        </div>

        {error && <div className="error-message">{error}</div>}

        <button type="submit" disabled={loading}>
          {loading ? 'Unlocking...' : 'Unlock'}
        </button>
      </form>

      {canUseBiometric && biometricEnabled && (
        <div className="biometric-section">
          <div className="divider">or</div>
          <button
            onClick={handleBiometricUnlock}
            disabled={loading}
            className="biometric-button"
          >
            Unlock with Touch ID
          </button>
        </div>
      )}
    </div>
  );
}