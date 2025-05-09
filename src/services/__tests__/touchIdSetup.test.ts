import keychainService from '../keychain';
import { ipcMain } from 'electron';

describe('Touch-ID setup IPC', () => {
  it('stores pw & enables flag', async () => {
    jest.spyOn(keychainService, 'storeMasterPassword')
        .mockResolvedValue(true);
    jest.spyOn(keychainService, 'setTouchIdEnabled')
        .mockResolvedValue(true);
    jest.spyOn(keychainService, 'isTouchIdSupported')
        .mockReturnValue(true);

    const ok = await ipcMain.invoke('auth:setupTouchId', 'pw123');
    expect(ok).toBe(true);
  });

  it('fails if Touch ID is not supported', async () => {
    jest.spyOn(keychainService, 'isTouchIdSupported')
        .mockReturnValue(false);

    const ok = await ipcMain.invoke('auth:setupTouchId', 'pw123');
    expect(ok).toBe(false);
  });

  it('fails if storing password fails', async () => {
    jest.spyOn(keychainService, 'storeMasterPassword')
        .mockRejectedValue(new Error('Keychain store error'));
    jest.spyOn(keychainService, 'isTouchIdSupported')
        .mockReturnValue(true);

    const ok = await ipcMain.invoke('auth:setupTouchId', 'pw123');
    expect(ok).toBe(false);
  });
});