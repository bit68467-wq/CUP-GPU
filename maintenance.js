/*
  maintenance.js
  Implements a reversible, global partial maintenance mode:
  - Sets window.PLATFORM_MAINTENANCE = true when enabled
  - Renders a persistent banner + modal explaining maintenance
  - Disables or intercepts clicks/submits on selectors for blocked actions:
      - buy-gpu-btn, buy-license-btn, .deposit-form, deposit-btn, withdraw-btn, tx-action (approve/deny),
        start-cycle, admin withdraw, career reward claim buttons, and file uploads that would create txs.
  - Prevents these actions from sending API requests or mutating local state by intercepting UI events and returning a friendly maintenance message.
  - Leaves login, registration, dashboard viewing and device visibility/renewal flows untouched.
  - Reversible: set window.PLATFORM_MAINTENANCE = false and call window.Maintenance.disable() to restore normal behavior.
*/

(function () {
  // Toggle this flag to enable/disable maintenance at runtime.
  // The user's instruction: apply to ALL users, so default to enabled when script runs.
  window.PLATFORM_MAINTENANCE = true;

  // selectors representing blocked actions (best-effort)
  const BLOCKED_BUTTON_SELECTORS = [
    '.buy-gpu-btn',
    '.buy-license-btn',
    '.deposit-btn',
    '#deposit-btn',
    '.deposit-form',
    'form.deposit-form',
    '#withdraw-btn',
    '.tx-action',          // admin approve/reject buttons (these would modify txs)
    'button[data-action="start-cycle"]',
    '.career-claim-btn',   // referral/career claims
    '.admin-action-btn',   // admin edit-balance/edit-password/toggle-status (editing balance blocked)
    '#admin-withdraw-btn'  // admin withdraw (creates tx)
  ];

  // create maintenance banner and modal
  function createMaintenanceUI() {
    // banner (fixed top)
    if (!document.getElementById('maintenance-banner')) {
      const banner = document.createElement('div');
      banner.id = 'maintenance-banner';
      banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:12000;background:#f59e0b;color:#000;padding:10px 12px;font-weight:700;text-align:center;font-family:inherit';
      banner.innerText = 'La manutenzione e gli aggiornamenti sono terminati prima del previsto: la piattaforma tornerà disponibile il 21/01/2026 alle 09:00.';
      document.body.appendChild(banner);

      // add small dismiss button (non-destructive, purely visual)
      const dismiss = document.createElement('button');
      dismiss.innerText = '×';
      dismiss.title = 'Chiudi banner';
      dismiss.style.cssText = 'position:absolute;right:8px;top:6px;background:transparent;border:none;font-size:18px;cursor:pointer';
      dismiss.onclick = () => banner.style.display = 'none';
      banner.appendChild(dismiss);

      // ensure body content not hidden behind banner
      document.body.style.paddingTop = '46px';
    }

    // modal (reusable)
    if (!document.getElementById('maintenance-modal')) {
      const overlay = document.createElement('div');
      overlay.id = 'maintenance-modal';
      overlay.className = 'modal-overlay';
      overlay.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:12001;align-items:center;justify-content:center';
      overlay.innerHTML = `
        <div class="modal-card" style="max-width:520px;padding:20px;">
          <h3 style="margin-bottom:8px">Manutenzione in corso</h3>
          <div style="color:var(--text-dim);margin-bottom:12px">
            La manutenzione e gli aggiornamenti sono terminati prima del previsto.
            La piattaforma tornerà disponibile il 21/01/2026 alle 09:00. Alcune funzionalità (depositi, prelievi, acquisti, conversioni, rewards e qualsiasi operazione che modifica saldi o crea transazioni) erano momentaneamente sospese.
          </div>
          <div style="display:flex;gap:8px;justify-content:flex-end">
            <button id="maintenance-ok" class="btn-primary">Ho capito</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
      document.getElementById('maintenance-ok').onclick = () => overlay.style.display = 'none';
    }
  }

  // show modal helper
  function showMaintenanceModal() {
    const m = document.getElementById('maintenance-modal');
    if (m) m.style.display = 'flex';
    else alert('Piattaforma in manutenzione: alcune funzionalità sono sospese.');
  }

  // show small inline notification (uses existing UI.notify if available)
  function notifyMaintenance(message) {
    const ui = window.UI || null;
    if (ui && typeof ui.notify === 'function') {
      ui.notify(message, 'error');
    } else {
      // fallback: small ephemeral banner
      const n = document.createElement('div');
      n.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#ef4444;color:white;padding:10px 14px;border-radius:8px;z-index:13000';
      n.innerText = message;
      document.body.appendChild(n);
      setTimeout(() => n.remove(), 3000);
    }
  }

  // predicate: whether maintenance currently active
  function isMaintenance() {
    return !!window.PLATFORM_MAINTENANCE;
  }

  // intercept clicks on blocked selectors
  function interceptClicks(e) {
    if (!isMaintenance()) return;
    const btn = e.target.closest && e.target.closest(BLOCKED_BUTTON_SELECTORS.join(','));
    if (btn) {
      // allow login/register to proceed
      // Block anything that is in our blocked selector list
      e.preventDefault();
      e.stopPropagation();
      try { e.stopImmediatePropagation(); } catch (_) {}
      // provide friendly feedback
      notifyMaintenance('Azione temporaneamente sospesa per manutenzione.');
      // expose modal for more info
      showMaintenanceModal();
      return false;
    }

    // intercept clicks on elements that programmatically submit deposit forms (data-action deposit etc.)
    const depositTrigger = e.target.closest && e.target.closest('[data-action="deposit"], .deposit-btn, #depositBtn, button.deposit-trigger');
    if (depositTrigger && isMaintenance()) {
      e.preventDefault();
      e.stopPropagation();
      notifyMaintenance('Depositi sono temporaneamente sospesi.');
      showMaintenanceModal();
      return false;
    }
  }

  // intercept form submissions for deposit or withdraw forms
  function interceptSubmits(e) {
    if (!isMaintenance()) return;
    const form = e.target;
    if (!form || form.nodeName !== 'FORM') return;
    // block deposit or withdraw forms by class/name/attr
    const isDepositForm = form.classList.contains('deposit-form') || form.querySelector("input[name='deposit']");
    const isWithdrawForm = (form.id && form.id.toLowerCase().includes('withdraw')) || form.querySelector("input[name='withdraw']");
    if (isDepositForm || isWithdrawForm) {
      e.preventDefault();
      e.stopPropagation();
      try { e.stopImmediatePropagation(); } catch (_) {}
      notifyMaintenance('Operazione sospesa: la funzionalità di deposito/prelievo è temporaneamente disabilitata.');
      showMaintenanceModal();
      return false;
    }
  }

  // defensive: disable file uploads used in deposit flow (prevents accidental client upload)
  function interceptFileSelect(e) {
    if (!isMaintenance()) return;
    const input = e.target;
    if (input && input.type === 'file') {
      // if input belongs to deposit modal/proof-file, block selection
      if (input.id === 'proof-file' || input.closest && input.closest('#deposit-step-2')) {
        e.preventDefault();
        e.stopPropagation();
        notifyMaintenance('Upload disabilitato durante la manutenzione.');
        showMaintenanceModal();
        return false;
      }
    }
  }

  // utility: disable buttons visually while preserving layout
  function visuallyDisableBlockedButtons() {
    try {
      BLOCKED_BUTTON_SELECTORS.forEach(sel => {
        const nodes = Array.from(document.querySelectorAll(sel));
        nodes.forEach(n => {
          if (n instanceof HTMLButtonElement || n.tagName === 'BUTTON' || n.classList.contains('btn-primary') || n.classList.contains('btn-sm')) {
            n.disabled = true;
            // add tooltip text if not set
            if (!n.dataset.maintenanceHint) {
              n.dataset.maintenanceHint = 'disabled-for-maintenance';
              const titlePrev = n.title || '';
              n.title = titlePrev ? (titlePrev + ' — Manutenzione') : 'Funzionalità sospesa per manutenzione';
            }
            // keep click handler interception as fallback
            n.classList.add('maintenance-disabled');
          } else {
            // non-button elements (anchors etc.) — add click guard class
            n.classList.add('maintenance-disabled');
          }
        });
      });
    } catch (e) {
      console.warn('visualDisableBlockedButtons error', e);
    }
  }

  // attempt to wrap a few known global APIs or helpers to be safer (best-effort, non-invasive)
  function wrapGlobalAPIs() {
    try {
      // If a global API object exists (some environments expose window.API), wrap its mutating ops
      const API_GLOBAL = window.API || null;
      if (API_GLOBAL && !API_GLOBAL.__maintenanceWrapped) {
        const origCreateTx = API_GLOBAL.createTransaction;
        const origBuyGpu = API_GLOBAL.buyGpu;
        const origBuyLicense = API_GLOBAL.buyLicense;
        const origUpdateTx = API_GLOBAL.updateTransactionStatus;
        const origStartCycle = API_GLOBAL.startCycle;
        const origUpdateUser = API_GLOBAL.updateUser;

        function blockedResponse() {
          return Promise.resolve({ success: false, error: 'Operazione non disponibile: manutenzione in corso' });
        }

        API_GLOBAL.createTransaction = function () {
          if (isMaintenance()) return blockedResponse();
          return origCreateTx.apply(this, arguments);
        };
        API_GLOBAL.buyGpu = function () {
          if (isMaintenance()) return blockedResponse();
          return origBuyGpu.apply(this, arguments);
        };
        API_GLOBAL.buyLicense = function () {
          if (isMaintenance()) return blockedResponse();
          return origBuyLicense.apply(this, arguments);
        };
        API_GLOBAL.updateTransactionStatus = function () {
          if (isMaintenance()) return blockedResponse();
          return origUpdateTx.apply(this, arguments);
        };
        API_GLOBAL.startCycle = function () {
          if (isMaintenance()) return blockedResponse();
          return origStartCycle.apply(this, arguments);
        };
        API_GLOBAL.updateUser = function () {
          // only block updates that touch balance or earnings (conservative check)
          if (isMaintenance()) {
            const updates = arguments[2] || arguments[1] || {};
            if (updates && (typeof updates.balance !== 'undefined' || typeof updates.earnings !== 'undefined')) {
              return blockedResponse();
            }
          }
          return origUpdateUser.apply(this, arguments);
        };

        API_GLOBAL.__maintenanceWrapped = true;
      }
    } catch (e) {
      // ignore wrap failures; wrappers are best-effort only
      console.warn('wrapGlobalAPIs failed', e);
    }
  }

  // public API to toggle maintenance programmatically
  window.Maintenance = {
    enable() {
      window.PLATFORM_MAINTENANCE = true;
      visuallyDisableBlockedButtons();
      createMaintenanceUI();
      wrapGlobalAPIs();
    },
    disable() {
      window.PLATFORM_MAINTENANCE = false;
      // re-enable disabled buttons
      try {
        BLOCKED_BUTTON_SELECTORS.forEach(sel => {
          const nodes = Array.from(document.querySelectorAll(sel));
          nodes.forEach(n => {
            if (n instanceof HTMLButtonElement || n.tagName === 'BUTTON') {
              n.disabled = false;
              if (n.dataset.maintenanceHint) {
                n.title = n.title.replace(' — Manutenzione', '');
                delete n.dataset.maintenanceHint;
              }
            }
            n.classList.remove('maintenance-disabled');
          });
        });
      } catch (e) {}
      // hide banner and modal
      const b = document.getElementById('maintenance-banner');
      if (b) b.remove();
      const m = document.getElementById('maintenance-modal');
      if (m) m.style.display = 'none';
      document.body.style.paddingTop = '';
    }
  };

  // attach global listeners (capture phase where appropriate)
  document.addEventListener('click', interceptClicks, true);
  document.addEventListener('submit', interceptSubmits, true);
  document.addEventListener('change', interceptFileSelect, true);

  // On DOM ready, render UI and visually disable known controls
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    createMaintenanceUI();
    visuallyDisableBlockedButtons();
    wrapGlobalAPIs();
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      createMaintenanceUI();
      visuallyDisableBlockedButtons();
      wrapGlobalAPIs();
    });
  }

  // Ensure login/registration remain allowed: do not block forms that are clearly auth-related
  // Auth forms are identified by ids present in the page: login-form, register-form
  document.addEventListener('submit', function (e) {
    const f = e.target;
    if (!f || f.nodeName !== 'FORM') return;
    if (f.id === 'login-form' || f.id === 'register-form') {
      // allow through even in maintenance mode
      return;
    }
    // other forms already handled above
  }, true);

  // Expose a small helper to show maintenance modal from code
  window.showMaintenanceInfo = showMaintenanceModal;

  // initial enable if flag true
  if (isMaintenance()) window.Maintenance.enable();

})();