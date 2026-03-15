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
      id:           GoUtils.uid(),
      name,
      level:        1,
      background:   '',
      goal:         '',
      description:  '',
      experience:   0,
      origin:       '',
      career:       '',
      relationship: '',
      levelFacts:   {},

      attributes:  { str: 10, con: 10, dex: 10, int: 10, wis: 10, cha: 10 },
      attrBonuses: { str: 0,  con: 0,  dex: 0,  int: 0,  wis: 0,  cha: 0  },

      hp:          { max: 8, current: 8, bonus: 0 },
      ac:          10,
      attackBonus: 2,

      saves: { hardiness: 15, evasion: 15, spirit: 15 },

      effort:    { total: 2, committedDay: 0, committedScene: 0 },
      dominion:  { total: 0 },
      influence: { max: 0, current: 0 },
      wealth:    { total: 0, free: 0 },

      apotheosis: {},

      cult: {
        name: '', demand: 0, power: 0, cohesion: 0,
        actionDie: '', trouble: 0,
        holyLaws: '', features: '', problems: '', points: 0
      },
      shrines: [],

      words:     [],
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

  addGift(wordId, giftName, giftType = 'lesser') {
    const word = this.char.words.find(w => w.id === wordId);
    if (!word || !giftName.trim()) return;
    word.gifts.push({ id: GoUtils.uid(), name: giftName.trim(), type: giftType, activation: 'Action', smite: false, effort: '', description: '', active: false });
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

  addShrine()       { if (!this.char.shrines) this.char.shrines = []; this.char.shrines.push({ id: GoUtils.uid(), level: this.char.level, place: '' }); this._save(); this._renderShrines(); },
  removeShrine(id)  { this.char.shrines = (this.char.shrines || []).filter(x => x.id !== id); this._save(); this._renderShrines(); },

  /* ─── Full render ───────────────────────────────────────────────── */

  render() {
    const el = document.getElementById('character-tab');
    if (!el) return;

    const c = this.char;
    const cult      = c.cult      || {};
    const wealth    = c.wealth    || {};
    const apo       = c.apotheosis || {};
    const giftPts   = 4 + 2 * (c.level || 1);

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

      <!-- ══ PAGE 1: Overview ══════════════════════════════════════ -->
      <div class="card">
        <h2 class="card-title">Overview</h2>

        <!-- Name / Level / XP -->
        <div class="overview-header">
          <label class="form-label overview-name-label">
            Character Full Name
            <input type="text" class="input-main" data-field="name"
              value="${this._esc(c.name)}" placeholder="Character full name…">
          </label>
          <label class="form-label overview-compact">
            Level
            <input type="number" class="input-sm" data-field="level"
              value="${c.level}" min="1" max="10">
          </label>
          <label class="form-label overview-compact">
            Experience
            <input type="number" class="input-sm" data-field="experience"
              value="${c.experience || 0}" min="0">
          </label>
        </div>

        <!-- Goal -->
        <label class="form-label mt-sm">
          Goal
          <input type="text" class="input-main" data-field="goal"
            value="${this._esc(c.goal || '')}"
            placeholder="Character's divine goal or purpose…">
        </label>

        <!-- Description -->
        <label class="form-label mt-sm">
          Description
          <input type="text" class="input-main" data-field="char-description"
            value="${this._esc(c.description || '')}"
            placeholder="Age, Race, Gender, Height, Weight, etc.">
        </label>

        <!-- Facts -->
        <div class="mt-sm">
          <h3 class="section-subtitle">Facts</h3>
          <div class="fact-row">
            <label class="form-label fact-field">
              Origin
              <textarea class="notes-area" data-field="origin" rows="3"
                placeholder="Familiar with the land of their birth, speak the native language and aware of the figures of influence.">${this._esc(c.origin)}</textarea>
            </label>
            <label class="form-label fact-field">
              Past Career
              <textarea class="notes-area" data-field="career" rows="3"
                placeholder="The way they lived before becoming Godbound; if it was necessary for them to labour at all.">${this._esc(c.career)}</textarea>
            </label>
            <label class="form-label fact-field">
              Relationship
              <textarea class="notes-area" data-field="relationship" rows="3"
                placeholder="Sacred pact, bond of blood, hostile, etc. to an organisation, religion, or other group.">${this._esc(c.relationship)}</textarea>
            </label>
          </div>
          <p class="level-facts-note">Add a new Fact related to their adventures or deeds every level</p>
          <div class="level-facts-grid">
            ${[2,3,4,5,6,7,8,9,10].map(lvl => `
              <label class="form-label level-fact-item">
                <span class="level-fact-num">${lvl}</span>
                <input type="text" class="input-main" data-field="level-fact-${lvl}"
                  value="${this._esc((c.levelFacts || {})[lvl] || '')}"
                  placeholder="Level ${lvl} fact…">
              </label>`).join('')}
          </div>
        </div>
      </div>

      <!-- ══ PAGE 2 UPPER: Attributes & Saves ═══════════════════════ -->
      <div class="card">
        <h2 class="card-title">Attributes &amp; Saves</h2>
        <div class="attr-grid">
          ${['str','con','dex','int','wis','cha'].map(attr => {
            const fullNames = { str:'Strength', con:'Constitution', dex:'Dexterity', int:'Intelligence', wis:'Wisdom', cha:'Charisma' };
            const score = c.attributes[attr] || 10;
            const bonus = (c.attrBonuses?.[attr] ?? 0);
            const mod   = GoUtils.getAttrMod(score) + bonus;
            const check = 21 - score;
            return `
              <div class="attr-block">
                <div class="attr-abbr">${attr.toUpperCase()}</div>
                <div class="attr-full">${fullNames[attr]}</div>
                <div class="attr-trow">
                  <span class="attr-row-lbl">BASE</span>
                  <input type="number" class="attr-score" data-field="attr-${attr}"
                    value="${score}" min="3" max="19" aria-label="${attr} score">
                </div>
                <div class="attr-trow">
                  <span class="attr-row-lbl">BONUS</span>
                  <input type="number" class="attr-bonus-input" data-field="bonus-${attr}"
                    value="${bonus}" aria-label="${attr} bonus">
                </div>
                <div class="attr-trow">
                  <span class="attr-row-lbl">CHECK</span>
                  <span class="attr-check" id="attr-check-${attr}">${check}</span>
                </div>
                <div class="attr-mod-display">
                  <span class="attr-row-lbl">MOD</span>
                  <span class="attr-mod ${mod >= 0 ? 'mod-pos' : 'mod-neg'}" id="attr-mod-${attr}">${GoUtils.formatMod(mod)}</span>
                </div>
              </div>`;
          }).join('')}
        </div>
        <p class="formula-note">CHECK = 21 − Attribute Score &nbsp;|&nbsp; MOD derived from total (Base + Bonus)</p>

        <!-- Saves -->
        <div class="saves-section mt-md">
          <h3 class="section-subtitle">Savings</h3>
          <p class="formula-note">Formula: 16 − Level − Best Attribute Modifier (auto-calculated)</p>
          <div class="saves-grid">
            <div class="save-block">
              <div class="save-name">HARDINESS</div>
              <div class="save-mod-note">Best of STR / CON</div>
              <input type="number" class="input-sm save-input" data-field="save-hardiness"
                value="${c.saves.hardiness}" min="1" max="20" readonly
                title="Roll d20 equal to or higher to succeed">
            </div>
            <div class="save-block">
              <div class="save-name">EVASION</div>
              <div class="save-mod-note">Best of DEX / INT</div>
              <input type="number" class="input-sm save-input" data-field="save-evasion"
                value="${c.saves.evasion}" min="1" max="20" readonly>
            </div>
            <div class="save-block">
              <div class="save-name">SPIRIT</div>
              <div class="save-mod-note">Best of WIS / CHA</div>
              <input type="number" class="input-sm save-input" data-field="save-spirit"
                value="${c.saves.spirit}" min="1" max="20" readonly>
            </div>
          </div>
        </div>
      </div>

      <!-- ══ PAGE 2 MIDDLE: Hit Points & Armour ════════════════════ -->
      <div class="card">
        <h2 class="card-title">Hit Points &amp; Armour</h2>
        <div class="hp-armor-grid">
          <div class="hp-section">
            <h3 class="section-subtitle">Hit Points</h3>
            <p class="formula-note">1st Lvl: 8 + CON mod &nbsp;|&nbsp; Each level after: 4 + ½ CON mod</p>
            <div class="hp-row mt-sm">
              <label class="form-label">
                Maximum
                <input type="number" class="input-sm" data-field="hp-max"
                  value="${c.hp.max}" min="1" readonly>
              </label>
              <label class="form-label">
                Current
                <input type="number" class="input-sm" data-field="hp-current"
                  value="${c.hp.current != null ? c.hp.current : c.hp.max}" min="0">
              </label>
              <label class="form-label">
                HP Bonus
                <input type="number" class="input-sm" data-field="hp-max-bonus"
                  value="${c.hp.bonus || 0}" title="Flat bonus added to maximum HP">
              </label>
            </div>
          </div>
          <div class="armor-section">
            <h3 class="section-subtitle">Armour</h3>
            <p class="formula-note">Shield: +1 &nbsp;|&nbsp; Light: +2 &nbsp;|&nbsp; Medium: +4* &nbsp;|&nbsp; Heavy: +6**</p>
            <div class="hp-row mt-sm">
              <label class="form-label">
                Total AC
                <input type="number" class="input-sm" data-field="ac"
                  value="${c.ac}" min="0">
              </label>
              <div class="form-label">
                Divine Fury
                <span class="fray-badge">${GoUtils.getFrayDice(c.level)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ══ PAGE 2 LOWER: Combat ═══════════════════════════════════ -->
      <div class="card">
        <h2 class="card-title">Combat</h2>
        <div class="combat-header-row">
          <label class="form-label">
            Base Attack Bonus
            <input type="number" class="input-sm" data-field="attack-bonus"
              value="${c.attackBonus}">
          </label>
          <div class="form-label">
            Fray Die
            <span class="fray-badge">${GoUtils.getFrayDice(c.level)}</span>
          </div>
          <div class="form-label">
            Unarmed
            <span class="combat-info-static">1d2 + STR mod</span>
          </div>
        </div>
        <p class="formula-note mt-sm">Attack = Level + STR mod (melee) &nbsp;|&nbsp; Level + DEX mod (ranged)</p>
        <div class="damage-chart mt-sm">
          <span class="damage-chart-title">Damage Chart (RpD : Dmg)</span>
          <span class="damage-chart-val">2–5 : 1</span>
          <span class="damage-chart-sep">/</span>
          <span class="damage-chart-val">6–9 : 2</span>
          <span class="damage-chart-sep">/</span>
          <span class="damage-chart-val">10+ : 4</span>
        </div>
      </div>

      <!-- ══ PAGE 2 LOWER: Divine Resources ════════════════════════ -->
      <div class="card">
        <h2 class="card-title">Divine Resources</h2>

        <!-- Dominion -->
        <div class="resource-group">
          <h3 class="section-subtitle">Dominion</h3>
          <p class="formula-note">DOMINION = Base (1 + Level) + from Cult + from Effort spending</p>
          <div class="form-grid mt-sm">
            <label class="form-label">Total Dominion
              <input type="number" class="input-sm" data-field="dominion"
                value="${c.dominion.total}" min="0">
            </label>
          </div>
        </div>

        <!-- Effort -->
        <div class="resource-group mt-sm">
          <h3 class="section-subtitle">Effort</h3>
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
              <span class="sub-label">Available</span>
              <span class="effort-avail">${c.effort.total - c.effort.committedDay - c.effort.committedScene}</span>
            </div>
          </div>
        </div>

        <!-- Influence -->
        <div class="resource-group mt-sm">
          <h3 class="section-subtitle">Influence</h3>
          <p class="formula-note">Without a Cult: 1 + 1 per 3 levels</p>
          <div class="form-grid mt-sm">
            <label class="form-label">Influence (Max)
              <input type="number" class="input-sm" data-field="influence-max"
                value="${c.influence.max}" min="0">
            </label>
            <label class="form-label">Influence (Used)
              <input type="number" class="input-sm" data-field="influence-current"
                value="${c.influence.current}" min="0">
            </label>
          </div>
        </div>

        <!-- Wealth -->
        <div class="resource-group mt-sm">
          <h3 class="section-subtitle">Wealth</h3>
          <div class="form-grid mt-sm">
            <label class="form-label">Total Wealth
              <input type="number" class="input-sm" data-field="wealth-total"
                value="${wealth.total || 0}" min="0">
            </label>
            <label class="form-label">Free Wealth
              <input type="number" class="input-sm" data-field="wealth-free"
                value="${wealth.free || 0}" min="0">
            </label>
          </div>
        </div>
      </div>

      <!-- ══ PAGE 3: Words of Power ═════════════════════════════════ -->
      <div class="card" id="words-section">
        <div class="card-header">
          <div>
            <h2 class="card-title">Words of Power <span class="card-title-ref">(p. 29)</span></h2>
            <p class="formula-note">3 Words at 1st level &nbsp;|&nbsp; Gift Points: <strong>${giftPts}</strong> (4 + 2 × Level)</p>
            <p class="formula-note">1 pt: Lesser Gift (own Word) &nbsp;/&nbsp; 2 pt: Lesser Gift (other Word) &nbsp;/&nbsp; 2 pt: Greater Gift &nbsp;/&nbsp; 3 pt: New Word</p>
          </div>
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

      <!-- ══ PAGE 4 UPPER: Apotheosis Gifts ════════════════════════ -->
      <div class="card" id="apotheosis-section">
        <h2 class="card-title">Apotheosis Gifts <span class="card-title-ref">(p. 31)</span></h2>
        <div class="apotheosis-layout">
          <div class="apo-gifts-wrap">
            <table class="apo-table">
              <thead>
                <tr><th>Lvl</th><th>Gift</th><th>Activation</th><th>Gained</th></tr>
              </thead>
              <tbody>
                ${[
                  { lvl:2, name:'Receive the Incense of Faith', act:'Constant' },
                  { lvl:3, name:'Sanctify Shrine',              act:'Action'   },
                  { lvl:3, name:'Smite the Apostate',           act:'Action'   },
                  { lvl:4, name:'Hear Prayer',                  act:'Constant' },
                  { lvl:5, name:'Perceive the Petitioner',      act:'Action'   },
                  { lvl:6, name:'Mark of the Prophet',          act:'Action'   },
                  { lvl:7, name:'Attend the Faithful',          act:'Action'   },
                  { lvl:8, name:'To Bless the Nations',         act:'Action'   },
                ].map(g => {
                  const gained = apo[g.name] || false;
                  return `
                    <tr class="${gained ? 'apo-gained' : ''}">
                      <td class="apo-lvl">${g.lvl}</td>
                      <td class="apo-name">${g.name}</td>
                      <td class="apo-act">${g.act}</td>
                      <td class="apo-check">
                        <input type="checkbox" class="apo-gained-check"
                          data-apo-gift="${this._esc(g.name)}"
                          ${gained ? 'checked' : ''}>
                      </td>
                    </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
          <div class="apo-ref-tables">
            <table class="apo-ref-table">
              <caption>Power &amp; Size</caption>
              <thead><tr><th>Power</th><th>Size</th></tr></thead>
              <tbody>
                <tr><td>1</td><td>Village</td></tr>
                <tr><td>2</td><td>City</td></tr>
                <tr><td>3</td><td>Province</td></tr>
                <tr><td>4</td><td>Nation</td></tr>
                <tr><td>5</td><td>Empire</td></tr>
              </tbody>
            </table>
            <table class="apo-ref-table mt-sm">
              <caption>Action Die &amp; Demands</caption>
              <thead><tr><th>Die</th><th>Demands</th><th>Type</th></tr></thead>
              <tbody>
                <tr><td>1d6</td><td>1</td><td>Nominal</td></tr>
                <tr><td>1d8</td><td>2</td><td>Sharp</td></tr>
                <tr><td>1d10</td><td>3</td><td>Harsh</td></tr>
                <tr><td>1d12</td><td>4</td><td>—</td></tr>
                <tr><td>1d20</td><td>5</td><td>—</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- ══ PAGE 4 LOWER: Cult ══════════════════════════════════════ -->
      <div class="card" id="cult-section">
        <h2 class="card-title">Cult <span class="card-title-ref">(p. 133)</span></h2>
        <p class="formula-note">At creation: Cohesion = Power &nbsp;|&nbsp; Trouble = Action Die ÷ 4</p>

        <div class="cult-stats-row mt-sm">
          <label class="form-label cult-name-label">
            Cult / Pantheon Name
            <input type="text" class="input-main" data-field="cult-name"
              value="${this._esc(cult.name || '')}" placeholder="Name of cult or pantheon…">
          </label>
          <label class="form-label">
            Demand
            <input type="number" class="input-sm" data-field="cult-demand"
              value="${cult.demand || 0}" min="0" max="3">
          </label>
          <label class="form-label">
            Power
            <input type="number" class="input-sm" data-field="cult-power"
              value="${cult.power || 0}" min="0">
          </label>
          <label class="form-label">
            Cohesion
            <input type="number" class="input-sm" data-field="cult-cohesion"
              value="${cult.cohesion || 0}" min="0">
          </label>
          <label class="form-label">
            Action Die
            <input type="text" class="input-sm" data-field="cult-action-die"
              value="${this._esc(cult.actionDie || '')}" placeholder="1d6">
          </label>
          <label class="form-label">
            Trouble
            <input type="number" class="input-sm" data-field="cult-trouble"
              value="${cult.trouble || 0}" min="0">
          </label>
        </div>

        <div class="cult-details-grid mt-sm">
          <label class="form-label">
            Holy Laws
            <textarea class="notes-area" data-field="cult-holy-laws" rows="3"
              placeholder="The divine laws and commandments of the cult…">${this._esc(cult.holyLaws || '')}</textarea>
          </label>
          <label class="form-label">
            Features
            <textarea class="notes-area" data-field="cult-features" rows="3"
              placeholder="Notable features, temples, rituals…">${this._esc(cult.features || '')}</textarea>
          </label>
          <label class="form-label">
            Problems
            <textarea class="notes-area" data-field="cult-problems" rows="3"
              placeholder="Current threats, crises, or challenges…">${this._esc(cult.problems || '')}</textarea>
          </label>
          <label class="form-label">
            Points
            <input type="number" class="input-sm" data-field="cult-points"
              value="${cult.points || 0}" min="0">
          </label>
        </div>

        <!-- Shrines -->
        <div class="shrines-section mt-sm">
          <div class="card-header">
            <h3 class="section-subtitle">Shrines <span class="card-title-ref">(p. 31)</span></h3>
            <button id="add-shrine-btn" class="btn-ghost">+ Add Shrine</button>
          </div>
          <p class="formula-note">Cost: Wealth equal to Godbound's level. Reconsecration required if desecrated.</p>
          <div id="shrines-list"></div>
        </div>
      </div>

      <!-- ══ Equipment ══════════════════════════════════════════════ -->
      <div class="card" id="equipment-section">
        <h2 class="card-title">Equipment</h2>
        <div id="equipment-list"></div>
      </div>

      <!-- ══ Notes ══════════════════════════════════════════════════ -->
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
    this._renderShrines();
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
            <select class="input-sm gift-type-select" data-word-id="${word.id}" title="Gift type">
              <option value="lesser">Lesser (1pt)</option>
              <option value="greater">Greater (2pt)</option>
            </select>
            <input type="text" class="input-sm gift-name-input" placeholder="Gift name…"
              data-word-id="${word.id}" maxlength="60">
            <button class="btn-ghost add-gift-btn" data-word-id="${word.id}">+ Gift</button>
            <button class="btn-danger remove-word-btn" data-word-id="${word.id}">Remove</button>
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
              <div class="gift-row ${g.active ? 'gift-active' : ''}" data-gift-id="${g.id}">
                <button class="gift-toggle-btn" data-word-id="${word.id}" data-gift-id="${g.id}"
                  title="Toggle active">${g.active ? '◉' : '○'}</button>
                <span class="gift-type-badge ${(g.type || 'lesser') === 'greater' ? 'gift-greater' : 'gift-lesser'}">
                  ${(g.type || 'lesser') === 'greater' ? 'GREATER' : 'LESSER'}
                </span>
                <input type="text" class="input-main gift-field" value="${this._esc(g.name)}"
                  data-word-id="${word.id}" data-gift-id="${g.id}" data-gift-field="name"
                  placeholder="Gift name" title="Gift name">
                <select class="input-sm gift-field"
                  data-word-id="${word.id}" data-gift-id="${g.id}" data-gift-field="activation"
                  title="Activation type">
                  ${['Constant','Instant','On Turn','Action'].map(a =>
                    `<option value="${a}" ${(g.activation || 'Action') === a ? 'selected' : ''}>${a}</option>`
                  ).join('')}
                </select>
                <label class="checkbox-label gift-smite-label" title="Smite gift">
                  <input type="checkbox" class="gift-field"
                    data-word-id="${word.id}" data-gift-id="${g.id}" data-gift-field="smite"
                    ${g.smite ? 'checked' : ''}>
                  Smite
                </label>
                <input type="text" class="input-sm gift-field" value="${this._esc(g.effort)}"
                  data-word-id="${word.id}" data-gift-id="${g.id}" data-gift-field="effort"
                  placeholder="Effort" title="Committed Effort (e.g. Scene, Day)">
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

  /* ─── Shrines render ────────────────────────────────────────────── */

  _renderShrines() {
    const el = document.getElementById('shrines-list');
    if (!el) return;

    const shrines = this.char.shrines || [];
    if (!shrines.length) {
      el.innerHTML = '<p class="empty-msg-sm">No shrines yet.</p>';
      return;
    }

    el.innerHTML = `
      <table class="equip-table">
        <thead><tr><th>Level Built</th><th>Location / Place</th><th></th></tr></thead>
        <tbody>
          ${shrines.map(s => `
            <tr data-shrine-id="${s.id}">
              <td><input type="number" class="input-sm shrine-field" value="${s.level || 1}"
                data-id="${s.id}" data-f="level" min="1" max="10" aria-label="Level shrine built"></td>
              <td><input type="text" class="input-main shrine-field" value="${this._esc(s.place || '')}"
                data-id="${s.id}" data-f="place" placeholder="Location…" aria-label="Shrine location"></td>
              <td><button class="btn-icon remove-shrine-btn" data-id="${s.id}">✕</button></td>
            </tr>`).join('')}
        </tbody>
      </table>`;

    this._attachShrineEvents();
  },

  _updateAttrMod(attr) {
    const scoreEl = document.querySelector(`[data-field="attr-${attr}"]`);
    const bonusEl = document.querySelector(`[data-field="bonus-${attr}"]`);
    const modEl   = document.getElementById(`attr-mod-${attr}`);
    if (!scoreEl || !bonusEl || !modEl) return;
    const score = parseInt(scoreEl.value, 10) || 10;
    const bonus = parseInt(bonusEl.value, 10) || 0;
    const mod   = GoUtils.getAttrMod(score) + bonus;
    modEl.textContent = GoUtils.formatMod(mod);
    modEl.className   = `attr-mod ${mod >= 0 ? 'mod-pos' : 'mod-neg'}`;
    const checkEl = document.getElementById(`attr-check-${attr}`);
    if (checkEl) checkEl.textContent = 21 - score;
    this._updateSaves();
  },

  _computeHPMax() {
    const levelEl = document.querySelector('[data-field="level"]');
    const level = levelEl ? (parseInt(levelEl.value, 10) || this.char.level || 1) : (this.char.level || 1);
    const conMod = this._computeFinalMod('con');
    const bonusEl = document.querySelector('[data-field="hp-max-bonus"]');
    const bonus = bonusEl ? (parseInt(bonusEl.value, 10) || 0) : (this.char.hp && this.char.hp.bonus ? this.char.hp.bonus : 0);

    const base = 8 + conMod; // level 1
    const extraLevels = Math.max(0, level - 1);
    const perLevel = 4 + Math.ceil(conMod / 2);
    const total = base + extraLevels * perLevel + bonus;
    return Math.max(1, Math.floor(total));
  },

  _updateHPMax() {
    const max = this._computeHPMax();
    const maxEl = document.querySelector('[data-field="hp-max"]');
    const curEl = document.querySelector('[data-field="hp-current"]');
    if (maxEl) maxEl.value = max;
    if (!this.char.hp) this.char.hp = { max, current: max, bonus: 0 };
    this.char.hp.max = max;
    // clamp current HP to max
    if (curEl) {
      const cur = parseInt(curEl.value, 10) || 0;
      if (cur > max) { curEl.value = max; this.char.hp.current = max; }
    }
  },

  _computeFinalMod(attr) {
    const scoreEl = document.querySelector(`[data-field="attr-${attr}"]`);
    const bonusEl = document.querySelector(`[data-field="bonus-${attr}"]`);
    const score = scoreEl ? (parseInt(scoreEl.value, 10) || 10) : (this.char.attributes[attr] || 10);
    const bonus = bonusEl ? (parseInt(bonusEl.value, 10) || 0) : ((this.char.attrBonuses && this.char.attrBonuses[attr]) || 0);
    return GoUtils.getAttrMod(score) + bonus;
  },

  _updateSaves() {
    const levelEl = document.querySelector('[data-field="level"]');
    const level = levelEl ? (parseInt(levelEl.value, 10) || this.char.level || 1) : (this.char.level || 1);

    const hardMod = Math.max(this._computeFinalMod('str'), this._computeFinalMod('con'));
    const evaMod  = Math.max(this._computeFinalMod('dex'), this._computeFinalMod('int'));
    const spiMod  = Math.max(this._computeFinalMod('wis'), this._computeFinalMod('cha'));

    const hard = 16 - level - hardMod;
    const eva  = 16 - level - evaMod;
    const spi  = 16 - level - spiMod;

    const hardEl = document.querySelector('[data-field="save-hardiness"]');
    const evaEl  = document.querySelector('[data-field="save-evasion"]');
    const spiEl  = document.querySelector('[data-field="save-spirit"]');

    if (hardEl) { hardEl.value = hard; }
    if (evaEl)  { evaEl.value  = eva; }
    if (spiEl)  { spiEl.value  = spi; }

    if (this.char && this.char.saves) {
      this.char.saves.hardiness = hard;
      this.char.saves.evasion   = eva;
      this.char.saves.spirit    = spi;
    }
    // also update HP when saves/attributes change
    this._updateHPMax();
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

    /* Live attribute modifier recalculation */
    ['str','dex','con','int','wis','cha'].forEach(attr => {
      document.querySelector(`[data-field="attr-${attr}"]`)
        ?.addEventListener('input', () => this._updateAttrMod(attr));
      document.querySelector(`[data-field="bonus-${attr}"]`)
        ?.addEventListener('input', () => this._updateAttrMod(attr));
    });

    /* Recalculate saves when level changes */
    document.querySelector('[data-field="level"]')
      ?.addEventListener('input', () => this._updateSaves());

    /* Recalculate HP when HP bonus changes */
    document.querySelector('[data-field="hp-max-bonus"]')
      ?.addEventListener('input', () => { this._updateHPMax(); });

    /* Add Shrine button */
    document.getElementById('add-shrine-btn')?.addEventListener('click', () => this.addShrine());

    /* Apotheosis checkboxes – save immediately on change */
    document.querySelectorAll('.apo-gained-check').forEach(cb => {
      cb.addEventListener('change', () => {
        const c = this.char;
        if (!c.apotheosis) c.apotheosis = {};
        c.apotheosis[cb.dataset.apoGift] = cb.checked;
        cb.closest('tr').className = cb.checked ? 'apo-gained' : '';
        this._save();
      });
    });
  },

  _attachWordEvents() {
    document.querySelectorAll('.remove-word-btn').forEach(btn =>
      btn.addEventListener('click', () => {
        if (confirm('Remove this Word?')) this.removeWord(btn.dataset.wordId);
      }));

    document.querySelectorAll('.add-gift-btn').forEach(btn =>
      btn.addEventListener('click', () => {
        const wid  = btn.dataset.wordId;
        const inp  = document.querySelector(`.gift-name-input[data-word-id="${wid}"]`);
        const sel  = document.querySelector(`.gift-type-select[data-word-id="${wid}"]`);
        if (inp) { this.addGift(wid, inp.value, sel ? sel.value : 'lesser'); inp.value = ''; }
      }));

    document.querySelectorAll('.gift-name-input').forEach(inp =>
      inp.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          const wid = inp.dataset.wordId;
          const sel = document.querySelector(`.gift-type-select[data-word-id="${wid}"]`);
          this.addGift(wid, inp.value, sel ? sel.value : 'lesser');
          inp.value = '';
        }
      }));

    document.querySelectorAll('.remove-gift-btn').forEach(btn =>
      btn.addEventListener('click', () => this.removeGift(btn.dataset.wordId, btn.dataset.giftId)));

    document.querySelectorAll('.gift-toggle-btn').forEach(btn =>
      btn.addEventListener('click', () => this.toggleGift(btn.dataset.wordId, btn.dataset.giftId)));

    /* In-place gift field editing (supports checkboxes for smite) */
    document.querySelectorAll('.gift-field').forEach(inp => {
      inp.addEventListener('change', () => {
        const word = this.char.words.find(w => w.id === inp.dataset.wordId);
        if (!word) return;
        const gift = word.gifts.find(g => g.id === inp.dataset.giftId);
        if (!gift) return;
        gift[inp.dataset.giftField] = inp.type === 'checkbox' ? inp.checked : inp.value;
        this._save();
      });
    });
  },

  _attachShrineEvents() {
    document.querySelectorAll('.remove-shrine-btn').forEach(btn =>
      btn.addEventListener('click', () => this.removeShrine(btn.dataset.id)));

    document.querySelectorAll('.shrine-field').forEach(inp =>
      inp.addEventListener('change', () => {
        const shrine = (this.char.shrines || []).find(s => s.id === inp.dataset.id);
        if (!shrine) return;
        shrine[inp.dataset.f] = inp.type === 'number' ? (parseInt(inp.value, 10) || 1) : inp.value;
        this._save();
      }));
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
      'goal':             v => c.goal              = v,
      'char-description': v => c.description       = v,
      'experience':       v => c.experience        = parseInt(v,10)||0,
      'origin':           v => c.origin            = v,
      'career':           v => c.career            = v,
      'relationship':     v => c.relationship      = v,
      'hp-current':       v => c.hp.current        = parseInt(v,10)||0,
      'hp-max':           v => c.hp.max            = parseInt(v,10)||1,
      'hp-max-bonus':     v => { if (!c.hp) c.hp = {}; c.hp.bonus = parseInt(v,10)||0; },
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
      'wealth-total':     v => { if (!c.wealth) c.wealth = {}; c.wealth.total = parseInt(v,10)||0; },
      'wealth-free':      v => { if (!c.wealth) c.wealth = {}; c.wealth.free  = parseInt(v,10)||0; },
      'cult-name':        v => { if (!c.cult) c.cult = {}; c.cult.name      = v; },
      'cult-demand':      v => { if (!c.cult) c.cult = {}; c.cult.demand    = parseInt(v,10)||0; },
      'cult-power':       v => { if (!c.cult) c.cult = {}; c.cult.power     = parseInt(v,10)||0; },
      'cult-cohesion':    v => { if (!c.cult) c.cult = {}; c.cult.cohesion  = parseInt(v,10)||0; },
      'cult-action-die':  v => { if (!c.cult) c.cult = {}; c.cult.actionDie = v; },
      'cult-trouble':     v => { if (!c.cult) c.cult = {}; c.cult.trouble   = parseInt(v,10)||0; },
      'cult-holy-laws':   v => { if (!c.cult) c.cult = {}; c.cult.holyLaws  = v; },
      'cult-features':    v => { if (!c.cult) c.cult = {}; c.cult.features  = v; },
      'cult-problems':    v => { if (!c.cult) c.cult = {}; c.cult.problems  = v; },
      'cult-points':      v => { if (!c.cult) c.cult = {}; c.cult.points    = parseInt(v,10)||0; },
      'notes':            v => c.notes             = v,
    };

    document.querySelectorAll('[data-field]').forEach(el => {
      const field  = el.dataset.field;
      const value  = el.value;

      if (field.startsWith('attr-')) {
        const attr = field.slice(5);
        c.attributes[attr] = parseInt(value, 10) || 10;
      } else if (field.startsWith('bonus-')) {
        const attr = field.slice(6);
        if (!c.attrBonuses) c.attrBonuses = {};
        c.attrBonuses[attr] = parseInt(value, 10) || 0;
      } else if (field.startsWith('level-fact-')) {
        const lvl = parseInt(field.slice(11), 10);
        if (lvl >= 2 && lvl <= 10) {
          if (!c.levelFacts) c.levelFacts = {};
          c.levelFacts[lvl] = value;
        }
      } else if (fieldMap[field]) {
        fieldMap[field](value);
      }
    });

    /* Collect apotheosis checkboxes */
    document.querySelectorAll('.apo-gained-check').forEach(cb => {
      if (!c.apotheosis) c.apotheosis = {};
      c.apotheosis[cb.dataset.apoGift] = cb.checked;
    });

    this._save();

    /* Refresh fray dice display and attr mods */
    document.querySelectorAll('.attr-block').forEach(block => {
      const inp  = block.querySelector('[data-field^="attr-"]');
      if (!inp) return;
      const attr = inp.dataset.field.slice(5);
      const bonusInp = block.querySelector('[data-field^="bonus-"]');
      const bonus = bonusInp ? (parseInt(bonusInp.value, 10) || 0) : 0;
      const mod  = GoUtils.getAttrMod(c.attributes[attr]) + bonus;
      const modEl = block.querySelector('.attr-mod');
      if (modEl) {
        modEl.textContent = GoUtils.formatMod(mod);
        modEl.className   = `attr-mod ${mod >= 0 ? 'mod-pos' : 'mod-neg'}`;
      }
    });

    /* Ensure saves are recalculated to match initial values */
    this._updateSaves();

    const frayEl = document.querySelector('[data-field="level"]');

      /* Ensure HP max is calculated after rendering */
      this._updateHPMax();
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
