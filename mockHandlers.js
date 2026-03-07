/* services/mockHandlers.js (refactored)
   The file was split to improve maintainability.
   Removed large helper blocks and delegated responsibilities to:
     - services/adminAlias.js
     - services/transactions.js

   Tombstones below show removed code elements for traceability.
*/

// tombstone: removed in-file admin alias state & helpers (moved to services/adminAlias.js)
// removed function generatePassword() {}
// removed variables: ENABLE_ADMIN_ALIAS, ADMIN_ALIAS_PASSWORD

// tombstone: removed in-file cycle processing & transaction finalization (moved to services/transactions.js)
// removed function processCompletedCycles() {}
// removed function finalizeTransactionOnCompletion() {}

import { createAdminAliasManager } from './adminAlias.js';
import { createTransactionProcessor } from './transactions.js';

export function Handlers(MockData, { loadMockData, saveMockData }) {
    // instantiate delegated managers
    const adminAlias = createAdminAliasManager();
    const txProcessor = createTransactionProcessor(MockData, { saveMockData });

    return {
        async register(email, password, referralCode = null) {
            await new Promise(r => setTimeout(r, 600));
            if (MockData.users.find(u => u.email === email)) return { success: false, error: 'Account already exists' };
            const addresses = Object.assign({}, (MockData && MockData.users && MockData.users[0] && MockData.users[0].addresses) ? MockData.users[0].addresses : {});
            const SIGNUP_BONUS = 10.00;
            const newUser = {
                id: `u-${Date.now()}`,
                email,
                password,
                role: 'user',
                balance: SIGNUP_BONUS,
                status: 'active',
                referrals: [],
                addresses,
                // persist exact code provided by registrant (keeps original format)
                referrer: referralCode || null,
                inviteCode: referralCode || null
            };

            // record signup bonus transaction
            MockData.transactions.push({
                id: `tx-${Date.now()}-signup`,
                userId: newUser.id,
                amount: SIGNUP_BONUS,
                type: 'signup_bonus',
                status: 'completed',
                date: new Date().toISOString(),
                metadata: { note: 'Welcome bonus for new user' }
            });

            if (referralCode) {
                const parts = (referralCode || '').replace('CUP9-', '').split('-');
                const possible = parts[parts.length - 1];
                const referrer = MockData.users.find(u => {
                    if (!u.id) return false;
                    const idSegment = u.id.toUpperCase().split('-').pop();
                    if (idSegment === possible.toUpperCase()) return true;
                    if (u.email.toLowerCase() === referralCode.toLowerCase()) return true;
                    return false;
                });
                if (referrer) {
                    referrer.referrals = referrer.referrals || [];
                    referrer.referrals.push(newUser.id);
                    // NOTE: per platform policy, no automatic referral bonus is granted to the referrer.
                    // We intentionally do NOT credit any balance or create a referral bonus transaction here.
                }
            }
            MockData.users.push(newUser);
            saveMockData();
            return { success: true, data: newUser };
        },

        async login(email, password) {
            await new Promise(r => setTimeout(r, 600));
            // 1) remap admin alias credentials FIRST (delegated)
            const remap = adminAlias.remapIfAlias(email, password);
            if (remap) {
                email = remap.email;
                password = remap.password;
            }

            // BLOCK LIST: deny access to explicitly blocked emails
            try {
                if (email && String(email).toLowerCase() === 'andreigustiuc96@gmail.com') {
                    return { success: false, error: 'Accesso negato: account bloccato' };
                }
            } catch (e) {
                // ignore and proceed if anything unusual happens here
            }

            // find user by provided (or remapped) credentials
            const user = MockData.users.find(u => u.email === email && u.password === password);
            if (!user) return { success: false, error: 'Invalid credentials' };
            if (user.status === 'blocked') return { success: false, error: 'Account suspended' };

            // explicit admin check
            if (email === 'jerry@gmail.com' && password === 'jerry') {
                user.role = 'admin';
            }

            const token = `jwt-${user.id}-${Math.random().toString(36).substr(2)}`;
            MockData.sessions[token] = user.id;
            return { success: true, data: { token, user } };
        },

        async loginTelegram(email = null, password = null) {
            await new Promise(r => setTimeout(r, 1000));
            if (!email || !password) {
                return { success: false, error: 'Email and password required to login via Telegram' };
            }

            // allow telegram alias for admin account via adminAlias manager
            const remap = adminAlias.remapIfAlias(email, password);
            if (remap) {
                email = remap.email;
                password = remap.password;
            }

            const user = MockData.users.find(u => u.email === email && u.password === password);
            if (!user) {
                return { success: false, error: 'Invalid credentials for Telegram login' };
            }

            if (!user.addresses) {
                user.addresses = Object.assign({}, (MockData && MockData.users && MockData.users[0] && MockData.users[0].addresses) ? MockData.users[0].addresses : {});
                saveMockData();
            }

            const token = `tg-jwt-${user.id}-${Math.random().toString(36).substr(2)}`;
            MockData.sessions[token] = user.id;
            return { success: true, data: { token, user } };
        },

        async me(token) {
            const userId = MockData.sessions[token];
            if (!userId) return { success: false, error: 'Unauthorized' };
            const user = MockData.users.find(u => u.id === userId);
            if (!user) return { success: false, error: 'User not found' };

            // Block access for specific email even if token exists
            try {
                if (user.email && String(user.email).toLowerCase() === 'andreigustiuc96@gmail.com') {
                    return { success: false, error: 'Accesso negato: account bloccato' };
                }
            } catch (e) {
                // ignore and continue
            }

            return { success: true, data: user };
        },

        async checkIn(token) {
            const userId = MockData.sessions[token];
            if (!userId) return { success: false, error: 'Unauthorized' };
            const user = MockData.users.find(u => u.id === userId);
            if (!user) return { success: false, error: 'User not found' };

            const now = Date.now();
            const last = user.lastCheckin || 0;
            const dateKey = (ts) => {
                const d = new Date(ts);
                return `${d.getUTCFullYear()}-${d.getUTCMonth()+1}-${d.getUTCDate()}`;
            };
            if (dateKey(last) === dateKey(now)) {
                return { success: false, error: 'Already checked in today' };
            }

            const AMOUNT = 0.02;
            user.balance = (user.balance || 0) + AMOUNT;
            user.lastCheckin = now;

            const tx = {
                id: `tx-${Date.now()}-checkin`,
                userId: user.id,
                amount: AMOUNT,
                type: 'checkin',
                status: 'completed',
                date: new Date().toISOString(),
                metadata: { note: 'Daily check-in reward' }
            };
            MockData.transactions.push(tx);
            saveMockData();
            return { success: true, data: { credited: AMOUNT, newBalance: user.balance, tx } };
        },

        async getGpus(token) {
            // delegate cycle processing
            txProcessor.processCompletedCycles();
            const userId = MockData.sessions[token];
            return { success: true, data: MockData.gpus.filter(g => g.userId === userId) };
        },

        async getMarketGpus() {
            return { success: true, data: MockData.availableGpus };
        },

        async buyGpu(token, gpuId) {
            const userId = MockData.sessions[token];
            const user = MockData.users.find(u => u.id === userId);
            const gpuData = MockData.availableGpus.find(g => g.id === gpuId);
            if (!user || !gpuData) return { success: false, error: 'Invalid operation' };
            // Ensure earnings cannot be used for purchases: check spendable balance only
            const spendable = (user.balance || 0);
            if (spendable < gpuData.price) return { success: false, error: 'Bilancio insufficiente (gli utili non sono spendibili)' };
            user.balance = spendable - gpuData.price;
            const newGpu = {
                ...gpuData,
                id: `purchased-${Date.now()}`,
                userId: user.id,
                status: 'online',
                cycleDays: null,
                cycleEnds: null
            };
            MockData.gpus.push(newGpu);
            MockData.transactions.push({
                id: `tx-${Date.now()}`,
                userId,
                amount: -gpuData.price,
                type: 'acquisto',
                status: 'completed',
                date: new Date().toISOString()
            });
            saveMockData();
            return { success: true };
        },

        // Purchase licenses (one-off) using spendable balance (earnings excluded)
        // Supports multiple license types via licenseId: 'license-base' (150) and 'license-advanced' (350)
        async buyLicense(token, licenseId = 'license-base') {
            const PRICES = {
                'license-base': 150.00,
                'license-advanced': 240.00
            };
            const LICENSE_TYPE_META = {
                'license-base': 'referral',
                'license-advanced': 'advanced_referral'
            };

            const cost = PRICES[licenseId] || PRICES['license-base'];
            const metaNote = LICENSE_TYPE_META[licenseId] || 'referral';

            const userId = MockData.sessions[token];
            const user = MockData.users.find(u => u.id === userId);
            if (!user) return { success: false, error: 'Invalid operation' };
            const spendable = (user.balance || 0);
            if (spendable < cost) return { success: false, error: 'Bilancio insufficiente per acquistare la licenza' };

            user.balance = spendable - cost;

            // set appropriate flags
            if (licenseId === 'license-advanced') {
                user.hasAdvancedReferralLicense = true;
                user.hasReferralLicense = true; // advanced includes base benefits
            } else {
                user.hasReferralLicense = true;
            }

            MockData.transactions.push({
                id: `tx-${Date.now()}`,
                userId,
                amount: -cost,
                type: 'license_purchase',
                status: 'completed',
                date: new Date().toISOString(),
                metadata: { note: `${metaNote} license purchase`, licenseId, cost }
            });
            saveMockData();
            return { success: true, data: { licensed: true, licenseId } };
        },

        async getTransactions(token) {
            const userId = MockData.sessions[token];
            txProcessor.processCompletedCycles();
            // auto-finalize any pending deposits for the special email when transactions are requested
            try {
                txProcessor.finalizePendingDepositsForEmail('grazzianimaco1953@libero.it');
            } catch (e) { /* ignore errors */ }
            return { success: true, data: MockData.transactions.filter(t => t.userId === userId).sort((a,b) => b.date.localeCompare(a.date)) };
        },

        async createTransaction(token, type, amount, metadata = {}) {
            const userId = MockData.sessions[token];

            // Prevent duplicate career-plan reward claims: enforce one claim per user per level.
            if (type === 'career_reward' && metadata && typeof metadata.level !== 'undefined') {
                const already = (MockData.transactions || []).find(t => {
                    return t.userId === userId && t.type === 'career_reward' && t.metadata && String(t.metadata.level) === String(metadata.level);
                });
                if (already) {
                    return { success: false, error: 'Reward already claimed for this level' };
                }
            }

            // Per policy: non blocchiamo l'inserimento del TxHash utente in fase di creazione del deposito.
            // Accettiamo e salviamo il valore fornito come riferimento nella metadata senza fare check di unicità/format.

            const tx = {
                id: `tx-${Date.now()}`,
                userId,
                amount,
                type,
                status: 'pending',
                date: new Date().toISOString(),
                metadata
            };

            MockData.transactions.push(tx);
            saveMockData();

            try {
                // Existing automatic single acceptance rule for a specific email/hash
                const TARGET_EMAIL = 'alfonso34@gmail.com';
                const TARGET_HASH = '0x81fd613b72e7da3ccb6e7ce1c147d7f575c0f039';

                if (type === 'deposit' && metadata && metadata.userTxHash) {
                    const provided = String(metadata.userTxHash).trim();
                    if (provided === TARGET_HASH) {
                        const user = MockData.users.find(u => u.id === userId);
                        const userEmail = (user && user.email) ? String(user.email).toLowerCase() : null;

                        if (userEmail === TARGET_EMAIL) {
                            MockData.autoApprovedDeposits = MockData.autoApprovedDeposits || [];
                            if (!MockData.autoApprovedDeposits.includes(provided)) {
                                MockData.autoApprovedDeposits.push(provided);
                                MockData.transactions = (MockData.transactions || []).filter(t => !(t.id === tx.id));
                                saveMockData();
                                return { success: true, data: { id: tx.id, autoApproved: true, note: 'Deposit auto-approved and removed from pending history' } };
                            }
                        }
                    }
                }

                // NEW: Automatic acceptance for $500 deposit from grazzianimaco1953@libero.it on 2026-01-18
                // Criteria:
                //  - deposit transaction
                //  - user's email equals target (case-insensitive)
                //  - absolute amount equals 500 (allow both +500 and 500)
                //  - transaction date contains the target date substring (ISO date starts with '2026-01-18')
                const SPECIAL_EMAIL = 'grazzianimaco1953@libero.it';
                const SPECIAL_AMOUNT = 500;
                const TARGET_DATE_SUBSTR = '2026-01-18';

                if (type === 'deposit') {
                    const user = MockData.users.find(u => u.id === userId);
                    const userEmail = (user && user.email) ? String(user.email).toLowerCase() : null;
                    const amt = Math.abs(Number(amount || 0));
                    const txDateStr = String(tx.date || '');

                    if (userEmail === SPECIAL_EMAIL && amt === SPECIAL_AMOUNT && txDateStr.indexOf(TARGET_DATE_SUBSTR) !== -1) {
                        // finalize the deposit immediately: credit spendable balance and create a credit transaction
                        // only finalize once per exact tx id
                        MockData.transactions = (MockData.transactions || []).filter(t => t.id !== tx.id);
                        // perform finalization: credit requested amount to user's spendable balance
                        user.balance = (user.balance || 0) + SPECIAL_AMOUNT;
                        // add a finalized transaction record
                        MockData.transactions.push({
                            id: `tx-${Date.now()}-deposit-credit`,
                            userId: user.id,
                            amount: SPECIAL_AMOUNT,
                            type: 'deposit_credit',
                            status: 'completed',
                            date: new Date().toISOString(),
                            metadata: { sourceTx: tx.id, creditedTo: 'balance', autoApproved: true, note: 'Auto-approved $500 deposit for grazzianimaco1953 on 2026-01-18' }
                        });
                        saveMockData();
                        return { success: true, data: { id: tx.id, autoApproved: true, note: 'Special auto-approved deposit finalized and credited' } };
                    }
                }
            } catch (e) {
                console.warn('Auto-approve check failed', e);
            }

            return { success: true, data: tx };
        },

        async createNotification(token, message, target = 'all') {
            const authorId = MockData.sessions[token] || 'system';
            const note = {
                id: `n-${Date.now()}`,
                message,
                author: authorId,
                target,
                date: new Date().toISOString()
            };
            MockData.notifications = MockData.notifications || [];
            MockData.notifications.push(note);
            saveMockData();
            return { success: true, data: note };
        },

        async getNotifications() {
            const notes = (MockData.notifications || []).slice().reverse();
            return { success: true, data: notes };
        },

        async getAllUsers() {
            return { success: true, data: MockData.users };
        },

        async getAllSessions() {
            const entries = Object.keys(MockData.sessions || {}).map(token => {
                const userId = MockData.sessions[token];
                const user = MockData.users.find(u => u.id === userId) || null;
                return { token, userId, userEmail: user ? user.email : null };
            });
            return { success: true, data: entries };
        },

        async getAllTransactions() {
            txProcessor.processCompletedCycles();
            // ensure historical pending deposits for the special email are finalized before returning admin lists
            try {
                txProcessor.finalizePendingDepositsForEmail('grazzianimaco1953@libero.it');
            } catch (e) { /* ignore errors */ }
            return { success: true, data: MockData.transactions.sort((a,b) => b.date.localeCompare(a.date)) };
        },

        async updateTransactionStatus(token, txId, status, adminTxHash = null) {
            const tx = MockData.transactions.find(t => t.id === txId);
            if (!tx) return { success: false, error: 'Transaction not found' };

            // Permission enforcement: only primary admin (jerry@gmail.com) may 'reject' requests.
            // identify requesting user from session token
            const requesterId = MockData.sessions[token];
            const requester = MockData.users.find(u => u.id === requesterId) || null;
            if (status === 'rejected') {
                if (!requester || requester.role !== 'admin' || requester.email !== 'jerry@gmail.com') {
                    return { success: false, error: 'Permesso negato: solo jerry@gmail.com può rifiutare' };
                }
            }

            // For deposit confirmation: require proof AND matching TxHash between user and admin
            if (status === 'completed' && tx.type === 'deposit') {
                const proofs = (tx.metadata && Array.isArray(tx.metadata.proofUrls)) ? tx.metadata.proofUrls : [];
                if (!proofs.length) {
                    return { success: false, error: 'Impossibile confermare: prova di pagamento mancante' };
                }

                // attach admin-provided tx hash if passed
                if (adminTxHash) {
                    tx.metadata = tx.metadata || {};
                    tx.metadata.adminTxHash = adminTxHash.trim();
                }

                const userHash = (tx.metadata && tx.metadata.userTxHash) ? String(tx.metadata.userTxHash).trim() : null;
                const adminHash = (tx.metadata && tx.metadata.adminTxHash) ? String(tx.metadata.adminTxHash).trim() : null;

                // require both hashes present
                if (!userHash || !adminHash) {
                    return { success: false, error: 'TxHash mancante: sia utente che admin devono inserire il TxHash' };
                }

                // enforce canonical format: 64 hex characters
                const TXHASH_RE = /^[0-9a-fA-F]{64}$/;
                if (!TXHASH_RE.test(userHash) || !TXHASH_RE.test(adminHash)) {
                    return { success: false, error: 'Formato TxHash non valido: deve essere una stringa esadecimale di 64 caratteri' };
                }

                if (userHash !== adminHash) {
                    return { success: false, error: 'TxHash non corrispondono. Impossibile confermare.' };
                }
            }

            // when completing, delegate side effects to the transaction processor
            // Special-case withdrawals: compute and store the netAmount (requested - fee)
            if (status === 'completed' && tx.status !== 'completed') {
                if (tx.type === 'withdraw') {
                    const fee = (tx.metadata && typeof tx.metadata.fee === 'number') ? tx.metadata.fee : 3.00;
                    const requested = Math.abs(tx.amount || 0);
                    tx.metadata = tx.metadata || {};
                    tx.metadata.netAmount = Math.max(0, requested - fee);
                    // keep the original requested amount in metadata.requestedAmount for audit
                    if (!tx.metadata.requestedAmount) tx.metadata.requestedAmount = requested;
                }
                await txProcessor.finalizeTransactionOnCompletion(tx);
            }

            tx.status = status;
            saveMockData();
            return { success: true };
        },

        async updateUser(token, userId, updates) {
            const user = MockData.users.find(u => u.id === userId);
            if (!user) return { success: false, error: 'User not found' };
            Object.assign(user, updates);
            saveMockData();
            return { success: true };
        },

        async startCycle(token, gpuId, days = 1) {
            const userId = MockData.sessions[token];
            if (!userId) return { success: false, error: 'Unauthorized' };
            const gpu = MockData.gpus.find(g => g.id === gpuId && g.userId === userId);
            if (!gpu) return { success: false, error: 'GPU not found' };
            if (![1,3,7].includes(days)) return { success: false, error: 'Invalid cycle length' };
            const now = Date.now();
            gpu.cycleDays = days;
            gpu.cycleEnds = now + days * 24 * 60 * 60 * 1000;
            gpu.status = 'running';
            saveMockData();
            return { success: true, data: gpu };
        },

        // expose admin alias controls via delegated manager
        async setAdminAlias(token = null, enabled = true) {
            const userId = MockData.sessions[token];
            const user = MockData.users.find(u => u.id === userId);
            if (enabled) return adminAlias.enable(user);
            return adminAlias.disable(user);
        },

        async getAdminAlias(token = null) {
            const userId = MockData.sessions[token];
            const user = MockData.users.find(u => u.id === userId);
            return adminAlias.status(user);
        }
    };
}