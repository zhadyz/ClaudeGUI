import React from 'react';

interface Todo {
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  activeForm: string;
}

interface CurrentTaskIndicatorProps {
  todos: Todo[];
}

export default function CurrentTaskIndicator({ todos }: CurrentTaskIndicatorProps) {
  // Find the current in_progress task
  const currentTask = todos.find(t => t.status === 'in_progress');

  if (!currentTask) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 16px',
        marginBottom: '8px'
      }}
    >
      {/* Animated plus icon */}
      <span
        className="task-indicator-icon"
        style={{
          color: 'var(--accent-orange)',
          fontWeight: 700,
          fontSize: '16px'
        }}
      >
        +
      </span>

      {/* Task text with shimmer effect */}
      <span
        className="current-task-text"
        style={{
          fontSize: '14px',
          fontWeight: 500,
          background: 'linear-gradient(90deg, #C15F3C 0%, #e8845c 25%, #ff9f75 50%, #e8845c 75%, #C15F3C 100%)',
          backgroundSize: '200% 100%',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          animation: 'shimmer 2s linear infinite'
        }}
      >
        {currentTask.activeForm}...
      </span>
    </div>
  );
}
