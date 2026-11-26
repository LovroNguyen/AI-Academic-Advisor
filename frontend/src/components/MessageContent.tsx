import React from 'react';

// Renders an AI answer: **bold**, ##/### headings, bullet lines and Markdown tables.
// Shared by the full chat page and the floating chat bubble.
const renderInline = (text: string) => {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((p, pi) => {
    if (p.startsWith('**') && p.endsWith('**')) {
      return (
        <strong key={pi} className="font-semibold text-slate-900">
          {p.slice(2, -2)}
        </strong>
      );
    }
    return p;
  });
};

export const formatMessage = (content: string) => {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let tableBuffer: string[] = [];

  const flushTable = (keyPrefix: number) => {
    if (tableBuffer.length < 2) {
      tableBuffer.forEach((tblLine, idx) => {
        elements.push(
          <div key={`${keyPrefix}-raw-${idx}`} className="leading-relaxed">
            {renderInline(tblLine)}
          </div>,
        );
      });
      tableBuffer = [];
      return;
    }

    const headerLine = tableBuffer[0];
    const dataLines = tableBuffer.slice(1).filter((l) => !/^\|[\s\-:|]+\|$/.test(l.trim()));

    const parseRow = (line: string) =>
      line
        .trim()
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map((c) => c.trim());

    const headers = parseRow(headerLine);

    elements.push(
      <div key={`${keyPrefix}-tbl`} className="my-2.5 overflow-x-auto rounded-xl border border-slate-200/90 shadow-2xs">
        <table className="w-full text-left text-[11px] border-collapse bg-white">
          <thead className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
            <tr>
              {headers.map((h, hi) => (
                <th key={hi} className="px-3 py-2 border-r border-slate-200/50 last:border-r-0">
                  {renderInline(h)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {dataLines.map((rowLine, ri) => {
              const cells = parseRow(rowLine);
              return (
                <tr key={ri} className="hover:bg-indigo-50/30 transition-colors">
                  {cells.map((cell, ci) => (
                    <td key={ci} className="px-3 py-2 border-r border-slate-100 last:border-r-0 font-normal">
                      {renderInline(cell)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>,
    );
    tableBuffer = [];
  };

  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      tableBuffer.push(trimmed);
    } else {
      if (tableBuffer.length > 0) {
        flushTable(i);
      }

      if (trimmed.startsWith('### ') || trimmed.startsWith('## ')) {
        const titleText = trimmed.replace(/^#{2,3}\s+/, '');
        elements.push(
          <div key={i} className="font-bold text-slate-900 mt-2.5 mb-1 text-[13px]">
            {titleText}
          </div>,
        );
      } else if (trimmed === '') {
        elements.push(<div key={i} className="h-1.5" />);
      } else {
        const isBullet = trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('*');
        elements.push(
          <div key={i} className={`leading-relaxed ${isBullet ? 'pl-2 my-0.5' : 'my-0.5'}`}>
            {renderInline(line)}
          </div>,
        );
      }
    }
  });

  if (tableBuffer.length > 0) {
    flushTable(lines.length);
  }

  return elements;
};
