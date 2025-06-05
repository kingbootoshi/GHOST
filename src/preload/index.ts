import { contextBridge, ipcRenderer } from 'electron';
import { AuthState, ChatMessage } from '../types';

// Define the API that will be exposed to the renderer
interface GhostAPI {
  createPassword: (password: string) => Promise<{ success: boolean; canBiometric?: boolean; error?: string }>;
  unlock: (password?: string) => Promise<{ success: boolean; error?: string }>;
  lock: () => Promise<{ success: boolean }>;
  getAuthState: () => Promise<AuthState>;
  getChatLog: () => Promise<ChatMessage[]>;
  sendChat: (text: string) => Promise<ChatMessage>;
  enableBiometric: () => Promise<{ success: boolean; error?: string }>;
  disableBiometric: () => Promise<{ success: boolean; error?: string }>;
  listModules: () => Promise<any[]>;
  invokeModule: (moduleId: string, fn: string, args: any) => Promise<any>;
  enableSync: (token: string) => Promise<{ success: boolean; error?: string }>;
  disableSync: () => Promise<{ success: boolean }>;
  getSyncStatus: () => Promise<{ enabled: boolean; lastSyncedAt: number | null; pendingBytes: number }>;
}

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('ghost', {
  createPassword: (password: string) => ipcRenderer.invoke('ghost:create-password', password),
  unlock: (password?: string) => ipcRenderer.invoke('ghost:unlock', password),
  lock: () => ipcRenderer.invoke('ghost:lock'),
  getAuthState: () => ipcRenderer.invoke('ghost:get-auth-state'),
  getChatLog: () => ipcRenderer.invoke('ghost:get-chat-log'),
  sendChat: (text: string) => ipcRenderer.invoke('ghost:send-chat', text),
  enableBiometric: () => ipcRenderer.invoke('ghost:enable-biometric'),
  disableBiometric: () => ipcRenderer.invoke('ghost:disable-biometric'),
  listModules: () => ipcRenderer.invoke('ghost:list-modules'),
  invokeModule: async (moduleId: string, fn: string, args: any) => {
    const res = await ipcRenderer.invoke('ghost:invoke-module', moduleId, fn, args);
    if (res && typeof res === 'object' && 'error' in res) {
      throw new Error(res.error);
    }
    return res as any;
  },
  enableSync: (token: string) => ipcRenderer.invoke('ghost:enable-sync', token),
  disableSync: () => ipcRenderer.invoke('ghost:disable-sync'),
  getSyncStatus: () => ipcRenderer.invoke('ghost:get-sync-status')
} as GhostAPI);

// Forward one-shot event when the main process wants to kick off automatic
// biometric authentication. We convert it to a DOM CustomEvent so that the
// renderer can subscribe without direct Electron dependencies.
ipcRenderer.on('auto-bio-start', () => {
  // Perform the biometric unlock in the preload context so it happens even
  // before React mounts. This avoids race conditions where the renderer
  // hasn't attached event listeners yet.
  (async () => {
    const res = await ipcRenderer.invoke('ghost:unlock');
    window.dispatchEvent(new CustomEvent('ghost:auto-bio-done', { detail: res }));
  })();
});

// Type declaration for the renderer process
declare global {
  interface Window {
    ghost: GhostAPI;
  }
}