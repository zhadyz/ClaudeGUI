import React from 'react';
import { Cpu, Coins, Clock, Zap, Activity } from 'lucide-react';

interface StatusBarProps {
  model: string;
  contextUsed: number;
  contextMax: number;
  outputTokens: number;
  totalCost: number;
  isConnected: boolean;
  isStreaming: boolean;
  thinkingStatus?: 'idle' | 'thinking' | 'responding';
}

export default function StatusBar({
  model,
  contextUsed,
  contextMax,
  outputTokens,
  totalCost,
  isConnected,
  isStreaming,
  thinkingStatus = 'idle'
}: StatusBarProps) {
  const contextPercent = Math.min((contextUsed / contextMax) * 100, 100);
  const contextColor = contextPercent > 80 ? 'var(--accent-red)' :
                       contextPercent > 60 ? 'var(--accent-orange)' :
                       'var(--accent-green)';

  const formatTokens = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toString();
  };

  const formatModel = (m: string) => {
    if (m.includes('opus')) return 'Opus 4.5';
    if (m.includes('sonnet')) return 'Sonnet 4';
    if (m.includes('haiku')) return 'Haiku 4';
    return m;
  };

  return (
    <div
      style={{
        height: '28px',
        backgroundColor: 'var(--bg-secondary)',
        borderTop: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        fontSize: '11px',
        color: 'var(--text-tertiary)',
        userSelect: 'none'
      }}
    >
      {/* Left side - Connection & Model */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {/* Connection status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: isConnected ? 'var(--accent-green)' : 'var(--accent-red)'
            }}
          />
          <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
        </div>

        {/* Model */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Cpu size={12} />
          <span style={{ color: 'var(--text-secondary)' }}>{formatModel(model)}</span>
        </div>

        {/* Streaming/Thinking indicator */}
        {isStreaming && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: thinkingStatus === 'thinking' ? 'var(--accent-purple)' : 'var(--accent-orange)' }}>
            <span style={{ fontSize: '14px' }} className="animate-pulse">✦</span>
            <span>
              {thinkingStatus === 'thinking' ? 'Thinking...' : 'Responding...'}
            </span>
          </div>
        )}
      </div>

      {/* Right side - Context & Cost */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {/* Output tokens - show during streaming */}
        {isStreaming && outputTokens > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Activity size={12} style={{ color: 'var(--accent-orange)' }} className="animate-pulse" />
            <span style={{ color: 'var(--accent-orange)' }}>
              +{formatTokens(outputTokens)} tokens
            </span>
          </div>
        )}

        {/* Context usage */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Zap size={12} />
          <span>Context:</span>
          <div
            style={{
              width: '80px',
              height: '6px',
              backgroundColor: 'var(--bg-tertiary)',
              borderRadius: 'var(--radius-full)',
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                width: `${contextPercent}%`,
                height: '100%',
                backgroundColor: contextColor,
                borderRadius: 'var(--radius-full)',
                transition: 'width 0.3s ease'
              }}
            />
          </div>
          <span style={{ color: 'var(--text-secondary)', minWidth: '70px' }}>
            {formatTokens(contextUsed)} / {formatTokens(contextMax)}
          </span>
        </div>

        {/* Cost */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Coins size={12} />
          <span style={{ color: 'var(--text-secondary)' }}>
            ${totalCost.toFixed(4)}
          </span>
        </div>
      </div>
    </div>
  );
}
