import React from 'react';
import { X, Keyboard } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutGroup {
  title: string;
  shortcuts: { keys: string[]; description: string }[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Sessions',
    shortcuts: [
      { keys: ['Ctrl', 'N'], description: 'New session' },
      { keys: ['Ctrl', 'Tab'], description: 'Next session' },
      { keys: ['Ctrl', 'Shift', 'Tab'], description: 'Previous session' },
      { keys: ['Ctrl', '1-9'], description: 'Switch to session 1-9' },
      { keys: ['Ctrl', 'W'], description: 'Close current session' },
    ]
  },
  {
    title: 'Input',
    shortcuts: [
      { keys: ['Enter'], description: 'Send message' },
      { keys: ['Shift', 'Enter'], description: 'New line' },
      { keys: ['\u2191'], description: 'Previous message (history)' },
      { keys: ['\u2193'], description: 'Next message (history)' },
      { keys: ['/'], description: 'Start slash command' },
    ]
  },
  {
    title: 'General',
    shortcuts: [
      { keys: ['Ctrl', 'C'], description: 'Stop generation' },
      { keys: ['Ctrl', 'T'], description: 'Toggle todo panel' },
      { keys: ['Ctrl', 'E'], description: 'Export as Markdown' },
      { keys: ['Ctrl', '/'], description: 'Show keyboard shortcuts' },
      { keys: ['Esc'], description: 'Close modal / cancel' },
    ]
  },
  {
    title: 'Sidebar',
    shortcuts: [
      { keys: ['Double-click'], description: 'Rename session' },
      { keys: ['\u2605'], description: 'Toggle favorite (click star)' },
    ]
  }
];

export default function KeyboardShortcutsModal({ isOpen, onClose }: KeyboardShortcutsModalProps) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        animation: 'fadeIn 0.15s ease-out'
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '600px',
          maxHeight: '80vh',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
          animation: 'slideUp 0.2s ease-out'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-color)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Keyboard size={20} style={{ color: 'var(--accent-orange)' }} />
            <h2 style={{
              fontSize: '18px',
              fontWeight: 600,
              color: 'var(--text-primary)',
              margin: 0
            }}>
              Keyboard Shortcuts
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              padding: 0,
              backgroundColor: 'transparent',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              transition: 'all var(--transition-fast)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--text-muted)';
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div
          style={{
            padding: '20px',
            overflowY: 'auto',
            maxHeight: 'calc(80vh - 60px)'
          }}
        >
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '24px'
          }}>
            {SHORTCUT_GROUPS.map((group) => (
              <div key={group.title}>
                <h3 style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: '12px'
                }}>
                  {group.title}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {group.shortcuts.map((shortcut, index) => (
                    <div
                      key={index}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px'
                      }}
                    >
                      <span style={{
                        fontSize: '13px',
                        color: 'var(--text-secondary)'
                      }}>
                        {shortcut.description}
                      </span>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        {shortcut.keys.map((key, keyIndex) => (
                          <React.Fragment key={keyIndex}>
                            {keyIndex > 0 && (
                              <span style={{
                                fontSize: '11px',
                                color: 'var(--text-muted)'
                              }}>+</span>
                            )}
                            <kbd
                              style={{
                                padding: '3px 6px',
                                backgroundColor: 'var(--bg-tertiary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: 'var(--radius-sm)',
                                fontSize: '11px',
                                fontFamily: 'var(--font-mono)',
                                color: 'var(--text-primary)',
                                minWidth: '24px',
                                textAlign: 'center'
                              }}
                            >
                              {key}
                            </kbd>
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-tertiary)',
            textAlign: 'center'
          }}
        >
          <span style={{
            fontSize: '12px',
            color: 'var(--text-muted)'
          }}>
            Press <kbd style={{
              padding: '2px 4px',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '10px',
              fontFamily: 'var(--font-mono)'
            }}>Esc</kbd> to close
          </span>
        </div>
      </div>
    </div>
  );
}
