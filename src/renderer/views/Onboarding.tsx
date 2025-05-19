import React, { useState } from 'react';

interface OnboardingProps {
  onPasswordCreated: () => void;
}

export function Onboarding({ onPasswordCreated }: OnboardingProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      const result = await window.ghost.createPassword(password);
      if (result.success) {
        onPasswordCreated();
      } else {
        setError(result.error || 'Failed to set password');
      }
    } catch (error) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="onboarding-container">
      <h1>Welcome to GHOST</h1>
      <p>Set up your master password to encrypt your data</p>
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="password">Master Password</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter master password"
            disabled={loading}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="confirmPassword">Confirm Password</label>
          <input
            type="password"
            id="confirmPassword"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm master password"
            disabled={loading}
            required
          />
        </div>

        {error && <div className="error-message">{error}</div>}

        <button type="submit" disabled={loading}>
          {loading ? 'Setting up...' : 'Create Password'}
        </button>
      </form>

      <div className="info-box">
        <p><strong>Important:</strong></p>
        <ul>
          <li>Your password encrypts all local data</li>
          <li>We cannot recover your password if lost</li>
          <li>Use a strong, memorable password</li>
        </ul>
      </div>
    </div>
  );
}