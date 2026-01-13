import { BrowserWindow } from 'electron';
import { ClaudeProcess } from './claude-process';

/**
 * Manages multiple Claude CLI process instances, one per session.
 * This allows users to have multiple tabs with independent Claude conversations
 * running simultaneously without interrupting each other.
 */
export class ClaudeProcessManager {
  private processes: Map<string, ClaudeProcess> = new Map();
  private window: BrowserWindow;

  constructor(window: BrowserWindow) {
    this.window = window;
  }

  /**
   * Start a Claude process for a specific session
   * @param sessionId - Our internal session ID
   * @param cwd - Working directory
   * @param claudeSessionId - Optional Claude CLI session ID for --resume
   */
  async start(sessionId: string, cwd: string, claudeSessionId?: string): Promise<void> {
    // Check if there's already a process for this session
    let process = this.processes.get(sessionId);

    if (process) {
      // Stop existing process if running
      if (process.isRunning()) {
        process.stop();
      }
    } else {
      // Create new process instance for this session
      process = new ClaudeProcess(this.window, sessionId);
      this.processes.set(sessionId, process);
    }

    // Start the process (with optional resume)
    await process.start(cwd, claudeSessionId);
  }

  /**
   * Send a message to the Claude process for a specific session
   */
  send(sessionId: string, message: string): void {
    const process = this.processes.get(sessionId);
    if (!process) {
      this.sendError(sessionId, 'No Claude process running for this session. Please restart.');
      return;
    }

    if (!process.isRunning()) {
      this.sendError(sessionId, 'Claude process not running. Please restart.');
      return;
    }

    process.send(message);
  }

  /**
   * Stop the Claude process for a specific session
   */
  stop(sessionId: string): void {
    const process = this.processes.get(sessionId);
    if (process) {
      process.stop();
    }
  }

  /**
   * Stop all Claude processes
   */
  stopAll(): void {
    for (const [_sessionId, process] of this.processes) {
      process.stop();
    }
    this.processes.clear();
  }

  /**
   * Check if a process is running for a specific session
   */
  isRunning(sessionId: string): boolean {
    const process = this.processes.get(sessionId);
    return process?.isRunning() ?? false;
  }

  /**
   * Get the current working directory for a session's process
   */
  getCwd(sessionId: string): string | null {
    const process = this.processes.get(sessionId);
    return process?.getCwd() ?? null;
  }

  /**
   * Get status of all sessions
   */
  getAllStatus(): Array<{ sessionId: string; running: boolean; cwd: string | null }> {
    const statuses: Array<{ sessionId: string; running: boolean; cwd: string | null }> = [];
    for (const [sessionId, process] of this.processes) {
      statuses.push({
        sessionId,
        running: process.isRunning(),
        cwd: process.getCwd()
      });
    }
    return statuses;
  }

  /**
   * Remove a session's process (call when session is deleted)
   */
  removeSession(sessionId: string): void {
    const process = this.processes.get(sessionId);
    if (process) {
      if (process.isRunning()) {
        process.stop();
      }
      this.processes.delete(sessionId);
    }
  }

  /**
   * Send an error to the renderer for a specific session
   */
  private sendError(sessionId: string, error: string): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send('claude:stream', {
        type: 'error',
        sessionId,
        error
      });
    }
  }
}
