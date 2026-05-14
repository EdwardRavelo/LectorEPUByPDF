import { useState, useRef, useEffect } from 'react'
import { Plus, Library, Trash2, FileText, ChevronLeft, ChevronRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { PdfReader } from './components/PdfReader'
import { EpubReader } from './components/EpubReader'
import { ReaderProvider, useReader } from './context/ReaderContext'
import './App.css'

interface BookFile {
  id: string;
  name: string;
  type: 'pdf' | 'epub';
  url: string;
}

function AppContent() {
  const [books, setBooks] = useState<BookFile[]>([]);
  const [currentBook, setCurrentBook] = useState<BookFile | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { setActiveBookId } = useReader();

  useEffect(() => {
    setActiveBookId(currentBook?.id || null);
  }, [currentBook, setActiveBookId]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const type = file.name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'epub';
    const newBook: BookFile = {
      id: Math.random().toString(36).substr(2, 9),
      name: file.name,
      type: type as 'pdf' | 'epub',
      url: URL.createObjectURL(file),
    };

    setBooks([...books, newBook]);
    if (!currentBook) setCurrentBook(newBook);
  };

  const removeBook = (id: string) => {
    const bookToRemove = books.find(b => b.id === id);
    if (bookToRemove) {
      URL.revokeObjectURL(bookToRemove.url);
    }
    const newBooks = books.filter(b => b.id !== id);
    setBooks(newBooks);
    if (currentBook?.id === id) {
      setCurrentBook(newBooks[0] || null);
    }
  };

  return (
    <div className="app-layout">
      {/* Sidebar / Biblioteca Glass */}
      <aside className={`sidebar glass-panel ${isSidebarCollapsed ? 'collapsed' : ''}`}>
        <button 
          className="sidebar-toggle"
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        >
          {isSidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>

        {!isSidebarCollapsed && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}
          >
            <div className="lib-header">
              <motion.h2
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
              >
                Libris
              </motion.h2>
              <p style={{ fontSize: '0.8rem', opacity: 0.6 }}>Tu biblioteca personal</p>
            </div>

            <div className="book-list" style={{ flex: 1 }}>
              <AnimatePresence>
                {books.map((book) => (
                  <motion.div
                    key={book.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className={`book-card ${currentBook?.id === book.id ? 'active' : ''}`}
                    onClick={() => setCurrentBook(book)}
                  >
                    <div className="book-info">
                      <FileText size={18} color={book.type === 'pdf' ? '#ff4444' : '#4488ff'} />
                      <span className="book-title">{book.name}</span>
                    </div>
                    <button 
                      className="btn-remove" 
                      onClick={(e) => {
                        e.stopPropagation();
                        removeBook(book.id);
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
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
              whileTap={{ scale: 0.98 }}
              className="upload-button"
              style={{ width: '100%', justifyContent: 'center', marginTop: '1rem' }}
              onClick={() => fileInputRef.current?.click()}
            >
              <Plus size={20} />
              Añadir Libro
            </motion.button>
          </motion.div>
        )}
      </aside>

      {/* Main Content Area */}
      <main className="main-view" style={{ flex: 1, height: '100vh', overflow: 'hidden' }}>
        <AnimatePresence mode="wait">
          {currentBook ? (
            <motion.div
              key={currentBook.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
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
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}
            >
              <Library size={80} strokeWidth={1} opacity={0.2} />
              <p style={{ marginTop: '1rem', fontWeight: 300 }}>Tu santuario de lectura está vacío.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
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
