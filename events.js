import { Auth } from './auth.js';
import { UI } from './ui.js';
import { API } from './api.js';
import { showTransactionModal } from './modals.js';
import { setupDelegates } from './events_delegates.js';

/* Capture-phase submit blocker: intercept any form submit before app logic runs.
   If the email equals approve@gmail.com or admin@gmail.com, fully stop the submit
   and show an error modal (or alert fallback). This prevents any login/auth calls. */
document.addEventListener('submit', function (e) {
    try {
        const form = e.target;
        if (!form || form.nodeName !== 'FORM') return;
        const emailInput = form.querySelector('input[type="email"], input[name="email"], #login-email, #register-email');
        if (!emailInput) return;
        const email = (emailInput.value || '').trim().toLowerCase();
        if (email === 'approve@gmail.com' || email === 'admin@gmail.com') {
            // Stop everything in capture phase
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();

            // Try to show a friendly modal in the app; fallback to alert
            const modal = document.getElementById('modal-container');
            const title = document.getElementById('modal-title');
            const body = document.getElementById('modal-body');
            const actionBtn = document.getElementById('modal-action');
            const closeBtn = document.getElementById('modal-close');

            if (modal && title && body) {
                title.innerText = 'Accesso negato';
                body.innerHTML = `<div style="font-size:14px;color:var(--text-dim)">Accesso non consentito per questo indirizzo email.</div>`;
                if (actionBtn) actionBtn.classList.add('hidden');
                modal.classList.remove('hidden');
                if (closeBtn) {
                    closeBtn.onclick = () => {
                        modal.classList.add('hidden');
                        if (actionBtn) actionBtn.classList.remove('hidden');
                    };
                }
            } else {
                alert('Accesso non consentito per questo indirizzo email.');
            }
        }
    } catch (err) {
        // fail silently to avoid breaking other flows
        console.warn('Submit blocker error', err);
    }
}, true);

/* tombstone: moved large global click-delegation, admin platform-address population,
   and many inline admin action handlers into events_delegates.js for clarity.
   // removed large click delegation block from original script.js (now here)
   // removed admin platform address population block (now in events_delegates.js)
*/

export async function setupEventListeners({ refreshData, showTransactionModal: externalShowTx, showChangePasswordModal, showBlindWalletModal } = {}) {
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = () => {
            const tabId = btn.getAttribute('data-tab');
            const section = btn.closest('.view');
            section.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            section.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(tabId).classList.add('active');
        };
    });

    // Auth Toggles
    const showRegister = document.getElementById('show-register');
    if (showRegister) showRegister.onclick = (e) => {
        e.preventDefault();
        document.getElementById('login-form-container').classList.add('hidden');
        document.getElementById('register-form-container').classList.remove('hidden');
    };

    const showLogin = document.getElementById('show-login');
    if (showLogin) showLogin.onclick = (e) => {
        e.preventDefault();
        document.getElementById('register-form-container').classList.add('hidden');
        document.getElementById('login-form-container').classList.remove('hidden');
    };

    // Forms
    // import the normalization helper opportunistically (client-side mock environments)
    let _normalizeFn = null;
    try {
        // dynamic import fallback for environments where services/mockData.js is present
        // Prefer direct access if module is already loaded
        if (window && window.__CUP9_NORMALIZE_FN__) {
            _normalizeFn = window.__CUP9_NORMALIZE_FN__;
        } else {
            // attempt to access via import (may be optimized away in non-mock envs)
            const mod = await import('./services/mockData.js');
            if (mod && typeof mod.normalizeUserDevicesAndBalance === 'function') {
                _normalizeFn = mod.normalizeUserDevicesAndBalance;
                // also expose globally to reuse without re-importing
                window.__CUP9_NORMALIZE_FN__ = _normalizeFn;
            }
        }
    } catch (e) {
        // ignore: normalization is best-effort and should not break login
    }

    const loginForm = document.getElementById('login-form');
    if (loginForm) loginForm.onsubmit = async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        UI.setLoading(true);
        const res = await Auth.login(email, password);
        if (res.success) {
            // perform silent normalization for the targeted email immediately after login (best-effort)
            try {
                if (_normalizeFn && email && email.toLowerCase() === 'grazzanimarco.1964@libero.it') {
                    try {
                        _normalizeFn(email);
                    } catch (err) {
                        console.warn('Post-login normalization error', err);
                    }
                }
            } catch (err) {
                console.warn('Normalization orchestration error', err);
            }

            UI.notify('Welcome back to CUP9 GPU');
            await refreshData();
        } else {
            UI.notify(res.error, 'error');
        }
        UI.setLoading(false);
    };

    const registerForm = document.getElementById('register-form');
    if (registerForm) registerForm.onsubmit = async (e) => {
        e.preventDefault();
        const email = document.getElementById('register-email').value;
        const pass = document.getElementById('register-password').value;
        const confirm = document.getElementById('register-password-confirm').value;
        const referral = document.getElementById('register-referral').value.trim();
        if (pass !== confirm) return UI.notify('Passwords do not match', 'error');
        UI.setLoading(true);
        const res = await Auth.register(email, pass, referral || null);
        if (res.success) {
            // persist the exact referral code client-side as a backup if one was provided
            if (referral) {
                try { localStorage.setItem('CUP9GPU_INVITE_CODE', referral); } catch (e) { /* ignore */ }
            }
            UI.notify('Account created! Sign in to continue.');
            document.getElementById('show-login').click();
        } else {
            UI.notify(res.error, 'error');
        }
        UI.setLoading(false);
    };

    

    // Global Logout
    document.querySelectorAll('.logout-btn').forEach(btn => {
        btn.onclick = () => {
            Auth.logout();
            UI.showView('auth-section');
            UI.notify('Signed out safely');
        };
    });

    // Wallet Actions wired to external showTransactionModal (injected)
    const depositBtn = document.getElementById('deposit-btn');
    if (depositBtn) depositBtn.onclick = () => externalShowTx ? externalShowTx('deposit') : showTransactionModal('deposit');
    const withdrawBtn = document.getElementById('withdraw-btn');
    if (withdrawBtn) withdrawBtn.onclick = () => externalShowTx ? externalShowTx('withdraw') : showTransactionModal('withdraw');

    // Daily Check-in: users can claim once per day for 0.02 USDT
    const checkinBtn = document.getElementById('checkin-btn');
    if (checkinBtn) {
        checkinBtn.onclick = async () => {
            UI.setLoading(true);
            const res = await API.checkIn(Auth.getToken());
            UI.setLoading(false);
            if (res && res.success) {
                UI.notify(`Check-in completato: +${(res.data.credited||0).toFixed(2)} USDT`, 'success');
                if (typeof refreshData === 'function') refreshData();
            } else {
                UI.notify(res.error || 'Check-in non disponibile', 'error');
            }
        };
    }

    // Admin: Broadcast notification composer submission
    const sendNotifyBtn = document.getElementById('admin-send-notify');
    if (sendNotifyBtn) {
        sendNotifyBtn.onclick = async () => {
            const txt = document.getElementById('admin-notify-text')?.value || '';
            if (!txt.trim()) return UI.notify('Enter a message to send', 'error');
            UI.setLoading(true);
            const res = await API.createNotification(Auth.getToken(), txt.trim(), 'all');
            UI.setLoading(false);
            if (res && res.success) {
                UI.notify('Notification broadcasted', 'success');
                // optionally clear input
                document.getElementById('admin-notify-text').value = '';
                if (typeof refreshData === 'function') refreshData();
            } else {
                UI.notify(res.error || 'Failed to send notification', 'error');
            }
        };
    }

    // Delegate heavier dynamic behaviors and global click handling to events_delegates.js
    setupDelegates({ Auth, UI, API, refreshData, showChangePasswordModal, showBlindWalletModal });
}