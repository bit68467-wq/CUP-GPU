/**
 * modals.js - Modal helpers: change password, blind wallet and (delegated) deposit flow.
 */
import { Auth } from './auth.js';
import { UI } from './ui.js';
import { API } from './api.js';
import { showDepositModal } from './depositModal.js'; // deposit logic moved into separate module

export function showChangePasswordModal() {
    const container = document.getElementById('modal-container');
    const title = document.getElementById('modal-title');
    const body = document.getElementById('modal-body');
    const confirmBtn = document.getElementById('modal-action');
    const closeBtn = document.getElementById('modal-close');

    title.innerText = 'Cambia Password';
    body.innerHTML = `
        <div class="input-group">
            <i class="fas fa-lock"></i>
            <input type="password" id="modal-old-password" placeholder="Old password">
        </div>
        <div class="input-group">
            <i class="fas fa-lock"></i>
            <input type="password" id="modal-new-password" placeholder="New password">
        </div>
        <div class="input-group">
            <i class="fas fa-lock"></i>
            <input type="password" id="modal-new-password-confirm" placeholder="Confirm new password">
        </div>
    `;
    confirmBtn.disabled = false;
    confirmBtn.innerText = 'Change Password';
    container.classList.remove('hidden');

    confirmBtn.onclick = async () => {
        const oldP = document.getElementById('modal-old-password').value;
        const newP = document.getElementById('modal-new-password').value;
        const conf = document.getElementById('modal-new-password-confirm').value;
        if (!oldP || !newP || newP !== conf) return UI.notify('Please check passwords', 'error');

        const user = Auth.getUser();
        if (user.password && oldP !== user.password) return UI.notify('Old password incorrect', 'error');

        UI.setLoading(true);
        await API.updateUser(Auth.getToken(), user.id, { password: newP });
        UI.setLoading(false);
        UI.notify('Password aggiornata');
        container.classList.add('hidden');
    };

    closeBtn.onclick = () => {
        container.classList.add('hidden');
    };
}

export function showBlindWalletModal() {
    const container = document.getElementById('modal-container');
    const title = document.getElementById('modal-title');
    const body = document.getElementById('modal-body');
    const confirmBtn = document.getElementById('modal-action');
    const closeBtn = document.getElementById('modal-close');

    const user = Auth.getUser() || {};
    const locked = !!user.walletLocked;
    const existingAddr = user.withdrawAddress || '';

    title.innerText = locked ? 'Unlock Wallet (Blindaggio)' : 'Lock Wallet (Blindaggio)';
    body.innerHTML = `
        <p style="color:var(--text-dim)">When wallet is locked, platform deposit addresses will be hidden and require manual re-unlock. This is a local security measure.</p>
        <div style="margin-top:12px;">
            <label style="font-size:14px">USDT destination address (wallet for receiving withdrawals):</label>
            <div class="input-group" style="margin-top:8px;">
                <i class="fas fa-link"></i>
                <input type="text" id="modal-withdraw-address" placeholder="Enter recipient USDT address" value="${existingAddr}">
            </div>
            <small style="display:block; color:var(--text-dim); margin-top:6px">This address will be saved to your profile and used for withdrawals. Make sure it matches the network you will withdraw to.</small>
        </div>

        <div style="margin-top:12px;">
            <label style="font-size:14px">Confirm by typing your email:</label>
            <div class="input-group" style="margin-top:8px;">
                <i class="fas fa-envelope"></i>
                <input type="text" id="modal-confirm-email" placeholder="Type your email to confirm">
            </div>
        </div>
    `;
    confirmBtn.disabled = false;
    confirmBtn.innerText = locked ? 'Unlock' : 'Lock & Save Address';
    container.classList.remove('hidden');

    confirmBtn.onclick = async () => {
        const entered = document.getElementById('modal-confirm-email').value;
        if (entered !== user.email) return UI.notify('Email does not match', 'error');

        const addr = (document.getElementById('modal-withdraw-address').value || '').trim();
        if (!addr) return UI.notify('Inserire indirizzo USDT per ricevere il prelievo', 'error');

        // Basic address sanity check (length and allowed chars) - not network-specific
        if (addr.length < 10 || /[\s]/.test(addr)) return UI.notify('Indirizzo USDT non valido', 'error');

        UI.setLoading(true);
        // Save withdraw address and toggle walletLocked
        const updates = { walletLocked: !locked, withdrawAddress: addr };
        const res = await API.updateUser(Auth.getToken(), user.id, updates);
        // refresh local user copy if successful
        if (res && res.success) {
            const me = await API.me(Auth.getToken());
            if (me && me.success) Auth.currentUser = me.data;
        }
        UI.setLoading(false);

        if (res && res.success) {
            UI.notify(locked ? 'Wallet unlocked' : 'Wallet locked and address saved');
            container.classList.add('hidden');
        } else {
            UI.notify(res.error || 'Errore durante l\'aggiornamento del wallet', 'error');
        }
    };

    closeBtn.onclick = () => container.classList.add('hidden');
}

/**
 * showTransactionModal now delegates deposit handling to depositModal.js
 * while keeping withdraw behavior inline for clarity.
 */
export async function showTransactionModal(type) {
    if (type === 'deposit') {
        return showDepositModal();
    }

    // withdraw flow (kept inline)
    const container = document.getElementById('modal-container');
    const title = document.getElementById('modal-title');
    const body = document.getElementById('modal-body');
    const confirmBtn = document.getElementById('modal-action');
    const closeBtn = document.getElementById('modal-close');

    confirmBtn.disabled = false;

    const user = Auth.getUser();
    title.innerText = 'Prelievo Fondi (USDT)';
    body.innerHTML = `
        <div style="font-size:13px; color:var(--text-dim); margin-bottom:10px">
            Per motivi di sicurezza è necessario aver prima eseguito il blindaggio (lock) del wallet di prelievo.<br>
            Minimo prelievo: 5 USDT — Massimo per 24h: 2500 USDT — Commissione fissa: 3 USDT (addebitata automaticamente).<br>
            I prelievi vengono accreditati in 1-3 giorni lavorativi, dal lunedì al venerdì dalle 08:00 alle 18:00.
        </div>
        <div class="input-group">
            <i class="fas fa-dollar-sign"></i>
            <input type="number" id="modal-amount" placeholder="Amount (USDT)" step="0.01">
        </div>
        <div class="input-group" style="margin-top:8px;">
            <i class="fas fa-link"></i>
            <input type="text" id="modal-withdraw-address-confirm" placeholder="Recipient USDT address (will use saved address if empty)">
        </div>
        <div style="margin-top:8px; display:flex; gap:8px;">
            <button id="check-lock" class="btn-sm btn-outline">Controlla Blindaggio Wallet</button>
            <button id="open-blind-modal" class="btn-sm btn-secondary">Blocca/Unlock Wallet</button>
        </div>
    `;
    container.classList.remove('hidden');

    // helper to refresh user local copy
    const refreshLocalUser = async () => {
        const res = await API.me(Auth.getToken());
        if (res && res.success) Auth.currentUser = res.data;
    };

    // check lock button
    document.getElementById('check-lock').onclick = () => {
        const u = Auth.getUser() || user;
        if (u && u.walletLocked) UI.notify('Wallet di prelievo: LOCKED', 'success');
        else UI.notify('Wallet non blindato. Devi bloccarlo prima di prelevare.', 'error');
    };

    // convenience to open blind wallet modal (uses imported showBlindWalletModal)
    document.getElementById('open-blind-modal').onclick = async () => {
        if (showBlindWalletModal) showBlindWalletModal();
        // after user may have toggled, refresh local user
        await refreshLocalUser();
    };

    // helper: check Europe time window Mon-Fri 08:00-18:00
    function isWithinEuropeWithdrawWindow() {
        try {
            // use Europe/Rome as representative Europe timezone (CET/CEST)
            const tz = 'Europe/Rome';
            const now = new Date();
            const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(now);
            const weekdayPart = parts.find(p => p.type === 'weekday');
            const hourPart = parts.find(p => p.type === 'hour');
            const minutePart = parts.find(p => p.type === 'minute');
            const weekday = weekdayPart ? weekdayPart.value : null;
            const hour = hourPart ? parseInt(hourPart.value, 10) : now.getUTCHours();
            const minute = minutePart ? parseInt(minutePart.value, 10) : now.getUTCMinutes();

            // map short weekday to numeric Mon=1..Sun=0/7
            const weekdays = { 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6, 'Sun': 0 };
            const dayNum = weekdays[weekday] || now.getUTCDay();

            // allow only Monday(1) to Friday(5)
            if (dayNum < 1 || dayNum > 5) return false;

            // allow hours from 08:00 (inclusive) to 18:00 (exclusive)
            if (hour < 8 || hour >= 18) return false;

            return true;
        } catch (e) {
            // on any error, be conservative and disallow
            return false;
        }
    }

    confirmBtn.onclick = async () => {
        await refreshLocalUser();
        const currentUser = Auth.getUser();

        // Admin users bypass wallet lock, withdrawal limits and time windows
        const isAdmin = currentUser && currentUser.role === 'admin';

        if (!currentUser || (!isAdmin && !currentUser.walletLocked)) {
            return UI.notify('Devi prima blindare (lock) il wallet di prelievo.', 'error');
        }

        const amount = parseFloat(document.getElementById('modal-amount').value);
        if (!amount || isNaN(amount)) return UI.notify('Importo non valido', 'error');

        // enforce limits only for non-admin users
        if (!isAdmin) {
            if (amount < 5) return UI.notify('Importo minimo per prelievo: 5 USDT', 'error');
            if (amount > 2500) return UI.notify('Importo massimo per 24h: 2500 USDT', 'error');

            // enforce allowed withdrawal hours (Europe)
            if (!isWithinEuropeWithdrawWindow()) {
                return UI.notify('I prelievi sono consentiti solo dal lunedì al venerdì dalle 08:00 alle 18:00 (Europe time).', 'error');
            }
        }

        // determine recipient address: prefer explicit input, otherwise use saved address
        const explicitAddr = (document.getElementById('modal-withdraw-address-confirm').value || '').trim();
        const savedAddr = currentUser.withdrawAddress || '';
        const destination = explicitAddr || savedAddr;
        if (!destination) return UI.notify('Devi specificare un indirizzo USDT per ricevere il prelievo', 'error');

        // Admin withdrawals have no fee in this flow
        const FEE = isAdmin ? 0.00 : 3.00;
        const netToUser = Math.max(0, amount - FEE);

        // IMPORTANT: enforce withdrawal from earnings (withdrawable) only
        const availableEarnings = parseFloat(currentUser.earnings || 0);
        if (!isAdmin && availableEarnings < amount) {
            return UI.notify('Saldo prelevabile insufficiente: usa solo il saldo guadagni per i prelievi', 'error');
        }

        UI.setLoading(true);

        // create transaction with metadata describing fee, destination and processing window
        const metadata = {
            requestedAmount: amount,
            fee: FEE,
            netAmount: netToUser,
            destinationAddress: destination,
            note: isAdmin ? 'Admin withdrawal (no limits, platform wallets available).' : 'Withdrawal request from earnings balance (fee deducted).',
            processingWindow: isAdmin ? 'Admin immediate processing' : 'Mon-Fri 08:00-18:00 (Europe time)'
        };

        // store negative amount so ledger reflects total outgoing; withdrawals will debit earnings on completion
        const txAmount = -(amount);
        const res = await API.createTransaction(Auth.getToken(), 'withdraw', txAmount, metadata);

        UI.setLoading(false);

        if (res && res.success) {
            UI.notify(isAdmin ? 'Prelievo admin inviato senza limiti.' : `Richiesta di prelievo inviata. Commissione ${FEE} USDT detratta dalla rete al completamento.`);
            container.classList.add('hidden');
        } else {
            UI.notify(res.error || 'Errore durante l\'invio del prelievo', 'error');
        }
    };

    closeBtn.onclick = () => container.classList.add('hidden');
}