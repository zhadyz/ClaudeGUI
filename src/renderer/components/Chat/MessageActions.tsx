import React, { useState } from 'react';

interface MessageActionsProps {
  content: string;
  onRetry?: () => void;
  onExport?: () => void;
}

export default function MessageActions({ content, onRetry, onExport }: MessageActionsProps) {
  const [copied, setCopied] = useState(false);
  const [liked, setLiked] = useState<boolean | null>(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_err) {
      // Copy failed silently
    }
  };

  const iconStyle: React.CSSProperties = {
    width: 16,
    height: 16,
    cursor: 'pointer',
    color: 'var(--text-tertiary)',
    opacity: 0.6,
    transition: 'opacity 0.15s ease'
  };

  const buttonStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    padding: '4px',
    cursor: 'pointer',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-tertiary)'
  };

  return (
    <div
      style={{
        display: 'flex',
        gap: '2px',
        marginTop: '4px',
        marginBottom: '4px'
      }}
    >
      {/* Copy button */}
      <button
        style={buttonStyle}
        onClick={handleCopy}
        title={copied ? 'Copied!' : 'Copy'}
        onMouseEnter={(e) => {
          const svg = e.currentTarget.querySelector('svg');
          if (svg) svg.style.opacity = '1';
        }}
        onMouseLeave={(e) => {
          const svg = e.currentTarget.querySelector('svg');
          if (svg) svg.style.opacity = '0.5';
        }}
      >
        {copied ? (
          <svg style={{ ...iconStyle, opacity: 1, color: 'var(--accent-orange)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg style={iconStyle} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        )}
      </button>

      {/* Thumbs up */}
      <button
        style={buttonStyle}
        onClick={() => setLiked(liked === true ? null : true)}
        title="Good response"
        onMouseEnter={(e) => {
          const svg = e.currentTarget.querySelector('svg');
          if (svg) svg.style.opacity = '1';
        }}
        onMouseLeave={(e) => {
          const svg = e.currentTarget.querySelector('svg');
          if (svg && liked !== true) svg.style.opacity = '0.5';
        }}
      >
        <svg
          style={{ ...iconStyle, opacity: liked === true ? 1 : 0.5 }}
          viewBox="0 0 24 24"
          fill={liked === true ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
        </svg>
      </button>

      {/* Thumbs down */}
      <button
        style={buttonStyle}
        onClick={() => setLiked(liked === false ? null : false)}
        title="Bad response"
        onMouseEnter={(e) => {
          const svg = e.currentTarget.querySelector('svg');
          if (svg) svg.style.opacity = '1';
        }}
        onMouseLeave={(e) => {
          const svg = e.currentTarget.querySelector('svg');
          if (svg && liked !== false) svg.style.opacity = '0.5';
        }}
      >
        <svg
          style={{ ...iconStyle, opacity: liked === false ? 1 : 0.5 }}
          viewBox="0 0 24 24"
          fill={liked === false ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
        </svg>
      </button>

      {/* Export button */}
      {onExport && (
        <button
          style={buttonStyle}
          onClick={onExport}
          title="Export as Markdown"
          onMouseEnter={(e) => {
            const svg = e.currentTarget.querySelector('svg');
            if (svg) svg.style.opacity = '1';
          }}
          onMouseLeave={(e) => {
            const svg = e.currentTarget.querySelector('svg');
            if (svg) svg.style.opacity = '0.5';
          }}
        >
          <svg style={iconStyle} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </button>
      )}

      {/* Retry button */}
      {onRetry && (
        <button
          style={buttonStyle}
          onClick={onRetry}
          title="Retry"
          onMouseEnter={(e) => {
            const svg = e.currentTarget.querySelector('svg');
            if (svg) svg.style.opacity = '1';
          }}
          onMouseLeave={(e) => {
            const svg = e.currentTarget.querySelector('svg');
            if (svg) svg.style.opacity = '0.5';
          }}
        >
          <svg style={iconStyle} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
        </button>
      )}
    </div>
  );
}
