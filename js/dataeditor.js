'use strict';

/**
 * Data Editor module.
 * Manages reusable templates for Words of Power (with Gifts),
 * Weapons and Equipment.  Templates are stored in localStorage and
 * can be applied to the active character with a single click.
 */
const GoDataEditor = {

  /* ─── State ─────────────────────────────────────────────────────── */

  /** { words: [], weapons: [], equipment: [] } */
  data: null,

  /* ─── Init ──────────────────────────────────────────────────────── */

  init() {
    this.data = GoStorage.loadDataTemplates();
    this._ensureStructure();
    this._seedArcanePresetsIfEmpty();
    this.render();
    /* Ensure the combat tracker dropdown reflects any saved enemies. */
    if (typeof GoCombat !== 'undefined') GoCombat.populateStockEnemyDropdown();
  },

  _ensureStructure() {
    if (!this.data)            this.data = {};
    if (!Array.isArray(this.data.words))     this.data.words     = [];
    if (!Array.isArray(this.data.weapons))   this.data.weapons   = [];
    if (!Array.isArray(this.data.equipment)) this.data.equipment = [];
    if (!Array.isArray(this.data.enemies))   this.data.enemies   = [];
    this.data.words = this.data.words.map(word => ({
      ...word,
      gifts: Array.isArray(word.gifts) ? word.gifts.map(gift => this._normalizeGift(gift)) : []
    }));
    GoUtils.ARCANE_PRACTICES.forEach(cfg => {
      this.data[cfg.key] = this._normalizePracticeTemplates(this.data[cfg.key]);
    });
  },

  _normalizeGift(gift) {
    return {
      id: gift?.id || GoUtils.uid(),
      name: gift?.name || '',
      type: gift?.type || 'lesser',
      activation: gift?.activation || 'Action',
      smite: !!gift?.smite,
      effort: gift?.effort || '',
      description: gift?.description || '',
      active: !!gift?.active,
      modifiesAttribute: !!gift?.modifiesAttribute,
      modAttribute: gift?.modAttribute || 'str',
      modType: gift?.modType || 'bonus',
      modValue: Number.isFinite(parseInt(gift?.modValue, 10)) ? parseInt(gift.modValue, 10) : 0
    };
  },

  _formatGiftModifierSummary(rawGift) {
    const gift = this._normalizeGift(rawGift);
    if (!gift.modifiesAttribute) return '';

    const value = Number.isFinite(parseInt(gift.modValue, 10)) ? parseInt(gift.modValue, 10) : 0;
    const signed = value >= 0 ? `+${value}` : `${value}`;
    const attr = String(gift.modAttribute || 'str').toUpperCase();
    const kind = gift.modType === 'score' ? 'score' : 'bonus';
    return `${signed} ${attr} ${kind}`;
  },

  _normalizePracticeTemplates(list) {
    return Array.isArray(list)
      ? list.map(item => ({
          id: item.id || GoUtils.uid(),
          name: item.name || '',
          notes: item.notes || '',
          entries: Array.isArray(item.entries)
            ? item.entries.map(entry => ({
                id: entry.id || GoUtils.uid(),
                name: entry.name || '',
                activation: entry.activation || 'Action',
                effort: entry.effort || '',
                description: entry.description || ''
              }))
            : []
        }))
      : [];
  },

  _save() {
    GoStorage.saveDataTemplates(this.data);
  },

  _seedArcanePresetsIfEmpty() {
    const hasArcaneData = GoUtils.ARCANE_PRACTICES.some(cfg => (this.data[cfg.key] || []).length > 0);
    if (hasArcaneData) return;
    this.seedArcanePresets();
  },

  seedArcanePresets() {
    let added = 0;

    GoUtils.ARCANE_PRACTICES.forEach(cfg => {
      if (!Array.isArray(this.data[cfg.key])) this.data[cfg.key] = [];

      const byName = new Map((this.data[cfg.key] || [])
        .map(item => [String(item.name || '').trim().toLowerCase(), item]));

      const presets = (GoUtils.ARCANE_PRESETS[cfg.key] || []);
      presets.forEach(preset => {
        const key = String(preset.name || '').trim().toLowerCase();
        if (!key) return;

        if (!byName.has(key)) {
          const fresh = {
            id: GoUtils.uid(),
            name: preset.name,
            notes: 'Seeded from OCR reference text',
            entries: (preset.entries || []).map(name => ({
              id: GoUtils.uid(),
              name,
              activation: 'Action',
              effort: '',
              description: ''
            }))
          };
          this.data[cfg.key].push(fresh);
          byName.set(key, fresh);
          added += 1;
          return;
        }

        const existing = byName.get(key);
        if (!Array.isArray(existing.entries)) existing.entries = [];
        const existingEntryNames = new Set(existing.entries.map(entry => String(entry.name || '').trim().toLowerCase()));
        (preset.entries || []).forEach(name => {
          const entryKey = String(name || '').trim().toLowerCase();
          if (!entryKey || existingEntryNames.has(entryKey)) return;
          existing.entries.push({
            id: GoUtils.uid(),
            name,
            activation: 'Action',
            effort: '',
            description: ''
          });
          existingEntryNames.add(entryKey);
        });
      });
    });

    if (added > 0) this._save();
    return added;
  },

  /* ─── Words ─────────────────────────────────────────────────────── */

  addWord(name) {
    if (!name || !name.trim()) return;
    this.data.words.push({ id: GoUtils.uid(), name: name.trim(), gifts: [] });
    this._save();
    this._renderWords();
  },

  removeWord(id) {
    this.data.words = this.data.words.filter(w => w.id !== id);
    this._save();
    this._renderWords();
  },

  addGiftToWord(wordId, giftName, giftType) {
    const word = this.data.words.find(w => w.id === wordId);
    if (!word || !giftName.trim()) return;
    word.gifts.push(this._normalizeGift({
      id:          GoUtils.uid(),
      name:        giftName.trim(),
      type:        giftType || 'lesser',
      activation:  'Action',
      smite:       false,
      effort:      '',
      description: '',
      active:      false,
      modifiesAttribute: false,
      modAttribute: 'str',
      modType: 'bonus',
      modValue: 0
    }));
    this._save();
    this._renderWords();
  },

  removeGiftFromWord(wordId, giftId) {
    const word = this.data.words.find(w => w.id === wordId);
    if (!word) return;
    word.gifts = word.gifts.filter(g => g.id !== giftId);
    this._save();
    this._renderWords();
  },

  /** Copy a word template (and all its gifts) to the active character. */
  applyWordToChar(wordId) {
    if (typeof GoCharacter === 'undefined') return;
    const tpl  = this.data.words.find(w => w.id === wordId);
    if (!tpl) return;
    const char = GoCharacter.char;
    if (!char) return;

    // Add the word
    const newWord = {
      id:              GoUtils.uid(),
      name:            tpl.name,
      effortCommitted: 0,
      gifts:           tpl.gifts.map(g => ({
        id:          GoUtils.uid(),
        name:        g.name,
        type:        g.type,
        activation:  g.activation || 'Action',
        smite:       g.smite || false,
        effort:      g.effort || '',
        description: g.description || '',
        active:      false,
        modifiesAttribute: !!g.modifiesAttribute,
        modAttribute: g.modAttribute || 'str',
        modType: g.modType || 'bonus',
        modValue: Number.isFinite(parseInt(g.modValue, 10)) ? parseInt(g.modValue, 10) : 0
      }))
    };
    char.words.push(newWord);
    GoCharacter._save();

    // If the character sheet is currently visible, refresh words
    if (document.getElementById('words-list')) GoCharacter._renderWords();

    GoApp.toast(`"${tpl.name}" added to ${char.name}`, 'success');
  },

  /* ─── Arcane practices ─────────────────────────────────────────── */

  addPracticeTemplate(category, name) {
    const cfg = GoUtils.getArcanePracticeConfig(category);
    if (!cfg || !name || !name.trim()) return;
    this.data[category].push({ id: GoUtils.uid(), name: name.trim(), notes: '', entries: [] });
    this._save();
    this._renderArcanePracticeTemplates();
  },

  removePracticeTemplate(category, id) {
    const cfg = GoUtils.getArcanePracticeConfig(category);
    if (!cfg) return;
    this.data[category] = this.data[category].filter(item => item.id !== id);
    this._save();
    this._renderArcanePracticeTemplates();
  },

  addPracticeEntryTemplate(category, practiceId, name) {
    const practice = (this.data[category] || []).find(item => item.id === practiceId);
    if (!practice || !name || !name.trim()) return;
    practice.entries.push({
      id: GoUtils.uid(),
      name: name.trim(),
      activation: 'Action',
      effort: '',
      description: ''
    });
    this._save();
    this._renderArcanePracticeTemplates();
  },

  removePracticeEntryTemplate(category, practiceId, entryId) {
    const practice = (this.data[category] || []).find(item => item.id === practiceId);
    if (!practice) return;
    practice.entries = practice.entries.filter(entry => entry.id !== entryId);
    this._save();
    this._renderArcanePracticeTemplates();
  },

  applyPracticeToChar(category, practiceId) {
    if (typeof GoCharacter === 'undefined') return;
    const cfg = GoUtils.getArcanePracticeConfig(category);
    if (!cfg) return;

    const tpl = (this.data[category] || []).find(item => item.id === practiceId);
    const char = GoCharacter.char;
    if (!tpl || !char) return;

    if (typeof GoCharacter._ensureCharacterStructure === 'function') {
      GoCharacter._ensureCharacterStructure(char);
    }

    char[category].push({
      id: GoUtils.uid(),
      name: tpl.name,
      notes: tpl.notes || '',
      entries: (tpl.entries || []).map(entry => ({
        id: GoUtils.uid(),
        name: entry.name,
        activation: entry.activation || 'Action',
        effort: entry.effort || '',
        description: entry.description || '',
        active: false
      }))
    });

    GoCharacter._save();
    if (document.getElementById('arcane-arts-list')) GoCharacter._renderArcaneArts();
    GoApp.toast(`"${tpl.name}" added to ${char.name}`, 'success');
  },

  /* ─── Weapons ───────────────────────────────────────────────────── */

  addWeapon() {
    this.data.weapons.push({ id: GoUtils.uid(), name: 'Weapon', damage: '1d8', attackMod: 0, notes: '' });
    this._save();
    this._renderWeapons();
  },

  removeWeapon(id) {
    this.data.weapons = this.data.weapons.filter(w => w.id !== id);
    this._save();
    this._renderWeapons();
  },

  /** Copy a weapon template to the active character's weapon list. */
  applyWeaponToChar(id) {
    if (typeof GoCharacter === 'undefined') return;
    const tpl  = this.data.weapons.find(w => w.id === id);
    if (!tpl) return;
    const char = GoCharacter.char;
    if (!char) return;

    char.weapons.push({
      id:        GoUtils.uid(),
      name:      tpl.name,
      damage:    tpl.damage,
      attackMod: tpl.attackMod,
      notes:     tpl.notes
    });
    GoCharacter._save();
    if (document.getElementById('equipment-list')) GoCharacter._renderEquipment();

    GoApp.toast(`"${tpl.name}" added to ${char.name}`, 'success');
  },

  /* ─── Equipment ─────────────────────────────────────────────────── */

  addEquipItem() {
    this.data.equipment.push({ id: GoUtils.uid(), name: 'Item', notes: '' });
    this._save();
    this._renderEquipment();
  },

  removeEquipItem(id) {
    this.data.equipment = this.data.equipment.filter(e => e.id !== id);
    this._save();
    this._renderEquipment();
  },

  /** Copy an equipment template to the active character's equipment list. */
  applyEquipToChar(id) {
    if (typeof GoCharacter === 'undefined') return;
    const tpl  = this.data.equipment.find(e => e.id === id);
    if (!tpl) return;
    const char = GoCharacter.char;
    if (!char) return;

    char.equipment.push({ id: GoUtils.uid(), name: tpl.name, notes: tpl.notes });
    GoCharacter._save();
    if (document.getElementById('equipment-list')) GoCharacter._renderEquipment();

    GoApp.toast(`"${tpl.name}" added to ${char.name}`, 'success');
  },

  /* ─── Enemies ───────────────────────────────────────────────────── */

  addEnemy() {
    this.data.enemies.push({ id: GoUtils.uid(), name: 'Enemy', hp: 10, ac: 10, notes: '' });
    this._save();
    this._renderEnemies();
    if (typeof GoCombat !== 'undefined') GoCombat.populateStockEnemyDropdown();
  },

  removeEnemy(id) {
    this.data.enemies = this.data.enemies.filter(e => e.id !== id);
    this._save();
    this._renderEnemies();
    if (typeof GoCombat !== 'undefined') GoCombat.populateStockEnemyDropdown();
  },

  /* ─── Full render ───────────────────────────────────────────────── */

  render() {
    const el = document.getElementById('dataeditor-tab');
    if (!el) return;

    el.innerHTML = `
      <div class="card">
        <h2 class="card-title">🗂️ Data Editor</h2>
        <p class="card-note">
          Build a personal library of Words of Power, Weapons and Equipment
          templates. Click <strong>Add to Character</strong> to instantly copy
          a template to the active character on the Character Sheet.
        </p>
        <div class="btn-group">
          <button id="de-seed-arcane-btn" class="btn-secondary">Load OCR Arcane Presets</button>
        </div>
      </div>

      <!-- ══ Words of Power ════════════════════════════════════════ -->
      <div class="card" id="de-words-card">
        <div class="card-header">
          <h2 class="card-title">⚡ Words of Power</h2>
          <div class="btn-group">
            <select id="de-word-select" class="input-main" aria-label="Choose word">
              <option value="">— choose word —</option>
              ${GoUtils.WORDS_OF_POWER.map(w => `<option value="${GoUtils.escHtml(w)}">${w}</option>`).join('')}
            </select>
            <input type="text" id="de-word-custom" class="input-main"
              placeholder="Custom name…" style="display:none" aria-label="Custom word name">
            <button id="de-add-word-btn" class="btn-primary">+ Add Word</button>
          </div>
        </div>
        <div id="de-words-list"></div>
      </div>

      ${GoUtils.ARCANE_PRACTICES.map(cfg => `
        <div class="card de-practice-card" id="de-${cfg.key}-card">
          <div class="card-header">
            <div>
              <h2 class="card-title">✦ ${cfg.templateTitle}</h2>
              <p class="card-note">Store reusable ${cfg.itemLabelPlural.toLowerCase()} and copy them to the active character with one click.</p>
            </div>
            <div class="btn-group">
              <input type="text" class="input-main de-practice-name-input"
                data-practice-category="${cfg.key}"
                placeholder="${cfg.addPlaceholder}" maxlength="80" aria-label="${cfg.itemLabel} name">
              <button class="btn-primary de-add-practice-btn" data-practice-category="${cfg.key}">+ Add ${cfg.itemLabel}</button>
            </div>
          </div>
          <div id="de-${cfg.key}-list"></div>
        </div>`).join('')}

      <!-- ══ Weapons ═══════════════════════════════════════════════ -->
      <div class="card" id="de-weapons-card">
        <div class="card-header">
          <h2 class="card-title">⚔️ Weapons</h2>
          <button id="de-add-weapon-btn" class="btn-primary">+ Add Weapon</button>
        </div>
        <div id="de-weapons-list"></div>
      </div>

      <!-- ══ Equipment ═════════════════════════════════════════════ -->
      <div class="card" id="de-equip-card">
        <div class="card-header">
          <h2 class="card-title">🎒 Equipment</h2>
          <button id="de-add-equip-btn" class="btn-primary">+ Add Item</button>
        </div>
        <div id="de-equip-list"></div>
      </div>

      <!-- ══ Stock Enemies ══════════════════════════════════════════ -->
      <div class="card" id="de-enemies-card">
        <div class="card-header">
          <h2 class="card-title">👾 Stock Enemies</h2>
          <button id="de-add-enemy-btn" class="btn-primary">+ Add Enemy</button>
        </div>
        <p class="card-note">
          Save reusable enemy templates here. In the Combat Tracker, use the
          <strong>Stock Enemy</strong> dropdown to instantly add a saved enemy
          to the current encounter.
        </p>
        <div id="de-enemies-list"></div>
      </div>
    `;

    this._renderWords();
    this._renderArcanePracticeTemplates();
    this._renderWeapons();
    this._renderEquipment();
    this._renderEnemies();
    this._attachEvents();
  },

  /* ─── Section renders ───────────────────────────────────────────── */

  _renderWords() {
    const el = document.getElementById('de-words-list');
    if (!el) return;

    if (!this.data.words.length) {
      el.innerHTML = '<p class="empty-msg">No word templates yet. Add one above.</p>';
      return;
    }

    el.innerHTML = this.data.words.map(word => `
      <div class="word-block de-word-block" data-de-word-id="${word.id}">
        <div class="word-header">
          <span class="word-name">${GoUtils.escHtml(word.name)}</span>
          <div class="btn-group">
            <select class="input-sm de-gift-type-select" data-word-id="${word.id}" title="Gift type">
              <option value="lesser">Lesser (1pt)</option>
              <option value="greater">Greater (2pt)</option>
              <option value="innate">Innate</option>
            </select>
            <input type="text" class="input-sm de-gift-name-input"
              placeholder="Gift name…" data-word-id="${word.id}" maxlength="80">
            <button class="btn-ghost de-add-gift-btn" data-word-id="${word.id}">+ Gift</button>
            <button class="btn-secondary de-apply-word-btn" data-word-id="${word.id}"
              title="Add this word (and all its gifts) to the active character">
              ➕ Add to Character
            </button>
            <button class="btn-danger de-remove-word-btn" data-word-id="${word.id}">Remove</button>
          </div>
        </div>

        ${word.gifts.length ? `
          <div class="gifts-list">
            <div class="gifts-header">
              <span class="gift-col-type">Type</span>
              <span class="gift-col-name">Gift Name</span>
              <span class="gift-col-act">Activation</span>
              <span class="gift-col-smite">Smite</span>
              <span class="gift-col-effort">Effort</span>
              <span class="gift-col-attr">Attribute Mod</span>
            </div>
            ${word.gifts.map(rawGift => {
              const g = this._normalizeGift(rawGift);
              return `
              <div class="gift-row" data-de-gift-id="${g.id}">
                <span class="gift-type-badge ${
                  (g.type || 'lesser') === 'greater' ? 'gift-greater' :
                  (g.type || 'lesser') === 'innate'  ? 'gift-innate'  : 'gift-lesser'
                }">
                  ${
                  (g.type || 'lesser') === 'greater' ? 'GREATER' :
                  (g.type || 'lesser') === 'innate'  ? 'INNATE'  : 'LESSER'
                  }
                </span>
                <input type="text" class="input-main de-gift-field"
                  value="${GoUtils.escHtml(g.name)}"
                  data-word-id="${word.id}" data-gift-id="${g.id}" data-gift-field="name"
                  placeholder="Gift name" title="Gift name">
                <select class="input-sm de-gift-field"
                  data-word-id="${word.id}" data-gift-id="${g.id}" data-gift-field="activation"
                  title="Activation type">
                  ${['Constant','Instant','On Turn','Action'].map(a =>
                    `<option value="${a}" ${(g.activation || 'Action') === a ? 'selected' : ''}>${a}</option>`
                  ).join('')}
                </select>
                <label class="checkbox-label gift-smite-label" title="Smite gift">
                  <input type="checkbox" class="de-gift-field"
                    data-word-id="${word.id}" data-gift-id="${g.id}" data-gift-field="smite"
                    ${g.smite ? 'checked' : ''}>
                  Smite
                </label>
                <input type="text" class="input-sm de-gift-field"
                  value="${GoUtils.escHtml(g.effort)}"
                  data-word-id="${word.id}" data-gift-id="${g.id}" data-gift-field="effort"
                  placeholder="Effort" title="Effort cost (e.g. Scene, Day)">
                <label class="checkbox-label gift-modify-label" title="Enable attribute modifier">
                  <input type="checkbox" class="de-gift-field"
                    data-word-id="${word.id}" data-gift-id="${g.id}" data-gift-field="modifiesAttribute"
                    ${g.modifiesAttribute ? 'checked' : ''}>
                  Mod Attr
                </label>
                ${g.modifiesAttribute ? `
                  <div class="gift-modifier-controls">
                    <select class="input-sm de-gift-field"
                      data-word-id="${word.id}" data-gift-id="${g.id}" data-gift-field="modAttribute"
                      title="Affected attribute">
                      ${[
                        ['str','STR'], ['dex','DEX'], ['con','CON'],
                        ['int','INT'], ['wis','WIS'], ['cha','CHA']
                      ].map(([v,l]) => `<option value="${v}" ${g.modAttribute === v ? 'selected' : ''}>${l}</option>`).join('')}
                    </select>
                    <select class="input-sm de-gift-field"
                      data-word-id="${word.id}" data-gift-id="${g.id}" data-gift-field="modType"
                      title="Modifier type">
                      <option value="bonus" ${g.modType === 'bonus' ? 'selected' : ''}>Bonus</option>
                      <option value="score" ${g.modType === 'score' ? 'selected' : ''}>Score</option>
                    </select>
                    <input type="number" class="input-sm de-gift-field"
                      data-word-id="${word.id}" data-gift-id="${g.id}" data-gift-field="modValue"
                      value="${g.modValue || 0}" min="-20" max="20" title="Modifier value">
                    <span class="gift-modifier-summary is-template"
                      title="Resolved modifier summary">${GoUtils.escHtml(this._formatGiftModifierSummary(g))}</span>
                  </div>` : ''}
                <button class="btn-icon de-remove-gift-btn"
                  data-word-id="${word.id}" data-gift-id="${g.id}" title="Remove gift">✕</button>
                <textarea class="gift-description de-gift-field"
                  data-word-id="${word.id}" data-gift-id="${g.id}" data-gift-field="description"
                  placeholder="Description…" rows="2">${GoUtils.escHtml(g.description || '')}</textarea>
              </div>`;
            }).join('')}
          </div>` : '<p class="empty-msg-sm">No gifts yet.</p>'}
      </div>`
    ).join('');

    this._attachWordEvents();
  },

  _renderArcanePracticeTemplates() {
    GoUtils.ARCANE_PRACTICES.forEach(cfg => {
      const el = document.getElementById(`de-${cfg.key}-list`);
      if (!el) return;

      const items = this.data[cfg.key] || [];
      if (!items.length) {
        el.innerHTML = `<p class="empty-msg">No ${cfg.itemLabelPlural.toLowerCase()} saved yet.</p>`;
        return;
      }

      el.innerHTML = items.map(item => `
        <div class="word-block de-word-block practice-block" data-practice-category="${cfg.key}" data-practice-id="${item.id}">
          <div class="word-header practice-header">
            <input type="text" class="input-main de-practice-field practice-title-input"
              value="${GoUtils.escHtml(item.name)}"
              data-practice-category="${cfg.key}" data-practice-id="${item.id}" data-practice-field="name"
              placeholder="${cfg.addPlaceholder}" aria-label="${cfg.itemLabel} name">
            <div class="btn-group">
              <input type="text" class="input-sm de-practice-entry-name-input"
                data-practice-category="${cfg.key}" data-practice-id="${item.id}"
                placeholder="${cfg.entryPlaceholder}" maxlength="80" aria-label="${cfg.entryLabel} name">
              <button class="btn-ghost de-add-practice-entry-btn"
                data-practice-category="${cfg.key}" data-practice-id="${item.id}">+ ${cfg.entryLabel}</button>
              <button class="btn-secondary de-apply-practice-btn"
                data-practice-category="${cfg.key}" data-practice-id="${item.id}" title="Add to active character">➕ Add to Character</button>
              <button class="btn-danger de-remove-practice-btn"
                data-practice-category="${cfg.key}" data-practice-id="${item.id}">Remove</button>
            </div>
          </div>
          <div class="practice-notes-wrap">
            <textarea class="notes-area de-practice-field practice-notes"
              data-practice-category="${cfg.key}" data-practice-id="${item.id}" data-practice-field="notes"
              placeholder="${cfg.itemLabel} notes…" rows="2">${GoUtils.escHtml(item.notes || '')}</textarea>
          </div>
          ${item.entries.length ? `
            <div class="gifts-list practice-entries-list">
              <div class="gifts-header">
                <span class="gift-col-name">${cfg.entryLabel}</span>
                <span class="gift-col-act">Activation</span>
                <span class="gift-col-effort">Effort</span>
              </div>
              ${item.entries.map(entry => `
                <div class="gift-row" data-practice-entry-id="${entry.id}">
                  <input type="text" class="input-main de-practice-entry-field"
                    value="${GoUtils.escHtml(entry.name)}"
                    data-practice-category="${cfg.key}" data-practice-id="${item.id}" data-practice-entry-id="${entry.id}" data-practice-entry-field="name"
                    placeholder="${cfg.entryLabel} name" aria-label="${cfg.entryLabel} name">
                  <select class="input-sm de-practice-entry-field"
                    data-practice-category="${cfg.key}" data-practice-id="${item.id}" data-practice-entry-id="${entry.id}" data-practice-entry-field="activation"
                    title="Activation type">
                    ${['Constant','Instant','On Turn','Action'].map(a =>
                      `<option value="${a}" ${(entry.activation || 'Action') === a ? 'selected' : ''}>${a}</option>`
                    ).join('')}
                  </select>
                  <input type="text" class="input-sm de-practice-entry-field"
                    value="${GoUtils.escHtml(entry.effort || '')}"
                    data-practice-category="${cfg.key}" data-practice-id="${item.id}" data-practice-entry-id="${entry.id}" data-practice-entry-field="effort"
                    placeholder="Effort" aria-label="Effort cost">
                  <button class="btn-icon de-remove-practice-entry-btn"
                    data-practice-category="${cfg.key}" data-practice-id="${item.id}" data-practice-entry-id="${entry.id}"
                    title="Remove ${cfg.entryLabel.toLowerCase()}">✕</button>
                  <textarea class="gift-description de-practice-entry-field"
                    data-practice-category="${cfg.key}" data-practice-id="${item.id}" data-practice-entry-id="${entry.id}" data-practice-entry-field="description"
                    placeholder="Description…" rows="2">${GoUtils.escHtml(entry.description || '')}</textarea>
                </div>`).join('')}
            </div>` : `<p class="empty-msg-sm">No ${cfg.entryLabelPlural.toLowerCase()} yet.</p>`}
        </div>`).join('');
    });

    this._attachPracticeEvents();
  },

  _renderWeapons() {
    const el = document.getElementById('de-weapons-list');
    if (!el) return;

    if (!this.data.weapons.length) {
      el.innerHTML = '<p class="empty-msg">No weapon templates yet.</p>';
      return;
    }

    el.innerHTML = `
      <table class="equip-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Damage</th>
            <th>Atk Mod</th>
            <th>Notes</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${this.data.weapons.map(w => `
            <tr data-de-weapon-id="${w.id}">
              <td><input type="text" class="input-main de-weapon-field"
                value="${GoUtils.escHtml(w.name)}"
                data-id="${w.id}" data-f="name" aria-label="Weapon name"></td>
              <td><input type="text" class="input-sm de-weapon-field"
                value="${GoUtils.escHtml(w.damage)}"
                data-id="${w.id}" data-f="damage" placeholder="1d8" aria-label="Damage dice"></td>
              <td><input type="number" class="input-sm de-weapon-field"
                value="${w.attackMod}"
                data-id="${w.id}" data-f="attackMod" aria-label="Attack modifier"></td>
              <td><input type="text" class="input-main de-weapon-field"
                value="${GoUtils.escHtml(w.notes)}"
                data-id="${w.id}" data-f="notes" placeholder="Notes" aria-label="Notes"></td>
              <td class="de-action-cell">
                <button class="btn-secondary de-apply-weapon-btn" data-id="${w.id}"
                  title="Add to active character">➕</button>
                <button class="btn-icon de-remove-weapon-btn" data-id="${w.id}">✕</button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>`;

    this._attachWeaponEvents();
  },

  _renderEquipment() {
    const el = document.getElementById('de-equip-list');
    if (!el) return;

    if (!this.data.equipment.length) {
      el.innerHTML = '<p class="empty-msg">No equipment templates yet.</p>';
      return;
    }

    el.innerHTML = `
      <table class="equip-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Notes</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${this.data.equipment.map(e => `
            <tr data-de-equip-id="${e.id}">
              <td><input type="text" class="input-main de-equip-field"
                value="${GoUtils.escHtml(e.name)}"
                data-id="${e.id}" data-f="name" aria-label="Item name"></td>
              <td><input type="text" class="input-main de-equip-field"
                value="${GoUtils.escHtml(e.notes)}"
                data-id="${e.id}" data-f="notes" placeholder="Notes" aria-label="Notes"></td>
              <td class="de-action-cell">
                <button class="btn-secondary de-apply-equip-btn" data-id="${e.id}"
                  title="Add to active character">➕</button>
                <button class="btn-icon de-remove-equip-btn" data-id="${e.id}">✕</button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>`;

    this._attachEquipEvents();
  },

  _renderEnemies() {
    const el = document.getElementById('de-enemies-list');
    if (!el) return;

    if (!this.data.enemies.length) {
      el.innerHTML = '<p class="empty-msg">No enemy templates yet.</p>';
      return;
    }

    el.innerHTML = `
      <table class="equip-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Max HP</th>
            <th>AC</th>
            <th>Notes</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${this.data.enemies.map(e => `
            <tr data-de-enemy-id="${e.id}">
              <td><input type="text" class="input-main de-enemy-field"
                value="${GoUtils.escHtml(e.name)}"
                data-id="${e.id}" data-f="name" aria-label="Enemy name"></td>
              <td><input type="number" class="input-sm de-enemy-field"
                value="${e.hp}" min="1"
                data-id="${e.id}" data-f="hp" aria-label="Max HP"></td>
              <td><input type="number" class="input-sm de-enemy-field"
                value="${e.ac}" min="0"
                data-id="${e.id}" data-f="ac" aria-label="AC"></td>
              <td><input type="text" class="input-main de-enemy-field"
                value="${GoUtils.escHtml(e.notes)}"
                data-id="${e.id}" data-f="notes" placeholder="Notes" aria-label="Notes"></td>
              <td class="de-action-cell">
                <button class="btn-icon de-remove-enemy-btn" data-id="${e.id}"
                  title="Remove enemy template">✕</button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>`;

    this._attachEnemyEvents();
  },

  /* ─── Event binding ─────────────────────────────────────────────── */

  _attachEvents() {
    /* Word selector – show custom input */
    document.getElementById('de-word-select')?.addEventListener('change', e => {
      const custom = document.getElementById('de-word-custom');
      if (custom) custom.style.display = e.target.value === '(Custom)' ? '' : 'none';
    });

    document.getElementById('de-add-word-btn')?.addEventListener('click', () => {
      const sel    = document.getElementById('de-word-select').value;
      const custom = document.getElementById('de-word-custom').value.trim();
      const name   = sel === '(Custom)' ? custom : sel;
      if (!name) { GoApp.toast('Choose or type a Word name', 'error'); return; }
      this.addWord(name);
      document.getElementById('de-word-select').value = '';
      const ci = document.getElementById('de-word-custom');
      if (ci) { ci.value = ''; ci.style.display = 'none'; }
    });

    document.getElementById('de-add-weapon-btn')?.addEventListener('click', () => this.addWeapon());
    document.getElementById('de-add-equip-btn')?.addEventListener('click',  () => this.addEquipItem());
    document.getElementById('de-add-enemy-btn')?.addEventListener('click',  () => this.addEnemy());
    document.getElementById('de-seed-arcane-btn')?.addEventListener('click', () => {
      const added = this.seedArcanePresets();
      if (added) {
        this.render();
        GoApp.toast(`Added ${added} arcane presets from OCR text`, 'success');
      } else {
        GoApp.toast('No new arcane presets to add', 'info');
      }
    });

    document.querySelectorAll('.de-add-practice-btn').forEach(btn =>
      btn.addEventListener('click', () => {
        const category = btn.dataset.practiceCategory;
        const input = document.querySelector(`.de-practice-name-input[data-practice-category="${category}"]`);
        if (!input) return;
        this.addPracticeTemplate(category, input.value);
        input.value = '';
      }));

    document.querySelectorAll('.de-practice-name-input').forEach(input =>
      input.addEventListener('keydown', e => {
        if (e.key !== 'Enter') return;
        this.addPracticeTemplate(input.dataset.practiceCategory, input.value);
        input.value = '';
      }));
  },

  _attachWordEvents() {
    /* Remove word */
    document.querySelectorAll('.de-remove-word-btn').forEach(btn =>
      btn.addEventListener('click', () => {
        if (confirm('Remove this Word template?')) this.removeWord(btn.dataset.wordId);
      }));

    /* Apply word to character */
    document.querySelectorAll('.de-apply-word-btn').forEach(btn =>
      btn.addEventListener('click', () => this.applyWordToChar(btn.dataset.wordId)));

    /* Add gift */
    document.querySelectorAll('.de-add-gift-btn').forEach(btn =>
      btn.addEventListener('click', () => {
        const wid  = btn.dataset.wordId;
        const inp  = document.querySelector(`.de-gift-name-input[data-word-id="${wid}"]`);
        const sel  = document.querySelector(`.de-gift-type-select[data-word-id="${wid}"]`);
        if (inp) { this.addGiftToWord(wid, inp.value, sel ? sel.value : 'lesser'); inp.value = ''; }
      }));

    /* Add gift on Enter */
    document.querySelectorAll('.de-gift-name-input').forEach(inp =>
      inp.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          const wid = inp.dataset.wordId;
          const sel = document.querySelector(`.de-gift-type-select[data-word-id="${wid}"]`);
          this.addGiftToWord(wid, inp.value, sel ? sel.value : 'lesser');
          inp.value = '';
        }
      }));

    /* Remove gift */
    document.querySelectorAll('.de-remove-gift-btn').forEach(btn =>
      btn.addEventListener('click', () =>
        this.removeGiftFromWord(btn.dataset.wordId, btn.dataset.giftId)));

    /* In-place gift field editing */
    document.querySelectorAll('.de-gift-field').forEach(inp =>
      inp.addEventListener('change', () => {
        const word = this.data.words.find(w => w.id === inp.dataset.wordId);
        if (!word) return;
        const gift = word.gifts.find(g => g.id === inp.dataset.giftId);
        if (!gift) return;
        const field = inp.dataset.giftField;
        if (field === 'modifiesAttribute') {
          gift[field] = inp.checked;
          this._save();
          this._renderWords();
          return;
        }
        gift[field] = inp.type === 'checkbox'
          ? inp.checked
          : inp.type === 'number'
            ? (parseInt(inp.value, 10) || 0)
            : inp.value;
        this._save();
      }));
  },

  _attachPracticeEvents() {
    document.querySelectorAll('.de-remove-practice-btn').forEach(btn =>
      btn.addEventListener('click', () => {
        const category = btn.dataset.practiceCategory;
        const cfg = GoUtils.getArcanePracticeConfig(category);
        if (!cfg) return;
        if (confirm(`Remove this ${cfg.itemLabel.toLowerCase()} template?`)) {
          this.removePracticeTemplate(category, btn.dataset.practiceId);
        }
      }));

    document.querySelectorAll('.de-apply-practice-btn').forEach(btn =>
      btn.addEventListener('click', () => this.applyPracticeToChar(btn.dataset.practiceCategory, btn.dataset.practiceId)));

    document.querySelectorAll('.de-add-practice-entry-btn').forEach(btn =>
      btn.addEventListener('click', () => {
        const category = btn.dataset.practiceCategory;
        const practiceId = btn.dataset.practiceId;
        const input = document.querySelector(`.de-practice-entry-name-input[data-practice-category="${category}"][data-practice-id="${practiceId}"]`);
        if (!input) return;
        this.addPracticeEntryTemplate(category, practiceId, input.value);
        input.value = '';
      }));

    document.querySelectorAll('.de-practice-entry-name-input').forEach(input =>
      input.addEventListener('keydown', e => {
        if (e.key !== 'Enter') return;
        this.addPracticeEntryTemplate(input.dataset.practiceCategory, input.dataset.practiceId, input.value);
        input.value = '';
      }));

    document.querySelectorAll('.de-remove-practice-entry-btn').forEach(btn =>
      btn.addEventListener('click', () =>
        this.removePracticeEntryTemplate(btn.dataset.practiceCategory, btn.dataset.practiceId, btn.dataset.practiceEntryId)));

    document.querySelectorAll('.de-practice-field').forEach(input =>
      input.addEventListener('change', () => {
        const practice = (this.data[input.dataset.practiceCategory] || []).find(item => item.id === input.dataset.practiceId);
        if (!practice) return;
        practice[input.dataset.practiceField] = input.value;
        this._save();
      }));

    document.querySelectorAll('.de-practice-entry-field').forEach(input =>
      input.addEventListener('change', () => {
        const practice = (this.data[input.dataset.practiceCategory] || []).find(item => item.id === input.dataset.practiceId);
        if (!practice) return;
        const entry = practice.entries.find(item => item.id === input.dataset.practiceEntryId);
        if (!entry) return;
        entry[input.dataset.practiceEntryField] = input.value;
        this._save();
      }));
  },

  _attachWeaponEvents() {
    document.querySelectorAll('.de-remove-weapon-btn').forEach(btn =>
      btn.addEventListener('click', () => this.removeWeapon(btn.dataset.id)));

    document.querySelectorAll('.de-apply-weapon-btn').forEach(btn =>
      btn.addEventListener('click', () => this.applyWeaponToChar(btn.dataset.id)));

    document.querySelectorAll('.de-weapon-field').forEach(inp =>
      inp.addEventListener('change', () => {
        const item = this.data.weapons.find(w => w.id === inp.dataset.id);
        if (!item) return;
        item[inp.dataset.f] = inp.type === 'number' ? (parseInt(inp.value, 10) || 0) : inp.value;
        this._save();
      }));
  },

  _attachEquipEvents() {
    document.querySelectorAll('.de-remove-equip-btn').forEach(btn =>
      btn.addEventListener('click', () => this.removeEquipItem(btn.dataset.id)));

    document.querySelectorAll('.de-apply-equip-btn').forEach(btn =>
      btn.addEventListener('click', () => this.applyEquipToChar(btn.dataset.id)));

    document.querySelectorAll('.de-equip-field').forEach(inp =>
      inp.addEventListener('change', () => {
        const item = this.data.equipment.find(e => e.id === inp.dataset.id);
        if (!item) return;
        item[inp.dataset.f] = inp.value;
        this._save();
      }));
  },

  _attachEnemyEvents() {
    document.querySelectorAll('.de-remove-enemy-btn').forEach(btn =>
      btn.addEventListener('click', () => {
        if (confirm('Remove this enemy template?')) this.removeEnemy(btn.dataset.id);
      }));

    document.querySelectorAll('.de-enemy-field').forEach(inp =>
      inp.addEventListener('change', () => {
        const item = this.data.enemies.find(e => e.id === inp.dataset.id);
        if (!item) return;
        item[inp.dataset.f] = inp.type === 'number' ? (parseInt(inp.value, 10) || 0) : inp.value;
        this._save();
        if (typeof GoCombat !== 'undefined') GoCombat.populateStockEnemyDropdown();
      }));
  },

  /* ─── Helpers ───────────────────────────────────────────────────── */

};
