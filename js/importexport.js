'use strict';

/**
 * Import / Export module.
 * Provides full-data export to a JSON file and import with merge support.
 *
 * Export format:
 *   {
 *     version:       1,
 *     exported:      "<ISO-8601 timestamp>",
 *     characters:    [...],
 *     dataTemplates: { words: [], weapons: [], equipment: [], enemies: [] },
 *     diceHistory:   [...]
 *   }
 *
 * Merge rules (import):
 *   • Characters    – incoming characters whose id already exists locally are
 *                     skipped (or added as a copy with a new id if the user
 *                     selects "Merge – keep both").
 *   • Data templates – each word / weapon / equipment item is always assigned
 *                     a fresh id so there can be no clash; exact-name
 *                     duplicates within the same category are skipped.
 *   • Dice history  – incoming entries are appended; no deduplication.
 */
const GoImportExport = {

  /* ─── Export ────────────────────────────────────────────────────── */

  exportAll() {
    const payload = {
      version:       1,
      exported:      new Date().toISOString(),
      characters:    GoStorage.loadCharacters(),
      dataTemplates: GoStorage.loadDataTemplates(),
      diceHistory:   GoStorage.loadDiceHistory()
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);

    const a  = document.createElement('a');
    a.href   = url;
    a.download = `godbound-backup-${this._dateStamp()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    GoApp.toast('Data exported successfully', 'success');
  },

  /* ─── Import ────────────────────────────────────────────────────── */

  importFromFile() {
    const input = document.createElement('input');
    input.type  = 'file';
    input.accept = '.json,application/json';

    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = e => {
        try {
          const data = JSON.parse(e.target.result);
          this._handleImport(data);
        } catch {
          GoApp.toast('Invalid file – could not parse JSON', 'error');
        }
      };
      reader.readAsText(file);
    });

    input.click();
  },

  /* ─── Internal ──────────────────────────────────────────────────── */

  /**
   * Validate the payload and ask the user how to handle conflicts, then
   * perform the merge / replace.
   */
  async _handleImport(data) {
    if (!data || typeof data !== 'object') {
      GoApp.toast('Unrecognised file format', 'error');
      return;
    }

    /* Accept either a full export (has `exported` key) or a bare
       characters array pasted / transferred by other means. */
    const incomingChars     = Array.isArray(data.characters)    ? data.characters    : [];
    const incomingTemplates = data.dataTemplates && typeof data.dataTemplates === 'object'
                              ? data.dataTemplates : null;
    const incomingHistory   = Array.isArray(data.diceHistory)   ? data.diceHistory   : [];

    if (!incomingChars.length && !incomingTemplates && !incomingHistory.length) {
      GoApp.toast('Nothing to import in this file', 'error');
      return;
    }

    const mode = await this._askImportMode();
    if (mode === null) return;   /* user cancelled */

    let charCount  = 0;
    let tmplCount  = 0;
    let diceCount  = 0;

    /* ── Characters ── */
    if (incomingChars.length) {
      const existing   = GoStorage.loadCharacters();
      const existingIds = new Set(existing.map(c => c.id));

      if (mode === 'replace') {
        /* Assign fresh ids so nothing clashes, then replace everything */
        const fresh = incomingChars.map(c => ({ ...c, id: GoUtils.uid() }));
        GoStorage.saveCharacters(fresh);
        GoStorage.saveActiveCharacter(0);
        charCount = fresh.length;
      } else {
        /* merge – append characters whose id is not yet present */
        const toAdd = [];
        const allNames = new Set(existing.map(c => c.name));
        for (const c of incomingChars) {
          if (existingIds.has(c.id)) {
            /* Same id → duplicate; add as copy with a unique name */
            let candidateName = c.name + ' (imported)';
            let counter = 2;
            while (allNames.has(candidateName)) {
              candidateName = `${c.name} (imported ${counter++})`;
            }
            allNames.add(candidateName);
            toAdd.push({ ...c, id: GoUtils.uid(), name: candidateName });
          } else {
            toAdd.push(c);
          }
        }
        const merged = existing.concat(toAdd);
        GoStorage.saveCharacters(merged);
        charCount = toAdd.length;
      }

      /* Refresh character module if it is already initialised */
      if (typeof GoCharacter !== 'undefined') {
        GoCharacter.characters = GoStorage.loadCharacters();
        GoCharacter.activeIdx  = GoUtils.clamp(
          GoStorage.loadActiveCharacter(), 0, GoCharacter.characters.length - 1
        );
        GoCharacter.render();
      }
    }

    /* ── Data Templates ── */
    if (incomingTemplates) {
      const existing = GoStorage.loadDataTemplates();

      if (mode === 'replace') {
        /* Re-id everything to ensure clean slate */
        const fresh = this._reIdTemplates(incomingTemplates);
        GoStorage.saveDataTemplates(fresh);
        tmplCount = (fresh.words || []).length +
                    (fresh.weapons || []).length +
                    (fresh.equipment || []).length +
                    (fresh.enemies || []).length;
      } else {
        /* merge – append by name; skip if exact name already exists */
        const merged = this._mergeTemplates(existing, incomingTemplates);
        GoStorage.saveDataTemplates(merged.data);
        tmplCount = merged.added;
      }

      if (typeof GoDataEditor !== 'undefined') {
        GoDataEditor.data = GoStorage.loadDataTemplates();
        GoDataEditor._ensureStructure();
        GoDataEditor.render();
      }
    }

    /* ── Dice History ── */
    if (incomingHistory.length) {
      if (mode === 'replace') {
        GoStorage.saveDiceHistory(incomingHistory);
        diceCount = incomingHistory.length;
      } else {
        const existing = GoStorage.loadDiceHistory();
        const merged   = existing.concat(incomingHistory);
        GoStorage.saveDiceHistory(merged);
        diceCount = incomingHistory.length;
      }

      if (typeof GoDice !== 'undefined' && typeof GoDice._renderHistory === 'function') {
        GoDice._renderHistory();
      }
    }

    const parts = [];
    if (charCount)  parts.push(`${charCount} character${charCount !== 1 ? 's' : ''}`);
    if (tmplCount)  parts.push(`${tmplCount} template${tmplCount !== 1 ? 's' : ''}`);
    if (diceCount)  parts.push(`${diceCount} dice roll${diceCount !== 1 ? 's' : ''}`);
    const summary = parts.length ? parts.join(', ') : 'nothing new';
    GoApp.toast(`Import complete – ${summary} ${mode === 'replace' ? 'replaced' : 'merged'}`, 'success');
  },

  /**
   * Show a modal dialog with three clear choices.
   * Returns a Promise that resolves to 'merge', 'replace', or null (cancel).
   */
  _askImportMode() {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'iex-overlay';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-labelledby', 'iex-title');
      overlay.innerHTML = `
        <div class="iex-modal">
          <h3 id="iex-title" class="iex-title">📥 Import Data</h3>
          <p class="iex-body">How would you like to handle your existing data?</p>
          <ul class="iex-list">
            <li>
              <strong>Merge</strong> – add imported data alongside existing data.
              Characters with the same id are added as a copy; templates with
              identical names are skipped.
            </li>
            <li>
              <strong>Replace</strong> – overwrite <em>all</em> existing data
              with the file. <strong>This cannot be undone.</strong>
            </li>
          </ul>
          <div class="iex-actions">
            <button class="btn-primary iex-merge-btn">Merge</button>
            <button class="btn-danger  iex-replace-btn">Replace</button>
            <button class="btn-ghost   iex-cancel-btn">Cancel</button>
          </div>
        </div>`;

      document.body.appendChild(overlay);

      const cleanup = result => {
        document.removeEventListener('keydown', onKeyDown);
        document.body.removeChild(overlay);
        resolve(result);
      };

      /* Keyboard: Escape cancels; Tab stays within modal */
      const focusable = () => Array.from(overlay.querySelectorAll('button'));
      const onKeyDown = e => {
        if (e.key === 'Escape') { cleanup(null); return; }
        if (e.key === 'Tab') {
          const els = focusable();
          const first = els[0];
          const last  = els[els.length - 1];
          if (e.shiftKey ? document.activeElement === first : document.activeElement === last) {
            e.preventDefault();
            (e.shiftKey ? last : first).focus();
          }
        }
      };
      document.addEventListener('keydown', onKeyDown);

      /* Focus the first button when the modal opens */
      requestAnimationFrame(() => { const els = focusable(); if (els[0]) els[0].focus(); });

      overlay.querySelector('.iex-merge-btn').addEventListener('click', () => cleanup('merge'));
      overlay.querySelector('.iex-cancel-btn').addEventListener('click', () => cleanup(null));
      /* Clicking the dimmed backdrop also cancels */
      overlay.addEventListener('click', e => { if (e.target === overlay) cleanup(null); });

      overlay.querySelector('.iex-replace-btn').addEventListener('click', () => {
        if (window.confirm('⚠️  Replace ALL existing data with the imported file?\nThis cannot be undone.')) {
          cleanup('replace');
        }
        /* If the user cancels the safety-confirm, leave the modal open so they
           can choose Merge or Cancel instead. */
      });
    });
  },

  /** Assign fresh ids to every item in a templates object. */
  _reIdTemplates(templates) {
    return {
      words: (templates.words || []).map(w => ({
        ...w,
        id:     GoUtils.uid(),
        gifts:  this._reIdGifts(w.gifts)
      })),
      weapons:   (templates.weapons   || []).map(w => ({ ...w, id: GoUtils.uid() })),
      equipment: (templates.equipment || []).map(e => ({ ...e, id: GoUtils.uid() })),
      enemies:   (templates.enemies   || []).map(e => ({ ...e, id: GoUtils.uid() }))
    };
  },

  /** Return a copy of a gifts array with fresh ids on every entry. */
  _reIdGifts(gifts) {
    return (gifts || []).map(g => ({ ...g, id: GoUtils.uid() }));
  },

  /**
   * Merge incoming templates into existing ones.
   * Items whose name (case-insensitive) already exists in the same
   * category are skipped; all others get a fresh id and are appended.
   *
   * @returns {{ data: object, added: number }}
   */
  _mergeTemplates(existing, incoming) {
    let added = 0;

    const mergeCategory = (existingArr, incomingArr) => {
      const existingNames = new Set(existingArr.map(x => (x.name || '').toLowerCase()));
      const toAdd = (incomingArr || []).filter(
        x => !existingNames.has((x.name || '').toLowerCase())
      );
      added += toAdd.length;
      return existingArr.concat(
        toAdd.map(x => ({
          ...x,
          id:    GoUtils.uid(),
          gifts: this._reIdGifts(x.gifts)
        }))
      );
    };

    return {
      data: {
        words:     mergeCategory(existing.words     || [], incoming.words),
        weapons:   mergeCategory(existing.weapons   || [], incoming.weapons),
        equipment: mergeCategory(existing.equipment || [], incoming.equipment),
        enemies:   mergeCategory(existing.enemies   || [], incoming.enemies)
      },
      added
    };
  },

  /* ─── Utility ───────────────────────────────────────────────────── */

  _dateStamp() {
    const d = new Date();
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, '0'),
      String(d.getDate()).padStart(2, '0')
    ].join('-');
  }
};
