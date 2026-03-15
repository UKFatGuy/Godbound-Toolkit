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
    this.render();
  },

  _ensureStructure() {
    if (!this.data)            this.data = {};
    if (!Array.isArray(this.data.words))     this.data.words     = [];
    if (!Array.isArray(this.data.weapons))   this.data.weapons   = [];
    if (!Array.isArray(this.data.equipment)) this.data.equipment = [];
  },

  _save() {
    GoStorage.saveDataTemplates(this.data);
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
    word.gifts.push({
      id:          GoUtils.uid(),
      name:        giftName.trim(),
      type:        giftType || 'lesser',
      activation:  'Action',
      smite:       false,
      effort:      '',
      description: ''
    });
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
        active:      false
      }))
    };
    char.words.push(newWord);
    GoCharacter._save();

    // If the character sheet is currently visible, refresh words
    if (document.getElementById('words-list')) GoCharacter._renderWords();

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
      </div>

      <!-- ══ Words of Power ════════════════════════════════════════ -->
      <div class="card" id="de-words-card">
        <div class="card-header">
          <h2 class="card-title">⚡ Words of Power</h2>
          <div class="btn-group">
            <select id="de-word-select" class="input-main" aria-label="Choose word">
              <option value="">— choose word —</option>
              ${GoUtils.WORDS_OF_POWER.map(w => `<option value="${this._esc(w)}">${w}</option>`).join('')}
            </select>
            <input type="text" id="de-word-custom" class="input-main"
              placeholder="Custom name…" style="display:none" aria-label="Custom word name">
            <button id="de-add-word-btn" class="btn-primary">+ Add Word</button>
          </div>
        </div>
        <div id="de-words-list"></div>
      </div>

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
    `;

    this._renderWords();
    this._renderWeapons();
    this._renderEquipment();
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
          <span class="word-name">${this._esc(word.name)}</span>
          <div class="btn-group">
            <select class="input-sm de-gift-type-select" data-word-id="${word.id}" title="Gift type">
              <option value="lesser">Lesser (1pt)</option>
              <option value="greater">Greater (2pt)</option>
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
            </div>
            ${word.gifts.map(g => `
              <div class="gift-row" data-de-gift-id="${g.id}">
                <span class="gift-type-badge ${(g.type || 'lesser') === 'greater' ? 'gift-greater' : 'gift-lesser'}">
                  ${(g.type || 'lesser') === 'greater' ? 'GREATER' : 'LESSER'}
                </span>
                <input type="text" class="input-main de-gift-field"
                  value="${this._esc(g.name)}"
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
                  value="${this._esc(g.effort)}"
                  data-word-id="${word.id}" data-gift-id="${g.id}" data-gift-field="effort"
                  placeholder="Effort" title="Effort cost (e.g. Scene, Day)">
                <button class="btn-icon de-remove-gift-btn"
                  data-word-id="${word.id}" data-gift-id="${g.id}" title="Remove gift">✕</button>
              </div>`
            ).join('')}
          </div>` : '<p class="empty-msg-sm">No gifts yet.</p>'}
      </div>`
    ).join('');

    this._attachWordEvents();
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
                value="${this._esc(w.name)}"
                data-id="${w.id}" data-f="name" aria-label="Weapon name"></td>
              <td><input type="text" class="input-sm de-weapon-field"
                value="${this._esc(w.damage)}"
                data-id="${w.id}" data-f="damage" placeholder="1d8" aria-label="Damage dice"></td>
              <td><input type="number" class="input-sm de-weapon-field"
                value="${w.attackMod}"
                data-id="${w.id}" data-f="attackMod" aria-label="Attack modifier"></td>
              <td><input type="text" class="input-main de-weapon-field"
                value="${this._esc(w.notes)}"
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
                value="${this._esc(e.name)}"
                data-id="${e.id}" data-f="name" aria-label="Item name"></td>
              <td><input type="text" class="input-main de-equip-field"
                value="${this._esc(e.notes)}"
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
        gift[inp.dataset.giftField] = inp.type === 'checkbox' ? inp.checked : inp.value;
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

  /* ─── Helpers ───────────────────────────────────────────────────── */

  _esc(str) {
    return String(str ?? '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
};
