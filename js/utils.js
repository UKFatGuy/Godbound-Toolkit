'use strict';

/**
 * Utility helpers – pure functions with no side effects.
 * All dice operations, Godbound rule tables and formatting live here.
 */
const GoUtils = {

  /* ─── Dice ─────────────────────────────────────────────────────── */

  rollDie(sides) {
    return Math.floor(Math.random() * sides) + 1;
  },

  rollDice(count, sides) {
    const rolls = [];
    for (let i = 0; i < count; i++) rolls.push(this.rollDie(sides));
    return rolls;
  },

  /**
   * Parse dice notation such as "2d6+3", "d20", "3d8-1".
   * Returns { count, sides, modifier } or null on failure.
   */
  parseDiceNotation(notation) {
    const m = notation.trim().toLowerCase().match(/^(\d*)d(\d+)\s*([+-]\s*\d+)?$/);
    if (!m) return null;
    const count    = parseInt(m[1] || '1', 10);
    const sides    = parseInt(m[2], 10);
    const modifier = m[3] ? parseInt(m[3].replace(/\s/g, ''), 10) : 0;
    if (count < 1 || count > 100 || sides < 2) return null;
    return { count, sides, modifier };
  },

  /* ─── Godbound Rule Tables ──────────────────────────────────────── */

  /** Godbound attribute modifier table (core rules). */
  getAttrMod(score) {
    const table = { 3:-3, 4:-2, 5:-2, 6:-1, 7:-1, 8:-1,
                    9:0,  10:0, 11:0, 12:0,
                    13:1, 14:1, 15:1, 16:2, 17:2, 18:3, 19:4 };
    return table[Math.max(3, Math.min(19, score))] ?? 0;
  },

  /**
   * Fray dice notation by level (Godbound core rules p.XX).
   * Level 1-2 → 1d6, 3-4 → 1d8, 5-6 → 1d10, 7-9 → 1d12, 10 → 2d8,
   * 11-12 → 2d10, 13-14 → 2d12, 15-16 → 3d8, 17-18 → 3d10, 19-20 → 3d12,
   * 21-22 → 4d8, 23-24 → 4d10, 25-26 → 4d12, 27-28 → 5d8, 29-30 → 5d10.
   */
  getFrayDice(level) {
    const l = Math.max(1, Math.min(30, level));
    const table = {
       1:'1d6',  2:'1d6',
       3:'1d8',  4:'1d8',
       5:'1d10', 6:'1d10',
       7:'1d12', 8:'1d12', 9:'1d12',
      10:'2d8',
      11:'2d10',12:'2d10',
      13:'2d12',14:'2d12',
      15:'3d8', 16:'3d8',
      17:'3d10',18:'3d10',
      19:'3d12',20:'3d12',
      21:'4d8', 22:'4d8',
      23:'4d10',24:'4d10',
      25:'4d12',26:'4d12',
      27:'5d8', 28:'5d8',
      29:'5d10',30:'5d10',
    };
    return table[l];
  },

  /**
   * Base saving throw target by level.
   * Godbound saves start at 15 and improve by 1 every 2 levels.
   */
  baseSave(level) {
    return Math.max(6, 15 - Math.floor((Math.max(1, level) - 1) / 2));
  },

  /* ─── Formatting ────────────────────────────────────────────────── */

  formatMod(mod) {
    return mod >= 0 ? `+${mod}` : `${mod}`;
  },

  /* ─── Misc ──────────────────────────────────────────────────────── */

  uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  },

  clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  },

  /** List of all 25 Godbound Words of Power. */
  WORDS_OF_POWER: [
    'Alacrity','Bow','Command','Death','Earth','Fire','Fertility',
    'Health','Journeying','Knowledge','Luck','Making','Might','Night',
    'Passion','Sea','Sky','Sorcery','Sun','Sword','Time','Truth',
    'Valor','Wealth','Wyrd','(Custom)'
  ]
};
