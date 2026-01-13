import { spawn, ChildProcess, execSync } from 'child_process';
import { BrowserWindow } from 'electron';
import * as readline from 'readline';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

// Debug log file for troubleshooting streaming issues (file only, no console)
const DEBUG_LOG_PATH = path.join(os.tmpdir(), 'claude-gui-debug.log');
function debugLog(message: string) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(DEBUG_LOG_PATH, line);
}

export class ClaudeProcess {
  private process: ChildProcess | null = null;
  private window: BrowserWindow;
  private sessionId: string;  // Session ID for multi-instance support
  private currentCwd: string | null = null;
  private messageIdCounter: number = 0;
  private stdoutBuffer: string = '';  // Buffer for raw stdout processing
  private stderrRl: readline.Interface | null = null;
  private claudePath: string | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;  // Keep IPC channel alive
  private eventCounter: number = 0;  // Track events sent for debugging

  // Batching system for input_json_delta events to prevent IPC overload
  private deltaBuffer: Map<number, string> = new Map();  // blockIndex -> accumulated partial_json
  private deltaFlushTimer: NodeJS.Timeout | null = null;
  private lastDeltaEvent: any = null;  // Template for batched events
  private DELTA_BATCH_INTERVAL = 30;  // Flush deltas every 30ms for smooth streaming

  constructor(window: BrowserWindow, sessionId: string = 'default') {
    this.window = window;
    this.sessionId = sessionId;
    this.claudePath = this.findClaudeCli();
  }

  /**
   * Get the session ID this process belongs to
   */
  getSessionId(): string {
    return this.sessionId;
  }

  // Find the Claude CLI executable path
  private findClaudeCli(): string | null {
    const isWindows = process.platform === 'win32';
    const claudeExecutable = isWindows ? 'claude.cmd' : 'claude';

    // Try common installation paths
    const possiblePaths: string[] = [];

    // npm global paths
    const npmPrefix = process.env.npm_config_prefix || (isWindows ? path.join(os.homedir(), 'AppData', 'Roaming', 'npm') : '/usr/local');
    possiblePaths.push(path.join(npmPrefix, claudeExecutable));
    possiblePaths.push(path.join(npmPrefix, 'bin', claudeExecutable));

    // Also check if claude.exe exists for Windows
    if (isWindows) {
      possiblePaths.push(path.join(npmPrefix, 'claude.exe'));
      possiblePaths.push(path.join(os.homedir(), 'AppData', 'Local', 'npm', claudeExecutable));
      possiblePaths.push(path.join(os.homedir(), 'AppData', 'Local', 'npm', 'claude.exe'));
    }

    // Check each path
    for (const claudePath of possiblePaths) {
      if (fs.existsSync(claudePath)) {
        return claudePath;
      }
    }

    // Try using 'where' (Windows) or 'which' (Unix) to find it
    try {
      const command = isWindows ? 'where claude' : 'which claude';
      const result = execSync(command, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
      const foundPath = result.trim().split('\n')[0].trim();
      if (foundPath && fs.existsSync(foundPath)) {
        return foundPath;
      }
    } catch (e) {
      // Command not found, continue
    }

    // Claude CLI not found
    return null;
  }

  // Validate that the cwd is a safe directory path
  private validateCwd(cwd: string): string {
    const resolvedPath = path.resolve(cwd);
    const homeDir = os.homedir();

    // Ensure it's within user's home directory or common safe locations
    const safePaths = [
      homeDir,
      'C:\\Users',
      'C:\\Projects',
      'D:\\',
      'E:\\'
    ];

    const isSafe = safePaths.some(safePath =>
      resolvedPath.toLowerCase().startsWith(safePath.toLowerCase())
    );

    if (!isSafe) {
      return homeDir;
    }

    return resolvedPath;
  }

  async start(cwd: string, resumeSessionId?: string): Promise<void> {
    // Clear previous debug log and log startup
    try {
      fs.writeFileSync(DEBUG_LOG_PATH, '');
    } catch (e) { /* ignore */ }
    debugLog(`=== Claude GUI Debug Log ===`);
    debugLog(`Log file: ${DEBUG_LOG_PATH}`);
    debugLog(`Starting Claude process in: ${cwd}${resumeSessionId ? ` (resuming: ${resumeSessionId})` : ''}`);

    // Stop any existing process
    this.stop();

    // Check if Claude CLI was found
    if (!this.claudePath) {
      // Try finding it again in case it was installed after app started
      this.claudePath = this.findClaudeCli();
      if (!this.claudePath) {
        this.sendToRenderer({
          type: 'error',
          error: 'Claude CLI not found. Please install it with: npm install -g @anthropic-ai/claude-code'
        });
        return;
      }
    }

    // Validate and sanitize cwd
    const safeCwd = this.validateCwd(cwd);
    this.currentCwd = safeCwd;
    this.messageIdCounter = 0;

    // Build arguments array
    const args = [
      '--print',
      '--dangerously-skip-permissions',
      '--input-format', 'stream-json',
      '--output-format', 'stream-json',
      '--include-partial-messages',
      '--verbose'
    ];

    // Add --resume flag if we have a session to resume
    if (resumeSessionId) {
      args.push('--resume', resumeSessionId);
    }

    // Spawn Claude CLI with streaming JSON input/output
    // This enables bidirectional streaming communication
    // --include-partial-messages enables real-time character-by-character streaming
    // Using shell: true on Windows for .cmd files, shell: false otherwise
    const isWindows = process.platform === 'win32';
    const useShell = isWindows && this.claudePath.endsWith('.cmd');

    this.process = spawn(this.claudePath, args, {
      cwd: safeCwd,
      shell: useShell,
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Handle stdout - read raw data to avoid readline buffering issues
    // This ensures real-time streaming of input_json_delta events for code content
    if (this.process.stdout) {
      this.stdoutBuffer = '';

      this.process.stdout.on('data', (chunk: Buffer) => {
        const chunkStr = chunk.toString();
        debugLog(`[Stdout] Received ${chunkStr.length} bytes`);

        // Append new data to buffer
        this.stdoutBuffer += chunkStr;

        // Process all complete lines (JSON events are newline-delimited)
        // Handle both \n and \r\n line endings (Windows compatibility)
        let newlineIndex: number;
        let linesProcessed = 0;
        while ((newlineIndex = this.stdoutBuffer.indexOf('\n')) !== -1) {
          let line = this.stdoutBuffer.substring(0, newlineIndex);
          this.stdoutBuffer = this.stdoutBuffer.substring(newlineIndex + 1);

          // Remove trailing \r if present (Windows CRLF)
          if (line.endsWith('\r')) {
            line = line.slice(0, -1);
          }

          if (line.trim()) {
            linesProcessed++;
            this.handleStreamLine(line);
          }
        }

        if (linesProcessed > 0) {
          debugLog(`[Stdout] Processed ${linesProcessed} lines, buffer remaining: ${this.stdoutBuffer.length} bytes`);
        }
      });
    }

    // Handle stderr for errors/debug info
    if (this.process.stderr) {
      this.stderrRl = readline.createInterface({
        input: this.process.stderr,
        crlfDelay: Infinity
      });

      this.stderrRl.on('line', (line) => {
        // Show errors to the user
        if (line.includes('error') || line.includes('Error')) {
          this.sendToRenderer({
            type: 'error',
            error: line
          });
        }
      });
    }

    this.process.on('error', (error) => {
      this.sendToRenderer({
        type: 'error',
        error: error.message
      });
    });

    this.process.on('close', (code) => {
      this.sendToRenderer({
        type: 'status',
        status: 'stopped',
        code
      });
      this.process = null;
    });

    // Notify renderer that process started
    this.sendToRenderer({
      type: 'status',
      status: 'started',
      cwd
    });

    // Start heartbeat to keep IPC channel alive during long processing periods
    // This prevents the IPC channel from going stale during Claude's thinking time
    this.startHeartbeat();
  }

  private startHeartbeat(): void {
    // Stop any existing heartbeat
    this.stopHeartbeat();

    // Send heartbeat every 2 seconds to keep IPC channel active
    this.heartbeatInterval = setInterval(() => {
      if (this.window && !this.window.isDestroyed()) {
        debugLog(`[Heartbeat] [Session: ${this.sessionId}] Sending keepalive (events sent so far: ${this.eventCounter})`);
        this.window.webContents.send('claude:stream', {
          type: 'heartbeat',
          sessionId: this.sessionId,
          timestamp: Date.now()
        });
      }
    }, 2000);
    debugLog(`[Heartbeat] [Session: ${this.sessionId}] Started`);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      debugLog(`[Heartbeat] Stopped`);
    }
  }

  // Flush batched input_json_delta events to renderer
  private flushDeltaBuffer(): void {
    if (this.deltaBuffer.size === 0) return;

    // Send batched deltas for each block index
    for (const [blockIndex, accumulatedJson] of this.deltaBuffer) {
      if (accumulatedJson && this.lastDeltaEvent) {
        // Create a batched event with accumulated partial_json
        const batchedEvent = {
          ...this.lastDeltaEvent,
          event: {
            ...this.lastDeltaEvent.event,
            index: blockIndex,
            delta: {
              type: 'input_json_delta',
              partial_json: accumulatedJson
            }
          }
        };

        debugLog(`[Main] Flushing batched delta: ${accumulatedJson.length} chars for block ${blockIndex}`);
        this.sendToRenderer({
          type: 'stream_event',
          data: batchedEvent
        });
      }
    }

    // Clear the buffer
    this.deltaBuffer.clear();
  }

  // Start delta batch timer if not running
  private ensureDeltaFlushTimer(): void {
    if (!this.deltaFlushTimer) {
      this.deltaFlushTimer = setInterval(() => {
        this.flushDeltaBuffer();
      }, this.DELTA_BATCH_INTERVAL);
      debugLog(`[Main] Delta batch timer started (${this.DELTA_BATCH_INTERVAL}ms)`);
    }
  }

  // Stop delta batch timer
  private stopDeltaFlushTimer(): void {
    if (this.deltaFlushTimer) {
      clearInterval(this.deltaFlushTimer);
      this.deltaFlushTimer = null;
      debugLog(`[Main] Delta batch timer stopped`);
    }
    // Flush any remaining
    this.flushDeltaBuffer();
  }

  private handleStreamLine(line: string): void {
    if (!line.trim()) return;

    try {
      const event = JSON.parse(line);

      // Log all events for debugging - show more of the event structure
      const eventType = event.type;
      const innerType = event.event?.type;
      const deltaType = event.event?.delta?.type;

      // Check if this is an input_json_delta event (tool input streaming)
      if (deltaType === 'input_json_delta') {
        const partialJson = event.event?.delta?.partial_json || '';
        const blockIndex = event.event?.index ?? 0;

        debugLog(`[Main] input_json_delta received: "${partialJson.substring(0, 50)}" (${partialJson.length} chars)`);

        // Accumulate in buffer instead of sending immediately
        const existing = this.deltaBuffer.get(blockIndex) || '';
        this.deltaBuffer.set(blockIndex, existing + partialJson);
        this.lastDeltaEvent = event;  // Save as template for batched events

        // Start the batch timer if not running
        this.ensureDeltaFlushTimer();

        return;  // Don't send yet - will be batched
      }

      // For non-delta events, flush any pending deltas first
      if (this.deltaBuffer.size > 0) {
        this.flushDeltaBuffer();
      }

      // Log non-delta events
      debugLog(`[Main] Event: ${eventType} -> ${innerType || 'N/A'} -> ${deltaType || 'N/A'}`);

      // Stop delta timer on content_block_stop (tool input complete)
      if (innerType === 'content_block_stop') {
        this.stopDeltaFlushTimer();
      }

      // Forward the event to the renderer
      this.sendToRenderer({
        type: event.type || 'unknown',
        data: event
      });
    } catch (e) {
      // Not valid JSON, might be raw output or debug info
      debugLog(`[Main] Non-JSON output: ${line.substring(0, 200)}`);
    }
  }

  send(message: string): void {
    if (!this.process || !this.process.stdin) {
      this.sendToRenderer({
        type: 'error',
        error: 'Claude process not running. Please restart.'
      });
      return;
    }

    // Send message in stream-json format
    // Format: {"type":"user","message":{"role":"user","content":"..."}}
    const inputMessage = {
      type: 'user',
      message: {
        role: 'user',
        content: message
      }
    };

    try {
      const jsonLine = JSON.stringify(inputMessage) + '\n';
      this.process.stdin.write(jsonLine);
    } catch (error) {
      this.sendToRenderer({
        type: 'error',
        error: `Failed to send message: ${(error as Error).message}`
      });
    }
  }

  stop(): void {
    // Stop heartbeat
    this.stopHeartbeat();

    // Stop delta batching and flush remaining
    this.stopDeltaFlushTimer();
    this.deltaBuffer.clear();
    this.lastDeltaEvent = null;

    // Clear stdout buffer
    this.stdoutBuffer = '';

    // Close readline interface for stderr
    if (this.stderrRl) {
      this.stderrRl.close();
      this.stderrRl = null;
    }

    if (this.process) {
      // Send interrupt signal
      try {
        this.process.kill('SIGTERM');
      } catch (_e) {
        // Process may already be terminated
      }
      this.process = null;
    }

    // Reset event counter
    this.eventCounter = 0;
  }

  isRunning(): boolean {
    return this.process !== null;
  }

  getCwd(): string | null {
    return this.currentCwd;
  }

  private sendToRenderer(data: any): void {
    if (this.window && !this.window.isDestroyed()) {
      this.eventCounter++;
      const eventNum = this.eventCounter;

      // Include sessionId in all events for multi-instance support
      const eventWithSession = {
        ...data,
        sessionId: this.sessionId
      };

      // Log that we're sending (with data preview for debugging)
      const preview = JSON.stringify(eventWithSession).substring(0, 200);
      debugLog(`[Main->Renderer] Event #${eventNum} [Session: ${this.sessionId}] Sending: ${preview}`);

      // Use setImmediate to ensure proper event loop handling
      // This helps prevent IPC queue issues during rapid event streams
      setImmediate(() => {
        if (this.window && !this.window.isDestroyed()) {
          this.window.webContents.send('claude:stream', eventWithSession);
          debugLog(`[Main->Renderer] Event #${eventNum} [Session: ${this.sessionId}] Sent`);
        } else {
          debugLog(`[Main->Renderer] Event #${eventNum} SKIPPED - window destroyed after queue`);
        }
      });
    } else {
      debugLog(`[Main->Renderer] SKIPPED - window invalid!`);
    }
  }
}
