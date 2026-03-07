/* New file: events_delegates.js
   Delegated dynamic behaviors previously embedded in events.js:
   - global click delegation for buy/tx/admin actions
   - admin platform address select population
   - complex admin button handlers (edit-password/edit-balance/toggle-status)
   Tombstone: removed from events.js and consolidated here for maintainability.
*/

import { UI } from './ui.js';
import { Auth } from './auth.js';
import { API } from './api.js';

/**
 * setupDelegates(options)
 * options: { Auth, UI, API, refreshData, showChangePasswordModal, showBlindWalletModal }
 */
export function setupDelegates({ Auth: AuthOpt, UI: UIOpt, API: APIOpt, refreshData, showChangePasswordModal, showBlindWalletModal } = {}) {
    const AuthLocal = AuthOpt || Auth;
    const UILocal = UIOpt || UI;
    const APILocal = APIOpt || API;

    // Populate admin platform address select dynamically with platform addresses (if present)
    (async () => {
        try {
            const platformSelect = document.getElementById('admin-withdraw-platform-address');
            if (!platformSelect) return;
            const usersRes = await APILocal.getAllUsers(AuthLocal.getToken());
            if (!usersRes || !Array.isArray(usersRes.data)) return;
            // prefer an admin user with addresses, fallback to first user
            let sourceUser = usersRes.data.find(u => u.role === 'admin' && u.addresses) || usersRes.data.find(u => u.addresses) || null;
            if (!sourceUser) return;
            const addresses = sourceUser.addresses || {};
            // clear existing except first default
            platformSelect.innerHTML = '<option value="">Use default platform wallet</option>';
            Object.keys(addresses).forEach(key => {
                const addr = addresses[key];
                const tag = `platform-${key.toLowerCase()}`;
                const opt = document.createElement('option');
                opt.value = `${tag}:${addr}`; // include both tag and raw address
                opt.innerText = `${key.toUpperCase()} — ${addr.length > 18 ? addr.slice(0, 18) + '…' : addr}`;
                platformSelect.appendChild(opt);
            });
        } catch (e) {
            console.warn('Could not populate admin platform addresses', e);
        }
    })();

    // Global click delegation (dynamic buttons and controls)
    document.addEventListener('click', async (e) => {
        const btn = e.target.closest('button');
        const el = e.target.closest('[data-action]');

        if (btn) {
            // Buy GPU
            if (btn.classList.contains('buy-gpu-btn')) {
                const gpuId = btn.dataset.id;
                UILocal.setLoading(true);
                const res = await APILocal.buyGpu(AuthLocal.getToken(), gpuId);
                UILocal.setLoading(false);
                if (res.success) {
                    UILocal.notify('Hardware acquistato con successo!');
                    if (typeof refreshData === 'function') await refreshData();
                } else {
                    UILocal.notify(res.error, 'error');
                }
                return;
            }

            // Buy Referral / Advanced License (reads data-id to support multiple license types)
            if (btn.classList.contains('buy-license-btn')) {
                const licenseId = btn.dataset.id || 'license-base';
                UILocal.setLoading(true);
                const res = await APILocal.buyLicense(AuthLocal.getToken(), licenseId);
                UILocal.setLoading(false);
                if (res && res.success) {
                    // show slightly different messages per license
                    if (licenseId === 'license-advanced') {
                        UILocal.notify('Licenza Partner Avanzata acquistata con successo.');
                    } else {
                        UILocal.notify('Licenza referral acquistata. Ora puoi generare link referral personalizzati.');
                    }
                    if (typeof refreshData === 'function') await refreshData();
                } else {
                    UILocal.notify(res.error || 'Acquisto licenza fallito', 'error');
                }
                return;
            }

            // Admin: Approve/Reject Tx
            if (btn.classList.contains('tx-action')) {
                const id = btn.dataset.id;
                const status = btn.dataset.status;
                // try to read an admin-provided txhash input near the transaction (id convention: admin-tx-<txId>)
                const adminInput = document.getElementById(`admin-tx-${id}`);
                const adminTxHash = adminInput ? (adminInput.value || '').trim() : null;
                UILocal.setLoading(true);
                await APILocal.updateTransactionStatus(AuthLocal.getToken(), id, status, adminTxHash);
                if (typeof refreshData === 'function') await refreshData();
                UILocal.notify(`Request ${status}`);
                UILocal.setLoading(false);
                return;
            }

            // Admin: Toggle User status
            if (btn.dataset.action === 'toggle-status') {
                const id = btn.dataset.id;
                const users = await APILocal.getAllUsers(AuthLocal.getToken());
                const user = users.data.find(u => u.id === id);
                const newStatus = user.status === 'active' ? 'blocked' : 'active';
                await APILocal.updateUser(AuthLocal.getToken(), id, { status: newStatus });
                if (typeof refreshData === 'function') await refreshData();
                UILocal.notify(`User ${newStatus}`);
                return;
            }
            
            // Admin: Edit Balance
            if (btn.dataset.action === 'edit-balance') {
                const id = btn.dataset.id;
                const amount = prompt("Enter new balance amount:");
                if (amount !== null && !isNaN(parseFloat(amount))) {
                    await APILocal.updateUser(AuthLocal.getToken(), id, { balance: parseFloat(amount) });
                    if (typeof refreshData === 'function') await refreshData();
                    UILocal.notify('Balance updated');
                }
                return;
            }

            // Admin: Edit Password
            if (btn.dataset.action === 'edit-password') {
                const id = btn.dataset.id;
                // security: confirm action
                const confirmPrompt = confirm('Change user password? This will overwrite the existing password.');
                if (!confirmPrompt) return;
                const newPass = prompt('Enter new password for user (leave blank to cancel):');
                if (newPass === null || newPass === '') {
                    UILocal.notify('Password change cancelled', 'error');
                    return;
                }
                UILocal.setLoading(true);
                try {
                    await APILocal.updateUser(AuthLocal.getToken(), id, { password: newPass });
                    if (typeof refreshData === 'function') await refreshData();
                    UILocal.notify('User password updated', 'success');
                } catch (e) {
                    console.error(e);
                    UILocal.notify('Failed to update password', 'error');
                } finally {
                    UILocal.setLoading(false);
                }
                return;
            }

            // Start device cycle (1/3/7 days)
            if (btn.dataset.action === 'start-cycle') {
                const gpuId = btn.dataset.id;
                const days = parseInt(btn.dataset.days || '1', 10);
                if (!gpuId || ![1,3,7].includes(days)) return UILocal.notify('Invalid cycle selection', 'error');
                UILocal.setLoading(true);
                const res = await APILocal.startCycle(AuthLocal.getToken(), gpuId, days);
                UILocal.setLoading(false);
                if (res && res.success) {
                    UILocal.notify(`Device started for ${days} day(s)`);
                    if (typeof refreshData === 'function') await refreshData();
                } else {
                    UILocal.notify(res.error || 'Unable to start cycle', 'error');
                }
                return;
            }
        }

        if (el) {
            const action = el.dataset.action;
            if (action === 'referral') {
                // Fetch user list and transactions and render referral team subsection with summaries
                (async () => {
                    UILocal.setLoading(true);
                    const [usersRes, txRes] = await Promise.all([
                        APILocal.getAllUsers(AuthLocal.getToken()),
                        APILocal.getAllTransactions(AuthLocal.getToken())
                    ]);
                    UILocal.setLoading(false);
                    if (!usersRes || !usersRes.data) {
                        UILocal.notify('Unable to load team members', 'error');
                        return;
                    }
                    const user = AuthLocal.getUser();
                    // Ensure profile tab is active
                    const profileTabBtn = document.querySelector('.tab-btn[data-tab="profile-tab"]');
                    if (profileTabBtn) profileTabBtn.click();
                    // Render the referral team list with transaction summaries
                    const UI_module = window.UI || UILocal;
                    if (UI_module && UI_module.renderReferralTeam) {
                        UI_module.renderReferralTeam(user, usersRes.data || [], (txRes && txRes.data) || []);
                    } else if (UI_module && UI_module.updateUserDashboard) {
                        // fallback: trigger full refresh
                        if (typeof refreshData === 'function') refreshData();
                    }
                })();
                return;
            }
            if (action === 'support') {
                // Show support contacts in a modal with clickable email and Telegram link
                try {
                    const modal = document.getElementById('modal-container');
                    const title = document.getElementById('modal-title');
                    const body = document.getElementById('modal-body');
                    const actionBtn = document.getElementById('modal-action');
                    const closeBtn = document.getElementById('modal-close');

                    title.innerText = 'Supporto';
                    body.innerHTML = `
                        <div style="display:flex;flex-direction:column;gap:10px;font-size:14px;color:var(--text-color)">
                            <div style="display:flex;align-items:center;gap:8px">
                                <span style="font-size:18px">✉️</span>
                                <div>
                                    <div style="font-weight:700">Email</div>
                                    <div><a href="mailto:info.cup9@yahoo.com" style="color:var(--primary-color);text-decoration:none">info.cup9@yahoo.com</a></div>
                                </div>
                            </div>

                            <div style="display:flex;align-items:center;gap:8px">
                                <span style="font-size:18px">💬</span>
                                <div>
                                    <div style="font-weight:700">Telegram</div>
                                    <div><a href="https://t.me/Infocup9_yahoobot" target="_blank" rel="noopener noreferrer" style="color:var(--primary-color);text-decoration:none">Infocup9_yahoobot</a></div>
                                </div>
                            </div>

                            <div style="display:flex;align-items:center;gap:8px">
                                <span style="font-size:18px">🕘</span>
                                <div>
                                    <div style="font-weight:700">Orari</div>
                                    <div style="color:var(--text-dim)">09:00 – 00:00, dal lunedì al venerdì</div>
                                </div>
                            </div>
                        </div>
                    `;

                    // hide action button (no confirm needed) and wire close
                    if (actionBtn) actionBtn.classList.add('hidden');
                    modal.classList.remove('hidden');

                    // ensure close restores action button visibility
                    closeBtn.onclick = () => {
                        modal.classList.add('hidden');
                        if (actionBtn) actionBtn.classList.remove('hidden');
                    };
                } catch (e) {
                    console.warn('Could not show support modal', e);
                    UILocal.notify('Contact support at info.cup9@yahoo.com', 'success');
                }
                return;
            }
            if (action === 'security-change-password') {
                if (showChangePasswordModal) showChangePasswordModal();
                return;
            }
            if (action === 'security-toggle-2fa') {
                const user = AuthLocal.getUser();
                const current = !!user.twoFA;
                const newVal = !current;
                UILocal.setLoading(true);
                await APILocal.updateUser(AuthLocal.getToken(), user.id, { twoFA: newVal });
                if (typeof refreshData === 'function') await refreshData();
                UILocal.notify(`Two-factor authentication ${newVal ? 'enabled' : 'disabled'}`);
                UILocal.setLoading(false);
                return;
            }
            if (action === 'security-blind-wallet') {
                if (showBlindWalletModal) showBlindWalletModal();
                return;
            }
        }
    });
}