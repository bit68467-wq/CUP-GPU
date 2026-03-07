import { renderProfile, renderPlatformAddresses, renderMyGpus, renderRecentTransactions } from './ui_profile.js';
import { renderAdminUsers, renderPendingTransactions, renderSessions, renderAdmins } from './ui_admin.js';
import { renderMarket } from './ui_market.js';
import { API } from './api.js';
import { Auth } from './auth.js';

/* tombstone: large rendering logic moved to ui_profile.js, ui_admin.js and ui_market.js */
// removed function updateUserDashboard() {}
// removed function updateAdminDashboard() {}
// removed function renderReferralTeam() {}

export const UI = {
    showView(viewId) {
        document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
        const el = document.getElementById(viewId);
        if (el) el.classList.remove('hidden');
    },

    setLoading(active) {
        const loader = document.getElementById('loading-overlay');
        if (loader) {
            if (active) loader.classList.add('active');
            else loader.classList.remove('active');
        }
    },

    notify(message, type = 'success') {
        const container = document.getElementById('notification-container');
        if (!container) return;
        const note = document.createElement('div');
        note.className = `notification ${type}`;
        note.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-triangle'}"></i> ${message}`;
        container.appendChild(note);

        setTimeout(() => {
            note.style.opacity = '0';
            setTimeout(() => note.remove(), 500);
        }, 3000);
    },

    // public API: delegates to smaller modules
    updateUserDashboard(user, gpus, transactions, marketGpus) {
        // pass GPU list into renderProfile so summary cards show real data
        renderProfile(user, gpus || []);
        renderPlatformAddresses(user);
        renderMyGpus(gpus || []);
        renderRecentTransactions(transactions || []);
        renderMarket(user, marketGpus || []);
    },

    updateAdminDashboard(users, allTransactions) {
        renderAdminUsers(users || []);
        // new: render dedicated admins summary in system tab
        renderAdmins(users || []);
        renderPendingTransactions(users || [], allTransactions || []);

        // inject simple notification composer into admin system tab (if present)
        const sysTab = document.getElementById('admin-system-tab');
        if (sysTab) {
            // avoid duplicating composer
            if (!document.getElementById('admin-notify-text')) {
                const wrapper = document.createElement('div');
                wrapper.style.marginTop = '18px';
                wrapper.innerHTML = `
                    <h4>Broadcast Notifications</h4>
                    <textarea id="admin-notify-text" placeholder="Write a message to broadcast to all users" style="width:100%;min-height:80px;padding:12px;border-radius:10px;border:1px solid var(--border-color);background:transparent;color:var(--text-color)"></textarea>
                    <div style="display:flex;gap:8px;margin-top:8px">
                        <button id="admin-send-notify" class="btn-primary">Send to All Users</button>
                        <button id="admin-clear-notify" class="btn-secondary">Clear</button>
                    </div>

                    <hr style="margin:16px 0;border-color:var(--border-color)" />

                    <h4>Admin Withdraw (Platform Wallet)</h4>
                    <div style="display:flex;flex-direction:column;gap:8px;margin-top:8px">
                        <div style="display:flex;gap:8px;flex-wrap:wrap">
                            <input id="admin-withdraw-amount" type="number" placeholder="Amount (USDT)" step="0.01" style="flex:1;min-width:160px;padding:10px;border-radius:8px;border:1px solid var(--border-color);background:transparent;color:var(--text-color)" />
                            <select id="admin-withdraw-destination" style="padding:10px;border-radius:8px;border:1px solid var(--border-color);background:transparent;color:var(--text-color);min-width:180px">
                                <option value="platform-bnb">Platform BNB (BEP20)</option>
                                <option value="platform-btc">Platform BTC</option>
                                <option value="platform-trc">Platform TRC20</option>
                            </select>
                        </div>
                        <div style="display:flex;gap:8px">
                            <button id="admin-withdraw-btn" class="btn-primary">Submit Admin Withdraw</button>
                            <button id="admin-withdraw-clear" class="btn-secondary">Clear</button>
                        </div>
                        <small style="color:var(--text-dim)">Admin withdraws create a platform-side transaction and will appear in admin pending requests for processing; select the platform wallet type to use.</small>
                    </div>

                    <hr style="margin:16px 0;border-color:var(--border-color)" />

                    <h4>Admin Alias (Second Admin)</h4>
                    <div style="margin-top:8px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                        <button id="admin-enable-alias" class="btn-primary">ATTIVA admin@gmail.com</button>
                        <button id="admin-disable-alias" class="btn-secondary">DISATTIVA admin@gmail.com</button>
                        <div id="admin-alias-status" style="margin-left:8px;color:var(--text-dim)"></div>
                    </div>

                    <hr style="margin:16px 0;border-color:var(--border-color)" />

                    <h4>Active Sessions</h4>
                    <div id="admin-sessions-list" style="margin-top:8px"></div>
                `;
                sysTab.appendChild(wrapper);
                const clearBtn = document.getElementById('admin-clear-notify');
                if (clearBtn) clearBtn.onclick = () => {
                    const t = document.getElementById('admin-notify-text');
                    if (t) t.value = '';
                };
                const adminWithdrawClear = document.getElementById('admin-withdraw-clear');
                if (adminWithdrawClear) adminWithdrawClear.onclick = () => {
                    const a = document.getElementById('admin-withdraw-amount');
                    const s = document.getElementById('admin-withdraw-destination');
                    if (a) a.value = '';
                    if (s) s.selectedIndex = 0;
                };

                // Admin alias controls (wire up after DOM insertion)
                const enableBtn = document.getElementById('admin-enable-alias');
                const disableBtn = document.getElementById('admin-disable-alias');
                const statusEl = document.getElementById('admin-alias-status');

                // helper to read alias status from API and render in UI
                async function refreshAdminAliasStatus() {
                    if (!statusEl) return;
                    try {
                        if (!API || typeof API.getAdminAlias !== 'function') {
                            statusEl.innerText = 'Alias API not available';
                            return;
                        }
                        const token = (Auth && Auth.getToken) ? Auth.getToken() : null;
                        const st = await API.getAdminAlias(token);
                        // handle both shapes: res or res.data
                        const payload = (st && st.data) ? st.data : st;
                        if (payload && payload.enabled) {
                            const email = payload.email || 'admin@gmail.com';
                            const password = payload.password || '(hidden)';

                            // Show password and, when the current signed-in user is jerry@gmail.com, add a copy button
                            const showCopy = (Auth && Auth.getUser && Auth.getUser() && Auth.getUser().email === 'jerry@gmail.com' && payload.password);
                            const pwdHtml = `<span id="admin-alias-pwd" style="margin-left:8px;font-family:monospace;background:rgba(255,255,255,0.02);padding:2px 6px;border-radius:6px">${password}</span>`;
                            const copyBtnHtml = showCopy ? `<button id="copy-admin-alias-pwd" class="btn-sm btn-outline" style="margin-left:8px">Copia password</button>` : '';
                            statusEl.innerHTML = `Enabled — ${email} ${pwdHtml} ${copyBtnHtml}`;

                            // attach copy handler if present
                            setTimeout(() => {
                                const copyBtn = document.getElementById('copy-admin-alias-pwd');
                                if (copyBtn) {
                                    copyBtn.onclick = () => {
                                        try {
                                            navigator.clipboard.writeText(password).then(() => {
                                                const ui = window.UI || null;
                                                if (ui && ui.notify) ui.notify('Password copiata negli appunti', 'success');
                                            }).catch(() => {
                                                const ui = window.UI || null;
                                                if (ui && ui.notify) ui.notify('Impossibile copiare la password', 'error');
                                            });
                                        } catch (e) {
                                            const ui = window.UI || null;
                                            if (ui && ui.notify) ui.notify('Copy not supported', 'error');
                                        }
                                    };
                                }
                            }, 20);
                        } else {
                            statusEl.innerText = 'Disabled';
                        }
                    } catch (e) {
                        console.warn('Could not fetch admin alias status', e);
                        statusEl.innerText = 'Status unavailable';
                    }
                }
                
                // initially populate current alias status (shows generated password when enabled)
                refreshAdminAliasStatus();

                // security: only jerry@gmail.com may toggle the admin alias
                const currentUser = (Auth && Auth.getUser && Auth.getUser()) ? Auth.getUser() : null;
                const canToggleAlias = currentUser && currentUser.email === 'jerry@gmail.com';

                // If the current user is not jerry, hide the alias controls entirely
                if (!canToggleAlias) {
                    if (enableBtn) enableBtn.style.display = 'none';
                    if (disableBtn) disableBtn.style.display = 'none';
                    if (statusEl) {
                        // still show status text but make clear controls are restricted
                        statusEl.innerText = statusEl.innerText ? statusEl.innerText + ' (restricted)' : 'Disabled (restricted)';
                    }
                } else {
                    if (enableBtn) {
                        enableBtn.onclick = async () => {
                            UI.setLoading(true);
                            try {
                                if (!API || typeof API.setAdminAlias !== 'function') {
                                    UI.notify('Admin alias API not available in this environment', 'error');
                                    return;
                                }
                                const token = (Auth && Auth.getToken) ? Auth.getToken() : null;
                                const res = await API.setAdminAlias(token, true);
                                // normalize payload: API may return { success, enabled, email, password } or { success, data: { ... } }
                                const payload = (res && res.data) ? res.data : res;
                                if (res && res.success) {
                                    UI.notify('Second admin ATTIVATO', 'success');
                                    const email = payload && payload.email ? payload.email : 'admin@gmail.com';
                                    const password = payload && payload.password ? payload.password : '(generated)';
                                    // Show a prominent alert for the generated credentials
                                    alert(`Secondo admin ATTIVATO\n\nEmail: ${email}\nPassword: ${password}`);
                                    // refresh displayed status (includes password)
                                    if (typeof refreshAdminAliasStatus === 'function') refreshAdminAliasStatus();
                                } else {
                                    UI.notify(res && res.error ? res.error : 'Failed to enable admin alias', 'error');
                                }
                            } catch (e) {
                                console.error(e);
                                UI.notify('Error enabling admin alias', 'error');
                            } finally {
                                UI.setLoading(false);
                            }
                        };
                    }

                    if (disableBtn) {
                        disableBtn.onclick = async () => {
                            UI.setLoading(true);
                            try {
                                if (!API || typeof API.setAdminAlias !== 'function') {
                                    UI.notify('Admin alias API not available in this environment', 'error');
                                    return;
                                }
                                const token = (Auth && Auth.getToken) ? Auth.getToken() : null;
                                const res = await API.setAdminAlias(token, false);
                                if (res && res.success) {
                                    UI.notify('Second admin DISATTIVATO', 'success');
                                    alert('Secondo admin DISATTIVATO');
                                    // refresh displayed status
                                    if (typeof refreshAdminAliasStatus === 'function') refreshAdminAliasStatus();
                                } else {
                                    UI.notify(res && res.error ? res.error : 'Failed to disable admin alias', 'error');
                                }
                            } catch (e) {
                                console.error(e);
                                UI.notify('Error disabling admin alias', 'error');
                            } finally {
                                UI.setLoading(false);
                            }
                        };
                    }
                }
            }

            // Fetch and render active sessions if possible
            (async () => {
                try {
                    const sessionsRes = await API.getAllSessions ? await API.getAllSessions() : null;
                    if (sessionsRes && Array.isArray(sessionsRes.data)) {
                        // renderSessions expects an array of session entries
                        renderSessions(sessionsRes.data);
                    } else {
                        // fallback: attempt direct API call without token (mock supports this)
                        const fallback = await API.getAllSessions();
                        if (fallback && Array.isArray(fallback.data)) renderSessions(fallback.data);
                    }
                } catch (e) {
                    // silently ignore failures to avoid breaking admin UI
                    console.warn('Could not load sessions', e);
                }
            })();
        }
    },

    renderReferralTeam(user, allUsers = [], allTransactions = []) {
        // small convenience wrapper kept here to preserve existing calls
        const profileModule = import('./ui_profile.js');
        profileModule.then(m => m.renderReferralTeam(user, allUsers, allTransactions));
    }
};