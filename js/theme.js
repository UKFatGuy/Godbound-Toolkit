'use strict';

/**
 * Theme manager – allows switching between visual themes.
 * Persists selection to localStorage and applies via data-theme on <html>.
 */
const GoTheme = {

  STORAGE_KEY: 'godbound_theme',

  THEMES: [
    { id: 'dark-fantasy',   label: '⚔️ Dark Fantasy'   },
    { id: 'high-fantasy',   label: '🌿 High Fantasy'   },
    { id: 'retro-terminal', label: '💻 Retro Terminal' },
    { id: 'sci-fi',         label: '🚀 Sci-Fi'         },
  ],

  init() {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    const themeId = this.THEMES.find(t => t.id === saved) ? saved : 'dark-fantasy';
    this._applyTheme(themeId);
    const sel = document.getElementById('theme-select');
    if (!sel) return;
    sel.value = themeId;
    sel.addEventListener('change', () => this._applyTheme(sel.value));
  },

  _applyTheme(themeId) {
    if (!this.THEMES.find(t => t.id === themeId)) return;
    document.documentElement.setAttribute('data-theme', themeId);
    localStorage.setItem(this.STORAGE_KEY, themeId);
    const sel = document.getElementById('theme-select');
    if (sel) sel.value = themeId;
  },
};
