import { Injectable } from '@angular/core';

interface LoggedError {
  message: string;
  timestamp: string;
}

@Injectable({ providedIn: 'root' })
export class ErrorLoggingService {
  private readonly LOG_KEY = 'ai_presentation_error_log';

  logError(error: { message: string; reportable: boolean }): void {
    try {
      const logs = this.getLogs();
      logs.unshift({
        message: error.message,
        timestamp: new Date().toISOString(),
      });
      // Keep only the last 50 logs
      if (logs.length > 50) {
        logs.pop();
      }
      localStorage.setItem(this.LOG_KEY, JSON.stringify(logs));
    } catch (e) {
      console.error('Failed to write to error log:', e);
    }
  }

  getLogs(): LoggedError[] {
    try {
      const storedLogs = localStorage.getItem(this.LOG_KEY);
      return storedLogs ? JSON.parse(storedLogs) : [];
    } catch (e) {
      console.error('Failed to read error log:', e);
      return [];
    }
  }

  clearLogs(): void {
    try {
      localStorage.removeItem(this.LOG_KEY);
    } catch (e) {
      console.error('Failed to clear error log:', e);
    }
  }
}
