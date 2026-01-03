import { Component, ChangeDetectionStrategy, input, output, effect, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ErrorLoggingService } from '../../services/error-logging.service';

@Component({
  selector: 'app-error-toast',
  imports: [CommonModule],
  standalone: true,
  template: `
    @if (isVisible() && message(); as msg) {
      <div class="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-lg p-4 bg-red-600/90 backdrop-blur-sm text-white rounded-lg shadow-2xl border border-red-500/50 flex items-start gap-4 animate-fade-in z-50">
        <div class="flex-shrink-0 pt-1">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div class="flex-grow">
          <p class="font-bold">An Error Occurred</p>
          <p class="text-sm mt-1">{{ msg.message }}</p>
          @if(msg.reportable) {
            <div class="mt-3 flex items-center gap-2">
              <button (click)="reportError()" 
                      [disabled]="reportStatus() === 'reported'"
                      class="px-3 py-1 text-xs font-semibold rounded-md transition-colors"
                      [class.bg-red-800]="reportStatus() === 'idle'"
                      [class.hover:bg-red-900]="reportStatus() === 'idle'"
                      [class.bg-green-800]="reportStatus() === 'reported'"
                      [class.cursor-not-allowed]="reportStatus() === 'reported'">
                {{ reportStatus() === 'idle' ? 'Report Error' : 'Logged!' }}
              </button>
              @if(reportStatus() === 'reported') {
                <button (click)="viewLog.emit()" class="px-3 py-1 text-xs font-semibold rounded-md bg-gray-600 hover:bg-gray-500">
                  View Log
                </button>
              }
            </div>
          }
        </div>
        <button (click)="close()" class="text-red-200 hover:text-white text-2xl font-bold">&times;</button>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErrorToastComponent {
  message = input<{ message: string; reportable: boolean } | null>();
  closed = output<void>();
  viewLog = output<void>();

  isVisible = signal(false);
  reportStatus = signal<'idle' | 'reported'>('idle');
  private timeoutId: any;
  private errorLoggingService = inject(ErrorLoggingService);

  constructor() {
    effect((onCleanup) => {
      if (this.message()) {
        this.isVisible.set(true);
        this.reportStatus.set('idle'); // Reset report status for new errors
        clearTimeout(this.timeoutId);
        const timer = setTimeout(() => this.close(), 10000); // Auto-dismiss after 10 seconds
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

  reportError(): void {
    const msg = this.message();
    if (msg) {
      this.errorLoggingService.logError(msg);
    }
    this.reportStatus.set('reported');
  }
}