import { Injectable } from '@angular/core';
import { Presentation, HistoryItem } from '../types';

@Injectable({ providedIn: 'root' })
export class PersistenceService {
  private readonly HISTORY_KEY = 'ai_presentation_history';
  private readonly PRESENTATION_PREFIX = 'ai_presentation_';
  private readonly DB_NAME = 'ai_presentation_db';
  private readonly IMAGE_STORE_NAME = 'images';
  private dbPromise: Promise<IDBDatabase>;

  constructor() {
    this.dbPromise = this.initDb();
  }

  private initDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, 1);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.IMAGE_STORE_NAME)) {
          db.createObjectStore(this.IMAGE_STORE_NAME, { keyPath: 'id' });
        }
      };

      request.onsuccess = (event) => {
        resolve((event.target as IDBOpenDBRequest).result);
      };

      request.onerror = (event) => {
        console.error('IndexedDB error:', (event.target as IDBOpenDBRequest).error);
        reject((event.target as IDBOpenDBRequest).error);
      };
    });
  }

  private async saveImage(id: string, imageData: string): Promise<void> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.IMAGE_STORE_NAME, 'readwrite');
      const store = transaction.objectStore(this.IMAGE_STORE_NAME);
      const request = store.put({ id, imageData });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  private async loadImage(id: string): Promise<string | null> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.IMAGE_STORE_NAME, 'readonly');
      const store = transaction.objectStore(this.IMAGE_STORE_NAME);
      const request = store.get(id);
      request.onsuccess = () => {
        resolve(request.result ? request.result.imageData : null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async savePresentation(presentation: Presentation): Promise<void> {
    try {
      // 1. Save presentation metadata (without images) to localStorage
      const presentationToStore = { ...presentation, slides: presentation.slides.map(s => ({ ...s, imageUrl: '' })) };
      localStorage.setItem(this.PRESENTATION_PREFIX + presentation.id, JSON.stringify(presentationToStore));

      // 2. Save all image data to IndexedDB
      const imagePromises: Promise<void>[] = [];
      presentation.slides.forEach((slide, index) => {
        if (slide.imageUrl && slide.imageUrl.startsWith('data:image')) {
          const imageId = `${this.PRESENTATION_PREFIX}${presentation.id}_img_${index}`;
          imagePromises.push(this.saveImage(imageId, slide.imageUrl));
        }
      });
      await Promise.all(imagePromises);

      // 3. Clean up old image entries from localStorage for this presentation
      for (let i = 0; i < presentation.slides.length + 10; i++) {
        localStorage.removeItem(`${this.PRESENTATION_PREFIX}${presentation.id}_img_${i}`);
      }
    } catch (e) {
      console.error('Error saving presentation:', e);
      alert('Could not save presentation. The database might be full or blocked.');
    }
  }

  async loadPresentation(id: string): Promise<Presentation | null> {
    try {
      const stored = localStorage.getItem(this.PRESENTATION_PREFIX + id);
      if (!stored) return null;
      
      const presentation: Presentation = JSON.parse(stored);
      
      const imageLoadPromises = presentation.slides.map(async (slide, index) => {
        const imageId = `${this.PRESENTATION_PREFIX}${id}_img_${index}`;
        // Try loading from IndexedDB first
        let imageUrl = await this.loadImage(imageId);
        
        // If not in IndexedDB, try localStorage (for backward compatibility/migration)
        if (!imageUrl) {
          imageUrl = localStorage.getItem(imageId);
        }
        
        if (imageUrl) {
          slide.imageUrl = imageUrl;
        }
      });
      
      await Promise.all(imageLoadPromises);

      return presentation;
    } catch (e) {
      console.error('Error loading presentation:', e);
      return null;
    }
  }

  getHistory(): HistoryItem[] {
    try {
      const history = localStorage.getItem(this.HISTORY_KEY);
      return history ? JSON.parse(history) : [];
    } catch (e) {
      console.error('Error getting history:', e);
      return [];
    }
  }
}