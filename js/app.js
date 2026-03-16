'use strict';

/**
 * Main application controller.
 * Handles tab navigation and toast notifications.
 */
const GoApp = {

  /* ─── Init ──────────────────────────────────────────────────────── */

  init() {
    this._setupTabs();
    GoDice.init();
    GoCombat.init();
    GoCharacter.init();
    GoDataEditor.init();
    this._setupImportExport();
    this._restoreActiveTab();
    GoPrint.checkShareParam();
  },

  /* ─── Tab navigation ────────────────────────────────────────────── */

  _setupTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => this._switchTab(btn.dataset.tab));
    });
  },

  _switchTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
    document.querySelectorAll('.tab-content').forEach(section => {
      section.classList.toggle('active', section.id === tabId);
    });
    localStorage.setItem('godbound_active_tab', tabId);
  },

  _restoreActiveTab() {
    const saved = localStorage.getItem('godbound_active_tab') || 'dice-tab';
    this._switchTab(saved);
  },

  /* ─── Import / Export ───────────────────────────────────────────── */

  _setupImportExport() {
    document.getElementById('export-btn')?.addEventListener('click', () => GoImportExport.exportAll());
    document.getElementById('import-btn')?.addEventListener('click', () => GoImportExport.importFromFile());
  },

  /* ─── Toast notifications ───────────────────────────────────────── */

  toast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', 'alert');
    toast.textContent = message;

    container.appendChild(toast);

    /* Trigger CSS transition */
    requestAnimationFrame(() => toast.classList.add('toast-show'));

    setTimeout(() => {
      toast.classList.remove('toast-show');
      toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    }, 3000);
  }
};

/* ─── Bootstrap ─────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => GoApp.init());
