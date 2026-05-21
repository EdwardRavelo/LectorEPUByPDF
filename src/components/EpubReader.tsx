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
  { id: 'green',  value: '#c5e1a5', label: 'Verde'    },
  { id: 'blue',   value: '#90caf9', label: 'Azul'     },
  { id: 'red',    value: '#ef9a9a', label: 'Rojo'     },
];

function applyAllStyles(
  rendition: Rendition,
  size: number,
  family: string,
  mode: 'light' | 'dark' | 'sepia'
) {
  const bgColor   = mode === 'dark' ? '#1a1b23' : mode === 'sepia' ? '#fcf5e5' : '#ffffff';
  const textColor = mode === 'dark' ? '#eeeeee' : mode === 'sepia' ? '#5b4636' : '#1a1a1a';

  rendition.themes.default({
    body: {
      'font-family':       `${family} !important`,
      'font-size':         `${size}% !important`,
      'color':             `${textColor} !important`,
      'background-color':  `${bgColor} !important`,
      'padding':           '0 60px !important',
      'line-height':       '1.7 !important',
    },
  });
}

export function EpubReader({ id, url, onRemove }: EpubReaderProps) {
  const viewerRef   = useRef<HTMLDivElement>(null);
  const renditionRef = useRef<Rendition | null>(null);
  const bookRef      = useRef<any>(null);

  const { settings, annotations, addAnnotation, updateAnnotation, updateSettings, theme } = useReader();

  const [loadingState, setLoadingState] = useState<'loading' | 'success' | 'error'>('loading');
  const [selectedAnnotation, setSelectedAnnotation] = useState<Annotation | null>(null);
  const [commentText, setCommentText] = useState('');
  const [activeColor, setActiveColor] = useState(HIGHLIGHT_COLORS[0]);
  const [epubProgress, setEpubProgress] = useState<{current: number, total: number, isPercent?: boolean} | null>(null);

  // Ref to always hold the latest activeColor without triggering re-init
  const activeColorRef = useRef(activeColor);
  useEffect(() => { activeColorRef.current = activeColor; }, [activeColor]);

  // Ref to always hold latest addAnnotation
  const addAnnotationRef = useRef(addAnnotation);
  useEffect(() => { addAnnotationRef.current = addAnnotation; }, [addAnnotation]);

  const applyAnnotations = useCallback((rendition: Rendition) => {
    annotations.forEach(anno => {
      if (anno.cfiRange) {
        try {
          rendition.annotations.add(
            'highlight',
            anno.cfiRange,
            {},
            () => {
              setSelectedAnnotation(anno);
              setCommentText(anno.comment || '');
            },
            'hl-class',
            { fill: anno.color, 'fill-opacity': '0.5' }
          );
        } catch (_) {
          // ignore stale CFI errors on re-render
        }
      }
    });
  }, [annotations]);

  // Initialize / re-initialize on URL or viewMode change
  useEffect(() => {
    let isMounted = true;

    const initReader = async () => {
      if (!viewerRef.current || !url) return;
      try {
        setLoadingState('loading');
        if (bookRef.current) {
          try { await bookRef.current.destroy(); } catch (_) {}
        }

        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        if (!isMounted) return;

        const book = ePub(arrayBuffer);
        bookRef.current = book;

        const rendition = book.renderTo(viewerRef.current, {
          width:   '100%',
          height:  '100%',
          flow:    settings.viewMode === 'single' ? 'scrolled' : 'paginated',
          manager: 'default',
          spread:  settings.viewMode === 'double' ? 'auto' : 'none',
        });
        renditionRef.current = rendition;

        // Use refs to avoid stale closures in event handlers
        rendition.on('selected', (cfiRange: string, contents: any) => {
          book.getRange(cfiRange).then((range: Range) => {
            addAnnotationRef.current({
              bookId:   id,
              type:     'highlight',
              cfiRange,
              text:     range.toString(),
              color:    activeColorRef.current.value,
            });
            contents.window.getSelection()?.removeAllRanges();
          });
        });

        rendition.on('relocated', (location: any) => {
          updateSettings({ location: location.start.cfi });
          if (book.locations.length() > 0) {
            const current = book.locations.locationFromCfi(location.start.cfi) as any;
            setEpubProgress({
              current: current || 0,
              total: book.locations.length()
            });
          } else if (typeof location.start.percentage === 'number') {
            setEpubProgress({
              current: Math.round(location.start.percentage * 100),
              total: 100,
              isPercent: true
            });
          }
        });

        await book.opened;
        if (!isMounted) return;

        // Generate locations for better page numbering
        book.locations.generate(1024).then(() => {
          if (isMounted && renditionRef.current) {
            const currentLocation = renditionRef.current.location;
            if (currentLocation) {
              const current = book.locations.locationFromCfi(currentLocation.start.cfi) as any;
              setEpubProgress({
                current: current || 0,
                total: book.locations.length()
              });
            }
          }
        });

        await rendition.display(settings.location?.toString());
        if (!isMounted) return;

        setLoadingState('success');
        applyAllStyles(rendition, settings.fontSize, settings.fontFamily, theme);
        applyAnnotations(rendition);

        rendition.on('rendered', () => {
          if (renditionRef.current) {
            applyAllStyles(renditionRef.current, settings.fontSize, settings.fontFamily, theme);
          }
        });

      } catch (err) {
        if (isMounted) setLoadingState('error');
        console.error('EpubReader init error:', err);
      }
    };

    initReader();

    return () => {
      isMounted = false;
      if (bookRef.current) {
        try { bookRef.current.destroy(); } catch (_) {}
      }
    };
  }, [url, settings.viewMode, id, theme, settings.fontSize, settings.fontFamily, applyAnnotations, updateSettings]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') return;
      if (e.key === 'ArrowLeft')  renditionRef.current?.prev();
      if (e.key === 'ArrowRight') renditionRef.current?.next();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const saveComment = () => {
    if (!selectedAnnotation) return;
    updateAnnotation(selectedAnnotation.id, { comment: commentText });
    setSelectedAnnotation(null);
  };

  const progress = epubProgress
    ? { 
        current: epubProgress.current, 
        total: epubProgress.total, 
        unit: (epubProgress.isPercent ? 'percent' : 'page') as 'percent' | 'page' 
      }
    : undefined;

  return (
    <ReaderLayout
      type="epub"
      onRemove={onRemove}
      onPrev={() => renditionRef.current?.prev()}
      onNext={() => renditionRef.current?.next()}
      progress={progress}
    >
      <div
        className="epub-container"
        style={{ background: theme === 'dark' ? '#1a1b23' : theme === 'sepia' ? '#fcf5e5' : '#fff' }}
      >
        {loadingState === 'loading' && (
          <div className="loading-overlay">
            <Loader2 className="animate-spin" size={36} color="var(--accent)" />
            <p>Preparando tu ePub…</p>
          </div>
        )}

        {loadingState === 'error' && (
          <div className="loading-overlay">
            <p style={{ color: '#e03131' }}>No se pudo cargar el archivo ePub.</p>
          </div>
        )}

        <div ref={viewerRef} style={{ height: '100%', width: '100%' }} />

        {/* Color picker */}
        <div style={{ position: 'absolute', top: '1.5rem', left: '1.5rem', zIndex: 10 }}>
          <div className="glass-panel" style={{ display: 'flex', gap: '5px', padding: '8px', borderRadius: '12px' }}>
            {HIGHLIGHT_COLORS.map(color => (
              <div
                key={color.id}
                className={`color-dot ${activeColor.id === color.id ? 'active' : ''}`}
                style={{ backgroundColor: color.value }}
                onClick={() => setActiveColor(color)}
                title={color.label}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Comment modal */}
      <AnimatePresence>
        {selectedAnnotation && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="comment-modal glass-panel"
            style={{ background: 'white' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1rem' }}>Pensamiento en ePub</h3>
              <button
                onClick={() => setSelectedAnnotation(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '6px' }}
              >
                <X size={18} />
              </button>
            </div>
            <p style={{
              fontSize: '0.78rem', color: '#777', marginBottom: '1rem',
              fontStyle: 'italic', borderLeft: '3px solid var(--accent)',
              paddingLeft: '0.6rem', lineHeight: 1.5,
            }}>
              "{selectedAnnotation.text.substring(0, 150)}{selectedAnnotation.text.length > 150 ? '…' : ''}"
            </p>
            <textarea
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              placeholder="Escribe tu pensamiento aquí…"
              autoFocus
              style={{
                width: '100%', height: '110px', borderRadius: '10px', padding: '10px',
                border: '1px solid #e0e0e0', fontFamily: 'inherit', fontSize: '0.88rem',
                resize: 'vertical', outline: 'none', boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: '8px', marginTop: '0.9rem' }}>
              <button
                onClick={saveComment}
                style={{
                  flex: 1, padding: '0.7rem', background: 'var(--accent)',
                  color: 'white', border: 'none', borderRadius: '10px',
                  cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
                }}
              >
                Guardar
              </button>
              {selectedAnnotation.comment && (
                <button
                  onClick={() => { updateAnnotation(selectedAnnotation.id, { comment: '' }); setSelectedAnnotation(null); }}
                  style={{
                    padding: '0.7rem 1rem', background: 'rgba(0,0,0,0.05)',
                    border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '0.82rem',
                  }}
                >
                  Borrar
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </ReaderLayout>
  );
}
