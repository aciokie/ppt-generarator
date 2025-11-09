import { Injectable, signal, computed } from '@angular/core';
import { Presentation, Slide } from '../types';

@Injectable({ providedIn: 'root' })
export class UndoRedoService {
  private readonly MAX_HISTORY = 50;
  private history: Presentation[] = [];
  private pointer = signal(-1);

  canUndo = computed(() => this.pointer() > 0);
  canRedo = computed(() => this.pointer() < this.history.length - 1);

  private cloneState(state: Presentation): Presentation {
    // Deep clone the presentation object
    const cloned = JSON.parse(JSON.stringify(state));
    
    // Remove transient properties that should not be part of the history
    cloned.slides.forEach((slide: Slide) => {
      delete slide.isGeneratingImage;
    });
    return cloned;
  }

  start(initialState: Presentation): void {
    this.history = [this.cloneState(initialState)];
    this.pointer.set(0);
  }

  clear(): void {
    this.history = [];
    this.pointer.set(-1);
  }

  recordChange(newState: Presentation): void {
    // If we are not at the end of the history, truncate the future states
    if (this.pointer() < this.history.length - 1) {
      this.history.splice(this.pointer() + 1);
    }

    this.history.push(this.cloneState(newState));

    // Limit the history size
    if (this.history.length > this.MAX_HISTORY) {
      this.history.shift();
    }
    
    // Move the pointer to the new state
    this.pointer.set(this.history.length - 1);
  }

  undo(): Presentation | null {
    if (!this.canUndo()) return null;
    this.pointer.update(p => p - 1);
    // Return a deep copy to prevent mutation of the history state
    return JSON.parse(JSON.stringify(this.history[this.pointer()]));
  }

  redo(): Presentation | null {
    if (!this.canRedo()) return null;
    this.pointer.update(p => p + 1);
    // Return a deep copy to prevent mutation of the history state
    return JSON.parse(JSON.stringify(this.history[this.pointer()]));
  }
}