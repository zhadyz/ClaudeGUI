import { ipcMain, BrowserWindow, dialog, app, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { spawn, spawnSync } from 'child_process';
import { ClaudeProcessManager } from './claude-process-manager';

// Session storage paths
const getSessionsPath = () => path.join(app.getPath('userData'), 'sessions.json');
const getMessagesDir = () => path.join(app.getPath('userData'), 'messages');
const getMessagesPath = (sessionId: string) => path.join(getMessagesDir(), `${sessionId}.json`);

// Ensure messages directory exists
function ensureMessagesDir(): void {
  const dir = getMessagesDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

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

// Load sessions from disk
function loadSessions(): StoredSession[] {
  try {
    const sessionsPath = getSessionsPath();
    if (fs.existsSync(sessionsPath)) {
      const data = fs.readFileSync(sessionsPath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (_e) {
    // Session storage may not exist yet
  }
  return [];
}

// Save sessions to disk
function saveSessions(sessions: StoredSession[]): void {
  try {
    const sessionsPath = getSessionsPath();
    fs.writeFileSync(sessionsPath, JSON.stringify(sessions, null, 2));
  } catch (_e) {
    // Silently fail - session will be lost but app continues
  }
}

// Load messages for a session
function loadMessages(sessionId: string): any[] {
  try {
    const messagesPath = getMessagesPath(sessionId);
    if (fs.existsSync(messagesPath)) {
      const data = fs.readFileSync(messagesPath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (_e) {
    // Messages may not exist yet
  }
  return [];
}

// Save messages for a session
function saveMessages(sessionId: string, messages: any[]): void {
  try {
    ensureMessagesDir();
    const messagesPath = getMessagesPath(sessionId);
    fs.writeFileSync(messagesPath, JSON.stringify(messages, null, 2));
  } catch (_e) {
    // Silently fail - messages will be lost but app continues
  }
}

// Delete messages for a session
function deleteMessages(sessionId: string): void {
  try {
    const messagesPath = getMessagesPath(sessionId);
    if (fs.existsSync(messagesPath)) {
      fs.unlinkSync(messagesPath);
    }
  } catch (_e) {
    // File may not exist
  }
}

export function setupIpcHandlers(window: BrowserWindow, processManager: ClaudeProcessManager): void {
  // Start Claude process for a specific session with a working directory
  // Optional claudeSessionId for resuming previous conversations
  ipcMain.handle('claude:start', async (_event, { sessionId, cwd, claudeSessionId }: { sessionId: string; cwd: string; claudeSessionId?: string }) => {
    try {
      await processManager.start(sessionId, cwd, claudeSessionId);
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // Send a message to Claude for a specific session
  ipcMain.handle('claude:send', async (_event, { sessionId, message }: { sessionId: string; message: string }) => {
    try {
      processManager.send(sessionId, message);
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // Stop the Claude process for a specific session
  ipcMain.handle('claude:stop', async (_event, { sessionId }: { sessionId?: string } = {}) => {
    if (sessionId) {
      processManager.stop(sessionId);
    } else {
      // Backwards compatibility: stop all if no sessionId provided
      processManager.stopAll();
    }
    return { success: true };
  });

  // Get Claude process status for a specific session
  ipcMain.handle('claude:status', async (_event, { sessionId }: { sessionId?: string } = {}) => {
    if (sessionId) {
      return {
        running: processManager.isRunning(sessionId),
        cwd: processManager.getCwd(sessionId),
        sessionId
      };
    }
    // Return status of all sessions
    return {
      sessions: processManager.getAllStatus()
    };
  });

  // Window controls
  ipcMain.on('window:minimize', () => {
    window.minimize();
  });

  ipcMain.on('window:maximize', () => {
    if (window.isMaximized()) {
      window.unmaximize();
    } else {
      window.maximize();
    }
  });

  ipcMain.on('window:close', () => {
    window.close();
  });

  // Get window state
  ipcMain.handle('window:isMaximized', () => {
    return window.isMaximized();
  });

  // Listen for maximize/unmaximize to update UI
  window.on('maximize', () => {
    window.webContents.send('window:maximized', true);
  });

  window.on('unmaximize', () => {
    window.webContents.send('window:maximized', false);
  });

  // Open folder picker dialog
  ipcMain.handle('dialog:openFolder', async () => {
    const result = await dialog.showOpenDialog(window, {
      properties: ['openDirectory'],
      title: 'Select Working Directory'
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true };
    }
    return { canceled: false, path: result.filePaths[0] };
  });

  // Save file dialog
  ipcMain.handle('dialog:saveFile', async (_event, options: { defaultPath?: string; filters?: { name: string; extensions: string[] }[] }) => {
    const result = await dialog.showSaveDialog(window, {
      defaultPath: options.defaultPath,
      filters: options.filters || [{ name: 'All Files', extensions: ['*'] }],
      title: 'Save File'
    });
    if (result.canceled) {
      return { canceled: true };
    }
    return { canceled: false, filePath: result.filePath };
  });

  // Write file
  ipcMain.handle('file:write', async (_event, { path: filePath, content }: { path: string; content: string }) => {
    try {
      fs.writeFileSync(filePath, content, 'utf-8');
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // Session management
  ipcMain.handle('sessions:load', async () => {
    return loadSessions();
  });

  ipcMain.handle('sessions:save', async (_event, session: StoredSession) => {
    const sessions = loadSessions();
    const existingIndex = sessions.findIndex(s => s.id === session.id);
    if (existingIndex >= 0) {
      sessions[existingIndex] = session;
    } else {
      sessions.unshift(session); // Add to beginning
    }
    // Keep only last 50 sessions
    const trimmed = sessions.slice(0, 50);
    saveSessions(trimmed);
    return trimmed;
  });

  ipcMain.handle('sessions:delete', async (_event, sessionId: string) => {
    // Stop and remove the Claude process for this session
    processManager.removeSession(sessionId);

    const sessions = loadSessions();
    const filtered = sessions.filter(s => s.id !== sessionId);
    saveSessions(filtered);
    // Also delete messages for this session
    deleteMessages(sessionId);
    return filtered;
  });

  // Message persistence
  ipcMain.handle('messages:load', async (_event, sessionId: string) => {
    return loadMessages(sessionId);
  });

  ipcMain.handle('messages:save', async (_event, sessionId: string, messages: any[]) => {
    saveMessages(sessionId, messages);
    return { success: true };
  });

  // Authentication handlers
  ipcMain.handle('auth:getUser', async () => {
    try {
      // Claude CLI stores auth in ~/.claude/.credentials.json
      const homeDir = process.env.HOME || process.env.USERPROFILE || '';
      const credentialsFile = path.join(homeDir, '.claude', '.credentials.json');

      if (fs.existsSync(credentialsFile)) {
        try {
          const creds = JSON.parse(fs.readFileSync(credentialsFile, 'utf-8'));

          if (creds.claudeAiOauth) {
            const subscriptionType = creds.claudeAiOauth.subscriptionType || null;

            return {
              email: null,
              name: subscriptionType ? `Claude ${subscriptionType.charAt(0).toUpperCase() + subscriptionType.slice(1)}` : null,
              isLoggedIn: !!creds.claudeAiOauth.accessToken,
              subscriptionType: subscriptionType
            };
          }
        } catch (e) {
          // Failed to parse credentials
        }
      }

      return { email: null, name: null, isLoggedIn: false, subscriptionType: null };
    } catch (error) {
      return { email: null, name: null, isLoggedIn: false, subscriptionType: null };
    }
  });

  ipcMain.handle('auth:login', async () => {
    try {
      // Run claude login command which opens browser for OAuth
      const isWindows = process.platform === 'win32';
      const claudeCmd = isWindows ? 'claude.cmd' : 'claude';

      const loginProcess = spawn(claudeCmd, ['login'], {
        stdio: 'inherit',
        shell: true
      });

      return new Promise((resolve) => {
        loginProcess.on('close', (code) => {
          if (code === 0) {
            resolve({ success: true });
          } else {
            resolve({ success: false, error: `Login process exited with code ${code}` });
          }
        });
        loginProcess.on('error', (err) => {
          resolve({ success: false, error: err.message });
        });
      });
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('auth:logout', async () => {
    try {
      // Run claude logout command
      const isWindows = process.platform === 'win32';
      const claudeCmd = isWindows ? 'claude.cmd' : 'claude';

      spawnSync(claudeCmd, ['logout'], { shell: true });
      return { success: true };
    } catch (error) {
      // Logout might fail if not logged in, but that's okay
      return { success: true };
    }
  });
}
