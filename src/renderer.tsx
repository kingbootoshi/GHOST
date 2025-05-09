/**
 * This file will automatically be loaded by vite and run in the "renderer" context.
 * To learn more about the differences between the "main" and the "renderer" context in
 * Electron, visit:
 *
 * https://electronjs.org/docs/tutorial/process-model
 *
 * By default, Node.js integration in this file is disabled. When enabling Node.js integration
 * in a renderer process, please be aware of potential security implications. You can read
 * more about security risks here:
 *
 * https://electronjs.org/docs/tutorial/security
 */

import './index.css';
import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import App from './components/App';

// Debug console logging function
const logToDebugConsole = (message: string) => {
  const debugConsole = document.getElementById('debug-console');
  if (debugConsole) {
    const timestamp = new Date().toLocaleTimeString();
    debugConsole.textContent = `[${timestamp}] ${message}\n${debugConsole.textContent}`;
  }
  console.log(message);
};

// Initialize React
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  
  console.log('🚀 React app initialized');
} else {
  console.error('Could not find root element in the DOM!');
}
