import React, { useState } from 'react';
import { useTheme } from '../context/ThemeContext.js';
import { Image as ImageIcon } from 'lucide-react';

interface DataSaverImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  placeholder?: string;
  bytes?: number;
}

export const DataSaverImage: React.FC<DataSaverImageProps> = ({
  src,
  alt,
  width,
  height,
  bytes
}) => {
  const { dataSaver } = useTheme();
  const [loaded, setLoaded] = useState(!dataSaver);

  const formatBytes = (b?: number) => {
    if (!b) return '';
    return `${Math.round(b / 1024)} KB`;
  };

  if (dataSaver && !loaded) {
    return (
      <div
        onClick={() => setLoaded(true)}
        className="relative group cursor-pointer my-2 rounded-lg border border-slate-800 bg-slate-900/60 p-6 flex flex-col items-center justify-center text-center transition hover:bg-slate-800/80"
        style={{ minHeight: '140px' }}
      >
        <ImageIcon className="w-8 h-8 text-indigo-400 mb-2 group-hover:scale-110 transition-transform" />
        <span className="text-xs font-medium text-slate-300">Tap to view screenshot</span>
        <span className="text-[11px] text-slate-500 mt-0.5">Data Saver active {bytes ? `(~${formatBytes(bytes)})` : ''}</span>
      </div>
    );
  }

  return (
    <div className="relative my-2 rounded-lg overflow-hidden border border-slate-800 bg-slate-900">
      <img
        src={src}
        alt={alt || 'Devlog screenshot'}
        width={width}
        height={height}
        loading="lazy"
        className="w-full h-auto max-h-[500px] object-contain rounded-lg"
      />
    </div>
  );
};
