import React, { memo } from 'react';
import { Message, ContentBlock } from '../../types';
import ToolBlock from '../Tools/ToolBlock';
import ThinkingIndicator from '../Thinking/ThinkingIndicator';
import MarkdownContent from './MarkdownContent';

interface MessageBubbleProps {
  message: Message;
  isLast: boolean;
  isStreaming?: boolean;
}

const MessageBubble = memo(function MessageBubble({ message, isLast, isStreaming }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  if (isUser) {
    // User messages - Claude style: right-aligned bubble with warm gray background
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          marginBottom: '24px',
          animation: 'fadeIn 0.3s ease-out'
        }}
      >
        <div
          className="user-message"
          style={{
            maxWidth: '85%',
            backgroundColor: 'var(--bg-user-bubble)',
            borderRadius: '14px',
            padding: '12px 16px',
            color: 'var(--text-primary)',
            fontSize: '16px',
            lineHeight: 1.6
          }}
        >
          {message.content.map((block) => (
            <div key={block.id}>
              {block.content}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Assistant messages - Claude style: left-aligned, no bubble, serif font
  return (
    <div
      style={{
        marginBottom: '24px',
        animation: 'fadeIn 0.3s ease-out'
      }}
    >
      {/* Message content - no logo here, animated logo shows at bottom when streaming */}
      <div>
        {message.content.map((block, index) => (
          <ContentBlockRenderer
            key={block.id}
            block={block}
            isStreaming={isStreaming && !block.isComplete && index === message.content.length - 1}
          />
        ))}

        {/* Show thinking indicator if streaming and no content yet */}
        {isStreaming && isLast && message.content.length === 0 && (
          <ThinkingIndicator />
        )}
      </div>
    </div>
  );
});

interface ContentBlockRendererProps {
  block: ContentBlock;
  isStreaming?: boolean;
}

const ContentBlockRenderer = memo(function ContentBlockRenderer({ block, isStreaming }: ContentBlockRendererProps) {
  switch (block.type) {
    case 'thinking':
      return <ThinkingIndicator text={block.content} isComplete={block.isComplete} />;

    case 'tool_use':
      // For tool_use, always pass content if not complete (tool is still running)
      const isToolRunning = !block.isComplete && block.toolStatus === 'running';
      return (
        <ToolBlock
          toolName={block.toolName || 'Tool'}
          input={block.toolInput}
          status={block.toolStatus || 'running'}
          isComplete={block.isComplete}
          streamingContent={isToolRunning ? block.content : undefined}
        />
      );

    case 'tool_result':
      return null; // Handled by ToolBlock

    case 'text':
    default:
      if (!block.content) return null;

      return (
        <div
          className="message-content"
          style={{
            marginBottom: '16px',
            color: 'var(--text-primary)',
            fontSize: '16px',
            lineHeight: 1.7,
            fontFamily: 'var(--font-serif)'
          }}
        >
          <MarkdownContent content={block.content} isStreaming={isStreaming} />
          {isStreaming && (
            <span
              className="streaming-cursor"
              style={{
                display: 'inline-block',
                width: '2px',
                height: '18px',
                backgroundColor: 'var(--accent-orange)',
                marginLeft: '2px',
                verticalAlign: 'text-bottom'
              }}
            />
          )}
        </div>
      );
  }
});

export default MessageBubble;
