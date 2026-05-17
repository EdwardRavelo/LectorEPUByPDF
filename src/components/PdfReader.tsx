import { useState, useCallback, useRef, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Highlighter, MousePointer2, Eraser } from 'lucide-react';
import { useReader } from '../context/ReaderContext';
import { ReaderLayout } from './shared/ReaderLayout';
import type { Annotation } from '../services/database';

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfReaderProps {
  id: string;
  url: string;
  onRemove: () => void;
}

const HIGHLIGHT_COLORS = [
  { id: 'yellow', value: 'rgba(255, 235, 59, 0.5)' },
  { id: 'green',  value: 'rgba(139, 195, 74, 0.5)' },
  { id: 'blue',   value: 'rgba(3, 169, 244, 0.5)'  },
  { id: 'red',    value: 'rgba(244, 67, 54, 0.5)'  },
];

export function PdfReader({ id, url, onRemove }: PdfReaderProps) {
  const { settings, updateSettings, annotations, addAnnotation, updateAnnotation, deleteAnnotation } = useReader();
  const [numPages, setNumPages] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [activeColor, setActiveColor] = useState(HIGHLIGHT_COLORS[0]);
  const [mode, setMode] = useState<'select' | 'highlight'>('select');
  const [selectedAnnotation, setSelectedAnnotation] = useState<Annotation | null>(null);
  const [commentText, setCommentText] = useState('');
  const viewportRef = useRef<HTMLDivElement>(null);

  const scale = (settings.fontSize / 100) * 1.5;

  // Restore reading position on document load
  useEffect(() => {
    if (!viewportRef.current || typeof settings.location !== 'number' || !numPages) return;
    const page = settings.location as number;
    const timer = setTimeout(() => {
      viewportRef.current?.querySelector(`[data-page-number="${page}"]`)?.scrollIntoView();
    }, 500);
    return () => clearTimeout(timer);
  }, [numPages]); // intentionally only on load

  const onDocumentLoadSuccess = ({ numPages: total }: { numPages: number }) => {
    setNumPages(total);
  };

  const onScroll = useCallback(() => {
    if (!viewportRef.current) return;
    const scrollPos = viewportRef.current.scrollTop + 150;
    let page = 1;
    viewportRef.current.querySelectorAll('.pdf-page-wrapper').forEach((el: Element) => {
      const wrapper = el as HTMLElement;
      if (wrapper.offsetTop <= scrollPos) {
        page = parseInt(wrapper.getAttribute('data-page-number') || '1');
      }
    });
    setCurrentPage(page);
    if (settings.location !== page) {
      updateSettings({ location: page });
    }
  }, [settings.location, updateSettings]);

  const handleTextSelection = useCallback((pageNumber: number) => {
    if (mode !== 'select') return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return;
    if (selection.toString().length > 2000) { selection.removeAllRanges(); return; }

    const range = selection.getRangeAt(0);
    const rects = Array.from(range.getClientRects());
    const pageEl = document.querySelector(`[data-page-number="${pageNumber}"] .react-pdf__Page__textContent`);
    if (!pageEl) return;

    const pageRect = pageEl.getBoundingClientRect();
    const relativeRects = rects.map(r => ({
      top:    (r.top    - pageRect.top)  / scale,
      left:   (r.left   - pageRect.left) / scale,
      width:  r.width  / scale,
      height: r.height / scale,
    })).filter(r => r.width > 0 && r.height > 0);

    if (relativeRects.length > 0) {
      addAnnotation({
        bookId: id,
        type: 'highlight-text',
        page: pageNumber,
        relativeRects,
        color: activeColor.value,
        text: selection.toString(),
      });
      selection.removeAllRanges();
    }
  }, [activeColor, scale, mode, id, addAnnotation]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!viewportRef.current) return;
      const amount = 300;
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        viewportRef.current.scrollBy({ top: amount, behavior: 'smooth' });
      }
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        viewportRef.current.scrollBy({ top: -amount, behavior: 'smooth' });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const openComment = (anno: Annotation, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedAnnotation(anno);
    setCommentText(anno.comment || '');
  };

  const saveComment = () => {
    if (!selectedAnnotation) return;
    updateAnnotation(selectedAnnotation.id, { comment: commentText });
    setSelectedAnnotation(null);
  };

  const clearAll = async () => {
    if (annotations.length === 0) return;
    for (const anno of annotations) await deleteAnnotation(anno.id);
  };

  const progress = numPages && numPages > 0
    ? { current: currentPage, total: numPages, unit: 'page' as const }
    : undefined;

  return (
    <ReaderLayout
      type="pdf"
      onRemove={onRemove}
      onScrollToTop={() => viewportRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
      onScrollToBottom={() => viewportRef.current?.scrollTo({ top: viewportRef.current.scrollHeight, behavior: 'smooth' })}
      progress={progress}
    >
      {/* Annotation toolbar */}
      <div className="pdf-tools-panel">
        <div className="tool-group glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              className={`floating-btn ${mode === 'select' ? 'active' : ''}`}
              onClick={() => setMode('select')}
              title="Seleccionar texto para resaltar"
              style={{ borderRadius: '8px' }}
            >
              <MousePointer2 size={17} />
            </button>
            <button
              className={`floating-btn ${mode === 'highlight' ? 'active' : ''}`}
              onClick={() => setMode('highlight')}
              title="Modo resaltado activo"
              style={{ borderRadius: '8px' }}
            >
              <Highlighter size={17} />
            </button>
          </div>

          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', justifyContent: 'center' }}>
            {HIGHLIGHT_COLORS.map(color => (
              <div
                key={color.id}
                className={`color-dot ${activeColor.id === color.id ? 'active' : ''}`}
                style={{ backgroundColor: color.value.replace('0.5', '1') }}
                onClick={() => setActiveColor(color)}
                title={color.id}
              />
            ))}
          </div>

          {annotations.length > 0 && (
            <button
              className="floating-btn"
              style={{ borderRadius: '8px', width: '100%', fontSize: '0.7rem', gap: '4px' }}
              onClick={clearAll}
              title="Borrar todos los resaltados"
            >
              <Eraser size={14} />
            </button>
          )}
        </div>
      </div>

      {/* PDF scroll viewport */}
      <div
        ref={viewportRef}
        onScroll={onScroll}
        className="reader-viewport"
        style={{ height: '100%' }}
      >
        <div
          className="pdf-scroll-container"
          style={{
            maxWidth: settings.viewMode === 'double' ? `${scale * 1200}px` : '860px',
          }}
        >
          <Document file={url} onLoadSuccess={onDocumentLoadSuccess}>
            <div style={{
              display: 'flex',
              flexDirection: settings.viewMode === 'double' ? 'row' : 'column',
              flexWrap: settings.viewMode === 'double' ? 'wrap' : 'nowrap',
              justifyContent: 'center',
              gap: '2rem',
              alignItems: 'flex-start',
            }}>
              {Array.from({ length: numPages || 0 }, (_, i) => {
                const pageNum = i + 1;
                return (
                  <div
                    key={`page_${pageNum}`}
                    data-page-number={pageNum}
                    className="pdf-page-wrapper"
                    onMouseUp={() => handleTextSelection(pageNum)}
                  >
                    <Page pageNumber={pageNum} scale={scale} renderTextLayer renderAnnotationLayer={false} />

                    <div className="highlights-container">
                      {annotations
                        .filter(a => a.page === pageNum)
                        .map(anno => (
                          <div
                            key={anno.id}
                            className="highlight-group"
                            onClick={e => openComment(anno, e)}
                          >
                            {anno.relativeRects?.map((r, i) => (
                              <div
                                key={i}
                                className="highlight-rect"
                                style={{
                                  top:    r.top    * scale,
                                  left:   r.left   * scale,
                                  width:  r.width  * scale,
                                  height: r.height * scale,
                                  backgroundColor: anno.color,
                                }}
                              />
                            ))}
                            {anno.comment && (
                              <div style={{
                                position: 'absolute',
                                top: (anno.relativeRects?.[0]?.top ?? 0) * scale - 12,
                                left: (anno.relativeRects?.[0]?.left ?? 0) * scale,
                                background: 'var(--accent)',
                                color: 'white',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontSize: '9px',
                                fontWeight: 600,
                                zIndex: 30,
                                pointerEvents: 'none',
                              }}>
                                Pensamiento
                              </div>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </Document>
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
              <h3 style={{ margin: 0, fontSize: '1rem' }}>Agregar pensamiento</h3>
              <button
                onClick={() => setSelectedAnnotation(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '6px' }}
              >
                <X size={18} />
              </button>
            </div>
            <p style={{
              fontSize: '0.78rem', fontStyle: 'italic', marginBottom: '1rem',
              color: '#777', borderLeft: '3px solid var(--accent)', paddingLeft: '0.6rem',
              lineHeight: 1.5,
            }}>
              "{selectedAnnotation.text.substring(0, 120)}{selectedAnnotation.text.length > 120 ? '…' : ''}"
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
