import { Injectable, inject } from '@angular/core';
import { Presentation, HistoryItem, PromptHistoryItem } from '../types';
import { PersistenceService } from './persistence.service';

@Injectable({ providedIn: 'root' })
export class BackendService {
  private persistenceService = inject(PersistenceService);

  // --- Presentation Methods ---

  async getHistory(): Promise<HistoryItem[]> {
    // Simulate network delay
    await new Promise(res => setTimeout(res, 100)); 
    return this.persistenceService.getHistory();
  }

  async loadPresentation(id: string): Promise<Presentation | null> {
    await new Promise(res => setTimeout(res, 150));
    return this.persistenceService.loadPresentation(id);
  }

  async savePresentation(presentation: Presentation): Promise<void> {
    await new Promise(res => setTimeout(res, 200));
    const history = this.persistenceService.getHistory(); // Use sync version to avoid race conditions
    const now = new Date().toISOString();
    const existingIndex = history.findIndex(item => item.id === presentation.id);

    if (existingIndex > -1) {
      history[existingIndex].title = presentation.title;
      history[existingIndex].updatedAt = now;
      history[existingIndex].slideCount = presentation.slides.length;
    } else {
      history.unshift({
        id: presentation.id,
        title: presentation.title,
        originalTopic: presentation.originalTopic,
        theme: presentation.theme,
        language: presentation.language,
        slideCount: presentation.slides.length,
        createdAt: now,
        updatedAt: now,
        sources: presentation.sources,
      });
    }

    if (history.length > 50) {
      history.pop();
    }
    
    // Save history and presentation separately
    localStorage.setItem('ai_presentation_history', JSON.stringify(history));
    await this.persistenceService.savePresentation(presentation);
  }

  // --- Prompt Evolution Methods ---

  async getPromptHistory(): Promise<PromptHistoryItem[]> {
    await new Promise(res => setTimeout(res, 50));
    try {
      const storedHistory = localStorage.getItem('ai_presentation_prompt_history');
      return storedHistory ? JSON.parse(storedHistory) : [];
    } catch (e) {
      console.error('Could not parse prompt history', e);
      return [];
    }
  }

  async savePromptHistory(history: PromptHistoryItem[]): Promise<void> {
    await new Promise(res => setTimeout(res, 50));
    try {
      localStorage.setItem('ai_presentation_prompt_history', JSON.stringify(history));
    } catch (e) {
      console.error('Could not save prompt history', e);
    }
  }

  async getActivePromptId(): Promise<string | null> {
     await new Promise(res => setTimeout(res, 50));
    try {
      return localStorage.getItem('ai_presentation_active_prompt_id');
    } catch (e) {
      console.error('Could not get active prompt ID', e);
      return null;
    }
  }

  async setActivePromptId(id: string): Promise<void> {
    await new Promise(res => setTimeout(res, 50));
    try {
      localStorage.setItem('ai_presentation_active_prompt_id', id);
    } catch (e) {
      console.error('Could not set active prompt ID', e);
    }
  }
}
