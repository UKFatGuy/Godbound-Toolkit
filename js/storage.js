'use strict';

/**
 * Storage wrapper.
 * localStorage is used as the synchronous read/write layer so that
 * all existing callers continue to work unchanged.  On startup the
 * data is hydrated from the server, and every write schedules a
 * debounced background sync back to the server so that data persists
 * across browsers and devices.
 */
const GoStorage = {

  KEYS: {
    CHARACTERS:       'godbound_characters',
    ACTIVE_CHARACTER: 'godbound_active_char',
    COMBAT:           'godbound_combat',
    DICE_HISTORY:     'godbound_dice_history',
    DATA_TEMPLATES:   'godbound_data_templates'
  },

  /* ─── Server sync ───────────────────────────────────────────────── */

  _syncTimer: null,

  /**
   * Called once at startup.  Fetches all data from the server and
   * writes it into localStorage so the synchronous module inits see
   * up-to-date values.  Silently falls back to existing localStorage
   * contents when the server is unavailable.
   */
  async init() {
    try {
      const res = await fetch('/api/data');
      if (!res.ok) return;
      const serverData = await res.json();
      for (const [key, value] of Object.entries(serverData)) {
        localStorage.setItem(key, JSON.stringify(value));
      }
    } catch (e) {
      console.warn('[GoStorage] Server unavailable – using localStorage only', e);
    }
  },

  /** Schedule a debounced flush of all keys to the server (1 s delay). */
  _scheduleServerSync() {
    clearTimeout(this._syncTimer);
    this._syncTimer = setTimeout(() => this._syncToServer(), 1000);
  },

  /** POST all tracked keys to the server. */
  async _syncToServer() {
    const payload = {};
    for (const key of Object.values(this.KEYS)) {
      const raw = localStorage.getItem(key);
      if (raw !== null) {
        try { payload[key] = JSON.parse(raw); } catch (e) {
          console.warn('[GoStorage] Could not parse stored value for key', key, e);
          payload[key] = raw;
        }
      }
    }
    try {
      await fetch('/api/data', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload)
      });
    } catch (e) {
      console.warn('[GoStorage] Server sync failed', e);
    }
  },

  /* ─── Core read / write ─────────────────────────────────────────── */

  save(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      this._scheduleServerSync();
      return true;
    } catch (e) {
      console.error('[GoStorage] save failed', e);
      return false;
    }
  },

  load(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw !== null ? JSON.parse(raw) : fallback;
    } catch (e) {
      console.error('[GoStorage] load failed', e);
      return fallback;
    }
  },

  remove(key) {
    localStorage.removeItem(key);
  },

  /* ─── Typed helpers (improve call-site readability) ─────────────── */

  saveCharacters(chars)      { return this.save(this.KEYS.CHARACTERS, chars); },
  loadCharacters()           { return this.load(this.KEYS.CHARACTERS, []); },

  saveActiveCharacter(idx)   { return this.save(this.KEYS.ACTIVE_CHARACTER, idx); },
  loadActiveCharacter()      { return this.load(this.KEYS.ACTIVE_CHARACTER, 0); },

  saveCombat(state)          { return this.save(this.KEYS.COMBAT, state); },
  loadCombat()               { return this.load(this.KEYS.COMBAT, null); },

  saveDiceHistory(history)   { return this.save(this.KEYS.DICE_HISTORY, history); },
  loadDiceHistory()          { return this.load(this.KEYS.DICE_HISTORY, []); },

  saveDataTemplates(data)    { return this.save(this.KEYS.DATA_TEMPLATES, data); },
  loadDataTemplates()        {
    return this.load(this.KEYS.DATA_TEMPLATES, {
      words: [],
      martialStrifes: [],
      theurgy: [],
      lowMagic: [],
      weapons: [],
      equipment: [],
      enemies: []
    });
  }
};
