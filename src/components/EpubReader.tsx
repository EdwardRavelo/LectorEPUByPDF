import { useEffect, useRef, useState, useCallback } from 'react';
import ePub, { Rendition } from 'epubjs';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2 } from 'lucide-react';
import { useReader } from '../context/ReaderContext';
import { ReaderLayout } from './shared/ReaderLayout';
import type { Annotation } from '../services/database';

interface EpubReaderProps {
  id: string;
  url: string;
  onRemove: () => void;
}

const HIGHLIGHT_COLORS = [
  { id: 'yellow', value: '#fff59d', label: 'Amarillo' },
  { id: 'green', value: '#c5e1a5', label: 'Verde' },
  { id: 'blue', value: '#90caf9', label: 'Azul' },
  { id: 'red', value: '#ef9a9a', label: 'Rojo' },
];

export function EpubReader({ id, url, onRemove }: EpubReaderProps) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const renditionRef = useRef<Rendition | null>(null);
  const bookRef = useRef<any>(null);
  const { settings, annotations, addAnnotation, updateAnnotation } = useReader();
  const [loadingState, setLoadingState] = useState<'loading' | 'success' | 'error'>('loading');
  const [selectedAnnotation, setSelectedAnnotation] = useState<Annotation | null>(null);
  const [commentText, setCommentText] = useState("");
  const [activeColor, setActiveColor] = useState(HIGHLIGHT_COLORS[0]);

  const applyAnnotations = useCallback((rendition: Rendition) => {
    annotations.forEach(anno => {
      if (anno.cfiRange) {
        rendition.annotations.add('highlight', anno.cfiRange, {}, () => {
          setSelectedAnnotation(anno);
          setCommentText(anno.comment || "");
        }, 'hl-class', { fill: anno.color, 'fill-opacity': '0.5' });
      }
    });
  }, [annotations]);

  useEffect(() => {
    let isMounted = true;
    const initReader = async () => {
      if (!viewerRef.current || !url) return;
      try {
        setLoadingState('loading');
        if (bookRef.current) await bookRef.current.destroy();

        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        if (!isMounted) return;

        const book = ePub(arrayBuffer);
        bookRef.current = book;

        const rendition = book.renderTo(viewerRef.current, {
          width: '100%',
          height: '100%',
          flow: settings.viewMode === 'single' ? 'scrolled' : 'paginated',
          manager: 'default',
          spread: settings.viewMode === 'double' ? 'auto' : 'none',
        });
        renditionRef.current = rendition;

        rendition.on('selected', (cfiRange: string, contents: any) => {
          book.getRange(cfiRange).then((range: Range) => {
            addAnnotation({
              bookId: id,
              type: 'highlight',
              cfiRange,
              text: range.toString(),
              color: activeColor.value,
            });
            contents.window.getSelection().removeAllRanges();
          });
        });

        await book.opened;
        if (!isMounted) return;

        await rendition.display(settings.location?.toString());
        if (isMounted) {
          setLoadingState('success');
          applyAllStyles(rendition, settings.fontSize, settings.fontFamily, settings.theme);
          applyAnnotations(rendition);
        }

        // Guardar progreso al cambiar de ubicación
        rendition.on('relocated', (location: any) => {
          updateSettings({ location: location.start.cfi });
        });
      } catch (err: any) {
        if (isMounted) setLoadingState('error');
      }
    };
    initReader();
    return () => { isMounted = false; if (bookRef.current) bookRef.current.destroy(); };
  }, [url, settings.viewMode, id]); // Re-init on viewMode or URL change

  useEffect(() => {
    if (renditionRef.current && loadingState === 'success') {
      applyAllStyles(renditionRef.current, settings.fontSize, settings.fontFamily, settings.theme);
    }
  }, [settings.fontSize, settings.fontFamily, settings.theme, loadingState]);

  useEffect(() => {
    if (renditionRef.current && loadingState === 'success') {
      applyAnnotations(renditionRef.current);
    }
  }, [annotations, loadingState, applyAnnotations]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') renditionRef.current?.prev();
      if (e.key === 'ArrowRight') renditionRef.current?.next();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const applyAllStyles = (rendition: Rendition, size: number, family: string, mode: 'light' | 'dark') => {
    if (!rendition) return;
    rendition.themes.default({
      body: {
        'font-family': `${family} !important`,
        'font-size': `${size}% !important`,
        'color': mode === 'dark' ? '#eeeeee !important' : '#000000 !important',
        'background-color': mode === 'dark' ? '#1a1b23 !important' : '#ffffff !important',
        'padding': '0 60px !important',
        'line-height': '1.6 !important'
      }
    });
  };

  const saveComment = () => {
    if (!selectedAnnotation) return;
    updateAnnotation(selectedAnnotation.id, { comment: commentText });
    setSelectedAnnotation(null);
  };

  return (
    <ReaderLayout 
      type="epub"
      onRemove={onRemove}
      onPrev={() => renditionRef.current?.prev()}
      onNext={() => renditionRef.current?.next()}
    >
      <div className="epub-container" style={{ 
        height: '100%', width: '100%', maxWidth: '1200px', margin: '0 auto', 
        position: 'relative', overflow: 'hidden'
      }}>
        {loadingState === 'loading' && (
          <div className="loading-overlay">
            <Loader2 className="animate-spin" size={40} color="var(--accent)" />
            <p style={{ marginTop: '1rem' }}>Preparando tu ePub...</p>
          </div>
        )}
        <div ref={viewerRef} style={{ height: '100%', width: '100%' }} />

        {/* Highlight Color Picker (Floating in Reader) */}
        <div style={{ position: 'absolute', top: '2rem', left: '2rem', zIndex: 10 }}>
           <div className="glass-panel" style={{ display: 'flex', gap: '6px', padding: '8px', background: 'white' }}>
            {HIGHLIGHT_COLORS.map(color => (
              <div 
                key={color.id}
                className={`color-dot ${activeColor.id === color.id ? 'active' : ''}`} 
                style={{ backgroundColor: color.value, width: '24px', height: '24px' }} 
                onClick={() => setActiveColor(color)}
              />
            ))}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {selectedAnnotation && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            className="comment-modal glass-panel"
            style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 1000, padding: '2rem', width: '400px', background: 'white' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0 }}>Pensamiento en ePub</h3>
              <button onClick={() => setSelectedAnnotation(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20}/></button>
            </div>
            <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '1.5rem', fontStyle: 'italic', borderLeft: '4px solid var(--accent)', paddingLeft: '1rem' }}>
              "{selectedAnnotation.text.substring(0, 150)}..."
            </p>
            <textarea 
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Escribe tu pensamiento aquí..."
              style={{ width: '100%', height: '120px', borderRadius: '12px', padding: '12px', border: '1px solid #ddd', fontSize: '1rem', background: '#f9f9f9' }}
            />
            <button 
              onClick={saveComment}
              style={{ width: '100%', marginTop: '1.5rem', padding: '1rem', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              Guardar Pensamiento
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </ReaderLayout>
  );
}

