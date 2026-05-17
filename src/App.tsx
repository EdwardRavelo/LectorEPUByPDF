import { useState, useRef, useCallback, useEffect } from 'react'
import { Plus, Library, Trash2, FileText, ChevronLeft, ChevronRight, BookOpen } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { PdfReader } from './components/PdfReader'
import { EpubReader } from './components/EpubReader'
import { ReaderProvider, useReader } from './context/ReaderContext'
import { dbService, type BookRecord } from './services/database'
import './App.css'

interface BookFile {
  id: string;
  name: string;
  type: 'pdf' | 'epub';
  url: string;
}

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  return { toasts, addToast };
}

async function generateBookId(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
}

function AppContent() {
  const [books, setBooks] = useState<BookFile[]>([]);
  const [currentBook, setCurrentBook] = useState<BookFile | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { setActiveBookId } = useReader();
  const { toasts, addToast } = useToast();

  // Load books from IndexedDB on mount
  useEffect(() => {
    const loadBooks = async () => {
      try {
        const storedBooks = await dbService.getAllBooks();
        const booksWithUrls = storedBooks.map(b => ({
          id: b.id,
          name: b.name,
          type: b.type,
          url: URL.createObjectURL(b.data),
        }));
        setBooks(booksWithUrls);
      } catch (error) {
        console.error('Failed to load books:', error);
        addToast('Error al cargar la biblioteca', 'error');
      } finally {
        setIsLoading(false);
      }
    };
    loadBooks();
  }, [addToast]);

  useEffect(() => {
    setActiveBookId(currentBook?.id || null);
  }, [currentBook, setActiveBookId]);

  // Press 'b' to toggle sidebar
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      if (e.key === 'b' || e.key === 'B') setIsSidebarCollapsed(prev => !prev);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Dismiss confirm-remove on outside click
  useEffect(() => {
    if (!confirmRemoveId) return;
    const handler = () => setConfirmRemoveId(null);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, [confirmRemoveId]);

  const processFile = useCallback(async (file: File) => {
    const lower = file.name.toLowerCase();
    if (!lower.endsWith('.pdf') && !lower.endsWith('.epub')) {
      addToast('Solo se aceptan archivos PDF y ePub', 'error');
      return;
    }
    
    try {
      const id = await generateBookId(file);
      
      // Check if already exists (in memory or database)
      if (books.some(b => b.id === id)) {
        addToast('Este libro ya está en tu biblioteca', 'info');
        const existing = books.find(b => b.id === id);
        if (existing) setCurrentBook(existing);
        return;
      }

      const type: 'pdf' | 'epub' = lower.endsWith('.pdf') ? 'pdf' : 'epub';
      const cleanName = file.name.replace(/\.(pdf|epub)$/i, '');
      
      const bookRecord: BookRecord = {
        id,
        name: cleanName,
        type,
        data: file,
        addedAt: Date.now(),
      };

      await dbService.saveBook(bookRecord);

      const newBook: BookFile = {
        id,
        name: cleanName,
        type,
        url: URL.createObjectURL(file),
      };

      setBooks(prev => [...prev, newBook]);
      setCurrentBook(newBook);
      addToast(`"${cleanName}" añadido`);
    } catch (error) {
      console.error('Error processing file:', error);
      addToast('Error al procesar el archivo', 'error');
    }
  }, [books, addToast]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  };

  const removeBook = useCallback(async (id: string) => {
    try {
      await dbService.deleteBook(id);
      setBooks(prev => {
        const book = prev.find(b => b.id === id);
        if (book) {
          URL.revokeObjectURL(book.url);
          addToast(`"${book.name}" eliminado`, 'info');
        }
        const next = prev.filter(b => b.id !== id);
        setCurrentBook(cur => cur?.id === id ? (next[0] ?? null) : cur);
        return next;
      });
    } catch (error) {
      console.error('Failed to delete book:', error);
      addToast('Error al eliminar el libro', 'error');
    }
    setConfirmRemoveId(null);
  }, [addToast]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const truncate = (name: string, max = 26) =>
    name.length > max ? name.slice(0, max - 1) + '…' : name;

  if (isLoading) {
    return (
      <div className="loading-screen">
        <Library size={48} className="animate-pulse" />
        <p>Cargando biblioteca...</p>
      </div>
    );
  }

  return (
    <div
      className="app-layout"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drop zone overlay */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="drop-overlay"
          >
            <motion.div
              initial={{ scale: 0.88 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 22 }}
              className="drop-content"
            >
              <BookOpen size={60} strokeWidth={1.25} />
              <p>Suelta tu libro aquí</p>
              <small>PDF · ePub</small>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={`sidebar glass-panel ${isSidebarCollapsed ? 'collapsed' : ''}`}>
        {isSidebarCollapsed ? (
          <div className="icon-rail">
            <button
              className="rail-toggle"
              onClick={() => setIsSidebarCollapsed(false)}
              title="Expandir biblioteca (B)"
            >
              <ChevronRight size={17} />
            </button>

            <div className="rail-books">
              {books.map(book => (
                <button
                  key={book.id}
                  className={`rail-book-btn ${currentBook?.id === book.id ? 'active' : ''}`}
                  onClick={() => setCurrentBook(book)}
                  title={book.name}
                >
                  <span className={`rail-book-initial type-${book.type}`}>
                    {book.name.charAt(0).toUpperCase()}
                  </span>
                </button>
              ))}
            </div>

            <button
              className="rail-add"
              onClick={() => fileInputRef.current?.click()}
              title="Añadir libro"
            >
              <Plus size={19} />
            </button>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.18 }}
            style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}
          >
            <div className="lib-header">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <motion.h2
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    Libris
                  </motion.h2>
                  <p className="lib-subtitle">
                    {books.length === 0
                      ? 'Biblioteca vacía'
                      : `${books.length} libro${books.length !== 1 ? 's' : ''}`}
                  </p>
                </div>
                <button
                  className="sidebar-toggle-btn"
                  onClick={() => setIsSidebarCollapsed(true)}
                  title="Colapsar (B)"
                >
                  <ChevronLeft size={17} />
                </button>
              </div>
            </div>

            <div className="book-list">
              <AnimatePresence initial={false}>
                {books.map(book => (
                  <motion.div
                    key={book.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, height: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }}
                    transition={{ duration: 0.18 }}
                    className={`book-card ${currentBook?.id === book.id ? 'active' : ''}`}
                    onClick={() => { setCurrentBook(book); setConfirmRemoveId(null); }}
                  >
                    <div className="book-info">
                      <FileText size={15} className={`book-icon type-${book.type}`} />
                      <div className="book-text">
                        <span className="book-title">{truncate(book.name)}</span>
                        <span className={`book-badge type-${book.type}`}>{book.type}</span>
                      </div>
                    </div>

                    {confirmRemoveId === book.id ? (
                      <div className="confirm-remove" onClick={e => e.stopPropagation()}>
                        <button className="confirm-yes" onClick={() => removeBook(book.id)}>Sí</button>
                        <button className="confirm-no" onClick={() => setConfirmRemoveId(null)}>No</button>
                      </div>
                    ) : (
                      <button
                        className="btn-remove"
                        title="Eliminar"
                        onClick={e => { e.stopPropagation(); setConfirmRemoveId(book.id); }}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>

              {books.length === 0 && (
                <div className="empty-library">
                  <Library size={32} strokeWidth={1.25} />
                  <p>Arrastra un libro aquí<br />o usa el botón de abajo</p>
                </div>
              )}
            </div>

            <input
              type="file"
              accept=".pdf,.epub"
              style={{ display: 'none' }}
              ref={fileInputRef}
              onChange={handleFileUpload}
            />

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              className="upload-button"
              onClick={() => fileInputRef.current?.click()}
            >
              <Plus size={17} />
              Añadir libro
            </motion.button>
          </motion.div>
        )}
      </aside>

      {/* Main content */}
      <main className="main-view">
        <AnimatePresence mode="wait">
          {currentBook ? (
            <motion.div
              key={currentBook.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              style={{ height: '100%', width: '100%' }}
            >
              {currentBook.type === 'pdf' ? (
                <PdfReader
                  id={currentBook.id}
                  url={currentBook.url}
                  onRemove={() => removeBook(currentBook.id)}
                />
              ) : (
                <EpubReader
                  id={currentBook.id}
                  url={currentBook.url}
                  onRemove={() => removeBook(currentBook.id)}
                />
              )}
            </motion.div>
          ) : (
            <motion.div
              className="reader-placeholder"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="placeholder-content">
                <Library size={72} strokeWidth={1} className="placeholder-icon" />
                <h3>Tu santuario de lectura</h3>
                <p>Añade un libro para comenzar</p>
                <div className="placeholder-formats">
                  <span className="format-chip pdf">PDF</span>
                  <span className="format-chip epub">ePub</span>
                </div>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="upload-button placeholder-upload"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Plus size={17} />
                  Añadir libro
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Toast notifications */}
      <div className="toast-container">
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 16, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.94 }}
              transition={{ duration: 0.2 }}
              className={`toast toast-${t.type}`}
            >
              {t.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}

function App() {
  return (
    <ReaderProvider>
      <AppContent />
    </ReaderProvider>
  )
}

export default App
