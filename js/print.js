'use strict';

/**
 * Print & Share module.
 * Provides printable character summaries (in a new window) and
 * shareable URLs with the character data encoded in the query string.
 */
const GoPrint = {

  /* ─── Public API ────────────────────────────────────────────────── */

  /** Show a modal to choose between Summary and Full Sheet, then open the print window. */
  async printCharacter(char) {
    const mode = await this._showPrintModal();
    if (!mode) return;
    const html = mode === 'summary'
      ? this._buildShortSummaryHTML(char)
      : this._buildFullSheetHTML(char);
    this._openPrintWindow(html);
  },

  /** Open a formatted print window without auto-triggering the print dialog. */
  _openPrintWindow(html) {
    const win = window.open('', '_blank', 'width=960,height=800,scrollbars=yes,resizable=yes');
    if (!win) {
      GoApp.toast('Pop-ups blocked – please allow pop-ups to print', 'error');
      return;
    }
    win.document.write(html);
    win.document.close();
    win.focus();
  },

  /**
   * Show a modal asking whether to print the Summary or Full Sheet.
   * Returns a Promise that resolves to 'summary', 'full', or null (cancel).
   */
  _showPrintModal() {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'iex-overlay';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-labelledby', 'print-modal-title');
      overlay.innerHTML = `
        <div class="iex-modal">
          <h3 id="print-modal-title" class="iex-title">🖨️ Print Character Sheet</h3>
          <p class="iex-body">Choose the format you would like to print:</p>
          <ul class="iex-list">
            <li>
              <strong>Summary</strong> – a compact overview with key stats,
              attributes, saves, combat values, divine resources, and a brief
              list of Words of Power.
            </li>
            <li>
              <strong>Full Sheet</strong> – the complete character sheet
              including all Words of Power gifts, Arcane Arts, Apotheosis Gifts,
              Servants, Equipment, Artifacts, Cult, and Notes.
            </li>
          </ul>
          <div class="iex-actions">
            <button class="btn-primary print-summary-btn">📋 Summary</button>
            <button class="btn-secondary print-full-btn">📄 Full Sheet</button>
            <button class="btn-ghost print-cancel-btn">Cancel</button>
          </div>
        </div>`;

      document.body.appendChild(overlay);

      const cleanup = result => {
        document.removeEventListener('keydown', onKeyDown);
        document.body.removeChild(overlay);
        resolve(result);
      };

      const focusable = () => Array.from(overlay.querySelectorAll('button'));
      const onKeyDown = e => {
        if (e.key === 'Escape') { cleanup(null); return; }
        if (e.key === 'Tab') {
          const els   = focusable();
          const first = els[0];
          const last  = els[els.length - 1];
          if (e.shiftKey ? document.activeElement === first : document.activeElement === last) {
            e.preventDefault();
            (e.shiftKey ? last : first).focus();
          }
        }
      };
      document.addEventListener('keydown', onKeyDown);
      requestAnimationFrame(() => { const els = focusable(); if (els[0]) els[0].focus(); });

      overlay.querySelector('.print-summary-btn').addEventListener('click', () => cleanup('summary'));
      overlay.querySelector('.print-full-btn').addEventListener('click',    () => cleanup('full'));
      overlay.querySelector('.print-cancel-btn').addEventListener('click',  () => cleanup(null));
      overlay.addEventListener('click', e => { if (e.target === overlay) cleanup(null); });
    });
  },

  /** Encode the active character as a URL-safe string and copy to clipboard. */
  copyShareLink(char) {
    const encoded = this._encode(char);
    const url     = `${location.protocol}//${location.host}${location.pathname}?share=${encoded}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url)
        .then(() => GoApp.toast('Share link copied to clipboard!', 'success'))
        .catch(() => this._fallbackCopy(url));
    } else {
      this._fallbackCopy(url);
    }
  },

  /**
   * Called on app init – if a ?share= query param is present, offer
   * to import the encoded character into the toolkit.
   */
  checkShareParam() {
    const params  = new URLSearchParams(location.search);
    const encoded = params.get('share');
    if (!encoded) return;

    /* Remove the param from the URL so a page-refresh won't re-prompt */
    history.replaceState(null, '', location.pathname);

    let char;
    try {
      char = JSON.parse(decodeURIComponent(atob(encoded)));
    } catch {
      GoApp.toast('Could not decode share link', 'error');
      return;
    }

    if (!char || typeof char !== 'object' || !char.name) {
      GoApp.toast('Invalid share link data', 'error');
      return;
    }

    /* Defer the confirm dialog so the rest of app.init() can finish */
    setTimeout(() => {
      if (confirm(`Import shared character "${char.name}" into your toolkit?`)) {
        char.id = GoUtils.uid();   /* fresh id to avoid conflicts */
        GoCharacter.characters.push(char);
        GoCharacter.activeIdx = GoCharacter.characters.length - 1;
        GoCharacter._save();
        GoCharacter.render();
        GoApp._switchTab('character-tab');
        GoApp.toast(`"${char.name}" imported!`, 'success');
      }
    }, 300);
  },

  /* ─── Internal helpers ──────────────────────────────────────────── */

  _encode(char) {
    return btoa(encodeURIComponent(JSON.stringify(char)));
  },

  _fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try {
      document.execCommand('copy');
      GoApp.toast('Share link copied to clipboard!', 'success');
    } catch {
      prompt('Copy this share link:', text);
    }
    document.body.removeChild(ta);
  },

  _esc(str) {
    return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  },

  /* ─── HTML sheet builders ───────────────────────────────────────── */

  /**
   * Compact one-to-two-page summary: key stats only, no gift/ability details.
   */
  _buildShortSummaryHTML(c) {
    const e        = s => this._esc(s);
    const attrs    = c.attributes  || {};
    const bonuses  = c.attrBonuses || {};
    const hp       = c.hp          || {};
    const effort   = c.effort      || {};
    const dominion = c.dominion    || {};
    const influence= c.influence   || {};
    const wealth   = c.wealth      || {};

    const attrFull = { str:'Strength', con:'Constitution', dex:'Dexterity',
                       int:'Intelligence', wis:'Wisdom', cha:'Charisma' };

    const computeMod = attr => {
      const score = attrs[attr] || 10;
      const bonus = bonuses[attr] || 0;
      return GoUtils.getAttrMod(score) + bonus;
    };

    const level      = c.level || 1;
    const meleeAtk   = level + computeMod('str');
    const rangedAtk  = level + computeMod('dex');
    const customAttr = c.customAttackAttr || 'str';
    const customAtk  = level + computeMod(customAttr);
    const frayDice   = GoUtils.getFrayDiceDisplay(level, c.frayBonusDice);

    const attrRows = ['str','con','dex','int','wis','cha'].map(a => {
      const score = attrs[a] || 10;
      const bonus = bonuses[a] || 0;
      const mod   = GoUtils.getAttrMod(score) + bonus;
      const check = 21 - score;
      return `<tr>
        <td>${attrFull[a]}</td>
        <td class="num">${score}</td>
        <td class="num">${bonus >= 0 ? '+' + bonus : bonus}</td>
        <td class="num">${check}</td>
        <td class="num ${mod >= 0 ? 'pos' : 'neg'}">${GoUtils.formatMod(mod)}</td>
      </tr>`;
    }).join('');

    /* Words of Power – names only */
    const wordsList = (c.words || []).length
      ? (c.words || []).map(w => {
          const giftNames = (w.gifts || []).map(g => e(g.name)).join(', ');
          return `<li><strong>${e(w.name)}</strong>${giftNames ? ': ' + giftNames : ''}</li>`;
        }).join('')
      : '<li class="empty">None</li>';

    /* Level facts */
    const levelFactsHtml = Object.entries(c.levelFacts || {})
      .filter(([, v]) => v)
      .map(([lvl, v]) => `<div class="fact"><span class="fact-label">Level ${lvl}:</span> ${e(v)}</div>`)
      .join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${e(c.name)} – Summary Sheet</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { font-size: 13px; }
  body {
    font-family: 'Georgia', serif;
    color: #1a1a1a;
    background: #fff;
    padding: 1.2rem 1.8rem;
    max-width: 900px;
    margin: 0 auto;
  }
  .print-controls {
    display: flex;
    gap: .75rem;
    margin-bottom: 1rem;
    flex-wrap: wrap;
    align-items: center;
  }
  .print-controls h1 { font-size: 1rem; color: #555; font-weight: 400; flex: 1; }
  .btn-ctrl {
    padding: .45rem 1.1rem;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: .9rem;
    font-weight: 600;
    line-height: 1;
  }
  .btn-print { background: #5a3e8c; color: #fff; }
  .btn-print:hover { background: #7a5eb0; }
  .btn-close { background: #777; color: #fff; }
  .btn-close:hover { background: #555; }
  @media print { .print-controls { display: none !important; } }
  .char-header {
    border-bottom: 3px solid #5a3e8c;
    padding-bottom: .5rem;
    margin-bottom: .8rem;
  }
  .char-name { font-size: 1.9rem; font-weight: 700; color: #3a1e6c; line-height: 1.1; }
  .char-meta { display: flex; gap: 1.2rem; margin-top: .3rem; font-size: .9rem; color: #555; flex-wrap: wrap; }
  .char-meta span strong { color: #1a1a1a; }
  .section { margin-bottom: .9rem; page-break-inside: avoid; }
  .section-title {
    background: #5a3e8c;
    color: #fff;
    padding: .2rem .6rem;
    font-size: .82rem;
    font-weight: 700;
    letter-spacing: .05em;
    text-transform: uppercase;
    border-radius: 3px;
    margin-bottom: .4rem;
  }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: .9rem; }
  .three-col { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: .9rem; }
  @media (max-width: 580px) { .two-col, .three-col { grid-template-columns: 1fr; } }
  table { width: 100%; border-collapse: collapse; font-size: .85rem; }
  th {
    background: #ede8f7;
    color: #3a1e6c;
    font-weight: 700;
    text-align: left;
    padding: .2rem .4rem;
    border: 1px solid #c9b8e8;
    font-size: .75rem;
    text-transform: uppercase;
  }
  td { padding: .15rem .4rem; border: 1px solid #ddd; vertical-align: top; }
  tr:nth-child(even) td { background: #faf8ff; }
  td.num { text-align: center; font-variant-numeric: tabular-nums; }
  td.pos { color: #1a6b2c; font-weight: 700; }
  td.neg { color: #8b1a1a; font-weight: 700; }
  .stats-row { display: flex; gap: .5rem; flex-wrap: wrap; }
  .stat-box {
    background: #ede8f7;
    border: 1px solid #c9b8e8;
    border-radius: 4px;
    padding: .25rem .55rem;
    text-align: center;
    min-width: 62px;
  }
  .stat-box .stat-val { font-size: 1.2rem; font-weight: 700; color: #3a1e6c; line-height: 1.1; }
  .stat-box .stat-lbl { font-size: .65rem; text-transform: uppercase; color: #666; letter-spacing: .03em; }
  .stat-box .stat-sub { font-size: .6rem; color: #999; }
  .label {
    font-weight: 700;
    font-size: .75rem;
    color: #555;
    text-transform: uppercase;
    letter-spacing: .04em;
    margin: .3rem 0 .1rem;
  }
  .note  { font-size: .72rem; color: #777; margin-top: .2rem; }
  .fact { margin-bottom: .25rem; font-size: .88rem; }
  .fact-label { font-weight: 700; }
  .text-block {
    background: #faf9fe;
    border: 1px solid #ddd;
    border-radius: 3px;
    padding: .3rem .5rem;
    font-size: .88rem;
    white-space: pre-wrap;
    word-break: break-word;
  }
  ul.words-list { list-style: disc; padding-left: 1.25rem; font-size: .88rem; }
  ul.words-list li { margin-bottom: .2rem; }
  .empty { color: #999; font-style: italic; }
  .footer { margin-top: 1.2rem; color: #bbb; font-size: .7rem; text-align: center; }
</style>
</head>
<body>

<div class="print-controls">
  <h1>Godbound Toolkit – Character Summary</h1>
  <button class="btn-ctrl btn-print" onclick="window.print()">🖨️ Print / Save as PDF</button>
  <button class="btn-ctrl btn-close" onclick="window.close()">✕ Close</button>
</div>

<!-- ═══ HEADER ════════════════════════════════════════════════════════ -->
<div class="char-header">
  <div class="char-name">${e(c.name)}</div>
  <div class="char-meta">
    <span><strong>Level:</strong> ${c.level || 1}</span>
    <span><strong>Experience:</strong> ${c.experience || 0}</span>
    ${c.background ? `<span><strong>Background:</strong> ${e(c.background)}</span>` : ''}
  </div>
</div>

<div class="two-col">
  <!-- ── Facts ── -->
  <div>
    ${(c.origin || c.career || c.relationship || levelFactsHtml) ? `
    <div class="section">
      <div class="section-title">Facts</div>
      ${c.origin       ? `<div class="fact"><span class="fact-label">Origin:</span> ${e(c.origin)}</div>` : ''}
      ${c.career       ? `<div class="fact"><span class="fact-label">Career:</span> ${e(c.career)}</div>` : ''}
      ${c.relationship ? `<div class="fact"><span class="fact-label">Relationship:</span> ${e(c.relationship)}</div>` : ''}
      ${levelFactsHtml}
    </div>` : ''}
    ${c.goal ? `
    <div class="section">
      <div class="section-title">Goal</div>
      <div class="text-block">${e(c.goal)}</div>
    </div>` : ''}
  </div>

  <!-- ── Saves & Combat ── -->
  <div>
    <div class="section">
      <div class="section-title">Saving Throws</div>
      <div class="stats-row">
        <div class="stat-box"><div class="stat-val">${(c.saves || {}).hardiness || '—'}</div><div class="stat-lbl">Hardiness</div><div class="stat-sub">STR/CON</div></div>
        <div class="stat-box"><div class="stat-val">${(c.saves || {}).evasion   || '—'}</div><div class="stat-lbl">Evasion</div><div class="stat-sub">DEX/INT</div></div>
        <div class="stat-box"><div class="stat-val">${(c.saves || {}).spirit    || '—'}</div><div class="stat-lbl">Spirit</div><div class="stat-sub">WIS/CHA</div></div>
      </div>
    </div>
    <div class="section">
      <div class="section-title">Combat</div>
      <div class="stats-row">
        <div class="stat-box"><div class="stat-val">${hp.max || '—'}</div><div class="stat-lbl">HP Max</div></div>
        <div class="stat-box"><div class="stat-val">${hp.current ?? hp.max ?? '—'}</div><div class="stat-lbl">HP Cur</div></div>
        <div class="stat-box"><div class="stat-val">${c.ac ?? '—'}</div><div class="stat-lbl">AC</div></div>
        <div class="stat-box"><div class="stat-val">${GoUtils.formatMod(meleeAtk)}</div><div class="stat-lbl">Melee</div><div class="stat-sub">Lvl+STR</div></div>
        <div class="stat-box"><div class="stat-val">${GoUtils.formatMod(rangedAtk)}</div><div class="stat-lbl">Ranged</div><div class="stat-sub">Lvl+DEX</div></div>
        <div class="stat-box"><div class="stat-val" style="font-size:.9rem">${e(frayDice)}</div><div class="stat-lbl">Fray</div></div>
      </div>
    </div>
    <div class="section">
      <div class="section-title">Divine Resources</div>
      <div class="label">Effort</div>
      <div class="stats-row">
        <div class="stat-box"><div class="stat-val">${effort.total || 0}</div><div class="stat-lbl">Total</div></div>
        <div class="stat-box"><div class="stat-val">${(effort.total || 0) - (effort.committedDay || 0) - (effort.committedScene || 0)}</div><div class="stat-lbl">Free</div></div>
        <div class="stat-box"><div class="stat-val">${effort.committedScene || 0}</div><div class="stat-lbl">Scene</div></div>
        <div class="stat-box"><div class="stat-val">${effort.committedDay || 0}</div><div class="stat-lbl">Day</div></div>
      </div>
      <div class="label">Dominion</div>
      <div class="stats-row">
        <div class="stat-box"><div class="stat-val">${dominion.total || 0}</div><div class="stat-lbl">Total</div></div>
        <div class="stat-box"><div class="stat-val">${dominion.earned || 0}</div><div class="stat-lbl">Free</div></div>
        <div class="stat-box"><div class="stat-val">${dominion.spent || 0}</div><div class="stat-lbl">Spent</div></div>
      </div>
      <div class="label">Influence &amp; Wealth</div>
      <div class="stats-row">
        <div class="stat-box"><div class="stat-val">${influence.current || 0}&thinsp;/&thinsp;${influence.max || 0}</div><div class="stat-lbl">Influence</div></div>
        <div class="stat-box"><div class="stat-val">${wealth.total || 0}</div><div class="stat-lbl">Wealth Cache 1</div></div>
        <div class="stat-box"><div class="stat-val">${wealth.free || 0}</div><div class="stat-lbl">Wealth Cache 2</div></div>
      </div>
    </div>
  </div>
</div>

<!-- ═══ ATTRIBUTES ════════════════════════════════════════════════════ -->
<div class="section">
  <div class="section-title">Attributes</div>
  <table>
    <thead><tr><th>Attribute</th><th>Base</th><th>Bonus</th><th>Check</th><th>Mod</th></tr></thead>
    <tbody>${attrRows}</tbody>
  </table>
  <p class="note">CHECK = 21 − Base &nbsp;|&nbsp; MOD from Godbound table</p>
</div>

<!-- ═══ WORDS OF POWER ════════════════════════════════════════════════ -->
<div class="section">
  <div class="section-title">Words of Power</div>
  <ul class="words-list">${wordsList}</ul>
</div>

<p class="footer">Generated by Godbound Toolkit &nbsp;·&nbsp; ${new Date().toLocaleDateString()} &nbsp;·&nbsp; Summary Sheet</p>
</body>
</html>`;
  },

  /** Full character sheet – all powers, gifts, equipment, cult details, and notes. */
  _buildFullSheetHTML(c) {
    const e       = s => this._esc(s);
    const cult    = c.cult    || {};
    const wealth  = c.wealth  || {};
    const effort  = c.effort  || {};
    const dominion = c.dominion || {};
    const influence = c.influence || {};
    const hp      = c.hp      || {};
    const attrs   = c.attributes  || {};
    const bonuses = c.attrBonuses || {};

    const attrFull = { str:'Strength', con:'Constitution', dex:'Dexterity',
                       int:'Intelligence', wis:'Wisdom', cha:'Charisma' };

    /* ── Helper: compute attribute mod (base score + bonus) ── */
    const computeMod = attr => {
      const score = attrs[attr] || 10;
      const bonus = bonuses[attr] || 0;
      return GoUtils.getAttrMod(score) + bonus;
    };

    /* ── Derived combat values ── */
    const level      = c.level || 1;
    const meleeAtk   = level + computeMod('str');
    const rangedAtk  = level + computeMod('dex');
    const customAttr = c.customAttackAttr || 'str';
    const customAtk  = level + computeMod(customAttr);
    const frayDice   = GoUtils.getFrayDiceDisplay(level, c.frayBonusDice);

    /* ── Attribute table rows ── */
    const attrRows = ['str','con','dex','int','wis','cha'].map(a => {
      const score = attrs[a] || 10;
      const bonus = bonuses[a] || 0;
      const mod   = GoUtils.getAttrMod(score) + bonus;
      const check = 21 - score;
      return `<tr>
        <td>${attrFull[a]}</td>
        <td class="num">${score}</td>
        <td class="num">${bonus >= 0 ? '+' + bonus : bonus}</td>
        <td class="num">${check}</td>
        <td class="num ${mod >= 0 ? 'pos' : 'neg'}">${GoUtils.formatMod(mod)}</td>
      </tr>`;
    }).join('');

    /* ── Words of Power ── */
    const wordsHtml = (c.words || []).length
      ? (c.words || []).map(w => {
          const giftsRows = w.gifts && w.gifts.length
            ? w.gifts.map(g => {
                const modNote = g.modifiesAttribute
                  ? ` <em style="font-size:.8em;color:#666">(${g.modType === 'score' ? 'Score' : 'Bonus'}: ${g.modValue >= 0 ? '+' + g.modValue : g.modValue} ${String(g.modAttribute || 'str').toUpperCase()})</em>`
                  : '';
                const descRow = g.description
                  ? `\n              <tr class="desc-row"><td colspan="6">${e(g.description)}</td></tr>`
                  : '';
                return `
              <tr>
                <td>${e(g.name)}${modNote}</td>
                <td>${e(g.type || 'lesser')}</td>
                <td>${e(g.activation || '')}</td>
                <td class="num">${g.smite ? '✓' : ''}</td>
                <td>${e(g.effort || '')}</td>
                <td class="num">${g.active ? '◉' : '○'}</td>
              </tr>${descRow}`;
              }).join('')
            : `<tr><td colspan="6" class="empty">No gifts</td></tr>`;
          return `
          <div class="word-block">
            <div class="word-name">${e(w.name)}</div>
            <table>
              <thead><tr><th>Gift</th><th>Type</th><th>Activation</th><th>Smite</th><th>Effort</th><th>Active</th></tr></thead>
              <tbody>${giftsRows}</tbody>
            </table>
          </div>`;
        }).join('')
      : '<p class="empty">No Words of Power.</p>';

    /* ── Arcane Arts ── */
    const arcaneHtml = GoUtils.ARCANE_PRACTICES.map(cfg => {
      const items = (c[cfg.key] || []);
      if (!items.length) return '';
      const blocksHtml = items.map(item => {
        const entriesRows = item.entries && item.entries.length
          ? item.entries.map(en => {
              const descRow = en.description
                ? `\n              <tr class="desc-row"><td colspan="4">${e(en.description)}</td></tr>`
                : '';
              return `
            <tr>
              <td>${e(en.name)}</td>
              <td>${e(en.activation || '')}</td>
              <td>${e(en.effort || '')}</td>
              <td class="num">${en.active ? '◉' : '○'}</td>
            </tr>${descRow}`;
            }).join('')
          : `<tr><td colspan="4" class="empty">No ${cfg.entryLabelPlural.toLowerCase()}</td></tr>`;
        return `
        <div class="word-block">
          <div class="word-name">${e(item.name)}${item.notes ? `<span style="font-weight:400;font-size:.85em;color:#555"> — ${e(item.notes)}</span>` : ''}</div>
          <table>
            <thead><tr><th>${cfg.entryLabel}</th><th>Activation</th><th>Effort</th><th>Active</th></tr></thead>
            <tbody>${entriesRows}</tbody>
          </table>
        </div>`;
      }).join('');
      return `
      <div class="section">
        <div class="section-title">${cfg.title}</div>
        ${blocksHtml}
      </div>`;
    }).join('');

    /* ── Apotheosis gifts ── */
    const apoGifts = [
      { lvl:2, name:'Receive the Incense of Faith', act:'Constant' },
      { lvl:3, name:'Sanctify Shrine',              act:'Action'   },
      { lvl:3, name:'Smite the Apostate',           act:'Action'   },
      { lvl:4, name:'Hear Prayer',                  act:'Constant' },
      { lvl:5, name:'Perceive the Petitioner',      act:'Action'   },
      { lvl:6, name:'Mark of the Prophet',          act:'Action'   },
      { lvl:7, name:'Attend the Faithful',          act:'Action'   },
      { lvl:8, name:'To Bless the Nations',         act:'Action'   },
    ];
    const apo = c.apotheosis || {};
    const apoRows = apoGifts.map(g => {
      const gained = !!apo[g.name];
      return `<tr${gained ? ' class="apo-gained-row"' : ''}>
        <td class="num">${g.lvl}</td>
        <td>${e(g.name)}</td>
        <td>${e(g.act)}</td>
        <td class="num">${gained ? '✓' : ''}</td>
      </tr>`;
    }).join('');

    /* ── Servants / Minions ── */
    const servantRows = (c.servants || []).map(s =>
      `<tr><td>${e(s.name)}</td><td class="num">${s.hp || 0}</td><td class="num">${s.ac || 0}</td><td>${e(s.notes || '')}</td></tr>`
    ).join('');

    /* ── Equipment ── */
    const weaponRows   = (c.weapons   || []).map(w =>
      `<tr><td>${e(w.name)}</td><td>${e(w.damage)}</td><td class="num">${GoUtils.formatMod(w.attackMod || 0)}</td><td>${e(w.notes)}</td></tr>`
    ).join('');

    const armorRows    = (c.armor     || []).map(a =>
      `<tr><td>${e(a.name)}</td><td class="num">${GoUtils.formatMod(a.acBonus || 0)}</td><td>${e(a.notes)}</td></tr>`
    ).join('');

    const equipRows    = (c.equipment || []).map(i =>
      `<tr><td>${e(i.name)}</td><td>${e(i.notes)}</td></tr>`
    ).join('');

    const artifactRows = (c.artifacts || []).map(a =>
      `<tr><td>${e(a.name)}</td><td class="num">${a.effort}</td><td class="num">${a.creationCost}</td><td>${e(a.notes)}</td></tr>`
    ).join('');

    /* ── Shrines ── */
    const shrineRows = (c.shrines || []).map(s =>
      `<tr><td class="num">${s.level}</td><td>${e(s.place)}</td></tr>`
    ).join('');

    /* ── Level facts ── */
    const levelFactsHtml = Object.entries(c.levelFacts || {})
      .filter(([, v]) => v)
      .map(([lvl, v]) => `<div class="fact"><span class="fact-label">Level ${lvl}:</span> ${e(v)}</div>`)
      .join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${e(c.name)} – Full Character Sheet</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { font-size: 13px; }
  body {
    font-family: 'Georgia', serif;
    color: #1a1a1a;
    background: #fff;
    padding: 1.5rem 2rem;
    max-width: 900px;
    margin: 0 auto;
  }

  /* ── Print controls (hidden when printing) ── */
  .print-controls {
    display: flex;
    gap: .75rem;
    margin-bottom: 1.25rem;
    flex-wrap: wrap;
    align-items: center;
  }
  .print-controls h1 { font-size: 1rem; color: #555; font-weight: 400; flex: 1; }
  .btn-ctrl {
    padding: .45rem 1.1rem;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: .9rem;
    font-weight: 600;
    line-height: 1;
  }
  .btn-print { background: #5a3e8c; color: #fff; }
  .btn-print:hover { background: #7a5eb0; }
  .btn-close { background: #777; color: #fff; }
  .btn-close:hover { background: #555; }
  @media print { .print-controls { display: none !important; } }

  /* ── Header ── */
  .char-header {
    border-bottom: 3px solid #5a3e8c;
    padding-bottom: .75rem;
    margin-bottom: 1rem;
  }
  .char-name { font-size: 2rem; font-weight: 700; color: #3a1e6c; line-height: 1.1; }
  .char-meta {
    display: flex;
    gap: 1.5rem;
    margin-top: .35rem;
    font-size: .95rem;
    color: #555;
    flex-wrap: wrap;
  }
  .char-meta span strong { color: #1a1a1a; }

  /* ── Sections ── */
  .section { margin-bottom: 1.1rem; page-break-inside: avoid; }
  .section-title {
    background: #5a3e8c;
    color: #fff;
    padding: .2rem .6rem;
    font-size: .88rem;
    font-weight: 700;
    letter-spacing: .05em;
    text-transform: uppercase;
    border-radius: 3px;
    margin-bottom: .5rem;
  }

  /* ── Two-column layout ── */
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
  @media (max-width: 580px) { .two-col { grid-template-columns: 1fr; } }

  /* ── Tables ── */
  table { width: 100%; border-collapse: collapse; font-size: .88rem; }
  th {
    background: #ede8f7;
    color: #3a1e6c;
    font-weight: 700;
    text-align: left;
    padding: .25rem .45rem;
    border: 1px solid #c9b8e8;
    font-size: .78rem;
    text-transform: uppercase;
  }
  td { padding: .2rem .45rem; border: 1px solid #ddd; vertical-align: top; }
  tr:nth-child(even) td { background: #faf8ff; }
  td.num { text-align: center; font-variant-numeric: tabular-nums; }
  td.pos { color: #1a6b2c; font-weight: 700; }
  td.neg { color: #8b1a1a; font-weight: 700; }
  td.empty { color: #999; font-style: italic; text-align: center; }
  tr.desc-row td { font-size: .82rem; color: #444; border-top: none; padding-top: .1rem; background: #fdf9ff !important; font-style: italic; }

  /* ── Text blocks ── */
  .text-block {
    background: #faf9fe;
    border: 1px solid #ddd;
    border-radius: 3px;
    padding: .4rem .6rem;
    font-size: .9rem;
    min-height: 2.2rem;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .label {
    font-weight: 700;
    font-size: .78rem;
    color: #555;
    text-transform: uppercase;
    letter-spacing: .04em;
    margin: .4rem 0 .15rem;
  }

  /* ── Facts ── */
  .fact { margin-bottom: .35rem; font-size: .9rem; }
  .fact-label { font-weight: 700; }

  /* ── Stat boxes ── */
  .stats-row { display: flex; gap: .75rem; flex-wrap: wrap; margin-bottom: .5rem; }
  .stat-box {
    background: #ede8f7;
    border: 1px solid #c9b8e8;
    border-radius: 4px;
    padding: .3rem .7rem;
    text-align: center;
    min-width: 68px;
  }
  .stat-box .stat-val { font-size: 1.35rem; font-weight: 700; color: #3a1e6c; line-height: 1.1; }
  .stat-box .stat-lbl { font-size: .7rem; text-transform: uppercase; color: #666; letter-spacing: .03em; }
  .stat-box .stat-sub { font-size: .65rem; color: #999; }

  /* ── Word blocks ── */
  .word-block { margin-bottom: .75rem; page-break-inside: avoid; }
  .word-name {
    font-weight: 700;
    font-size: 1rem;
    color: #3a1e6c;
    background: #ede8f7;
    padding: .2rem .5rem;
    border-radius: 3px;
    margin-bottom: .25rem;
  }

  /* ── Misc ── */
  .empty { color: #999; font-style: italic; font-size: .9rem; }
  .note  { font-size: .75rem; color: #777; margin-top: .2rem; }
  .footer { margin-top: 1.5rem; color: #bbb; font-size: .72rem; text-align: center; }
  .apo-gained-row td { background: #e8f5e9 !important; font-weight: 700; }
  .three-col { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem; }
  @media (max-width: 600px) { .three-col { grid-template-columns: 1fr; } }
</style>
</head>
<body>

<div class="print-controls">
  <h1>Godbound Toolkit – Full Character Sheet</h1>
  <button class="btn-ctrl btn-print" onclick="window.print()">🖨️ Print / Save as PDF</button>
  <button class="btn-ctrl btn-close" onclick="window.close()">✕ Close</button>
</div>

<!-- ═══ HEADER ════════════════════════════════════════════════════════ -->
<div class="char-header">
  <div class="char-name">${e(c.name)}</div>
  <div class="char-meta">
    <span><strong>Level:</strong> ${c.level || 1}</span>
    <span><strong>Experience:</strong> ${c.experience || 0}</span>
    ${c.background ? `<span><strong>Background:</strong> ${e(c.background)}</span>` : ''}
  </div>
</div>

<!-- ═══ OVERVIEW ══════════════════════════════════════════════════════ -->
<div class="two-col">
  <div>
    ${c.goal ? `<div class="section">
      <div class="section-title">Goal</div>
      <div class="text-block">${e(c.goal)}</div>
    </div>` : ''}
    ${c.description ? `<div class="section">
      <div class="section-title">Description</div>
      <div class="text-block">${e(c.description)}</div>
    </div>` : ''}
  </div>
  <div>
    ${(c.origin || c.career || c.relationship || levelFactsHtml) ? `<div class="section">
      <div class="section-title">Facts</div>
      ${c.origin       ? `<div class="fact"><span class="fact-label">Origin:</span> ${e(c.origin)}</div>` : ''}
      ${c.career       ? `<div class="fact"><span class="fact-label">Career:</span> ${e(c.career)}</div>` : ''}
      ${c.relationship ? `<div class="fact"><span class="fact-label">Relationship:</span> ${e(c.relationship)}</div>` : ''}
      ${levelFactsHtml}
    </div>` : ''}
  </div>
</div>

<!-- ═══ ATTRIBUTES & SAVES ════════════════════════════════════════════ -->
<div class="two-col">
  <div class="section">
    <div class="section-title">Attributes</div>
    <table>
      <thead><tr><th>Attribute</th><th>Base</th><th>Bonus</th><th>Check</th><th>Mod</th></tr></thead>
      <tbody>${attrRows}</tbody>
    </table>
    <p class="note">CHECK = 21 − Base &nbsp;|&nbsp; MOD from Godbound attribute table</p>
  </div>
  <div class="section">
    <div class="section-title">Saving Throws</div>
    <div class="stats-row">
      <div class="stat-box">
        <div class="stat-val">${(c.saves || {}).hardiness || '—'}</div>
        <div class="stat-lbl">Hardiness</div>
        <div class="stat-sub">STR / CON</div>
      </div>
      <div class="stat-box">
        <div class="stat-val">${(c.saves || {}).evasion || '—'}</div>
        <div class="stat-lbl">Evasion</div>
        <div class="stat-sub">DEX / INT</div>
      </div>
      <div class="stat-box">
        <div class="stat-val">${(c.saves || {}).spirit || '—'}</div>
        <div class="stat-lbl">Spirit</div>
        <div class="stat-sub">WIS / CHA</div>
      </div>
    </div>
    <p class="note">Roll d20 equal to or higher to succeed</p>
  </div>
</div>

<!-- ═══ COMBAT & HIT POINTS ═══════════════════════════════════════════ -->
<div class="section">
  <div class="section-title">Combat &amp; Hit Points</div>
  <div class="stats-row">
    <div class="stat-box">
      <div class="stat-val">${hp.max || '—'}</div>
      <div class="stat-lbl">HP Max</div>
    </div>
    <div class="stat-box">
      <div class="stat-val">${hp.current ?? hp.max ?? '—'}</div>
      <div class="stat-lbl">HP Current</div>
    </div>
    <div class="stat-box">
      <div class="stat-val">${c.ac ?? '—'}</div>
      <div class="stat-lbl">AC</div>
    </div>
    <div class="stat-box">
      <div class="stat-val">${GoUtils.formatMod(meleeAtk)}</div>
      <div class="stat-lbl">Melee Atk</div>
      <div class="stat-sub">Lvl + STR</div>
    </div>
    <div class="stat-box">
      <div class="stat-val">${GoUtils.formatMod(rangedAtk)}</div>
      <div class="stat-lbl">Ranged Atk</div>
      <div class="stat-sub">Lvl + DEX</div>
    </div>
    <div class="stat-box">
      <div class="stat-val">${GoUtils.formatMod(customAtk)}</div>
      <div class="stat-lbl">Custom Atk</div>
      <div class="stat-sub">Lvl + ${customAttr.toUpperCase()}</div>
    </div>
    <div class="stat-box">
      <div class="stat-val" style="font-size:.95rem">${e(frayDice)}</div>
      <div class="stat-lbl">Fray Die</div>
    </div>
  </div>
  <p class="note">
    Armour: ${e((c.armorType || 'none').charAt(0).toUpperCase() + (c.armorType || 'none').slice(1))}
    &nbsp;|&nbsp; Shield/Cloak: ${c.shieldOrCloak ? 'Yes' : 'No'}
    &nbsp;|&nbsp; Defence Attr: ${(c.defenseAttr || 'dex').toUpperCase()}
    ${c.unarmedDamage ? `&nbsp;|&nbsp; Unarmed: ${e(c.unarmedDamage)}` : ''}
  </p>
</div>

<!-- ═══ DIVINE RESOURCES ══════════════════════════════════════════════ -->
<div class="section">
  <div class="section-title">Divine Resources</div>
  <div class="three-col">
    <div>
      <div class="label">Effort</div>
      <div class="stats-row">
        <div class="stat-box">
          <div class="stat-val">${effort.total || 0}</div>
          <div class="stat-lbl">Total</div>
        </div>
        <div class="stat-box">
          <div class="stat-val">${(effort.total || 0) - (effort.committedDay || 0) - (effort.committedScene || 0)}</div>
          <div class="stat-lbl">Available</div>
        </div>
        <div class="stat-box">
          <div class="stat-val">${effort.committedScene || 0}</div>
          <div class="stat-lbl">Cmt. Scene</div>
        </div>
        <div class="stat-box">
          <div class="stat-val">${effort.committedDay || 0}</div>
          <div class="stat-lbl">Cmt. Day</div>
        </div>
      </div>
    </div>
    <div>
      <div class="label">Dominion</div>
      <div class="stats-row">
        <div class="stat-box">
          <div class="stat-val">${dominion.total || 0}</div>
          <div class="stat-lbl">Total</div>
        </div>
        <div class="stat-box">
          <div class="stat-val">${dominion.earned || 0}</div>
          <div class="stat-lbl">Free</div>
        </div>
        <div class="stat-box">
          <div class="stat-val">${dominion.spent || 0}</div>
          <div class="stat-lbl">Spent</div>
        </div>
      </div>
      ${c.divineServant ? `<p class="note" style="margin-top:.3rem">Divine Servant${c.servantName ? ': ' + e(c.servantName) : ''}</p>` : ''}
    </div>
    <div>
      <div class="label">Influence &amp; Wealth</div>
      <div class="stats-row">
        <div class="stat-box">
          <div class="stat-val">${influence.current || 0}&thinsp;/&thinsp;${influence.max || 0}</div>
          <div class="stat-lbl">Influence</div>
          <div class="stat-sub">Used / Max</div>
        </div>
        <div class="stat-box">
          <div class="stat-val">${wealth.total || 0}</div>
          <div class="stat-lbl">Wealth Cache 1</div>
        </div>
        <div class="stat-box">
          <div class="stat-val">${wealth.free || 0}</div>
          <div class="stat-lbl">Wealth Cache 2</div>
        </div>
        <div class="stat-box">
          <div class="stat-val">${wealth.cult || 0}</div>
          <div class="stat-lbl">Cult Wealth</div>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- ═══ WORDS OF POWER ════════════════════════════════════════════════ -->
<div class="section">
  <div class="section-title">Words of Power</div>
  ${wordsHtml}
</div>

<!-- ═══ ARCANE ARTS ═══════════════════════════════════════════════════ -->
${arcaneHtml}

<!-- ═══ APOTHEOSIS GIFTS ══════════════════════════════════════════════ -->
<div class="section">
  <div class="section-title">Apotheosis Gifts</div>
  <table>
    <thead><tr><th>Lvl</th><th>Gift</th><th>Activation</th><th>Gained</th></tr></thead>
    <tbody>${apoRows}</tbody>
  </table>
</div>

<!-- ═══ SERVANTS &amp; MINIONS ═══════════════════════════════════════ -->
${(c.servants || []).length ? `
<div class="section">
  <div class="section-title">Servants &amp; Minions</div>
  <table>
    <thead><tr><th>Name</th><th>HP</th><th>AC</th><th>Notes</th></tr></thead>
    <tbody>${servantRows}</tbody>
  </table>
</div>` : ''}

<!-- ═══ EQUIPMENT ═════════════════════════════════════════════════════ -->
${(c.weapons || []).length ? `
<div class="section">
  <div class="section-title">Weapons</div>
  <table>
    <thead><tr><th>Name</th><th>Damage</th><th>Atk Mod</th><th>Notes</th></tr></thead>
    <tbody>${weaponRows}</tbody>
  </table>
</div>` : ''}

${(c.armor || []).length ? `
<div class="section">
  <div class="section-title">Armour</div>
  <table>
    <thead><tr><th>Name</th><th>AC Bonus</th><th>Notes</th></tr></thead>
    <tbody>${armorRows}</tbody>
  </table>
</div>` : ''}

${(c.equipment || []).length ? `
<div class="section">
  <div class="section-title">Equipment</div>
  <table>
    <thead><tr><th>Item</th><th>Notes</th></tr></thead>
    <tbody>${equipRows}</tbody>
  </table>
</div>` : ''}

${(c.artifacts || []).length ? `
<div class="section">
  <div class="section-title">Artifacts</div>
  <table>
    <thead><tr><th>Name</th><th>Effort</th><th>Creation Cost</th><th>Notes</th></tr></thead>
    <tbody>${artifactRows}</tbody>
  </table>
</div>` : ''}

<!-- ═══ CULT ══════════════════════════════════════════════════════════ -->
${cult.name ? `
<div class="section">
  <div class="section-title">Cult: ${e(cult.name)}</div>
  <div class="stats-row">
    ${cult.power     ? `<div class="stat-box"><div class="stat-val">${cult.power}</div><div class="stat-lbl">Power</div></div>` : ''}
    ${cult.cohesion  ? `<div class="stat-box"><div class="stat-val">${cult.cohesion}</div><div class="stat-lbl">Cohesion</div></div>` : ''}
    ${cult.demand    ? `<div class="stat-box"><div class="stat-val">${cult.demand}</div><div class="stat-lbl">Demand</div></div>` : ''}
    ${cult.trouble   ? `<div class="stat-box"><div class="stat-val">${cult.trouble}</div><div class="stat-lbl">Trouble</div></div>` : ''}
    ${cult.actionDie ? `<div class="stat-box"><div class="stat-val" style="font-size:.95rem">${e(cult.actionDie)}</div><div class="stat-lbl">Action Die</div></div>` : ''}
  </div>
  ${cult.holyLaws ? `<div class="label">Holy Laws</div><div class="text-block">${e(cult.holyLaws)}</div>` : ''}
  ${cult.features ? `<div class="label">Features</div><div class="text-block">${e(cult.features)}</div>` : ''}
  ${cult.problems ? `<div class="label">Problems</div><div class="text-block">${e(cult.problems)}</div>` : ''}
</div>` : ''}

<!-- ═══ SHRINES ════════════════════════════════════════════════════════ -->
${(c.shrines || []).length ? `
<div class="section">
  <div class="section-title">Shrines</div>
  <table>
    <thead><tr><th>Level Built</th><th>Location</th></tr></thead>
    <tbody>${shrineRows}</tbody>
  </table>
</div>` : ''}

<!-- ═══ NOTES ══════════════════════════════════════════════════════════ -->
${c.notes ? `
<div class="section">
  <div class="section-title">Notes</div>
  <div class="text-block">${e(c.notes)}</div>
</div>` : ''}

<p class="footer">Generated by Godbound Toolkit &nbsp;·&nbsp; ${new Date().toLocaleDateString()} &nbsp;·&nbsp; Full Character Sheet</p>

</body>
</html>`;
  }
};
