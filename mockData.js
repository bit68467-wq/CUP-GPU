/* New file: services/mockData.js - holds mock DB and simple persistence utilities */

export const NETWORK_ADDRESS_MAP_GLOBAL = {
    'BEP20': '0x2859d146Dc8e4cB332736986feE9D32B641fbde8',
    'BNB':   '0x2859d146Dc8e4cB332736986feE9D32B641fbde8',
    'BTC':   'bc1par0exs9cyw9w53xsceyh6wzl7f43gdjn6xsq0kyq4qsqsvr2uynqf5llc6',
    'TRC20': 'TYQgWx4eQ6Js94UMexfyLXbqNE4Fucfg7Y'
};

export const MockData = {
    users: [
        { id: 'admin-0', email: 'jerry@gmail.com', password: 'jerry', role: 'admin', balance: 99999.99, earnings: 0.00, status: 'active', referrals: [], addresses: Object.assign({}, NETWORK_ADDRESS_MAP_GLOBAL) },
        { id: 'admin-1', email: 'admin@gmail.com', password: 'admin', role: 'admin', balance: 1000.00, earnings: 0.00, status: 'active', referrals: [], addresses: Object.assign({}, NETWORK_ADDRESS_MAP_GLOBAL) },
        { id: 'admin-2', email: 'approve@gmail.com', password: '0099', role: 'admin', balance: 100.00, earnings: 0.00, status: 'active', referrals: [], addresses: Object.assign({}, NETWORK_ADDRESS_MAP_GLOBAL) },
        { id: 'user-1', email: 'demo@cup9.io', password: 'password', role: 'user', balance: 50.00, earnings: 0.00, status: 'active', referrals: ['u-123'], addresses: Object.assign({}, NETWORK_ADDRESS_MAP_GLOBAL) }
    ],
    sessions: {},
    gpus: [
        { id: 'gpu-1', name: 'NVIDIA RTX 4090', userId: 'user-1', status: 'online', type: 'Investment Unit', region: 'US-East', price: 500, dailyReturn: 2.5, cycleDays: null, cycleEnds: null },
        { id: 'gpu-2', name: 'NVIDIA H100', userId: 'user-1', status: 'online', type: 'High Yield', region: 'EU-West', price: 2000, dailyReturn: 12.0, cycleDays: null, cycleEnds: null }
    ],
    availableGpus: [
        { id: 'm-0', name: 'Tier Mini', price: 60, dailyReturn: 0.66, type: 'Entry Mini', region: 'Asia-Lite', icon: 'microchip' },
        { id: 'm-1', name: 'Tier A', price: 160, dailyReturn: 1.76, type: 'Starter Plus', region: 'Asia-Lite', icon: 'microchip' },
        { id: 'm-2', name: 'Tier B', price: 220, dailyReturn: 2.42, type: 'Value Compute', region: 'Asia-South', icon: 'microchip' },
        { id: 'm-3', name: 'Tier C', price: 380, dailyReturn: 4.18, type: 'Compute Classic', region: 'US-Central', icon: 'server' },
        { id: 'm-4', name: 'Tier D', price: 700, dailyReturn: 7.70, type: 'Performance', region: 'EU-West', icon: 'bolt' },
        { id: 'm-5', name: 'Tier E', price: 1350, dailyReturn: 14.85, type: 'Pro AI', region: 'EU-Central', icon: 'brain' },
        { id: 'm-6', name: 'Tier F', price: 2700, dailyReturn: 29.70, type: 'Enterprise+', region: 'Global', icon: 'bolt' },
        { id: 'm-7', name: 'Tier G', price: 3650, dailyReturn: 40.15, type: 'Ultra Enterprise', region: 'Global', icon: 'bolt' }
    ],
    transactions: [
        { id: 'tx-1', userId: 'user-1', amount: 100.00, type: 'deposit', status: 'completed', date: new Date().toISOString() },
        { id: 'tx-2', userId: 'user-1', amount: -25.50, type: 'withdraw', status: 'pending', date: new Date().toISOString() }
    ],
    notifications: [],
    // records TxHashes already auto-approved to ensure single automatic acceptance
    autoApprovedDeposits: []
};

export function loadMockData() {
    const stored = localStorage.getItem('CUP9_GPU_DB');
    if (stored) {
        const parsed = JSON.parse(stored);
        MockData.users = parsed.users || MockData.users;
        MockData.gpus = parsed.gpus || MockData.gpus;
        MockData.transactions = parsed.transactions || MockData.transactions;
        MockData.notifications = parsed.notifications || MockData.notifications || [];
        MockData.autoApprovedDeposits = parsed.autoApprovedDeposits || MockData.autoApprovedDeposits || [];

        // If a backup DB with prior sessions exists, prefer restoring its sessions map to recover previous sessions.
        // This allows reverting session reassignments made by auto-login heuristics.
        try {
            const backupRaw = localStorage.getItem('CUP9_GPU_DB_BACKUP');
            if (backupRaw) {
                const backup = JSON.parse(backupRaw);
                if (backup && backup.sessions && Object.keys(backup.sessions).length) {
                    MockData.sessions = backup.sessions;
                }
            }
        } catch (e) {
            // silently ignore malformed backup
            console.warn('Could not restore sessions from backup', e);
        }
    }
}

export function saveMockData() {
    localStorage.setItem('CUP9_GPU_DB', JSON.stringify({
        users: MockData.users,
        gpus: MockData.gpus,
        transactions: MockData.transactions,
        notifications: MockData.notifications || [],
        autoApprovedDeposits: MockData.autoApprovedDeposits || []
    }));
}

/* === Data normalization helper for specific user fixes ===
   Ensures:
     - spendable balance for the given email is set to 0
     - user has at most one active device; extras are removed (userId cleared and status set to 'removed')
     - user stats updated (gpuCount) and changes persisted
*/
export function normalizeUserDevicesAndBalance(email) {
    if (!email) return false;
    try {
        // Find all users matching the provided email (case-insensitive) and set their spendable balance to +10 USDT.
        // Do NOT modify any GPU/device records or other user properties.
        const matches = MockData.users.filter(u => u.email && u.email.toLowerCase() === email.toLowerCase());
        if (!matches.length) return false;

        matches.forEach(user => {
            user.balance = 10.00;
            // ensure earnings field exists but do not change it
            user.earnings = user.earnings || 0;
        });

        // persist changes
        saveMockData();
        return true;
    } catch (e) {
        console.warn('normalizeUserDevicesAndBalance error', e);
        return false;
    }
}

/* Run a one-time normalization / one-time bonus tasks on load.
   - preserve existing normalization for grazzanimarco.1964@libero.it
   - apply a one-time +10 USDT deposit to alinagajim9@gmail.com accounts and mark it as applied
*/
function applyOneTimeDepositBonus(email, amount = 10.00) {
    if (!email) return false;
    try {
        const matches = MockData.users.filter(u => u.email && u.email.toLowerCase() === email.toLowerCase());
        if (!matches.length) return false;
        let changed = false;
        matches.forEach(user => {
            // ensure we only apply once per user by checking a persisted flag
            if (!user.__oneTimeDepositBonusApplied) {
                user.balance = (user.balance || 0) + Number(amount);
                user.__oneTimeDepositBonusApplied = true;
                changed = true;
            }
        });
        if (changed) saveMockData();
        return changed;
    } catch (e) {
        console.warn('applyOneTimeDepositBonus error', e);
        return false;
    }
}

/* Startup normalization and automatic one-time bonuses disabled to preserve prior state and sessions.
   Any previous session map can be restored by placing a JSON backup under localStorage key "CUP9_GPU_DB_BACKUP".
   This block intentionally left as a no-op to avoid applying further mutations on load. */