(function() {
    try {
        // Safely remove/undefine problematic globals and flags if present
        if (typeof runIntegrityCheck !== 'undefined') {
            try { runIntegrityCheck = undefined; } catch(e) { try { window.runIntegrityCheck = undefined; } catch(_){} }
            console.log('Rimossa la funzione runIntegrityCheck');
        }

        if (typeof window.runIntegrityCheckCalled !== 'undefined') {
            try { delete window.runIntegrityCheckCalled; } catch(e) { window.runIntegrityCheckCalled = undefined; }
            console.log('Rimosso trigger automatico runIntegrityCheck');
        }

        // generic tolerant access to mockDB-like objects
        try {
            if (typeof mockDB !== 'undefined' && mockDB && mockDB.flags) {
                try { delete mockDB.flags.reconcileExecuted; } catch(e) { mockDB.flags.reconcileExecuted = undefined; }
                console.log('Rimosso flag reconcileExecuted');
            }
        } catch (e) { /* ignore */ }

        if (typeof computeAndApplyForcedIntegrity !== 'undefined') {
            try { computeAndApplyForcedIntegrity = undefined; } catch(e) { try { window.computeAndApplyForcedIntegrity = undefined; } catch(_){} }
            console.log('Rimossa la funzione computeAndApplyForcedIntegrity');
        }

        if (typeof window.computeAndApplyForcedIntegrityCalled !== 'undefined') {
            try { delete window.computeAndApplyForcedIntegrityCalled; } catch(e) { window.computeAndApplyForcedIntegrityCalled = undefined; }
            console.log('Rimosso trigger automatico computeAndApplyForcedIntegrity');
        }

        try {
            if (typeof mockDB !== 'undefined' && mockDB && mockDB.flags) {
                try { delete mockDB.flags.forcedIntegrityApplied; } catch(e) { mockDB.flags.forcedIntegrityApplied = undefined; }
                console.log('Rimosso flag forcedIntegrityApplied');
            }
        } catch (e) { /* ignore */ }

        console.log('Tutte le modifiche problematiche dai due summary sono state rimosse');
    } catch (err) {
        console.error('Errore durante la rimozione delle modifiche:', err);
    }
})();