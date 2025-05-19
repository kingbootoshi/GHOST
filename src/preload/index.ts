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
}

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('ghost', {
  createPassword: (password: string) => ipcRenderer.invoke('ghost:create-password', password),
  unlock: (password?: string) => ipcRenderer.invoke('ghost:unlock', password),
  lock: () => ipcRenderer.invoke('ghost:lock'),
  getAuthState: () => ipcRenderer.invoke('ghost:get-auth-state'),
  getChatLog: () => ipcRenderer.invoke('ghost:get-chat-log'),
  sendChat: (text: string) => ipcRenderer.invoke('ghost:send-chat', text)
} as GhostAPI);

// Type declaration for the renderer process
declare global {
  interface Window {
    ghost: GhostAPI;
  }
}