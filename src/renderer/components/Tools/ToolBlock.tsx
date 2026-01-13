import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronRight, Check, Loader2, FileEdit, Terminal, Search, FolderOpen, Eye, FilePlus, Globe, Bot, List, Clock } from 'lucide-react';
import DiffView from './DiffView';
import CodeBlock from './CodeBlock';

interface ToolBlockProps {
  toolName: string;
  input?: any;
  result?: string;
  status?: 'running' | 'complete' | 'error';
  isComplete?: boolean;
  streamingContent?: string; // Raw JSON being streamed for tool input
}

// Extract code content from partial JSON for Write/Edit tools
// Handles incomplete JSON like: {"file_path": "test.py", "content": "def hello():
function extractStreamingCode(json: string, fieldName: string): string | null {
  if (!json) return null;

  // Look for the field in the JSON
  const fieldPattern = new RegExp(`"${fieldName}"\\s*:\\s*"`, 'i');
  const match = json.match(fieldPattern);
  if (!match) return null;

  // Find where the content value starts
  const startIndex = json.indexOf(match[0]) + match[0].length;
  if (startIndex >= json.length) return null;

  // Extract content until we hit an unescaped quote or end of string
  let content = '';
  let i = startIndex;
  while (i < json.length) {
    const char = json[i];
    if (char === '\\' && i + 1 < json.length) {
      // Handle escape sequences
      const nextChar = json[i + 1];
      if (nextChar === 'n') content += '\n';
      else if (nextChar === 't') content += '\t';
      else if (nextChar === 'r') content += '\r';
      else if (nextChar === '"') content += '"';
      else if (nextChar === '\\') content += '\\';
      else content += nextChar;
      i += 2;
    } else if (char === '"') {
      // End of string value
      break;
    } else {
      content += char;
      i++;
    }
  }

  return content;
}

// Tool name to display name and icon mapping
const TOOL_INFO: Record<string, { name: string; icon: React.ReactNode; color: string; verb: string }> = {
  'Read': { name: 'Read', icon: <Eye size={14} />, color: '#9785BA', verb: 'Reading' },
  'Write': { name: 'Write', icon: <FilePlus size={14} />, color: '#5BB98C', verb: 'Writing' },
  'Edit': { name: 'Edit', icon: <FileEdit size={14} />, color: '#6B9FD4', verb: 'Editing' },
  'Bash': { name: 'Bash', icon: <Terminal size={14} />, color: '#DA7756', verb: 'Running' },
  'Glob': { name: 'Glob', icon: <Search size={14} />, color: '#9785BA', verb: 'Searching' },
  'Grep': { name: 'Grep', icon: <Search size={14} />, color: '#9785BA', verb: 'Searching' },
  'LS': { name: 'List Directory', icon: <FolderOpen size={14} />, color: '#9785BA', verb: 'Listing' },
  'Task': { name: 'Task', icon: <Bot size={14} />, color: '#DA7756', verb: 'Running agent' },
  'WebFetch': { name: 'Fetch URL', icon: <Globe size={14} />, color: '#6B9FD4', verb: 'Fetching' },
  'WebSearch': { name: 'Web Search', icon: <Globe size={14} />, color: '#6B9FD4', verb: 'Searching' },
  'TodoWrite': { name: 'Update Todos', icon: <List size={14} />, color: '#5BB98C', verb: 'Updating' },
};

// Helper to get language from file path
function getLanguageFromPath(filePath: string): string {
  if (!filePath) return '';
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  const langMap: Record<string, string> = {
    js: 'javascript', jsx: 'jsx', ts: 'typescript', tsx: 'tsx',
    py: 'python', rb: 'ruby', go: 'go', rs: 'rust', java: 'java',
    cpp: 'cpp', c: 'c', cs: 'csharp', php: 'php', swift: 'swift',
    kt: 'kotlin', scala: 'scala', html: 'html', css: 'css',
    scss: 'scss', json: 'json', yaml: 'yaml', yml: 'yaml',
    xml: 'xml', md: 'markdown', sql: 'sql', sh: 'bash', bash: 'bash'
  };
  return langMap[ext] || ext;
}

// Format elapsed time in a human-readable way
function formatElapsedTime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

export default function ToolBlock({ toolName, input, result, status = 'running', isComplete, streamingContent }: ToolBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const startTimeRef = useRef<number | null>(null);

  const toolInfo = TOOL_INFO[toolName] || { name: toolName, icon: null, color: 'var(--text-tertiary)', verb: 'Using' };
  const isRunning = status === 'running' && !isComplete;

  // Track elapsed time while tool is running
  useEffect(() => {
    if (isRunning) {
      if (startTimeRef.current === null) {
        startTimeRef.current = Date.now();
      }

      const interval = setInterval(() => {
        if (startTimeRef.current !== null) {
          const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
          setElapsedTime(elapsed);
        }
      }, 1000);

      return () => clearInterval(interval);
    } else {
      // Reset when tool completes
      startTimeRef.current = null;
    }
  }, [isRunning]);

  // Parse input if it's a string (for streaming)
  let parsedInput = input;
  if (typeof input === 'string' && input.trim()) {
    try {
      parsedInput = JSON.parse(input);
    } catch {
      // Keep as string if not valid JSON
    }
  }

  // Extract streaming code for Write/Edit tools
  const streamingCode = isRunning && streamingContent ? (
    toolName === 'Write' ? extractStreamingCode(streamingContent, 'content') :
    toolName === 'Edit' ? extractStreamingCode(streamingContent, 'new_string') :
    null
  ) : null;

  // Extract file path from streaming content if not in parsed input
  const streamingFilePath = isRunning && streamingContent ?
    extractStreamingCode(streamingContent, 'file_path') : null;

  // Check for special tool types
  const isEditTool = toolName === 'Edit' && parsedInput?.old_string !== undefined && parsedInput?.new_string !== undefined;
  const isWriteTool = toolName === 'Write' && parsedInput?.content;
  const isBashTool = toolName === 'Bash';
  const filePath = parsedInput?.file_path || parsedInput?.path || streamingFilePath || '';

  // Extract file path or command from input
  const getDisplayText = () => {
    if (!parsedInput) return '';

    if (typeof parsedInput === 'string') {
      return parsedInput.substring(0, 60) + (parsedInput.length > 60 ? '...' : '');
    }

    if (parsedInput.file_path) return parsedInput.file_path;
    if (parsedInput.path) return parsedInput.path;
    if (parsedInput.command) {
      const cmd = parsedInput.command;
      return cmd.substring(0, 60) + (cmd.length > 60 ? '...' : '');
    }
    if (parsedInput.pattern) return `Pattern: ${parsedInput.pattern}`;
    if (parsedInput.query) return `Query: ${parsedInput.query}`;
    if (parsedInput.url) return parsedInput.url;

    return '';
  };

  const displayText = getDisplayText();

  // Determine if we have expandable content
  const hasExpandableContent = parsedInput && typeof parsedInput === 'object' && Object.keys(parsedInput).length > 0;

  return (
    <div
      className={isRunning ? 'tool-block-running' : ''}
      style={{
        marginBottom: '12px',
        animation: 'fadeIn 0.2s ease-out'
      }}
    >
      {/* Tool indicator card - more prominent when running */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: isRunning ? '10px 14px' : '8px 12px',
          backgroundColor: isRunning ? 'var(--bg-secondary)' : 'transparent',
          border: isRunning ? '1px solid var(--border-color)' : 'none',
          borderRadius: 'var(--radius-md)',
          borderLeft: isRunning ? `3px solid ${toolInfo.color}` : 'none',
          cursor: hasExpandableContent ? 'pointer' : 'default',
          transition: 'all 0.2s ease'
        }}
        onClick={() => hasExpandableContent && setIsExpanded(!isExpanded)}
      >
        {/* Tool icon with background when running */}
        <div
          style={{
            width: isRunning ? '32px' : '24px',
            height: isRunning ? '32px' : '24px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: isRunning ? `${toolInfo.color}20` : 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: toolInfo.color,
            transition: 'all 0.2s ease'
          }}
        >
          {isRunning ? (
            <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
          ) : (
            toolInfo.icon
          )}
        </div>

        {/* Tool name and status */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: isRunning ? 'var(--text-primary)' : 'var(--text-secondary)',
              }}
            >
              {isRunning ? `${toolInfo.verb}...` : toolInfo.name}
            </span>
            {!isRunning && (
              <Check size={14} style={{ color: 'var(--accent-green)' }} />
            )}
            {/* Elapsed time indicator */}
            {isRunning && elapsedTime > 0 && (
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-mono)',
                  padding: '2px 6px',
                  backgroundColor: 'var(--bg-tertiary)',
                  borderRadius: 'var(--radius-sm)'
                }}
              >
                <Clock size={10} />
                {formatElapsedTime(elapsedTime)}
              </span>
            )}
          </div>
          {displayText && (
            <div
              style={{
                fontSize: '12px',
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-mono)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                marginTop: '2px'
              }}
            >
              {displayText}
            </div>
          )}
          {/* Additional context message for long-running Write/Edit operations */}
          {isRunning && (toolName === 'Write' || toolName === 'Edit') && elapsedTime > 2 && !streamingCode && (
            <div
              style={{
                fontSize: '11px',
                color: 'var(--text-muted)',
                fontStyle: 'italic',
                marginTop: '4px'
              }}
            >
              Claude is generating code...
            </div>
          )}
        </div>

        {/* Expand/collapse indicator */}
        {hasExpandableContent && !isRunning && (
          <span style={{ color: 'var(--text-tertiary)' }}>
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
        )}
      </div>

      {/* Streaming code content - shows while tool is running */}
      {isRunning && streamingCode && (
        <div
          style={{
            marginLeft: '14px',
            marginTop: '8px',
            padding: '12px',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            borderLeft: `3px solid ${toolInfo.color}`,
            animation: 'fadeIn 0.2s ease-out'
          }}
        >
          <div
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--text-tertiary)',
              textTransform: 'uppercase',
              marginBottom: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            Streaming Content
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: toolInfo.color,
                animation: 'pulse 1s ease-in-out infinite'
              }}
            />
          </div>
          <div
            style={{
              backgroundColor: 'var(--bg-code-block)',
              borderRadius: 'var(--radius-sm)',
              padding: '12px',
              fontFamily: 'var(--font-mono)',
              fontSize: '13px',
              lineHeight: 1.5,
              color: 'var(--text-primary)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              maxHeight: '400px',
              overflowY: 'auto'
            }}
          >
            {streamingCode}
            <span
              className="streaming-cursor"
              style={{
                display: 'inline-block',
                width: '2px',
                height: '14px',
                backgroundColor: toolInfo.color,
                marginLeft: '1px',
                verticalAlign: 'text-bottom',
                animation: 'blink 1s step-end infinite'
              }}
            />
          </div>
        </div>
      )}

      {/* Expanded content */}
      {isExpanded && hasExpandableContent && !isRunning && (
        <div
          style={{
            marginLeft: '14px',
            marginTop: '8px',
            padding: '12px',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            borderLeft: `3px solid ${toolInfo.color}`,
            animation: 'fadeIn 0.2s ease-out'
          }}
        >
          {/* Edit tool - show diff */}
          {isEditTool && (
            <DiffView
              oldString={parsedInput.old_string}
              newString={parsedInput.new_string}
              filePath={filePath}
            />
          )}

          {/* Write tool - show code content */}
          {isWriteTool && (
            <div>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--text-tertiary)',
                  textTransform: 'uppercase',
                  marginBottom: '6px'
                }}
              >
                Content
              </div>
              <CodeBlock
                code={parsedInput.content}
                language={getLanguageFromPath(filePath)}
              />
            </div>
          )}

          {/* Bash tool - show command */}
          {isBashTool && parsedInput.command && (
            <div>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--text-tertiary)',
                  textTransform: 'uppercase',
                  marginBottom: '6px'
                }}
              >
                Command
              </div>
              <div
                style={{
                  padding: '10px 12px',
                  backgroundColor: 'var(--bg-tertiary)',
                  borderRadius: 'var(--radius-sm)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '13px',
                  color: 'var(--accent-green)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}
              >
                $ {parsedInput.command}
              </div>
            </div>
          )}

          {/* Other tools - show JSON parameters */}
          {!isEditTool && !isWriteTool && !isBashTool && (
            <div>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--text-tertiary)',
                  textTransform: 'uppercase',
                  marginBottom: '6px'
                }}
              >
                Parameters
              </div>
              <div
                style={{
                  padding: '10px 12px',
                  backgroundColor: 'var(--bg-tertiary)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '12px',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-secondary)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                  maxHeight: '300px',
                  overflowY: 'auto'
                }}
              >
                {JSON.stringify(parsedInput, null, 2)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
