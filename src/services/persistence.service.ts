import { Injectable } from '@angular/core';
import { Presentation, HistoryItem } from '../types';

@Injectable({ providedIn: 'root' })
export class PersistenceService {
  private readonly HISTORY_KEY = 'ai_presentation_history';
  private readonly PRESENTATION_PREFIX = 'ai_presentation_';
  private readonly DB_NAME = 'ai_presentation_db';
  private readonly IMAGE_STORE_NAME = 'images';
  private readonly VIDEO_STORE_NAME = 'videos';
  private dbPromise: Promise<IDBDatabase>;

  constructor() {
    this.dbPromise = this.initDb();
  }

  private initDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, 2); // Version bumped for new store

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.IMAGE_STORE_NAME)) {
          db.createObjectStore(this.IMAGE_STORE_NAME, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(this.VIDEO_STORE_NAME)) {
          db.createObjectStore(this.VIDEO_STORE_NAME, { keyPath: 'id' });
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
      store.put({ id, imageData });
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

  async saveVideo(id: string, videoData: Blob): Promise<void> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.VIDEO_STORE_NAME, 'readwrite');
      const store = transaction.objectStore(this.VIDEO_STORE_NAME);
      store.put({ id, videoData });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async loadVideo(id: string): Promise<Blob | null> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.VIDEO_STORE_NAME, 'readonly');
      const store = transaction.objectStore(this.VIDEO_STORE_NAME);
      const request = store.get(id);
      request.onsuccess = () => {
        resolve(request.result ? request.result.videoData : null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async savePresentation(presentation: Presentation): Promise<void> {
    try {
      const presentationToStore = { 
        ...presentation, 
        slides: presentation.slides.map(s => ({ ...s, imageUrl: '', videoUrl: '' })) 
      };
      localStorage.setItem(this.PRESENTATION_PREFIX + presentation.id, JSON.stringify(presentationToStore));

      const mediaPromises: Promise<void>[] = [];
      presentation.slides.forEach((slide, index) => {
        if (slide.imageUrl && slide.imageUrl.startsWith('data:image')) {
          const imageId = `${this.PRESENTATION_PREFIX}${presentation.id}_img_${index}`;
          mediaPromises.push(this.saveImage(imageId, slide.imageUrl));
        }
        // Note: We don't save videoUrl here because it's a blob URL. The video blob
        // is saved to IndexedDB at the time of generation.
      });
      await Promise.all(mediaPromises);

      // Clean up old localStorage image entries
      for (let i = 0; i < presentation.slides.length + 10; i++) {
        localStorage.removeItem(`${this.PRESENTATION_PREFIX}${presentation.id}_img_${i}`);
      }

    } catch (e) {
      console.error('Error saving presentation:', e);
      throw new Error('Could not save presentation. The database might be full or blocked.');
    }
  }

  async loadPresentation(id: string): Promise<Presentation | null> {
    try {
      const stored = localStorage.getItem(this.PRESENTATION_PREFIX + id);
      if (!stored) return null;
      
      const presentation: Presentation = JSON.parse(stored);
      
      const mediaLoadPromises = presentation.slides.map(async (slide, index) => {
        // Load image
        const imageId = `${this.PRESENTATION_PREFIX}${id}_img_${index}`;
        const imageUrl = await this.loadImage(imageId);
        if (imageUrl) {
          slide.imageUrl = imageUrl;
        }

        // Load video
        if (slide.hasVideo) {
          const videoId = `${this.PRESENTATION_PREFIX}${id}_vid_${index}`;
          const videoBlob = await this.loadVideo(videoId);
          if (videoBlob) {
            slide.videoUrl = URL.createObjectURL(videoBlob);
          }
        }
      });
      
      await Promise.all(mediaLoadPromises);

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
      return []; // Return empty array instead of throwing to prevent app crash
    }
  }

  saveHistory(history: HistoryItem[]): void {
    try {
      localStorage.setItem(this.HISTORY_KEY, JSON.stringify(history));
    } catch (e) {
      console.error('Error saving history:', e);
      throw new Error(`Failed to save history to local storage: ${(e as Error).message}`);
    }
  }
}
