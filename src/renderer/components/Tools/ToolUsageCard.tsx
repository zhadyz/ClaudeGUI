import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  FileEdit,
  FilePlus,
  Terminal,
  Search,
  FolderOpen,
  Globe,
  Check,
  Loader2,
  AlertCircle,
  Eye,
  List,
  Bot,
  Wrench,
  FileText,
  Trash2,
  RefreshCw
} from 'lucide-react';
import CodeBlock from './CodeBlock';
import DiffView from './DiffView';

// Helper to get language from file path
function getLanguageFromPath(filePath: string): string {
  if (!filePath) return '';
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  const langMap: Record<string, string> = {
    js: 'javascript',
    jsx: 'jsx',
    ts: 'typescript',
    tsx: 'tsx',
    py: 'python',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    java: 'java',
    cpp: 'cpp',
    c: 'c',
    cs: 'csharp',
    php: 'php',
    swift: 'swift',
    kt: 'kotlin',
    scala: 'scala',
    html: 'html',
    css: 'css',
    scss: 'scss',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    xml: 'xml',
    md: 'markdown',
    sql: 'sql',
    sh: 'bash',
    bash: 'bash',
    ps1: 'powershell',
    dockerfile: 'dockerfile'
  };
  return langMap[ext] || ext;
}

interface ToolUsageCardProps {
  toolName: string;
  input?: Record<string, unknown>;
  content: string;
  status: 'running' | 'complete' | 'error';
  result?: string;
}

const toolConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  Edit: { icon: <FileEdit size={14} />, color: '#6B9FD4', label: 'Edit File' },
  Write: { icon: <FilePlus size={14} />, color: '#5BB98C', label: 'Write File' },
  Read: { icon: <Eye size={14} />, color: '#9785BA', label: 'Read File' },
  Bash: { icon: <Terminal size={14} />, color: '#DA7756', label: 'Run Command' },
  Glob: { icon: <Search size={14} />, color: '#9785BA', label: 'Find Files' },
  Grep: { icon: <Search size={14} />, color: '#9785BA', label: 'Search Content' },
  WebFetch: { icon: <Globe size={14} />, color: '#6B9FD4', label: 'Fetch URL' },
  WebSearch: { icon: <Globe size={14} />, color: '#6B9FD4', label: 'Web Search' },
  Task: { icon: <Bot size={14} />, color: '#DA7756', label: 'Agent Task' },
  TodoWrite: { icon: <List size={14} />, color: '#5BB98C', label: 'Update Todos' },
  AskUserQuestion: { icon: <FileText size={14} />, color: '#9785BA', label: 'Ask User' },
  NotebookEdit: { icon: <FileEdit size={14} />, color: '#6B9FD4', label: 'Edit Notebook' },
  Delete: { icon: <Trash2 size={14} />, color: '#E57373', label: 'Delete' }
};

export default function ToolUsageCard({ toolName, input, content, status, result }: ToolUsageCardProps) {
  const [isExpanded, setIsExpanded] = useState(status === 'running');

  const config = toolConfig[toolName] || {
    icon: <Wrench size={14} />,
    color: 'var(--text-secondary)',
    label: toolName
  };

  // Extract useful info from input
  const filePath = (input?.file_path || input?.path || input?.pattern || input?.command || input?.url || '') as string;
  const description = input?.description as string;

  const StatusIcon = () => {
    switch (status) {
      case 'running':
        return <Loader2 size={14} className="animate-spin" style={{ color: config.color }} />;
      case 'complete':
        return <Check size={14} style={{ color: 'var(--accent-green)' }} />;
      case 'error':
        return <AlertCircle size={14} style={{ color: 'var(--accent-red)' }} />;
    }
  };

  // Determine if this is a file edit that should show diff
  const isFileEdit = toolName === 'Edit' && input?.old_string && input?.new_string;
  const isBashCommand = toolName === 'Bash';
  const isAgentTask = toolName === 'Task';
  const isWriteFile = toolName === 'Write' && input?.content;
  const isReadFile = toolName === 'Read';

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        borderLeft: `3px solid ${config.color}`
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
          padding: '12px 14px',
          backgroundColor: 'transparent',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left'
        }}
      >
        {/* Tool icon */}
        <div
          style={{
            width: '28px',
            height: '28px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: `${config.color}20`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: config.color
          }}
        >
          {config.icon}
        </div>

        {/* Tool info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--text-primary)'
              }}
            >
              {config.label}
            </span>
            {status === 'running' && (
              <span
                style={{
                  fontSize: '11px',
                  color: config.color,
                  backgroundColor: `${config.color}15`,
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-full)'
                }}
              >
                Running...
              </span>
            )}
          </div>
          {(filePath || description) && (
            <div
              style={{
                fontSize: '12px',
                color: 'var(--text-tertiary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                marginTop: '2px',
                fontFamily: filePath ? 'var(--font-mono)' : 'inherit'
              }}
            >
              {description || filePath}
            </div>
          )}
        </div>

        {/* Status & expand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <StatusIcon />
          {isExpanded ? (
            <ChevronDown size={16} style={{ color: 'var(--text-tertiary)' }} />
          ) : (
            <ChevronRight size={16} style={{ color: 'var(--text-tertiary)' }} />
          )}
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div style={{ padding: '0 14px 14px' }}>
          {/* Agent task - show agent info */}
          {isAgentTask && input?.subagent_type && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 12px',
              backgroundColor: 'var(--bg-tertiary)',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '12px'
            }}>
              <Bot size={14} style={{ color: 'var(--accent-orange)' }} />
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Agent: <strong style={{ color: 'var(--text-primary)' }}>{input.subagent_type as string}</strong>
              </span>
            </div>
          )}

          {/* File edit - show diff */}
          {isFileEdit && (
            <DiffView
              oldString={input.old_string as string}
              newString={input.new_string as string}
              filePath={filePath}
            />
          )}

          {/* Write file - show code content */}
          {isWriteFile && (
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
                code={input.content as string}
                language={getLanguageFromPath(filePath)}
              />
            </div>
          )}

          {/* Read file - show result content */}
          {isReadFile && result && (
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
                File Content
              </div>
              <CodeBlock
                code={result}
                language={getLanguageFromPath(filePath)}
              />
            </div>
          )}

          {/* Bash command - show command and output */}
          {isBashCommand && (
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
                  marginBottom: result ? '12px' : 0
                }}
              >
                $ {input?.command as string}
              </div>

              {result && (
                <>
                  <div
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: 'var(--text-tertiary)',
                      textTransform: 'uppercase',
                      marginBottom: '6px'
                    }}
                  >
                    Output
                  </div>
                  <div
                    style={{
                      padding: '10px 12px',
                      backgroundColor: 'var(--bg-tertiary)',
                      borderRadius: 'var(--radius-sm)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '12px',
                      color: 'var(--text-secondary)',
                      whiteSpace: 'pre-wrap',
                      maxHeight: '200px',
                      overflow: 'auto'
                    }}
                  >
                    {result}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Other tools - show input/output */}
          {!isFileEdit && !isBashCommand && !isWriteFile && !isReadFile && (
            <>
              {input && Object.keys(input).length > 0 && (
                <div style={{ marginBottom: '12px' }}>
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
                  <CodeBlock
                    code={JSON.stringify(input, null, 2)}
                    language="json"
                  />
                </div>
              )}

              {(content || result) && (
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
                    Result
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
                      wordBreak: 'break-word',
                      maxHeight: '300px',
                      overflow: 'auto'
                    }}
                  >
                    {result || content}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
