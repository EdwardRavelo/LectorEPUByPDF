import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Maximize2, Minimize2, ChevronLeft, ChevronRight, ChevronUp, ChevronDown,
  Trash2, Type, Moon, Sun, ZoomIn, ZoomOut
} from 'lucide-react';
import { useReader } from '../../context/ReaderContext';

interface ReaderLayoutProps {
  children: React.ReactNode;
  onRemove: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  onScrollToTop?: () => void;
  onScrollToBottom?: () => void;
  type: 'pdf' | 'epub';
}

export function ReaderLayout({ 
  children, onRemove, onPrev, onNext, onScrollToTop, onScrollToBottom, type 
}: ReaderLayoutProps) {
  const { settings, updateSettings, isLoading } = useReader();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) containerRef.current?.requestFullscreen();
    else document.exitFullscreen();
  };

  const getThemeIcon = () => {
    if (settings.theme === 'light') return <Sun size={20} />;
    if (settings.theme === 'sepia') return <Moon size={20} style={{ color: '#d4a373' }} />;
    return <Moon size={20} />;
  };

  const cycleTheme = () => {
    const themes: ('light' | 'sepia' | 'dark')[] = ['light', 'sepia', 'dark'];
    const currentIndex = themes.indexOf(settings.theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    updateSettings({ theme: themes[nextIndex] });
  };

  return (
    <div 
      ref={containerRef} 
      className={`main-view ${isFullscreen ? 'fullscreen' : ''} ${settings.theme}`}
      style={{ background: settings.theme === 'dark' ? '#121212' : settings.theme === 'sepia' ? '#f4ecd8' : '#f4f4f7' }}
    >
      {/* Global Toolbar/Options Panel */}
      <div className="tools-panel">
        <div className="tool-group glass-panel" style={{ background: 'white', padding: '12px', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="floating-btn" onClick={cycleTheme} title="Cambiar tema (Claro / Sepia / Oscuro)">
              {getThemeIcon()}
            </button>
            <button className="floating-btn" onClick={() => setShowOptions(!showOptions)}>
              <Type size={20} />
            </button>
            <button 
              className={`floating-btn ${settings.viewMode === 'double' ? 'active' : ''}`} 
              style={{ background: settings.viewMode === 'double' ? 'var(--accent)' : 'white', color: settings.viewMode === 'double' ? 'white' : 'black' }} 
              onClick={() => updateSettings({ viewMode: settings.viewMode === 'single' ? 'double' : 'single' })}
            >
              {settings.viewMode === 'single' ? '1' : '2'}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {showOptions && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="text-options-popup glass-panel" style={{ background: 'white' }}>
              <div className="option-row">
                <small>Tamaño del Texto</small>
                <div className="btn-group">
                  <button onClick={() => updateSettings({ fontSize: Math.max(settings.fontSize - 10, 50) })}><ZoomOut size={16}/></button>
                  <span style={{ minWidth: '50px', textAlign: 'center' }}>{settings.fontSize}%</span>
                  <button onClick={() => updateSettings({ fontSize: Math.min(settings.fontSize + 10, 300) })}><ZoomIn size={16}/></button>
                </div>
              </div>
              {type === 'epub' && (
                <div className="option-row">
                  <small>Tipografía</small>
                  <select 
                    value={settings.fontFamily} 
                    onChange={(e) => updateSettings({ fontFamily: e.target.value })} 
                    style={{ padding: '8px', borderRadius: '8px', border: '1px solid #ddd' }}
                  >
                    <option value="'Inter', sans-serif">Sans Moderna</option>
                    <option value="'Georgia', serif">Serif Clásica</option>
                    <option value="'Courier New', monospace">Monoespacio</option>
                  </select>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Main Content */}
      <div className="reader-content" style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {isLoading && (
          <div className="loading-overlay" style={{ background: settings.theme === 'dark' ? '#1a1b23' : '#fff' }}>
             <p>Cargando libro...</p>
          </div>
        )}
        {children}
      </div>

      {/* Floating Toolbar */}
      <motion.div className="floating-toolbar glass-panel" initial={{ y: 100 }} animate={{ y: 0 }} style={{ background: 'white' }}>
        {type === 'epub' ? (
          <>
            <button className="floating-btn" onClick={onPrev}><ChevronLeft size={24} /></button>
            <button className="floating-btn" onClick={onNext}><ChevronRight size={24} /></button>
          </>
        ) : (
          <>
            <button className="floating-btn" onClick={onScrollToTop}><ChevronUp size={24} /></button>
            <button className="floating-btn" onClick={onScrollToBottom}><ChevronDown size={24} /></button>
          </>
        )}
        <div className="toolbar-divider" />
        <button className="floating-btn" onClick={toggleFullscreen}>
          {isFullscreen ? <Minimize2 size={24} /> : <Maximize2 size={24} />}
        </button>
        <button className="floating-btn danger" onClick={onRemove}><Trash2 size={24} /></button>
      </motion.div>
    </div>
  );
}
