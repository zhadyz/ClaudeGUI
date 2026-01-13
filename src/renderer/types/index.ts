// Renderer-side types

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: ContentBlock[];
  timestamp: number;
  isStreaming?: boolean;
}

export interface ContentBlock {
  id: string;
  type: 'text' | 'thinking' | 'tool_use' | 'tool_result' | 'code';
  content: string;
  isComplete?: boolean;
  // Tool-specific
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolStatus?: 'running' | 'complete' | 'error';
  // Code-specific
  language?: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  workingDirectory: string;
  createdAt: number;
  updatedAt: number;
}

export interface AppState {
  conversations: Conversation[];
  activeConversationId: string | null;
  isStreaming: boolean;
  workingDirectory: string;
  theme: 'dark' | 'light';
  sidebarOpen: boolean;
}

export type StreamEventType =
  | 'system'
  | 'message_start'
  | 'message_delta'
  | 'message_stop'
  | 'content_block_start'
  | 'content_block_delta'
  | 'content_block_stop'
  | 'result'
  | 'status'
  | 'error'
  | 'unknown';

export interface StreamEvent {
  type: StreamEventType;
  data?: any;
  error?: string;
}
