import React, { useState, useMemo } from 'react';
import { Sparkles, ChevronDown, Folder, Trash2, Clock, Loader2, Star, Search, X, LogIn, LogOut, User } from 'lucide-react';

export interface StoredSession {
  id: string;
  title: string;
  workingDirectory: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  claudeSessionId?: string;  // Claude CLI's session ID for --resume
  totalCost?: number;        // Accumulated cost in USD
  favorite?: boolean;        // Pinned to top of list
}

// Session status for indicators
export type SessionStatus = 'idle' | 'active' | 'thinking' | 'responding' | 'awaiting';

// User authentication info
export interface UserInfo {
  email: string | null;
  name: string | null;
  isLoggedIn: boolean;
  subscriptionType?: string | null;
}

interface SidebarProps {
  workingDirectory: string;
  onNewConversation: () => void;
  onSelectSession: (session: StoredSession) => void;
  onDeleteSession: (sessionId: string) => void;
  onToggleFavorite?: (sessionId: string) => void;
  onRenameSession?: (sessionId: string, newTitle: string) => void;
  sessions: StoredSession[];
  currentSessionId: string | null;
  isConnected: boolean;
  isSessionLocked: boolean;
  // New: per-session status map for indicators
  sessionStatuses?: Map<string, SessionStatus>;
  // User authentication
  userInfo?: UserInfo;
  onLogin?: () => void;
  onLogout?: () => void;
}

// Session status indicator component
function SessionIndicator({ status }: { status: SessionStatus }) {
  switch (status) {
    case 'thinking':
      // Spinner when Claude is thinking
      return (
        <Loader2
          size={12}
          className="spinning"
          style={{
            color: 'var(--accent-orange)',
            flexShrink: 0
          }}
          title="Claude is thinking..."
        />
      );

    case 'responding':
      // Spinner when Claude is actively responding
      return (
        <Loader2
          size={12}
          className="spinning"
          style={{
            color: 'var(--accent-green)',
            flexShrink: 0
          }}
          title="Claude is responding..."
        />
      );

    case 'active':
      // Green dot when process is running but idle
      return (
        <div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: 'var(--accent-green)',
            flexShrink: 0,
            boxShadow: '0 0 4px var(--accent-green)'
          }}
          title="Connected - ready"
        />
      );

    case 'awaiting':
      // Pulsing green dot when awaiting user response
      return (
        <div
          className="pulse-slow"
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: 'var(--accent-green)',
            flexShrink: 0
          }}
          title="Awaiting your response"
        />
      );

    case 'idle':
    default:
      // Grey dot when inactive
      return (
        <div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: 'var(--text-muted)',
            flexShrink: 0,
            opacity: 0.5
          }}
          title="Inactive"
        />
      );
  }
}

export default function Sidebar({
  workingDirectory,
  onNewConversation,
  onSelectSession,
  onDeleteSession,
  onToggleFavorite,
  onRenameSession,
  sessions,
  currentSessionId,
  isConnected,
  isSessionLocked,
  sessionStatuses = new Map(),
  userInfo,
  onLogin,
  onLogout
}: SidebarProps) {
  const [hoveredSession, setHoveredSession] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  // Inline rename state
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  // Search/filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  // User dropdown menu state
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Filter sessions by search query
  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const query = searchQuery.toLowerCase();
    return sessions.filter(session =>
      session.title.toLowerCase().includes(query) ||
      session.workingDirectory.toLowerCase().includes(query)
    );
  }, [sessions, searchQuery]);

  // Sort sessions: Active first, then favorites, then by recency
  const sortedSessions = useMemo(() => {
    return [...filteredSessions].sort((a, b) => {
      const aStatus = sessionStatuses.get(a.id) || 'idle';
      const bStatus = sessionStatuses.get(b.id) || 'idle';
      const aIsActive = aStatus !== 'idle';
      const bIsActive = bStatus !== 'idle';

      // Active sessions first
      if (aIsActive && !bIsActive) return -1;
      if (!aIsActive && bIsActive) return 1;

      // Then favorites
      if (a.favorite && !b.favorite) return -1;
      if (!a.favorite && b.favorite) return 1;

      // Then by recency
      return b.updatedAt - a.updatedAt;
    });
  }, [filteredSessions, sessionStatuses]);

  const formatPath = (path: string) => {
    if (!path) return '';
    const parts = path.replace(/\\/g, '/').split('/');
    return parts[parts.length - 1] || parts[parts.length - 2] || path;
  };

  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  const formatCost = (cost: number | undefined) => {
    if (!cost || cost === 0) return null;
    if (cost < 0.01) return `<$0.01`;
    return `$${cost.toFixed(2)}`;
  };

  const handleDeleteClick = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    setShowDeleteConfirm(sessionId);
  };

  const confirmDelete = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    onDeleteSession(sessionId);
    setShowDeleteConfirm(null);
  };

  // Get session status - defaults to 'idle'
  const getSessionStatus = (sessionId: string): SessionStatus => {
    return sessionStatuses.get(sessionId) || 'idle';
  };

  return (
    <div
      style={{
        width: '220px',
        height: '100%',
        backgroundColor: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      {/* New Session Button - Claude style */}
      <div style={{ padding: '12px 12px 8px' }}>
        <button
          onClick={onNewConversation}
          style={{
            width: '100%',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '0 12px',
            backgroundColor: 'transparent',
            color: 'var(--text-primary)',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontSize: '14px',
            fontWeight: 400,
            cursor: 'pointer',
            transition: 'all var(--transition-fast)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <Sparkles size={16} style={{ color: 'var(--accent-orange)' }} />
          <span>New session</span>
        </button>
      </div>

      {/* Current Working Directory */}
      {workingDirectory && isSessionLocked && (
        <div style={{
          padding: '8px 12px',
          margin: '0 12px 8px',
          backgroundColor: 'var(--bg-tertiary)',
          borderRadius: 'var(--radius-md)',
          fontSize: '12px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            color: 'var(--text-tertiary)',
            marginBottom: '4px'
          }}>
            <Folder size={12} />
            <span>Working in</span>
          </div>
          <div style={{
            color: 'var(--text-primary)',
            fontWeight: 500,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }} title={workingDirectory}>
            {formatPath(workingDirectory)}
          </div>
        </div>
      )}

      {/* Sessions Section Header */}
      <div style={{
        padding: '16px 12px 8px',
        fontSize: '12px',
        fontWeight: 500,
        color: 'var(--text-tertiary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <span>Sessions {sessions.length > 0 && `(${sessions.length})`}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {isConnected && (
            <div
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: 'var(--accent-green)'
              }}
              title="Connected"
            />
          )}
          {sessions.length > 3 && (
            <button
              onClick={() => {
                setShowSearch(!showSearch);
                if (showSearch) {
                  setSearchQuery('');
                }
              }}
              style={{
                padding: '2px',
                backgroundColor: showSearch ? 'var(--bg-hover)' : 'transparent',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                color: showSearch ? 'var(--text-primary)' : 'var(--text-muted)',
                transition: 'all var(--transition-fast)'
              }}
              onMouseEnter={(e) => {
                if (!showSearch) {
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }
              }}
              onMouseLeave={(e) => {
                if (!showSearch) {
                  e.currentTarget.style.color = 'var(--text-muted)';
                }
              }}
              title="Search sessions"
            >
              <Search size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Search Input */}
      {showSearch && (
        <div style={{
          padding: '0 12px 8px',
          position: 'relative'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 8px',
            backgroundColor: 'var(--bg-tertiary)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)'
          }}>
            <Search size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search sessions..."
              autoFocus
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                backgroundColor: 'transparent',
                color: 'var(--text-primary)',
                fontSize: '12px',
                fontFamily: 'inherit'
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  padding: '2px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  color: 'var(--text-muted)'
                }}
              >
                <X size={10} />
              </button>
            )}
          </div>
          {searchQuery && (
            <div style={{
              fontSize: '10px',
              color: 'var(--text-muted)',
              marginTop: '4px',
              paddingLeft: '4px'
            }}>
              {filteredSessions.length} of {sessions.length} sessions
            </div>
          )}
        </div>
      )}

      {/* Sessions List */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '0 6px'
      }}>
        {sortedSessions.length === 0 ? (
          <div style={{
            padding: '20px 12px',
            color: 'var(--text-muted)',
            fontSize: '12px',
            textAlign: 'center'
          }}>
            No sessions yet
          </div>
        ) : (
          sortedSessions.map((session) => {
            const status = getSessionStatus(session.id);
            const isCurrentSession = currentSessionId === session.id;

            return (
              <div
                key={session.id}
                onClick={() => onSelectSession(session)}
                onMouseEnter={() => setHoveredSession(session.id)}
                onMouseLeave={() => {
                  setHoveredSession(null);
                  if (showDeleteConfirm === session.id) {
                    setShowDeleteConfirm(null);
                  }
                }}
                style={{
                  width: '100%',
                  padding: '10px 10px',
                  backgroundColor: isCurrentSession
                    ? 'var(--accent-orange-dim)'
                    : hoveredSession === session.id
                      ? 'var(--bg-hover)'
                      : 'transparent',
                  border: isCurrentSession
                    ? '1px solid var(--accent-orange)'
                    : '1px solid transparent',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all var(--transition-fast)',
                  marginBottom: '2px',
                  position: 'relative'
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '8px'
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '13px',
                      color: 'var(--text-primary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      marginBottom: '4px',
                      fontWeight: isCurrentSession ? 500 : 400,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      {/* Session status indicator */}
                      <SessionIndicator status={status} />
                      {/* Inline editable title */}
                      {editingSessionId === session.id ? (
                        <input
                          type="text"
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              if (editingTitle.trim() && onRenameSession) {
                                onRenameSession(session.id, editingTitle.trim());
                              }
                              setEditingSessionId(null);
                            } else if (e.key === 'Escape') {
                              setEditingSessionId(null);
                            }
                          }}
                          onBlur={() => {
                            if (editingTitle.trim() && onRenameSession) {
                              onRenameSession(session.id, editingTitle.trim());
                            }
                            setEditingSessionId(null);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          autoFocus
                          style={{
                            flex: 1,
                            padding: '2px 4px',
                            fontSize: '13px',
                            fontWeight: isCurrentSession ? 500 : 400,
                            color: 'var(--text-primary)',
                            backgroundColor: 'var(--bg-tertiary)',
                            border: '1px solid var(--accent-orange)',
                            borderRadius: 'var(--radius-sm)',
                            outline: 'none'
                          }}
                        />
                      ) : (
                        <span
                          style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            cursor: onRenameSession ? 'text' : 'default'
                          }}
                          onDoubleClick={(e) => {
                            if (onRenameSession) {
                              e.stopPropagation();
                              setEditingSessionId(session.id);
                              setEditingTitle(session.title);
                            }
                          }}
                          title={onRenameSession ? 'Double-click to rename' : undefined}
                        >
                          {session.title}
                        </span>
                      )}
                    </div>
                    <div style={{
                      fontSize: '11px',
                      color: 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      <Folder size={10} />
                      <span style={{
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '100px'
                      }}>
                        {formatPath(session.workingDirectory)}
                      </span>
                    </div>
                    <div style={{
                      fontSize: '10px',
                      color: 'var(--text-muted)',
                      marginTop: '2px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <Clock size={9} />
                      {formatTime(session.updatedAt)}
                      <span style={{ marginLeft: '4px' }}>
                        · {session.messageCount} msgs
                      </span>
                      {formatCost(session.totalCost) && (
                        <span style={{
                          marginLeft: '4px',
                          color: 'var(--accent-green)'
                        }}>
                          · {formatCost(session.totalCost)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action buttons - favorite always visible if set, delete on hover */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px'
                  }}>
                    {/* Favorite button - visible when favorited or on hover */}
                    {(session.favorite || hoveredSession === session.id) && onToggleFavorite && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleFavorite(session.id);
                        }}
                        style={{
                          padding: '4px',
                          backgroundColor: 'transparent',
                          color: session.favorite ? 'var(--accent-orange)' : 'var(--text-muted)',
                          border: 'none',
                          borderRadius: 'var(--radius-sm)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          transition: 'color var(--transition-fast)'
                        }}
                        onMouseEnter={(e) => {
                          if (!session.favorite) {
                            e.currentTarget.style.color = 'var(--accent-orange)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!session.favorite) {
                            e.currentTarget.style.color = 'var(--text-muted)';
                          }
                        }}
                        title={session.favorite ? 'Unpin' : 'Pin to top'}
                      >
                        <Star size={12} fill={session.favorite ? 'currentColor' : 'none'} />
                      </button>
                    )}

                    {/* Delete button - shows on hover */}
                    {hoveredSession === session.id && (
                      <>
                        {showDeleteConfirm === session.id ? (
                          <button
                            onClick={(e) => confirmDelete(e, session.id)}
                            style={{
                              padding: '4px 8px',
                              backgroundColor: 'var(--accent-red)',
                              color: 'white',
                              border: 'none',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: '10px',
                              cursor: 'pointer',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            Confirm
                          </button>
                        ) : (
                          <button
                            onClick={(e) => handleDeleteClick(e, session.id)}
                            style={{
                              padding: '4px',
                              backgroundColor: 'transparent',
                              color: 'var(--text-muted)',
                              border: 'none',
                              borderRadius: 'var(--radius-sm)',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              transition: 'color var(--transition-fast)'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = 'var(--accent-red)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = 'var(--text-muted)';
                            }}
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* User Profile Section - Bottom */}
      <div style={{
        padding: '12px',
        paddingBottom: '8px',
        borderTop: '1px solid var(--border-subtle)',
        position: 'relative'
      }}>
        {userInfo?.isLoggedIn ? (
          <>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px',
                backgroundColor: showUserMenu ? 'var(--bg-hover)' : 'transparent',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                transition: 'background-color var(--transition-fast)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
              }}
              onMouseLeave={(e) => {
                if (!showUserMenu) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              {/* User Avatar */}
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: 'var(--accent-orange)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '12px',
                fontWeight: 600
              }}>
                {userInfo.email ? userInfo.email[0].toUpperCase() : userInfo.name ? userInfo.name[0].toUpperCase() : 'U'}
              </div>
              <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <span style={{
                    fontSize: '13px',
                    color: 'var(--text-primary)',
                    fontWeight: 500
                  }}>
                    {userInfo.email || userInfo.name || 'Logged In'}
                  </span>
                  {userInfo.subscriptionType && (
                    <span style={{
                      fontSize: '9px',
                      color: 'var(--accent-orange)',
                      backgroundColor: 'rgba(255, 149, 0, 0.15)',
                      padding: '2px 5px',
                      borderRadius: '3px',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      {userInfo.subscriptionType}
                    </span>
                  )}
                </div>
                <div style={{
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  Claude Account
                </div>
              </div>
              <ChevronDown
                size={14}
                style={{
                  color: 'var(--text-muted)',
                  transform: showUserMenu ? 'rotate(180deg)' : 'rotate(0)',
                  transition: 'transform var(--transition-fast)'
                }}
              />
            </button>

            {/* User dropdown menu */}
            {showUserMenu && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '100%',
                  left: '12px',
                  right: '12px',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: 'var(--shadow-lg)',
                  marginBottom: '4px',
                  overflow: 'hidden',
                  zIndex: 100
                }}
              >
                {onLogout && (
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      onLogout();
                    }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 12px',
                      backgroundColor: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-secondary)',
                      fontSize: '13px',
                      transition: 'all var(--transition-fast)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                      e.currentTarget.style.color = 'var(--text-primary)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = 'var(--text-secondary)';
                    }}
                  >
                    <LogOut size={14} />
                    <span>Log out</span>
                  </button>
                )}
              </div>
            )}
          </>
        ) : (
          <button
            onClick={onLogin}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '8px',
              backgroundColor: 'transparent',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              transition: 'background-color var(--transition-fast)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            {/* Login Icon */}
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              backgroundColor: 'var(--bg-tertiary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)'
            }}>
              <User size={14} />
            </div>
            <div style={{ flex: 1, textAlign: 'left' }}>
              <div style={{
                fontSize: '13px',
                color: 'var(--text-primary)',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <LogIn size={12} style={{ color: 'var(--accent-orange)' }} />
                Log in to Claude
              </div>
              <div style={{
                fontSize: '11px',
                color: 'var(--text-muted)'
              }}>
                Sync your account
              </div>
            </div>
          </button>
        )}
      </div>

      {/* Version Footer */}
      <div style={{
        padding: '4px 12px 8px',
        fontSize: '10px',
        color: 'var(--text-muted)',
        opacity: 0.5,
        textAlign: 'center'
      }}>
        v1.0.0
      </div>
    </div>
  );
}
