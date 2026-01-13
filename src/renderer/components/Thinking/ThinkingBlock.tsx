import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Brain } from 'lucide-react';

interface ThinkingBlockProps {
  content: string;
  isStreaming?: boolean;
}

export default function ThinkingBlock({ content, isStreaming }: ThinkingBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Count lines for preview
  const lines = content.split('\n');
  const previewLines = lines.slice(0, 3).join('\n');
  const hasMore = lines.length > 3;

  return (
    <div
      style={{
        backgroundColor: 'rgba(151, 133, 186, 0.1)',
        border: '1px solid rgba(151, 133, 186, 0.2)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        transition: 'all var(--transition-normal)'
      }}
    >
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '12px 16px',
          backgroundColor: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--accent-purple)',
          fontSize: '13px',
          fontWeight: 500,
          textAlign: 'left'
        }}
      >
        <Brain size={16} />
        <span style={{ flex: 1 }}>
          {isStreaming ? 'Thinking...' : 'Thought process'}
        </span>
        {isStreaming ? (
          <div
            className="animate-pulse"
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: 'var(--accent-purple)'
            }}
          />
        ) : (
          isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />
        )}
      </button>

      {/* Content */}
      <div
        style={{
          padding: isExpanded || isStreaming ? '0 16px 16px' : '0 16px 12px',
          maxHeight: isExpanded ? 'none' : '100px',
          overflow: 'hidden',
          position: 'relative'
        }}
      >
        <div
          style={{
            fontSize: '13px',
            lineHeight: 1.6,
            color: 'var(--text-secondary)',
            fontFamily: 'var(--font-mono)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word'
          }}
        >
          {isExpanded || isStreaming ? content : previewLines}
          {isStreaming && (
            <span
              style={{
                display: 'inline-block',
                width: '2px',
                height: '14px',
                backgroundColor: 'var(--accent-purple)',
                marginLeft: '2px',
                animation: 'pulse 1s ease-in-out infinite',
                verticalAlign: 'text-bottom'
              }}
            />
          )}
        </div>

        {/* Fade overlay when collapsed */}
        {!isExpanded && !isStreaming && hasMore && (
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '40px',
              background: 'linear-gradient(transparent, rgba(151, 133, 186, 0.1))',
              pointerEvents: 'none'
            }}
          />
        )}
      </div>

      {/* Expand hint */}
      {!isExpanded && !isStreaming && hasMore && (
        <div
          style={{
            padding: '0 16px 12px',
            fontSize: '12px',
            color: 'var(--accent-purple)',
            cursor: 'pointer'
          }}
          onClick={() => setIsExpanded(true)}
        >
          Click to expand ({lines.length} lines)
        </div>
      )}
    </div>
  );
}
