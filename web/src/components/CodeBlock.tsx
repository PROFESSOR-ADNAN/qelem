import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface CodeBlockProps {
  lang: string;
  code: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ lang, code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="my-3 rounded-lg overflow-hidden border border-slate-800 bg-slate-900/90 text-sm">
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800/80 border-b border-slate-800 text-xs text-slate-400 font-mono">
        <span className="uppercase font-semibold text-indigo-400">{lang}</span>
        <button
          onClick={handleCopy}
          className="flex items-center space-x-1 hover:text-slate-200 transition-colors"
          title="Copy snippet"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <pre className="p-3 overflow-x-auto text-slate-200 text-xs leading-relaxed font-mono">
        <code>{code}</code>
      </pre>
    </div>
  );
};
