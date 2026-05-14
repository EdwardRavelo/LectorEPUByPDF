/**
 * Database service using IndexedDB for persistent storage of annotations and settings.
 */

export interface Annotation {
  id: string;
  bookId: string;
  type: 'highlight' | 'highlight-text';
  cfiRange?: string; // ePub
  page?: number;     // PDF
  relativeRects?: { top: number; left: number; width: number; height: number }[]; // PDF
  text: string;
  color: string;
  comment?: string;
  timestamp: number;
}

export interface BookSettings {
  bookId: string;
  fontSize: number;
  fontFamily: string;
  theme: 'light' | 'dark';
  viewMode: 'single' | 'double';
}

const DB_NAME = 'LibrisDB';
const DB_VERSION = 1;

class DatabaseService {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    if (this.db) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains('annotations')) {
          const store = db.createObjectStore('annotations', { keyPath: 'id' });
          store.createIndex('bookId', 'bookId', { unique: false });
        }

        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'bookId' });
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  private async getStore(name: string, mode: IDBTransactionMode): Promise<IDBObjectStore> {
    await this.init();
    const transaction = this.db!.transaction(name, mode);
    return transaction.objectStore(name);
  }

  // Annotations
  async getAnnotations(bookId: string): Promise<Annotation[]> {
    const store = await this.getStore('annotations', 'readonly');
    const index = store.index('bookId');
    return new Promise((resolve, reject) => {
      const request = index.getAll(bookId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async saveAnnotation(annotation: Annotation): Promise<void> {
    const store = await this.getStore('annotations', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put(annotation);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteAnnotation(id: string): Promise<void> {
    const store = await this.getStore('annotations', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Settings
  async getSettings(bookId: string): Promise<BookSettings | null> {
    const store = await this.getStore('settings', 'readonly');
    return new Promise((resolve, reject) => {
      const request = store.get(bookId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async saveSettings(settings: BookSettings): Promise<void> {
    const store = await this.getStore('settings', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put(settings);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

export const dbService = new DatabaseService();
