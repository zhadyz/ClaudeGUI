import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Message, ContentBlock } from './types';
import TitleBar from './components/Layout/TitleBar';
import SessionTabs from './components/Layout/SessionTabs';
import StatusBar from './components/Layout/StatusBar';
import KeyboardShortcutsModal from './components/Layout/KeyboardShortcutsModal';
import Sidebar, { StoredSession, SessionStatus } from './components/Sidebar/Sidebar';
import ChatContainer from './components/Chat/ChatContainer';
import DirectoryPicker from './components/Chat/DirectoryPicker';
import InputArea from './components/Chat/InputArea';
import TodoDisplay from './components/TodoDisplay/TodoDisplay';
import { AlertCircle, CheckCircle, X } from 'lucide-react';
import { QuantumStreamRenderer, RenderMode } from './utils/QuantumStreamRenderer';

interface Todo {
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  activeForm: string;
}

const generateId = () => Math.random().toString(36).substring(2, 15);

interface SessionInfo {
  model: string;
  contextUsed: number;  // input_tokens - the full context window usage
  contextMax: number;
  outputTokens: number; // output_tokens for current turn (live updating)
  totalCost: number;
  slashCommands: string[];
}

interface UserInfo {
  email: string | null;
  name: string | null;
  isLoggedIn: boolean;
  subscriptionType?: string | null;
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [workingDirectory, setWorkingDirectory] = useState<string>('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<SessionInfo>({
    model: 'claude-opus-4-5-20251101',
    contextUsed: 0,
    contextMax: 200000,
    outputTokens: 0,
    totalCost: 0,
    slashCommands: []
  });

  // Session management state
  const [sessions, setSessions] = useState<StoredSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isSessionLocked, setIsSessionLocked] = useState(false);
  const [pendingDirectory, setPendingDirectory] = useState<string | null>(null);
  const [claudeSessionId, setClaudeSessionId] = useState<string | null>(null);  // Claude CLI's session ID for --resume

  // Error state for displaying errors to user
  const [error, setError] = useState<string | null>(null);
  const errorTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Success state for displaying success messages
  const [success, setSuccess] = useState<string | null>(null);
  const successTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Thinking status for status bar
  const [thinkingStatus, setThinkingStatus] = useState<'idle' | 'thinking' | 'responding'>('idle');

  // Current todo list from Claude
  const [todos, setTodos] = useState<Todo[]>([]);

  // Todo display visibility and streaming start time for timer
  const [todoVisible, setTodoVisible] = useState(true);
  const [streamStartTime, setStreamStartTime] = useState<number | null>(null);

  // Keyboard shortcuts modal visibility
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);

  // User authentication state
  const [userInfo, setUserInfo] = useState<UserInfo>({
    email: null,
    name: null,
    isLoggedIn: false
  });

  // Track session statuses for sidebar indicators
  // Computed from per-session refs: idle, active, thinking, responding, awaiting
  const [sessionStatuses, setSessionStatuses] = useState<Map<string, SessionStatus>>(new Map());

  // Track active (running) session IDs for internal process management
  const [activeSessionIds, setActiveSessionIds] = useState<string[]>([]);

  // Refs for tracking current streaming message (per-session)
  const currentMessageIdRef = useRef<string | null>(null);
  const currentBlockIndexRef = useRef<number>(0);

  // Ref for stable handleStreamEvent callback (avoids stale closure in IPC listener)
  const handleStreamEventRef = useRef<(event: any) => void>(() => {});

  // Refs for keyboard shortcut handlers (avoids stale closures and initialization order issues)
  const handleSelectSessionRef = useRef<(session: StoredSession) => void>(() => {});
  const handleNewConversationRef = useRef<() => void>(() => {});
  const handleCloseSessionRef = useRef<(sessionId: string) => void>(() => {});
  const handleExportMarkdownRef = useRef<() => void>(() => {});

  // ============================================================================
  // PER-SESSION STATE MANAGEMENT - True multi-session support
  // ============================================================================
  // These refs store state for ALL sessions, allowing background sessions to
  // continue receiving and processing events even when not the active tab.

  // Per-session messages storage
  const messagesPerSessionRef = useRef<Map<string, Message[]>>(new Map());

  // Per-session info (tokens, cost, etc.)
  const sessionInfoPerSessionRef = useRef<Map<string, SessionInfo>>(new Map());

  // Per-session todos
  const todosPerSessionRef = useRef<Map<string, Todo[]>>(new Map());

  // Per-session streaming state
  const streamingPerSessionRef = useRef<Map<string, boolean>>(new Map());

  // Per-session thinking status
  const thinkingStatusPerSessionRef = useRef<Map<string, 'idle' | 'thinking' | 'responding'>>(new Map());

  // Per-session current message ID (for streaming)
  const currentMessageIdPerSessionRef = useRef<Map<string, string | null>>(new Map());

  // Per-session current block index (for streaming)
  const currentBlockIndexPerSessionRef = useRef<Map<string, number>>(new Map());

  // Per-session Claude session ID (for --resume)
  const claudeSessionIdPerSessionRef = useRef<Map<string, string | null>>(new Map());

  // Per-session stream start time
  const streamStartTimePerSessionRef = useRef<Map<string, number | null>>(new Map());

  // Accumulator for tool JSON chunks (to avoid too many state updates) - per session
  const toolJsonAccumulatorRef = useRef<Map<string, Map<number, string>>>(new Map());
  const toolJsonFlushTimerRef = useRef<Map<string, NodeJS.Timeout | null>>(new Map());
  const lastFlushedLengthRef = useRef<Map<string, Map<number, number>>>(new Map());
  const TOOL_JSON_FLUSH_INTERVAL = 50; // Flush accumulated JSON every 50ms

  // Track tool names by block index for content_block_stop processing - per session
  const toolNameByBlockRef = useRef<Map<string, Map<number, string>>>(new Map());

  // Race condition protection: prevent concurrent session switches
  const sessionSwitchLockRef = useRef<boolean>(false);
  const sessionSwitchQueueRef = useRef<string | null>(null);

  // Helper to get or create a per-session map
  const getSessionMap = <T,>(ref: React.MutableRefObject<Map<string, Map<number, T>>>, sessionId: string): Map<number, T> => {
    if (!ref.current.has(sessionId)) {
      ref.current.set(sessionId, new Map());
    }
    return ref.current.get(sessionId)!;
  };

  // Flush accumulated tool JSON to state - ONLY if there's new content
  // Now session-aware: flushes for a specific session
  const flushToolJson = useCallback((sessionId: string, blockIndex?: number) => {
    const msgId = currentMessageIdPerSessionRef.current.get(sessionId);
    if (!msgId) return;

    const sessionAccumulator = getSessionMap(toolJsonAccumulatorRef, sessionId);
    const sessionLastFlushed = getSessionMap(lastFlushedLengthRef, sessionId);

    // If blockIndex provided, flush only that block, otherwise flush all
    const indicesToFlush = blockIndex !== undefined
      ? [blockIndex]
      : Array.from(sessionAccumulator.keys());

    if (indicesToFlush.length === 0) return;

    // Check if there's actually NEW content to flush (avoid unnecessary re-renders)
    let hasNewContent = false;
    for (const idx of indicesToFlush) {
      const accumulated = sessionAccumulator.get(idx);
      const lastFlushed = sessionLastFlushed.get(idx) || 0;
      if (accumulated && accumulated.length > lastFlushed) {
        hasNewContent = true;
        break;
      }
    }

    // Skip if nothing new to flush - this prevents blocking the event loop
    if (!hasNewContent) return;

    // Update last flushed lengths
    for (const idx of indicesToFlush) {
      const accumulated = sessionAccumulator.get(idx);
      const lastFlushed = sessionLastFlushed.get(idx) || 0;
      if (accumulated && accumulated.length > lastFlushed) {
        sessionLastFlushed.set(idx, accumulated.length);
      }
    }

    // Update the appropriate message storage (state for current, ref for background)
    const updateMessages = (msgs: Message[]): Message[] => {
      return msgs.map(msg => {
        if (msg.id === msgId) {
          const updatedContent = [...msg.content];
          for (const idx of indicesToFlush) {
            const accumulated = sessionAccumulator.get(idx);
            if (accumulated && updatedContent[idx]) {
              updatedContent[idx] = {
                ...updatedContent[idx],
                content: accumulated
              };
            }
          }
          return { ...msg, content: updatedContent };
        }
        return msg;
      });
    };

    // If current session, update state; otherwise update ref
    if (sessionId === currentSessionId) {
      setMessages(updateMessages);
    } else {
      const currentMsgs = messagesPerSessionRef.current.get(sessionId) || [];
      messagesPerSessionRef.current.set(sessionId, updateMessages(currentMsgs));
    }
  }, [currentSessionId]);

  // Start the flush timer for a session if not already running
  const ensureFlushTimer = useCallback((sessionId: string) => {
    if (!toolJsonFlushTimerRef.current.has(sessionId) || toolJsonFlushTimerRef.current.get(sessionId) === null) {
      const timer = setInterval(() => {
        flushToolJson(sessionId);
      }, TOOL_JSON_FLUSH_INTERVAL);
      toolJsonFlushTimerRef.current.set(sessionId, timer);
    }
  }, [flushToolJson]);

  // Stop the flush timer for a session
  const stopFlushTimer = useCallback((sessionId: string) => {
    const timer = toolJsonFlushTimerRef.current.get(sessionId);
    if (timer !== null && timer !== undefined) {
      clearInterval(timer);
      toolJsonFlushTimerRef.current.set(sessionId, null);
    }
  }, []);

  // Stop all flush timers
  const stopAllFlushTimers = useCallback(() => {
    toolJsonFlushTimerRef.current.forEach((timer, sessionId) => {
      if (timer !== null) {
        clearInterval(timer);
        toolJsonFlushTimerRef.current.set(sessionId, null);
      }
    });
  }, []);

  // QuantumStreamRenderer for buttery-smooth 360Hz streaming - per session
  const quantumRendererRef = useRef<Map<string, Map<number, QuantumStreamRenderer>>>(new Map());
  const [streamMode, setStreamMode] = useState<RenderMode>('smooth');

  // Create or get QuantumStreamRenderer for a specific session and block index
  const getQuantumRenderer = useCallback((sessionId: string, blockIndex: number) => {
    if (!quantumRendererRef.current.has(sessionId)) {
      quantumRendererRef.current.set(sessionId, new Map());
    }
    const sessionRenderers = quantumRendererRef.current.get(sessionId)!;

    if (!sessionRenderers.has(blockIndex)) {
      const renderer = new QuantumStreamRenderer(
        // onRender callback - update message content for this session
        (text: string) => {
          const msgId = currentMessageIdPerSessionRef.current.get(sessionId);
          if (msgId) {
            const updateFn = (msgs: Message[]): Message[] => msgs.map(msg => {
              if (msg.id === msgId) {
                const updatedContent = [...msg.content];
                if (updatedContent[blockIndex]) {
                  updatedContent[blockIndex] = {
                    ...updatedContent[blockIndex],
                    content: updatedContent[blockIndex].content + text
                  };
                }
                return { ...msg, content: updatedContent };
              }
              return msg;
            });

            // Update state for current session, ref for background sessions
            if (sessionId === currentSessionId) {
              setMessages(updateFn);
            } else {
              const currentMsgs = messagesPerSessionRef.current.get(sessionId) || [];
              messagesPerSessionRef.current.set(sessionId, updateFn(currentMsgs));
            }
          }
        },
        // onScroll callback - handled by ChatContainer
        undefined,
        // onModeChange callback
        (mode: RenderMode) => {
          if (sessionId === currentSessionId) {
            setStreamMode(mode);
          }
        }
      );
      sessionRenderers.set(blockIndex, renderer);
    }
    return sessionRenderers.get(blockIndex)!;
  }, [currentSessionId]);

  // Cleanup renderers for a specific session
  const cleanupQuantumRenderers = useCallback((sessionId: string) => {
    const sessionRenderers = quantumRendererRef.current.get(sessionId);
    if (sessionRenderers) {
      sessionRenderers.forEach(renderer => {
        renderer.flush();
        renderer.destroy();
      });
      sessionRenderers.clear();
    }
  }, []);

  // Cleanup all renderers for all sessions
  const cleanupAllQuantumRenderers = useCallback(() => {
    quantumRendererRef.current.forEach((sessionRenderers) => {
      sessionRenderers.forEach(renderer => {
        renderer.flush();
        renderer.destroy();
      });
      sessionRenderers.clear();
    });
    quantumRendererRef.current.clear();
  }, []);

  // Show error toast with auto-dismiss
  const showError = useCallback((message: string) => {
    setError(message);
    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current);
    }
    errorTimeoutRef.current = setTimeout(() => {
      setError(null);
    }, 5000);
  }, []);

  // Show success toast with auto-dismiss
  const showSuccess = useCallback((message: string) => {
    setSuccess(message);
    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current);
    }
    successTimeoutRef.current = setTimeout(() => {
      setSuccess(null);
    }, 3000);
  }, []);

  // Load sessions and user info on mount
  useEffect(() => {
    window.electronAPI.sessions.load().then(setSessions);
    window.electronAPI.auth.getUser().then(setUserInfo);
  }, []);

  // Note: Keyboard shortcuts useEffect is defined later after handler functions are defined

  // Update session statuses for sidebar indicators
  // This computes the status based on streaming/thinking state for each session
  const updateSessionStatuses = useCallback(() => {
    const newStatuses = new Map<string, SessionStatus>();

    // Go through all known sessions
    for (const session of sessions) {
      const sessionId = session.id;
      const isActive = activeSessionIds.includes(sessionId);
      const isSessionStreaming = streamingPerSessionRef.current.get(sessionId) || false;
      const sessionThinkingStatus = thinkingStatusPerSessionRef.current.get(sessionId) || 'idle';

      let status: SessionStatus;

      if (isSessionStreaming) {
        // Currently streaming - check thinking status
        if (sessionThinkingStatus === 'thinking') {
          status = 'thinking';
        } else if (sessionThinkingStatus === 'responding') {
          status = 'responding';
        } else {
          status = 'responding'; // Default to responding if streaming
        }
      } else if (isActive) {
        // Process is running but not streaming - awaiting response
        status = 'awaiting';
      } else {
        // Not active
        status = 'idle';
      }

      newStatuses.set(sessionId, status);
    }

    setSessionStatuses(newStatuses);
  }, [sessions, activeSessionIds]);

  // Update session statuses periodically and when relevant state changes
  useEffect(() => {
    updateSessionStatuses();
  }, [updateSessionStatuses, isStreaming, thinkingStatus]);

  // Also update on interval to catch changes from refs
  useEffect(() => {
    const interval = setInterval(updateSessionStatuses, 500);
    return () => clearInterval(interval);
  }, [updateSessionStatuses]);

  // Ref to get latest handleStopGeneration without stale closure
  const handleStopGenerationRef = useRef<() => void>(() => {});

  // Initialize and listen for Claude events
  useEffect(() => {
    // Listen for initial CWD from main process (command line --cwd arg)
    const unsubInit = window.electronAPI.claude.onInit(({ cwd }) => {
      // If launched with --cwd, auto-select that directory
      setPendingDirectory(cwd);
    });

    // Listen for stream events (use ref for latest handler to avoid stale closure)
    const unsubStream = window.electronAPI.claude.onStream((event: any) => {
      handleStreamEventRef.current(event);
    });

    // Note: Initial status check is no longer needed as we manage
    // processes per-session. Each session will start its own process.

    return () => {
      unsubInit();
      unsubStream();
    };
  }, []);

  const startClaude = async (sessionId: string, cwd: string, resumeId?: string) => {
    try {
      const result = await window.electronAPI.claude.start(sessionId, cwd, resumeId);
      if (result.success) {
        setIsConnected(true);
        // Add to active sessions
        setActiveSessionIds(prev => prev.includes(sessionId) ? prev : [...prev, sessionId]);
      } else if (result.error) {
        showError(result.error);
      }
    } catch (err) {
      showError(`Failed to start Claude: ${(err as Error).message}`);
    }
  };

  // Generate a smart title from the first user message
  const generateAutoTitle = useCallback((firstMessage: string): string => {
    if (!firstMessage || firstMessage.trim().length === 0) {
      return 'New Session';
    }

    // Clean up the message
    let title = firstMessage.trim();

    // Remove leading slash commands
    if (title.startsWith('/')) {
      const parts = title.split(' ');
      if (parts.length > 1) {
        title = parts.slice(1).join(' ');
      }
    }

    // If it starts with common phrases, trim them for brevity
    const trimPhrases = [
      'can you ', 'could you ', 'please ', 'help me ', "i'd like to ",
      'i want to ', 'i need to ', 'how do i ', 'how can i ', 'what is ',
      'explain ', 'show me ', 'tell me '
    ];
    const lowerTitle = title.toLowerCase();
    for (const phrase of trimPhrases) {
      if (lowerTitle.startsWith(phrase)) {
        title = title.slice(phrase.length);
        // Capitalize first letter
        title = title.charAt(0).toUpperCase() + title.slice(1);
        break;
      }
    }

    // Take first sentence or first 60 chars, whichever is shorter
    const sentenceEnd = title.search(/[.!?]/);
    if (sentenceEnd > 0 && sentenceEnd < 60) {
      title = title.slice(0, sentenceEnd);
    } else if (title.length > 60) {
      // Find a good break point (space, comma, etc.)
      const breakPoint = title.slice(0, 60).lastIndexOf(' ');
      if (breakPoint > 30) {
        title = title.slice(0, breakPoint) + '...';
      } else {
        title = title.slice(0, 57) + '...';
      }
    }

    // Final cleanup - remove trailing punctuation except ...
    title = title.replace(/[,;:]+$/, '').trim();

    return title || 'New Session';
  }, []);

  // Save session to storage (metadata + messages)
  const saveSession = useCallback(async (title?: string) => {
    if (!currentSessionId || !workingDirectory) return;

    // Get existing session title or generate new one
    const existingTitle = sessions.find(s => s.id === currentSessionId)?.title;
    const firstUserMessage = messages.find(m => m.role === 'user')?.content[0]?.content;
    const autoTitle = existingTitle && existingTitle !== 'New Session'
      ? existingTitle
      : generateAutoTitle(firstUserMessage || '');

    // Track total cost - accumulate from current turn
    const existingCost = sessions.find(s => s.id === currentSessionId)?.totalCost || 0;
    const accumulatedCost = Math.max(existingCost, sessionInfo.totalCost);

    const session: StoredSession = {
      id: currentSessionId,
      title: title || autoTitle,
      workingDirectory,
      createdAt: sessions.find(s => s.id === currentSessionId)?.createdAt || Date.now(),
      updatedAt: Date.now(),
      messageCount: messages.length,
      claudeSessionId: claudeSessionId || sessions.find(s => s.id === currentSessionId)?.claudeSessionId,
      totalCost: accumulatedCost
    };

    // Save session metadata
    const updated = await window.electronAPI.sessions.save(session);
    setSessions(updated);

    // Save messages separately
    if (messages.length > 0) {
      await window.electronAPI.messages.save(currentSessionId, messages);
    }
  }, [currentSessionId, workingDirectory, messages, sessions, claudeSessionId, generateAutoTitle, sessionInfo.totalCost]);

  // Auto-save session when messages change
  useEffect(() => {
    if (isSessionLocked && currentSessionId && messages.length > 0) {
      saveSession();
    }
  }, [messages.length, isSessionLocked, currentSessionId]);

  const handleStreamEvent = useCallback((event: any) => {
    const eventSessionId = event.sessionId;
    const isCurrentSession = eventSessionId === currentSessionId;


    // ============================================================================
    // HELPER: Update messages for any session (state for current, ref for background)
    // ============================================================================
    const updateSessionMessages = (sessionId: string, updateFn: (msgs: Message[]) => Message[]) => {
      if (sessionId === currentSessionId) {
        setMessages(updateFn);
      } else {
        const currentMsgs = messagesPerSessionRef.current.get(sessionId) || [];
        messagesPerSessionRef.current.set(sessionId, updateFn(currentMsgs));
      }
    };

    // ============================================================================
    // HELPER: Update session info for any session
    // ============================================================================
    const updateSessionInfo = (sessionId: string, updateFn: (info: SessionInfo) => SessionInfo) => {
      if (sessionId === currentSessionId) {
        setSessionInfo(updateFn);
      } else {
        const currentInfo = sessionInfoPerSessionRef.current.get(sessionId) || {
          model: 'claude-opus-4-5-20251101',
          contextUsed: 0,
          contextMax: 200000,
          outputTokens: 0,
          totalCost: 0,
          slashCommands: []
        };
        sessionInfoPerSessionRef.current.set(sessionId, updateFn(currentInfo));
      }
    };

    // Handle internal status events from our main process
    if (event.type === 'status') {
      if (eventSessionId) {
        if (event.status === 'started') {
          setActiveSessionIds(prev => prev.includes(eventSessionId) ? prev : [...prev, eventSessionId]);
          if (isCurrentSession) setIsConnected(true);
        } else if (event.status === 'stopped') {
          setActiveSessionIds(prev => prev.filter(id => id !== eventSessionId));
          streamingPerSessionRef.current.set(eventSessionId, false);
          if (isCurrentSession) {
            setIsConnected(false);
            setIsStreaming(false);
          }
        }
      }
      return;
    }

    if (event.type === 'error') {
      streamingPerSessionRef.current.set(eventSessionId, false);
      thinkingStatusPerSessionRef.current.set(eventSessionId, 'idle');
      if (isCurrentSession) {
        setIsStreaming(false);
        setThinkingStatus('idle');
        showError(event.error || 'An error occurred');
      }
      return;
    }

    if (event.type === 'heartbeat') {
      return; // Just for activity tracking, already handled above
    }

    // Handle Claude stream-json format
    let data = event.data;
    if (!data) return;

    // Claude CLI wraps streaming events in 'stream_event' - unwrap them
    if (event.type === 'stream_event' && data.event) {
      data = data.event;
    }

    // Need a valid session ID for processing content events
    if (!eventSessionId) return;

    switch (data.type) {
      case 'system':
        if (data.subtype === 'init') {
          if (isCurrentSession) setIsConnected(true);
          updateSessionInfo(eventSessionId, prev => ({
            ...prev,
            model: data.model || prev.model,
            slashCommands: data.slash_commands || prev.slashCommands
          }));
          if (data.session_id) {
            claudeSessionIdPerSessionRef.current.set(eventSessionId, data.session_id);
            if (isCurrentSession) setClaudeSessionId(data.session_id);
          }
          // Capture user info from init event (if available)
          if (data.user || data.email || data.account) {
            setUserInfo({
              email: data.email || data.user?.email || data.account?.email || null,
              name: data.name || data.user?.name || data.account?.name || null,
              isLoggedIn: true
            });
          }
        }
        break;

      case 'message_start': {
        streamingPerSessionRef.current.set(eventSessionId, true);
        streamStartTimePerSessionRef.current.set(eventSessionId, Date.now());
        const newMessageId = generateId();
        currentMessageIdPerSessionRef.current.set(eventSessionId, newMessageId);
        currentBlockIndexPerSessionRef.current.set(eventSessionId, 0);

        if (isCurrentSession) {
          setIsStreaming(true);
          setStreamStartTime(Date.now());
          currentMessageIdRef.current = newMessageId;
          currentBlockIndexRef.current = 0;
        }

        if (data.message?.usage) {
          updateSessionInfo(eventSessionId, prev => ({
            ...prev,
            contextUsed: data.message.usage.input_tokens || 0,
            outputTokens: data.message.usage.output_tokens || 0
          }));
        }

        const newMessage: Message = {
          id: newMessageId,
          role: 'assistant',
          content: [],
          timestamp: Date.now(),
          isStreaming: true
        };
        updateSessionMessages(eventSessionId, prev => [...prev, newMessage]);
        break;
      }

      case 'content_block_start': {
        const msgId = currentMessageIdPerSessionRef.current.get(eventSessionId);
        if (msgId && data.content_block) {
          const block = data.content_block;
          let blockType: ContentBlock['type'] = 'text';
          const blockIndex = data.index ?? (currentBlockIndexPerSessionRef.current.get(eventSessionId) || 0);

          if (block.type === 'thinking') {
            blockType = 'thinking';
            thinkingStatusPerSessionRef.current.set(eventSessionId, 'thinking');
            if (isCurrentSession) setThinkingStatus('thinking');
          } else if (block.type === 'tool_use') {
            blockType = 'tool_use';
            const sessionToolNames = getSessionMap(toolNameByBlockRef, eventSessionId);
            if (block.name) sessionToolNames.set(blockIndex, block.name);
            if (block.name === 'TodoWrite' && block.input?.todos) {
              todosPerSessionRef.current.set(eventSessionId, block.input.todos);
              if (isCurrentSession) setTodos(block.input.todos);
            }
          } else if (block.type === 'text') {
            thinkingStatusPerSessionRef.current.set(eventSessionId, 'responding');
            if (isCurrentSession) setThinkingStatus('responding');
          }

          const newBlock: ContentBlock = {
            id: generateId(),
            type: blockType,
            content: block.text || block.thinking || '',
            isComplete: false,
            toolName: block.name,
            toolInput: block.input,
            toolStatus: blockType === 'tool_use' ? 'running' : undefined
          };

          updateSessionMessages(eventSessionId, prev => prev.map(msg => {
            if (msg.id === msgId) {
              return { ...msg, content: [...msg.content, newBlock] };
            }
            return msg;
          }));

          currentBlockIndexPerSessionRef.current.set(eventSessionId, blockIndex);
          if (isCurrentSession) currentBlockIndexRef.current = blockIndex;
        }
        break;
      }

      case 'content_block_delta': {
        const msgId = currentMessageIdPerSessionRef.current.get(eventSessionId);
        if (msgId && data.delta) {
          const delta = data.delta;
          const blockIndex = data.index ?? (currentBlockIndexPerSessionRef.current.get(eventSessionId) || 0);

          if (delta.type === 'text_delta' || delta.type === 'thinking_delta') {
            const textToAppend = delta.type === 'text_delta' ? (delta.text || '') : (delta.thinking || '');
            if (textToAppend) {
              const renderer = getQuantumRenderer(eventSessionId, blockIndex);
              renderer.onData(textToAppend);
            }
          } else if (delta.type === 'input_json_delta') {
            const jsonChunk = delta.partial_json || '';
            if (jsonChunk) {
              const sessionAccumulator = getSessionMap(toolJsonAccumulatorRef, eventSessionId);
              const current = sessionAccumulator.get(blockIndex) || '';
              sessionAccumulator.set(blockIndex, current + jsonChunk);
              ensureFlushTimer(eventSessionId);
            }
          }
        }
        break;
      }

      case 'content_block_stop': {
        const msgId = currentMessageIdPerSessionRef.current.get(eventSessionId);
        if (msgId) {
          const blockIndex = data.index ?? (currentBlockIndexPerSessionRef.current.get(eventSessionId) || 0);

          // Flush QuantumStreamRenderer for this session/block
          const sessionRenderers = quantumRendererRef.current.get(eventSessionId);
          if (sessionRenderers) {
            const renderer = sessionRenderers.get(blockIndex);
            if (renderer) {
              renderer.flush();
              renderer.destroy();
              sessionRenderers.delete(blockIndex);
            }
          }

          // Get accumulated JSON
          const sessionAccumulator = getSessionMap(toolJsonAccumulatorRef, eventSessionId);
          const finalJsonContent = sessionAccumulator.get(blockIndex);
          sessionAccumulator.delete(blockIndex);
          if (sessionAccumulator.size === 0) {
            stopFlushTimer(eventSessionId);
          }

          // Get tool name and parse JSON
          const sessionToolNames = getSessionMap(toolNameByBlockRef, eventSessionId);
          const storedToolName = sessionToolNames.get(blockIndex);
          let preParsedInput: any = null;

          if (storedToolName && finalJsonContent) {
            try {
              preParsedInput = JSON.parse(finalJsonContent);
              if (storedToolName === 'TodoWrite' && preParsedInput?.todos) {
                todosPerSessionRef.current.set(eventSessionId, preParsedInput.todos);
                if (isCurrentSession) setTodos(preParsedInput.todos);
              }
            } catch (e) {
              // Silently ignore partial JSON parsing errors during streaming
            }
          }
          sessionToolNames.delete(blockIndex);

          updateSessionMessages(eventSessionId, prev => prev.map(msg => {
            if (msg.id === msgId) {
              const updatedContent = [...msg.content];
              if (updatedContent[blockIndex]) {
                const block = updatedContent[blockIndex];
                const jsonContent = finalJsonContent || block.content;
                let parsedInput = preParsedInput || block.toolInput;
                if (!preParsedInput && block.type === 'tool_use' && jsonContent) {
                  try { parsedInput = JSON.parse(jsonContent); } catch (e) {}
                }
                updatedContent[blockIndex] = {
                  ...block,
                  content: jsonContent,
                  isComplete: true,
                  toolInput: parsedInput,
                  toolStatus: block.toolStatus ? 'complete' : undefined
                };
              }
              return { ...msg, content: updatedContent };
            }
            return msg;
          }));
        }
        break;
      }

      case 'message_delta':
        if (data.usage?.output_tokens) {
          updateSessionInfo(eventSessionId, prev => ({
            ...prev,
            outputTokens: data.usage.output_tokens
          }));
        }
        break;

      case 'message_stop': {
        const msgId = currentMessageIdPerSessionRef.current.get(eventSessionId);
        if (msgId) {
          updateSessionMessages(eventSessionId, prev => prev.map(msg => {
            if (msg.id === msgId) {
              return { ...msg, isStreaming: false };
            }
            return msg;
          }));
        }
        break;
      }

      case 'assistant': {
        // Full assistant message (fallback for non-streaming)
        streamingPerSessionRef.current.set(eventSessionId, false);
        if (isCurrentSession) setIsStreaming(false);

        const msgId = currentMessageIdPerSessionRef.current.get(eventSessionId);
        if (data.message?.content && !msgId) {
          const contentBlocks: ContentBlock[] = data.message.content.map((block: any) => {
            if (block.type === 'text') {
              return {
                id: generateId(),
                type: 'text' as const,
                content: block.text || '',
                isComplete: true
              };
            } else if (block.type === 'thinking') {
              return {
                id: generateId(),
                type: 'thinking' as const,
                content: block.thinking || '',
                isComplete: true
              };
            } else if (block.type === 'tool_use') {
              return {
                id: generateId(),
                type: 'tool_use' as const,
                content: JSON.stringify(block.input || {}, null, 2),
                toolName: block.name,
                toolInput: block.input,
                isComplete: true,
                toolStatus: 'complete' as const
              };
            }
            return {
              id: generateId(),
              type: 'text' as const,
              content: JSON.stringify(block),
              isComplete: true
            };
          });

          const assistantMessage: Message = {
            id: data.uuid || generateId(),
            role: 'assistant',
            content: contentBlocks,
            timestamp: Date.now(),
            isStreaming: false
          };

          updateSessionMessages(eventSessionId, prev => [...prev, assistantMessage]);
        }
        break;
      }

      case 'result': {
        // Final result - conversation turn complete
        streamingPerSessionRef.current.set(eventSessionId, false);
        thinkingStatusPerSessionRef.current.set(eventSessionId, 'idle');
        streamStartTimePerSessionRef.current.set(eventSessionId, null);
        currentMessageIdPerSessionRef.current.set(eventSessionId, null);
        currentBlockIndexPerSessionRef.current.set(eventSessionId, 0);

        if (isCurrentSession) {
          setIsStreaming(false);
          setThinkingStatus('idle');
          setStreamStartTime(null);
          currentMessageIdRef.current = null;
          currentBlockIndexRef.current = 0;
        }

        // Cleanup QuantumStreamRenderers for this session
        cleanupQuantumRenderers(eventSessionId);

        // Cleanup tool JSON accumulator and tool name tracking for this session
        stopFlushTimer(eventSessionId);
        const sessionAccumulator = toolJsonAccumulatorRef.current.get(eventSessionId);
        if (sessionAccumulator) sessionAccumulator.clear();
        const sessionLastFlushed = lastFlushedLengthRef.current.get(eventSessionId);
        if (sessionLastFlushed) sessionLastFlushed.clear();
        const sessionToolNames = toolNameByBlockRef.current.get(eventSessionId);
        if (sessionToolNames) sessionToolNames.clear();

        // Update session info with final usage data
        if (data.usage) {
          updateSessionInfo(eventSessionId, prev => ({
            ...prev,
            contextUsed: data.usage.input_tokens || prev.contextUsed,
            outputTokens: data.usage.output_tokens || 0,
            totalCost: data.total_cost_usd || prev.totalCost
          }));
        }
        break;
      }
    }
  }, [getQuantumRenderer, cleanupQuantumRenderers, ensureFlushTimer, stopFlushTimer, showError, currentSessionId]);

  // Keep the ref updated with the latest handleStreamEvent
  useEffect(() => {
    handleStreamEventRef.current = handleStreamEvent;
  }, [handleStreamEvent]);

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isStreaming) return;

    // Handle /clear command - clear messages AND restart Claude process
    if (text.trim() === '/clear') {
      setMessages([]);
      currentMessageIdRef.current = null;
      currentBlockIndexRef.current = 0;
      setSessionInfo(prev => ({
        ...prev,
        contextUsed: 0,
        outputTokens: 0,
        totalCost: 0
      }));
      // Restart Claude process to clear its memory
      if (currentSessionId && workingDirectory) {
        await window.electronAPI.claude.stop(currentSessionId);
        await startClaude(currentSessionId, workingDirectory);
      }
      return;
    }

    // If session isn't locked yet, lock it and create new session
    let sessionId = currentSessionId;
    if (!isSessionLocked && pendingDirectory) {
      sessionId = generateId();
      setCurrentSessionId(sessionId);
      setWorkingDirectory(pendingDirectory);
      setIsSessionLocked(true);
      await startClaude(sessionId, pendingDirectory);
    }

    if (!sessionId) {
      showError('No session active. Please select a directory.');
      return;
    }

    // Lazy init: Start Claude if not running for this session
    if (isSessionLocked && !isConnected && workingDirectory) {
      await startClaude(sessionId, workingDirectory, claudeSessionId || undefined);
    }

    // Reset streaming refs
    currentMessageIdRef.current = null;
    currentBlockIndexRef.current = 0;

    // Add user message
    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content: [{ id: generateId(), type: 'text', content: text, isComplete: true }],
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, userMessage]);
    setIsStreaming(true);

    // Send to Claude with session ID
    await window.electronAPI.claude.send(sessionId, text);
  };

  const handleStopGeneration = async () => {
    if (!currentSessionId) return;

    const sessionId = currentSessionId; // Capture for closure safety

    try {
      await window.electronAPI.claude.stop(sessionId);
      // Remove from active sessions
      setActiveSessionIds(prev => prev.filter(id => id !== sessionId));
    } catch (_err) {
      // Stop operation may fail if process already terminated
    }

    setIsStreaming(false);
    streamingPerSessionRef.current.set(sessionId, false);
    thinkingStatusPerSessionRef.current.set(sessionId, 'idle');
    setThinkingStatus('idle');

    currentMessageIdRef.current = null;
    currentMessageIdPerSessionRef.current.set(sessionId, null);
    currentBlockIndexPerSessionRef.current.set(sessionId, 0);

    // Cleanup accumulators for THIS session only (not all sessions)
    stopFlushTimer(sessionId);
    const sessionAccumulator = toolJsonAccumulatorRef.current.get(sessionId);
    if (sessionAccumulator) sessionAccumulator.clear();
    const sessionLastFlushed = lastFlushedLengthRef.current.get(sessionId);
    if (sessionLastFlushed) sessionLastFlushed.clear();
    const sessionToolNames = toolNameByBlockRef.current.get(sessionId);
    if (sessionToolNames) sessionToolNames.clear();

    // Cleanup quantum renderers for THIS session
    cleanupQuantumRenderers(sessionId);
  };

  // Keep the stop generation ref updated for keyboard shortcuts
  useEffect(() => {
    handleStopGenerationRef.current = handleStopGeneration;
  }, [handleStopGeneration]);

  const handleNewConversation = async () => {
    // Save current session before switching
    if (isSessionLocked && currentSessionId) {
      await saveSession();
    }

    // Note: We don't stop the current session's process - it keeps running
    // in the background so user can switch back to it later

    // Reset state for new session
    setMessages([]);
    setTodos([]);
    setCurrentSessionId(null);
    setWorkingDirectory('');
    setPendingDirectory(null);
    setIsSessionLocked(false);
    setIsConnected(false);
    setClaudeSessionId(null);  // Clear Claude session ID for new conversation
    currentMessageIdRef.current = null;
    currentBlockIndexRef.current = 0;
    setSessionInfo(prev => ({
      ...prev,
      contextUsed: 0,
      outputTokens: 0,
      totalCost: 0
    }));
  };

  const handleSelectSession = async (session: StoredSession) => {
    // If selecting current session, do nothing
    if (session.id === currentSessionId) return;

    // Race condition protection: if already switching, queue this request
    if (sessionSwitchLockRef.current) {
      sessionSwitchQueueRef.current = session.id;
      return;
    }

    // Acquire lock
    sessionSwitchLockRef.current = true;
    const targetSessionId = session.id;

    try {
      // ============================================================================
      // SAVE CURRENT SESSION STATE to refs before switching
      // ============================================================================
      if (currentSessionId) {
      // Save current messages to ref
      messagesPerSessionRef.current.set(currentSessionId, messages);

      // Save current session info to ref
      sessionInfoPerSessionRef.current.set(currentSessionId, sessionInfo);

      // Save current todos to ref
      todosPerSessionRef.current.set(currentSessionId, todos);

      // Save streaming state
      streamingPerSessionRef.current.set(currentSessionId, isStreaming);
      thinkingStatusPerSessionRef.current.set(currentSessionId, thinkingStatus);
      streamStartTimePerSessionRef.current.set(currentSessionId, streamStartTime);

      // Save Claude session ID
      if (claudeSessionId) {
        claudeSessionIdPerSessionRef.current.set(currentSessionId, claudeSessionId);
      }

      // Save current message tracking refs
      currentMessageIdPerSessionRef.current.set(currentSessionId, currentMessageIdRef.current);
      currentBlockIndexPerSessionRef.current.set(currentSessionId, currentBlockIndexRef.current);

      // Persist to disk
      if (isSessionLocked) {
        await saveSession();
      }
    }

    // ============================================================================
    // RESTORE NEW SESSION STATE from refs (or load from disk if not in memory)
    // ============================================================================

    // Check if we have this session's messages in memory
    let newMessages = messagesPerSessionRef.current.get(session.id);
    if (!newMessages) {
      // Load from disk
      newMessages = await window.electronAPI.messages.load(session.id);
      if (newMessages && newMessages.length > 0) {
        messagesPerSessionRef.current.set(session.id, newMessages);
      }
    }

    // Restore session info from ref
    const savedSessionInfo = sessionInfoPerSessionRef.current.get(session.id);

    // Restore todos from ref
    const savedTodos = todosPerSessionRef.current.get(session.id);

    // Restore streaming state from ref
    const savedIsStreaming = streamingPerSessionRef.current.get(session.id) || false;
    const savedThinkingStatus = thinkingStatusPerSessionRef.current.get(session.id) || 'idle';
    const savedStreamStartTime = streamStartTimePerSessionRef.current.get(session.id) || null;

    // Restore Claude session ID
    const savedClaudeSessionId = claudeSessionIdPerSessionRef.current.get(session.id) || session.claudeSessionId || null;

    // Restore message tracking refs
    currentMessageIdRef.current = currentMessageIdPerSessionRef.current.get(session.id) || null;
    currentBlockIndexRef.current = currentBlockIndexPerSessionRef.current.get(session.id) || 0;

    // Switch to selected session - update all state
    setCurrentSessionId(session.id);
    setWorkingDirectory(session.workingDirectory);
    setPendingDirectory(session.workingDirectory);
    setIsSessionLocked(true);
    setMessages(newMessages || []);
    setTodos(savedTodos || []);
    setClaudeSessionId(savedClaudeSessionId);
    setIsStreaming(savedIsStreaming);
    setThinkingStatus(savedThinkingStatus);
    setStreamStartTime(savedStreamStartTime);

    // Restore session info or use defaults
    if (savedSessionInfo) {
      setSessionInfo(savedSessionInfo);
    } else {
      setSessionInfo(prev => ({
        ...prev,
        contextUsed: 0,
        outputTokens: 0,
        totalCost: session.totalCost || 0
      }));
    }

    // Check if this session already has a running Claude process
    const status = await window.electronAPI.claude.status(targetSessionId);
    setIsConnected(status.running);
    } catch (_err) {
      showError('Failed to switch session');
    } finally {
      // Release lock
      sessionSwitchLockRef.current = false;

      // Process queued session switch if any
      const queuedSessionId = sessionSwitchQueueRef.current;
      if (queuedSessionId && queuedSessionId !== currentSessionId) {
        sessionSwitchQueueRef.current = null;
        const queuedSession = sessions.find(s => s.id === queuedSessionId);
        if (queuedSession) {
          // Use setTimeout to allow current state updates to complete
          setTimeout(() => handleSelectSession(queuedSession), 0);
        }
      }
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    const updated = await window.electronAPI.sessions.delete(sessionId);
    setSessions(updated);

    // If deleting current session, start fresh
    if (sessionId === currentSessionId) {
      await handleNewConversation();
    }
  };

  // Close/stop a session's process (without deleting it)
  const handleCloseSession = async (sessionId: string) => {
    try {
      await window.electronAPI.claude.stop(sessionId);
      setActiveSessionIds(prev => prev.filter(id => id !== sessionId));

      // Clear streaming state for this session
      streamingPerSessionRef.current.set(sessionId, false);
      thinkingStatusPerSessionRef.current.set(sessionId, 'idle');

      // If closing current session, just reset streaming state
      if (sessionId === currentSessionId) {
        setIsStreaming(false);
        setThinkingStatus('idle');
        setIsConnected(false);
      }

      // Force status update
      updateSessionStatuses();
    } catch (_err) {
      // Session close may fail silently
    }
  };

  const handleSelectDirectory = (path: string) => {
    setPendingDirectory(path);
  };

  // Toggle session favorite status
  const handleToggleFavorite = async (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      const updatedSession: StoredSession = {
        ...session,
        favorite: !session.favorite
      };
      const updated = await window.electronAPI.sessions.save(updatedSession);
      setSessions(updated);
    }
  };

  // Rename a session
  const handleRenameSession = async (sessionId: string, newTitle: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (session && newTitle !== session.title) {
      const updatedSession: StoredSession = {
        ...session,
        title: newTitle
      };
      const updated = await window.electronAPI.sessions.save(updatedSession);
      setSessions(updated);
    }
  };

  // Export conversation as Markdown
  const handleExportMarkdown = useCallback(async () => {
    if (messages.length === 0) {
      showError('No messages to export');
      return;
    }

    // Convert messages to Markdown
    const markdown = messagesToMarkdown(messages, workingDirectory);

    // Generate default filename from session title or first message
    const currentSession = sessions.find(s => s.id === currentSessionId);
    const title = currentSession?.title || 'conversation';
    const safeName = title.replace(/[^a-z0-9]/gi, '_').slice(0, 50);
    const defaultPath = `${safeName}_${new Date().toISOString().split('T')[0]}.md`;

    // Show save dialog
    const result = await window.electronAPI.dialog.saveFile({
      defaultPath,
      filters: [
        { name: 'Markdown', extensions: ['md'] },
        { name: 'Text', extensions: ['txt'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (!result.canceled && result.filePath) {
      const writeResult = await window.electronAPI.file.write(result.filePath, markdown);
      if (writeResult.success) {
        const fileName = result.filePath.split(/[/\\]/).pop();
        showSuccess(`Exported to ${fileName}`);
      } else {
        showError(`Failed to save: ${writeResult.error}`);
      }
    }
  }, [messages, workingDirectory, sessions, currentSessionId, showError, showSuccess]);

  // Keep handler refs updated (no deps array to avoid initialization order issues)
  useEffect(() => {
    handleSelectSessionRef.current = handleSelectSession;
    handleNewConversationRef.current = handleNewConversation;
    handleCloseSessionRef.current = handleCloseSession;
    handleExportMarkdownRef.current = handleExportMarkdown;
  });

  // Keyboard shortcuts - uses refs to avoid initialization order issues
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+T: Toggle todo visibility
      if (e.ctrlKey && e.key === 't') {
        e.preventDefault();
        setTodoVisible(prev => !prev);
      }
      // Ctrl+C: Stop generation (only when streaming)
      if (e.ctrlKey && e.key === 'c' && isStreaming && currentSessionId) {
        e.preventDefault();
        handleStopGenerationRef.current();
      }

      // Tab switching shortcuts
      // Ctrl+Tab / Ctrl+Shift+Tab: Cycle through sessions
      if (e.ctrlKey && e.key === 'Tab') {
        e.preventDefault();
        if (sessions.length > 1 && currentSessionId) {
          const currentIndex = sessions.findIndex(s => s.id === currentSessionId);
          let nextIndex: number;
          if (e.shiftKey) {
            // Go backwards
            nextIndex = currentIndex <= 0 ? sessions.length - 1 : currentIndex - 1;
          } else {
            // Go forwards
            nextIndex = currentIndex >= sessions.length - 1 ? 0 : currentIndex + 1;
          }
          handleSelectSessionRef.current(sessions[nextIndex]);
        }
      }

      // Ctrl+1-9: Switch to specific session by position
      if (e.ctrlKey && !e.shiftKey && !e.altKey) {
        const num = parseInt(e.key);
        if (num >= 1 && num <= 9 && num <= sessions.length) {
          e.preventDefault();
          handleSelectSessionRef.current(sessions[num - 1]);
        }
      }

      // Ctrl+N: New session
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        handleNewConversationRef.current();
      }

      // Ctrl+W: Close current session (stop process)
      if (e.ctrlKey && e.key === 'w' && currentSessionId) {
        e.preventDefault();
        handleCloseSessionRef.current(currentSessionId);
      }

      // Ctrl+/: Show keyboard shortcuts
      if (e.ctrlKey && e.key === '/') {
        e.preventDefault();
        setShowShortcutsModal(prev => !prev);
      }

      // Ctrl+E: Export conversation as Markdown
      if (e.ctrlKey && e.key === 'e' && messages.length > 0) {
        e.preventDefault();
        handleExportMarkdownRef.current();
      }

      // Escape: Close modals
      if (e.key === 'Escape') {
        if (showShortcutsModal) {
          setShowShortcutsModal(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isStreaming, currentSessionId, sessions, showShortcutsModal, messages.length]);

  // Convert messages to Markdown format
  const messagesToMarkdown = (msgs: Message[], workDir: string): string => {
    const lines: string[] = [];

    // Header
    lines.push('# Conversation Export');
    lines.push('');
    lines.push(`**Working Directory:** \`${workDir || 'N/A'}\``);
    lines.push(`**Date:** ${new Date().toLocaleString()}`);
    lines.push(`**Messages:** ${msgs.length}`);
    lines.push('');
    lines.push('---');
    lines.push('');

    // Messages
    for (const msg of msgs) {
      const role = msg.role === 'user' ? '👤 User' : '🤖 Assistant';
      lines.push(`## ${role}`);
      lines.push('');

      for (const block of msg.content) {
        switch (block.type) {
          case 'text':
            lines.push(block.content);
            lines.push('');
            break;
          case 'thinking':
            lines.push('<details>');
            lines.push('<summary>💭 Thinking</summary>');
            lines.push('');
            lines.push(block.content);
            lines.push('');
            lines.push('</details>');
            lines.push('');
            break;
          case 'tool_use':
            lines.push(`\`\`\`${block.toolName || 'tool'}`);
            if (block.toolInput) {
              lines.push(JSON.stringify(block.toolInput, null, 2));
            } else if (block.content) {
              lines.push(block.content);
            }
            lines.push('```');
            lines.push('');
            break;
          case 'tool_result':
            lines.push('> Tool Result:');
            lines.push('```');
            lines.push(block.content.slice(0, 2000)); // Limit tool output
            if (block.content.length > 2000) {
              lines.push('... (truncated)');
            }
            lines.push('```');
            lines.push('');
            break;
          default:
            lines.push(block.content);
            lines.push('');
        }
      }

      lines.push('---');
      lines.push('');
    }

    return lines.join('\n');
  };

  // Determine if we should show the directory picker
  const showDirectoryPicker = !isSessionLocked && messages.length === 0;

  return (
    <div className="app-container" style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      backgroundColor: 'var(--bg-primary)'
    }}>
      <TitleBar
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        workingDirectory={workingDirectory || pendingDirectory || ''}
      />

      {/* Chrome-like tabs for active sessions */}
      <SessionTabs
        sessions={sessions}
        currentSessionId={currentSessionId}
        sessionStatuses={sessionStatuses}
        onSelectSession={handleSelectSession}
        onCloseSession={handleCloseSession}
        onNewSession={handleNewConversation}
      />

      <div style={{
        display: 'flex',
        flex: 1,
        overflow: 'hidden',
        position: 'relative'
      }}>
        {sidebarOpen && (
          <Sidebar
            workingDirectory={workingDirectory}
            onNewConversation={handleNewConversation}
            onSelectSession={handleSelectSession}
            onDeleteSession={handleDeleteSession}
            onToggleFavorite={handleToggleFavorite}
            onRenameSession={handleRenameSession}
            sessions={sessions}
            currentSessionId={currentSessionId}
            isConnected={isConnected}
            isSessionLocked={isSessionLocked}
            sessionStatuses={sessionStatuses}
            userInfo={userInfo}
            onLogin={async () => {
              const result = await window.electronAPI.auth.login();
              if (result.success) {
                const user = await window.electronAPI.auth.getUser();
                setUserInfo(user);
              }
            }}
            onLogout={async () => {
              await window.electronAPI.auth.logout();
              setUserInfo({ email: null, name: null, isLoggedIn: false });
            }}
          />
        )}

        {/* ASCII Claude Logo - Bottom Left of Main Content */}
        <div style={{
          position: 'absolute',
          bottom: '4px',
          left: sidebarOpen ? '236px' : '16px',
          zIndex: 10,
          userSelect: 'none',
          pointerEvents: 'none',
          fontFamily: '"Courier New", Courier, monospace',
          fontSize: '6px',
          lineHeight: '1.0',
          letterSpacing: '0px',
          color: 'var(--accent-orange)',
          whiteSpace: 'pre',
          opacity: 0.6
        }}>
{`   ████████████████████████
   ████████████████████████
   █████  ███████████  ████
   █████  ███████████  ████
   ████████████████████████
██████████████████████████████
██████████████████████████████
   ████████████████████████
   ████████████████████████
     ██ ██          ██ ██
     ██ ██          ██ ██`}
        </div>

        {showDirectoryPicker ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <DirectoryPicker
              onSelectDirectory={handleSelectDirectory}
              selectedPath={pendingDirectory}
            />
            {/* Show input area when directory is selected */}
            {pendingDirectory && (
              <InputArea
                onSend={handleSendMessage}
                onStop={handleStopGeneration}
                isStreaming={false}
                disabled={false}
                slashCommands={sessionInfo.slashCommands}
              />
            )}
          </div>
        ) : (
          <ChatContainer
            messages={messages}
            isStreaming={isStreaming}
            onSendMessage={handleSendMessage}
            onStopGeneration={handleStopGeneration}
            onExportMarkdown={handleExportMarkdown}
            slashCommands={sessionInfo.slashCommands}
            todos={todos}
            todoVisible={todoVisible}
            onToggleTodoVisibility={() => setTodoVisible(!todoVisible)}
            tokenCount={sessionInfo.outputTokens}
            streamStartTime={streamStartTime}
            thinkingStatus={thinkingStatus}
          />
        )}
      </div>

      <StatusBar
        model={sessionInfo.model}
        contextUsed={sessionInfo.contextUsed}
        contextMax={sessionInfo.contextMax}
        outputTokens={sessionInfo.outputTokens}
        totalCost={sessionInfo.totalCost}
        isConnected={isConnected}
        isStreaming={isStreaming}
        thinkingStatus={thinkingStatus}
      />

      {/* Error Toast */}
      {error && (
        <div
          style={{
            position: 'fixed',
            bottom: '48px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 16px',
            backgroundColor: 'var(--accent-red-bg)',
            border: '1px solid var(--accent-red)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--accent-red)',
            fontSize: '14px',
            zIndex: 1000,
            animation: 'slideUp 0.3s ease-out',
            maxWidth: '500px'
          }}
        >
          <AlertCircle size={18} />
          <span style={{ flex: 1 }}>{error}</span>
          <button
            onClick={() => setError(null)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--accent-red)',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Success Toast */}
      {success && (
        <div
          style={{
            position: 'fixed',
            bottom: '48px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 16px',
            backgroundColor: 'var(--accent-green-bg)',
            border: '1px solid var(--accent-green)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--accent-green)',
            fontSize: '14px',
            zIndex: 1000,
            animation: 'slideUp 0.3s ease-out',
            maxWidth: '500px'
          }}
        >
          <CheckCircle size={18} />
          <span style={{ flex: 1 }}>{success}</span>
          <button
            onClick={() => setSuccess(null)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--accent-green)',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Keyboard Shortcuts Modal */}
      <KeyboardShortcutsModal
        isOpen={showShortcutsModal}
        onClose={() => setShowShortcutsModal(false)}
      />
    </div>
  );
}
