import React, { useMemo } from 'react';
import { Copy, Check } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
  renderMermaid?: (code: string) => React.ReactNode;
}

// Ultra-fast, single-pass inline formatting (no while loop, O(N) tokens)
function renderInline(text: string): React.ReactNode {
  if (!text) return null;

  // Tokenize by inline code `...`, bold **...**, italic *...*, and markdown links [text](url)
  const tokens = text.split(/(`[^`]+`|\*\*[^*]+\*\*|(?<!\*)\*[^*]+\*(?!\*)|\[[^\]]+\]\([^)]+\))/g);

  return (
    <>
      {tokens.map((token, idx) => {
        if (!token) return null;

        // Inline code `...`
        if (token.startsWith('`') && token.endsWith('`') && token.length >= 2) {
          return (
            <code
              key={idx}
              className="px-1.5 py-0.5 rounded bg-[#F3F4F6] text-[#E85D2C] font-mono text-[11px] font-semibold border border-[#E5E1DA]/60"
            >
              {token.slice(1, -1)}
            </code>
          );
        }

        // Bold **...**
        if (token.startsWith('**') && token.endsWith('**') && token.length >= 4) {
          return (
            <strong key={idx} className="font-bold text-[#1A1D29]">
              {token.slice(2, -2)}
            </strong>
          );
        }

        // Italic *...*
        if (token.startsWith('*') && token.endsWith('*') && token.length >= 2) {
          return (
            <em key={idx} className="italic text-[#4A5568]">
              {token.slice(1, -1)}
            </em>
          );
        }

        // Link [title](url)
        const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (linkMatch) {
          return (
            <a
              key={idx}
              href={linkMatch[2]}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#E85D2C] underline hover:text-[#D44E1F]"
            >
              {linkMatch[1]}
            </a>
          );
        }

        return <span key={idx}>{token}</span>;
      })}
    </>
  );
}

// Safe normalizer to format collapsed Markdown table rows and section headers
function normalizeMarkdown(raw: string): string {
  if (!raw) return '';

  // 0. Auto-convert raw JSON outputs into clean markdown
  let text = tryConvertJsonToMarkdown(raw);
  text = text.replace(/\r\n/g, '\n');

  // 1. Separate introductory text or headers from immediately attached tables
  // e.g. "1️⃣ Why This Matters | Insight | Evidence |" -> "1️⃣ Why This Matters\n| Insight | Evidence |"
  text = text.replace(/^([^|\n]+?)\s+(\|[^|\n]+\|)/gm, '$1\n$2');

  // 2. Expand collapsed table pipes "| |" or "|  |" into newlines "|\n|"
  // Loop up to 10 passes to ensure nested/consecutive collapsed pipes are fully expanded
  let pass = 0;
  while (/\|\s*\|\s*/.test(text) && pass < 10) {
    text = text.replace(/\|\s*\|\s*/g, '|\n|');
    pass++;
  }

  // 3. Ensure horizontal rules "---" have newlines before and after
  text = text.replace(/([^\n])\s*(---|\*\*\*)\s*([^\n])/g, '$1\n\n$2\n\n$3');

  // 4. Ensure section badges have a newline before them if squashed against another line
  text = text.replace(/([^\n])\n?([0-9]+[️⃣\.]\s+[^\n]+)/g, '$1\n\n$2');

  return text;
}

// Convert raw JSON LLM responses (e.g. { "title": "...", "overview": "..." }) into structured Markdown
function tryConvertJsonToMarkdown(raw: string): string {
  const trimmed = raw.trim();
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      const data = JSON.parse(trimmed);
      if (typeof data === 'object' && data !== null) {
        if (Array.isArray(data)) {
          return data
            .map((item, idx) => {
              if (typeof item === 'object') {
                return (
                  `### Item ${idx + 1}\n` +
                  Object.entries(item)
                    .map(([k, v]) => `**${k}**: ${Array.isArray(v) ? v.join(', ') : v}`)
                    .join('\n\n')
                );
              }
              return `- ${item}`;
            })
            .join('\n\n');
        }

        const lines: string[] = [];
        const title = data.title || data.name || data.project_title || data.concept;
        if (title) {
          lines.push(`## 🎯 ${title}\n`);
        }

        const keyLabels: Record<string, string> = {
          overview: '📋 Problem Overview',
          actual_problem: '🔍 Actual Problem to Solve',
          target_users: '👥 Target Users & Stakeholders',
          requirements: '📋 Requirements & Deliverables',
          constraints: '⚠️ Constraints & Limitations',
          expected_outcomes: '🏆 Expected Outcomes & Success Metrics',
          important_terms: '💡 Key Technical Concepts',
          refined_concept: '💡 Refined Concept',
          market_context: '🌐 Market Context',
          existing_solutions: '⚙️ Existing Solutions & Limitations',
          differentiation_opportunities: '🚀 Differentiation Opportunities',
          suggested_mvp_scope: '🛠️ Suggested MVP Scope',
        };

        for (const [key, val] of Object.entries(data)) {
          if (['title', 'name', 'project_title', 'concept'].includes(key)) continue;
          const heading = keyLabels[key] || key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
          lines.push(`### ${heading}`);

          if (Array.isArray(val)) {
            val.forEach((item) => {
              if (typeof item === 'object' && item !== null) {
                const subProps = Object.entries(item)
                  .map(([ik, iv]) => `**${ik}**: ${iv}`)
                  .join(' | ');
                lines.push(`- ${subProps}`);
              } else {
                lines.push(`- ${item}`);
              }
            });
          } else if (typeof val === 'object' && val !== null) {
            lines.push(Object.entries(val).map(([ik, iv]) => `- **${ik}**: ${iv}`).join('\n'));
          } else {
            lines.push(`${val}`);
          }
          lines.push('');
        }
        return lines.join('\n').trim();
      }
    } catch {
      // Continue to standard markdown if JSON parsing fails
    }
  }
  return raw;
}

// Check if a line is a markdown table divider like |---|---| or |:---|---:| or :---|---:
function isTableDivider(line: string): boolean {
  if (!line || !line.includes('-')) return false;
  const cells = line
    .split('|')
    .map((c) => c.trim())
    .filter(Boolean);
  return cells.length > 0 && cells.every((c) => /^:?-+:?$/.test(c));
}

// Split table row cells safely
function parseCells(rowLine: string): string[] {
  let trimmed = rowLine.trim();
  if (trimmed.startsWith('|')) trimmed = trimmed.slice(1);
  if (trimmed.endsWith('|')) trimmed = trimmed.slice(0, -1);
  return trimmed.split('|').map((c) => c.trim());
}

function MarkdownRendererComponent({ content, renderMermaid }: MarkdownRendererProps) {
  const elements = useMemo(() => {
    const normalized = normalizeMarkdown(content);
    const rawSegments = normalized.split(/(```[\s\S]*?```)/g);

    return rawSegments.map((segment, segIdx) => {
      // Code blocks
      if (segment.startsWith('```') && segment.endsWith('```')) {
        const lines = segment.slice(3, -3).trim().split('\n');
        const lang = lines[0].trim();
        const code = (lang ? lines.slice(1) : lines).join('\n');

        if ((lang === 'mermaid' || code.startsWith('graph ') || code.startsWith('sequenceDiagram')) && renderMermaid) {
          return <React.Fragment key={segIdx}>{renderMermaid(code)}</React.Fragment>;
        }

        return (
          <div key={segIdx} className="my-3 rounded-xl border border-[#E5E1DA] overflow-hidden bg-[#1A1D29] text-white">
            <div className="flex items-center justify-between px-3.5 py-1.5 bg-[#12141C] border-b border-[#2A2E3D] text-[11px] font-mono text-gray-400">
              <span className="font-semibold uppercase tracking-wider">{lang || 'Code'}</span>
              <button
                onClick={() => navigator.clipboard.writeText(code)}
                className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer"
                title="Copy code"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </button>
            </div>
            <pre className="p-3.5 text-xs font-mono overflow-x-auto text-emerald-300 leading-relaxed">
              <code>{code}</code>
            </pre>
          </div>
        );
      }

      // Process non-code lines with guaranteed loop progress (O(N) single-pass)
      const lines = segment.split('\n');
      const segmentElements: React.ReactNode[] = [];
      let i = 0;

      while (i < lines.length) {
        const line = lines[i];
        const trimmed = line.trim();

        // 1. Empty lines
        if (!trimmed) {
          i++;
          continue;
        }

        // 2. Horizontal Divider: --- or *** or ___
        if (/^(\*{3,}|-{3,}|_{3,})$/.test(trimmed)) {
          segmentElements.push(<hr key={`hr-${i}`} className="my-4 border-t border-[#E5E1DA]" />);
          i++;
          continue;
        }

        // 3. Markdown Table: Has | and followed by table divider
        if (trimmed.includes('|') && i + 1 < lines.length && isTableDivider(lines[i + 1])) {
          const headerCells = parseCells(trimmed);
          i += 2; // Consume header and divider
          const rows: string[][] = [];

          while (
            i < lines.length &&
            lines[i].trim().includes('|') &&
            !isTableDivider(lines[i]) &&
            !/^(\*{3,}|-{3,}|_{3,})$/.test(lines[i].trim())
          ) {
            rows.push(parseCells(lines[i]));
            i++;
          }

          segmentElements.push(
            <div key={`table-${i}`} className="my-3.5 overflow-x-auto rounded-xl border border-[#E5E1DA] shadow-2xs bg-white">
              <table className="w-full border-collapse text-left text-xs font-mono">
                <thead>
                  <tr className="bg-[#FAFAF7] border-b border-[#E5E1DA]">
                    {headerCells.map((h, hIdx) => (
                      <th key={hIdx} className="px-3.5 py-2.5 font-bold text-[#1A1D29] border-r last:border-r-0 border-[#E5E1DA]">
                        {renderInline(h)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E1DA]">
                  {rows.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-[#FFF4EE]/40 transition-colors">
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="px-3.5 py-2 text-[#1A1D29] border-r last:border-r-0 border-[#E5E1DA] align-top">
                          {renderInline(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
          continue;
        }

        // 4. Headings: #, ##, ###, ####
        const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
        if (headingMatch) {
          const level = headingMatch[1].length;
          const headingText = headingMatch[2];

          if (level === 1) {
            segmentElements.push(
              <h2 key={`h1-${i}`} className="text-base font-bold font-display text-[#1A1D29] mt-4 mb-2 pb-1.5 border-b border-[#E5E1DA]">
                {renderInline(headingText)}
              </h2>
            );
          } else if (level === 2) {
            segmentElements.push(
              <h3 key={`h2-${i}`} className="text-sm font-bold font-display text-[#1A1D29] mt-3.5 mb-1.5 flex items-center gap-1.5">
                {renderInline(headingText)}
              </h3>
            );
          } else {
            segmentElements.push(
              <h4 key={`h3-${i}`} className="text-xs font-bold font-mono text-[#E85D2C] uppercase tracking-wider mt-3 mb-1">
                {renderInline(headingText)}
              </h4>
            );
          }
          i++;
          continue;
        }

        // 5. Short Section Badges with Emojis / Numbers (e.g. 1️⃣ Why This Matters, 2️⃣ Core Challenges)
        const sectionBadgeMatch = trimmed.match(/^([0-9]+[️⃣\.]|[\u{1F300}-\u{1F9FF}].*?)\s{1,2}(.*)$/u);
        if (
          sectionBadgeMatch &&
          trimmed.length <= 100 &&
          !trimmed.startsWith('|') &&
          !trimmed.startsWith('-') &&
          !trimmed.startsWith('*')
        ) {
          segmentElements.push(
            <div
              key={`badge-${i}`}
              className="mt-4 mb-2 p-2 px-3 rounded-xl bg-[#FAFAF7] border border-[#E5E1DA] flex items-center gap-2 font-display font-bold text-xs sm:text-sm text-[#1A1D29] shadow-2xs"
            >
              <span className="text-base">{sectionBadgeMatch[1]}</span>
              <span>{renderInline(sectionBadgeMatch[2])}</span>
            </div>
          );
          i++;
          continue;
        }

        // 6. Blockquote: > ...
        if (trimmed.startsWith('>')) {
          const quoteLines: string[] = [];
          while (i < lines.length && lines[i].trim().startsWith('>')) {
            quoteLines.push(lines[i].trim().replace(/^>\s*/, ''));
            i++;
          }
          segmentElements.push(
            <blockquote
              key={`quote-${i}`}
              className="my-2.5 pl-3.5 border-l-3 border-[#E85D2C] bg-[#FFF4EE]/40 py-2 pr-3 rounded-r-xl text-xs italic text-[#1A1D29]"
            >
              {renderInline(quoteLines.join(' '))}
            </blockquote>
          );
          continue;
        }

        // 7. Unordered Lists: - item or * item
        if (/^[-*•]\s+/.test(trimmed)) {
          const listItems: string[] = [];
          while (i < lines.length && /^[-*•]\s+/.test(lines[i].trim())) {
            listItems.push(lines[i].trim().replace(/^[-*•]\s+/, ''));
            i++;
          }
          segmentElements.push(
            <ul key={`ul-${i}`} className="my-2 space-y-1.5 pl-1">
              {listItems.map((item, itemIdx) => (
                <li key={itemIdx} className="flex items-start gap-2 text-xs font-mono text-[#1A1D29] leading-relaxed">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#E85D2C] mt-1.5 shrink-0" />
                  <span>{renderInline(item)}</span>
                </li>
              ))}
            </ul>
          );
          continue;
        }

        // 8. Ordered Lists: 1. item, 2. item
        if (/^\d+\.\s+/.test(trimmed)) {
          const listItems: { num: string; text: string }[] = [];
          while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
            const m = lines[i].trim().match(/^(\d+)\.\s+(.*)$/);
            if (m) {
              listItems.push({ num: m[1], text: m[2] });
            }
            i++;
          }
          segmentElements.push(
            <ol key={`ol-${i}`} className="my-2 space-y-1.5 pl-1">
              {listItems.map((item, itemIdx) => (
                <li key={itemIdx} className="flex items-start gap-2 text-xs font-mono text-[#1A1D29] leading-relaxed">
                  <span className="w-4 h-4 rounded-full bg-[#E85D2C]/10 text-[#E85D2C] font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                    {item.num}
                  </span>
                  <span>{renderInline(item.text)}</span>
                </li>
              ))}
            </ol>
          );
          continue;
        }

        // 9. Regular Paragraphs: Guaranteed progress by consuming current line immediately
        const paraLines: string[] = [trimmed];
        i++; // Progress immediately guaranteed!

        while (
          i < lines.length &&
          lines[i].trim() &&
          !lines[i].trim().startsWith('|') &&
          !/^(\*{3,}|-{3,}|_{3,})$/.test(lines[i].trim()) &&
          !lines[i].trim().startsWith('#') &&
          !/^[-*•]\s+/.test(lines[i].trim()) &&
          !/^\d+\.\s+/.test(lines[i].trim()) &&
          !lines[i].trim().startsWith('>') &&
          !(lines[i].trim().length <= 100 && lines[i].trim().match(/^([0-9]+[️⃣\.]|[\u{1F300}-\u{1F9FF}].*?)\s{1,2}(.*)$/u))
        ) {
          paraLines.push(lines[i].trim());
          i++;
        }

        segmentElements.push(
          <div key={`p-${i}`} className="text-xs font-mono leading-relaxed text-[#1A1D29] my-1.5 space-y-1">
            {paraLines.map((pl, plIdx) => (
              <p key={plIdx}>{renderInline(pl)}</p>
            ))}
          </div>
        );
      }

      return <React.Fragment key={segIdx}>{segmentElements}</React.Fragment>;
    });
  }, [content, renderMermaid]);

  return <div className="space-y-3 text-xs font-mono text-[#1A1D29] leading-relaxed">{elements}</div>;
}

export const MarkdownRenderer = React.memo(MarkdownRendererComponent);
export default MarkdownRenderer;
