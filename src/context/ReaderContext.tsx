import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { dbService } from '../services/database';
import type { BookSettings, Annotation } from '../services/database';

type ThemeType = 'light' | 'dark' | 'sepia';

interface ReaderContextType {
  settings: BookSettings;
  updateSettings: (newSettings: Partial<BookSettings>) => void;
  annotations: Annotation[];
  addAnnotation: (annotation: Omit<Annotation, 'timestamp' | 'id'>) => Promise<void>;
  updateAnnotation: (id: string, updates: Partial<Annotation>) => Promise<void>;
  deleteAnnotation: (id: string) => Promise<void>;
  isLoading: boolean;
  activeBookId: string | null;
  setActiveBookId: (id: string | null) => void;
  theme: ThemeType;
  setTheme: (theme: ThemeType) => void;
}

const defaultSettings: BookSettings = {
  bookId: '',
  fontSize: 100,
  fontFamily: "'Inter', sans-serif",
  theme: 'light',
  viewMode: 'single',
};

const ReaderContext = createContext<ReaderContextType | undefined>(undefined);

export function ReaderProvider({ children }: { children: React.ReactNode }) {
  const [activeBookId, setActiveBookId] = useState<string | null>(null);
  const [settings, setSettings] = useState<BookSettings>(defaultSettings);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Persistencia global del tema en localStorage
  const [theme, setThemeState] = useState<ThemeType>(() => {
    const saved = localStorage.getItem('libris-theme');
    return (saved as ThemeType) || 'light';
  });

  const setTheme = useCallback((newTheme: ThemeType) => {
    setThemeState(newTheme);
    localStorage.setItem('libris-theme', newTheme);
    // También actualizamos el setting del libro actual si existe
    if (activeBookId) {
      updateSettings({ theme: newTheme });
    }
  }, [activeBookId]);

  // Load data when active book changes
  useEffect(() => {
    if (!activeBookId) {
      setSettings(defaultSettings);
      setAnnotations([]);
      return;
    }

    const loadData = async () => {
      setIsLoading(true);
      try {
        const [savedSettings, savedAnnotations] = await Promise.all([
          dbService.getSettings(activeBookId),
          dbService.getAnnotations(activeBookId)
        ]);

        if (savedSettings) {
          setSettings(savedSettings);
          // Si el libro tiene un tema guardado, lo usamos
          if (savedSettings.theme) {
            setThemeState(savedSettings.theme);
            localStorage.setItem('libris-theme', savedSettings.theme);
          }
        } else {
          setSettings({ ...defaultSettings, bookId: activeBookId, theme });
        }
        setAnnotations(savedAnnotations);
      } catch (error) {
        console.error('Error loading reader data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [activeBookId]);

  const updateSettings = useCallback((newSettings: Partial<BookSettings>) => {
    if (!activeBookId) return;
    setSettings(prev => {
      const updated = { ...prev, ...newSettings, bookId: activeBookId };
      // Evitar side effects dentro del updater, pero por ahora mantenemos la lógica 
      // para asegurar persistencia inmediata. 
      dbService.saveSettings(updated);
      return updated;
    });
    
    // Sincronizar tema global si cambió en los settings
    if (newSettings.theme) {
      setThemeState(newSettings.theme);
      localStorage.setItem('libris-theme', newSettings.theme);
    }
  }, [activeBookId]);

  const addAnnotation = useCallback(async (anno: Omit<Annotation, 'timestamp' | 'id'>) => {
    if (!activeBookId) return;
    const newAnno: Annotation = {
      ...anno,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
      bookId: activeBookId
    };
    await dbService.saveAnnotation(newAnno);
    setAnnotations(prev => [...prev, newAnno]);
  }, [activeBookId]);

  const updateAnnotation = useCallback(async (id: string, updates: Partial<Annotation>) => {
    const original = annotations.find(a => a.id === id);
    if (!original) return;
    const updated = { ...original, ...updates };
    await dbService.saveAnnotation(updated);
    setAnnotations(prev => prev.map(a => a.id === id ? updated : a));
  }, [annotations]);

  const deleteAnnotation = useCallback(async (id: string) => {
    await dbService.deleteAnnotation(id);
    setAnnotations(prev => prev.filter(a => a.id !== id));
  }, []);

  return (
    <ReaderContext.Provider value={{
      settings,
      updateSettings,
      annotations,
      addAnnotation,
      updateAnnotation,
      deleteAnnotation,
      isLoading,
      activeBookId,
      setActiveBookId,
      theme,
      setTheme
    }}>
      {children}
    </ReaderContext.Provider>
  );
}

export function useReader() {
  const context = useContext(ReaderContext);
  if (context === undefined) {
    throw new Error('useReader must be used within a ReaderProvider');
  }
  return context;
}
