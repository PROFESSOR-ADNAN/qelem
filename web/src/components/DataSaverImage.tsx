import React, { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext.js';
import { Image as ImageIcon, X, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

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
  const [isOpen, setIsOpen] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);

  const formatBytes = (b?: number) => {
    if (!b) return '';
    return `${Math.round(b / 1024)} KB`;
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setIsZoomed(false);
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen]);

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
    <>
      <div
        onClick={() => setIsOpen(true)}
        className="relative my-2 rounded-xl overflow-hidden border border-slate-800 bg-slate-950 group cursor-zoom-in"
      >
        <img
          src={src}
          alt={alt || 'Devlog screenshot'}
          width={width}
          height={height}
          loading="lazy"
          className="w-full h-auto max-h-[500px] object-contain rounded-xl transition duration-200 group-hover:opacity-95"
        />
        <div className="absolute bottom-2 right-2 px-2 py-1 rounded-md bg-slate-900/80 backdrop-blur border border-slate-700/60 text-[11px] text-slate-300 opacity-0 group-hover:opacity-100 transition flex items-center space-x-1">
          <Maximize2 className="w-3 h-3" />
          <span>Expand</span>
        </div>
      </div>

      {/* Fullscreen Lightbox Modal */}
      {isOpen && (
        <div
          onClick={() => {
            setIsOpen(false);
            setIsZoomed(false);
          }}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200"
        >
          {/* Top Controls */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute top-4 right-4 flex items-center space-x-2 z-10"
          >
            <button
              onClick={() => setIsZoomed(!isZoomed)}
              className="p-2 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
              title={isZoomed ? 'Zoom Out' : 'Zoom In'}
            >
              {isZoomed ? <ZoomOut className="w-4 h-4" /> : <ZoomIn className="w-4 h-4" />}
            </button>
            <button
              onClick={() => {
                setIsOpen(false);
                setIsZoomed(false);
              }}
              className="p-2 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Modal Image container */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-[95vw] max-h-[90vh] overflow-auto flex items-center justify-center p-2"
          >
            <img
              src={src}
              alt={alt || 'Full devlog preview'}
              onClick={() => setIsZoomed(!isZoomed)}
              className={`rounded-lg transition-transform duration-200 cursor-pointer object-contain ${
                isZoomed
                  ? 'scale-150 max-w-none'
                  : 'max-w-full max-h-[85vh] shadow-2xl'
              }`}
            />
          </div>
        </div>
      )}
    </>
  );
};
