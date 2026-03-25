'use strict';

/**
 * Dice Roller module.
 * Handles all dice-related UI: quick dice, custom notation,
 * attack rolls, saving throws, fray dice and roll history.
 */
const GoDice = {

  MAX_HISTORY: 50,
  history: [],

  /* ─── Init ──────────────────────────────────────────────────────── */

  init() {
    this.history = GoStorage.loadDiceHistory();
    this.render();
  },

  /* ─── Core roll helpers ─────────────────────────────────────────── */

  _addHistory(entry) {
    this.history.unshift(entry);
    if (this.history.length > this.MAX_HISTORY) this.history.pop();
    GoStorage.saveDiceHistory(this.history);
    this._renderHistory();
    this._showResult(entry);
  },

  rollDice(count, sides, modifier, label) {
    const rolls   = GoUtils.rollDice(count, sides);
    const total   = rolls.reduce((a, b) => a + b, 0) + modifier;
    const modStr  = modifier !== 0 ? GoUtils.formatMod(modifier) : '';
    this._addHistory({
      label: label || `${count}d${sides}${modStr}`,
      rolls, modifier, total,
      ts: new Date().toLocaleTimeString()
    });
  },

  rollAttack(attackBonus, targetAC) {
    const d20     = GoUtils.rollDie(20);
    const total   = d20 + attackBonus;
    const hit     = total >= targetAC;
    this._addHistory({
      label:    `Attack (d20${GoUtils.formatMod(attackBonus)} vs AC ${targetAC})`,
      rolls:    [d20],
      modifier: attackBonus,
      total,
      hit,
      critical: d20 === 20,
      fumble:   d20 === 1,
      ts: new Date().toLocaleTimeString()
    });
  },

  rollSave(saveTarget, saveName) {
    const d20     = GoUtils.rollDie(20);
    const success = d20 >= saveTarget;
    this._addHistory({
      label:    `${saveName} Save (need ${saveTarget}+)`,
      rolls:    [d20],
      modifier: 0,
      total:    d20,
      success,
      ts: new Date().toLocaleTimeString()
    });
  },

  rollFray(level, bonusDice) {
    const notation = GoUtils.getFrayDice(level);
    const parsed   = GoUtils.parseDiceNotation(notation);
    if (!parsed) return;
    const rolls  = GoUtils.rollDice(parsed.count, parsed.sides);
    let   total  = rolls.reduce((a, b) => a + b, 0);
    let   allRolls = [...rolls];
    let   label    = `Fray Dice Lv${level} (${notation})`;

    if (bonusDice) {
      const bonusParsed = GoUtils.parseDiceNotation(bonusDice);
      if (bonusParsed) {
        const bonusRolls = GoUtils.rollDice(bonusParsed.count, bonusParsed.sides);
        total    += bonusRolls.reduce((a, b) => a + b, 0);
        allRolls  = [...allRolls, ...bonusRolls];
        label     = `Fray Dice Lv${level} (${notation} + ${bonusDice})`;
      }
    }

    this._addHistory({
      label, rolls: allRolls, modifier: 0, total,
      ts: new Date().toLocaleTimeString()
    });
  },

  /* ─── Render ────────────────────────────────────────────────────── */

  render() {
    const el = document.getElementById('dice-tab');
    if (!el) return;

    el.innerHTML = `
      <div class="panel-grid">

        <!-- Quick Dice -->
        <div class="card">
          <h2 class="card-title">Quick Dice</h2>
          <div class="quick-dice-grid">
            ${[4,6,8,10,12,20,100].map(d =>
              `<button class="die-btn" data-sides="${d}" aria-label="Roll d${d}">d${d}</button>`
            ).join('')}
          </div>
          <div class="form-row mt-sm">
            <label class="form-label">Dice
              <input id="quick-count" type="number" class="input-sm" value="1" min="1" max="20">
            </label>
            <label class="form-label">Modifier
              <input id="quick-mod" type="number" class="input-sm" value="0">
            </label>
          </div>
        </div>

        <!-- Custom Notation -->
        <div class="card">
          <h2 class="card-title">Custom Roll</h2>
          <div class="input-row">
            <input id="custom-notation" type="text" class="input-main"
              placeholder="e.g. 2d6+3 or d20-1" aria-label="Dice notation">
            <button id="custom-roll-btn" class="btn-primary">Roll</button>
          </div>
        </div>

        <!-- Attack Roll -->
        <div class="card">
          <h2 class="card-title">Attack Roll</h2>
          <div class="form-row">
            <label class="form-label">Attack Bonus
              <input id="attack-bonus" type="number" class="input-sm" value="2">
            </label>
            <label class="form-label">Target AC
              <input id="target-ac" type="number" class="input-sm" value="10">
            </label>
            <button id="attack-roll-btn" class="btn-primary self-end">Roll Attack</button>
          </div>
        </div>

        <!-- Saving Throw -->
        <div class="card">
          <h2 class="card-title">Saving Throw</h2>
          <div class="form-row">
            <label class="form-label">Save Type
              <select id="save-type" class="input-sm">
                <option value="Hardiness">Hardiness</option>
                <option value="Evasion">Evasion</option>
                <option value="Spirit">Spirit</option>
              </select>
            </label>
            <label class="form-label">Target Number
              <input id="save-target" type="number" class="input-sm" value="15" min="1" max="20">
            </label>
            <button id="save-roll-btn" class="btn-primary self-end">Roll Save</button>
          </div>
        </div>

        <!-- Fray Dice -->
        <div class="card">
          <h2 class="card-title">Fray Dice</h2>
          <p class="card-note">Free damage die against mooks each round.</p>
          <div class="form-row">
            <label class="form-label">Character Level
              <input id="fray-level" type="number" class="input-sm" value="1" min="1" max="30">
            </label>
            <label class="form-label">Bonus Dice
              <select id="fray-bonus-dice" class="input-sm">
                <option value="">None</option>
                ${[4,6,8,10,12].flatMap(s => Array.from({length:10},(_,i)=>`${i+1}d${s}`)).map(d => `<option value="${d}">${d}</option>`).join('')}
              </select>
            </label>
            <span id="fray-notation" class="fray-badge">1d6</span>
            <button id="fray-roll-btn" class="btn-primary self-end">Roll Fray</button>
          </div>
        </div>

      </div><!-- /panel-grid -->

      <!-- Result Display -->
      <div id="roll-result" class="roll-result hidden" role="status" aria-live="polite"></div>

      <!-- Roll History -->
      <div class="card mt-md">
        <div class="card-header">
          <h2 class="card-title">Roll History</h2>
          <button id="clear-history-btn" class="btn-ghost">Clear</button>
        </div>
        <div id="dice-history" class="dice-history"></div>
      </div>
    `;

    this._attachEvents();
    this._renderHistory();
  },

  /* ─── Internal helpers ──────────────────────────────────────────── */

  _showResult(entry) {
    const el = document.getElementById('roll-result');
    if (!el) return;

    let cls = 'roll-result';
    let badge = '';

    if (entry.critical)      { cls += ' critical'; badge = '<span class="result-badge badge-crit">⚡ CRITICAL HIT</span>'; }
    else if (entry.fumble)   { cls += ' fumble';   badge = '<span class="result-badge badge-fumble">💀 FUMBLE</span>'; }
    else if (entry.hit === true)  { cls += ' success';  badge = '<span class="result-badge badge-hit">✅ HIT</span>'; }
    else if (entry.hit === false) { cls += ' failure';  badge = '<span class="result-badge badge-miss">❌ MISS</span>'; }
    else if (entry.success === true)  { cls += ' success'; badge = '<span class="result-badge badge-hit">✅ SUCCESS</span>'; }
    else if (entry.success === false) { cls += ' failure'; badge = '<span class="result-badge badge-miss">❌ FAILED</span>'; }

    const modStr = entry.modifier !== 0 ? ` ${GoUtils.formatMod(entry.modifier)}` : '';

    el.className = cls;
    el.innerHTML = `
      <div class="result-label">${entry.label}</div>
      <div class="result-total">${entry.total}</div>
      <div class="result-breakdown">[${entry.rolls.join(' + ')}]${modStr}</div>
      ${badge}
    `;
    el.classList.remove('hidden');
  },

  _renderHistory() {
    const el = document.getElementById('dice-history');
    if (!el) return;

    if (!this.history.length) {
      el.innerHTML = '<p class="empty-msg">No rolls yet — pick a die above!</p>';
      return;
    }

    el.innerHTML = this.history.map(entry => {
      let rowCls = 'history-row';
      let tag    = '';

      if (entry.critical)      { rowCls += ' critical'; tag = '<span class="tag tag-crit">CRIT</span>'; }
      else if (entry.fumble)   { rowCls += ' fumble';   tag = '<span class="tag tag-fumble">FUMBLE</span>'; }
      else if (entry.hit === true)  { rowCls += ' success';  tag = '<span class="tag tag-hit">HIT</span>'; }
      else if (entry.hit === false) { rowCls += ' failure';  tag = '<span class="tag tag-miss">MISS</span>'; }
      else if (entry.success === true)  { rowCls += ' success'; tag = '<span class="tag tag-hit">PASS</span>'; }
      else if (entry.success === false) { rowCls += ' failure'; tag = '<span class="tag tag-miss">FAIL</span>'; }

      const modStr = entry.modifier !== 0 ? ` ${GoUtils.formatMod(entry.modifier)}` : '';

      return `
        <div class="${rowCls}">
          <span class="h-label">${entry.label}</span>
          <span class="h-rolls">[${entry.rolls.join(', ')}]${modStr}</span>
          <span class="h-total">${entry.total}</span>
          ${tag}
          <span class="h-time">${entry.ts}</span>
        </div>`;
    }).join('');
  },

  _attachEvents() {
    /* Quick dice */
    document.querySelectorAll('.die-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const sides = parseInt(btn.dataset.sides, 10);
        const count = parseInt(document.getElementById('quick-count').value, 10) || 1;
        const mod   = parseInt(document.getElementById('quick-mod').value,   10) || 0;
        this.rollDice(count, sides, mod);
      });
    });

    /* Custom roll */
    const customBtn = document.getElementById('custom-roll-btn');
    const customIn  = document.getElementById('custom-notation');
    customBtn?.addEventListener('click', () => {
      const parsed = GoUtils.parseDiceNotation(customIn.value);
      if (!parsed) { GoApp.toast('Invalid notation – try "2d6+3" or "d20"', 'error'); return; }
      this.rollDice(parsed.count, parsed.sides, parsed.modifier);
    });
    customIn?.addEventListener('keydown', e => { if (e.key === 'Enter') customBtn?.click(); });

    /* Attack roll */
    document.getElementById('attack-roll-btn')?.addEventListener('click', () => {
      const bonus = parseInt(document.getElementById('attack-bonus').value, 10) || 0;
      const ac    = parseInt(document.getElementById('target-ac').value,    10) || 10;
      this.rollAttack(bonus, ac);
    });

    /* Saving throw */
    document.getElementById('save-roll-btn')?.addEventListener('click', () => {
      const type   = document.getElementById('save-type').value;
      const target = parseInt(document.getElementById('save-target').value, 10) || 15;
      this.rollSave(target, type);
    });

    /* Fray dice – update notation label on level or bonus change */
    document.getElementById('fray-level')?.addEventListener('input', e => {
      const lvl   = parseInt(e.target.value, 10) || 1;
      const bonus = document.getElementById('fray-bonus-dice')?.value || '';
      document.getElementById('fray-notation').textContent = GoUtils.getFrayDiceDisplay(lvl, bonus);
    });
    document.getElementById('fray-bonus-dice')?.addEventListener('change', e => {
      const lvl = parseInt(document.getElementById('fray-level').value, 10) || 1;
      document.getElementById('fray-notation').textContent = GoUtils.getFrayDiceDisplay(lvl, e.target.value);
    });
    document.getElementById('fray-roll-btn')?.addEventListener('click', () => {
      const lvl   = parseInt(document.getElementById('fray-level').value, 10) || 1;
      const bonus = document.getElementById('fray-bonus-dice')?.value || '';
      this.rollFray(lvl, bonus);
    });

    /* Clear history */
    document.getElementById('clear-history-btn')?.addEventListener('click', () => {
      this.history = [];
      GoStorage.saveDiceHistory(this.history);
      this._renderHistory();
      const res = document.getElementById('roll-result');
      if (res) res.classList.add('hidden');
    });
  }
};
