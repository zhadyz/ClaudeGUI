import React, { memo } from 'react';
import { Message } from '../../types';
import MessageBubble from './MessageBubble';

interface MessageListProps {
  messages: Message[];
  isStreaming: boolean;
}

const MessageList = memo(function MessageList({ messages, isStreaming }: MessageListProps) {
  return (
    <div
      style={{
        maxWidth: '800px',
        margin: '0 auto',
        padding: '24px 24px 16px 24px'
      }}
    >
      {messages.map((message, index) => (
        <MessageBubble
          key={message.id}
          message={message}
          isLast={index === messages.length - 1}
          isStreaming={isStreaming && message.isStreaming}
        />
      ))}
    </div>
  );
});

export default MessageList;
