'use strict';

/**
 * Thin localStorage wrapper.
 * All persistence in the app goes through this object so that
 * the storage back-end can be swapped out later with minimal changes.
 */
const GoStorage = {

  KEYS: {
    CHARACTERS:       'godbound_characters',
    ACTIVE_CHARACTER: 'godbound_active_char',
    COMBAT:           'godbound_combat',
    DICE_HISTORY:     'godbound_dice_history',
    DATA_TEMPLATES:   'godbound_data_templates'
  },

  save(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
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
  loadDataTemplates()        { return this.load(this.KEYS.DATA_TEMPLATES, { words: [], weapons: [], equipment: [], enemies: [] }); }
};
