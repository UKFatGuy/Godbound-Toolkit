'use strict';

/**
 * Character Sheet module.
 * Supports multiple characters stored in localStorage.
 * Each character tracks: attributes, saves, combat stats,
 * Words of Power (with Gifts), divine resources, equipment and notes.
 */
const GoCharacter = {

  characters: [],
  activeIdx: 0,

  /* ─── Default character template ───────────────────────────────── */

  _newCharacter(name = 'New Character') {
    return {
      id:         GoUtils.uid(),
      name,
      level:      1,
      background: '',

      attributes: { str: 10, int: 10, wis: 10, dex: 10, con: 10, cha: 10 },

      hp:         { max: 8, current: 8 },
      ac:         10,
      attackBonus: 2,

      saves: { hardiness: 15, evasion: 15, spirit: 15 },

      effort:    { total: 2, committedDay: 0, committedScene: 0 },
      dominion:  { total: 0 },
      influence: { max: 0, current: 0 },

      words: [],
      weapons:   [],
      armor:     [],
      equipment: [],
      notes:     ''
    };
  },

  /* ─── Init ──────────────────────────────────────────────────────── */

  init() {
    this.characters = GoStorage.loadCharacters();
    this.activeIdx  = GoStorage.loadActiveCharacter();
    if (!this.characters.length) {
      this.characters.push(this._newCharacter('My Godbound'));
      GoStorage.saveCharacters(this.characters);
    }
    this.activeIdx = GoUtils.clamp(this.activeIdx, 0, this.characters.length - 1);
    this.render();
  },

  _save() {
    GoStorage.saveCharacters(this.characters);
    GoStorage.saveActiveCharacter(this.activeIdx);
  },

  get char() { return this.characters[this.activeIdx]; },

  /* ─── Character CRUD ────────────────────────────────────────────── */

  createCharacter() {
    const name = prompt('Character name:', 'New Character');
    if (!name) return;
    this.characters.push(this._newCharacter(name.trim()));
    this.activeIdx = this.characters.length - 1;
    this._save();
    this.render();
    GoApp.toast(`Created "${name.trim()}"`, 'success');
  },

  deleteCharacter() {
    if (this.characters.length === 1) { GoApp.toast('Cannot delete the last character', 'error'); return; }
    if (!confirm(`Delete "${this.char.name}"? This cannot be undone.`)) return;
    this.characters.splice(this.activeIdx, 1);
    this.activeIdx = GoUtils.clamp(this.activeIdx - 1, 0, this.characters.length - 1);
    this._save();
    this.render();
  },

  selectCharacter(idx) {
    this.activeIdx = GoUtils.clamp(idx, 0, this.characters.length - 1);
    GoStorage.saveActiveCharacter(this.activeIdx);
    this.render();
  },

  /* ─── Words of Power ────────────────────────────────────────────── */

  addWord(name) {
    if (!name) return;
    this.char.words.push({ id: GoUtils.uid(), name, effortCommitted: 0, gifts: [] });
    this._save();
    this._renderWords();
  },

  removeWord(id) {
    this.char.words = this.char.words.filter(w => w.id !== id);
    this._save();
    this._renderWords();
  },

  addGift(wordId, giftName) {
    const word = this.char.words.find(w => w.id === wordId);
    if (!word || !giftName.trim()) return;
    word.gifts.push({ id: GoUtils.uid(), name: giftName.trim(), effort: '', description: '', active: false });
    this._save();
    this._renderWords();
  },

  removeGift(wordId, giftId) {
    const word = this.char.words.find(w => w.id === wordId);
    if (!word) return;
    word.gifts = word.gifts.filter(g => g.id !== giftId);
    this._save();
    this._renderWords();
  },

  toggleGift(wordId, giftId) {
    const word = this.char.words.find(w => w.id === wordId);
    if (!word) return;
    const gift = word.gifts.find(g => g.id === giftId);
    if (!gift) return;
    gift.active = !gift.active;
    this._save();
    this._renderWords();
  },

  /* ─── Equipment ─────────────────────────────────────────────────── */

  addWeapon()    { this.char.weapons.push({ id: GoUtils.uid(), name: 'Weapon', damage: '1d8', attackMod: 0, notes: '' }); this._save(); this._renderEquipment(); },
  addArmor()     { this.char.armor.push({ id: GoUtils.uid(), name: 'Armour', acBonus: 0, notes: '' }); this._save(); this._renderEquipment(); },
  addEquipItem() { this.char.equipment.push({ id: GoUtils.uid(), name: 'Item', notes: '' }); this._save(); this._renderEquipment(); },

  removeWeapon(id)    { this.char.weapons   = this.char.weapons.filter(x => x.id !== id); this._save(); this._renderEquipment(); },
  removeArmor(id)     { this.char.armor     = this.char.armor.filter(x => x.id !== id);   this._save(); this._renderEquipment(); },
  removeEquipItem(id) { this.char.equipment = this.char.equipment.filter(x => x.id !== id); this._save(); this._renderEquipment(); },

  /* ─── Full render ───────────────────────────────────────────────── */

  render() {
    const el = document.getElementById('character-tab');
    if (!el) return;

    const c = this.char;

    el.innerHTML = `
      <!-- Character selector bar -->
      <div class="card char-selector-bar">
        <select id="char-select" class="input-main" aria-label="Select character">
          ${this.characters.map((ch, i) =>
            `<option value="${i}" ${i === this.activeIdx ? 'selected' : ''}>${ch.name}</option>`
          ).join('')}
        </select>
        <button id="char-new-btn"    class="btn-primary">+ New</button>
        <button id="char-delete-btn" class="btn-danger">Delete</button>
      </div>

      <!-- Overview -->
      <div class="card">
        <h2 class="card-title">Overview</h2>
        <div class="form-grid">
          <label class="form-label">Name
            <input type="text" class="input-main" data-field="name" value="${this._esc(c.name)}">
          </label>
          <label class="form-label">Level
            <input type="number" class="input-sm" data-field="level" value="${c.level}" min="1" max="10">
          </label>
          <label class="form-label col-span-2">Background
            <input type="text" class="input-main" data-field="background" value="${this._esc(c.background)}" placeholder="Former soldier, hedge-wizard…">
          </label>
        </div>
      </div>

      <!-- Attributes & Saves -->
      <div class="card">
        <h2 class="card-title">Attributes &amp; Saves</h2>
        <div class="attr-grid">
          ${['str','dex','con','int','wis','cha'].map(attr => {
            const score = c.attributes[attr];
            const mod   = GoUtils.getAttrMod(score);
            return `
              <div class="attr-block">
                <div class="attr-name">${attr.toUpperCase()}</div>
                <input type="number" class="attr-score" data-field="attr-${attr}"
                  value="${score}" min="3" max="18" aria-label="${attr}">
                <div class="attr-mod ${mod >= 0 ? 'mod-pos' : 'mod-neg'}">${GoUtils.formatMod(mod)}</div>
              </div>`;
          }).join('')}
        </div>

        <div class="form-grid mt-md">
          <label class="form-label">Hardiness
            <input type="number" class="input-sm" data-field="save-hardiness"
              value="${c.saves.hardiness}" min="1" max="20"
              title="Roll d20 equal to or higher to succeed">
          </label>
          <label class="form-label">Evasion
            <input type="number" class="input-sm" data-field="save-evasion"
              value="${c.saves.evasion}" min="1" max="20">
          </label>
          <label class="form-label">Spirit
            <input type="number" class="input-sm" data-field="save-spirit"
              value="${c.saves.spirit}" min="1" max="20">
          </label>
        </div>
      </div>

      <!-- Combat Stats -->
      <div class="card">
        <h2 class="card-title">Combat Stats</h2>
        <div class="form-grid">
          <label class="form-label">HP (Current)
            <input type="number" class="input-sm" data-field="hp-current"
              value="${c.hp.current}" min="0">
          </label>
          <label class="form-label">HP (Max)
            <input type="number" class="input-sm" data-field="hp-max"
              value="${c.hp.max}" min="1">
          </label>
          <label class="form-label">Armour Class
            <input type="number" class="input-sm" data-field="ac"
              value="${c.ac}" min="0">
          </label>
          <label class="form-label">Attack Bonus
            <input type="number" class="input-sm" data-field="attack-bonus"
              value="${c.attackBonus}">
          </label>
          <label class="form-label">Fray Dice
            <span class="fray-badge">${GoUtils.getFrayDice(c.level)}</span>
          </label>
        </div>
      </div>

      <!-- Divine Resources -->
      <div class="card">
        <h2 class="card-title">Divine Resources</h2>
        <div class="form-grid">
          <label class="form-label">Total Effort
            <input type="number" class="input-sm" data-field="effort-total"
              value="${c.effort.total}" min="0" max="10">
          </label>
          <label class="form-label">Committed (Day)
            <input type="number" class="input-sm" data-field="effort-day"
              value="${c.effort.committedDay}" min="0">
          </label>
          <label class="form-label">Committed (Scene)
            <input type="number" class="input-sm" data-field="effort-scene"
              value="${c.effort.committedScene}" min="0">
          </label>
          <div class="form-label">
            <span class="sub-label">Available Effort</span>
            <span class="effort-avail">${c.effort.total - c.effort.committedDay - c.effort.committedScene}</span>
          </div>
          <label class="form-label">Dominion
            <input type="number" class="input-sm" data-field="dominion"
              value="${c.dominion.total}" min="0">
          </label>
          <label class="form-label">Influence (Current)
            <input type="number" class="input-sm" data-field="influence-current"
              value="${c.influence.current}" min="0">
          </label>
          <label class="form-label">Influence (Max)
            <input type="number" class="input-sm" data-field="influence-max"
              value="${c.influence.max}" min="0">
          </label>
        </div>
      </div>

      <!-- Words of Power -->
      <div class="card" id="words-section">
        <div class="card-header">
          <h2 class="card-title">Words of Power</h2>
          <div class="btn-group">
            <select id="add-word-select" class="input-sm" aria-label="Choose a Word">
              <option value="">— choose Word —</option>
              ${GoUtils.WORDS_OF_POWER.map(w => `<option value="${w}">${w}</option>`).join('')}
            </select>
            <input id="add-word-custom" type="text" class="input-sm" placeholder="Custom word…" style="display:none">
            <button id="add-word-btn" class="btn-primary">Add Word</button>
          </div>
        </div>
        <div id="words-list"></div>
      </div>

      <!-- Equipment -->
      <div class="card" id="equipment-section">
        <h2 class="card-title">Equipment</h2>
        <div id="equipment-list"></div>
      </div>

      <!-- Notes -->
      <div class="card">
        <h2 class="card-title">Notes</h2>
        <textarea class="notes-area" data-field="notes" rows="6"
          placeholder="Background details, divine realm notes, quest hooks…">${this._esc(c.notes)}</textarea>
      </div>

      <!-- Save button -->
      <div class="save-bar">
        <button id="char-save-btn" class="btn-primary btn-lg">💾 Save Character</button>
        <span id="save-status" class="save-status"></span>
      </div>
    `;

    this._renderWords();
    this._renderEquipment();
    this._attachCharEvents();
  },

  /* ─── Words render ──────────────────────────────────────────────── */

  _renderWords() {
    const el = document.getElementById('words-list');
    if (!el) return;

    if (!this.char.words.length) {
      el.innerHTML = '<p class="empty-msg">No Words yet. Add a Word above.</p>';
      return;
    }

    el.innerHTML = this.char.words.map(word => `
      <div class="word-block" data-word-id="${word.id}">
        <div class="word-header">
          <span class="word-name">${word.name}</span>
          <div class="btn-group">
            <input type="text" class="input-sm gift-name-input" placeholder="Gift name…"
              data-word-id="${word.id}" maxlength="60">
            <button class="btn-ghost add-gift-btn" data-word-id="${word.id}">+ Gift</button>
            <button class="btn-danger remove-word-btn" data-word-id="${word.id}">Remove</button>
          </div>
        </div>

        ${word.gifts.length ? `
          <div class="gifts-list">
            ${word.gifts.map(g => `
              <div class="gift-row ${g.active ? 'gift-active' : ''}" data-gift-id="${g.id}">
                <button class="gift-toggle-btn" data-word-id="${word.id}" data-gift-id="${g.id}"
                  title="Toggle active">${g.active ? '◉' : '○'}</button>
                <input type="text" class="input-main gift-field" value="${this._esc(g.name)}"
                  data-word-id="${word.id}" data-gift-id="${g.id}" data-gift-field="name"
                  placeholder="Gift name" title="Gift name">
                <input type="text" class="input-sm gift-field" value="${this._esc(g.effort)}"
                  data-word-id="${word.id}" data-gift-id="${g.id}" data-gift-field="effort"
                  placeholder="Effort cost" title="Effort cost">
                <input type="text" class="input-main gift-field" value="${this._esc(g.description)}"
                  data-word-id="${word.id}" data-gift-id="${g.id}" data-gift-field="description"
                  placeholder="Description" title="Description">
                <button class="btn-icon remove-gift-btn"
                  data-word-id="${word.id}" data-gift-id="${g.id}" title="Remove gift">✕</button>
              </div>`
            ).join('')}
          </div>` : '<p class="empty-msg-sm">No gifts yet.</p>'}
      </div>`
    ).join('');

    this._attachWordEvents();
  },

  /* ─── Equipment render ──────────────────────────────────────────── */

  _renderEquipment() {
    const el = document.getElementById('equipment-list');
    if (!el) return;

    const c = this.char;
    el.innerHTML = `
      <!-- Weapons -->
      <div class="equip-section">
        <div class="equip-section-header">
          <h3>Weapons</h3>
          <button id="add-weapon-btn" class="btn-ghost">+ Add</button>
        </div>
        ${c.weapons.length ? `
          <table class="equip-table">
            <thead><tr><th>Name</th><th>Damage</th><th>Atk Mod</th><th>Notes</th><th></th></tr></thead>
            <tbody>
              ${c.weapons.map(w => `
                <tr data-equip-id="${w.id}" data-equip-type="weapon">
                  <td><input type="text" class="input-main equip-field" value="${this._esc(w.name)}"
                    data-id="${w.id}" data-type="weapon" data-f="name" aria-label="Weapon name"></td>
                  <td><input type="text" class="input-sm equip-field"  value="${this._esc(w.damage)}"
                    data-id="${w.id}" data-type="weapon" data-f="damage" placeholder="1d8" aria-label="Damage dice"></td>
                  <td><input type="number" class="input-sm equip-field" value="${w.attackMod}"
                    data-id="${w.id}" data-type="weapon" data-f="attackMod" aria-label="Attack modifier"></td>
                  <td><input type="text" class="input-main equip-field" value="${this._esc(w.notes)}"
                    data-id="${w.id}" data-type="weapon" data-f="notes" placeholder="Notes" aria-label="Notes"></td>
                  <td><button class="btn-icon remove-equip-btn" data-id="${w.id}" data-type="weapon">✕</button></td>
                </tr>`).join('')}
            </tbody>
          </table>` : '<p class="empty-msg-sm">No weapons.</p>'}
      </div>

      <!-- Armour -->
      <div class="equip-section">
        <div class="equip-section-header">
          <h3>Armour</h3>
          <button id="add-armor-btn" class="btn-ghost">+ Add</button>
        </div>
        ${c.armor.length ? `
          <table class="equip-table">
            <thead><tr><th>Name</th><th>AC Bonus</th><th>Notes</th><th></th></tr></thead>
            <tbody>
              ${c.armor.map(a => `
                <tr data-equip-id="${a.id}" data-equip-type="armor">
                  <td><input type="text" class="input-main equip-field" value="${this._esc(a.name)}"
                    data-id="${a.id}" data-type="armor" data-f="name" aria-label="Armour name"></td>
                  <td><input type="number" class="input-sm equip-field" value="${a.acBonus}"
                    data-id="${a.id}" data-type="armor" data-f="acBonus" aria-label="AC bonus"></td>
                  <td><input type="text" class="input-main equip-field" value="${this._esc(a.notes)}"
                    data-id="${a.id}" data-type="armor" data-f="notes" placeholder="Notes" aria-label="Notes"></td>
                  <td><button class="btn-icon remove-equip-btn" data-id="${a.id}" data-type="armor">✕</button></td>
                </tr>`).join('')}
            </tbody>
          </table>` : '<p class="empty-msg-sm">No armour.</p>'}
      </div>

      <!-- Other Equipment -->
      <div class="equip-section">
        <div class="equip-section-header">
          <h3>Other Equipment</h3>
          <button id="add-equip-btn" class="btn-ghost">+ Add</button>
        </div>
        ${c.equipment.length ? `
          <table class="equip-table">
            <thead><tr><th>Item</th><th>Notes</th><th></th></tr></thead>
            <tbody>
              ${c.equipment.map(e => `
                <tr data-equip-id="${e.id}" data-equip-type="equip">
                  <td><input type="text" class="input-main equip-field" value="${this._esc(e.name)}"
                    data-id="${e.id}" data-type="equip" data-f="name" aria-label="Item name"></td>
                  <td><input type="text" class="input-main equip-field" value="${this._esc(e.notes)}"
                    data-id="${e.id}" data-type="equip" data-f="notes" placeholder="Notes" aria-label="Notes"></td>
                  <td><button class="btn-icon remove-equip-btn" data-id="${e.id}" data-type="equip">✕</button></td>
                </tr>`).join('')}
            </tbody>
          </table>` : '<p class="empty-msg-sm">No other equipment.</p>'}
      </div>
    `;

    this._attachEquipEvents();
  },

  /* ─── Event binding ─────────────────────────────────────────────── */

  _attachCharEvents() {
    /* Character selector */
    document.getElementById('char-select')?.addEventListener('change', e => {
      this.selectCharacter(parseInt(e.target.value, 10));
    });
    document.getElementById('char-new-btn')?.addEventListener('click', () => this.createCharacter());
    document.getElementById('char-delete-btn')?.addEventListener('click', () => this.deleteCharacter());

    /* Save button */
    document.getElementById('char-save-btn')?.addEventListener('click', () => this._collectAndSave());

    /* Word selector: show custom input when "(Custom)" is chosen */
    document.getElementById('add-word-select')?.addEventListener('change', e => {
      const custom = document.getElementById('add-word-custom');
      if (custom) custom.style.display = e.target.value === '(Custom)' ? '' : 'none';
    });

    document.getElementById('add-word-btn')?.addEventListener('click', () => {
      const sel    = document.getElementById('add-word-select').value;
      const custom = document.getElementById('add-word-custom').value.trim();
      const name   = sel === '(Custom)' ? custom : sel;
      if (!name) { GoApp.toast('Choose or type a Word name', 'error'); return; }
      this.addWord(name);
      document.getElementById('add-word-select').value = '';
      if (document.getElementById('add-word-custom')) {
        document.getElementById('add-word-custom').value = '';
        document.getElementById('add-word-custom').style.display = 'none';
      }
    });
  },

  _attachWordEvents() {
    document.querySelectorAll('.remove-word-btn').forEach(btn =>
      btn.addEventListener('click', () => {
        if (confirm('Remove this Word?')) this.removeWord(btn.dataset.wordId);
      }));

    document.querySelectorAll('.add-gift-btn').forEach(btn =>
      btn.addEventListener('click', () => {
        const inp = document.querySelector(`.gift-name-input[data-word-id="${btn.dataset.wordId}"]`);
        if (inp) { this.addGift(btn.dataset.wordId, inp.value); inp.value = ''; }
      }));

    document.querySelectorAll('.gift-name-input').forEach(inp =>
      inp.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          this.addGift(inp.dataset.wordId, inp.value);
          inp.value = '';
        }
      }));

    document.querySelectorAll('.remove-gift-btn').forEach(btn =>
      btn.addEventListener('click', () => this.removeGift(btn.dataset.wordId, btn.dataset.giftId)));

    document.querySelectorAll('.gift-toggle-btn').forEach(btn =>
      btn.addEventListener('click', () => this.toggleGift(btn.dataset.wordId, btn.dataset.giftId)));

    /* In-place gift field editing */
    document.querySelectorAll('.gift-field').forEach(inp => {
      inp.addEventListener('change', () => {
        const word = this.char.words.find(w => w.id === inp.dataset.wordId);
        if (!word) return;
        const gift = word.gifts.find(g => g.id === inp.dataset.giftId);
        if (!gift) return;
        gift[inp.dataset.giftField] = inp.value;
        this._save();
      });
    });
  },

  _attachEquipEvents() {
    document.getElementById('add-weapon-btn')?.addEventListener('click', () => this.addWeapon());
    document.getElementById('add-armor-btn')?.addEventListener('click',  () => this.addArmor());
    document.getElementById('add-equip-btn')?.addEventListener('click',  () => this.addEquipItem());

    document.querySelectorAll('.remove-equip-btn').forEach(btn =>
      btn.addEventListener('click', () => {
        const type = btn.dataset.type;
        if (type === 'weapon') this.removeWeapon(btn.dataset.id);
        else if (type === 'armor') this.removeArmor(btn.dataset.id);
        else this.removeEquipItem(btn.dataset.id);
      }));

    document.querySelectorAll('.equip-field').forEach(inp =>
      inp.addEventListener('change', () => {
        const list = inp.dataset.type === 'weapon' ? this.char.weapons
                   : inp.dataset.type === 'armor'  ? this.char.armor
                   : this.char.equipment;
        const item = list.find(x => x.id === inp.dataset.id);
        if (!item) return;
        const val = inp.type === 'number' ? (parseInt(inp.value, 10) || 0) : inp.value;
        item[inp.dataset.f] = val;
        this._save();
      }));
  },

  /* ─── Collect form values and save ─────────────────────────────── */

  _collectAndSave() {
    const c = this.char;

    /* Text / number fields */
    const fieldMap = {
      'name':             v => c.name              = v,
      'level':            v => { c.level = parseInt(v,10)||1; },
      'background':       v => c.background        = v,
      'hp-current':       v => c.hp.current        = parseInt(v,10)||0,
      'hp-max':           v => c.hp.max            = parseInt(v,10)||1,
      'ac':               v => c.ac                = parseInt(v,10)||10,
      'attack-bonus':     v => c.attackBonus       = parseInt(v,10)||0,
      'save-hardiness':   v => c.saves.hardiness   = parseInt(v,10)||15,
      'save-evasion':     v => c.saves.evasion     = parseInt(v,10)||15,
      'save-spirit':      v => c.saves.spirit      = parseInt(v,10)||15,
      'effort-total':     v => c.effort.total      = parseInt(v,10)||0,
      'effort-day':       v => c.effort.committedDay   = parseInt(v,10)||0,
      'effort-scene':     v => c.effort.committedScene = parseInt(v,10)||0,
      'dominion':         v => c.dominion.total    = parseInt(v,10)||0,
      'influence-current':v => c.influence.current = parseInt(v,10)||0,
      'influence-max':    v => c.influence.max     = parseInt(v,10)||0,
      'notes':            v => c.notes             = v,
    };

    document.querySelectorAll('[data-field]').forEach(el => {
      const field  = el.dataset.field;
      const value  = el.value;

      if (field.startsWith('attr-')) {
        const attr = field.slice(5);
        c.attributes[attr] = parseInt(value, 10) || 10;
      } else if (fieldMap[field]) {
        fieldMap[field](value);
      }
    });

    this._save();

    /* Refresh fray dice display and attr mods */
    document.querySelectorAll('.attr-block').forEach(block => {
      const inp  = block.querySelector('[data-field]');
      if (!inp) return;
      const attr = inp.dataset.field.slice(5);
      const mod  = GoUtils.getAttrMod(c.attributes[attr]);
      const modEl = block.querySelector('.attr-mod');
      if (modEl) {
        modEl.textContent = GoUtils.formatMod(mod);
        modEl.className   = `attr-mod ${mod >= 0 ? 'mod-pos' : 'mod-neg'}`;
      }
    });

    const frayEl = document.querySelector('[data-field="level"]');
    if (frayEl) {
      const badge = document.querySelector('.fray-badge');
      if (badge) badge.textContent = GoUtils.getFrayDice(c.level);
    }

    /* Update char selector label */
    const sel = document.getElementById('char-select');
    if (sel) sel.options[this.activeIdx].text = c.name;

    /* Effort available */
    const avail = document.querySelector('.effort-avail');
    if (avail) avail.textContent = c.effort.total - c.effort.committedDay - c.effort.committedScene;

    const status = document.getElementById('save-status');
    if (status) {
      status.textContent = '✓ Saved';
      setTimeout(() => { status.textContent = ''; }, 2000);
    }

    GoApp.toast(`${c.name} saved!`, 'success');
  },

  /* ─── Helpers ───────────────────────────────────────────────────── */

  _esc(str) {
    return String(str ?? '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
};
