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
  { id: 'green', value: 'rgba(139, 195, 74, 0.5)' },
  { id: 'blue', value: 'rgba(3, 169, 244, 0.5)' },
  { id: 'red', value: 'rgba(244, 67, 54, 0.5)' },
];

export function PdfReader({ id, url, onRemove }: PdfReaderProps) {
  const { settings, annotations, addAnnotation, updateAnnotation, deleteAnnotation } = useReader();
  const [numPages, setNumPages] = useState<number | null>(null);
  const [activeColor, setActiveColor] = useState(HIGHLIGHT_COLORS[0]);
  const [mode, setMode] = useState<'select' | 'draw'>('select');
  const [selectedAnnotation, setSelectedAnnotation] = useState<Annotation | null>(null);
  const [commentText, setCommentText] = useState("");
  const viewportRef = useRef<HTMLDivElement>(null);

  const scale = (settings.fontSize / 100) * 1.5;

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  const handleTextSelection = useCallback((pageNumber: number) => {
    if (mode !== 'select') return;
    
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return;

    // Si la selección es sospechosamente grande, la ignoramos para evitar el bug de "todo azul"
    if (selection.toString().length > 2000) {
      selection.removeAllRanges();
      return;
    }

    const range = selection.getRangeAt(0);
    const rects = Array.from(range.getClientRects());
    
    const pageEl = document.querySelector(`[data-page-number="${pageNumber}"] .react-pdf__Page__textContent`);
    if (!pageEl) return;
    
    const pageRect = pageEl.getBoundingClientRect();

    const relativeRects = rects.map(r => ({
      top: (r.top - pageRect.top) / scale,
      left: (r.left - pageRect.left) / scale,
      width: r.width / scale,
      height: r.height / scale,
    }));

    if (relativeRects.length > 0) {
      addAnnotation({
        bookId: id,
        type: 'highlight-text',
        page: pageNumber,
        relativeRects,
        color: activeColor.value,
        text: selection.toString()
      });
      selection.removeAllRanges();
    }
  }, [activeColor, scale, mode, id, addAnnotation]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!viewportRef.current) return;
      const scrollAmount = 300;
      if (e.key === 'ArrowDown') viewportRef.current.scrollBy({ top: scrollAmount, behavior: 'smooth' });
      if (e.key === 'ArrowUp') viewportRef.current.scrollBy({ top: -scrollAmount, behavior: 'smooth' });
      if (e.key === 'ArrowRight') viewportRef.current.scrollBy({ top: scrollAmount, behavior: 'smooth' });
      if (e.key === 'ArrowLeft') viewportRef.current.scrollBy({ top: -scrollAmount, behavior: 'smooth' });
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const openComment = (anno: Annotation, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedAnnotation(anno);
    setCommentText(anno.comment || "");
  };

  const saveComment = () => {
    if (!selectedAnnotation) return;
    updateAnnotation(selectedAnnotation.id, { comment: commentText });
    setSelectedAnnotation(null);
  };

  const clearAll = async () => {
    if (confirm('¿Estás seguro de que quieres borrar todos los resaltados de este PDF?')) {
      for (const anno of annotations) {
        await deleteAnnotation(anno.id);
      }
    }
  };

  return (
    <ReaderLayout 
      type="pdf"
      onRemove={onRemove}
      onScrollToTop={() => viewportRef.current?.scrollTo({top: 0, behavior: 'smooth'})}
      onScrollToBottom={() => viewportRef.current?.scrollTo({top: viewportRef.current.scrollHeight, behavior: 'smooth'})}
    >
      <div style={{ position: 'absolute', top: '2rem', right: '10rem', zIndex: 10 }}>
        <div className="tool-group glass-panel" style={{ background: 'white', padding: '12px' }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
            <button 
              className={`tool-btn ${mode === 'select' ? 'active' : ''}`}
              onClick={() => setMode('select')}
              style={{ flex: 1, padding: '8px', borderRadius: '8px', background: mode === 'select' ? 'var(--accent)' : '#eee', color: mode === 'select' ? 'white' : 'black', border: 'none' }}
            >
              <MousePointer2 size={18} />
            </button>
            <button 
              className={`tool-btn ${mode === 'draw' ? 'active' : ''}`}
              onClick={() => setMode('draw')}
              style={{ flex: 1, padding: '8px', borderRadius: '8px', background: mode === 'draw' ? 'var(--accent)' : '#eee', color: mode === 'draw' ? 'white' : 'black', border: 'none' }}
            >
              <Highlighter size={18} />
            </button>
          </div>

          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '10px' }}>
            {HIGHLIGHT_COLORS.map(color => (
              <div 
                key={color.id}
                className={`color-dot ${activeColor.id === color.id ? 'active' : ''}`} 
                style={{ backgroundColor: color.value.replace('0.5', '1'), width: '28px', height: '28px' }} 
                onClick={() => setActiveColor(color)}
              />
            ))}
          </div>
          
          <button className="floating-btn" style={{ width: '100%', height: '40px', borderRadius: '8px', fontSize: '12px' }} onClick={clearAll}>
             <Eraser size={14} style={{marginRight: '6px'}}/> Limpiar Todo
          </button>
        </div>
      </div>

      <div ref={viewportRef} className="reader-viewport" style={{ padding: '2rem 0', height: '100%', overflowY: 'auto' }}>
        <div className="pdf-scroll-container" style={{ 
          display: 'flex', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: '2rem',
          maxWidth: settings.viewMode === 'double' ? `${scale * 1200}px` : '100%', margin: '0 auto'
        }}>
          <Document file={url} onLoadSuccess={onDocumentLoadSuccess}>
            <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: '2rem' }}>
              {Array.from(new Array(numPages || 0), (_, index) => {
                const pageNum = index + 1;
                return (
                  <div 
                    key={`page_${pageNum}`}
                    data-page-number={pageNum}
                    className="pdf-page-wrapper"
                    onMouseUp={() => handleTextSelection(pageNum)}
                    style={{ background: 'white', margin: 0 }}
                  >
                    <Page pageNumber={pageNum} scale={scale} renderTextLayer={true} />
                    
                    <div className="highlights-container">
                      {annotations
                        .filter(a => a.page === pageNum)
                        .map(anno => (
                          <div key={anno.id} className="highlight-group" onClick={(e) => openComment(anno, e)} style={{ cursor: 'pointer' }}>
                            {anno.relativeRects?.map((r, i) => (
                              <div
                                key={i}
                                className="highlight-rect"
                                style={{
                                  top: r.top * scale,
                                  left: r.left * scale,
                                  width: r.width * scale,
                                  height: r.height * scale,
                                  backgroundColor: anno.color,
                                }}
                              />
                            ))}
                            {anno.comment && (
                              <div style={{ 
                                position: 'absolute', top: (anno.relativeRects?.[0].top || 0) * scale - 10, left: (anno.relativeRects?.[0].left || 0) * scale,
                                background: 'var(--accent)', color: 'white', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', zIndex: 30
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

      <AnimatePresence>
        {selectedAnnotation && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            className="comment-modal glass-panel"
            style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 1000, padding: '2rem', width: '400px', background: 'white' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0 }}>Agregar Pensamiento</h3>
              <button onClick={() => setSelectedAnnotation(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X /></button>
            </div>
            <p style={{ fontSize: '0.8rem', fontStyle: 'italic', marginBottom: '1rem', color: '#666', borderLeft: '3px solid var(--accent)', paddingLeft: '0.5rem' }}>
              "{selectedAnnotation.text.substring(0, 100)}..."
            </p>
            <textarea 
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Escribe tu pensamiento aquí..."
              style={{ width: '100%', height: '120px', borderRadius: '8px', padding: '10px', border: '1px solid #ddd', fontFamily: 'inherit' }}
            />
            <button 
              onClick={saveComment}
              style={{ width: '100%', marginTop: '1rem', padding: '0.8rem', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              Guardar Pensamiento
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </ReaderLayout>
  );
}
