/**
 * Famylia - GiampyCash Contabilità in Partita Doppia
 * Integrazione nativa completa con design Dark/Glassmorphism,
 * persistenza su server Node.js, comandi vocali ed export/import CSV.
 */

(function (window) {
  'use strict';

  // --- STATO GLOBALE CONTABILITÀ ---
  const state = {
    accounts: [],
    journalEntries: [],
    budgetEntries: [],
    activeTab: 'registrazioni',
    isLoading: true,
    isSyncing: false,
    filterFrom: '',
    filterTo: '',
    filterAccount: '',
    editingId: null,
    selectedAccountCode: null,
    defaultCostCredit: localStorage.getItem('giampycash_default_cost_credit') || '4043'
  };

  const DEFAULT_DESCRIPTIONS = {
    '6040': 'GASOLIO',
    '6041': 'GASOLIO',
    '6050': 'FATTURA ELETTRICA CAVARO',
    '6051': 'FATTURA ELETTRICA MENNENNE',
    '6052': 'FATTURA ELETTRICA TISIDDU',
    '6053': 'FATTURA ELETTRICA PRINCIPE',
    '6110': 'SPESA'
  };

  const MONTH_NAMES_SHORT = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
  const MONTH_NAMES_FULL = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

  // --- UTILITY FORMATTAZIONE ---
  function formatCurrency(n) {
    const num = typeof n === 'number' ? n : parseFloat(n) || 0;
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(num);
  }

  function formatDateIt(isoStr) {
    if (!isoStr) return '';
    const parts = isoStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return isoStr;
  }

  function getTodayIso() {
    return new Date().toISOString().split('T')[0];
  }

  function getFirstDayOfMonthIso() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  }

  function getAccountType(code) {
    if (!code || typeof code !== 'string') return null;
    const first = code.charAt(0);
    switch (first) {
      case '4': return 'attivo';
      case '5': return 'passivo';
      case '6': return 'costo';
      case '8': return 'ricavo';
      default: return null;
    }
  }

  function getAccountTypeLabel(type) {
    switch (type) {
      case 'costo': return 'Costo (6XXX)';
      case 'ricavo': return 'Ricavo (8XXX)';
      case 'attivo': return 'Attivo (4XXX)';
      case 'passivo': return 'Passivo (5XXX)';
      default: return type || '';
    }
  }

  function getAccountBadgeClass(type) {
    switch (type) {
      case 'costo': return 'badge-costo';
      case 'ricavo': return 'badge-ricavo';
      case 'attivo': return 'badge-attivo';
      case 'passivo': return 'badge-passivo';
      default: return '';
    }
  }

  function getAccountName(code) {
    const acc = state.accounts.find(a => a.code === code);
    return acc ? acc.name : code;
  }

  // Toast notification helper
  function notify(msg, type = 'info') {
    if (window.showToast) {
      window.showToast(msg, type);
    } else {
      console.log(`[GiampyCash] ${type.toUpperCase()}: ${msg}`);
    }
  }

  // --- API SERVER SYNC ---
  async function fetchContabilita() {
    state.isLoading = true;
    renderContabilitaModal();
    try {
      const res = await fetch('/api/contabilita');
      if (res.ok) {
        const json = await res.json();
        if (json && json.data) {
          state.accounts = json.data.accounts || [];
          state.journalEntries = json.data.journalEntries || [];
          state.budgetEntries = json.data.budgetEntries || [];
          try {
            localStorage.setItem('giampycash_offline_cache', JSON.stringify(json.data));
          } catch (e) {}
        }
      }
    } catch (err) {
      console.warn('[GiampyCash] Connessione server fallita, uso cache locale:', err.message);
      try {
        const cached = localStorage.getItem('giampycash_offline_cache');
        if (cached) {
          const parsed = JSON.parse(cached);
          state.accounts = parsed.accounts || [];
          state.journalEntries = parsed.journalEntries || [];
          state.budgetEntries = parsed.budgetEntries || [];
        }
      } catch (e) {}
    } finally {
      state.isLoading = false;
      updateDashboardCounter();
      renderContabilitaModal();
    }
  }

  async function saveContabilitaServer() {
    state.isSyncing = true;
    updateSyncIndicator();
    try {
      const payload = {
        accounts: state.accounts,
        journalEntries: state.journalEntries,
        budgetEntries: state.budgetEntries
      };
      // Salva in cache locale
      try { localStorage.setItem('giampycash_offline_cache', JSON.stringify(payload)); } catch (e) {}

      const res = await fetch('/api/contabilita', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        throw new Error('Salvataggio server non riuscito');
      }
    } catch (err) {
      console.error('[GiampyCash] Errore salvataggio:', err.message);
      notify('Salvataggio memorizzato localmente (offline)', 'warning');
    } finally {
      state.isSyncing = false;
      updateSyncIndicator();
      updateDashboardCounter();
    }
  }

  function updateDashboardCounter() {
    const el = document.getElementById('subContabilita');
    if (el) {
      const count = state.journalEntries.length;
      el.textContent = count > 0 ? `${count} registrazioni` : 'GiampyCash';
    }
  }

  function updateSyncIndicator() {
    const btn = document.getElementById('contabilitaSyncBtn');
    if (btn) {
      btn.innerHTML = state.isSyncing ? '⏳ Salvataggio...' : '↺ Sincronizza';
    }
  }

  // --- CONTROLLER FINESTRA / MODALE ---
  function openContabilitaModal() {
    const modal = document.getElementById('contabilitaModal');
    if (!modal) return;
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    const y = new Date().getFullYear();
    if (!state.filterFrom) state.filterFrom = `${y}-01-01`;
    if (!state.filterTo) state.filterTo = `${y}-12-31`;

    fetchContabilita();
  }

  function closeContabilitaModal() {
    const modal = document.getElementById('contabilitaModal');
    if (!modal) return;
    modal.style.display = 'none';
    document.body.style.overflow = '';
  }

  function switchTab(tabName) {
    state.activeTab = tabName;
    renderContabilitaModal();
  }

  // --- RENDERING PRINCIPALE ---
  function renderContabilitaModal() {
    const container = document.getElementById('contabilitaBody');
    if (!container) return;

    if (state.isLoading) {
      container.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 20px;color:var(--text-secondary);">
          <div class="spinner" style="width:36px;height:36px;border:3px solid rgba(16,185,129,0.2);border-top-color:#10b981;border-radius:50%;animation:spin 0.8s linear infinite;margin-bottom:16px;"></div>
          <div style="font-size:15px;font-weight:500;">Caricamento GiampyCash...</div>
        </div>
      `;
      return;
    }

    // Aggiorna stato attivo dei bottoni tab
    document.querySelectorAll('.contabilita-tab-btn').forEach(btn => {
      const t = btn.getAttribute('data-tab');
      if (t === state.activeTab) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    switch (state.activeTab) {
      case 'registrazioni':
        renderTabRegistrazioni(container);
        break;
      case 'budget':
        renderTabBudget(container);
        break;
      case 'avanzamento':
        renderTabAvanzamento(container);
        break;
      case 'liquidita':
        renderTabLiquidita(container);
        break;
      case 'piano':
        renderTabPianoDeiConti(container);
        break;
      default:
        renderTabRegistrazioni(container);
    }
  }

  // ==========================================
  // TAB 1: REGISTRAZIONI (PARTITA DOPPIA)
  // ==========================================
  function renderTabRegistrazioni(container) {
    const today = getTodayIso();
    const accounts = state.accounts;

    // Filtra voci Libro Giornale
    const from = state.filterFrom || getFirstDayOfMonthIso();
    const to = state.filterTo || today;
    const filterAcc = state.filterAccount || '';

    const filtered = state.journalEntries.filter(je => {
      const matchDate = (!from || je.date >= from) && (!to || je.date <= to);
      const matchAcc = !filterAcc || je.debitAccountCode === filterAcc || je.creditAccountCode === filterAcc;
      return matchDate && matchAcc;
    }).sort((a, b) => b.date.localeCompare(a.date));

    // Raggruppa per Mese
    const groups = {};
    filtered.forEach(je => {
      const ym = je.date.slice(0, 7);
      if (!groups[ym]) groups[ym] = [];
      groups[ym].push(je);
    });

    container.innerHTML = `
      <div class="contabilita-content-wrapper">
        <!-- FORM NUOVA REGISTRAZIONE -->
        <div class="contabilita-card">
          <div class="contabilita-card-header">
            <div>
              <h3 class="contabilita-card-title">Nuova Registrazione</h3>
              <p class="contabilita-card-sub">Partita doppia Dare & Avere</p>
            </div>
            <div style="display:flex;gap:6px;">
              <button type="button" class="btn-sm btn-ghost" onclick="window.GiampyCash.startVoiceEntry()" title="Dettatura vocale">
                🎙️ Dettatura
              </button>
            </div>
          </div>
          
          <form id="newJournalForm" onsubmit="window.GiampyCash.handleNewJournalSubmit(event)">
            <div class="grid-form-contabilita">
              <div class="form-group-c">
                <label>Data</label>
                <input type="date" id="regDate" class="input-c font-mono" value="${today}" required>
              </div>

              <div class="form-group-c">
                <label>Importo (€)</label>
                <input type="number" step="0.01" min="0.01" id="regAmount" class="input-c font-mono text-right" placeholder="0,00" required>
              </div>

              <div class="form-group-c">
                <label>Conto Dare (Uscita / Spesa / Destinazione)</label>
                <div class="account-select-wrapper">
                  <select id="regDebit" class="input-c select-c" onchange="window.GiampyCash.handleDebitChange(this.value)" required>
                    <option value="">-- Seleziona Conto Dare --</option>
                    ${buildAccountOptions(accounts, '')}
                  </select>
                </div>
                <div class="quick-chips">
                  <button type="button" class="chip-btn" onclick="window.GiampyCash.setQuickAccount('debit', '4010')">4010 Cassa</button>
                  <button type="button" class="chip-btn" onclick="window.GiampyCash.setQuickAccount('debit', '4043')">4043 ING</button>
                  <button type="button" class="chip-btn" onclick="window.GiampyCash.setQuickAccount('debit', '6110')">6110 Vitto</button>
                  <button type="button" class="chip-btn" onclick="window.GiampyCash.setQuickAccount('debit', '6041')">6041 Gasolio</button>
                </div>
              </div>

              <div class="form-group-c">
                <label>Conto Avere (Entrata / Risorsa / Sorgente)</label>
                <div class="account-select-wrapper">
                  <select id="regCredit" class="input-c select-c" required>
                    <option value="">-- Seleziona Conto Avere --</option>
                    ${buildAccountOptions(accounts, state.defaultCostCredit)}
                  </select>
                </div>
                <div class="quick-chips">
                  <button type="button" class="chip-btn" onclick="window.GiampyCash.setQuickAccount('credit', '4010')">4010 Cassa</button>
                  <button type="button" class="chip-btn" onclick="window.GiampyCash.setQuickAccount('credit', '4043')">4043 ING</button>
                  <button type="button" class="chip-btn" onclick="window.GiampyCash.setQuickAccount('credit', '8040')">8040 Affitti</button>
                </div>
              </div>

              <div class="form-group-c span-2">
                <label>Descrizione Operazione</label>
                <input type="text" id="regDesc" class="input-c uppercase" placeholder="ES. SPESA SUPERMERCATO / GASOLIO" required>
              </div>
            </div>

            <div style="display:flex;justify-content:flex-end;margin-top:14px;gap:8px;">
              <button type="submit" class="btn-primary-c">
                <span>+ Registra Operazione</span>
              </button>
            </div>
          </form>
        </div>

        <!-- SEZIONE LIBRO GIORNALE -->
        <div class="contabilita-card" style="margin-top:20px;">
          <div class="contabilita-card-header" style="flex-wrap:wrap;gap:12px;">
            <div>
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                <h3 class="contabilita-card-title">Libro Giornale</h3>
                <span class="badge-attivo" style="font-family:monospace;font-size:0.75rem;">${filtered.length} di ${state.journalEntries.length} registrazioni</span>
              </div>
              <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap;">
                <button type="button" class="chip-btn" onclick="window.GiampyCash.setQuickFilter('year')">📅 Tutto il 2026 (${state.journalEntries.length})</button>
                <button type="button" class="chip-btn" onclick="window.GiampyCash.setQuickFilter('month')">Settembre</button>
                <button type="button" class="chip-btn" onclick="window.GiampyCash.setQuickFilter('all')">Mostra Tutte</button>
              </div>
            </div>

            <!-- FILTRI DATE E CONTO -->
            <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
              <div style="display:flex;align-items:center;gap:4px;">
                <span class="filter-lbl">Da:</span>
                <input type="date" id="filterFromDate" class="input-c input-sm font-mono" value="${from}" onchange="window.GiampyCash.setFilter('from', this.value)">
              </div>
              <div style="display:flex;align-items:center;gap:4px;">
                <span class="filter-lbl">A:</span>
                <input type="date" id="filterToDate" class="input-c input-sm font-mono" value="${to}" onchange="window.GiampyCash.setFilter('to', this.value)">
              </div>
              <div style="display:flex;align-items:center;gap:4px;">
                <select id="filterAccSelect" class="input-c input-sm select-c" style="max-width:160px;" onchange="window.GiampyCash.setFilter('account', this.value)">
                  <option value="">Tutti i conti</option>
                  ${buildAccountOptions(accounts, filterAcc)}
                </select>
              </div>
              <div style="display:flex;gap:4px;">
                <button type="button" class="btn-sm btn-outline-c" onclick="window.GiampyCash.exportCsv('periodo')" title="Esporta periodo filtrato">
                  📥 Esporta periodo
                </button>
                <button type="button" class="btn-sm btn-outline-c" onclick="window.GiampyCash.exportCsv('tutte')" title="Esporta tutto l'archivio">
                  📥 Esporta tutte (${state.journalEntries.length})
                </button>
                <label class="btn-sm btn-ghost" style="cursor:pointer;margin:0;" title="Importa file CSV">
                  📤 Importa CSV
                  <input type="file" accept=".csv" style="display:none;" onchange="window.GiampyCash.handleCsvFileInput(event)">
                </label>
              </div>
            </div>
          </div>

          <!-- LISTA MOVIMENTI RAGGRUPPATI -->
          <div class="journal-list">
            ${Object.keys(groups).length === 0 ? `
              <div style="text-align:center;padding:40px 10px;color:var(--text-secondary);">
                Nessuna registrazione trovata per i filtri selezionati.
              </div>
            ` : Object.keys(groups).sort().reverse().map(ym => {
              const [y, m] = ym.split('-');
              const groupLabel = `${MONTH_NAMES_FULL[parseInt(m, 10) - 1]} ${y}`;
              const entries = groups[ym];
              const monthTotal = entries.reduce((s, e) => s + e.amount, 0);

              return `
                <div class="month-group">
                  <div class="month-header">
                    <span class="month-title">${groupLabel}</span>
                    <span class="month-count">${entries.length} op. • Tot: ${formatCurrency(monthTotal)}</span>
                  </div>
                  <div class="journal-rows">
                    ${entries.map(je => renderJournalRow(je)).join('')}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;
  }

  function renderJournalRow(entry) {
    if (state.editingId === entry.id) {
      return renderJournalEditRow(entry);
    }

    const debitName = getAccountName(entry.debitAccountCode);
    const creditName = getAccountName(entry.creditAccountCode);
    const debitType = getAccountType(entry.debitAccountCode);
    const creditType = getAccountType(entry.creditAccountCode);

    return `
      <div class="journal-item" id="je-${entry.id}">
        <div class="journal-item-left">
          <div class="journal-date font-mono">${formatDateIt(entry.date)}</div>
          <div class="journal-details">
            <div class="journal-flow">
              <span class="acc-link ${getAccountBadgeClass(debitType)}" onclick="window.GiampyCash.showAccountDetail('${entry.debitAccountCode}')" title="Vedi conto">
                ${entry.debitAccountCode} ${debitName}
              </span>
              <span class="flow-arrow">→</span>
              <span class="acc-link ${getAccountBadgeClass(creditType)}" onclick="window.GiampyCash.showAccountDetail('${entry.creditAccountCode}')" title="Vedi conto">
                ${entry.creditAccountCode} ${creditName}
              </span>
            </div>
            <div class="journal-desc uppercase">${escapeHtml(entry.description)}</div>
          </div>
        </div>

        <div class="journal-item-right">
          <span class="journal-amount font-mono" onclick="window.GiampyCash.triggerZoom(this)">${formatCurrency(entry.amount)}</span>
          <div class="journal-actions">
            <button type="button" class="icon-btn" onclick="window.GiampyCash.startEditEntry('${entry.id}')" title="Modifica">✏️</button>
            <button type="button" class="icon-btn icon-btn-del" onclick="window.GiampyCash.deleteEntry('${entry.id}')" title="Elimina">🗑️</button>
          </div>
        </div>
      </div>
    `;
  }

  function renderJournalEditRow(entry) {
    const accounts = state.accounts;
    return `
      <div class="journal-item journal-item-editing">
        <form onsubmit="window.GiampyCash.saveEditEntry(event, '${entry.id}')" style="width:100%;">
          <div class="grid-form-contabilita" style="margin-bottom:8px;">
            <div class="form-group-c">
              <label>Data</label>
              <input type="date" id="editDate-${entry.id}" class="input-c font-mono" value="${entry.date}" required>
            </div>
            <div class="form-group-c">
              <label>Importo (€)</label>
              <input type="number" step="0.01" min="0.01" id="editAmount-${entry.id}" class="input-c font-mono text-right" value="${entry.amount}" required>
            </div>
            <div class="form-group-c">
              <label>Dare</label>
              <select id="editDebit-${entry.id}" class="input-c select-c" required>
                ${buildAccountOptions(accounts, entry.debitAccountCode)}
              </select>
            </div>
            <div class="form-group-c">
              <label>Avere</label>
              <select id="editCredit-${entry.id}" class="input-c select-c" required>
                ${buildAccountOptions(accounts, entry.creditAccountCode)}
              </select>
            </div>
            <div class="form-group-c span-2">
              <label>Descrizione</label>
              <input type="text" id="editDesc-${entry.id}" class="input-c uppercase" value="${escapeHtml(entry.description)}" required>
            </div>
          </div>
          <div style="display:flex;justify-content:flex-end;gap:8px;">
            <button type="button" class="btn-sm btn-outline-c" onclick="window.GiampyCash.cancelEditEntry()">Annulla</button>
            <button type="submit" class="btn-sm btn-primary-c">✓ Salva Modifica</button>
          </div>
        </form>
      </div>
    `;
  }

  function buildAccountOptions(accounts, selectedCode) {
    const groups = {
      costo: accounts.filter(a => a.type === 'costo'),
      ricavo: accounts.filter(a => a.type === 'ricavo'),
      attivo: accounts.filter(a => a.type === 'attivo'),
      passivo: accounts.filter(a => a.type === 'passivo')
    };

    let html = '';
    const groupTitles = [
      { key: 'costo', title: 'COSTI (6XXX)' },
      { key: 'ricavo', title: 'RICAVI (8XXX)' },
      { key: 'attivo', title: 'ATTIVO / CASSA / BANCA (4XXX)' },
      { key: 'passivo', title: 'PASSIVO / DEBITI (5XXX)' }
    ];

    groupTitles.forEach(g => {
      const list = groups[g.key] || [];
      if (list.length > 0) {
        html += `<optgroup label="${g.title}">`;
        list.forEach(a => {
          const sel = a.code === selectedCode ? 'selected' : '';
          html += `<option value="${a.code}" ${sel}>${a.code} - ${escapeHtml(a.name)}</option>`;
        });
        html += `</optgroup>`;
      }
    });

    return html;
  }

  // ==========================================
  // TAB 2: BUDGET ANNUO E MENSILE
  // ==========================================
  function renderTabBudget(container) {
    const economicAccounts = state.accounts.filter(a => a.type === 'costo' || a.type === 'ricavo')
      .sort((a, b) => a.code.localeCompare(b.code));

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();

    // Calcola consuntivo mensile per ogni conto
    const monthlyActualsMap = {};
    economicAccounts.forEach(acc => {
      const arr = new Array(12).fill(0);
      state.journalEntries.forEach(je => {
        if (!je.date.startsWith(`${currentYear}-`)) return;
        const m = parseInt(je.date.slice(5, 7), 10) - 1;
        if (m < 0 || m > 11) return;

        if (acc.type === 'costo') {
          if (je.debitAccountCode === acc.code) arr[m] += je.amount;
          if (je.creditAccountCode === acc.code) arr[m] -= je.amount;
        } else if (acc.type === 'ricavo') {
          if (je.creditAccountCode === acc.code) arr[m] += je.amount;
          if (je.debitAccountCode === acc.code) arr[m] -= je.amount;
        }
      });
      monthlyActualsMap[acc.code] = arr;
    });

    let totalBudgetAnnuo = 0;
    let totalContabilizzato = 0;

    const rowsHtml = economicAccounts.map(acc => {
      const bEntry = state.budgetEntries.find(b => b.accountCode === acc.code);
      const annual = bEntry ? bEntry.annualAmount : 0;
      totalBudgetAnnuo += annual;

      const actuals = monthlyActualsMap[acc.code] || new Array(12).fill(0);
      const contabilizzato = actuals.reduce((a, b) => a + b, 0);
      totalContabilizzato += contabilizzato;
      const residuo = annual - contabilizzato;

      return `
        <tr>
          <td class="font-mono" style="cursor:pointer;" onclick="window.GiampyCash.showAccountDetail('${acc.code}')">
            <span class="${getAccountBadgeClass(acc.type)}">${acc.code}</span>
          </td>
          <td style="font-weight:600;cursor:pointer;" onclick="window.GiampyCash.showAccountDetail('${acc.code}')">
            ${escapeHtml(acc.name)}
          </td>
          <td class="text-right font-mono font-bold" style="color:var(--text-primary);">
            ${formatCurrency(annual)}
          </td>
          <td class="text-right font-mono" style="color:#10b981;">
            ${formatCurrency(contabilizzato)}
          </td>
          <td class="text-right font-mono ${residuo < 0 ? 'text-danger' : ''}">
            ${formatCurrency(residuo)}
          </td>
          <td class="text-center">
            <button type="button" class="btn-sm btn-outline-c" onclick="window.GiampyCash.openEditBudgetModal('${acc.code}')">
              ✏️ Imposta Budget
            </button>
          </td>
        </tr>
      `;
    }).join('');

    container.innerHTML = `
      <div class="contabilita-content-wrapper">
        <div class="contabilita-card">
          <div class="contabilita-card-header">
            <div>
              <h3 class="contabilita-card-title">Budget Annuale ${currentYear}</h3>
              <p class="contabilita-card-sub">Pianificazione entrate e uscite per conti economici</p>
            </div>
            <div style="display:flex;gap:16px;text-align:right;">
              <div>
                <span class="text-xs text-muted">Totale Budget:</span>
                <div class="font-mono font-bold text-lg" style="color:#38bdf8;">${formatCurrency(totalBudgetAnnuo)}</div>
              </div>
              <div>
                <span class="text-xs text-muted">Contabilizzato:</span>
                <div class="font-mono font-bold text-lg" style="color:#10b981;">${formatCurrency(totalContabilizzato)}</div>
              </div>
            </div>
          </div>

          <div class="table-responsive-c">
            <table class="table-c">
              <thead>
                <tr>
                  <th style="width:70px;">Codice</th>
                  <th>Denominazione Conto</th>
                  <th class="text-right" style="width:130px;">Budget Annuo</th>
                  <th class="text-right" style="width:130px;">Contabilizzato</th>
                  <th class="text-right" style="width:130px;">Residuo</th>
                  <th class="text-center" style="width:130px;">Azione</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  // ==========================================
  // TAB 3: AVANZAMENTO BUDGET (PROIEZIONE LINEARE)
  // ==========================================
  function daysInMonth(year, month) {
    return new Date(year, month, 0).getDate();
  }

  function getDayOfYear() {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const diff = now.getTime() - start.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  function getLinearProjection(monthlyAmounts) {
    const now = new Date();
    const year = now.getFullYear();
    const currentMonth = now.getMonth();
    const currentDay = now.getDate();

    let projection = 0;
    for (let m = 0; m < 12; m++) {
      const monthBudget = (monthlyAmounts && monthlyAmounts[m]) || 0;
      if (monthBudget === 0) continue;

      const dailyRate = monthBudget / 30;
      const actualDays = daysInMonth(year, m + 1);

      if (m < currentMonth) {
        projection += monthBudget;
      } else if (m === currentMonth) {
        if (m === 1) { // Febbraio
          const isLeap = actualDays === 29;
          if (currentDay <= 27) {
            projection += dailyRate * currentDay;
          } else if (!isLeap) {
            projection += monthBudget;
          } else {
            projection += currentDay === 28 ? dailyRate * 28 : monthBudget;
          }
        } else if (actualDays === 31) {
          projection += currentDay <= 30 ? dailyRate * currentDay : monthBudget;
        } else {
          projection += dailyRate * Math.min(currentDay, 30);
        }
      }
    }
    return projection;
  }

  function renderTabAvanzamento(container) {
    const now = new Date();
    const year = now.getFullYear();
    const dayOfYear = getDayOfYear();
    const daysInYear = year % 4 === 0 ? 366 : 365;

    const economicAccounts = state.accounts.filter(a => a.type === 'costo' || a.type === 'ricavo')
      .sort((a, b) => a.code.localeCompare(b.code));

    // Calcolo effettivo consuntivo
    const actualMap = {};
    economicAccounts.forEach(acc => {
      let sum = 0;
      state.journalEntries.forEach(je => {
        if (!je.date.startsWith(`${year}-`)) return;
        if (je.debitAccountCode === acc.code) sum += je.amount;
        if (je.creditAccountCode === acc.code) sum -= je.amount;
      });
      actualMap[acc.code] = acc.type === 'ricavo' ? -sum : sum;
    });

    const rowsHtml = economicAccounts.map(acc => {
      const bEntry = state.budgetEntries.find(b => b.accountCode === acc.code);
      const annual = bEntry ? bEntry.annualAmount : 0;
      const monthly = bEntry ? bEntry.monthlyAmounts : new Array(12).fill(annual / 12);
      const projection = getLinearProjection(monthly);
      const actual = actualMap[acc.code] || 0;
      const delta = actual - projection;
      const pct = projection > 0 ? (actual / projection) * 100 : 0;

      // Se costo: consuntivo <= proiezione = verde; se consuntivo > proiezione = rosso
      // Se ricavo: consuntivo >= proiezione = verde; se consuntivo < proiezione = rosso
      const isGood = acc.type === 'costo' ? delta <= 0 : delta >= 0;
      const deltaClass = isGood ? 'text-success' : 'text-danger';

      return `
        <tr>
          <td class="font-mono" style="cursor:pointer;" onclick="window.GiampyCash.showAccountDetail('${acc.code}')">
            <span class="${getAccountBadgeClass(acc.type)}">${acc.code}</span>
          </td>
          <td style="font-weight:600;cursor:pointer;" onclick="window.GiampyCash.showAccountDetail('${acc.code}')">
            ${escapeHtml(acc.name)}
          </td>
          <td class="text-right font-mono" onclick="window.GiampyCash.triggerZoom(this)">
            ${formatCurrency(annual)}
          </td>
          <td class="text-right font-mono" style="color:#38bdf8;" onclick="window.GiampyCash.triggerZoom(this)">
            ${formatCurrency(projection)}
          </td>
          <td class="text-right font-mono font-bold" onclick="window.GiampyCash.triggerZoom(this)">
            ${formatCurrency(actual)}
          </td>
          <td class="text-right font-mono ${deltaClass}" onclick="window.GiampyCash.triggerZoom(this)">
            ${delta > 0 ? '+' : ''}${formatCurrency(delta)}
            <span class="text-xs" style="opacity:0.8;">(${pct.toFixed(0)}%)</span>
          </td>
        </tr>
      `;
    }).join('');

    container.innerHTML = `
      <div class="contabilita-content-wrapper">
        <div class="contabilita-card">
          <div class="contabilita-card-header">
            <div>
              <h3 class="contabilita-card-title">Avanzamento Budget (Giorno ${dayOfYear} di ${daysInYear})</h3>
              <p class="contabilita-card-sub">Confronto tra spesa effettiva e proiezione lineare teorica</p>
            </div>
            <div class="badge-info">
              Oggi: ${dayOfYear}/${daysInYear} (${((dayOfYear / daysInYear) * 100).toFixed(1)}% anno)
            </div>
          </div>

          <div class="table-responsive-c">
            <table class="table-c">
              <thead>
                <tr>
                  <th style="width:70px;">Codice</th>
                  <th>Conto</th>
                  <th class="text-right">Budget Annuo</th>
                  <th class="text-right" style="color:#38bdf8;">Proiezione Lineare</th>
                  <th class="text-right">Consuntivo Effettivo</th>
                  <th class="text-right">Scostamento</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  // ==========================================
  // TAB 4: LIQUIDITÀ (PREVISIONE CASSA A 24 MESI)
  // ==========================================
  function renderTabLiquidita(container) {
    const patrimonialAccounts = state.accounts.filter(a => a.type === 'attivo' || a.type === 'passivo');
    
    // Calcola saldo patrimoniale attuale
    let saldoPartenza = 0;
    const accountBalances = {};

    patrimonialAccounts.forEach(acc => {
      let dare = 0;
      let avere = 0;
      state.journalEntries.forEach(je => {
        if (je.debitAccountCode === acc.code) dare += je.amount;
        if (je.creditAccountCode === acc.code) avere += je.amount;
      });
      // Per conti attivo: Saldo = Dare - Avere
      // Per conti passivo: Saldo = Avere - Dare (debito)
      const balance = acc.type === 'attivo' ? (dare - avere) : (avere - dare);
      accountBalances[acc.code] = balance;
      if (acc.type === 'attivo') saldoPartenza += balance;
      else saldoPartenza -= balance;
    });

    // Proiezione mesi
    const now = new Date();
    const monthsForecast = [];
    let runningBalance = saldoPartenza;

    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const mIdx = d.getMonth();
      const ymLabel = `${MONTH_NAMES_SHORT[mIdx]} ${d.getFullYear()}`;

      // Somma entrate previste a budget per questo mese
      let ricaviMese = 0;
      let costiMese = 0;

      state.budgetEntries.forEach(be => {
        const acc = state.accounts.find(a => a.code === be.accountCode);
        if (!acc) return;
        const val = (be.monthlyAmounts && be.monthlyAmounts[mIdx]) || (be.annualAmount / 12) || 0;
        if (acc.type === 'ricavo') ricaviMese += val;
        if (acc.type === 'costo') costiMese += val;
      });

      const flussoMese = ricaviMese - costiMese;
      runningBalance += flussoMese;

      monthsForecast.push({
        label: ymLabel,
        ricavi: ricaviMese,
        costi: costiMese,
        flusso: flussoMese,
        saldoFinale: runningBalance
      });
    }

    container.innerHTML = `
      <div class="contabilita-content-wrapper">
        <!-- RIEPILOGO LIQUIDITÀ ATTUALE -->
        <div class="contabilita-card" style="margin-bottom:20px;">
          <div class="contabilita-card-header">
            <div>
              <h3 class="contabilita-card-title">Saldi Patrimoniali Attuali</h3>
              <p class="contabilita-card-sub">Liquidità presente sui conti e debiti a breve</p>
            </div>
            <div style="text-align:right;">
              <span class="text-xs text-muted">Liquidità Netta Iniziale:</span>
              <div class="font-mono font-bold text-2xl" style="color:#10b981;">${formatCurrency(saldoPartenza)}</div>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(220px, 1fr));gap:10px;margin-top:10px;">
            ${patrimonialAccounts.map(acc => {
              const bal = accountBalances[acc.code] || 0;
              return `
                <div class="liquidita-card-mini" onclick="window.GiampyCash.showAccountDetail('${acc.code}')" style="cursor:pointer;">
                  <div style="display:flex;justify-content:space-between;align-items:center;">
                    <span class="${getAccountBadgeClass(acc.type)}">${acc.code}</span>
                    <span class="font-mono font-bold ${bal < 0 ? 'text-danger' : ''}">${formatCurrency(bal)}</span>
                  </div>
                  <div class="truncate text-xs font-semibold" style="margin-top:4px;color:var(--text-secondary);">${escapeHtml(acc.name)}</div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- TABELLA PREVISIONE CASH FLOW -->
        <div class="contabilita-card">
          <div class="contabilita-card-header">
            <div>
              <h3 class="contabilita-card-title">Previsione Flusso di Cassa (Prossimi 12 Mesi)</h3>
              <p class="contabilita-card-sub">Simulazione basata sui budget mensili approvati</p>
            </div>
          </div>

          <div class="table-responsive-c">
            <table class="table-c">
              <thead>
                <tr>
                  <th>Periodo</th>
                  <th class="text-right" style="color:#10b981;">Entrate Previste</th>
                  <th class="text-right" style="color:#ef4444;">Uscite Previste</th>
                  <th class="text-right">Flusso Netto Mese</th>
                  <th class="text-right" style="color:#38bdf8;">Saldo Cassa Stimato</th>
                </tr>
              </thead>
              <tbody>
                ${monthsForecast.map(mf => `
                  <tr>
                    <td class="font-bold">${mf.label}</td>
                    <td class="text-right font-mono" style="color:#10b981;">+${formatCurrency(mf.ricavi)}</td>
                    <td class="text-right font-mono" style="color:#ef4444;">-${formatCurrency(mf.costi)}</td>
                    <td class="text-right font-mono ${mf.flusso < 0 ? 'text-danger' : 'text-success'}">
                      ${mf.flusso >= 0 ? '+' : ''}${formatCurrency(mf.flusso)}
                    </td>
                    <td class="text-right font-mono font-bold" style="color:#38bdf8;" onclick="window.GiampyCash.triggerZoom(this)">
                      ${formatCurrency(mf.saldoFinale)}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  // ==========================================
  // TAB 5: PIANO DEI CONTI
  // ==========================================
  function renderTabPianoDeiConti(container) {
    const categories = [
      { key: 'attivo', title: 'ATTIVO (4XXX)', desc: 'Cassa, Banche, Crediti e Disponibilità Liquide' },
      { key: 'passivo', title: 'PASSIVO (5XXX)', desc: 'Debiti, Cauzioni e Finanziamenti' },
      { key: 'costo', title: 'COSTI (6XXX)', desc: 'Spese di gestione, Utenze, Vitto, Tasse' },
      { key: 'ricavo', title: 'RICAVI (8XXX)', desc: 'Pensione, Affitti, Rimborsi e Proventi' }
    ];

    container.innerHTML = `
      <div class="contabilita-content-wrapper">
        <!-- FORM NUOVO CONTO -->
        <div class="contabilita-card" style="margin-bottom:20px;">
          <div class="contabilita-card-header">
            <div>
              <h3 class="contabilita-card-title">Aggiungi Nuovo Conto</h3>
              <p class="contabilita-card-sub">4 cifre: 4=Attivo, 5=Passivo, 6=Costo, 8=Ricavo</p>
            </div>
          </div>
          <form onsubmit="window.GiampyCash.handleNewAccountSubmit(event)" style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;">
            <div class="form-group-c" style="width:120px;">
              <label>Codice (4 cifre)</label>
              <input type="text" id="newAccCode" class="input-c font-mono" maxlength="4" placeholder="es. 6055" required>
            </div>
            <div class="form-group-c" style="flex:1;min-width:200px;">
              <label>Nome Conto</label>
              <input type="text" id="newAccName" class="input-c uppercase" placeholder="es. MANUTENZIONE GIARDINO" required>
            </div>
            <button type="submit" class="btn-primary-c" style="height:42px;">
              + Crea Conto
            </button>
          </form>
        </div>

        <!-- LISTE CONTI SUDDIVISI -->
        ${categories.map(cat => {
          const list = state.accounts.filter(a => a.type === cat.key).sort((a, b) => a.code.localeCompare(b.code));
          return `
            <div class="contabilita-card" style="margin-bottom:16px;">
              <div class="contabilita-card-header">
                <div>
                  <h3 class="contabilita-card-title">${cat.title} (${list.length})</h3>
                  <p class="contabilita-card-sub">${cat.desc}</p>
                </div>
              </div>

              <div class="table-responsive-c">
                <table class="table-c">
                  <thead>
                    <tr>
                      <th style="width:90px;">Codice</th>
                      <th>Denominazione Conto</th>
                      <th style="width:120px;text-align:right;">Movimenti</th>
                      <th style="width:140px;text-align:center;">Azioni</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${list.map(acc => {
                      const count = state.journalEntries.filter(j => j.debitAccountCode === acc.code || j.creditAccountCode === acc.code).length;
                      return `
                        <tr>
                          <td class="font-mono">
                            <span class="${getAccountBadgeClass(acc.type)}" style="cursor:pointer;" onclick="window.GiampyCash.showAccountDetail('${acc.code}')">${acc.code}</span>
                          </td>
                          <td style="font-weight:600;cursor:pointer;" onclick="window.GiampyCash.showAccountDetail('${acc.code}')">
                            ${escapeHtml(acc.name)}
                          </td>
                          <td class="text-right font-mono text-muted">
                            ${count > 0 ? `${count} op.` : '<span style="opacity:0.5;">0</span>'}
                          </td>
                          <td class="text-center">
                            <button type="button" class="icon-btn" onclick="window.GiampyCash.startEditAccount('${acc.code}')" title="Modifica Conto">✏️</button>
                            <button type="button" class="icon-btn icon-btn-del" onclick="window.GiampyCash.deleteAccount('${acc.code}')" title="Elimina Conto">🗑️</button>
                          </td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  // ==========================================
  // MODALE ESTRATTO CONTO DETTAGLIATO
  // ==========================================
  function showAccountDetail(accountCode) {
    state.selectedAccountCode = accountCode;
    const acc = state.accounts.find(a => a.code === accountCode);
    if (!acc) return;

    const entries = state.journalEntries
      .filter(j => j.debitAccountCode === accountCode || j.creditAccountCode === accountCode)
      .sort((a, b) => b.date.localeCompare(a.date));

    let dare = 0;
    let avere = 0;
    entries.forEach(e => {
      if (e.debitAccountCode === accountCode) dare += e.amount;
      if (e.creditAccountCode === accountCode) avere += e.amount;
    });

    const saldo = acc.type === 'passivo' ? (avere - dare) : (dare - avere);

    let modal = document.getElementById('accountDetailModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'accountDetailModal';
      modal.className = 'modal-overlay';
      modal.onclick = (e) => { if (e.target === modal) closeAccountDetail(); };
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="modal-card" style="max-width:760px;width:95%;max-height:90vh;display:flex;flex-direction:column;">
        <div class="modal-header">
          <div>
            <div style="display:flex;align-items:center;gap:8px;">
              <span class="${getAccountBadgeClass(acc.type)} font-mono">${acc.code}</span>
              <h3 style="margin:0;font-size:18px;">${escapeHtml(acc.name)}</h3>
            </div>
            <div class="text-xs text-muted" style="margin-top:4px;">${getAccountTypeLabel(acc.type)} • ${entries.length} movimenti registrati</div>
          </div>
          <button type="button" class="close-btn" onclick="window.GiampyCash.closeAccountDetail()">✕</button>
        </div>

        <div style="display:flex;gap:12px;padding:12px 18px;background:rgba(255,255,255,0.03);border-bottom:1px solid var(--border-color);justify-content:space-around;">
          <div style="text-align:center;">
            <div class="text-xs text-muted">Totale Dare</div>
            <div class="font-mono font-bold" style="color:#38bdf8;">${formatCurrency(dare)}</div>
          </div>
          <div style="text-align:center;">
            <div class="text-xs text-muted">Totale Avere</div>
            <div class="font-mono font-bold" style="color:#f59e0b;">${formatCurrency(avere)}</div>
          </div>
          <div style="text-align:center;">
            <div class="text-xs text-muted">Saldo Netto</div>
            <div class="font-mono font-bold text-lg" style="color:#10b981;">${formatCurrency(saldo)}</div>
          </div>
        </div>

        <div style="flex:1;overflow-y:auto;padding:12px 18px;">
          ${entries.length === 0 ? `
            <div style="text-align:center;padding:40px;color:var(--text-secondary);">Nessun movimento registrato per questo conto.</div>
          ` : `
            <table class="table-c" style="font-size:13px;">
              <thead>
                <tr>
                  <th style="width:85px;">Data</th>
                  <th style="width:60px;">Tipo</th>
                  <th>Contropartita</th>
                  <th>Descrizione</th>
                  <th class="text-right" style="width:100px;">Importo</th>
                </tr>
              </thead>
              <tbody>
                ${entries.map(e => {
                  const isDare = e.debitAccountCode === accountCode;
                  const counter = isDare ? e.creditAccountCode : e.debitAccountCode;
                  const counterName = getAccountName(counter);
                  return `
                    <tr>
                      <td class="font-mono text-xs">${formatDateIt(e.date)}</td>
                      <td>
                        <span class="badge-${isDare ? 'attivo' : 'passivo'} text-xs font-mono">${isDare ? 'DARE' : 'AVERE'}</span>
                      </td>
                      <td class="font-mono text-xs" style="color:var(--text-secondary);">
                        ${counter} ${escapeHtml(counterName)}
                      </td>
                      <td class="uppercase text-xs">${escapeHtml(e.description)}</td>
                      <td class="text-right font-mono font-bold">${formatCurrency(e.amount)}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          `}
        </div>

        <div class="modal-footer" style="display:flex;justify-content:space-between;padding:12px 18px;">
          <div style="display:flex;gap:8px;">
            <button type="button" class="btn-sm btn-outline-c" onclick="window.GiampyCash.exportAccountCsv('${acc.code}')">
              📥 Esporta CSV
            </button>
            <button type="button" class="btn-sm btn-outline-c" onclick="window.GiampyCash.printAccountReport('${acc.code}')">
              🖨️ Stampa / PDF
            </button>
          </div>
          <button type="button" class="btn-sm btn-primary-c" onclick="window.GiampyCash.closeAccountDetail()">
            Chiudi
          </button>
        </div>
      </div>
    `;
    modal.style.display = 'flex';
  }

  function closeAccountDetail() {
    const modal = document.getElementById('accountDetailModal');
    if (modal) modal.style.display = 'none';
  }

  // ==========================================
  // HANDLERS EVENTI AZIONI
  // ==========================================
  function handleDebitChange(debitCode) {
    if (!debitCode) return;
    const type = getAccountType(debitCode);
    const regCredit = document.getElementById('regCredit');
    const regDesc = document.getElementById('regDesc');

    // Se è un conto di costo, auto-seleziona il conto avere di default (4043 CC ING) se non già impostato
    if (type === 'costo' && regCredit && (!regCredit.value || regCredit.value === '')) {
      regCredit.value = state.defaultCostCredit;
    }

    // Auto-compila descrizione frequente
    if (DEFAULT_DESCRIPTIONS[debitCode] && regDesc && (!regDesc.value || regDesc.value.trim() === '')) {
      regDesc.value = DEFAULT_DESCRIPTIONS[debitCode];
    }
  }

  function setQuickAccount(target, code) {
    const select = target === 'debit' ? document.getElementById('regDebit') : document.getElementById('regCredit');
    if (select) {
      select.value = code;
      if (target === 'debit') handleDebitChange(code);
    }
  }

  function handleNewJournalSubmit(e) {
    e.preventDefault();
    const date = document.getElementById('regDate').value;
    const amountVal = parseFloat(document.getElementById('regAmount').value);
    const debit = document.getElementById('regDebit').value;
    const credit = document.getElementById('regCredit').value;
    const desc = document.getElementById('regDesc').value.trim().toUpperCase();

    if (!debit || !credit) {
      notify('Seleziona sia il Conto Dare che il Conto Avere', 'error');
      return;
    }
    if (debit === credit) {
      notify('Dare e Avere non possono essere lo stesso conto', 'error');
      return;
    }
    if (isNaN(amountVal) || amountVal <= 0) {
      notify('Inserisci un importo valido maggiore di zero', 'error');
      return;
    }

    const newEntry = {
      id: 'je-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      date: date || getTodayIso(),
      description: desc || 'OPERAZIONE',
      debitAccountCode: debit,
      creditAccountCode: credit,
      amount: amountVal
    };

    state.journalEntries.unshift(newEntry);
    state.journalEntries.sort((a, b) => b.date.localeCompare(a.date));

    // Reset modulo
    document.getElementById('regAmount').value = '';
    document.getElementById('regDesc').value = '';

    saveContabilitaServer();
    renderContabilitaModal();
    notify('Registrazione aggiunta con successo', 'success');
  }

  function startEditEntry(id) {
    state.editingId = id;
    renderContabilitaModal();
  }

  function cancelEditEntry() {
    state.editingId = null;
    renderContabilitaModal();
  }

  function saveEditEntry(e, id) {
    e.preventDefault();
    const date = document.getElementById(`editDate-${id}`).value;
    const amountVal = parseFloat(document.getElementById(`editAmount-${id}`).value);
    const debit = document.getElementById(`editDebit-${id}`).value;
    const credit = document.getElementById(`editCredit-${id}`).value;
    const desc = document.getElementById(`editDesc-${id}`).value.trim().toUpperCase();

    if (!debit || !credit) {
      notify('Seleziona sia il Dare che l\'Avere', 'error');
      return;
    }
    if (debit === credit) {
      notify('Dare e Avere devono essere conti distinti', 'error');
      return;
    }
    if (isNaN(amountVal) || amountVal <= 0) {
      notify('Importo non valido', 'error');
      return;
    }

    const idx = state.journalEntries.findIndex(je => je.id === id);
    if (idx >= 0) {
      state.journalEntries[idx] = {
        id,
        date,
        description: desc,
        debitAccountCode: debit,
        creditAccountCode: credit,
        amount: amountVal
      };
      state.journalEntries.sort((a, b) => b.date.localeCompare(a.date));
      state.editingId = null;
      saveContabilitaServer();
      renderContabilitaModal();
      notify('Registrazione modificata', 'success');
    }
  }

  function deleteEntry(id) {
    if (!confirm('Sei sicuro di voler eliminare questa registrazione?')) return;
    state.journalEntries = state.journalEntries.filter(je => je.id !== id);
    saveContabilitaServer();
    renderContabilitaModal();
    notify('Registrazione eliminata', 'info');
  }

  function setFilter(type, val) {
    if (type === 'from') state.filterFrom = val;
    if (type === 'to') state.filterTo = val;
    if (type === 'account') state.filterAccount = val;
    renderContabilitaModal();
  }

  function setQuickFilter(mode) {
    const y = new Date().getFullYear();
    if (mode === 'year') {
      state.filterFrom = `${y}-01-01`;
      state.filterTo = `${y}-12-31`;
    } else if (mode === 'month') {
      state.filterFrom = getFirstDayOfMonthIso();
      state.filterTo = getTodayIso();
    } else if (mode === 'all') {
      state.filterFrom = '';
      state.filterTo = '';
    }
    renderContabilitaModal();
  }

  // --- GESTIONE PIANO DEI CONTI ---
  function handleNewAccountSubmit(e) {
    e.preventDefault();
    const code = document.getElementById('newAccCode').value.trim();
    const name = document.getElementById('newAccName').value.trim().toUpperCase();

    if (!/^\d{4}$/.test(code)) {
      notify('Il codice deve essere di esattamente 4 cifre numeriche', 'error');
      return;
    }
    const type = getAccountType(code);
    if (!type) {
      notify('Prima cifra non valida: 4=Attivo, 5=Passivo, 6=Costo, 8=Ricavo', 'error');
      return;
    }
    if (!name) {
      notify('Inserisci il nome del conto', 'error');
      return;
    }
    if (state.accounts.some(a => a.code === code)) {
      notify('Codice conto già esistente', 'error');
      return;
    }

    state.accounts.push({ code, name, type });
    state.accounts.sort((a, b) => a.code.localeCompare(b.code));

    saveContabilitaServer();
    renderContabilitaModal();
    notify(`Conto ${code} - ${name} creato`, 'success');
  }

  function startEditAccount(code) {
    const acc = state.accounts.find(a => a.code === code);
    if (!acc) return;
    const newName = prompt(`Nuovo nome per il conto ${code}:`, acc.name);
    if (newName && newName.trim()) {
      acc.name = newName.trim().toUpperCase();
      saveContabilitaServer();
      renderContabilitaModal();
      notify('Conto aggiornato', 'success');
    }
  }

  function deleteAccount(code) {
    const count = state.journalEntries.filter(j => j.debitAccountCode === code || j.creditAccountCode === code).length;
    if (count > 0) {
      alert(`Impossibile eliminare il conto ${code}: ci sono ${count} registrazioni collegate.\nElimina prima i movimenti correlati.`);
      return;
    }
    if (!confirm(`Sei sicuro di voler eliminare il conto ${code}?`)) return;

    state.accounts = state.accounts.filter(a => a.code !== code);
    state.budgetEntries = state.budgetEntries.filter(b => b.accountCode !== code);
    saveContabilitaServer();
    renderContabilitaModal();
    notify(`Conto ${code} eliminato`, 'info');
  }

  // --- GESTIONE BUDGET MODAL ---
  function openEditBudgetModal(code) {
    const acc = state.accounts.find(a => a.code === code);
    if (!acc) return;
    const existing = state.budgetEntries.find(b => b.accountCode === code);
    const curAnnual = existing ? existing.annualAmount : 0;
    const curMonthly = existing && existing.monthlyAmounts && existing.monthlyAmounts.length === 12
      ? [...existing.monthlyAmounts]
      : new Array(12).fill(Math.round((curAnnual / 12) * 100) / 100);

    const inputVal = prompt(`Imposta Budget Annuale (€) per ${acc.code} ${acc.name}:`, curAnnual);
    if (inputVal === null) return;
    const num = parseFloat(inputVal.replace(',', '.'));
    if (isNaN(num) || num < 0) {
      notify('Importo non valido', 'error');
      return;
    }

    const baseMonth = Math.floor((num / 12) * 100) / 100;
    const newMonthly = new Array(12).fill(baseMonth);
    const rem = Math.round((num - baseMonth * 12) * 100) / 100;
    newMonthly[11] = Math.round((baseMonth + rem) * 100) / 100;

    const bIdx = state.budgetEntries.findIndex(b => b.accountCode === code);
    const entry = { accountCode: code, annualAmount: num, monthlyAmounts: newMonthly };
    if (bIdx >= 0) state.budgetEntries[bIdx] = entry;
    else state.budgetEntries.push(entry);

    saveContabilitaServer();
    renderContabilitaModal();
    notify(`Budget aggiornato per ${acc.name}`, 'success');
  }

  // --- CSV EXPORT & IMPORT ---
  function exportCsv(scope) {
    const from = state.filterFrom;
    const to = state.filterTo;
    const filterAcc = state.filterAccount;

    const rows = scope === 'periodo'
      ? state.journalEntries.filter(je => (!from || je.date >= from) && (!to || je.date <= to) && (!filterAcc || je.debitAccountCode === filterAcc || je.creditAccountCode === filterAcc))
      : [...state.journalEntries];

    if (rows.length === 0) {
      notify('Nessuna registrazione da esportare', 'warning');
      return;
    }

    const esc = (v) => `"${String(v || '').replace(/"/g, '""')}"`;
    const header = [
      'Numero conto dare',
      'Numero conto avere',
      'Descrizione conto dare',
      'Descrizione conto avere',
      'Data',
      'Importo',
      'Descrizione'
    ];

    const lines = [
      header.map(esc).join(';'),
      ...rows.map(je => [
        je.debitAccountCode,
        je.creditAccountCode,
        getAccountName(je.debitAccountCode),
        getAccountName(je.creditAccountCode),
        formatDateIt(je.date),
        je.amount.toFixed(2).replace('.', ','),
        (je.description || '').toUpperCase()
      ].map(esc).join(';'))
    ];

    const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = scope === 'periodo' ? `registrazioni_${from}_${to}.csv` : `registrazioni_tutte_${getTodayIso()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    notify('File CSV scaricato con successo', 'success');
  }

  function handleCsvFileInput(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      const csv = e.target.result;
      try {
        notify('Importazione in corso...', 'info');
        const res = await fetch('/api/contabilita/import-csv', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ csv })
        });
        const json = await res.json();
        if (json.success) {
          notify(`Importate con successo ${json.imported} nuove registrazioni!`, 'success');
          await fetchContabilita();
        } else {
          notify(`Errore importazione: ${json.error || 'file non valido'}`, 'error');
        }
      } catch (err) {
        notify('Errore durante l\'importazione del CSV', 'error');
      }
    };
    reader.readAsText(file, 'utf-8');
    event.target.value = '';
  }

  function exportAccountCsv(code) {
    const acc = state.accounts.find(a => a.code === code);
    if (!acc) return;
    const entries = state.journalEntries.filter(j => j.debitAccountCode === code || j.creditAccountCode === code);

    const esc = (v) => `"${String(v || '').replace(/"/g, '""')}"`;
    const lines = [
      ['Data', 'Tipo', 'Contropartita', 'Descrizione', 'Importo'].map(esc).join(';'),
      ...entries.map(e => {
        const isDare = e.debitAccountCode === code;
        const counter = isDare ? e.creditAccountCode : e.debitAccountCode;
        return [
          formatDateIt(e.date),
          isDare ? 'Dare' : 'Avere',
          `${counter} ${getAccountName(counter)}`,
          (e.description || '').toUpperCase(),
          e.amount.toFixed(2).replace('.', ',')
        ].map(esc).join(';');
      })
    ];

    const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `estratto_conto_${code}_${getTodayIso()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function printAccountReport(code) {
    window.print();
  }

  // --- ZOOM CELL PER MOBILE TOUCH ---
  function triggerZoom(el) {
    el.classList.add('zoom-active');
    setTimeout(() => el.classList.remove('zoom-active'), 2500);
  }

  // --- ASSISTENTE VOCALE PER LA CONTABILITÀ ---
  function startVoiceEntry() {
    if (window.openVoiceModalForSection) {
      window.openVoiceModalForSection('contabilita');
    } else if (window.startVoiceAssistant) {
      window.startVoiceAssistant();
    } else {
      notify('Microfono non supportato su questo browser', 'warning');
    }
  }

  /**
   * Interprete comandi vocali per contabilità:
   * "Registra 50 euro gasolio da conto ing"
   * "Registra spesa 35 euro alimentari da cassa"
   * "Contabilità 120 euro affitti villas su banca"
   */
  function parseAndExecuteVoiceCommand(text) {
    const raw = (text || '').toLowerCase().trim();
    if (!raw) return false;

    // Cerca importo (€ o euro)
    const amountMatch = raw.match(/(\d+(?:[.,]\d{1,2})?)\s*(?:euro|€)/i) || raw.match(/(?:euro|€)\s*(\d+(?:[.,]\d{1,2})?)/i);
    let amount = 0;
    if (amountMatch) {
      amount = parseFloat(amountMatch[1].replace(',', '.'));
    }

    // Match conti Dare e Avere tra i 95 conti
    let matchedDebit = null;
    let matchedCredit = null;

    // Ricerca conto Avere (solitamente Cassa o Banche: ing, cassa, bbva, bancoposta)
    if (raw.includes('ing') || raw.includes('conto ing') || raw.includes('cc ing')) {
      matchedCredit = '4043';
    } else if (raw.includes('cassa') || raw.includes('contanti')) {
      matchedCredit = '4010';
    } else if (raw.includes('bbva')) {
      matchedCredit = '4044';
    } else if (raw.includes('banco posta') || raw.includes('bancoposta')) {
      matchedCredit = '4046';
    } else if (raw.includes('paypal')) {
      matchedCredit = '4072';
    } else if (raw.includes('sardegna')) {
      matchedCredit = '4045';
    }

    // Ricerca conto Dare (solitamente Spesa / Costo o Ricavo)
    if (raw.includes('gasolio') || raw.includes('diesel') || raw.includes('carburante')) {
      matchedDebit = '6041';
    } else if (raw.includes('spesa') || raw.includes('alimentari') || raw.includes('supermercato') || raw.includes('vitto')) {
      matchedDebit = '6110';
    } else if (raw.includes('affitti') || raw.includes('villasimius') || raw.includes('villas')) {
      matchedDebit = '4043'; // Entrata su conto
      matchedCredit = '8040'; // Da Affitti Villas
    } else if (raw.includes('luce') || raw.includes('corrente') || raw.includes('energia')) {
      matchedDebit = '6050';
    } else if (raw.includes('acqua')) {
      matchedDebit = '6060';
    } else if (raw.includes('tari') || raw.includes('spazzatura')) {
      matchedDebit = '6031';
    } else if (raw.includes('ristorante') || raw.includes('pizza')) {
      matchedDebit = '6010';
    }

    // Se non troviamo il credito, usa default (4043 ING)
    if (!matchedCredit && matchedDebit && getAccountType(matchedDebit) === 'costo') {
      matchedCredit = state.defaultCostCredit || '4043';
    }

    // Se abbiamo trovato almeno l'importo e i conti: registra direttamente!
    if (amount > 0 && matchedDebit && matchedCredit && matchedDebit !== matchedCredit) {
      const cleanDesc = raw
        .replace(/^(?:registra|contabilità|inserisci|memorizza)\s*/i, '')
        .replace(/(\d+(?:[.,]\d{1,2})?)\s*(?:euro|€)/i, '')
        .replace(/da\s+(?:conto|banca|carta)?\s*(?:ing|cassa|bbva|paypal)?/i, '')
        .trim().toUpperCase() || 'SPESA REGISTRATA VOCALMENTE';

      const newEntry = {
        id: 'voice-' + Date.now(),
        date: getTodayIso(),
        description: cleanDesc,
        debitAccountCode: matchedDebit,
        creditAccountCode: matchedCredit,
        amount: amount
      };

      state.journalEntries.unshift(newEntry);
      state.journalEntries.sort((a, b) => b.date.localeCompare(a.date));
      saveContabilitaServer();
      renderContabilitaModal();

      const spokenResponse = `Registrazione salvata: ${amount} euro da ${getAccountName(matchedCredit)} a ${getAccountName(matchedDebit)}.`;
      if (window.speakResponse) window.speakResponse(spokenResponse);
      notify(spokenResponse, 'success');
      return true;
    }

    // Se non tutti i campi sono stati riconosciuti, apri il modale e compila ciò che sappiamo
    openContabilitaModal();
    setTimeout(() => {
      const amountEl = document.getElementById('regAmount');
      const debitEl = document.getElementById('regDebit');
      const creditEl = document.getElementById('regCredit');
      const descEl = document.getElementById('regDesc');

      if (amountEl && amount > 0) amountEl.value = amount;
      if (debitEl && matchedDebit) debitEl.value = matchedDebit;
      if (creditEl && matchedCredit) creditEl.value = matchedCredit;
      if (descEl) descEl.value = raw.toUpperCase();
    }, 200);

    const warnMsg = `Ho aperto la contabilità: controlla i campi e premi Registra.`;
    if (window.speakResponse) window.speakResponse(warnMsg);
    notify(warnMsg, 'info');
    return true;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // --- ESPOSIZIONE API GLOBALE ---
  window.GiampyCash = {
    openModal: openContabilitaModal,
    closeModal: closeContabilitaModal,
    switchTab: switchTab,
    fetchData: fetchContabilita,
    handleNewJournalSubmit: handleNewJournalSubmit,
    handleDebitChange: handleDebitChange,
    setQuickAccount: setQuickAccount,
    startEditEntry: startEditEntry,
    cancelEditEntry: cancelEditEntry,
    saveEditEntry: saveEditEntry,
    deleteEntry: deleteEntry,
    setFilter: setFilter,
    setQuickFilter: setQuickFilter,
    handleNewAccountSubmit: handleNewAccountSubmit,
    startEditAccount: startEditAccount,
    deleteAccount: deleteAccount,
    openEditBudgetModal: openEditBudgetModal,
    showAccountDetail: showAccountDetail,
    closeAccountDetail: closeAccountDetail,
    exportCsv: exportCsv,
    handleCsvFileInput: handleCsvFileInput,
    exportAccountCsv: exportAccountCsv,
    printAccountReport: printAccountReport,
    triggerZoom: triggerZoom,
    startVoiceEntry: startVoiceEntry,
    parseVoiceCommand: parseAndExecuteVoiceCommand
  };

  // Alias globale per compatibilità con il markup
  window.openContabilitaModal = openContabilitaModal;
  window.closeContabilitaModal = closeContabilitaModal;

  // Inizializzazione automatica al caricamento della pagina
  document.addEventListener('DOMContentLoaded', () => {
    fetchContabilita();
  });

})(window);
