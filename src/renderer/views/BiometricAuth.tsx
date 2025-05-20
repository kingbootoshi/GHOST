import React, { useEffect } from 'react';

interface Props {
  /** Callback once unlock attempt finishes. `true` on success, `false` on cancel/fail */
  onResult: (success: boolean) => void;
}

/**
 * Full-screen spinner that triggers a biometric unlock attempt as soon as
 * it is mounted. On completion it defers to `onResult` which should call
 * `ghost.getAuthState` to update global app view.
 */
export function BiometricAuth({ onResult }: Props) {
  useEffect(() => {
    let isMounted = true;
    const run = async () => {
      let success = false;
      try {
        console.debug('[Bio] invoking unlock');
        const res = await window.ghost.unlock();
        console.debug('[Bio] unlock result', res);
        success = res.success;
      } catch (err) {
        console.warn('[Bio] unlock threw', err);
      } finally {
        if (isMounted) onResult(success);
      }
    };
    run();
    return () => { isMounted = false; };
  }, [onResult]);

  return (
    <div className="biometric-auth-view">
      <h2>Unlocking…</h2>
      <p>Please authenticate with Touch&nbsp;ID</p>
    </div>
  );
} 