import React from 'react';
import { Terminal } from 'lucide-react';

export interface ContentBlock {
  type: 'text' | 'code';
  content: string;
  language?: string;
}

/**
 * Normalizes text to ensure line endings and indentation are preserved correctly.
 */
export function normalizeQuestionText(val: any): string {
  if (val === null || val === undefined) return '';
  let str = String(val);

  // 1. Normalize line endings: CRLF (\r\n) and CR (\r) to standard LF (\n)
  str = str.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 2. If the user entered literal "\n" or "\r\n" escaped characters (e.g. from raw Excel/CSV exports)
  // and there are no actual newlines in the string:
  if (!str.includes('\n') && (str.includes('\\n') || str.includes('\\r\\n'))) {
    str = str.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n');
  }

  // 3. Trim leading empty newlines and trailing whitespace from the overall string,
  // but strictly PRESERVE indentation (leading spaces/tabs) on content lines!
  return str.replace(/^\n+/, '').replace(/\s+$/, '');
}

/**
 * Detects if a string or single line looks like a programming code snippet.
 */
export function isLikelyCode(text: string): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  
  // Markdown code fence
  if (trimmed.includes('```')) return true;

  // Strong keywords at start of line
  if (/^(#include\b|import\s+|from\s+\w+\s+import|def\s+\w+|class\s+\w+|public\s+(class|static|void|interface)|function\s*\(|function\s+\w+|var\s+\w+\s*=|let\s+\w+\s*=|const\s+\w+\s*=|package\s+\w+|using\s+namespace)/i.test(trimmed)) {
    return true;
  }

  // Programming syntax: semicolons, print statements, control blocks
  if (/(\b(printf|scanf|cout\s*<<|cin\s*>>|console\.(log|warn|error)|System\.out\.(print|println))\s*\(|[;{}]$|\b(SELECT\s+.+\s+FROM|INSERT\s+INTO|CREATE\s+TABLE)\b)/i.test(trimmed)) {
    return true;
  }

  // Multiline with indentation (2+ spaces or tabs) and code-like symbols
  if (trimmed.includes('\n') && /^[ \t]{2,}[a-zA-Z0-9_$]/m.test(text) && /[{};=()+\-*/<>]/.test(text)) {
    return true;
  }

  return false;
}

/**
 * Parses raw question text into structured blocks: text paragraphs and code snippets.
 */
export function parseQuestionContent(rawText: string): ContentBlock[] {
  if (!rawText) return [];

  const normalized = normalizeQuestionText(rawText);

  // 1. Check for explicit Markdown code blocks (```lang ... ``` or ``` ... ```)
  if (normalized.includes('```')) {
    const blocks: ContentBlock[] = [];
    const parts = normalized.split(/```/);

    parts.forEach((part, index) => {
      if (index % 2 === 1) {
        // Code block inside ```
        const firstLineEnd = part.indexOf('\n');
        let language = 'Code';
        let code = part;
        if (firstLineEnd !== -1) {
          const firstLine = part.substring(0, firstLineEnd).trim();
          if (/^[a-zA-Z0-9_+#.-]+$/.test(firstLine)) {
            language = firstLine.toUpperCase();
            code = part.substring(firstLineEnd + 1);
          }
        }
        blocks.push({
          type: 'code',
          content: code.replace(/^\n+|\n+$/g, ''),
          language,
        });
      } else {
        // Text part outside ```
        const text = part.trim();
        if (text) {
          blocks.push({
            type: 'text',
            content: text,
          });
        }
      }
    });

    if (blocks.length > 0) return blocks;
  }

  // 2. If no markdown fences, analyze lines to separate question prompt from code
  const lines = normalized.split('\n');

  // If it's a short 1-line text with no strong code indicator, return as text
  if (lines.length === 1 && !isLikelyCode(lines[0])) {
    return [{ type: 'text', content: normalized }];
  }

  const isStrongCodeLine = (line: string): boolean => {
    const trimmed = line.trim();
    if (!trimmed) return false;
    if (/^(#include\b|import\s+|from\s+\w+\s+import|def\s+\w+|public\s+(class|static|void|interface)|class\s+\w+|function\s*\(|function\s+\w+|namespace\s+\w+|package\s+\w+|using\s+namespace|typedef\s+)/i.test(trimmed)) {
      return true;
    }
    if (/^(SELECT\s+.+\s+FROM|INSERT\s+INTO|UPDATE\s+.+\s+SET|CREATE\s+TABLE|DELETE\s+FROM)\b/i.test(trimmed)) {
      return true;
    }
    if (/^(int|float|double|char|bool|boolean|void|string|let|const|var)\s+[a-zA-Z_]\w*\s*(=|[;,()])/i.test(trimmed)) {
      return true;
    }
    if (/^(printf|scanf|cout\s*<<|cin\s*>>|console\.(log|warn|error)|System\.out\.(print|println))\s*\(/i.test(trimmed)) {
      return true;
    }
    if (/^(for\s*\(|while\s*\(|if\s*\(|switch\s*\(|elif\s+|else:?$)/i.test(trimmed)) {
      return true;
    }
    if (/^return(\s+[^;]+;|\s*;|$)/i.test(trimmed)) {
      return true;
    }
    return false;
  };

  const isCodeLikeLine = (line: string): boolean => {
    const trimmed = line.trim();
    if (!trimmed) return false;
    if (isStrongCodeLine(line)) return true;
    if (/^[{}();]+$/.test(trimmed)) return true;
    if (/[;{]$/.test(trimmed)) return true;
    if (/^[ \t]{2,}/.test(line) && /([=+\-*/<>!&|()[\]{}]|return|print|console)/.test(trimmed)) {
      return true;
    }
    if (/^[a-zA-Z_]\w*\s*(\+=|-=|\*=|\/=|%=|=)\s*.+;?$/.test(trimmed)) {
      return true;
    }
    if (/(=>|->)/.test(trimmed)) return true;
    return false;
  };

  const isNaturalQuestionPrompt = (line: string): boolean => {
    const trimmed = line.trim();
    if (!trimmed) return false;
    if (/^(what|which|find|predict|choose|how|why|where|when|who|consider|given|suppose|look at|assume|following|output|program|code|in the|observe|write|identify|trace)\b/i.test(trimmed)) {
      return true;
    }
    if (/\?$/.test(trimmed) || (/:$/.test(trimmed) && !trimmed.includes('{') && !trimmed.includes(';'))) {
      return true;
    }
    return false;
  };

  const lineTypes: ('prompt' | 'code' | 'blank')[] = lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed) return 'blank';
    if (isStrongCodeLine(line)) return 'code';
    if (isNaturalQuestionPrompt(line)) return 'prompt';
    if (isCodeLikeLine(line)) return 'code';
    return 'prompt';
  });

  const hasCode = lineTypes.some(t => t === 'code');
  if (!hasCode) {
    return [{ type: 'text', content: normalized }];
  }

  // Segment lines into text and code blocks
  const blocks: ContentBlock[] = [];
  let currentBlockType: 'text' | 'code' | null = null;
  let currentLines: string[] = [];

  const flush = () => {
    if (currentLines.length > 0 && currentBlockType) {
      const content = currentLines.join('\n');
      if (currentBlockType === 'code') {
        let lang = 'Code';
        if (/#include\b|printf\b|scanf\b|cout\b|cin\b/.test(content)) lang = 'C / C++';
        else if (/def\s+\w+|import\s+\w+|print\(|elif\b|__init__/.test(content)) lang = 'Python';
        else if (/public\s+class|System\.out\.println|public\s+static\s+void/.test(content)) lang = 'Java';
        else if (/console\.log|const\s+\w+\s*=|let\s+\w+\s*=|function\b|=>/.test(content)) lang = 'JavaScript';
        else if (/SELECT\s+|INSERT\s+INTO|CREATE\s+TABLE/i.test(content)) lang = 'SQL';

        blocks.push({
          type: 'code',
          content: content.replace(/^\n+|\n+$/g, ''),
          language: lang,
        });
      } else {
        const trimmed = content.trim();
        if (trimmed) {
          blocks.push({
            type: 'text',
            content: trimmed,
          });
        }
      }
      currentLines = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const type = lineTypes[i];

    if (type === 'blank') {
      currentLines.push(line);
      continue;
    }

    const determinedType: 'text' | 'code' = (type === 'code') ? 'code' : 'text';

    if (currentBlockType === null) {
      currentBlockType = determinedType;
      currentLines.push(line);
    } else if (currentBlockType === determinedType) {
      currentLines.push(line);
    } else {
      flush();
      currentBlockType = determinedType;
      currentLines.push(line);
    }
  }
  flush();

  return blocks.length > 0 ? blocks : [{ type: 'text', content: normalized }];
}

interface CodeSnippetProps {
  code: string;
  language?: string;
  showCopyButton?: boolean;
  compact?: boolean;
}

export const CodeSnippet: React.FC<CodeSnippetProps> = ({
  code,
  language = 'Code',
  compact = false,
}) => {
  const lineCount = code.split('\n').length;
  const showLineNumbers = lineCount > 2;

  return (
    <div
      className={`relative my-2.5 rounded-lg border border-slate-700/80 bg-slate-900 text-slate-100 shadow-md overflow-hidden ${
        compact ? 'text-xs' : 'text-xs sm:text-sm'
      }`}
    >
      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800/90 border-b border-slate-700/60 select-none">
        <div className="flex items-center gap-1.5 text-slate-300 font-mono text-[11px] font-semibold tracking-wide">
          <Terminal className="h-3.5 w-3.5 text-emerald-400" />
          <span>{language}</span>
          <span className="text-slate-500 font-sans text-[10px]">
            ({lineCount} line{lineCount !== 1 ? 's' : ''})
          </span>
        </div>
      </div>

      {/* Code Area */}
      <div className="overflow-x-auto p-3 sm:p-4">
        <pre
          className="font-mono leading-relaxed whitespace-pre font-normal text-slate-100 m-0"
          style={{
            tabSize: 4,
            MozTabSize: 4,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          }}
        >
          {showLineNumbers ? (
            <code className="table w-full">
              {code.split('\n').map((line, idx) => (
                <span key={idx} className="table-row">
                  <span className="table-cell pr-3 text-right text-slate-500 select-none text-[11px] w-6 opacity-60">
                    {idx + 1}
                  </span>
                  <span className="table-cell">{line || ' '}</span>
                </span>
              ))}
            </code>
          ) : (
            <code>{code}</code>
          )}
        </pre>
      </div>
    </div>
  );
};

export interface FormattedQuestionTextProps {
  text: string;
  qNumber?: number | string;
  className?: string;
  compact?: boolean;
  showCopyButton?: boolean;
  prefix?: React.ReactNode;
}

/**
 * Universal component to render question text with exact formatting,
 * line break preservation, whitespace alignment, and beautiful code block detection.
 */
export const FormattedQuestionText: React.FC<FormattedQuestionTextProps> = ({
  text,
  qNumber,
  className = '',
  compact = false,
  showCopyButton = true,
  prefix,
}) => {
  if (!text) {
    return <span className="text-muted-foreground italic font-normal">No question text</span>;
  }

  const blocks = parseQuestionContent(text);

  return (
    <div className={`space-y-2 text-foreground ${className}`}>
      {blocks.map((block, index) => {
        if (block.type === 'code') {
          return (
            <CodeSnippet
              key={index}
              code={block.content}
              language={block.language}
              compact={compact}
              showCopyButton={showCopyButton}
            />
          );
        }

        // Text block
        return (
          <div
            key={index}
            className="whitespace-pre-wrap break-words leading-relaxed font-sans"
            style={{ tabSize: 4, MozTabSize: 4 }}
          >
            {index === 0 && (
              <>
                {prefix}
                {qNumber !== undefined && qNumber !== null && (
                  <span className="font-bold text-primary mr-1.5 select-none">
                    {typeof qNumber === 'number' ? `Q${qNumber}.` : qNumber}
                  </span>
                )}
              </>
            )}
            {block.content}
          </div>
        );
      })}
    </div>
  );
};

export interface FormattedOptionTextProps {
  text: string;
  className?: string;
}

/**
 * Formats question options: preserves indentation, line breaks,
 * and applies monospace styling if the option is code.
 */
export const FormattedOptionText: React.FC<FormattedOptionTextProps> = ({
  text,
  className = '',
}) => {
  if (!text) return null;

  const normalized = normalizeQuestionText(text);
  const isCode = isLikelyCode(normalized);

  return (
    <div
      className={`whitespace-pre-wrap break-words leading-relaxed ${
        isCode
          ? 'font-mono text-xs sm:text-sm bg-muted/40 px-2 py-1 rounded border border-border/50 text-foreground'
          : 'font-sans'
      } ${className}`}
      style={{
        tabSize: 4,
        MozTabSize: 4,
        fontFamily: isCode
          ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
          : undefined,
      }}
    >
      {normalized}
    </div>
  );
};

export default FormattedQuestionText;
