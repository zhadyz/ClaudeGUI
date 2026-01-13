import React, { useState, useEffect, useMemo } from 'react';
import { CheckCircle2, Circle, Loader2, ChevronDown, ChevronUp } from 'lucide-react';

export interface Todo {
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  activeForm: string;
}

interface TodoDisplayProps {
  todos: Todo[];
  isStreaming: boolean;
  isVisible: boolean;
  onToggleVisibility: () => void;
  tokenCount?: number;
  startTime?: number;
  thinkingStatus?: 'idle' | 'thinking' | 'responding';
}

export default function TodoDisplay({
  todos,
  isStreaming,
  isVisible,
  onToggleVisibility,
  tokenCount = 0,
  startTime,
  thinkingStatus = 'idle'
}: TodoDisplayProps) {
  const [elapsed, setElapsed] = useState(0);

  // Update elapsed time every second when streaming
  useEffect(() => {
    if (!isStreaming || !startTime) {
      setElapsed(0);
      return;
    }

    // Immediately calculate correct elapsed time (fixes timer reset on tab switch)
    setElapsed(Math.floor((Date.now() - startTime) / 1000));

    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [isStreaming, startTime]);

  // Format elapsed time
  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  // Format token count
  const formatTokens = (count: number): string => {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}k`;
    }
    return count.toString();
  };

  // Get current active todo
  const activeTodo = useMemo(() => {
    return todos.find(t => t.status === 'in_progress');
  }, [todos]);

  // Get status text
  const statusText = useMemo(() => {
    if (thinkingStatus === 'thinking') return 'thinking';
    if (thinkingStatus === 'responding') return 'responding';
    if (activeTodo) return '';
    return '';
  }, [thinkingStatus, activeTodo]);

  // Don't render if no todos
  if (todos.length === 0) return null;

  // Collapsed view - just shows current task in a compact bar
  if (!isVisible) {
    return (
      <div
        onClick={onToggleVisibility}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          padding: '10px 16px',
          backgroundColor: 'var(--bg-tertiary)',
          borderTop: '1px solid var(--border-subtle)',
          cursor: 'pointer',
          fontSize: '13px',
          color: 'var(--text-secondary)',
          transition: 'all 0.2s ease',
          fontFamily: 'var(--font-mono)'
        }}
      >
        {isStreaming && <Loader2 size={14} className="spinning" style={{ color: 'var(--accent-orange)' }} />}
        <span style={{ color: 'var(--text-primary)' }}>
          {activeTodo?.activeForm || 'Tasks'}
        </span>
        <span style={{ opacity: 0.6 }}>
          ({todos.filter(t => t.status === 'completed').length}/{todos.length})
        </span>
        {isStreaming && startTime && (
          <>
            <span style={{ opacity: 0.4 }}>·</span>
            <span>{formatTime(elapsed)}</span>
          </>
        )}
        {tokenCount > 0 && (
          <>
            <span style={{ opacity: 0.4 }}>·</span>
            <span>↓ {formatTokens(tokenCount)} tokens</span>
          </>
        )}
        <ChevronUp size={14} style={{ marginLeft: '4px' }} />
      </div>
    );
  }

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-secondary)',
        borderTop: '1px solid var(--border-subtle)',
        overflow: 'hidden'
      }}
    >
      {/* Header with current task */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-tertiary)'
        }}
      >
        {/* Current task with animation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          {isStreaming ? (
            <Loader2 size={16} className="spinning" style={{ color: 'var(--accent-orange)' }} />
          ) : (
            <Circle size={16} style={{ color: 'var(--text-muted)' }} />
          )}
          <span style={{
            color: 'var(--text-primary)',
            fontWeight: 500,
            fontSize: '14px'
          }}>
            {activeTodo?.activeForm || 'Ready'}
            {statusText && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> · {statusText}</span>}
          </span>
        </div>

        {/* Stats row */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          fontSize: '12px',
          color: 'var(--text-muted)'
        }}>
          <span style={{ fontFamily: 'var(--font-mono)' }}>
            ctrl+c to interrupt
          </span>
          <span>·</span>
          <span style={{ fontFamily: 'var(--font-mono)' }}>
            ctrl+t to {isVisible ? 'hide' : 'show'}
          </span>
          {isStreaming && startTime && (
            <>
              <span>·</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                {formatTime(elapsed)}
              </span>
            </>
          )}
          {tokenCount > 0 && (
            <>
              <span>·</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                ↓ {formatTokens(tokenCount)} tokens
              </span>
            </>
          )}
        </div>
      </div>

      {/* Todo list */}
      <div style={{ padding: '8px 0', maxHeight: '300px', overflowY: 'auto' }}>
        {todos.map((todo, index) => (
          <div
            key={index}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              padding: '8px 16px',
              backgroundColor: todo.status === 'in_progress' ? 'var(--bg-tertiary)' : 'transparent',
              borderLeft: todo.status === 'in_progress' ? '2px solid var(--accent-orange)' : '2px solid transparent'
            }}
          >
            {/* Status icon */}
            <div style={{ marginTop: '2px' }}>
              {todo.status === 'completed' ? (
                <CheckCircle2 size={16} style={{ color: 'var(--accent-green)' }} />
              ) : todo.status === 'in_progress' ? (
                <Loader2 size={16} className="spinning" style={{ color: 'var(--accent-orange)' }} />
              ) : (
                <Circle size={16} style={{ color: 'var(--text-muted)' }} />
              )}
            </div>

            {/* Todo content */}
            <span style={{
              fontSize: '13px',
              color: todo.status === 'completed'
                ? 'var(--text-muted)'
                : todo.status === 'in_progress'
                  ? 'var(--text-primary)'
                  : 'var(--text-secondary)',
              textDecoration: todo.status === 'completed' ? 'line-through' : 'none',
              lineHeight: '1.4'
            }}>
              {todo.content}
            </span>
          </div>
        ))}
      </div>

      {/* Footer with toggle */}
      <div
        onClick={onToggleVisibility}
        style={{
          padding: '8px 16px',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          cursor: 'pointer',
          fontSize: '12px',
          color: 'var(--text-muted)',
          backgroundColor: 'var(--bg-tertiary)',
          transition: 'background-color 0.2s ease'
        }}
      >
        <ChevronDown size={14} />
        <span>Collapse</span>
      </div>
    </div>
  );
}
