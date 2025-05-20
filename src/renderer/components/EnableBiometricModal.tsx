import React, { useState } from 'react';

interface Props {
  onClose: () => void;
  onEnabled: () => void;
}

/**
 * Modal asking the user whether to enable Touch ID biometric unlock.
 * Can be reused from onboarding and future settings page.
 *
 * The modal does not attempt to *authenticate* with Touch ID – it simply
 * saves the passphrase to Keychain so that future unlock attempts can rely
 * on system biometrics.
 */
export function EnableBiometricModal({ onClose, onEnabled }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const handleEnable = async () => {
    setWorking(true);
    setError(null);
    try {
      const res = await window.ghost.enableBiometric();
      if (res.success) {
        onEnabled();
      } else {
        setError(res.error || 'Failed to enable biometric unlock');
      }
    } catch (e) {
      setError('Unexpected error enabling biometrics');
    } finally {
      setWorking(false);
    }
  };

  const handleSkip = async () => {
    setWorking(true);
    try {
      await window.ghost.disableBiometric();
    } finally {
      setWorking(false);
      onClose();
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>Enable Touch&nbsp;ID?</h2>
        <p>
          You can use Touch&nbsp;ID to unlock GHOST without typing your master
          password. Your passphrase will be stored securely in the system
          keychain.
        </p>
        {error && <div className="error-message">{error}</div>}
        <div className="modal-actions">
          <button onClick={handleEnable} disabled={working}>
            {working ? 'Enabling…' : 'Enable'}
          </button>
          <button onClick={handleSkip} disabled={working} className="secondary">
            Skip
          </button>
        </div>
      </div>
    </div>
  );
} 