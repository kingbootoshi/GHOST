// Global type definitions for the application

import { ElectronAPI } from '../preload';

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};