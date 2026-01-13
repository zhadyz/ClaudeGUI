import React from 'react';

interface DiffViewProps {
  oldString: string;
  newString: string;
  filePath?: string;
}

interface DiffLine {
  type: 'add' | 'remove' | 'context';
  content: string;
  oldLineNum?: number;
  newLineNum?: number;
}

export default function DiffView({ oldString, newString, filePath }: DiffViewProps) {
  // Generate unified diff lines
  const diffLines = generateUnifiedDiff(oldString, newString);

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-code-block)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        fontSize: '13px',
        fontFamily: 'var(--font-mono)',
        border: '1px solid var(--border-color)'
      }}
    >
      {/* File path header - GitHub style */}
      {filePath && (
        <div
          style={{
            padding: '8px 16px',
            backgroundColor: 'var(--bg-secondary)',
            borderBottom: '1px solid var(--border-color)',
            color: 'var(--text-secondary)',
            fontSize: '12px',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
            <path d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0 1 13.25 16h-9.5A1.75 1.75 0 0 1 2 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h9.5a.25.25 0 0 0 .25-.25V6h-2.75A1.75 1.75 0 0 1 9 4.25V1.5Zm6.75.062V4.25c0 .138.112.25.25.25h2.688l-.011-.013-2.914-2.914-.013-.011Z"/>
          </svg>
          {filePath}
        </div>
      )}

      {/* Diff content */}
      <div style={{ overflow: 'auto', maxHeight: '400px' }}>
        {diffLines.map((line, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'stretch',
              backgroundColor: getLineBgColor(line.type),
              minHeight: '22px'
            }}
          >
            {/* Line numbers */}
            <div
              style={{
                display: 'flex',
                flexShrink: 0,
                borderRight: '1px solid var(--border-color)',
                fontSize: '12px',
                color: 'var(--diff-line-num)',
                userSelect: 'none'
              }}
            >
              <span
                style={{
                  width: '40px',
                  padding: '0 8px',
                  textAlign: 'right',
                  backgroundColor: getLineNumBgColor(line.type)
                }}
              >
                {line.oldLineNum || ''}
              </span>
              <span
                style={{
                  width: '40px',
                  padding: '0 8px',
                  textAlign: 'right',
                  backgroundColor: getLineNumBgColor(line.type)
                }}
              >
                {line.newLineNum || ''}
              </span>
            </div>

            {/* Line indicator (+/-/space) */}
            <span
              style={{
                width: '20px',
                padding: '0 4px',
                textAlign: 'center',
                color: getLineTextColor(line.type),
                fontWeight: 600,
                flexShrink: 0
              }}
            >
              {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}
            </span>

            {/* Line content */}
            <span
              style={{
                flex: 1,
                padding: '0 8px',
                whiteSpace: 'pre',
                color: getLineTextColor(line.type)
              }}
            >
              {line.content || ' '}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function getLineBgColor(type: 'add' | 'remove' | 'context'): string {
  switch (type) {
    case 'add':
      return 'var(--diff-add-bg)';
    case 'remove':
      return 'var(--diff-remove-bg)';
    default:
      return 'transparent';
  }
}

function getLineNumBgColor(type: 'add' | 'remove' | 'context'): string {
  switch (type) {
    case 'add':
      return 'rgba(46, 160, 67, 0.15)';
    case 'remove':
      return 'rgba(248, 81, 73, 0.15)';
    default:
      return 'transparent';
  }
}

function getLineTextColor(type: 'add' | 'remove' | 'context'): string {
  switch (type) {
    case 'add':
      return 'var(--diff-add-text)';
    case 'remove':
      return 'var(--diff-remove-text)';
    default:
      return 'var(--text-secondary)';
  }
}

function generateUnifiedDiff(oldStr: string, newStr: string): DiffLine[] {
  const oldLines = oldStr.split('\n');
  const newLines = newStr.split('\n');
  const result: DiffLine[] = [];

  // Simple diff: show all old lines as removed, then all new lines as added
  // For a proper unified diff, you'd use a real diff algorithm
  let oldLineNum = 1;
  let newLineNum = 1;

  // If strings are identical, show as context
  if (oldStr === newStr) {
    oldLines.forEach((line) => {
      result.push({
        type: 'context',
        content: line,
        oldLineNum: oldLineNum++,
        newLineNum: newLineNum++
      });
    });
    return result;
  }

  // Show removed lines
  oldLines.forEach((line) => {
    result.push({
      type: 'remove',
      content: line,
      oldLineNum: oldLineNum++
    });
  });

  // Show added lines
  newLines.forEach((line) => {
    result.push({
      type: 'add',
      content: line,
      newLineNum: newLineNum++
    });
  });

  return result;
}
