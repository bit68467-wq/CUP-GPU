/* New module: ui_market.js - Market rendering logic */
export function renderMarket(user, marketGpus = []) {
    const marketContainer = document.getElementById('available-gpu-list');
    if (!marketContainer) return;
    marketContainer.innerHTML = '';

    const PRICE_CAP = 4000;
    const filteredMarket = (marketGpus || []).filter(gpu => typeof gpu.price === 'number' ? gpu.price <= PRICE_CAP : true);

    // Insert referral license card at top
    const licenseCard = document.createElement('div');
    licenseCard.className = 'gpu-card';

    // if user already owns a referral license, show disabled button and note
    const hasLicense = user && user.hasReferralLicense;
    const licenseBtnHtml = hasLicense
        ? `<button class="btn-primary" disabled style="opacity:0.6">Licenza Attiva</button>`
        : `<button class="btn-primary buy-license-btn" data-id="license-1">Acquista Licenza</button>`;

    licenseCard.innerHTML = `
        <div class="gpu-header"><span class="type">LICENSE</span><i class="fas fa-link" style="color:var(--primary-color)"></i></div>
        <h3>Licenza Partner</h3>
        <div class="region"><i class="fas fa-coins"></i> Prezzo: $150</div>
        <div class="region"><i class="fas fa-info-circle"></i> Acquistabile con il saldo disponibile (spendibile); permette di generare link referral personali</div>
        <div class="gpu-footer" style="margin-top:15px">
            ${licenseBtnHtml}
        </div>
    `;
    marketContainer.appendChild(licenseCard);

    if (!filteredMarket.length) {
        marketContainer.innerHTML += '<div class="empty-state">Nessun dispositivo disponibile nel range di prezzo selezionato.</div>';
    } else {
        filteredMarket.forEach(gpu => {
            const card = document.createElement('div');
            card.className = 'gpu-card';
            const pct = gpu.price ? (gpu.dailyReturn / gpu.price) * 100 : 0;

            // compute-fallback heuristics
            const tflops = Number(gpu.tflops || gpu.computeTFLOPS || 0) || (gpu.price ? Math.max(0, Math.round((gpu.price / 400) * 10) / 10) : 0);
            const cores = Number(gpu.cores || gpu.cudaCores || 0) || Math.round(tflops * 256);
            const util = gpu.utilization || 0;

            card.innerHTML = `
                <div class="gpu-header">
                    <span class="type">${gpu.type}</span>
                    <i class="fas fa-${gpu.icon || 'microchip'}" style="color:var(--primary-color)"></i>
                </div>
                <h3>${gpu.name}</h3>
                <div class="region"><i class="fas fa-coins"></i> Prezzo: $${gpu.price}</div>
                <div class="region"><i class="fas fa-arrow-up"></i> Profitto: $${(gpu.dailyReturn||0).toFixed(2)}/giorno <span style="color:var(--text-dim); font-size:12px; margin-left:8px">(${pct.toFixed(2)}%/giorno)</span></div>

                <div style="margin-top:10px;display:flex;gap:12px;align-items:center;justify-content:space-between">
                    <div style="display:flex;gap:10px;align-items:center">
                        <div style="width:44px;height:44px;border-radius:8px;background:rgba(14,165,233,0.06);display:flex;align-items:center;justify-content:center;color:var(--primary-color);font-weight:800">
                            <i class="fas fa-microchip"></i>
                        </div>
                        <div>
                            <div style="font-weight:800">${tflops ? tflops.toFixed(2) + ' TFLOPS' : cores + ' cores'}</div>
                            <div style="font-size:12px;color:var(--text-dim)">Assegnato • ${cores} cores</div>
                        </div>
                    </div>
                    <div style="text-align:right;width:110px">
                        <div style="font-size:12px;color:var(--text-dim)">Utilizzo</div>
                        <div style="font-weight:800">${util ? util + '%' : '—'}</div>
                    </div>
                </div>

                <div style="margin-top:8px;height:8px;background:rgba(255,255,255,0.03);border-radius:8px;overflow:hidden;border:1px solid var(--border-color)">
                    <div style="height:100%;background:linear-gradient(90deg,#34d399,#06b6d4);width:${util || 10}%;transition:width 0.3s"></div>
                </div>

                <div class="gpu-footer" style="margin-top:12px">
                    <button class="btn-primary buy-gpu-btn" data-id="${gpu.id}">
                        Investi Ora
                    </button>
                </div>
            `;
            // disable buy button if insufficient balance (deferred check in events if needed)
            if (user && typeof user.balance === 'number' && user.balance < gpu.price) {
                const btn = card.querySelector('.buy-gpu-btn');
                if (btn) {
                    btn.disabled = true;
                    btn.innerText = 'Bilancio Insuff.';
                }
            }
            marketContainer.appendChild(card);
        });
    }
}