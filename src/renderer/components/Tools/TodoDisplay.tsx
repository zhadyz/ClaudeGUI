import React from 'react';
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';

interface Todo {
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  activeForm: string;
}

interface TodoDisplayProps {
  todos: Todo[];
  isStreaming?: boolean;
}

export default function TodoDisplay({ todos, isStreaming }: TodoDisplayProps) {
  if (!todos || todos.length === 0) return null;

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-color)',
        overflow: 'hidden',
        marginBottom: '12px'
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          backgroundColor: 'var(--bg-tertiary)',
          borderBottom: '1px solid var(--border-color)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px' }}>📋</span>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
            Task Progress
          </span>
        </div>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          {todos.filter(t => t.status === 'completed').length}/{todos.length} complete
        </span>
      </div>

      {/* Todo items */}
      <div style={{ padding: '8px' }}>
        {todos.map((todo, index) => (
          <TodoItem key={index} todo={todo} isStreaming={isStreaming && todo.status === 'in_progress'} />
        ))}
      </div>
    </div>
  );
}

interface TodoItemProps {
  todo: Todo;
  isStreaming?: boolean;
}

function TodoItem({ todo, isStreaming }: TodoItemProps) {
  const getStatusIcon = () => {
    switch (todo.status) {
      case 'completed':
        return <CheckCircle2 size={16} style={{ color: 'var(--accent-green)' }} />;
      case 'in_progress':
        return (
          <Loader2
            size={16}
            style={{ color: 'var(--accent-orange)', animation: 'spin 1s linear infinite' }}
          />
        );
      default:
        return <Circle size={16} style={{ color: 'var(--text-muted)' }} />;
    }
  };

  const getStatusColor = () => {
    switch (todo.status) {
      case 'completed':
        return 'var(--text-muted)';
      case 'in_progress':
        return 'var(--text-primary)';
      default:
        return 'var(--text-secondary)';
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
        padding: '8px 10px',
        borderRadius: 'var(--radius-sm)',
        backgroundColor: todo.status === 'in_progress' ? 'var(--bg-hover)' : 'transparent',
        transition: 'background-color 0.15s ease'
      }}
    >
      <div style={{ marginTop: '2px' }}>{getStatusIcon()}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: '13px',
            color: getStatusColor(),
            textDecoration: todo.status === 'completed' ? 'line-through' : 'none',
            lineHeight: 1.4
          }}
        >
          {todo.content}
        </div>
        {todo.status === 'in_progress' && (
          <div
            style={{
              fontSize: '11px',
              color: 'var(--accent-orange)',
              marginTop: '2px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <span className="animate-pulse">●</span>
            {todo.activeForm}
          </div>
        )}
      </div>
    </div>
  );
}
