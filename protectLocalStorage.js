(function protectLocalStorageSafe() {
    try {
        // Chiavi critiche da proteggere
        const protectedKeys = ['CUP9_SESSION_TOKEN', 'user_backup', 'CUP9_GPU_DB_backup'];

        // Salva lo stato corrente delle chiavi protette
        const backup = {};
        protectedKeys.forEach(key => {
            const val = localStorage.getItem(key);
            if (val !== null) backup[key] = val;
        });
        console.log('Backup delle chiavi protette creato:', Object.keys(backup));

        // Sovrascrive setItem e removeItem solo per le chiavi protette
        const originalSetItem = localStorage.setItem;
        const originalRemoveItem = localStorage.removeItem;

        localStorage.setItem = function(key, value) {
            if (protectedKeys.includes(key) && key in backup) {
                console.warn(`Protezione attiva: non sovrascrivere la chiave protetta ${key}`);
                return;
            }
            originalSetItem.apply(this, arguments);
        };

        localStorage.removeItem = function(key) {
            if (protectedKeys.includes(key)) {
                console.warn(`Protezione attiva: non cancellare la chiave protetta ${key}`);
                return;
            }
            originalRemoveItem.apply(this, arguments);
        };

        // Al caricamento della pagina, ripristina le chiavi protette se mancanti
        window.addEventListener('load', () => {
            protectedKeys.forEach(key => {
                if (!(key in localStorage) && backup[key]) {
                    localStorage.setItem(key, backup[key]);
                    console.log(`Chiave protetta ripristinata: ${key}`);
                }
            });
            console.log('Protezione localStorage aggiornata e compatibile con nuovi account.');
        });
    } catch (err) {
        console.error('Errore nella protezione localStorage:', err);
    }
})();