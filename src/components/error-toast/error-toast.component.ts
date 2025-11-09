import { Component, ChangeDetectionStrategy, input, output, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-error-toast',
  imports: [CommonModule],
  standalone: true,
  template: `
    @if (isVisible()) {
      <div class="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-md p-4 bg-red-600/90 backdrop-blur-sm text-white rounded-lg shadow-2xl border border-red-500/50 flex items-start gap-4 animate-fade-in z-50">
        <div class="flex-shrink-0 pt-1">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div class="flex-grow">
          <p class="font-bold">An Error Occurred</p>
          <p class="text-sm mt-1">{{ message() }}</p>
        </div>
        <button (click)="close()" class="text-red-200 hover:text-white text-2xl font-bold">&times;</button>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErrorToastComponent {
  message = input<string | null>();
  closed = output<void>();

  isVisible = signal(false);
  private timeoutId: any;

  constructor() {
    effect((onCleanup) => {
      if (this.message()) {
        this.isVisible.set(true);
        clearTimeout(this.timeoutId);
        const timer = setTimeout(() => this.close(), 7000); // Auto-dismiss after 7 seconds
        onCleanup(() => clearTimeout(timer));
      } else {
        this.isVisible.set(false);
      }
    });
  }

  close(): void {
    clearTimeout(this.timeoutId);
    this.isVisible.set(false);
    // Give time for fade-out animation before clearing message
    setTimeout(() => {
        this.closed.emit();
    }, 500);
  }
}
