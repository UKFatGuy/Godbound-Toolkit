'use strict';

/**
 * Combat Tracker module.
 * Manages initiative order, HP, effort, status effects and round counting.
 */
const GoCombat = {

  state: null,

  _defaultState() {
    return { active: false, round: 1, currentIndex: 0, combatants: [] };
  },

  /* ─── Init ──────────────────────────────────────────────────────── */

  init() {
    this.state = GoStorage.loadCombat() || this._defaultState();
    this.render();
  },

  _save() { GoStorage.saveCombat(this.state); },

  /* ─── Combatant operations ──────────────────────────────────────── */

  addCombatant(data) {
    const hpMax = parseInt(data.hpMax, 10) || 10;
    const c = {
      id:           GoUtils.uid(),
      name:         (data.name || 'Unknown').trim(),
      initiative:   parseInt(data.initiative, 10) || 0,
      hp:           { max: hpMax, current: hpMax },
      ac:           parseInt(data.ac, 10) || 10,
      isPC:         !!data.isPC,
      effort:       parseInt(data.effort, 10) || 0,
      effortUsed:   0,
      statusEffects:[],
      notes:        ''
    };
    this.state.combatants.push(c);
    this._sortByInitiative();
    this._save();
    this._renderCombatants();
  },

  removeCombatant(id) {
    const idx = this.state.combatants.findIndex(c => c.id === id);
    if (idx === -1) return;
    this.state.combatants.splice(idx, 1);
    if (this.state.currentIndex >= this.state.combatants.length) {
      this.state.currentIndex = Math.max(0, this.state.combatants.length - 1);
    }
    this._save();
    this._renderCombatants();
  },

  _sortByInitiative() {
    this.state.combatants.sort((a, b) => b.initiative - a.initiative);
  },

  /* ─── Round / turn flow ─────────────────────────────────────────── */

  rollInitiativeAll() {
    this.state.combatants.forEach(c => { c.initiative = GoUtils.rollDie(20); });
    this._sortByInitiative();
    this.state.currentIndex = 0;
    this._save();
    this._renderCombatants();
    GoApp.toast('Initiative rolled for all!', 'success');
  },

  startCombat() {
    if (!this.state.combatants.length) { GoApp.toast('Add combatants first', 'error'); return; }
    this.state.active       = true;
    this.state.round        = 1;
    this.state.currentIndex = 0;
    this._save();
    this._renderCombatants();
    this._updateControls();
    GoApp.toast('Combat started! Round 1', 'success');
  },

  endCombat() {
    this.state.active = false;
    this._save();
    this._renderCombatants();
    this._updateControls();
    GoApp.toast('Combat ended', 'info');
  },

  nextTurn() {
    if (!this.state.active || !this.state.combatants.length) return;
    this.state.currentIndex = (this.state.currentIndex + 1) % this.state.combatants.length;
    if (this.state.currentIndex === 0) this.state.round++;
    this._save();
    this._renderCombatants();
    this._updateControls();
  },

  prevTurn() {
    if (!this.state.active || !this.state.combatants.length) return;
    if (this.state.currentIndex === 0) {
      if (this.state.round > 1) {
        this.state.round--;
        this.state.currentIndex = this.state.combatants.length - 1;
      }
    } else {
      this.state.currentIndex--;
    }
    this._save();
    this._renderCombatants();
    this._updateControls();
  },

  /* ─── HP / Effort ───────────────────────────────────────────────── */

  modifyHP(id, delta) {
    const c = this._find(id);
    if (!c) return;
    c.hp.current = GoUtils.clamp(c.hp.current + delta, 0, c.hp.max);
    this._save();
    this._refreshRow(id);
  },

  setHP(id, value) {
    const c = this._find(id);
    if (!c) return;
    c.hp.current = GoUtils.clamp(parseInt(value, 10) || 0, 0, c.hp.max);
    this._save();
    this._refreshRow(id);
  },

  setMaxHP(id, value) {
    const c = this._find(id);
    if (!c) return;
    c.hp.max     = Math.max(1, parseInt(value, 10) || 1);
    c.hp.current = GoUtils.clamp(c.hp.current, 0, c.hp.max);
    this._save();
    this._refreshRow(id);
  },

  modifyEffort(id, delta) {
    const c = this._find(id);
    if (!c || !c.isPC) return;
    c.effortUsed = GoUtils.clamp(c.effortUsed + delta, 0, c.effort);
    this._save();
    this._refreshRow(id);
  },

  addStatus(id, status) {
    const c = this._find(id);
    if (!c || !status.trim()) return;
    if (!c.statusEffects.includes(status.trim())) {
      c.statusEffects.push(status.trim());
      this._save();
      this._refreshRow(id);
    }
  },

  removeStatus(id, status) {
    const c = this._find(id);
    if (!c) return;
    c.statusEffects = c.statusEffects.filter(s => s !== status);
    this._save();
    this._refreshRow(id);
  },

  resetCombat() {
    if (!confirm('Reset combat? This will clear all combatants.')) return;
    this.state = this._defaultState();
    this._save();
    this.render();
  },

  _find(id) { return this.state.combatants.find(c => c.id === id) || null; },

  /* ─── Render ────────────────────────────────────────────────────── */

  render() {
    const el = document.getElementById('combat-tab');
    if (!el) return;

    el.innerHTML = `
      <!-- Controls -->
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">
            Combat Tracker
            <span id="round-display" class="round-badge"></span>
          </h2>
          <div class="btn-group">
            <button id="roll-all-init-btn" class="btn-secondary" title="Roll d20 initiative for everyone">🎲 Roll Initiative</button>
            <button id="start-combat-btn" class="btn-primary">▶ Start</button>
            <button id="end-combat-btn"   class="btn-ghost">■ End</button>
            <button id="prev-turn-btn"    class="btn-ghost" disabled>◀ Prev</button>
            <button id="next-turn-btn"    class="btn-primary" disabled>Next ▶</button>
            <button id="reset-combat-btn" class="btn-danger">Reset</button>
          </div>
        </div>
      </div>

      <!-- Add Combatant Form -->
      <div class="card">
        <h2 class="card-title">Add Combatant</h2>
        <div class="add-combatant-form">
          <input  id="c-name"  type="text"   class="input-main" placeholder="Name">
          <input  id="c-init"  type="number" class="input-sm"   placeholder="Initiative" title="Initiative">
          <input  id="c-hp"    type="number" class="input-sm"   placeholder="Max HP"     title="Max HP" min="1">
          <input  id="c-ac"    type="number" class="input-sm"   placeholder="AC"         title="AC" min="0">
          <input  id="c-effort"type="number" class="input-sm"   placeholder="Effort"     title="Effort (PC only)" min="0">
          <label  class="checkbox-label">
            <input id="c-ispc" type="checkbox"> PC
          </label>
          <button id="add-combatant-btn" class="btn-primary">Add</button>
        </div>
      </div>

      <!-- Combatant List -->
      <div id="combatant-list" class="combatant-list"></div>
    `;

    this._attachCombatEvents();
    this._renderCombatants();
    this._updateControls();
  },

  _renderCombatants() {
    const el = document.getElementById('combatant-list');
    if (!el) return;

    if (!this.state.combatants.length) {
      el.innerHTML = '<p class="empty-msg">No combatants yet — add some above.</p>';
      return;
    }

    el.innerHTML = this.state.combatants.map((c, i) =>
      this._combatantHTML(c, i)
    ).join('');

    this._attachRowEvents();
    this._updateControls();
  },

  _combatantHTML(c, i) {
    const isCurrent   = this.state.active && i === this.state.currentIndex;
    const hpPct       = c.hp.max > 0 ? (c.hp.current / c.hp.max) * 100 : 0;
    const hpClass     = hpPct > 50 ? 'hp-good' : hpPct > 25 ? 'hp-warn' : 'hp-danger';
    const dead        = c.hp.current === 0;
    const rowClass    = `combatant-row ${isCurrent ? 'active-turn' : ''} ${dead ? 'dead' : ''}`;

    const effortPips  = c.isPC && c.effort > 0
      ? `<div class="effort-pips" title="Effort (click to toggle used)">
           ${Array.from({length: c.effort}, (_, ei) =>
             `<span class="pip ${ei < c.effortUsed ? 'pip-used' : 'pip-free'}"
               data-id="${c.id}" data-idx="${ei}"></span>`
           ).join('')}
         </div>`
      : '';

    const statuses = c.statusEffects.length
      ? `<div class="status-tags">${c.statusEffects.map(s =>
          `<span class="status-tag">${s}<button class="tag-remove" data-id="${c.id}" data-status="${s}">×</button></span>`
        ).join('')}</div>`
      : '';

    return `
      <div class="${rowClass}" data-id="${c.id}">
        <div class="c-header">
          <span class="c-init-badge" title="Initiative">${c.initiative}</span>
          <span class="c-name">${c.name}${c.isPC ? ' <span class="pc-badge">PC</span>' : ''}</span>
          <span class="c-ac" title="Armour Class">AC ${c.ac}</span>
          ${isCurrent ? '<span class="turn-arrow">▶ Acting</span>' : ''}
          <button class="btn-icon btn-remove" data-id="${c.id}" title="Remove combatant">✕</button>
        </div>

        <div class="c-body">
          <!-- HP bar -->
          <div class="hp-section">
            <span class="hp-label">HP</span>
            <div class="hp-bar-wrap">
              <div class="hp-bar ${hpClass}" style="width:${hpPct}%"></div>
            </div>
            <button class="btn-icon" data-action="hp-dec" data-id="${c.id}" title="-1 HP">−</button>
            <input type="number" class="hp-input" value="${c.hp.current}" min="0" max="${c.hp.max}"
              data-id="${c.id}" data-field="hp-cur" title="Current HP">
            <span class="hp-sep">/</span>
            <input type="number" class="hp-input" value="${c.hp.max}" min="1"
              data-id="${c.id}" data-field="hp-max" title="Max HP">
            <button class="btn-icon" data-action="hp-inc" data-id="${c.id}" title="+1 HP">+</button>
          </div>

          <!-- Effort (PC only) -->
          ${c.isPC ? `
          <div class="effort-section">
            <span class="effort-label">Effort</span>
            ${effortPips}
            <button class="btn-icon" data-action="eff-dec" data-id="${c.id}" title="Recover 1 Effort">−</button>
            <span class="effort-count">${c.effortUsed}/${c.effort}</span>
            <button class="btn-icon" data-action="eff-inc" data-id="${c.id}" title="Use 1 Effort">+</button>
          </div>` : ''}

          <!-- Status Effects -->
          <div class="status-section">
            ${statuses}
            <div class="status-add">
              <input type="text" class="input-sm status-input" placeholder="Add status…"
                data-id="${c.id}" maxlength="30">
              <button class="btn-ghost status-add-btn" data-id="${c.id}">+</button>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  _refreshRow(id) {
    const el = document.querySelector(`.combatant-row[data-id="${id}"]`);
    if (!el) return;
    const idx = this.state.combatants.findIndex(c => c.id === id);
    if (idx === -1) return;
    el.outerHTML = this._combatantHTML(this.state.combatants[idx], idx);
    this._attachRowEvents();
  },

  _updateControls() {
    const active = this.state.active;
    const hasCombatants = this.state.combatants.length > 0;

    const set = (id, prop, val) => {
      const el = document.getElementById(id);
      if (el) el[prop] = val;
    };
    set('start-combat-btn', 'disabled', active || !hasCombatants);
    set('end-combat-btn',   'disabled', !active);
    set('prev-turn-btn',    'disabled', !active || !hasCombatants);
    set('next-turn-btn',    'disabled', !active || !hasCombatants);

    const roundEl = document.getElementById('round-display');
    if (roundEl) roundEl.textContent = active ? `Round ${this.state.round}` : '';
  },

  /* ─── Event binding ─────────────────────────────────────────────── */

  _attachCombatEvents() {
    document.getElementById('add-combatant-btn')?.addEventListener('click', () => {
      const name = document.getElementById('c-name').value.trim();
      if (!name) { GoApp.toast('Combatant needs a name', 'error'); return; }
      this.addCombatant({
        name,
        initiative: document.getElementById('c-init').value,
        hpMax:      document.getElementById('c-hp').value   || 10,
        ac:         document.getElementById('c-ac').value   || 10,
        effort:     document.getElementById('c-effort').value || 0,
        isPC:       document.getElementById('c-ispc').checked
      });
      ['c-name','c-init','c-hp','c-ac','c-effort'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      document.getElementById('c-ispc').checked = false;
    });

    document.getElementById('c-name')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('add-combatant-btn')?.click();
    });

    document.getElementById('roll-all-init-btn')?.addEventListener('click', () => this.rollInitiativeAll());
    document.getElementById('start-combat-btn')?.addEventListener('click', () => this.startCombat());
    document.getElementById('end-combat-btn')?.addEventListener('click',   () => this.endCombat());
    document.getElementById('next-turn-btn')?.addEventListener('click',    () => this.nextTurn());
    document.getElementById('prev-turn-btn')?.addEventListener('click',    () => this.prevTurn());
    document.getElementById('reset-combat-btn')?.addEventListener('click', () => this.resetCombat());
  },

  _attachRowEvents() {
    /* HP buttons */
    document.querySelectorAll('[data-action="hp-dec"]').forEach(btn =>
      btn.addEventListener('click', () => this.modifyHP(btn.dataset.id, -1)));
    document.querySelectorAll('[data-action="hp-inc"]').forEach(btn =>
      btn.addEventListener('click', () => this.modifyHP(btn.dataset.id, +1)));

    /* HP inputs */
    document.querySelectorAll('[data-field="hp-cur"]').forEach(inp =>
      inp.addEventListener('change', () => this.setHP(inp.dataset.id, inp.value)));
    document.querySelectorAll('[data-field="hp-max"]').forEach(inp =>
      inp.addEventListener('change', () => this.setMaxHP(inp.dataset.id, inp.value)));

    /* Effort buttons */
    document.querySelectorAll('[data-action="eff-inc"]').forEach(btn =>
      btn.addEventListener('click', () => this.modifyEffort(btn.dataset.id, +1)));
    document.querySelectorAll('[data-action="eff-dec"]').forEach(btn =>
      btn.addEventListener('click', () => this.modifyEffort(btn.dataset.id, -1)));

    /* Effort pip toggle */
    document.querySelectorAll('.pip').forEach(pip =>
      pip.addEventListener('click', () => {
        const c = this._find(pip.dataset.id);
        if (!c) return;
        const idx = parseInt(pip.dataset.idx, 10);
        c.effortUsed = idx < c.effortUsed ? idx : idx + 1;
        c.effortUsed = GoUtils.clamp(c.effortUsed, 0, c.effort);
        this._save();
        this._refreshRow(pip.dataset.id);
      }));

    /* Status add */
    document.querySelectorAll('.status-add-btn').forEach(btn =>
      btn.addEventListener('click', () => {
        const inp = document.querySelector(`.status-input[data-id="${btn.dataset.id}"]`);
        if (inp) { this.addStatus(btn.dataset.id, inp.value); inp.value = ''; }
      }));
    document.querySelectorAll('.status-input').forEach(inp =>
      inp.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          this.addStatus(inp.dataset.id, inp.value);
          inp.value = '';
        }
      }));

    /* Status remove */
    document.querySelectorAll('.tag-remove').forEach(btn =>
      btn.addEventListener('click', () => this.removeStatus(btn.dataset.id, btn.dataset.status)));

    /* Remove combatant */
    document.querySelectorAll('.btn-remove').forEach(btn =>
      btn.addEventListener('click', () => {
        if (confirm(`Remove ${this._find(btn.dataset.id)?.name || 'combatant'}?`))
          this.removeCombatant(btn.dataset.id);
      }));
  }
};
