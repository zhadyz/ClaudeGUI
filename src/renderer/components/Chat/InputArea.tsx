import React, { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Send, Square, Paperclip, MoreHorizontal } from 'lucide-react';

type ExecutionMode = 'act' | 'plan';

interface InputAreaProps {
  onSend: (message: string) => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled: boolean;
  slashCommands?: string[];
}

const DEFAULT_COMMANDS = [
  { command: '/help', description: 'Get help with using Claude Code' },
  { command: '/compact', description: 'Toggle compact mode' },
  { command: '/context', description: 'Show current context' },
  { command: '/cost', description: 'Show session cost breakdown' },
  { command: '/init', description: 'Initialize project settings' },
  { command: '/pr-comments', description: 'Review PR comments' },
  { command: '/release-notes', description: 'Generate release notes' },
  { command: '/review', description: 'Review code changes' },
  { command: '/security-review', description: 'Security audit' },
  { command: '/clear', description: 'Clear conversation and reset memory' },
];

// Input history storage (persisted across component re-renders)
const inputHistory: string[] = [];
const MAX_HISTORY = 50;

export default function InputArea({
  onSend,
  onStop,
  isStreaming,
  disabled,
  slashCommands = []
}: InputAreaProps) {
  const [value, setValue] = useState('');
  const [showCommands, setShowCommands] = useState(false);
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  const [mode, setMode] = useState<ExecutionMode>('act');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const commandsRef = useRef<HTMLDivElement>(null);

  // Input history navigation
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [savedCurrentInput, setSavedCurrentInput] = useState('');

  // Merge default commands with provided slash commands, deduplicating by command name
  const allCommands = (() => {
    const commandMap = new Map<string, { command: string; description: string }>();

    // Add default commands first
    DEFAULT_COMMANDS.forEach(cmd => {
      commandMap.set(cmd.command, cmd);
    });

    // Add provided slash commands (won't override existing defaults)
    slashCommands.forEach(cmd => {
      const fullCmd = cmd.startsWith('/') ? cmd : `/${cmd}`;
      if (!commandMap.has(fullCmd)) {
        commandMap.set(fullCmd, { command: fullCmd, description: '' });
      }
    });

    return Array.from(commandMap.values());
  })();

  // Filter commands based on input
  const filteredCommands = value.startsWith('/')
    ? allCommands.filter(c =>
        c.command.toLowerCase().includes(value.toLowerCase())
      )
    : [];

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [value]);

  // Focus on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Show/hide command menu
  useEffect(() => {
    if (value === '/') {
      setShowCommands(true);
      setSelectedCommandIndex(0);
    } else if (value.startsWith('/') && filteredCommands.length > 0) {
      setShowCommands(true);
    } else {
      setShowCommands(false);
    }
  }, [value, filteredCommands.length]);

  const handleSubmit = () => {
    if (value.trim() && !isStreaming && !disabled) {
      // Add to history
      if (inputHistory.length === 0 || inputHistory[0] !== value.trim()) {
        inputHistory.unshift(value.trim());
        if (inputHistory.length > MAX_HISTORY) {
          inputHistory.pop();
        }
      }
      onSend(value.trim());
      setValue('');
      setShowCommands(false);
      setHistoryIndex(-1);
      setSavedCurrentInput('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleSelectCommand = (command: string) => {
    setValue(command + ' ');
    setShowCommands(false);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (showCommands && filteredCommands.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedCommandIndex(prev =>
          prev < filteredCommands.length - 1 ? prev + 1 : 0
        );
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedCommandIndex(prev =>
          prev > 0 ? prev - 1 : filteredCommands.length - 1
        );
        return;
      }
      if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) {
        e.preventDefault();
        handleSelectCommand(filteredCommands[selectedCommandIndex].command);
        return;
      }
      if (e.key === 'Escape') {
        setShowCommands(false);
        return;
      }
    }

    // Input history navigation with up/down arrows (when cursor at start/end)
    const textarea = textareaRef.current;
    if (textarea && inputHistory.length > 0 && !showCommands) {
      const cursorAtStart = textarea.selectionStart === 0 && textarea.selectionEnd === 0;
      const cursorAtEnd = textarea.selectionStart === value.length && textarea.selectionEnd === value.length;
      const isSingleLine = !value.includes('\n');

      if (e.key === 'ArrowUp' && (cursorAtStart || isSingleLine)) {
        e.preventDefault();
        if (historyIndex === -1) {
          // Save current input before navigating history
          setSavedCurrentInput(value);
        }
        const newIndex = Math.min(historyIndex + 1, inputHistory.length - 1);
        setHistoryIndex(newIndex);
        setValue(inputHistory[newIndex]);
        return;
      }

      if (e.key === 'ArrowDown' && (cursorAtEnd || isSingleLine) && historyIndex >= 0) {
        e.preventDefault();
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        if (newIndex < 0) {
          // Restore saved current input
          setValue(savedCurrentInput);
        } else {
          setValue(inputHistory[newIndex]);
        }
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div
      style={{
        padding: '16px 24px 24px',
        backgroundColor: 'var(--bg-primary)'
      }}
    >
      <div
        style={{
          maxWidth: '768px',
          margin: '0 auto',
          position: 'relative'
        }}
      >
        {/* Slash command menu - Claude style */}
        {showCommands && filteredCommands.length > 0 && (
          <div
            ref={commandsRef}
            style={{
              position: 'absolute',
              bottom: '100%',
              left: 0,
              right: 0,
              marginBottom: '8px',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-lg)',
              maxHeight: '280px',
              overflow: 'auto',
              zIndex: 100,
              animation: 'slideUp 0.15s ease-out'
            }}
          >
            <div style={{ padding: '8px' }}>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  padding: '8px 12px 4px',
                  marginBottom: '4px'
                }}
              >
                Commands
              </div>
              {filteredCommands.map((cmd, index) => (
                <button
                  key={`cmd-${index}-${cmd.command}`}
                  onClick={() => handleSelectCommand(cmd.command)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 12px',
                    backgroundColor: index === selectedCommandIndex
                      ? 'var(--bg-hover)'
                      : 'transparent',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background-color 0.1s ease'
                  }}
                  onMouseEnter={() => setSelectedCommandIndex(index)}
                >
                  <span
                    style={{
                      width: '24px',
                      height: '24px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: 'var(--accent-orange-dim)',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--accent-orange)',
                      fontSize: '14px'
                    }}
                  >
                    /
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: 500,
                      color: 'var(--text-primary)',
                      fontFamily: 'var(--font-mono)'
                    }}>
                      {cmd.command}
                    </div>
                    {cmd.description && (
                      <div style={{
                        fontSize: '12px',
                        color: 'var(--text-muted)',
                        marginTop: '2px'
                      }}>
                        {cmd.description}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Claude-style composer input */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: '12px',
            padding: '14px 18px',
            backgroundColor: 'var(--bg-input)',
            borderRadius: '18px',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-lg)',
            transition: 'all var(--transition-normal)'
          }}
        >
          {/* Attachment button */}
          <button
            style={{
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'transparent',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              transition: 'all var(--transition-fast)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--text-muted)';
            }}
          >
            <Paperclip size={20} />
          </button>

          {/* Text input */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Reply..."
            disabled={disabled}
            rows={1}
            style={{
              flex: 1,
              resize: 'none',
              border: 'none',
              outline: 'none',
              backgroundColor: 'transparent',
              color: 'var(--text-primary)',
              fontSize: '16px',
              lineHeight: 1.5,
              fontFamily: 'var(--font-sans)',
              maxHeight: '200px',
              minHeight: '24px',
              padding: '6px 0'
            }}
          />

          {/* More options button */}
          <button
            style={{
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'transparent',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              transition: 'all var(--transition-fast)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--text-muted)';
            }}
          >
            <MoreHorizontal size={18} />
          </button>

          {/* Mode selector + Send/Stop button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {/* Mode toggle - Act/Plan */}
            <button
              onClick={() => setMode(mode === 'act' ? 'plan' : 'act')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 12px',
                backgroundColor: 'transparent',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                color: 'var(--text-secondary)',
                fontSize: '13px',
                fontWeight: 500,
                transition: 'all var(--transition-fast)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              title={mode === 'act' ? 'Click to switch to Plan mode' : 'Click to switch to Act mode'}
            >
              <span style={{ color: mode === 'act' ? 'var(--accent-orange)' : 'var(--accent-purple)' }}>
                {mode === 'act' ? 'Act' : 'Plan'}
              </span>
            </button>

            {/* Send/Stop button */}
            {isStreaming ? (
              <button
                onClick={onStop}
                style={{
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'var(--accent-red)',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  color: 'white',
                  transition: 'all var(--transition-fast)'
                }}
              >
                <Square size={14} fill="white" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!value.trim() || disabled}
                style={{
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: value.trim() ? 'var(--accent-orange)' : 'transparent',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  cursor: value.trim() ? 'pointer' : 'default',
                  color: value.trim() ? 'white' : 'var(--text-muted)',
                  transition: 'all var(--transition-fast)'
                }}
                onMouseEnter={(e) => {
                  if (value.trim()) {
                    e.currentTarget.style.backgroundColor = 'var(--accent-orange-hover)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (value.trim()) {
                    e.currentTarget.style.backgroundColor = 'var(--accent-orange)';
                  }
                }}
              >
                <Send size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Helper text - Claude style - hidden by default like Claude Desktop */}
      </div>
    </div>
  );
}
