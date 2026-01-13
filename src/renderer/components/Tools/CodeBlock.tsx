import React, { useState } from 'react';
import { Copy, Check, FileCode } from 'lucide-react';

interface CodeBlockProps {
  code: string;
  language?: string;
}

export default function CodeBlock({ code, language }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_err) {
      // Copy failed silently
    }
  };

  // Format language display
  const displayLanguage = language?.toLowerCase() || '';
  const languageLabel = getLanguageLabel(displayLanguage);

  return (
    <div
      style={{
        position: 'relative',
        backgroundColor: 'var(--bg-code-block)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        border: '1px solid var(--border-color)',
        margin: '12px 0'
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          backgroundColor: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-color)'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '12px',
            color: 'var(--text-tertiary)'
          }}
        >
          <FileCode size={14} />
          <span>{languageLabel}</span>
        </div>

        <button
          onClick={handleCopy}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 8px',
            backgroundColor: 'transparent',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            color: copied ? 'var(--accent-green)' : 'var(--text-tertiary)',
            fontSize: '12px',
            transition: 'all var(--transition-fast)'
          }}
          onMouseEnter={(e) => {
            if (!copied) {
              e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }
          }}
          onMouseLeave={(e) => {
            if (!copied) {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--text-tertiary)';
            }
          }}
        >
          {copied ? (
            <>
              <Check size={14} />
              Copied!
            </>
          ) : (
            <>
              <Copy size={14} />
              Copy
            </>
          )}
        </button>
      </div>

      {/* Code content */}
      <pre
        style={{
          margin: 0,
          padding: '16px',
          overflow: 'auto',
          maxHeight: '400px',
          fontSize: '13px',
          lineHeight: 1.6,
          fontFamily: 'var(--font-mono)',
          backgroundColor: 'var(--bg-code-block)',
          color: 'var(--text-secondary)'
        }}
      >
        <code className={language ? `language-${language}` : ''}>
          {code}
        </code>
      </pre>
    </div>
  );
}

function getLanguageLabel(lang: string): string {
  const labels: Record<string, string> = {
    js: 'JavaScript',
    javascript: 'JavaScript',
    ts: 'TypeScript',
    typescript: 'TypeScript',
    tsx: 'TypeScript React',
    jsx: 'JavaScript React',
    py: 'Python',
    python: 'Python',
    rb: 'Ruby',
    ruby: 'Ruby',
    go: 'Go',
    rust: 'Rust',
    rs: 'Rust',
    java: 'Java',
    cpp: 'C++',
    c: 'C',
    cs: 'C#',
    csharp: 'C#',
    php: 'PHP',
    swift: 'Swift',
    kotlin: 'Kotlin',
    scala: 'Scala',
    html: 'HTML',
    css: 'CSS',
    scss: 'SCSS',
    sass: 'Sass',
    less: 'Less',
    json: 'JSON',
    yaml: 'YAML',
    yml: 'YAML',
    xml: 'XML',
    md: 'Markdown',
    markdown: 'Markdown',
    sql: 'SQL',
    bash: 'Bash',
    sh: 'Shell',
    shell: 'Shell',
    powershell: 'PowerShell',
    ps1: 'PowerShell',
    dockerfile: 'Dockerfile',
    graphql: 'GraphQL',
    vue: 'Vue',
    svelte: 'Svelte'
  };

  return labels[lang] || lang.toUpperCase() || 'Code';
}
