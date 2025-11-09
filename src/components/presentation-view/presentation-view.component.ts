import { Component, ChangeDetectionStrategy, input, output, signal, ElementRef, inject, afterNextRender, computed, effect, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Presentation, Slide } from '../../types';
import { SlideComponent } from '../slide/slide.component';

@Component({
  selector: 'app-presentation-view',
  imports: [CommonModule, SlideComponent],
  templateUrl: './presentation-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'triggerExit()',
    '(document:keydown.tab)': 'handleTab($event)',
    '(document:keydown.arrowright)': 'nextSlide()',
    '(document:keydown.pagedown)': 'nextSlide()',
    '(document:keydown.l)': 'nextSlide()',
    '(document:keydown.arrowleft)': 'previousSlide()',
    '(document:keydown.pageup)': 'previousSlide()',
    '(document:keydown.j)': 'previousSlide()',
    '(window:beforeunload)': 'closePresenterNotes()',
  }
})
export class PresentationViewComponent implements OnDestroy {
  presentation = input.required<Presentation>();
  initialSlideIndex = input(0);
  exit = output<void>();

  private elementRef = inject(ElementRef);
  currentSlideIndex = signal(0);
  laserPosition = signal({ x: -100, y: -100 });
  isLaserActive = signal(false);
  showControls = signal(true);
  private controlsTimeout: any;
  private presenterWindow: Window | null = null;
  private clockInterval: any;

  animationClass = signal('');
  transitioningSlide = signal<{ slide: Slide; animation: string } | null>(null);

  currentSlide = computed(() => {
    const pres = this.presentation();
    if (!pres || pres.slides.length === 0) return null;
    return pres.slides[this.currentSlideIndex()];
  });

  constructor() {
    this.currentSlideIndex.set(this.initialSlideIndex());
    
    afterNextRender(() => {
      this.requestFullscreen();
      document.addEventListener('fullscreenchange', this.onFullscreenChange);
    });

    effect(() => {
      this.resetControlsTimeout();
    });
  }

  ngOnDestroy(): void {
    document.removeEventListener('fullscreenchange', this.onFullscreenChange);
    if (document.fullscreenElement) {
      document.exitFullscreen();
    }
    clearTimeout(this.controlsTimeout);
    this.closePresenterNotes();
  }

  private onFullscreenChange = (): void => {
    if (!document.fullscreenElement) {
      this.exit.emit();
    }
  }

  private requestFullscreen(): void {
    const el = this.elementRef.nativeElement;
    if (el.requestFullscreen) {
      el.requestFullscreen();
    }
  }

  triggerExit(): void {
    this.closePresenterNotes();
    this.exit.emit();
  }

  handleTab(event: KeyboardEvent): void {
    event.preventDefault();
    this.triggerExit();
  }

  nextSlide() {
    const pres = this.presentation();
    if (!pres) return;
    const newIndex = Math.min(pres.slides.length - 1, this.currentSlideIndex() + 1);
    this.navigateToSlide(newIndex);
  }
  
  previousSlide() {
    const newIndex = Math.max(0, this.currentSlideIndex() - 1);
    this.navigateToSlide(newIndex);
  }

  private navigateToSlide(newIndex: number): void {
    const currentIndex = this.currentSlideIndex();
    if (newIndex === currentIndex || this.transitioningSlide()) return;

    const pres = this.presentation();
    if (!pres) return;

    const direction = newIndex > currentIndex ? 'forward' : 'backward';
    const outgoingSlide = pres.slides[currentIndex];
    
    let incomingAnimation = '';
    let outgoingAnimation = '';

    if (direction === 'forward') {
      incomingAnimation = 'animate-slide-in-from-right';
      outgoingAnimation = 'animate-slide-out-to-left';
    } else { // backward
      incomingAnimation = 'animate-slide-in-from-left';
      outgoingAnimation = 'animate-slide-out-to-right';
    }
    
    this.transitioningSlide.set({ slide: outgoingSlide, animation: outgoingAnimation });
    this.animationClass.set(incomingAnimation);
    
    this.currentSlideIndex.set(newIndex);
    this.updatePresenterNotes();
    
    // After the animation duration, clean up the state.
    setTimeout(() => {
      this.transitioningSlide.set(null);
      this.animationClass.set('');
    }, 400); // This duration must match the CSS animation time (0.4s)
  }

  handleMouseMove(event: MouseEvent): void {
    this.laserPosition.set({ x: event.clientX, y: event.clientY });
    this.isLaserActive.set(true);
    this.showControls.set(true);
    this.resetControlsTimeout();
  }

  handleMouseLeave(): void {
    this.isLaserActive.set(false);
  }

  private resetControlsTimeout(): void {
    clearTimeout(this.controlsTimeout);
    this.controlsTimeout = setTimeout(() => {
      this.showControls.set(false);
    }, 2000);
  }

  // --- Presenter Notes Window Logic ---
  openPresenterNotes(): void {
    if (this.presenterWindow && !this.presenterWindow.closed) {
      this.presenterWindow.focus();
      return;
    }

    this.presenterWindow = window.open('', 'presenterNotes', 'width=1000,height=700,scrollbars=yes,resizable=yes');
    if (this.presenterWindow) {
      this.presenterWindow.document.title = 'Presenter View - ' + this.presentation().title;
      this.presenterWindow.document.body.innerHTML = `
        <head>
          <title>Presenter Notes</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style> body { font-family: Inter, sans-serif; } </style>
        </head>
        <body class="bg-gray-900 text-gray-200 p-8 h-screen flex flex-col gap-8">
          <header class="flex justify-between items-center pb-4 border-b border-gray-700 flex-shrink-0">
            <h1 class="text-2xl font-bold text-purple-400">Presenter View</h1>
            <div id="clock" class="text-3xl font-mono text-gray-100"></div>
          </header>
          <main class="flex-grow flex gap-8 overflow-hidden">
            <div class="w-2/3 flex flex-col">
              <h2 class="text-lg font-semibold text-gray-400 mb-2 uppercase tracking-wider">Current Slide</h2>
              <div class="bg-gray-800 rounded-lg p-6 flex-grow overflow-y-auto">
                <h3 id="current-slide-title" class="text-2xl font-bold mb-4 text-white"></h3>
                <div id="current-notes" class="space-y-4 text-lg text-gray-300 leading-relaxed"></div>
              </div>
            </div>
            <div class="w-1/3 flex flex-col">
              <h2 class="text-lg font-semibold text-gray-400 mb-2 uppercase tracking-wider">Next Slide</h2>
              <div class="bg-gray-800/50 rounded-lg p-6 flex-grow overflow-y-auto">
                <h3 id="next-slide-title" class="text-xl font-bold mb-4 text-gray-200"></h3>
                <div id="next-notes" class="space-y-3 text-base text-gray-400 leading-relaxed"></div>
              </div>
            </div>
          </main>
        </body>
      `;
      this.presenterWindow.addEventListener('beforeunload', () => {
        clearInterval(this.clockInterval);
        this.presenterWindow = null;
      });

      this.updatePresenterNotes();
      
      this.clockInterval = setInterval(() => {
        if (this.presenterWindow && !this.presenterWindow.closed) {
          const clockEl = this.presenterWindow.document.getElementById('clock');
          if (clockEl) {
            clockEl.textContent = new Date().toLocaleTimeString();
          }
        } else {
          clearInterval(this.clockInterval);
        }
      }, 1000);
    }
  }

  private updatePresenterNotes(): void {
    if (!this.presenterWindow || this.presenterWindow.closed) return;
    
    const pres = this.presentation();
    const doc = this.presenterWindow.document;
    const currentIdx = this.currentSlideIndex();
    const current = pres.slides[currentIdx];
    const next = currentIdx + 1 < pres.slides.length ? pres.slides[currentIdx + 1] : null;

    const titleEl = doc.getElementById('current-slide-title');
    const notesEl = doc.getElementById('current-notes');
    if (titleEl) titleEl.textContent = `${currentIdx + 1}. ${current.title}`;
    if (notesEl) {
      if (Array.isArray(current.speakerNotes) && current.speakerNotes.length > 0) {
        notesEl.innerHTML = current.speakerNotes.map(note => `<p>${note}</p>`).join('');
      } else if (typeof current.speakerNotes === 'string' && current.speakerNotes.trim()) {
        notesEl.innerHTML = `<p>${current.speakerNotes}</p>`;
      } else {
        notesEl.innerHTML = `<p class="italic text-gray-500">No speaker notes for this slide.</p>`;
      }
    }
    
    const nextTitleEl = doc.getElementById('next-slide-title');
    const nextNotesEl = doc.getElementById('next-notes');
    if (next) {
      if (nextTitleEl) nextTitleEl.textContent = `${currentIdx + 2}. ${next.title}`;
      if (nextNotesEl) {
        if (Array.isArray(next.speakerNotes) && next.speakerNotes.length > 0) {
          nextNotesEl.innerHTML = next.speakerNotes.map(note => `<p>${note}</p>`).join('');
        } else if (typeof next.speakerNotes === 'string' && next.speakerNotes.trim()) {
          nextNotesEl.innerHTML = `<p>${next.speakerNotes}</p>`;
        } else {
          nextNotesEl.innerHTML = `<p class="italic text-gray-500">No speaker notes.</p>`;
        }
      }
    } else {
      if (nextTitleEl) nextTitleEl.textContent = 'End of Presentation';
      if (nextNotesEl) nextNotesEl.innerHTML = '';
    }
  }

  closePresenterNotes(): void {
    if (this.presenterWindow && !this.presenterWindow.closed) {
      this.presenterWindow.close();
    }
    clearInterval(this.clockInterval);
    this.presenterWindow = null;
  }
}