import React, { useMemo, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeHighlight from 'rehype-highlight';
import rehypeKatex from 'rehype-katex';
import katex from 'katex';
import CodeBlock from '../Tools/CodeBlock';

// Import KaTeX CSS for math rendering
import 'katex/dist/katex.min.css';

// Segment types for streaming math rendering
type Segment =
  | { type: 'text'; content: string }
  | { type: 'math-inline'; content: string }
  | { type: 'math-display'; content: string }
  | { type: 'incomplete-math'; content: string };

/**
 * Parse content to find complete math blocks during streaming
 * Returns segments that can be rendered appropriately
 */
function parseStreamingMath(content: string): Segment[] {
  const segments: Segment[] = [];
  let remaining = content;

  while (remaining.length > 0) {
    // Check for display math ($$...$$)
    const displayStart = remaining.indexOf('$$');
    const inlineStart = remaining.indexOf('$');

    // No math found - rest is text
    if (inlineStart === -1) {
      if (remaining.length > 0) {
        segments.push({ type: 'text', content: remaining });
      }
      break;
    }

    // Display math starts first or at same position
    if (displayStart !== -1 && displayStart <= inlineStart) {
      // Add text before display math
      if (displayStart > 0) {
        segments.push({ type: 'text', content: remaining.slice(0, displayStart) });
      }

      // Look for closing $$
      const afterStart = remaining.slice(displayStart + 2);
      const displayEnd = afterStart.indexOf('$$');

      if (displayEnd !== -1) {
        // Complete display math block
        const mathContent = afterStart.slice(0, displayEnd);
        segments.push({ type: 'math-display', content: mathContent });
        remaining = afterStart.slice(displayEnd + 2);
      } else {
        // Incomplete display math - render as text (still streaming)
        segments.push({ type: 'incomplete-math', content: remaining.slice(displayStart) });
        break;
      }
    } else {
      // Inline math starts first
      // Add text before inline math
      if (inlineStart > 0) {
        segments.push({ type: 'text', content: remaining.slice(0, inlineStart) });
      }

      // Check if this might be a display math that hasn't received second $
      const afterDollar = remaining.slice(inlineStart + 1);

      // Check if next char is $ (making it display math start)
      if (afterDollar.startsWith('$')) {
        // This is display math, handle in next iteration
        remaining = remaining.slice(inlineStart);
        const displayEnd = afterDollar.slice(1).indexOf('$$');

        if (displayEnd !== -1) {
          // Complete display math
          const mathContent = afterDollar.slice(1, displayEnd + 1);
          segments.push({ type: 'math-display', content: mathContent });
          remaining = afterDollar.slice(displayEnd + 3);
        } else {
          // Incomplete
          segments.push({ type: 'incomplete-math', content: remaining });
          break;
        }
      } else {
        // Regular inline math
        const inlineEnd = afterDollar.indexOf('$');

        if (inlineEnd !== -1) {
          // Make sure it's not empty and doesn't contain spaces at boundaries (which would indicate it's not math)
          const mathContent = afterDollar.slice(0, inlineEnd);

          // Skip if it looks like currency (e.g., "$5 and $10")
          if (mathContent.length > 0 && !mathContent.startsWith(' ') && !mathContent.endsWith(' ')) {
            segments.push({ type: 'math-inline', content: mathContent });
            remaining = afterDollar.slice(inlineEnd + 1);
          } else {
            // Treat as regular text
            segments.push({ type: 'text', content: '$' + mathContent + '$' });
            remaining = afterDollar.slice(inlineEnd + 1);
          }
        } else {
          // Incomplete inline math - render as text
          segments.push({ type: 'incomplete-math', content: remaining.slice(inlineStart) });
          break;
        }
      }
    }
  }

  return segments;
}

/**
 * Render a math segment using KaTeX
 */
function renderMathSegment(segment: Segment, index: number): React.ReactNode {
  if (segment.type === 'text') {
    return <span key={index}>{segment.content}</span>;
  }

  if (segment.type === 'incomplete-math') {
    return <span key={index}>{segment.content}</span>;
  }

  try {
    const html = katex.renderToString(segment.content, {
      displayMode: segment.type === 'math-display',
      throwOnError: false,
      strict: false
    });

    if (segment.type === 'math-display') {
      return (
        <div
          key={index}
          className="katex-display"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    }

    return (
      <span
        key={index}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  } catch (e) {
    // If KaTeX fails, render as text
    const prefix = segment.type === 'math-display' ? '$$' : '$';
    return <span key={index}>{prefix}{segment.content}{prefix}</span>;
  }
}

interface MarkdownContentProps {
  content: string;
  isStreaming?: boolean;
}

/**
 * MarkdownContent - Smooth streaming text renderer with LaTeX support
 *
 * Key optimizations:
 * - During streaming: renders raw text (no markdown/LaTeX parsing)
 * - After streaming: parses markdown + LaTeX equations
 * - Uses KaTeX for fast math rendering
 */
const MarkdownContent = memo(function MarkdownContent({ content, isStreaming }: MarkdownContentProps) {
  // Memoize markdown components
  const components = useMemo(() => ({
    p({ children }: any) {
      return (
        <p style={{ marginBottom: '12px', lineHeight: 1.7 }}>
          {children}
        </p>
      );
    },
    h1({ children }: any) {
      return (
        <h1 style={{ fontSize: '1.5em', fontWeight: 600, marginBottom: '12px', marginTop: '20px', color: 'var(--text-primary)' }}>
          {children}
        </h1>
      );
    },
    h2({ children }: any) {
      return (
        <h2 style={{ fontSize: '1.3em', fontWeight: 600, marginBottom: '10px', marginTop: '18px', color: 'var(--text-primary)' }}>
          {children}
        </h2>
      );
    },
    h3({ children }: any) {
      return (
        <h3 style={{ fontSize: '1.1em', fontWeight: 600, marginBottom: '8px', marginTop: '16px', color: 'var(--text-primary)' }}>
          {children}
        </h3>
      );
    },
    h4({ children }: any) {
      return (
        <h4 style={{ fontSize: '1em', fontWeight: 600, marginBottom: '6px', marginTop: '14px', color: 'var(--text-primary)' }}>
          {children}
        </h4>
      );
    },
    strong({ children }: any) {
      return (
        <strong style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
          {children}
        </strong>
      );
    },
    em({ children }: any) {
      return (
        <em style={{ fontStyle: 'italic' }}>
          {children}
        </em>
      );
    },
    code({ node, inline, className, children, ...props }: any) {
      const match = /language-(\w+)/.exec(className || '');
      const language = match ? match[1] : '';
      const codeString = String(children).replace(/\n$/, '');

      if (!inline && (language || codeString.includes('\n'))) {
        return <CodeBlock code={codeString} language={language} />;
      }

      return (
        <code
          className={className}
          style={{
            backgroundColor: 'rgba(193, 95, 60, 0.15)',
            color: 'var(--accent-orange)',
            padding: '2px 6px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.9em',
            fontFamily: 'var(--font-mono)'
          }}
          {...props}
        >
          {children}
        </code>
      );
    },
    pre({ children }: any) {
      return <>{children}</>;
    },
    a({ href, children }: any) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: 'var(--accent-blue)',
            textDecoration: 'none'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.textDecoration = 'underline';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.textDecoration = 'none';
          }}
        >
          {children}
        </a>
      );
    },
    blockquote({ children }: any) {
      return (
        <blockquote
          style={{
            borderLeft: '3px solid var(--accent-orange)',
            paddingLeft: '16px',
            margin: '12px 0',
            color: 'var(--text-secondary)'
          }}
        >
          {children}
        </blockquote>
      );
    },
    ul({ children }: any) {
      return (
        <ul style={{ paddingLeft: '24px', margin: '8px 0' }}>
          {children}
        </ul>
      );
    },
    ol({ children }: any) {
      return (
        <ol style={{ paddingLeft: '24px', margin: '8px 0' }}>
          {children}
        </ol>
      );
    },
    li({ children }: any) {
      return (
        <li style={{ marginBottom: '4px' }}>
          {children}
        </li>
      );
    },
    table({ children }: any) {
      return (
        <div style={{ overflowX: 'auto', margin: '12px 0' }}>
          <table
            style={{
              borderCollapse: 'collapse',
              width: '100%',
              fontSize: '14px'
            }}
          >
            {children}
          </table>
        </div>
      );
    },
    th({ children }: any) {
      return (
        <th
          style={{
            border: '1px solid var(--border-color)',
            padding: '8px 12px',
            backgroundColor: 'var(--bg-tertiary)',
            fontWeight: 600,
            textAlign: 'left'
          }}
        >
          {children}
        </th>
      );
    },
    td({ children }: any) {
      return (
        <td
          style={{
            border: '1px solid var(--border-color)',
            padding: '8px 12px'
          }}
        >
          {children}
        </td>
      );
    }
  }), []);

  // Parse math segments during streaming
  const streamingSegments = useMemo(() => {
    if (!isStreaming) return null;
    return parseStreamingMath(content);
  }, [content, isStreaming]);

  // During streaming: render with live math parsing (equations render as they complete)
  // After streaming: render full parsed markdown with LaTeX
  if (isStreaming) {
    return (
      <div
        className="markdown-content streaming-text"
        style={{
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word'
        }}
      >
        {streamingSegments?.map((segment, index) => renderMathSegment(segment, index))}
      </div>
    );
  }

  // Stream complete: parse and render markdown + LaTeX
  return (
    <div className="markdown-content">
      <ReactMarkdown
        skipHtml={true}
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeHighlight, rehypeKatex]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});

export default MarkdownContent;
