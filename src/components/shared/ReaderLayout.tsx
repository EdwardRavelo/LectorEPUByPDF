import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Maximize2, Minimize2, ChevronLeft, ChevronRight, ChevronUp, ChevronDown,
  Trash2, Type, Moon, Sun, Sunset, ZoomIn, ZoomOut
} from 'lucide-react';
import { useReader } from '../../context/ReaderContext';

interface Progress {
  current: number;
  total: number;
  /** 'page' shows "Pág. X / Y", 'percent' shows "X%" */
  unit?: 'page' | 'percent';
}

interface ReaderLayoutProps {
  children: React.ReactNode;
  onRemove: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  onScrollToTop?: () => void;
  onScrollToBottom?: () => void;
  type: 'pdf' | 'epub';
  progress?: Progress;
}

export function ReaderLayout({
  children, onRemove, onPrev, onNext, onScrollToTop, onScrollToBottom, type, progress
}: ReaderLayoutProps) {
  const { settings, updateSettings, isLoading, theme, setTheme } = useReader();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [showToolbars, setShowToolbars] = useState(true);
  const toolbarTimerRef = React.useRef<number | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // Auto-hide toolbars
  useEffect(() => {
    const handleMouseMove = () => {
      setShowToolbars(true);
      if (toolbarTimerRef.current) window.clearTimeout(toolbarTimerRef.current);
      
      toolbarTimerRef.current = window.setTimeout(() => {
        if (!showOptions) setShowToolbars(false);
      }, 3000);
    };

    window.addEventListener('mousemove', handleMouseMove);
    handleMouseMove(); // Initial timer

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (toolbarTimerRef.current) window.clearTimeout(toolbarTimerRef.current);
    };
  }, [showOptions]);

  // Close options panel on outside click
  useEffect(() => {
    if (!showOptions) return;
    const handler = (e: MouseEvent) => {
      const panel = document.querySelector('.text-options-popup');
      const btn = document.querySelector('[data-options-btn]');
      if (panel && !panel.contains(e.target as Node) && !btn?.contains(e.target as Node)) {
        setShowOptions(false);
      }
    };
    setTimeout(() => window.addEventListener('click', handler), 0);
    return () => window.removeEventListener('click', handler);
  }, [showOptions]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) containerRef.current?.requestFullscreen();
    else document.exitFullscreen();
  };

  const cycleTheme = () => {
    const themes: ('light' | 'sepia' | 'dark')[] = ['light', 'sepia', 'dark'];
    const next = (themes.indexOf(theme) + 1) % themes.length;
    setTheme(themes[next]);
  };

  const ThemeIcon = () => {
    if (theme === 'light') return <Sun size={18} />;
    if (theme === 'sepia') return <Sunset size={18} />;
    return <Moon size={18} />;
  };

  const themeLabel = theme === 'light' ? 'Claro' : theme === 'sepia' ? 'Sepia' : 'Oscuro';

  const progressRatio = progress ? Math.min(progress.current / progress.total, 1) : 0;
  const progressLabel = progress
    ? progress.unit === 'percent'
      ? `${progress.current}%`
      : `${progress.current} / ${progress.total}${progress.total - progress.current > 0 ? ` (restan ${progress.total - progress.current})` : ''}`
    : null;

  return (
    <div
      ref={containerRef}
      className={`main-view ${isFullscreen ? 'fullscreen' : ''} ${theme}`}
      style={{
        background:
          theme === 'dark' ? '#111318'
          : theme === 'sepia' ? '#f0e8d4'
          : '#eeeef2'
      }}
    >
      {/* Reading progress bar */}
      <AnimatePresence>
        {showToolbars && progress && progress.total > 0 && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="reading-progress-bar"
          >
            <div
              className="reading-progress-fill"
              style={{ width: `${progressRatio * 100}%` }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top-right options panel */}
      <AnimatePresence>
        {showToolbars && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="tools-panel"
          >
            <div className="tool-group glass-panel">
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  className="floating-btn"
                  onClick={cycleTheme}
                  title={`Tema: ${themeLabel} → siguiente`}
                >
                  <ThemeIcon />
                </button>
                <button
                  className="floating-btn"
                  data-options-btn
                  onClick={() => setShowOptions(v => !v)}
                  title="Opciones de texto"
                >
                  <Type size={18} />
                </button>
                <button
                  className={`floating-btn ${settings.viewMode === 'double' ? 'active' : ''}`}
                  onClick={() => updateSettings({ viewMode: settings.viewMode === 'single' ? 'double' : 'single' })}
                  title={settings.viewMode === 'single' ? 'Vista doble página' : 'Vista página única'}
                  style={{ fontSize: '0.78rem', fontWeight: 700 }}
                >
                  {settings.viewMode === 'single' ? '1' : '2'}
                </button>
              </div>
            </div>

            <AnimatePresence>
              {showOptions && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  className="text-options-popup glass-panel"
                >
                  <div className="option-row">
                    <small>Tamaño del texto</small>
                    <div className="btn-group">
                      <button
                        onClick={() => updateSettings({ fontSize: Math.max(settings.fontSize - 10, 50) })}
                        title="Reducir"
                      >
                        <ZoomOut size={15} />
                      </button>
                      <span>{settings.fontSize}%</span>
                      <button
                        onClick={() => updateSettings({ fontSize: Math.min(settings.fontSize + 10, 300) })}
                        title="Aumentar"
                      >
                        <ZoomIn size={15} />
                      </button>
                    </div>
                  </div>

                  {type === 'epub' && (
                    <div className="option-row">
                      <small>Tipografía</small>
                      <select
                        value={settings.fontFamily}
                        onChange={e => updateSettings({ fontFamily: e.target.value })}
                      >
                        <option value="'Inter', sans-serif">Sans moderna</option>
                        <option value="'Georgia', serif">Serif clásica</option>
                        <option value="'Courier New', monospace">Monoespacio</option>
                      </select>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content area */}
      <div className="reader-content">
        {isLoading && (
          <div className="loading-overlay">
            <p>Cargando libro…</p>
          </div>
        )}
        {children}
      </div>

      {/* Floating bottom toolbar */}
      <AnimatePresence>
        {showToolbars && (
          <motion.div
            className="floating-toolbar glass-panel"
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
          >
            {type === 'epub' ? (
              <>
                <button className="floating-btn" onClick={onPrev} title="Página anterior (←)">
                  <ChevronLeft size={22} />
                </button>
                <button className="floating-btn" onClick={onNext} title="Página siguiente (→)">
                  <ChevronRight size={22} />
                </button>
              </>
            ) : (
              <>
                <button className="floating-btn" onClick={onScrollToTop} title="Ir al inicio">
                  <ChevronUp size={22} />
                </button>
                <button className="floating-btn" onClick={onScrollToBottom} title="Ir al final">
                  <ChevronDown size={22} />
                </button>
              </>
            )}

            {progressLabel && (
              <>
                <div className="toolbar-divider" />
                <span className="page-indicator">{progressLabel}</span>
              </>
            )}

            <div className="toolbar-divider" />
            <button className="floating-btn" onClick={toggleFullscreen} title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}>
              {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
            </button>
            <button className="floating-btn danger" onClick={onRemove} title="Cerrar libro">
              <Trash2 size={20} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
