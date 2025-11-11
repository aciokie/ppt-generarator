import { Component, ChangeDetectionStrategy, input, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Presentation, Slide } from '../../types';
import { SlideComponent } from '../slide/slide.component';

@Component({
  selector: 'app-live-generation',
  imports: [CommonModule, SlideComponent],
  template: `
    <div class="w-full h-full flex flex-col items-center justify-center p-4 md:p-8 bg-gray-800 text-white">
      @if (displaySlide() && presentationShell(); as pres) {
        <div class="flex items-center gap-4 mb-4">
          <svg class="animate-spin h-6 w-6 text-purple-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <h2 class="text-2xl text-gray-300">AI is writing your presentation...</h2>
        </div>
        <div class="w-full max-w-6xl aspect-[16/9] shadow-2xl bg-gray-900 rounded-lg overflow-hidden">
            <app-slide [slide]="displaySlide()!" [theme]="pres.theme" [isPreview]="true"></app-slide>
        </div>
        <div class="mt-4 text-gray-400">
          Slide {{ currentSlideIndex() + 1 }} / {{ totalSlides() }}
        </div>
      } @else {
        <div class="flex items-center gap-4">
           <svg class="animate-spin h-8 w-8 text-purple-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span class="text-white text-lg font-medium">Preparing generation...</span>
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LiveGenerationComponent {
  presentationShell = input.required<Presentation>();

  currentSlideIndex = signal(0);
  totalSlides = computed(() => this.presentationShell().slides.length);

  private typedTitle = signal('');
  private typedContent = signal<string[] | string>('');

  // The displayed slide is now a computed signal. It merges the base slide data 
  // (which has image updates) with the locally animated text content.
  displaySlide = computed((): Slide | null => {
    const pres = this.presentationShell();
    const index = this.currentSlideIndex();
    if (!pres || !pres.slides[index]) return null;

    const baseSlide = pres.slides[index];
    
    // Override the base slide's text with the currently typed text,
    // but keep other properties like imageUrl and isGeneratingImage from the base.
    return {
      ...baseSlide,
      title: this.typedTitle(),
      content: this.typedContent(),
    };
  });

  async writeSlide(index: number, slideData: Slide): Promise<void> {
    this.currentSlideIndex.set(index);

    // Reset the local animation state for the new slide
    this.typedTitle.set('');
    this.typedContent.set(Array.isArray(slideData.content) ? [] : '');

    // Animate title typing by updating the local signal
    await this.typeText(slideData.title, (newText) => {
      this.typedTitle.set(newText);
    });

    await this.sleep(200); // Pause after title

    // Animate content typing
    if (Array.isArray(slideData.content)) {
      const newContent: string[] = [];
      for (const point of slideData.content) {
        newContent.push('');
        const pointIndex = newContent.length - 1;
        await this.typeText(point, (newText) => {
          newContent[pointIndex] = newText;
          this.typedContent.set([...newContent]);
        });
        await this.sleep(150); // Pause between bullet points
      }
    } else if (typeof slideData.content === 'string') {
        await this.typeText(slideData.content, (newText) => {
            this.typedContent.set(newText);
        });
    }
  }

  private typeText(text: string, updateFn: (newText: string) => void): Promise<void> {
    // If the tab is in the background, skip the animation and set the text instantly.
    if (document.hidden) {
      updateFn(text);
      return Promise.resolve();
    }
    return new Promise(resolve => {
      let currentText = '';
      let i = 0;
      const typingSpeed = 15; // ms per character

      const type = () => {
        if (i < text.length) {
          currentText += text[i];
          updateFn(currentText);
          i++;
          setTimeout(type, typingSpeed + Math.random() * 20 - 10); // Add jitter
        } else {
          resolve();
        }
      };
      type();
    });
  }
  
  private sleep(ms: number): Promise<void> {
    // If the tab is in the background, skip the sleep delay.
    if (document.hidden) {
      return Promise.resolve();
    }
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}