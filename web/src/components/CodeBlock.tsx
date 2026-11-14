import React, { useState } from 'react';
import { Copy, Check, Terminal } from 'lucide-react';

interface CodeBlockProps {
  lang: string;
  code: string;
}

const LANG_COLORS: Record<string, string> = {
  typescript: 'text-blue-400 border-blue-500/30 bg-blue-950/40',
  javascript: 'text-amber-300 border-amber-500/30 bg-amber-950/40',
  python: 'text-emerald-400 border-emerald-500/30 bg-emerald-950/40',
  go: 'text-cyan-400 border-cyan-500/30 bg-cyan-950/40',
  rust: 'text-orange-400 border-orange-500/30 bg-orange-950/40',
  c: 'text-indigo-400 border-indigo-500/30 bg-indigo-950/40',
  cpp: 'text-indigo-300 border-indigo-500/30 bg-indigo-950/40',
  java: 'text-rose-400 border-rose-500/30 bg-rose-950/40',
  sql: 'text-purple-400 border-purple-500/30 bg-purple-950/40',
  bash: 'text-slate-300 border-slate-600/30 bg-slate-800/40'
};

export const CodeBlock: React.FC<CodeBlockProps> = ({ lang, code }) => {
  const [copied, setCopied] = useState(false);
  const normalizedLang = (lang || 'code').toLowerCase().trim();
  const colorClass = LANG_COLORS[normalizedLang] || 'text-indigo-400 border-indigo-500/30 bg-indigo-950/40';

  const lines = code.replace(/\r\n/g, '\n').split('\n');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="my-3 rounded-xl overflow-hidden border border-slate-800 bg-slate-950/90 text-sm shadow-md">
      {/* Header bar */}
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-slate-900 border-b border-slate-800/80 text-xs text-slate-400 font-mono">
        <div className="flex items-center space-x-2">
          <Terminal className="w-3.5 h-3.5 text-slate-500" />
          <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase border ${colorClass}`}>
            {lang || 'code'}
          </span>
          <span className="text-[10px] text-slate-500">
            {lines.length} {lines.length === 1 ? 'line' : 'lines'}
          </span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center space-x-1 px-2 py-0.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors"
          title="Copy snippet"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Copied!' : 'Copy'}</span>
        </button>
      </div>

      {/* Code body with line numbers */}
      <div className="p-3 overflow-x-auto text-xs leading-relaxed font-mono flex">
        {/* Line numbers column */}
        <div className="select-none text-slate-600 text-right pr-3.5 border-r border-slate-800/60 font-mono">
          {lines.map((_, i) => (
            <div key={i} className="leading-relaxed">
              {i + 1}
            </div>
          ))}
        </div>

        {/* Code text */}
        <pre className="pl-3.5 text-slate-200 overflow-x-auto leading-relaxed">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
};
