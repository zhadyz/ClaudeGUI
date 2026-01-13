import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Claude process controls - now session-aware for multi-instance support
  claude: {
    start: (sessionId: string, cwd: string, claudeSessionId?: string) => ipcRenderer.invoke('claude:start', { sessionId, cwd, claudeSessionId }),
    send: (sessionId: string, message: string) => ipcRenderer.invoke('claude:send', { sessionId, message }),
    stop: (sessionId?: string) => ipcRenderer.invoke('claude:stop', { sessionId }),
    status: (sessionId?: string) => ipcRenderer.invoke('claude:status', { sessionId }),
    onStream: (callback: (event: any) => void) => {
      const handler = (_event: any, data: any) => {
        try {
          callback(data);
        } catch (_err) {
          // Callback error handled silently
        }
      };
      ipcRenderer.on('claude:stream', handler);
      return () => {
        ipcRenderer.removeListener('claude:stream', handler);
      };
    },
    onInit: (callback: (data: { cwd: string }) => void) => {
      const handler = (_event: any, data: { cwd: string }) => callback(data);
      ipcRenderer.on('claude:init', handler);
      return () => ipcRenderer.removeListener('claude:init', handler);
    }
  },

  // Window controls
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
    onMaximized: (callback: (maximized: boolean) => void) => {
      const handler = (_event: any, maximized: boolean) => callback(maximized);
      ipcRenderer.on('window:maximized', handler);
      return () => ipcRenderer.removeListener('window:maximized', handler);
    }
  },

  // Dialog
  dialog: {
    openFolder: () => ipcRenderer.invoke('dialog:openFolder'),
    saveFile: (options: { defaultPath?: string; filters?: { name: string; extensions: string[] }[] }) =>
      ipcRenderer.invoke('dialog:saveFile', options)
  },

  // File operations
  file: {
    write: (path: string, content: string) => ipcRenderer.invoke('file:write', { path, content })
  },

  // Session management
  sessions: {
    load: () => ipcRenderer.invoke('sessions:load'),
    save: (session: any) => ipcRenderer.invoke('sessions:save', session),
    delete: (sessionId: string) => ipcRenderer.invoke('sessions:delete', sessionId)
  },

  // Message persistence
  messages: {
    load: (sessionId: string) => ipcRenderer.invoke('messages:load', sessionId),
    save: (sessionId: string, messages: any[]) => ipcRenderer.invoke('messages:save', sessionId, messages)
  },

  // Authentication
  auth: {
    getUser: () => ipcRenderer.invoke('auth:getUser'),
    login: () => ipcRenderer.invoke('auth:login'),
    logout: () => ipcRenderer.invoke('auth:logout')
  }
});

// Session type for storage
export interface StoredSession {
  id: string;
  title: string;
  workingDirectory: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  claudeSessionId?: string;  // Claude CLI's session ID for --resume
  totalCost?: number;        // Accumulated cost in USD
}

// TypeScript declarations for the exposed API
declare global {
  interface Window {
    electronAPI: {
      claude: {
        start: (sessionId: string, cwd: string, claudeSessionId?: string) => Promise<{ success: boolean; error?: string }>;
        send: (sessionId: string, message: string) => Promise<{ success: boolean; error?: string }>;
        stop: (sessionId?: string) => Promise<{ success: boolean }>;
        status: (sessionId?: string) => Promise<{ running: boolean; cwd: string | null; sessionId?: string; sessions?: Array<{ sessionId: string; running: boolean; cwd: string | null }> }>;
        onStream: (callback: (event: any) => void) => () => void;
        onInit: (callback: (data: { cwd: string }) => void) => () => void;
      };
      window: {
        minimize: () => void;
        maximize: () => void;
        close: () => void;
        isMaximized: () => Promise<boolean>;
        onMaximized: (callback: (maximized: boolean) => void) => () => void;
      };
      dialog: {
        openFolder: () => Promise<{ canceled: boolean; path?: string }>;
        saveFile: (options: { defaultPath?: string; filters?: { name: string; extensions: string[] }[] }) =>
          Promise<{ canceled: boolean; filePath?: string }>;
      };
      file: {
        write: (path: string, content: string) => Promise<{ success: boolean; error?: string }>;
      };
      sessions: {
        load: () => Promise<StoredSession[]>;
        save: (session: StoredSession) => Promise<StoredSession[]>;
        delete: (sessionId: string) => Promise<StoredSession[]>;
      };
      messages: {
        load: (sessionId: string) => Promise<any[]>;
        save: (sessionId: string, messages: any[]) => Promise<{ success: boolean }>;
      };
      auth: {
        getUser: () => Promise<{ email: string | null; name: string | null; isLoggedIn: boolean; subscriptionType?: string | null }>;
        login: () => Promise<{ success: boolean; error?: string }>;
        logout: () => Promise<{ success: boolean }>;
      };
    };
  }
}
