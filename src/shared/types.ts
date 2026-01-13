// Shared types between main and renderer processes

export interface ClaudeMessage {
  id: string;
  role: 'user' | 'assistant';
  content: ContentBlock[];
  timestamp: number;
}

export interface ContentBlock {
  type: 'text' | 'thinking' | 'tool_use' | 'tool_result';
  content: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  isCollapsed?: boolean;
}

export interface StreamEvent {
  type: 'system' | 'assistant' | 'user' | 'result';
  subtype?: 'init' | 'message' | 'tool_use' | 'tool_result' | 'thinking';
  message?: ClaudeStreamMessage;
  content?: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  error?: string;
}

export interface ClaudeStreamMessage {
  type: string;
  content?: Array<{
    type: string;
    text?: string;
    name?: string;
    input?: Record<string, unknown>;
  }>;
}

export interface ConversationState {
  id: string;
  messages: ClaudeMessage[];
  workingDirectory: string;
  isStreaming: boolean;
  createdAt: number;
}

export interface AppSettings {
  theme: 'dark' | 'light' | 'system';
  fontSize: number;
  showThinking: boolean;
}

// IPC Channel types
export interface IpcChannels {
  'claude:start': { cwd: string };
  'claude:send': { message: string };
  'claude:stream': StreamEvent;
  'claude:stop': void;
  'claude:status': { running: boolean; cwd: string | null };
  'window:minimize': void;
  'window:maximize': void;
  'window:close': void;
}
