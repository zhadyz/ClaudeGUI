import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

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

interface ThinkingIndicatorProps {
  text?: string;
  isComplete?: boolean;
}

export default function ThinkingIndicator({ text, isComplete }: ThinkingIndicatorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [wordIndex, setWordIndex] = useState(() => Math.floor(Math.random() * THINKING_WORDS.length));

  // Rotate through thinking words every 2-3 seconds
  useEffect(() => {
    if (isComplete) return;

    const interval = setInterval(() => {
      setWordIndex(prev => (prev + 1) % THINKING_WORDS.length);
    }, 2000 + Math.random() * 1000); // 2-3 seconds

    return () => clearInterval(interval);
  }, [isComplete]);

  const currentWord = THINKING_WORDS[wordIndex];

  // If no text, show simple thinking indicator with rotating words
  if (!text) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 0'
        }}
      >
        <span
          style={{
            fontSize: '14px',
            color: 'var(--accent-orange)',
            animation: 'pulse 1.5s ease-in-out infinite'
          }}
        >
          ✦
        </span>
        <span
          style={{
            fontSize: '14px',
            fontStyle: 'italic',
            color: 'var(--accent-orange)',
            transition: 'opacity 0.3s ease'
          }}
        >
          {currentWord}...
        </span>
      </div>
    );
  }

  // With text, show collapsible thinking block
  return (
    <div style={{ marginBottom: '12px' }}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 0',
          backgroundColor: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: isComplete ? 'var(--text-secondary)' : 'var(--accent-orange)',
          fontSize: '13px',
          fontWeight: 500
        }}
      >
        <span
          style={{
            color: isComplete ? 'var(--accent-purple)' : 'var(--accent-orange)',
            fontSize: '12px',
            animation: isComplete ? 'none' : 'pulse 1.5s ease-in-out infinite'
          }}
        >
          ✦
        </span>
        {isExpanded ? (
          <ChevronDown size={14} style={{ color: 'var(--text-tertiary)' }} />
        ) : (
          <ChevronRight size={14} style={{ color: 'var(--text-tertiary)' }} />
        )}
        <span style={{ fontStyle: isComplete ? 'normal' : 'italic' }}>
          {isComplete ? 'Thought process' : `${currentWord}...`}
        </span>
      </button>

      {isExpanded && (
        <div
          style={{
            marginLeft: '20px',
            padding: '12px 16px',
            backgroundColor: 'rgba(149, 117, 186, 0.12)',
            borderLeft: '2px solid var(--accent-purple)',
            borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
            fontSize: '13px',
            lineHeight: 1.6,
            color: 'var(--text-secondary)',
            whiteSpace: 'pre-wrap',
            fontFamily: 'var(--font-sans)',
            maxHeight: '300px',
            overflowY: 'auto'
          }}
        >
          {text}
        </div>
      )}
    </div>
  );
}
