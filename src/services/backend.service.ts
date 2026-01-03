import { Injectable, inject } from '@angular/core';
import { Presentation, HistoryItem, PromptHistoryItem } from '../types';
import { PersistenceService } from './persistence.service';

@Injectable({ providedIn: 'root' })
export class BackendService {
  private persistenceService = inject(PersistenceService);

  // --- Presentation Methods ---

  async getHistory(): Promise<HistoryItem[]> {
    return this.persistenceService.getHistory();
  }

  async loadPresentation(id: string): Promise<Presentation | null> {
    return this.persistenceService.loadPresentation(id);
  }

  async savePresentation(presentation: Presentation): Promise<void> {
    try {
      const history = this.persistenceService.getHistory();
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
      
      // Save history via persistence service to ensure consistent key usage
      this.persistenceService.saveHistory(history);
      await this.persistenceService.savePresentation(presentation);
    } catch(e) {
      throw new Error(`Failed to save presentation: ${(e as Error).message}`);
    }
  }

  // --- Prompt Evolution Methods ---

  async getPromptHistory(): Promise<PromptHistoryItem[]> {
    try {
      const storedHistory = localStorage.getItem('ai_presentation_prompt_history');
      return storedHistory ? JSON.parse(storedHistory) : [];
    } catch (e) {
      console.error('Could not parse prompt history', e);
      // Return default/empty instead of throwing to prevent app initialization failure
      return [];
    }
  }

  async savePromptHistory(history: PromptHistoryItem[]): Promise<void> {
    try {
      localStorage.setItem('ai_presentation_prompt_history', JSON.stringify(history));
    } catch (e) {
      console.error('Could not save prompt history', e);
      throw new Error('Failed to save prompt history to storage.');
    }
  }

  async getActivePromptId(): Promise<string | null> {
    try {
      return localStorage.getItem('ai_presentation_active_prompt_id');
    } catch (e) {
      console.error('Could not get active prompt ID', e);
      return null;
    }
  }

  async setActivePromptId(id: string): Promise<void> {
    try {
      localStorage.setItem('ai_presentation_active_prompt_id', id);
    } catch (e) {
      console.error('Could not set active prompt ID', e);
      throw new Error('Failed to set active prompt ID in storage.');
    }
  }

  async removeActivePromptId(): Promise<void> {
    try {
      localStorage.removeItem('ai_presentation_active_prompt_id');
    } catch (e) {
      console.error('Could not remove active prompt ID', e);
      throw new Error('Failed to remove active prompt ID from storage.');
    }
  }
}
