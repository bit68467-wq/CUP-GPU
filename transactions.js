/* New file: services/transactions.js
   Encapsulates cycle processing, deposits/withdrawal finalization and other transaction-side effects.
*/

export function createTransactionProcessor(MockData, { saveMockData }) {
    // process completed cycles and credit earnings before returning gpu lists
    function processCompletedCycles() {
        const now = Date.now();
        const completed = MockData.gpus.filter(g => g.cycleEnds && g.cycleEnds <= now);
        completed.forEach(gpu => {
            const user = MockData.users.find(u => u.id === gpu.userId);
            const days = gpu.cycleDays || 0;
            const gross = (gpu.dailyReturn || 0) * days;
            const net = gross;
            if (user) {
                // credit cycle payouts to the earnings bucket (withdrawable), not spendable balance
                user.earnings = (user.earnings || 0) + net;
                MockData.transactions.push({
                    id: `tx-${Date.now()}-cycle`,
                    userId: user.id,
                    amount: net,
                    type: 'cycle_payout',
                    status: 'completed',
                    date: new Date().toISOString(),
                    metadata: { gpuId: gpu.id, days, gross, net }
                });
            }
            gpu.cycleDays = null;
            gpu.cycleEnds = null;
            gpu.status = 'online';
        });
        if (completed.length) saveMockData();
    }

    async function finalizeTransactionOnCompletion(tx) {
        if (!tx || !tx.type) return;
        const user = MockData.users.find(u => u.id === tx.userId);

        if (tx.type === 'deposit') {
            const requested = (tx.metadata && typeof tx.metadata.requestedAmount === 'number') ? tx.metadata.requestedAmount : tx.amount || 0;
            const fee = (tx.metadata && typeof tx.metadata.fee === 'number') ? tx.metadata.fee : 0;
            // Deposits are credited to the user's spendable balance (not to earnings)
            if (user) {
                user.balance = (user.balance || 0) + requested;
                MockData.transactions.push({
                    id: `tx-${Date.now()}-deposit-credit`,
                    userId: user.id,
                    amount: requested,
                    type: 'deposit_credit',
                    status: 'completed',
                    date: new Date().toISOString(),
                    metadata: { sourceTx: tx.id, creditedTo: 'balance' }
                });
            }
            if (fee > 0) {
                let adminUser = MockData.users.find(u => u.role === 'admin' && u.status === 'active');
                if (!adminUser) adminUser = MockData.users[0] || null;
                if (adminUser) {
                    adminUser.balance = (adminUser.balance || 0) + fee;
                    MockData.transactions.push({
                        id: `tx-${Date.now()}-deposit-fee`,
                        userId: adminUser.id,
                        amount: fee,
                        type: 'fee_credit',
                        status: 'completed',
                        date: new Date().toISOString(),
                        metadata: { sourceTx: tx.id, note: `Deposit fee credited from ${tx.userId}` }
                    });
                }
            }
        } else if (tx.type === 'cycle_payout') {
            // Credit cycle payouts to the earnings bucket (withdrawable)
            if (user) {
                user.earnings = (user.earnings || 0) + tx.amount;
                MockData.transactions.push({
                    id: `tx-${Date.now()}-earnings-credit`,
                    userId: user.id,
                    amount: tx.amount,
                    type: 'cycle_payout_credit',
                    status: 'completed',
                    date: new Date().toISOString(),
                    metadata: { sourceTx: tx.id }
                });
            }
        } else if (tx.type === 'withdraw') {
            // When a withdrawal is completed, debit the user's earnings (withdrawable) and credit platform fee to admin
            if (user) {
                const amountAbs = Math.abs(tx.amount || 0);
                user.earnings = Math.max(0, (user.earnings || 0) - amountAbs);
                MockData.transactions.push({
                    id: `tx-${Date.now()}-withdraw-debit`,
                    userId: user.id,
                    amount: -amountAbs,
                    type: 'withdraw_debit',
                    status: 'completed',
                    date: new Date().toISOString(),
                    metadata: { sourceTx: tx.id, debitedFrom: 'earnings' }
                });
            }

            const fee = (tx.metadata && typeof tx.metadata.fee === 'number') ? tx.metadata.fee : 3.00;
            let adminUser = MockData.users.find(u => u.role === 'admin' && u.status === 'active');
            if (!adminUser) adminUser = MockData.users[0] || null;
            if (adminUser && fee > 0) {
                adminUser.balance = (adminUser.balance || 0) + fee;
                MockData.transactions.push({
                    id: `tx-${Date.now()}-fee`,
                    userId: adminUser.id,
                    amount: fee,
                    type: 'fee_credit',
                    status: 'completed',
                    date: new Date().toISOString(),
                    metadata: { sourceTx: tx.id, note: `Withdrawal fee credited from ${tx.userId}` }
                });
            }
        } else {
            // Generic handling for other tx types: positive amounts credit spendable balance, negative amounts adjust balance by default
            if (user) {
                if (tx.amount && tx.amount > 0) {
                    user.balance = (user.balance || 0) + tx.amount;
                    MockData.transactions.push({
                        id: `tx-${Date.now()}-generic-credit`,
                        userId: user.id,
                        amount: tx.amount,
                        type: 'generic_credit',
                        status: 'completed',
                        date: new Date().toISOString(),
                        metadata: { sourceTx: tx.id }
                    });
                } else if (tx.amount && tx.amount < 0) {
                    // negative generic amounts reduce spendable balance
                    user.balance = (user.balance || 0) + tx.amount;
                    MockData.transactions.push({
                        id: `tx-${Date.now()}-generic-debit`,
                        userId: user.id,
                        amount: tx.amount,
                        type: 'generic_debit',
                        status: 'completed',
                        date: new Date().toISOString(),
                        metadata: { sourceTx: tx.id }
                    });
                }
            }
        }

        saveMockData();
    }

    // finalize all pending deposit txs for a given email (credits spendable balance)
    function finalizePendingDepositsForEmail(email) {
        try {
            if (!email) return 0;
            const target = String(email).toLowerCase();
            let count = 0;
            const pending = MockData.transactions.filter(t => t && t.type === 'deposit' && t.status === 'pending');
            pending.forEach(tx => {
                const user = MockData.users.find(u => u.id === tx.userId);
                const userEmail = (user && user.email) ? String(user.email).toLowerCase() : null;
                if (userEmail === target) {
                    // mark as completed and run standard finalization
                    tx.status = 'completed';
                    finalizeTransactionOnCompletion(tx);
                    count++;
                }
            });
            if (count) saveMockData();
            return count;
        } catch (e) {
            console.warn('finalizePendingDepositsForEmail error', e);
            return 0;
        }
    }

    return {
        processCompletedCycles,
        finalizeTransactionOnCompletion,
        finalizePendingDepositsForEmail
    };
}