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
  disableBiometric: () => ipcRenderer.invoke('ghost:disable-biometric')
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