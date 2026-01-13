import React from 'react';
import { X, Loader2 } from 'lucide-react';
import { StoredSession, SessionStatus } from '../Sidebar/Sidebar';

interface SessionTabsProps {
  sessions: StoredSession[];
  currentSessionId: string | null;
  sessionStatuses: Map<string, SessionStatus>;
  onSelectSession: (session: StoredSession) => void;
  onCloseSession: (sessionId: string) => void;
  onNewSession: () => void;
}

// Tab status indicator
function TabIndicator({ status }: { status: SessionStatus }) {
  switch (status) {
    case 'thinking':
      return (
        <Loader2
          size={10}
          className="spinning"
          style={{ color: 'var(--accent-orange)' }}
        />
      );
    case 'responding':
      return (
        <Loader2
          size={10}
          className="spinning"
          style={{ color: 'var(--accent-green)' }}
        />
      );
    case 'awaiting':
      return (
        <div
          className="pulse-slow"
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: 'var(--accent-green)'
          }}
        />
      );
    case 'active':
      return (
        <div
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: 'var(--accent-green)',
            boxShadow: '0 0 4px var(--accent-green)'
          }}
        />
      );
    default:
      return null;
  }
}

export default function SessionTabs({
  sessions,
  currentSessionId,
  sessionStatuses,
  onSelectSession,
  onCloseSession,
  onNewSession
}: SessionTabsProps) {
  // Only show sessions that are active (have running processes)
  const activeSessions = sessions.filter(session => {
    const status = sessionStatuses.get(session.id);
    return status && status !== 'idle';
  });

  // If no active sessions, don't show the tab bar
  if (activeSessions.length === 0) {
    return null;
  }

  const formatTitle = (title: string) => {
    if (title.length > 25) {
      return title.slice(0, 22) + '...';
    }
    return title;
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        padding: '0 8px',
        backgroundColor: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-subtle)',
        height: '36px',
        gap: '2px',
        overflow: 'hidden'
      }}
    >
      {activeSessions.map((session) => {
        const isActive = session.id === currentSessionId;
        const status = sessionStatuses.get(session.id) || 'idle';

        return (
          <div
            key={session.id}
            onClick={() => onSelectSession(session)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 10px',
              paddingRight: '4px',
              backgroundColor: isActive ? 'var(--bg-primary)' : 'transparent',
              borderTopLeftRadius: '8px',
              borderTopRightRadius: '8px',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
              minWidth: '100px',
              maxWidth: '200px',
              position: 'relative',
              borderBottom: isActive ? 'none' : '1px solid transparent',
              marginBottom: isActive ? '-1px' : '0',
              zIndex: isActive ? 1 : 0
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.backgroundColor = 'transparent';
              }
            }}
          >
            {/* Status indicator */}
            <TabIndicator status={status} />

            {/* Tab title */}
            <span
              style={{
                flex: 1,
                fontSize: '12px',
                fontWeight: isActive ? 500 : 400,
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {formatTitle(session.title)}
            </span>

            {/* Close button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCloseSession(session.id);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '18px',
                height: '18px',
                padding: 0,
                backgroundColor: 'transparent',
                border: 'none',
                borderRadius: '50%',
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
              <X size={12} />
            </button>
          </div>
        );
      })}

      {/* New tab button */}
      <button
        onClick={onNewSession}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '28px',
          height: '28px',
          padding: 0,
          marginLeft: '4px',
          backgroundColor: 'transparent',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          color: 'var(--text-muted)',
          fontSize: '18px',
          fontWeight: 300,
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
        title="New session"
      >
        +
      </button>
    </div>
  );
}
