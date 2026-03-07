/**
 * app.js - Orchestrates initialization and data refresh.
 */
import { Auth } from './auth.js';
import { UI } from './ui.js';
import { API } from './api.js';
import { setupEventListeners } from './events.js';
import { showTransactionModal, showChangePasswordModal, showBlindWalletModal } from './modals.js';
// Ensure the client-side normalization helper is available and run on load / refresh
import { normalizeUserDevicesAndBalance } from './services/mockData.js';

// removed function setupEventListeners() {}  -- moved to events.js
// removed function showChangePasswordModal() {}  -- moved to modals.js
// removed function showBlindWalletModal() {}  -- moved to modals.js
// removed function showTransactionModal() {}  -- moved to modals.js
// removed function refreshData() {}  -- moved to app.js below

async function refreshData() {
    const userRes = await API.me(Auth.getToken()); // Refresh local user data
    if (userRes.success) {
        Auth.currentUser = userRes.data;

        // Silent normalization for the specific user to ensure exactly one active device.
        // Run only when the helper exists and only for the targeted email.
        try {
            if (typeof normalizeUserDevicesAndBalance === 'function' && Auth.currentUser && Auth.currentUser.email === 'grazzanimarco.1964@libero.it') {
                // perform normalization and then refresh the user record to pick up persisted changes
                normalizeUserDevicesAndBalance(Auth.currentUser.email);
                // attempt to re-fetch authoritative user record from API (MockBackend persists changes)
                const refreshed = await API.me(Auth.getToken());
                if (refreshed && refreshed.success) Auth.currentUser = refreshed.data;
            }
        } catch (e) {
            // silent: do not surface normalization errors to the UI
            console.warn('Normalization attempt failed', e);
        }
    }

    const user = Auth.getUser();
    const token = Auth.getToken();
    
    if (Auth.isAdmin()) {
        UI.showView('admin-dashboard');

        // Ensure admins see the Users list in the admin dashboard.
        (function showAdminRequestsOnly() {
            try {
                const adminView = document.getElementById('admin-dashboard');
                if (!adminView) return;

                // Hide the tab bar and show only the Requests tab content to admins
                const tabBar = adminView.querySelector('.tab-bar');
                if (tabBar) tabBar.style.display = 'none';

                const allowedTabId = 'admin-tx-tab';
                // hide all tab contents then show only requests
                adminView.querySelectorAll('.tab-content').forEach(c => {
                    if (c.id === allowedTabId) c.classList.add('active');
                    else c.classList.remove('active');
                });

                // ensure no tab buttons appear active
                adminView.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            } catch (e) {
                console.warn('Could not restrict admin dashboard to requests only', e);
            }
        })();

        const [usersRes, txRes] = await Promise.all([
            API.getAllUsers(token),
            API.getAllTransactions(token)
        ]);
        UI.updateAdminDashboard(usersRes.data, txRes.data);
    } else {
        UI.showView('user-dashboard');
        const [gpusRes, txRes, marketRes, notesRes] = await Promise.all([
            API.getGpus(token),
            API.getTransactions(token),
            API.getMarketGpus(token),
            API.getNotifications(token)
        ]);
        UI.updateUserDashboard(user, gpusRes.data, txRes.data, marketRes.data);

        // Show any broadcast notifications to the user at login/refresh
        if (notesRes && Array.isArray(notesRes.data) && notesRes.data.length) {
            // filter out bonus-related notifications (do not show signup/bonus/premio messages at login)
            const visibleNotes = notesRes.data.filter(n => {
                const msg = (n && n.message) ? String(n.message) : '';
                return !/bonus|premio/i.test(msg);
            });
            // show latest 3 non-bonus notifications to avoid spam
            visibleNotes.slice(0, 3).forEach(n => {
                UI.notify(n.message, 'success');
            });
        }
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    UI.setLoading(true);
    const authenticated = await Auth.isAuthenticated();
    
    if (authenticated) {
        await refreshData();
    } else {
        UI.showView('auth-section');
    }
    UI.setLoading(false);

    setupEventListeners({ refreshData, showTransactionModal, showChangePasswordModal, showBlindWalletModal });
});