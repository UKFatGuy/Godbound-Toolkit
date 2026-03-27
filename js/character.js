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

  DEFAULT_UNARMED_DAMAGE: '1d2 + STR mod',
  DEFAULT_CUSTOM_ATTACK_ATTR: 'str',

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
      armorType:    'none',
      shieldOrCloak: false,
      defenseAttr:  'dex',
      ac:            9,
      attackBonus: 2,
      customAttackAttr: GoCharacter.DEFAULT_CUSTOM_ATTACK_ATTR,  /* attribute used for the custom attack bonus box */
      frayBonusDice: '',   /* extra dice added to fray roll, e.g. '1d6'; empty = none */
      unarmedDamage: this.DEFAULT_UNARMED_DAMAGE,  /* editable unarmed damage string */

      saves: { hardiness: 15, evasion: 15, spirit: 15 },

      effort:    { total: 2, committedDay: 0, committedScene: 0, bonus: 0 },
      dominion:  { earned: 0, spent: 0, total: 0 },
      divineServant: false,
      servantName:   '',
      influence: { max: 0, current: 0, bonus: 0 },
      wealth:    { total: 0, free: 0, cult: 0 },

      apotheosis: {},

      cult: {
        name: '', demand: 0, power: 0, cohesion: 0,
        actionDie: '', trouble: 0,
        holyLaws: '', features: '', problems: '', points: 0
      },
      shrines: [],
      servants: [],

      words:          [],
      martialStrifes: [],
      theurgy:        [],
      lowMagic:       [],
      weapons:        [],
      armor:          [],
      equipment:      [],
      artifacts:      [],
      notes:          ''
    };
  },

  /* ─── Init ──────────────────────────────────────────────────────── */

  init() {
    this.characters = GoStorage.loadCharacters();
    this.characters.forEach(char => this._ensureCharacterStructure(char));
    this.activeIdx  = GoStorage.loadActiveCharacter();
    if (!this.characters.length) {
      this.characters.push(this._newCharacter('My Godbound'));
    }
    this.activeIdx = GoUtils.clamp(this.activeIdx, 0, this.characters.length - 1);
    GoStorage.saveCharacters(this.characters);
    this.render();

    /* One-time delegated listener: keep the stat banner live whenever
       any field inside the character tab changes. */
    const tabEl = document.getElementById('character-tab');
    if (tabEl) {
      tabEl.addEventListener('input',  () => this._updateStatBanner());
      tabEl.addEventListener('change', () => this._updateStatBanner());
    }
  },

  _save() {
    GoStorage.saveCharacters(this.characters);
    GoStorage.saveActiveCharacter(this.activeIdx);
  },

  get char() { return this.characters[this.activeIdx]; },

  _ensureCharacterStructure(char) {
    if (!char || typeof char !== 'object') return;
    if (!Array.isArray(char.words)) char.words = [];
    char.words = char.words.map(word => ({
      ...word,
      gifts: Array.isArray(word.gifts) ? word.gifts.map(gift => this._normalizeGift(gift)) : []
    }));
    if (!Array.isArray(char.weapons)) char.weapons = [];
    if (!Array.isArray(char.armor)) char.armor = [];
    if (!Array.isArray(char.equipment)) char.equipment = [];
    if (!Array.isArray(char.artifacts)) char.artifacts = [];
    if (!Array.isArray(char.shrines)) char.shrines = [];
    if (!Array.isArray(char.servants)) char.servants = [];
    if (!char.customAttackAttr) char.customAttackAttr = GoCharacter.DEFAULT_CUSTOM_ATTACK_ATTR;

    /* Migrate old dominion structure (just total) to new earned/spent/total */
    if (!char.dominion) char.dominion = { earned: 0, spent: 0, total: 0 };
    if (char.dominion.earned === undefined) {
      char.dominion.earned = char.dominion.total || 0;
      char.dominion.spent  = 0;
    }
    char.dominion.total = (char.dominion.earned || 0) + (char.dominion.spent || 0);

    /* Ensure divine servant fields */
    if (char.divineServant === undefined) char.divineServant = false;
    if (char.servantName   === undefined) char.servantName   = '';

    /* Ensure wealth structure with cult cache */
    if (!char.wealth) char.wealth = { total: 0, free: 0, cult: 0 };
    if (char.wealth.cult === undefined) char.wealth.cult = 0;

    GoUtils.ARCANE_PRACTICES.forEach(cfg => {
      char[cfg.key] = this._normalizePracticeList(char[cfg.key]);
    });
  },

  _normalizePracticeList(list) {
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
                description: entry.description || '',
                active: !!entry.active
              }))
            : []
        }))
      : [];
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
    const effect = `${signed} ${attr} ${kind}`;

    if (gift.type !== 'innate' && !gift.active) {
      return `Inactive: ${effect}`;
    }
    return `Applies: ${effect}`;
  },

  _getGiftAttrAdjustments(attr) {
    let scoreOverride = null;
    let bonusAdj = 0;

    (this.char.words || []).forEach(word => {
      (word.gifts || []).forEach(rawGift => {
        const gift = this._normalizeGift(rawGift);
        if (!gift.modifiesAttribute || gift.modAttribute !== attr) return;
        if (!gift.active && gift.type !== 'innate') return;

        const delta = Number.isFinite(parseInt(gift.modValue, 10)) ? parseInt(gift.modValue, 10) : 0;
        if (gift.modType === 'score') scoreOverride = delta;
        else bonusAdj += delta;
      });
    });

    return { scoreOverride, bonusAdj };
  },

  _computeFinalScore(attr) {
    const scoreEl = document.querySelector(`[data-field="attr-${attr}"]`);
    const baseScore = scoreEl ? (parseInt(scoreEl.value, 10) || 10) : (this.char.attributes[attr] || 10);
    const { scoreOverride } = this._getGiftAttrAdjustments(attr);
    return scoreOverride == null ? baseScore : scoreOverride;
  },

  _refreshDerivedFromGiftModifiers() {
    ['str','dex','con','int','wis','cha'].forEach(attr => this._updateAttrMod(attr));
  },

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
    this._refreshDerivedFromGiftModifiers();
  },

  addGift(wordId, giftName, giftType = 'lesser') {
    const word = this.char.words.find(w => w.id === wordId);
    if (!word || !giftName.trim()) return;
    word.gifts.push(this._normalizeGift({
      id: GoUtils.uid(),
      name: giftName.trim(),
      type: giftType,
      activation: 'Action',
      smite: false,
      effort: '',
      description: '',
      active: false,
      modifiesAttribute: false,
      modAttribute: 'str',
      modType: 'bonus',
      modValue: 0
    }));
    this._save();
    this._renderWords();
    this._refreshDerivedFromGiftModifiers();
  },

  removeGift(wordId, giftId) {
    const word = this.char.words.find(w => w.id === wordId);
    if (!word) return;
    word.gifts = word.gifts.filter(g => g.id !== giftId);
    this._save();
    this._renderWords();
    this._refreshDerivedFromGiftModifiers();
  },

  toggleGift(wordId, giftId) {
    const word = this.char.words.find(w => w.id === wordId);
    if (!word) return;
    const gift = word.gifts.find(g => g.id === giftId);
    if (!gift) return;
    gift.active = !gift.active;
    this._save();
    this._renderWords();
    this._refreshDerivedFromGiftModifiers();
  },

  addPractice(category, name) {
    const cfg = GoUtils.getArcanePracticeConfig(category);
    if (!cfg || !name || !name.trim()) return;
    this.char[category].push({ id: GoUtils.uid(), name: name.trim(), notes: '', entries: [] });
    this._save();
    this._renderArcaneArts();
  },

  removePractice(category, practiceId) {
    const cfg = GoUtils.getArcanePracticeConfig(category);
    if (!cfg) return;
    this.char[category] = this.char[category].filter(item => item.id !== practiceId);
    this._save();
    this._renderArcaneArts();
  },

  addPracticeEntry(category, practiceId, name) {
    const practice = (this.char[category] || []).find(item => item.id === practiceId);
    if (!practice || !name || !name.trim()) return;
    practice.entries.push({
      id: GoUtils.uid(),
      name: name.trim(),
      activation: 'Action',
      effort: '',
      description: '',
      active: false
    });
    this._save();
    this._renderArcaneArts();
  },

  removePracticeEntry(category, practiceId, entryId) {
    const practice = (this.char[category] || []).find(item => item.id === practiceId);
    if (!practice) return;
    practice.entries = practice.entries.filter(entry => entry.id !== entryId);
    this._save();
    this._renderArcaneArts();
  },

  togglePracticeEntry(category, practiceId, entryId) {
    const practice = (this.char[category] || []).find(item => item.id === practiceId);
    if (!practice) return;
    const entry = practice.entries.find(item => item.id === entryId);
    if (!entry) return;
    entry.active = !entry.active;
    this._save();
    this._renderArcaneArts();
  },

  /* ─── Equipment ─────────────────────────────────────────────────── */

  addWeapon()    { this.char.weapons.push({ id: GoUtils.uid(), name: 'Weapon', damage: '1d8', attackMod: 0, notes: '' }); this._save(); this._renderEquipment(); },
  addArmor()     { this.char.armor.push({ id: GoUtils.uid(), name: 'Armour', acBonus: 0, notes: '' }); this._save(); this._renderEquipment(); },
  addEquipItem() { this.char.equipment.push({ id: GoUtils.uid(), name: 'Item', notes: '' }); this._save(); this._renderEquipment(); },
  addArtifact()  { if (!this.char.artifacts) this.char.artifacts = []; this.char.artifacts.push({ id: GoUtils.uid(), name: 'Artifact', effort: 0, creationCost: 0, notes: '' }); this._save(); this._renderEquipment(); },

  removeWeapon(id)    { this.char.weapons   = this.char.weapons.filter(x => x.id !== id); this._save(); this._renderEquipment(); },
  removeArmor(id)     { this.char.armor     = this.char.armor.filter(x => x.id !== id);   this._save(); this._renderEquipment(); },
  removeEquipItem(id) { this.char.equipment = this.char.equipment.filter(x => x.id !== id); this._save(); this._renderEquipment(); },
  removeArtifact(id)  { this.char.artifacts = (this.char.artifacts || []).filter(x => x.id !== id); this._save(); this._renderEquipment(); },

  addShrine()       { if (!this.char.shrines) this.char.shrines = []; this.char.shrines.push({ id: GoUtils.uid(), level: this.char.level, place: '' }); this._save(); this._renderShrines(); },
  removeShrine(id)  { this.char.shrines = (this.char.shrines || []).filter(x => x.id !== id); this._save(); this._renderShrines(); },

  /* ─── Full render ───────────────────────────────────────────────── */

  render() {
    const el = document.getElementById('character-tab');
    if (!el) return;

    const c = this.char;
    this._ensureCharacterStructure(c);
    const cult      = c.cult      || {};
    const wealth    = c.wealth    || {};
    const apo       = c.apotheosis || {};
    const giftPts   = 4 + 2 * (c.level || 1);

    /* Compute HP colour class for stat banner */
    const hpCur   = c.hp.current ?? c.hp.max;
    const hpMax   = c.hp.max ?? 1;
    const hpRatio = hpMax > 0 ? hpCur / hpMax : 1;
    const hpPipCls = hpRatio > 0.6 ? 'stat-hp-ok' : hpRatio > 0.25 ? 'stat-hp-warn' : 'stat-hp-low';

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

      <!-- ══ Character stat banner ══════════════════════════════════ -->
      <div class="char-stat-banner" id="char-stat-banner">
        <div class="stat-pip ${hpPipCls}" id="banner-pip-hp">
          <span class="stat-pip-label">Hit Points</span>
          <span class="stat-pip-value">
            <span id="banner-hp-cur">${hpCur}</span><span class="stat-pip-sub"> / <span id="banner-hp-max">${hpMax}</span></span>
          </span>
        </div>
        <div class="stat-pip">
          <span class="stat-pip-label">Armour Class</span>
          <span class="stat-pip-value" id="banner-ac">${c.ac ?? this._armorTypeToBaseAC(c.armorType||'none')}</span>
        </div>
        <div class="stat-pip">
          <span class="stat-pip-label">Hardiness</span>
          <span class="stat-pip-value" id="banner-hardiness">${c.saves.hardiness}</span>
        </div>
        <div class="stat-pip">
          <span class="stat-pip-label">Evasion</span>
          <span class="stat-pip-value" id="banner-evasion">${c.saves.evasion}</span>
        </div>
        <div class="stat-pip">
          <span class="stat-pip-label">Spirit</span>
          <span class="stat-pip-value" id="banner-spirit">${c.saves.spirit}</span>
        </div>
        <div class="stat-pip">
          <span class="stat-pip-label">Effort</span>
          <span class="stat-pip-value">
            <span id="banner-effort-avail">${c.effort.total - c.effort.committedDay - c.effort.committedScene}</span><span class="stat-pip-sub"> / <span id="banner-effort-max">${c.effort.total}</span></span>
          </span>
        </div>
        <div class="stat-pip">
          <span class="stat-pip-label">Influence</span>
          <span class="stat-pip-value">
            <span id="banner-influence-cur">${c.influence.current}</span><span class="stat-pip-sub"> / <span id="banner-influence-max">${c.influence.max}</span></span>
          </span>
        </div>
        <div class="stat-pip">
          <span class="stat-pip-label">Fray Die</span>
          <span class="stat-pip-value">${GoUtils.getFrayDiceDisplay(c.level, c.frayBonusDice)}</span>
        </div>
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
              value="${c.level}" min="1" max="30">
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
          <textarea class="notes-area" data-field="goal" rows="3"
            placeholder="Character's divine goal or purpose…">${this._esc(c.goal || '')}</textarea>
        </label>

        <!-- Description -->
        <label class="form-label mt-sm">
          Description
          <textarea class="notes-area" data-field="char-description" rows="3"
            placeholder="Age, Race, Gender, Height, Weight, etc.">${this._esc(c.description || '')}</textarea>
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
          <div class="fact-row" id="level-facts-container">
            ${Array.from({length: 29}, (_, i) => i + 2).map(lvl => `
              <label class="form-label fact-field" data-level-fact-row="${lvl}"${lvl > (c.level || 1) ? ' style="display:none"' : ''}>
                Level ${lvl} Fact
                <textarea class="notes-area" data-field="level-fact-${lvl}" rows="3"
                  placeholder="A Fact related to their adventures or deeds at level ${lvl}.">${this._esc((c.levelFacts || {})[lvl] || '')}</textarea>
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
          <h3 class="section-subtitle">Saving Throws</h3>
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
            <p class="formula-note">8 + CON Modifier at Level 1, +4 + 1/2 CON Modifier (rounded up) each additional level, + Bonus (auto-calculated)</p>
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
            <p class="formula-note">None: 9 &nbsp;|&nbsp; Light: 7 &nbsp;|&nbsp; Medium: 5 &nbsp;|&nbsp; Heavy: 3 &nbsp;|&nbsp; Shield/Cloak: −1</p>
            <div class="hp-row mt-sm">
              <label class="form-label">
                Armour Type
                <select class="input-sm" data-field="armor-type" style="width:auto">
                  <option value="none"   ${(c.armorType||'none')==='none'   ? 'selected' : ''}>None (9)</option>
                  <option value="light"  ${(c.armorType||'none')==='light'  ? 'selected' : ''}>Light (7)</option>
                  <option value="medium" ${(c.armorType||'none')==='medium' ? 'selected' : ''}>Medium (5)</option>
                  <option value="heavy"  ${(c.armorType||'none')==='heavy'  ? 'selected' : ''}>Heavy (3)</option>
                </select>
              </label>
              <label class="form-label">
                Base AC
                <input type="number" class="input-sm" data-field="base-ac"
                  value="${this._armorTypeToBaseAC(c.armorType||'none')}" readonly>
              </label>
              <label class="form-label">
                Shield / Cloak
                <select class="input-sm" data-field="shield-or-cloak" style="width:auto">
                  <option value="no"  ${!c.shieldOrCloak ? 'selected' : ''}>No (0)</option>
                  <option value="yes" ${ c.shieldOrCloak ? 'selected' : ''}>Yes (−1)</option>
                </select>
              </label>
              <label class="form-label">
                Defence Attr
                <select class="input-sm" data-field="defense-attr">
                  ${['str','dex','con','int','wis','cha'].map(a =>
                    `<option value="${a}" ${(c.defenseAttr||'dex')===a ? 'selected' : ''}>${a.toUpperCase()}</option>`
                  ).join('')}
                </select>
              </label>
              <label class="form-label">
                Total AC
                <input type="number" class="input-sm" data-field="ac"
                  value="${c.ac ?? this._armorTypeToBaseAC(c.armorType||'none')}" readonly>
              </label>
            </div>
          </div>
        </div>
      </div>

      <!-- ══ PAGE 2 LOWER: Combat ═══════════════════════════════════ -->
      <div class="card">
        <h2 class="card-title">Combat</h2>

        <!-- Attack Bonuses -->
        <div class="attack-bonus-grid mt-sm">
          <label class="form-label">
            Melee Attack
            <span class="formula-hint">(Lvl + STR)</span>
            <input type="number" class="input-sm" id="attack-melee" readonly
              value="${c.level + this._computeFinalMod('str')}">
          </label>
          <label class="form-label">
            Ranged Attack
            <span class="formula-hint">(Lvl + DEX)</span>
            <input type="number" class="input-sm" id="attack-ranged" readonly
              value="${c.level + this._computeFinalMod('dex')}">
          </label>
          <label class="form-label">
            Custom Attack
            <span class="formula-hint">(Lvl +
              <select class="input-inline-select" data-field="custom-attack-attr">
                ${['str','dex','con','int','wis','cha'].map(a =>
                  `<option value="${a}" ${(c.customAttackAttr||GoCharacter.DEFAULT_CUSTOM_ATTACK_ATTR)===a ? 'selected' : ''}>${a.toUpperCase()}</option>`
                ).join('')}
              </select>)
            </span>
            <input type="number" class="input-sm" id="attack-custom" readonly
              value="${c.level + this._computeFinalMod(c.customAttackAttr||GoCharacter.DEFAULT_CUSTOM_ATTACK_ATTR)}">
          </label>
        </div>

        <div class="combat-header-row mt-sm">
          <div class="form-label">
            Fray Die
            <span class="fray-badge">${GoUtils.getFrayDiceDisplay(c.level, c.frayBonusDice)}</span>
          </div>
          <label class="form-label">
            Bonus Fray Dice
            <select class="input-sm" data-field="fray-bonus-dice">
              <option value="" ${!c.frayBonusDice ? 'selected' : ''}>None</option>
              ${[4,6,8,10,12].flatMap(s => Array.from({length:10},(_,i)=>`${i+1}d${s}`)).map(d =>
                `<option value="${d}" ${c.frayBonusDice === d ? 'selected' : ''}>${d}</option>`
              ).join('')}
            </select>
          </label>
          <label class="form-label">
            Unarmed Damage
            <input type="text" class="input-unarmed" data-field="unarmed-damage"
              value="${c.unarmedDamage ?? GoCharacter.DEFAULT_UNARMED_DAMAGE}">
          </label>
        </div>
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

        <div class="resources-grid">
          <!-- Dominion -->
          <div class="resource-group">
            <h3 class="section-subtitle">Dominion</h3>
            <div class="form-grid mt-sm">
              <label class="form-label">Dominion<br>Free
                <input type="number" class="input-sm" data-field="dominion-earned"
                  value="${c.dominion.earned || 0}" min="0">
              </label>
              <label class="form-label">Dominion Spent
                <input type="number" class="input-sm" data-field="dominion-spent"
                  value="${c.dominion.spent || 0}" min="0">
              </label>
              <label class="form-label">Total Dominion
                <input type="number" class="input-sm" data-field="dominion-total"
                  value="${c.dominion.total || 0}" min="0" readonly>
              </label>
            </div>
            <div class="form-grid mt-sm">
              <label class="checkbox-label">
                <input type="checkbox" id="divine-servant-check" data-field="divine-servant"
                  ${c.divineServant ? 'checked' : ''}>
                Divine Servant
              </label>
              <label class="form-label col-span-2" id="servant-name-wrap" ${c.divineServant ? '' : 'style="display:none"'}>
                Servant Name
                <input type="text" class="input-main" data-field="servant-name"
                  value="${this._esc(c.servantName || '')}" placeholder="Name of divine servant…">
              </label>
            </div>
          </div>

          <!-- Effort -->
          <div class="resource-group">
            <h3 class="section-subtitle">Effort</h3>
            <p class="formula-note">2 at Level 1, +1 per Level, + Bonuses (auto-calculated)</p>
            <div class="form-grid mt-sm">
              <label class="form-label">Total Effort
                <input type="number" class="input-sm" data-field="effort-total"
                  value="${c.effort.total}" min="0" max="10" readonly>
              </label>
              <label class="form-label">Effort Bonus
                <input type="number" class="input-sm" data-field="effort-bonus"
                  value="${c.effort.bonus || 0}" min="0">
              </label>
              <div class="form-label">
                <span class="sub-label">Available</span>
                <span class="effort-avail">${c.effort.total - c.effort.committedDay - c.effort.committedScene}</span>
              </div>
              <label class="form-label">Committed (Scene)
                <input type="number" class="input-sm" data-field="effort-scene"
                  value="${c.effort.committedScene}" min="0">
              </label>
              <label class="form-label">Committed (Day)
                <input type="number" class="input-sm" data-field="effort-day"
                  value="${c.effort.committedDay}" min="0">
              </label>
            </div>
          </div>

          <!-- Influence -->
          <div class="resource-group">
            <h3 class="section-subtitle">Influence</h3>
            <p class="formula-note">2 at Level 1, +1 per additional level, + Bonuses (auto-calculated)</p>
            <div class="form-grid mt-sm">
              <label class="form-label">Influence (Max)
                <input type="number" class="input-sm" data-field="influence-max"
                  value="${c.influence.max}" min="0" readonly>
              </label>
              <label class="form-label">Influence Bonus
                <input type="number" class="input-sm" data-field="influence-bonus"
                  value="${c.influence.bonus || 0}" min="0">
              </label>
              <label class="form-label">Influence Committed
                <input type="number" class="input-sm" data-field="influence-current"
                  value="${c.influence.current}" min="0">
              </label>
            </div>
          </div>

          <!-- Wealth -->
          <div class="resource-group">
            <h3 class="section-subtitle">Wealth</h3>
            <div class="form-grid mt-sm">
              <label class="form-label">Cache #1
                <input type="number" class="input-sm" data-field="wealth-total"
                  value="${wealth.total || 0}" min="0">
              </label>
              <label class="form-label">Cache #2
                <input type="number" class="input-sm" data-field="wealth-free"
                  value="${wealth.free || 0}" min="0">
              </label>
              <label class="form-label">Cult Wealth
                <input type="number" class="input-sm" data-field="wealth-cult"
                  value="${wealth.cult || 0}" min="0">
              </label>
            </div>
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

      <!-- ══ PAGE 3B: Arcane Arts ══════════════════════════════════ -->
      <div class="card" id="arcane-arts-section">
        <div class="card-header">
          <div>
            <h2 class="card-title">Arcane Arts</h2>
            <p class="formula-note">Track Martial Strifes, Theurgy, and Low Magic traditions alongside Words of Power.</p>
          </div>
        </div>
        <div id="arcane-arts-list"></div>
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

      <!-- ══ Servants & Minions ════════════════════════════════════ -->
      <div class="card" id="servants-section">
        <div class="card-header">
          <h2 class="card-title">Servants &amp; Minions</h2>
        </div>
        <div class="stock-enemy-row mt-sm">
          <label class="stock-enemy-label">Import from Data Editor:</label>
          <select id="servant-stock-select" class="input-main" aria-label="Load a stock enemy as a servant">
            <option value="">— select stock enemy —</option>
          </select>
          <button id="add-servant-from-stock-btn" class="btn-secondary">+ Add</button>
        </div>
        <div class="add-servant-form mt-sm">
          <input id="servant-name-input" type="text" class="input-main" placeholder="Name" aria-label="Servant name">
          <input id="servant-hp-input"   type="number" class="input-sm" placeholder="HP" aria-label="HP" min="1">
          <input id="servant-ac-input"   type="number" class="input-sm" placeholder="AC" aria-label="AC" min="0">
          <input id="servant-notes-input" type="text" class="input-main" placeholder="Notes" aria-label="Notes">
          <button id="add-servant-btn" class="btn-primary">Add Servant</button>
        </div>
        <div id="servants-list" class="mt-sm"></div>
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
    this._renderArcaneArts();
    this._renderEquipment();
    this._renderShrines();
    this._renderServants();
    this._attachCharEvents();
    this._refreshDerivedFromGiftModifiers();
    this._updateAttackBonuses();
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
              <option value="innate">Innate</option>
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
              <span class="gift-col-attr">Attribute Mod</span>
            </div>
            ${word.gifts.map(rawGift => {
              const g = this._normalizeGift(rawGift);
              return `
              <div class="gift-row ${g.active ? 'gift-active' : ''}" data-gift-id="${g.id}">
                <button class="gift-toggle-btn" data-word-id="${word.id}" data-gift-id="${g.id}"
                  title="Toggle active">${g.active ? '◉' : '○'}</button>
                <span class="gift-type-badge ${
                  (g.type || 'lesser') === 'greater' ? 'gift-greater' :
                  (g.type || 'lesser') === 'innate'  ? 'gift-innate'  : 'gift-lesser'
                }">
                  ${
                  (g.type || 'lesser') === 'greater' ? 'GREATER' :
                  (g.type || 'lesser') === 'innate'  ? 'INNATE'  : 'LESSER'
                  }
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
                <label class="checkbox-label gift-modify-label" title="Enable attribute modifier">
                  <input type="checkbox" class="gift-field"
                    data-word-id="${word.id}" data-gift-id="${g.id}" data-gift-field="modifiesAttribute"
                    ${g.modifiesAttribute ? 'checked' : ''}>
                  Mod Attr
                </label>
                ${g.modifiesAttribute ? `
                  <div class="gift-modifier-controls">
                    <select class="input-sm gift-field"
                      data-word-id="${word.id}" data-gift-id="${g.id}" data-gift-field="modAttribute"
                      title="Affected attribute">
                      ${[
                        ['str','STR'], ['dex','DEX'], ['con','CON'],
                        ['int','INT'], ['wis','WIS'], ['cha','CHA']
                      ].map(([v,l]) => `<option value="${v}" ${g.modAttribute === v ? 'selected' : ''}>${l}</option>`).join('')}
                    </select>
                    <select class="input-sm gift-field"
                      data-word-id="${word.id}" data-gift-id="${g.id}" data-gift-field="modType"
                      title="Modifier type">
                      <option value="bonus" ${g.modType === 'bonus' ? 'selected' : ''}>Bonus</option>
                      <option value="score" ${g.modType === 'score' ? 'selected' : ''}>Score</option>
                    </select>
                    <input type="number" class="input-sm gift-field"
                      data-word-id="${word.id}" data-gift-id="${g.id}" data-gift-field="modValue"
                      value="${g.modValue || 0}" min="-20" max="20" title="Modifier value">
                    <span class="gift-modifier-summary ${g.type !== 'innate' && !g.active ? 'is-inactive' : 'is-active'}"
                      title="Resolved modifier summary">${this._esc(this._formatGiftModifierSummary(g))}</span>
                  </div>` : ''}
                <button class="btn-icon remove-gift-btn"
                  data-word-id="${word.id}" data-gift-id="${g.id}" title="Remove gift">✕</button>
                <textarea class="gift-description gift-field"
                  data-word-id="${word.id}" data-gift-id="${g.id}" data-gift-field="description"
                  placeholder="Description…" rows="2">${this._esc(g.description || '')}</textarea>
              </div>`;
            }).join('')}
          </div>` : '<p class="empty-msg-sm">No gifts yet.</p>'}
      </div>`
    ).join('');

    this._attachWordEvents();
  },

  _renderArcaneArts() {
    const el = document.getElementById('arcane-arts-list');
    if (!el) return;

    el.innerHTML = GoUtils.ARCANE_PRACTICES.map(cfg => {
      const items = this.char[cfg.key] || [];
      return `
        <section class="practice-category" data-practice-category="${cfg.key}">
          <div class="card-header practice-category-header">
            <div>
              <h3 class="section-subtitle">${cfg.title} <span class="card-title-ref">(${cfg.reference})</span></h3>
              <p class="formula-note">Add ${cfg.itemLabelPlural.toLowerCase()} and manage their ${cfg.entryLabelPlural.toLowerCase()} here.</p>
            </div>
            <div class="btn-group">
              <input type="text" class="input-sm practice-name-input"
                data-practice-category="${cfg.key}"
                placeholder="${cfg.addPlaceholder}" maxlength="80">
              <button class="btn-ghost add-practice-btn" data-practice-category="${cfg.key}">+ ${cfg.itemLabel}</button>
            </div>
          </div>
          <div class="practice-list">
            ${items.length ? items.map(item => this._renderPracticeBlock(cfg, item)).join('') : `<p class="empty-msg-sm">No ${cfg.itemLabelPlural.toLowerCase()} yet.</p>`}
          </div>
        </section>`;
    }).join('');

    this._attachArcaneEvents();
  },

  _renderPracticeBlock(cfg, item) {
    return `
      <div class="word-block practice-block" data-practice-category="${cfg.key}" data-practice-id="${item.id}">
        <div class="word-header practice-header">
          <input type="text" class="input-main practice-field practice-title-input"
            value="${this._esc(item.name)}"
            data-practice-category="${cfg.key}" data-practice-id="${item.id}" data-practice-field="name"
            placeholder="${cfg.addPlaceholder}" aria-label="${cfg.itemLabel} name">
          <div class="btn-group">
            <input type="text" class="input-sm practice-entry-name-input"
              data-practice-category="${cfg.key}" data-practice-id="${item.id}"
              placeholder="${cfg.entryPlaceholder}" maxlength="80">
            <button class="btn-ghost add-practice-entry-btn"
              data-practice-category="${cfg.key}" data-practice-id="${item.id}">+ ${cfg.entryLabel}</button>
            <button class="btn-danger remove-practice-btn"
              data-practice-category="${cfg.key}" data-practice-id="${item.id}">Remove</button>
          </div>
        </div>
        <div class="practice-notes-wrap">
          <textarea class="notes-area practice-field practice-notes"
            data-practice-category="${cfg.key}" data-practice-id="${item.id}" data-practice-field="notes"
            placeholder="${cfg.itemLabel} notes…" rows="2">${this._esc(item.notes || '')}</textarea>
        </div>
        ${item.entries.length ? `
          <div class="gifts-list practice-entries-list">
            <div class="gifts-header">
              <span class="gift-col-type">On</span>
              <span class="gift-col-name">${cfg.entryLabel}</span>
              <span class="gift-col-act">Activation</span>
              <span class="gift-col-effort">Effort</span>
            </div>
            ${item.entries.map(entry => `
              <div class="gift-row ${entry.active ? 'gift-active' : ''}" data-practice-entry-id="${entry.id}">
                <button class="gift-toggle-btn practice-entry-toggle-btn"
                  data-practice-category="${cfg.key}" data-practice-id="${item.id}" data-practice-entry-id="${entry.id}"
                  title="Toggle active">${entry.active ? '◉' : '○'}</button>
                <input type="text" class="input-main practice-entry-field"
                  value="${this._esc(entry.name)}"
                  data-practice-category="${cfg.key}" data-practice-id="${item.id}" data-practice-entry-id="${entry.id}" data-practice-entry-field="name"
                  placeholder="${cfg.entryLabel} name" aria-label="${cfg.entryLabel} name">
                <select class="input-sm practice-entry-field"
                  data-practice-category="${cfg.key}" data-practice-id="${item.id}" data-practice-entry-id="${entry.id}" data-practice-entry-field="activation"
                  title="Activation type">
                  ${['Constant','Instant','On Turn','Action'].map(a =>
                    `<option value="${a}" ${(entry.activation || 'Action') === a ? 'selected' : ''}>${a}</option>`
                  ).join('')}
                </select>
                <input type="text" class="input-sm practice-entry-field"
                  value="${this._esc(entry.effort || '')}"
                  data-practice-category="${cfg.key}" data-practice-id="${item.id}" data-practice-entry-id="${entry.id}" data-practice-entry-field="effort"
                  placeholder="Effort" aria-label="Effort cost">
                <button class="btn-icon remove-practice-entry-btn"
                  data-practice-category="${cfg.key}" data-practice-id="${item.id}" data-practice-entry-id="${entry.id}"
                  title="Remove ${cfg.entryLabel.toLowerCase()}">✕</button>
                <textarea class="gift-description practice-entry-field"
                  data-practice-category="${cfg.key}" data-practice-id="${item.id}" data-practice-entry-id="${entry.id}" data-practice-entry-field="description"
                  placeholder="Description…" rows="2">${this._esc(entry.description || '')}</textarea>
              </div>`).join('')}
          </div>` : `<p class="empty-msg-sm">No ${cfg.entryLabelPlural.toLowerCase()} yet.</p>`}
      </div>`;
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

      <!-- Artifacts -->
      <div class="equip-section">
        <div class="equip-section-header">
          <h3>Artifacts</h3>
          <button id="add-artifact-btn" class="btn-ghost">+ Add</button>
        </div>
        ${(c.artifacts || []).length ? `
          <table class="equip-table">
            <thead><tr><th>Name</th><th>Effort</th><th>Creation Cost</th><th>Notes</th><th></th></tr></thead>
            <tbody>
              ${(c.artifacts || []).map(a => `
                <tr data-equip-id="${a.id}" data-equip-type="artifact">
                  <td><input type="text" class="input-main equip-field" value="${this._esc(a.name)}"
                    data-id="${a.id}" data-type="artifact" data-f="name" aria-label="Artifact name"></td>
                  <td><input type="number" class="input-sm equip-field" value="${a.effort}"
                    data-id="${a.id}" data-type="artifact" data-f="effort" aria-label="Effort cost"></td>
                  <td><input type="number" class="input-sm equip-field" value="${a.creationCost}"
                    data-id="${a.id}" data-type="artifact" data-f="creationCost" aria-label="Creation cost"></td>
                  <td><input type="text" class="input-main equip-field" value="${this._esc(a.notes)}"
                    data-id="${a.id}" data-type="artifact" data-f="notes" placeholder="Abilities & notes" aria-label="Notes"></td>
                  <td><button class="btn-icon remove-equip-btn" data-id="${a.id}" data-type="artifact">✕</button></td>
                </tr>`).join('')}
            </tbody>
          </table>` : '<p class="empty-msg-sm">No artifacts.</p>'}
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

  /* ─── Servants render ───────────────────────────────────────────── */

  _renderServants() {
    const el = document.getElementById('servants-list');
    if (!el) return;

    /* Populate the stock enemy dropdown */
    const sel = document.getElementById('servant-stock-select');
    if (sel) {
      const enemies = (typeof GoDataEditor !== 'undefined' && GoDataEditor.data)
        ? (GoDataEditor.data.enemies || []) : [];
      sel.innerHTML = `<option value="">— select stock enemy —</option>` +
        enemies.map(e =>
          `<option value="${this._esc(e.id)}"
             data-name="${this._esc(e.name)}"
             data-hp="${e.hp}"
             data-ac="${e.ac}"
             data-notes="${this._esc(e.notes || '')}">${this._esc(e.name)} (HP&nbsp;${e.hp}, AC&nbsp;${e.ac})</option>`
        ).join('');
    }

    const servants = this.char.servants || [];
    if (!servants.length) {
      el.innerHTML = '<p class="empty-msg-sm">No servants or minions yet.</p>';
      return;
    }

    el.innerHTML = `
      <table class="equip-table">
        <thead>
          <tr><th>Name</th><th>HP</th><th>AC</th><th>Notes</th><th></th></tr>
        </thead>
        <tbody>
          ${servants.map(s => `
            <tr data-servant-id="${s.id}">
              <td><input type="text" class="input-main servant-field" value="${this._esc(s.name || '')}"
                data-id="${s.id}" data-f="name" aria-label="Servant name"></td>
              <td><input type="number" class="input-sm servant-field" value="${s.hp || 0}"
                data-id="${s.id}" data-f="hp" min="0" aria-label="Servant HP"></td>
              <td><input type="number" class="input-sm servant-field" value="${s.ac || 0}"
                data-id="${s.id}" data-f="ac" min="0" aria-label="Servant AC"></td>
              <td><input type="text" class="input-main servant-field" value="${this._esc(s.notes || '')}"
                data-id="${s.id}" data-f="notes" placeholder="Notes" aria-label="Servant notes"></td>
              <td><button class="btn-icon remove-servant-btn" data-id="${s.id}" title="Remove servant">✕</button></td>
            </tr>`).join('')}
        </tbody>
      </table>`;

    this._attachServantEvents();
  },

  _attachServantEvents() {
    document.querySelectorAll('.remove-servant-btn').forEach(btn =>
      btn.addEventListener('click', () => this._removeServant(btn.dataset.id)));

    document.querySelectorAll('.servant-field').forEach(inp =>
      inp.addEventListener('change', () => {
        const servant = (this.char.servants || []).find(s => s.id === inp.dataset.id);
        if (!servant) return;
        servant[inp.dataset.f] = inp.type === 'number' ? (parseInt(inp.value, 10) || 0) : inp.value;
        this._save();
      }));
  },

  _addServant(data) {
    if (!Array.isArray(this.char.servants)) this.char.servants = [];
    this.char.servants.push({
      id:    GoUtils.uid(),
      name:  (data.name  || '').trim(),
      hp:    parseInt(data.hp,  10) || 0,
      ac:    parseInt(data.ac,  10) || 0,
      notes: (data.notes || '').trim()
    });
    this._save();
    this._renderServants();
  },

  _removeServant(id) {
    if (!Array.isArray(this.char.servants)) return;
    this.char.servants = this.char.servants.filter(s => s.id !== id);
    this._save();
    this._renderServants();
  },

  _updateAttrMod(attr) {
    const scoreEl = document.querySelector(`[data-field="attr-${attr}"]`);
    const bonusEl = document.querySelector(`[data-field="bonus-${attr}"]`);
    const modEl   = document.getElementById(`attr-mod-${attr}`);
    if (!scoreEl || !bonusEl || !modEl) return;
    const score = this._computeFinalScore(attr);
    const bonus = parseInt(bonusEl.value, 10) || 0;
    const { bonusAdj } = this._getGiftAttrAdjustments(attr);
    const mod   = GoUtils.getAttrMod(score) + bonus + bonusAdj;
    modEl.textContent = GoUtils.formatMod(mod);
    modEl.className   = `attr-mod ${mod >= 0 ? 'mod-pos' : 'mod-neg'}`;
    const checkEl = document.getElementById(`attr-check-${attr}`);
    if (checkEl) checkEl.textContent = 21 - score;
    this._updateSaves();
    if (attr === 'con') this._updateHPMax();
    this._updateAttackBonuses();
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
    // Keep current HP within valid range after recalculation.
    if (curEl) {
      const parsedCur = parseInt(curEl.value, 10);
      const cur = Number.isNaN(parsedCur) ? max : parsedCur;
      const clamped = GoUtils.clamp(cur, 0, max);
      curEl.value = clamped;
      this.char.hp.current = clamped;
    }
  },

  _computeFinalMod(attr) {
    const bonusEl = document.querySelector(`[data-field="bonus-${attr}"]`);
    const score = this._computeFinalScore(attr);
    const bonus = bonusEl ? (parseInt(bonusEl.value, 10) || 0) : ((this.char.attrBonuses && this.char.attrBonuses[attr]) || 0);
    const { bonusAdj } = this._getGiftAttrAdjustments(attr);
    return GoUtils.getAttrMod(score) + bonus + bonusAdj;
  },

  _armorTypeToBaseAC(type) {
    return { none: 9, light: 7, medium: 5, heavy: 3 }[type] ?? 9;
  },

  _computeBaseAC() {
    const el = document.querySelector('[data-field="armor-type"]');
    const type = el ? el.value : (this.char.armorType || 'none');
    return this._armorTypeToBaseAC(type);
  },

  _updateAC() {
    const SHIELD_MOD = 1; // penalty applied when wielding a shield or cloak
    const baseAC    = this._computeBaseAC();
    const shieldEl  = document.querySelector('[data-field="shield-or-cloak"]');
    const hasShield = shieldEl ? shieldEl.value === 'yes' : (this.char.shieldOrCloak || false);
    const defAttrEl = document.querySelector('[data-field="defense-attr"]');
    const defAttr   = defAttrEl ? defAttrEl.value : (this.char.defenseAttr || 'dex');
    const defMod    = this._computeFinalMod(defAttr);
    const totalAC   = baseAC - (hasShield ? SHIELD_MOD : 0) - defMod;
    const baseEl    = document.querySelector('[data-field="base-ac"]');
    const totalEl   = document.querySelector('[data-field="ac"]');
    if (baseEl)  baseEl.value  = baseAC;
    if (totalEl) totalEl.value = totalAC;
    this.char.ac = totalAC;
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
    // also update HP and AC when saves/attributes change
    this._updateHPMax();
    this._updateAC();
  },

  _updateInfluence() {
    const levelEl = document.querySelector('[data-field="level"]');
    const level = levelEl ? (parseInt(levelEl.value, 10) || this.char.level || 1) : (this.char.level || 1);
    
    const bonusEl = document.querySelector('[data-field="influence-bonus"]');
    const bonus = bonusEl ? (parseInt(bonusEl.value, 10) || 0) : (this.char.influence?.bonus || 0);
    
    // Formula: 2 at Level 1, +1 per additional level, + Bonuses
    // = 1 + level + bonus
    const maxInfluence = 1 + level + bonus;
    
    const maxEl = document.querySelector('[data-field="influence-max"]');
    if (maxEl) {
      maxEl.value = maxInfluence;
    }
    
    if (this.char && this.char.influence) {
      this.char.influence.max = maxInfluence;
      this.char.influence.bonus = bonus;
    }
  },

  _updateEffort() {
    const levelEl = document.querySelector('[data-field="level"]');
    const level = levelEl ? (parseInt(levelEl.value, 10) || this.char.level || 1) : (this.char.level || 1);
    
    const bonusEl = document.querySelector('[data-field="effort-bonus"]');
    const bonus = bonusEl ? (parseInt(bonusEl.value, 10) || 0) : (this.char.effort?.bonus || 0);
    
    // Formula: 2 at Level 1, +1 per level, + Bonuses
    // = 1 + level + bonus
    const totalEffort = 1 + level + bonus;
    
    const totalEl = document.querySelector('[data-field="effort-total"]');
    if (totalEl) {
      totalEl.value = totalEffort;
    }
    
    if (this.char && this.char.effort) {
      this.char.effort.total = totalEffort;
      this.char.effort.bonus = bonus;
    }
  },

  _updateLevelFacts() {
    const levelEl = document.querySelector('[data-field="level"]');
    const parsed = levelEl ? parseInt(levelEl.value, 10) : NaN;
    const level = !isNaN(parsed) ? parsed : (this.char.level || 1);
    document.querySelectorAll('[data-level-fact-row]').forEach(el => {
      const factLevel = parseInt(el.dataset.levelFactRow, 10);
      el.style.display = factLevel <= level ? '' : 'none';
    });
  },

  _recalculateDerived() {
    this._updateSaves();
    this._updateHPMax();
    this._updateAC();
    this._updateInfluence();
    this._updateEffort();
    this._updateAttackBonuses();

    const c = this.char;
    const avail = document.querySelector('.effort-avail');
    if (avail && c && c.effort) {
      avail.textContent = c.effort.total - c.effort.committedDay - c.effort.committedScene;
    }
    this._updateStatBanner();
  },

  _updateAttackBonuses() {
    const levelEl = document.querySelector('[data-field="level"]');
    const fallback = this.char?.level || 1;
    const level = levelEl ? (parseInt(levelEl.value, 10) || fallback) : fallback;

    const meleeEl  = document.getElementById('attack-melee');
    const rangedEl = document.getElementById('attack-ranged');
    const customEl = document.getElementById('attack-custom');
    const attrSel  = document.querySelector('[data-field="custom-attack-attr"]');

    if (meleeEl)  meleeEl.value  = level + this._computeFinalMod('str');
    if (rangedEl) rangedEl.value = level + this._computeFinalMod('dex');

    if (attrSel && customEl) {
      const attr = attrSel.value || (this.char?.customAttackAttr || GoCharacter.DEFAULT_CUSTOM_ATTACK_ATTR);
      customEl.value = level + this._computeFinalMod(attr);
    }
  },

  /* ─── Stat banner live update ───────────────────────────────────── */

  _updateStatBanner() {
    const c = this.char;
    if (!c) return;

    /* HP */
    const hpCurEl = document.querySelector('[data-field="hp-current"]');
    const hpMaxEl = document.querySelector('[data-field="hp-max"]');
    const hpCur   = hpCurEl ? (parseInt(hpCurEl.value, 10) || 0) : (c.hp?.current ?? 0);
    const hpMax   = hpMaxEl ? (parseInt(hpMaxEl.value, 10) || 1) : (c.hp?.max ?? 1);
    const hpRatio = hpMax > 0 ? hpCur / hpMax : 1;
    const hpCls   = hpRatio > 0.6 ? 'stat-hp-ok' : hpRatio > 0.25 ? 'stat-hp-warn' : 'stat-hp-low';

    const hpPip = document.getElementById('banner-pip-hp');
    if (hpPip) {
      hpPip.classList.remove('stat-hp-ok', 'stat-hp-warn', 'stat-hp-low');
      hpPip.classList.add(hpCls);
    }
    const bHpCur = document.getElementById('banner-hp-cur');
    const bHpMax = document.getElementById('banner-hp-max');
    if (bHpCur) bHpCur.textContent = hpCur;
    if (bHpMax) bHpMax.textContent = hpMax;

    /* AC */
    const acFormEl = document.querySelector('[data-field="ac"]');
    const bAC = document.getElementById('banner-ac');
    if (bAC) bAC.textContent = acFormEl ? acFormEl.value : (c.ac ?? '—');

    /* Saves */
    const hardFormEl = document.querySelector('[data-field="save-hardiness"]');
    const evaFormEl  = document.querySelector('[data-field="save-evasion"]');
    const spiFormEl  = document.querySelector('[data-field="save-spirit"]');
    const bHard = document.getElementById('banner-hardiness');
    const bEva  = document.getElementById('banner-evasion');
    const bSpi  = document.getElementById('banner-spirit');
    if (bHard && hardFormEl) bHard.textContent = hardFormEl.value;
    if (bEva  && evaFormEl)  bEva.textContent  = evaFormEl.value;
    if (bSpi  && spiFormEl)  bSpi.textContent  = spiFormEl.value;

    /* Effort */
    const effortTotalEl = document.querySelector('[data-field="effort-total"]');
    const effortDayEl   = document.querySelector('[data-field="effort-day"]');
    const effortSceneEl = document.querySelector('[data-field="effort-scene"]');
    const eTotal = effortTotalEl ? (parseInt(effortTotalEl.value, 10) || 0) : (c.effort?.total ?? 0);
    const eDay   = effortDayEl   ? (parseInt(effortDayEl.value,   10) || 0) : (c.effort?.committedDay ?? 0);
    const eScene = effortSceneEl ? (parseInt(effortSceneEl.value, 10) || 0) : (c.effort?.committedScene ?? 0);
    const bEffortAvail = document.getElementById('banner-effort-avail');
    const bEffortMax   = document.getElementById('banner-effort-max');
    if (bEffortAvail) bEffortAvail.textContent = eTotal - eDay - eScene;
    if (bEffortMax)   bEffortMax.textContent   = eTotal;

    /* Influence */
    const infCurFormEl = document.querySelector('[data-field="influence-current"]');
    const infMaxFormEl = document.querySelector('[data-field="influence-max"]');
    const bInfCur = document.getElementById('banner-influence-cur');
    const bInfMax = document.getElementById('banner-influence-max');
    if (bInfCur && infCurFormEl) bInfCur.textContent = infCurFormEl.value;
    if (bInfMax && infMaxFormEl) bInfMax.textContent = infMaxFormEl.value;
  },

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

    /* Recalculate derived values when level changes */
    const levelInput = document.querySelector('[data-field="level"]');
    levelInput?.addEventListener('input', () => { this._updateLevelFacts(); this._recalculateDerived(); });
    levelInput?.addEventListener('change', () => { this._updateLevelFacts(); this._recalculateDerived(); });

    /* Recalculate HP when HP bonus changes */
    const hpBonusInput = document.querySelector('[data-field="hp-max-bonus"]');
    hpBonusInput?.addEventListener('input', () => { this._updateHPMax(); });
    hpBonusInput?.addEventListener('change', () => { this._updateHPMax(); });

    /* Ensure HP recalculates whenever Constitution score/bonus changes */
    const conScoreInput = document.querySelector('[data-field="attr-con"]');
    const conBonusInput = document.querySelector('[data-field="bonus-con"]');
    conScoreInput?.addEventListener('change', () => { this._updateHPMax(); });
    conBonusInput?.addEventListener('change', () => { this._updateHPMax(); });

    /* Recalculate Effort when bonus changes */
    document.querySelector('[data-field="effort-bonus"]')
      ?.addEventListener('input', () => { this._updateEffort(); });

    /* Recalculate Influence when bonus changes */
    document.querySelector('[data-field="influence-bonus"]')
      ?.addEventListener('input', () => { this._updateInfluence(); });

    /* Recalculate Total Dominion when Earned or Spent changes */
    const _updateDominionTotal = () => {
      const earnedEl = document.querySelector('[data-field="dominion-earned"]');
      const spentEl  = document.querySelector('[data-field="dominion-spent"]');
      const totalEl  = document.querySelector('[data-field="dominion-total"]');
      if (totalEl) {
        const earned = earnedEl ? (parseInt(earnedEl.value, 10) || 0) : 0;
        const spent  = spentEl  ? (parseInt(spentEl.value,  10) || 0) : 0;
        totalEl.value = earned + spent;
      }
    };
    document.querySelector('[data-field="dominion-earned"]')
      ?.addEventListener('input', _updateDominionTotal);
    document.querySelector('[data-field="dominion-spent"]')
      ?.addEventListener('input', _updateDominionTotal);

    /* Recalculate AC when armour settings change */
    document.querySelector('[data-field="armor-type"]')
      ?.addEventListener('change', () => { this._updateAC(); });
    document.querySelector('[data-field="shield-or-cloak"]')
      ?.addEventListener('change', () => { this._updateAC(); });
    document.querySelector('[data-field="defense-attr"]')
      ?.addEventListener('change', () => { this._updateAC(); });

    /* Add Shrine button */
    document.getElementById('add-shrine-btn')?.addEventListener('click', () => this.addShrine());

    /* Divine Servant checkbox – toggle servant name visibility */
    document.getElementById('divine-servant-check')?.addEventListener('change', e => {
      this._toggleServantNameVisibility(e.target.checked);
      this.char.divineServant = e.target.checked;
      this._save();
    });

    /* Servants & Minions – stock enemy dropdown pre-fill */
    document.getElementById('servant-stock-select')?.addEventListener('change', e => {
      const opt = e.target.options[e.target.selectedIndex];
      if (!opt || !opt.value) return;
      const nameEl  = document.getElementById('servant-name-input');
      const hpEl    = document.getElementById('servant-hp-input');
      const acEl    = document.getElementById('servant-ac-input');
      const notesEl = document.getElementById('servant-notes-input');
      if (nameEl)  nameEl.value  = opt.dataset.name  || '';
      if (hpEl)    hpEl.value    = opt.dataset.hp    || '';
      if (acEl)    acEl.value    = opt.dataset.ac    || '';
      if (notesEl) notesEl.value = opt.dataset.notes || '';
      e.target.value = '';
    });

    /* Servants & Minions – Add from stock enemy button */
    document.getElementById('add-servant-from-stock-btn')?.addEventListener('click', () => {
      const nameEl = document.getElementById('servant-name-input');
      const name = nameEl ? nameEl.value.trim() : '';
      if (!name) { GoApp.toast('Please enter a servant name', 'error'); return; }
      this._addServantFromForm();
    });

    /* Servants & Minions – Add servant button */
    document.getElementById('add-servant-btn')?.addEventListener('click', () => {
      this._addServantFromForm();
    });

    document.getElementById('servant-name-input')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') this._addServantFromForm();
    });

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

  _toggleServantNameVisibility(show) {
    const wrap = document.getElementById('servant-name-wrap');
    if (wrap) wrap.style.display = show ? '' : 'none';
  },

  _addServantFromForm() {
    const nameEl  = document.getElementById('servant-name-input');
    const hpEl    = document.getElementById('servant-hp-input');
    const acEl    = document.getElementById('servant-ac-input');
    const notesEl = document.getElementById('servant-notes-input');
    const name = nameEl ? nameEl.value.trim() : '';
    if (!name) { GoApp.toast('Servant needs a name', 'error'); return; }
    this._addServant({
      name,
      hp:    hpEl    ? hpEl.value    : 0,
      ac:    acEl    ? acEl.value    : 0,
      notes: notesEl ? notesEl.value : ''
    });
    if (nameEl)  nameEl.value  = '';
    if (hpEl)    hpEl.value    = '';
    if (acEl)    acEl.value    = '';
    if (notesEl) notesEl.value = '';
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
        const field = inp.dataset.giftField;
        if (field === 'modifiesAttribute') {
          gift[field] = inp.checked;
          this._save();
          this._renderWords();
          this._refreshDerivedFromGiftModifiers();
          return;
        }
        gift[field] = inp.type === 'checkbox'
          ? inp.checked
          : inp.type === 'number'
            ? (parseInt(inp.value, 10) || 0)
            : inp.value;
        this._save();
        if (field === 'modAttribute' || field === 'modType' || field === 'modValue') {
          this._refreshDerivedFromGiftModifiers();
        }
      });
    });
  },

  _attachArcaneEvents() {
    document.querySelectorAll('.add-practice-btn').forEach(btn =>
      btn.addEventListener('click', () => {
        const category = btn.dataset.practiceCategory;
        const input = document.querySelector(`.practice-name-input[data-practice-category="${category}"]`);
        if (!input) return;
        this.addPractice(category, input.value);
        input.value = '';
      }));

    document.querySelectorAll('.practice-name-input').forEach(input =>
      input.addEventListener('keydown', e => {
        if (e.key !== 'Enter') return;
        this.addPractice(input.dataset.practiceCategory, input.value);
        input.value = '';
      }));

    document.querySelectorAll('.remove-practice-btn').forEach(btn =>
      btn.addEventListener('click', () => {
        const category = btn.dataset.practiceCategory;
        const cfg = GoUtils.getArcanePracticeConfig(category);
        if (!cfg) return;
        if (confirm(`Remove this ${cfg.itemLabel.toLowerCase()}?`)) {
          this.removePractice(category, btn.dataset.practiceId);
        }
      }));

    document.querySelectorAll('.add-practice-entry-btn').forEach(btn =>
      btn.addEventListener('click', () => {
        const category = btn.dataset.practiceCategory;
        const practiceId = btn.dataset.practiceId;
        const input = document.querySelector(`.practice-entry-name-input[data-practice-category="${category}"][data-practice-id="${practiceId}"]`);
        if (!input) return;
        this.addPracticeEntry(category, practiceId, input.value);
        input.value = '';
      }));

    document.querySelectorAll('.practice-entry-name-input').forEach(input =>
      input.addEventListener('keydown', e => {
        if (e.key !== 'Enter') return;
        this.addPracticeEntry(input.dataset.practiceCategory, input.dataset.practiceId, input.value);
        input.value = '';
      }));

    document.querySelectorAll('.remove-practice-entry-btn').forEach(btn =>
      btn.addEventListener('click', () =>
        this.removePracticeEntry(btn.dataset.practiceCategory, btn.dataset.practiceId, btn.dataset.practiceEntryId)));

    document.querySelectorAll('.practice-entry-toggle-btn').forEach(btn =>
      btn.addEventListener('click', () =>
        this.togglePracticeEntry(btn.dataset.practiceCategory, btn.dataset.practiceId, btn.dataset.practiceEntryId)));

    document.querySelectorAll('.practice-field').forEach(input =>
      input.addEventListener('change', () => {
        const practice = (this.char[input.dataset.practiceCategory] || []).find(item => item.id === input.dataset.practiceId);
        if (!practice) return;
        practice[input.dataset.practiceField] = input.value;
        this._save();
      }));

    document.querySelectorAll('.practice-entry-field').forEach(input =>
      input.addEventListener('change', () => {
        const practice = (this.char[input.dataset.practiceCategory] || []).find(item => item.id === input.dataset.practiceId);
        if (!practice) return;
        const entry = practice.entries.find(item => item.id === input.dataset.practiceEntryId);
        if (!entry) return;
        entry[input.dataset.practiceEntryField] = input.value;
        this._save();
      }));
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
    document.getElementById('add-artifact-btn')?.addEventListener('click', () => this.addArtifact());

    document.querySelectorAll('.remove-equip-btn').forEach(btn =>
      btn.addEventListener('click', () => {
        const type = btn.dataset.type;
        if (type === 'weapon') this.removeWeapon(btn.dataset.id);
        else if (type === 'armor') this.removeArmor(btn.dataset.id);
        else if (type === 'artifact') this.removeArtifact(btn.dataset.id);
        else this.removeEquipItem(btn.dataset.id);
      }));

    document.querySelectorAll('.equip-field').forEach(inp =>
      inp.addEventListener('change', () => {
        const list = inp.dataset.type === 'weapon'   ? this.char.weapons
                   : inp.dataset.type === 'armor'    ? this.char.armor
                   : inp.dataset.type === 'artifact' ? (this.char.artifacts || [])
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
      'armor-type':       v => c.armorType         = v,
      'shield-or-cloak':  v => c.shieldOrCloak     = (v === 'yes'),
      'defense-attr':     v => c.defenseAttr       = v,
      'attack-bonus':     v => c.attackBonus       = parseInt(v,10)||0,
      'custom-attack-attr': v => { c.customAttackAttr = v; this._updateAttackBonuses(); },
      'fray-bonus-dice':  v => c.frayBonusDice      = v,
      'unarmed-damage':   v => c.unarmedDamage       = v,
      'save-hardiness':   v => c.saves.hardiness   = parseInt(v,10)||15,
      'save-evasion':     v => c.saves.evasion     = parseInt(v,10)||15,
      'save-spirit':      v => c.saves.spirit      = parseInt(v,10)||15,
      'effort-total':     v => c.effort.total      = parseInt(v,10)||0,
      'effort-day':       v => c.effort.committedDay   = parseInt(v,10)||0,
      'effort-scene':     v => c.effort.committedScene = parseInt(v,10)||0,
      'effort-bonus':     v => c.effort.bonus      = parseInt(v,10)||0,
      'dominion-earned':  v => { c.dominion.earned = parseInt(v,10)||0; c.dominion.total = (c.dominion.earned||0) + (c.dominion.spent||0); },
      'dominion-spent':   v => { c.dominion.spent  = parseInt(v,10)||0; c.dominion.total = (c.dominion.earned||0) + (c.dominion.spent||0); },
      'divine-servant':   v => c.divineServant = (v === 'true'),
      'servant-name':     v => c.servantName   = v,
      'influence-current':v => c.influence.current = parseInt(v,10)||0,
      'influence-max':    v => c.influence.max     = parseInt(v,10)||0,
      'influence-bonus':  v => c.influence.bonus   = parseInt(v,10)||0,
      'wealth-total':     v => { if (!c.wealth) c.wealth = {}; c.wealth.total = parseInt(v,10)||0; },
      'wealth-free':      v => { if (!c.wealth) c.wealth = {}; c.wealth.free  = parseInt(v,10)||0; },
      'wealth-cult':      v => { if (!c.wealth) c.wealth = {}; c.wealth.cult  = parseInt(v,10)||0; },
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
      const value  = el.type === 'checkbox' ? (el.checked ? 'true' : 'false') : el.value;

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

    /* Refresh fray dice display and attr mods */
    document.querySelectorAll('.attr-block').forEach(block => {
      const inp  = block.querySelector('[data-field^="attr-"]');
      if (!inp) return;
      const attr = inp.dataset.field.slice(5);
      const mod  = this._computeFinalMod(attr);
      const modEl = block.querySelector('.attr-mod');
      if (modEl) {
        modEl.textContent = GoUtils.formatMod(mod);
        modEl.className   = `attr-mod ${mod >= 0 ? 'mod-pos' : 'mod-neg'}`;
      }
    });

    /* Recalculate derived values before persisting so computed fields are saved */
    this._recalculateDerived();

    this._save();

    const frayEl = document.querySelector('[data-field="level"]');

    if (frayEl) {
      const badge = document.querySelector('.fray-badge');
      if (badge) badge.textContent = GoUtils.getFrayDiceDisplay(c.level, c.frayBonusDice);
    }

    /* Update char selector label */
    const sel = document.getElementById('char-select');
    if (sel) sel.options[this.activeIdx].text = c.name;

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
