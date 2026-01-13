import React, { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import { Message } from '../../types';
import MessageList from './MessageList';
import InputArea from './InputArea';
import TodoDisplay from '../TodoDisplay/TodoDisplay';
import AnimatedClaudeLogo, { ClaudeLogo } from './AnimatedClaudeLogo';
import MessageActions from './MessageActions';

interface Todo {
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  activeForm: string;
}

// Creative thinking words that rotate while Claude processes
const THINKING_WORDS = [
  'Thinking',
  'Pondering',
  'Simmering',
  'Brewing',
  'Coalescing',
  'Contemplating',
  'Ruminating',
  'Percolating',
  'Musing',
  'Cogitating',
  'Mulling',
  'Synthesizing',
  'Crystallizing',
  'Distilling',
  'Weaving',
  'Composing',
  'Formulating'
];

// RAF-based scroll to prevent layout thrashing
let scrollRafId: number | null = null;

interface ChatContainerProps {
  messages: Message[];
  isStreaming: boolean;
  onSendMessage: (message: string) => void;
  onStopGeneration: () => void;
  onExportMarkdown?: () => void;
  slashCommands?: string[];
  todos?: Todo[];
  todoVisible?: boolean;
  onToggleTodoVisibility?: () => void;
  tokenCount?: number;
  streamStartTime?: number | null;
  thinkingStatus?: 'idle' | 'thinking' | 'responding';
}

export default function ChatContainer({
  messages,
  isStreaming,
  onSendMessage,
  onStopGeneration,
  onExportMarkdown,
  slashCommands = [],
  todos = [],
  todoVisible = true,
  onToggleTodoVisibility,
  tokenCount = 0,
  streamStartTime,
  thinkingStatus = 'idle'
}: ChatContainerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [thinkingWordIndex, setThinkingWordIndex] = useState(() => Math.floor(Math.random() * THINKING_WORDS.length));

  // Get current running tool info - check for toolStatus === 'running' or isComplete === false
  const runningToolInfo = useMemo(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role === 'assistant') {
      const runningTool = lastMessage.content.find(
        block => block.type === 'tool_use' && (block.toolStatus === 'running' || !block.isComplete)
      );
      if (runningTool && runningTool.type === 'tool_use') {
        return {
          name: runningTool.toolName || runningTool.name,
          input: runningTool.toolInput || runningTool.input
        };
      }
    }
    return null;
  }, [messages]);

  const hasRunningTool = runningToolInfo !== null;

  // Get current in_progress todo
  const currentTodo = useMemo(() => {
    return todos.find(t => t.status === 'in_progress');
  }, [todos]);

  // Get meaningful status text based on what's happening
  const statusText = useMemo(() => {
    // Priority 1: Show current running tool action
    if (runningToolInfo) {
      const { name, input } = runningToolInfo;
      const inputObj = typeof input === 'string' ? {} : (input || {}) as Record<string, any>;

      // Use Claude's description field if available (this is dynamic like Claude Code)
      if (inputObj.description && typeof inputObj.description === 'string') {
        return inputObj.description;
      }

      // Fallback to formatted tool-specific messages
      switch (name) {
        case 'Write':
          return `Writing ${inputObj.file_path?.split(/[/\\]/).pop() || 'file'}`;
        case 'Edit':
          return `Editing ${inputObj.file_path?.split(/[/\\]/).pop() || 'file'}`;
        case 'Read':
          return `Reading ${inputObj.file_path?.split(/[/\\]/).pop() || 'file'}`;
        case 'Bash':
          const cmd = inputObj.command?.split(' ')[0] || 'command';
          return `Running ${cmd}`;
        case 'Glob':
          return `Searching for ${inputObj.pattern || 'files'}`;
        case 'Grep':
          return `Searching for "${inputObj.pattern?.slice(0, 20) || 'pattern'}"`;
        case 'WebFetch':
          return 'Fetching webpage';
        case 'WebSearch':
          return 'Searching the web';
        case 'TodoWrite':
          return 'Updating task list';
        case 'Task':
          return inputObj.description || 'Running subtask';
        default:
          return `Running ${name}`;
      }
    }

    // Priority 2: Show current todo activeForm
    if (currentTodo) {
      return currentTodo.activeForm;
    }

    // Priority 3: Fall back to thinking words
    return THINKING_WORDS[thinkingWordIndex];
  }, [runningToolInfo, currentTodo, thinkingWordIndex]);

  // Rotate thinking words every 2-3 seconds (only used as fallback now)
  useEffect(() => {
    if (!isStreaming && !hasRunningTool) return;
    // Only rotate if we're using the fallback thinking words
    if (runningToolInfo || currentTodo) return;

    const interval = setInterval(() => {
      setThinkingWordIndex(prev => (prev + 1) % THINKING_WORDS.length);
    }, 2000 + Math.random() * 1000);

    return () => clearInterval(interval);
  }, [isStreaming, hasRunningTool, runningToolInfo, currentTodo]);

  // RAF-batched auto-scroll to prevent layout thrashing
  const scrollToBottom = useCallback(() => {
    if (scrollRafId !== null) return; // Already scheduled

    scrollRafId = requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
      scrollRafId = null;
    });
  }, []);

  // Auto-scroll on new messages (RAF-batched)
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Determine animation state based on streaming and content
  // - pulsing: thinking (no content yet)
  // - spinning: generating content
  // - static: done (only when isStreaming is false AND no running tools)
  const animationState = useMemo(() => {
    // If globally streaming, always show animation
    if (isStreaming) {
      // Check if the last assistant message has any text content
      const lastMessage = messages[messages.length - 1];
      if (lastMessage?.role === 'assistant') {
        const hasTextContent = lastMessage.content.some(
          block => block.type === 'text' && block.content && block.content.length > 0
        );
        return hasTextContent ? 'spinning' as const : 'pulsing' as const;
      }
      return 'pulsing' as const;
    }

    // If not streaming but there's a running tool, keep spinning
    if (hasRunningTool) return 'spinning' as const;

    // Only static when completely done
    return 'static' as const;
  }, [isStreaming, messages, hasRunningTool]);

  // Get the full text content of the last assistant message for copy
  const lastAssistantContent = useMemo(() => {
    const lastAssistantMessage = [...messages].reverse().find(m => m.role === 'assistant');
    if (!lastAssistantMessage) return '';

    return lastAssistantMessage.content
      .filter(block => block.type === 'text')
      .map(block => block.content)
      .join('\n');
  }, [messages]);

  // Check if there's any assistant message
  const hasAssistantMessage = messages.some(m => m.role === 'assistant');

  const isEmpty = messages.length === 0;

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--bg-primary)',
        overflow: 'hidden'
      }}
    >
      {isEmpty ? (
        <EmptyState />
      ) : (
        <div
          ref={scrollRef}
          className="chat-scroll-container"
          style={{
            flex: 1,
            overflowX: 'hidden'
          }}
        >
          <MessageList messages={messages} isStreaming={isStreaming} />

          {/* Action buttons and Claude logo at bottom */}
          {(hasAssistantMessage || isStreaming) && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                padding: '0 24px 16px',
                maxWidth: '800px',
                margin: '0 auto',
                width: '100%',
                boxSizing: 'border-box'
              }}
            >
              {/* Action buttons - only show when not streaming and has content */}
              {!isStreaming && hasAssistantMessage && (
                <div style={{ marginBottom: '16px' }}>
                  <MessageActions content={lastAssistantContent} onExport={onExportMarkdown} />
                </div>
              )}

              {/* Claude logo with status text - shows what Claude is doing */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: animationState !== 'static' ? '8px' : '0' }}>
                <AnimatedClaudeLogo size={32} animation={animationState} />
                {animationState !== 'static' && (
                  <span
                    style={{
                      fontSize: '14px',
                      fontStyle: 'italic',
                      color: 'var(--accent-orange)',
                      transition: 'opacity 0.3s ease',
                      animation: 'fadeIn 0.3s ease-out'
                    }}
                  >
                    {statusText}...
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Todo Display - shows above input when Claude has todos */}
      <TodoDisplay
        todos={todos}
        isStreaming={isStreaming}
        isVisible={todoVisible}
        onToggleVisibility={onToggleTodoVisibility || (() => {})}
        tokenCount={tokenCount}
        startTime={streamStartTime || undefined}
        thinkingStatus={thinkingStatus}
      />

      <InputArea
        onSend={onSendMessage}
        onStop={onStopGeneration}
        isStreaming={isStreaming}
        disabled={false}
        slashCommands={slashCommands}
      />
    </div>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px',
        textAlign: 'center'
      }}
    >
      {/* Claude logo */}
      <div
        style={{
          marginBottom: '24px',
          animation: 'fadeIn 0.5s ease-out'
        }}
      >
        <ClaudeLogo size={64} />
      </div>

      <h1
        style={{
          fontSize: '28px',
          fontWeight: 500,
          color: 'var(--text-primary)',
          marginBottom: '12px',
          fontFamily: 'var(--font-serif)',
          animation: 'fadeIn 0.5s ease-out 0.1s both'
        }}
      >
        How can I help you today?
      </h1>

      <p
        style={{
          fontSize: '16px',
          color: 'var(--text-secondary)',
          maxWidth: '420px',
          lineHeight: 1.6,
          animation: 'fadeIn 0.5s ease-out 0.2s both'
        }}
      >
        I can help you with coding, debugging, and exploring your codebase.
        Ask me anything about your project.
      </p>

      {/* Quick action chips - Claude style */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '10px',
          marginTop: '32px',
          justifyContent: 'center',
          maxWidth: '500px',
          animation: 'fadeIn 0.5s ease-out 0.3s both'
        }}
      >
        {[
          'Explain this codebase',
          'Find bugs in my code',
          'Write tests',
          'Refactor this function'
        ].map((suggestion) => (
          <button
            key={suggestion}
            style={{
              padding: '10px 18px',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-full)',
              color: 'var(--text-secondary)',
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
              fontFamily: 'var(--font-sans)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent-orange)';
              e.currentTarget.style.color = 'var(--text-primary)';
              e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-color)';
              e.currentTarget.style.color = 'var(--text-secondary)';
              e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
            }}
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}
