import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class UserPreferenceService {
  private readonly THEME_CATEGORY_PREFERENCES_KEY = 'ai_presentation_theme_prefs';

  /**
   * Records that a user has selected a theme from a specific category.
   * This builds a frequency map in localStorage.
   * @param category The category of the theme that was selected.
   */
  trackThemeCategorySelection(category: string): void {
    try {
      const prefs = this.getThemeCategoryPreferences();
      prefs[category] = (prefs[category] || 0) + 1;
      localStorage.setItem(this.THEME_CATEGORY_PREFERENCES_KEY, JSON.stringify(prefs));
    } catch (e) {
      console.error('Could not save theme preference:', e);
    }
  }

  /**
   * Retrieves the user's most frequently chosen theme category.
   * @returns The category name with the highest count, or null if no preferences exist.
   */
  getPreferredThemeCategory(): string | null {
    try {
      const prefs = this.getThemeCategoryPreferences();
      const categories = Object.keys(prefs);

      if (categories.length === 0) {
        return null;
      }

      // Find the category with the highest selection count
      return categories.reduce((a, b) => prefs[a] > prefs[b] ? a : b);
    } catch (e) {
      console.error('Could not retrieve preferred theme category:', e);
      return null;
    }
  }

  /**
   * Safely retrieves and parses the theme category preferences from localStorage.
   * @returns A record mapping category names to their selection counts.
   */
  private getThemeCategoryPreferences(): Record<string, number> {
    try {
      const storedPrefs = localStorage.getItem(this.THEME_CATEGORY_PREFERENCES_KEY);
      return storedPrefs ? JSON.parse(storedPrefs) : {};
    } catch (e) {
      console.error('Could not parse theme preferences, returning empty object:', e);
      return {};
    }
  }
}
