import { API } from './api.js';
import { Auth } from './auth.js';

export function renderProfile(user, gpus = []) {
    if (!user) return;
    const avatarUrl = `https://images.websim.com/avatar/${user.email.split('@')[0]}`;
    const balanceEl = document.getElementById('user-balance-display');
    if (balanceEl) balanceEl.innerText = `$${(user.balance||0).toFixed(2)}`;

    // Compute active GPU count from provided gpus (prefer real data), fallback to user.gpuCount
    const activeCount = Array.isArray(gpus) ? gpus.filter(g => g.status === 'online' || g.status === 'running').length : (user.gpuCount || 0);
    const activeCountEl = document.getElementById('active-gpus-count');
    if (activeCountEl) activeCountEl.innerText = activeCount;

    // --- NEW: expose total purchased compute power on the homepage (next to active devices) ---
    // compute total TFLOPS using explicit fields when present or a price->tf heuristic
    let homeTotalTFLOPS = 0;
    (Array.isArray(gpus) ? gpus : []).forEach(g => {
        let tf = Number(g.tflops || g.computeTFLOPS || 0) || 0;
        if (!tf && g.price) {
            // heuristic: price -> TFLOPS (coarse, for display)
            tf = Math.max(0, Math.round((g.price / 300) * 10) / 10); // adjusted scale for visible numbers
        }
        homeTotalTFLOPS += tf;
    });

    // create or update a small display next to the active GPU count on the home wallet card
    try {
        if (activeCountEl) {
            let tfEl = document.getElementById('home-total-tflops');
            if (!tfEl) {
                tfEl = document.createElement('div');
                tfEl.id = 'home-total-tflops';
                tfEl.style.fontSize = '12px';
                tfEl.style.color = 'var(--text-dim)';
                tfEl.style.marginTop = '6px';
                activeCountEl.parentElement.appendChild(tfEl);
            }
            tfEl.innerText = `${homeTotalTFLOPS ? homeTotalTFLOPS.toFixed(2) + ' TFLOPS' : '0.00 TFLOPS'}`;
        }
    } catch (e) {
        console.warn('Could not render home total TFLOPS', e);
    }

    // Compute daily profit from provided gpus (sum of dailyReturn)
    const dailyProfit = Array.isArray(gpus) ? gpus.reduce((s, g) => s + (Number(g.dailyReturn) || 0), 0) : 0;
    const dailyProfitEl = document.getElementById('daily-profit-value');
    if (dailyProfitEl) dailyProfitEl.innerText = `${dailyProfit >= 0 ? '+' : '-'}$${Math.abs(dailyProfit).toFixed(2)}`;

    const avatarLarge = document.getElementById('profile-avatar-large');
    if (avatarLarge) avatarLarge.src = avatarUrl;
    const emailEl = document.getElementById('profile-email');
    if (emailEl) emailEl.innerText = user.email;
    const idEl = document.getElementById('profile-id');
    if (idEl) idEl.innerText = `ID: ${user.id}`;

    // SHOW SPONSOR CODE (only when saved on the server/user object; no client-side fallback)
    try {
        const sponsorCode = user.referrer || user.inviteCode || null;
        // only render when an actual code exists (non-empty)
        if (sponsorCode) {
            let sponsorEl = document.getElementById('profile-sponsor');
            if (!sponsorEl) {
                sponsorEl = document.createElement('div');
                sponsorEl.id = 'profile-sponsor';
                sponsorEl.style.fontSize = '13px';
                sponsorEl.style.color = 'var(--text-dim)';
                sponsorEl.style.marginTop = '6px';
                idEl.parentElement.appendChild(sponsorEl);
            }
            sponsorEl.innerText = `Sponsor: ${sponsorCode}`;
        } else {
            const existing = document.getElementById('profile-sponsor');
            if (existing) existing.remove();
        }
    } catch (e) {
        console.warn('Could not render sponsor code', e);
    }

    const codeEl = document.getElementById('referral-code');

    // Ensure referral code is distinct from the user UID:
    // - Prefer explicit inviteCode (preserves exactly what user entered at registration)
    // - Fallback to a safe derived referral string from the local email prefix
    // - Keep the displayed UID unchanged (user.id) so both values are different
    const computedReferral = user.inviteCode || user.referralCode || `REF-${(user.email||'').split('@')[0].toUpperCase()}`;
    const shortCode = String(computedReferral);

    // Show referral code only if user has an active referral license
    const referralBox = document.querySelector('.referral-box-mini');
    if (user.hasReferralLicense) {
        if (referralBox) referralBox.classList.remove('hidden');
        if (codeEl) codeEl.innerText = shortCode;
    } else {
        if (referralBox) referralBox.classList.add('hidden');
    }

    // display separate earnings (prelevabili) and spendable balance
    const earningsEl = document.getElementById('user-earnings-display');
    if (earningsEl) earningsEl.innerText = `$${(user.earnings||0).toFixed(2)}`;

    // Add "Acquista Licenza" button into profile area (visible even if referral box hidden)
    // This button uses the existing global delegated handler (class: buy-license-btn)
    const profileCard = document.querySelector('#profile-tab .profile-card');
    if (profileCard && !document.getElementById('profile-buy-license')) {
        const licenseWrap = document.createElement('div');
        licenseWrap.style.marginTop = '10px';
        licenseWrap.style.display = 'flex';
        licenseWrap.style.gap = '8px';
        licenseWrap.style.alignItems = 'center';

        const hasLicense = !!user.hasReferralLicense;
        const btn = document.createElement('button');
        btn.id = 'profile-buy-license';
        btn.className = hasLicense ? 'btn-primary' : 'btn-primary buy-license-btn';
        btn.dataset.id = 'license-1';
        btn.style.padding = '10px 14px';
        btn.innerText = hasLicense ? 'Licenza Attiva' : 'Acquista Licenza Partner - $150';

        // disable if already owned
        if (hasLicense) btn.disabled = true;

        // disable if insufficient spendable balance
        const spendable = (user.balance || 0);
        if (!hasLicense && spendable < 150) {
            btn.disabled = true;
            btn.innerText = 'Bilancio Insufficiente';
            btn.title = 'Serve almeno $150 di saldo spendibile';
        }

        licenseWrap.appendChild(btn);

        // brief note about license effect
        const note = document.createElement('div');
        note.style.fontSize = '12px';
        note.style.color = 'var(--text-dim)';
        note.innerText = 'La licenza consente di generare link referral personali. Pagamento da saldo (non dagli utili).';
        licenseWrap.appendChild(note);

        profileCard.appendChild(licenseWrap);
    }

    // Insert a contact link to the Websim project page in the profile area
    const contactsContainerId = 'profile-contacts';
    let contactsContainer = document.getElementById(contactsContainerId);
    if (!contactsContainer) {
        contactsContainer = document.createElement('div');
        contactsContainer.id = contactsContainerId;
        contactsContainer.style.marginTop = '12px';
        contactsContainer.style.display = 'flex';
        contactsContainer.style.gap = '8px';
        contactsContainer.style.alignItems = 'center';
        // place it above the referral box if possible
        const profileCard = document.querySelector('#profile-tab .profile-card') || document.getElementById('profile-tab');
        const refBox = profileCard ? profileCard.querySelector('.referral-box-mini') : null;
        if (profileCard) {
            if (refBox) profileCard.insertBefore(contactsContainer, refBox);
            else profileCard.appendChild(contactsContainer);
        }
    }
    contactsContainer.innerHTML = `<a href="https://siteinfogpu.on.websim.com/" target="_blank" rel="noopener noreferrer" class="btn-sm btn-outline" style="text-decoration:none">Official Site</a>`;

    // generate full referral link using window.baseUrl (per platform convention)
    const base = window.baseUrl || (window.location.origin + window.location.pathname);
    const referralParam = encodeURIComponent(shortCode);
    const fullLink = `${base}?ref=${referralParam}`;

    // add a copy-link button next to the code, if not present
    if (codeEl && !document.getElementById('copy-referral-link-btn')) {
        const btn = document.createElement('button');
        btn.id = 'copy-referral-link-btn';
        btn.className = 'btn-sm btn-outline';
        btn.style.marginLeft = '8px';
        btn.innerText = 'Copia link';
        btn.onclick = () => {
            navigator.clipboard.writeText(fullLink).then(() => {
                const ui = window.UI || null;
                if (ui && ui.notify) ui.notify('Referral link copiato negli appunti');
            }).catch(() => {
                const ui = window.UI || null;
                if (ui && ui.notify) ui.notify('Impossibile copiare il link', 'error');
            });
        };
        codeEl.parentElement.appendChild(btn);
    } else if (codeEl) {
        // ensure the button's behavior stays in sync if it already exists
        const existingBtn = document.getElementById('copy-referral-link-btn');
        if (existingBtn) {
            existingBtn.onclick = () => {
                navigator.clipboard.writeText(fullLink).then(() => {
                    const ui = window.UI || null;
                    if (ui && ui.notify) ui.notify('Referral link copiato negli appunti');
                }).catch(() => {
                    const ui = window.UI || null;
                    if (ui && ui.notify) ui.notify('Impossibile copiare il link', 'error');
                });
            };
        }
    }

    // update referral count badge
    const refCount = (user.referrals || []).length;
    if (codeEl) {
        codeEl.title = `${refCount} referrals`;
        if (!document.getElementById('referral-count-badge')) {
            const badge = document.createElement('span');
            badge.id = 'referral-count-badge';
            badge.className = 'badge';
            badge.style.marginLeft = '8px';
            badge.style.background = 'rgba(56,189,248,0.12)';
            badge.style.color = 'var(--primary-color)';
            badge.innerText = `${refCount}`;
            codeEl.parentElement.appendChild(badge);
        } else {
            document.getElementById('referral-count-badge').innerText = `${refCount}`;
        }
    }

    // --- NEW: compute and render user's total compute power summary ---
    try {
        // compute per-device metrics (fallback to synthetic values if not present)
        const parsedGpus = Array.isArray(gpus) ? gpus : [];
        let totalTFLOPS = 0;
        let totalCores = 0;
        parsedGpus.forEach(g => {
            // prefer explicit fields, otherwise approximate from price/dailyReturn as fallback
            let tf = Number(g.tflops || g.computeTFLOPS || 0);
            let cores = Number(g.cores || g.cudaCores || 0);
            if (!tf && g.price) {
                // rough heuristic: price -> tf approximation (not precise, just for display)
                tf = Math.max(0, Math.round((g.price / 400) * 10) / 10); // coarse scale
            }
            if (!cores && tf) {
                cores = Math.round(tf * 256); // heuristic
            }
            totalTFLOPS += tf;
            totalCores += cores;
        });


    } catch (e) {
        console.warn('Could not render compute summary', e);
    }

    // --- Real-time TFLOPS updater: periodically recompute TFLOPS and utilization and refresh UI ---
    // Keeps a single interval running per page load; updates every 2s.
    if (!window.__CUP9_TFLOPS_UPDATER_ATTACHED) {
        window.__CUP9_TFLOPS_UPDATER_ATTACHED = true;
        window.__CUP9_TFLOPS_INTERVAL = setInterval(() => {
            try {
                // try to locate currently rendered compute elements
                const profileCard = document.querySelector('#profile-tab .profile-card');
                const computeNode = document.getElementById('profile-compute-summary');
                if (!computeNode) return;

                // try to obtain current GPU list from global UI state where possible
                // prefer parameterized last-known gpus stored on element (if any), otherwise attempt to fetch via API if available
                let parsedGpus = [];
                // If renderMyGpus stored last list on container, use it
                const myGpuContainer = document.getElementById('my-gpu-list');
                if (myGpuContainer && Array.isArray(myGpuContainer._lastGpus)) {
                    parsedGpus = myGpuContainer._lastGpus;
                } else if (window.gpusCache && Array.isArray(window.gpusCache)) {
                    parsedGpus = window.gpusCache;
                } else {
                    // fallback: attempt to read list displayed in DOM (best-effort, not authoritative)
                    const cards = document.querySelectorAll('#my-gpu-list .gpu-card');
                    parsedGpus = Array.from(cards).map(c => {
                        return {
                            tflops: parseFloat(c.querySelector('.gpu-card-content .fa-microchip') ? (c.dataset.tflops || 0) : (c.dataset.tflops || 0)) || 0,
                            cores: parseInt(c.dataset.cores || 0, 10) || 0,
                            utilization: parseInt(c.querySelector('[style*="Utilizzo"]') ? (c.dataset.utilization || 100) : (c.dataset.utilization || 100), 10) || 0
                        };
                    });
                }

                // compute totals (same heuristics as renderProfile)
                let totalTFLOPS = 0;
                let totalCores = 0;
                parsedGpus.forEach(g => {
                    let tf = Number(g.tflops || g.computeTFLOPS || 0) || 0;
                    let cores = Number(g.cores || g.cudaCores || 0) || 0;
                    if (!tf && g.price) tf = Math.max(0, Math.round((g.price / 400) * 10) / 10);
                    if (!cores && tf) cores = Math.round(tf * 256);
                    totalTFLOPS += tf;
                    totalCores += cores;
                });

                // small gentle fluctuation effect for "live" feeling (non-destructive)
                const jitter = (v) => {
                    if (!v) return v;
                    const delta = (Math.random() - 0.5) * 0.02 * v; // ±1%
                    return Math.max(0, v + delta);
                };

                const displayTF = jitter(totalTFLOPS);
                const displayCores = Math.round(jitter(totalCores));

                const totalTEl = document.getElementById('total-tflops-display');
                if (totalTEl) {
                    totalTEl.innerText = displayTF ? `${displayTF.toFixed(2)} TFLOPS` : '0 TFLOPS';
                }
                const totalCEl = document.getElementById('total-cores-display');
                if (totalCEl) totalCEl.innerText = displayCores ? `${displayCores} cores` : '0 cores';

                // update progress bar and utilization
                const progEl = document.getElementById('user-compute-progress');
                if (progEl) {
                    const widthPct = Math.min(100, Math.round((displayTF / Math.max(1, displayTF + 10)) * 100));
                    progEl.style.width = `${widthPct}%`;
                }
                const utilEl = document.getElementById('user-compute-util-display');
                if (utilEl) {
                    const avgUtil = parsedGpus.length ? Math.round(parsedGpus.reduce((s,g)=>s+(g.utilization||100),0)/parsedGpus.length) : 0;
                    utilEl.innerText = `${avgUtil}%`;
                }
            } catch (e) {
                // keep updater resilient
                console.warn('TFLOPS updater error', e);
            }
        }, 2000);
    }
}

export function renderPlatformAddresses(user) {
    // Keep profile free of deposit addresses; do not display explanatory text.
    if (!user) return;
    const containerId = 'platform-addresses';
    const existing = document.getElementById(containerId);
    if (existing) existing.remove();
    // Intentionally do not inject any explanatory text or deposit addresses here.
    return;
}

function formatTimeRemaining(ms) {
    if (!ms || ms <= 0) return '0s';
    const s = Math.floor(ms / 1000);
    const days = Math.floor(s / 86400);
    const hours = Math.floor((s % 86400) / 3600);
    const mins = Math.floor((s % 3600) / 60);
    if (days) return `${days}d ${hours}h`;
    if (hours) return `${hours}h ${mins}m`;
    if (mins) return `${mins}m`;
    return `${s % 60}s`;
}

export function renderMyGpus(gpus = []) {
    const myGpuContainer = document.getElementById('my-gpu-list');
    if (!myGpuContainer) return;
    myGpuContainer.innerHTML = gpus.length ? '' : '<div class="empty-state">Nessun hardware attivo.</div>';

    // compute totals for the user's active devices
    const parsedGpus = Array.isArray(gpus) ? gpus : [];
    let totalTFLOPS = 0;
    let totalCores = 0;
    parsedGpus.forEach(g => {
        const tf = Number(g.tflops || g.computeTFLOPS || 0) || 0;
        const cores = Number(g.cores || g.cudaCores || 0) || 0;
        totalTFLOPS += tf;
        totalCores += cores;
    });

    // update dashboard summary if present
    const totalTEl = document.getElementById('total-tflops-display');
    if (totalTEl) totalTEl.innerText = totalTFLOPS ? `${totalTFLOPS.toFixed(2)} TFLOPS` : '0 TFLOPS';
    const totalCEl = document.getElementById('total-cores-display');
    if (totalCEl) totalCEl.innerText = totalCores ? `${totalCores} cores` : '0 cores';
    const utilEl = document.getElementById('user-compute-util-display');
    if (utilEl) {
        const avgUtil = parsedGpus.length ? Math.round(parsedGpus.reduce((s,g)=>s+(g.utilization||100),0)/parsedGpus.length) : 0;
        utilEl.innerText = `${avgUtil}%`;
    }
    const progEl = document.getElementById('user-compute-progress');
    if (progEl) {
        const widthPct = Math.min(100, Math.round((totalTFLOPS / Math.max(1, totalTFLOPS + 10)) * 100));
        progEl.style.width = `${widthPct}%`;
    }

    parsedGpus.forEach(gpu => {
        const card = document.createElement('div');
        card.className = 'gpu-card';

        // decorative illustration as lightweight SVG background (non-interactive)
        const art = document.createElement('div');
        art.className = 'gpu-illustration';
        art.innerHTML = `...`; // keep same artwork via CSS svg in original; actual svg omitted for brevity
        card.appendChild(art);

        // compute display metrics (fallback heuristics)
        const tflops = Number(gpu.tflops || gpu.computeTFLOPS || 0) || (gpu.price ? Math.max(0, Math.round((gpu.price / 400) * 10) / 10) : 0);
        const cores = Number(gpu.cores || gpu.cudaCores || 0) || Math.round(tflops * 256);
        const utilization = Math.min(100, Math.max(0, Number(gpu.utilization || gpu.util || gpu.usage || 100)));

        // status mapping (prefer running/online/in-processing)
        const statusLabel = (gpu.status === 'running' || gpu.status === 'in-use') ? 'In uso' : (gpu.status === 'online' ? 'Attivo' : (gpu.status === 'processing' ? 'In elaborazione' : gpu.status));

        // execution progress if cycle set
        let progressHtml = '';
        if (gpu.cycleDays && gpu.cycleEnds) {
            const now = Date.now();
            const totalMs = gpu.cycleDays * 24 * 60 * 60 * 1000;
            const remaining = Math.max(0, gpu.cycleEnds - now);
            const elapsed = Math.max(0, totalMs - remaining);
            const pct = Math.min(100, Math.round((elapsed / totalMs) * 100));
            progressHtml = `
                <div style="margin-top:8px">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                        <small style="color:var(--text-dim)">Cycle: ${gpu.cycleDays} day(s)</small>
                        <small style="color:var(--text-dim)">${formatTimeRemaining(remaining)}</small>
                    </div>
                    <div style="background:rgba(255,255,255,0.03);height:8px;border-radius:8px;overflow:hidden;border:1px solid var(--border-color)">
                        <div style="height:100%;background:linear-gradient(90deg,var(--primary-color),var(--primary-dim));width:${pct}%;transition:width 0.4s"></div>
                    </div>
                </div>
            `;
        }

        // compute-power UI block
        const computeHtml = `
            <div style="margin-top:8px;display:flex;flex-direction:column;gap:8px">
                <div style="display:flex;justify-content:space-between;align-items:center;gap:12px">
                    <div style="display:flex;gap:10px;align-items:center">
                        <div style="width:44px;height:44px;border-radius:8px;background:rgba(14,165,233,0.12);display:flex;align-items:center;justify-content:center;color:var(--primary-color);font-weight:800">
                            <i class="fas fa-microchip"></i>
                        </div>
                        <div>
                            <div style="font-weight:800">${tflops ? tflops.toFixed(2) + ' TFLOPS' : (cores ? cores + ' cores' : '—')}</div>
                            <div style="font-size:12px;color:var(--text-dim)">${cores ? cores + ' CUDA cores' : 'Compute units'}</div>
                        </div>
                    </div>
                    <div style="text-align:right">
                        <div style="font-size:12px;color:var(--text-dim)">Utilizzo</div>
                        <div style="font-weight:800">${utilization}%</div>
                    </div>
                </div>

                <div style="height:8px;background:rgba(255,255,255,0.03);border-radius:8px;overflow:hidden;border:1px solid var(--border-color)">
                    <div style="height:100%;background:linear-gradient(90deg,#34d399,#06b6d4);width:${utilization}%;transition:width 0.3s"></div>
                </div>

                <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-dim);margin-top:6px">
                    <div>Contributo: <strong style="color:var(--primary-color)">${statusLabel}</strong></div>
                    <div>Assegnato: <strong>${tflops ? tflops.toFixed(2) + ' TFLOPS' : cores + ' cores'}</strong></div>
                </div>
            </div>
        `;

        // controls when online
        const controlsHtml = gpu.status === 'online' ? `
            <div style="display:flex;gap:8px;margin-top:12px">
                <button class="btn-sm btn-outline" data-action="start-cycle" data-id="${gpu.id}" data-days="1">1d</button>
                <button class="btn-sm btn-outline" data-action="start-cycle" data-id="${gpu.id}" data-days="3">3d</button>
                <button class="btn-sm btn-outline" data-action="start-cycle" data-id="${gpu.id}" data-days="7">7d</button>
            </div>
        ` : '';

        // build content
        const content = document.createElement('div');
        content.className = 'gpu-card-content';
        content.innerHTML = `
            <div class="gpu-header">
                <span class="type">${gpu.type}</span>
                <span class="status-tag status-${gpu.status}">${statusLabel}</span>
            </div>
            <h3>${gpu.name}</h3>
            <div class="region"><i class="fas fa-chart-line"></i> Resa: $${(gpu.dailyReturn||0).toFixed(2)}/giorno</div>
            ${computeHtml}
            ${progressHtml}
            <div class="gpu-footer" style="margin-top:10px">
                <div style="font-size:12px; color:var(--text-dim)">Località: ${gpu.region || '—'}</div>
                ${controlsHtml}
            </div>
        `;

        card.appendChild(content);
        myGpuContainer.appendChild(card);
    });
}

export function renderRecentTransactions(transactions = []) {
    const txContainer = document.getElementById('transaction-list');
    if (!txContainer) return;

    // Pagination settings
    const PAGE_SIZE = 5;
    // Store full transactions reference on the container so subsequent calls update it
    txContainer._allTransactions = transactions.slice(); // shallow copy

    // reset paging state
    txContainer._txPage = 0;

    const renderPage = (page) => {
        txContainer.innerHTML = '';
        const start = page * PAGE_SIZE;
        const pageItems = (txContainer._allTransactions || []).slice(start, start + PAGE_SIZE);
        if (!pageItems.length) {
            txContainer.innerHTML = '<div class="empty-state">Nessuna attività.</div>';
            return;
        }
        pageItems.forEach(tx => {
            const item = document.createElement('div');
            item.className = 'list-item';

            // Determine display amount:
            // - For completed withdrawals, prefer metadata.netAmount (requested - fee) and show as positive confirmed amount.
            // - Otherwise show the transaction amount (preserve sign semantics for deposits/other txs).
            let displayAmount = tx.amount || 0;
            let amountClass = displayAmount >= 0 ? 'text-success' : 'text-danger';
            let amountPrefix = (displayAmount >= 0) ? '+' : '';

            if (tx.type === 'withdraw' && tx.status === 'completed' && tx.metadata && typeof tx.metadata.netAmount === 'number') {
                displayAmount = Number(tx.metadata.netAmount);
                amountClass = 'text-success'; // show confirmed net as positive
                amountPrefix = ''; // show plain number (no leading '+')
            } else {
                // keep legacy behavior for other types
                if (displayAmount >= 0) amountPrefix = '+';
                else amountPrefix = '';
            }

            item.innerHTML = `
                <div class="item-info">
                    <span class="item-title">${tx.type.toUpperCase()}</span>
                    <span class="item-sub">${new Date(tx.date).toLocaleDateString()}</span>
                </div>
                <div class="item-values">
                    <span class="item-main ${amountClass}">
                        ${amountPrefix}${(Math.abs(displayAmount)||0).toFixed(2)}
                    </span>
                    <span class="badge tx-status-${tx.status}">${tx.status}</span>
                </div>
            `;
            txContainer.appendChild(item);
        });

        // navigation controls (only when there's more than one page)
        const totalPages = Math.ceil((txContainer._allTransactions || []).length / PAGE_SIZE);
        if (totalPages > 1) {
            const nav = document.createElement('div');
            nav.style.display = 'flex';
            nav.style.justifyContent = 'center';
            nav.style.marginTop = '10px';
            nav.style.gap = '8px';

            const prev = document.createElement('button');
            prev.className = 'btn-sm btn-outline';
            prev.innerText = 'Precedente';
            prev.disabled = page <= 0;
            prev.onclick = () => {
                txContainer._txPage = Math.max(0, txContainer._txPage - 1);
                renderPage(txContainer._txPage);
            };

            const next = document.createElement('button');
            next.className = 'btn-sm btn-primary';
            next.innerText = 'Mostra altre attività';
            next.disabled = page >= totalPages - 1;
            next.onclick = () => {
                txContainer._txPage = Math.min(totalPages - 1, txContainer._txPage + 1);
                renderPage(txContainer._txPage);
            };

            nav.appendChild(prev);
            nav.appendChild(next);
            txContainer.appendChild(nav);
        }
    };

    // initial render
    renderPage(0);
}

export function renderReferralTeam(user, allUsers = [], allTransactions = []) {
    const container = document.getElementById('referral-team-container');
    const listEl = document.getElementById('referral-team-list');
    if (!container || !listEl) return;

    // Inject career plan header with toggle
    let careerWrap = document.getElementById('career-plan-wrap');
    if (!careerWrap) {
        careerWrap = document.createElement('div');
        careerWrap.id = 'career-plan-wrap';
        careerWrap.style.marginBottom = '12px';
        careerWrap.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;gap:12px">
                <div>
                    <h4 style="margin:0">PIANO CARRIERA CUP-9GPU HOSTING</h4>
                    <div style="font-size:13px;color:var(--text-dim)">Premi e livelli per il programma referral</div>
                </div>
                <div style="display:flex;gap:8px;align-items:center">
                    <button id="toggle-career-plan" class="btn-sm btn-outline">Mostra Piano Carriera</button>
                </div>
            </div>

            <div id="career-plan-panel" class="hidden" style="margin-top:10px;background:rgba(255,255,255,0.02);padding:12px;border-radius:10px;border:1px solid var(--border-color);font-size:13px;line-height:1.4">
                <div style="overflow:auto">
                    <table style="width:100%;border-collapse:collapse;font-size:13px">
                        <thead>
                            <tr style="text-align:left;border-bottom:1px solid var(--border-color)">
                                <th style="padding:10px 8px;color:var(--text-dim);width:12%">Livello</th>
                                <th style="padding:10px 8px;color:var(--text-dim);width:58%">Requisiti</th>
                                <th style="padding:10px 8px;color:var(--text-dim);width:30%">Premio</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td style="padding:10px 8px;font-weight:800">LIVELLO 1</td>
                                <td style="padding:10px 8px;color:var(--text-dim)">Licenza Base attiva (150 USDT); 10 utenti invitati diretti</td>
                                <td style="padding:10px 8px;font-weight:800">$60 (una tantum)</td>
                            </tr>
                            <tr>
                                <td style="padding:10px 8px;font-weight:800">LIVELLO 2</td>
                                <td style="padding:10px 8px;color:var(--text-dim)">10 utenti diretti; Depositi complessivi della rete ≥ 3.000 USDT</td>
                                <td style="padding:10px 8px;font-weight:800">$180 (una tantum)</td>
                            </tr>
                            <tr>
                                <td style="padding:10px 8px;font-weight:800">LIVELLO 3</td>
                                <td style="padding:10px 8px;color:var(--text-dim)">20 utenti totali nella rete; Depositi rete ≥ 6.000 USDT; Potenza GPU rete ≥ 1.000 TFLOPS</td>
                                <td style="padding:10px 8px;font-weight:800">$300 (una tantum)</td>
                            </tr>
                            <tr>
                                <td style="padding:10px 8px;font-weight:800">LIVELLO 4</td>
                                <td style="padding:10px 8px;color:var(--text-dim)">35 utenti totali; Depositi rete ≥ 15.000 USDT; Attività GPU costante</td>
                                <td style="padding:10px 8px;font-weight:800">$500 (una tantum)</td>
                            </tr>
                            <tr>
                                <td style="padding:10px 8px;font-weight:800">LIVELLO 5</td>
                                <td style="padding:10px 8px;color:var(--text-dim)">60 utenti totali; Depositi rete ≥ 30.000 USDT; Uso GPU elevato e continuo</td>
                                <td style="padding:10px 8px;font-weight:800">$1,000 (una tantum)</td>
                            </tr>
                            <tr>
                                <td style="padding:10px 8px;font-weight:800">LIVELLO 6</td>
                                <td style="padding:10px 8px;color:var(--text-dim)">100 utenti totali; Depositi rete ≥ 60.000 USDT; Elevata potenza distribuita</td>
                                <td style="padding:10px 8px;font-weight:800">$2,500 (una tantum)</td>
                            </tr>
                            <tr>
                                <td style="padding:10px 8px;font-weight:800">LIVELLO 7</td>
                                <td style="padding:10px 8px;color:var(--text-dim)">180+ utenti; Depositi rete ≥ 150.000 USDT; Contributo significativo</td>
                                <td style="padding:10px 8px;font-weight:800">$5,000 (una tantum)</td>
                            </tr>
                        </tbody>
                    </table>

                    <div style="margin-top:10px;color:var(--text-dim)"><strong>Regole generali:</strong> Premi una tantum; bonus produzione calcolati sul saldo utente; premi approvati dall'azienda; nessuna commissione sui rendimenti degli invitati; le licenze non garantiscono rendimenti automatici.</div>
                </div>

                <!-- Claim area for licensed users -->
                <div id="career-claims" style="margin-top:12px;border-top:1px dashed var(--border-color);padding-top:12px;display:none">
                    <div style="font-weight:800;margin-bottom:8px">Claim premi (solo utenti con licenza attiva)</div>
                    <div id="career-claims-list" style="display:flex;flex-direction:column;gap:8px"></div>
                </div>
            </div>
        `;
        // insert at top of referral container
        container.insertBefore(careerWrap, container.firstChild);
        const toggleBtn = careerWrap.querySelector('#toggle-career-plan');
        const panel = careerWrap.querySelector('#career-plan-panel');
        const claimsArea = careerWrap.querySelector('#career-claims');
        const claimsList = careerWrap.querySelector('#career-claims-list');

        if (toggleBtn && panel) {
            toggleBtn.onclick = () => {
                if (panel.classList.contains('hidden')) {
                    panel.classList.remove('hidden');
                    toggleBtn.innerText = 'Nascondi Piano Carriera';
                } else {
                    panel.classList.add('hidden');
                    toggleBtn.innerText = 'Mostra Piano Carriera';
                }
            };
        }

        // Build claim UI dynamically if user has referral license
        try {
            if (user && user.hasReferralLicense && claimsArea && claimsList) {
                claimsArea.style.display = 'block';
                // define levels and rewards mapping (keeps in sync with displayed text above)
                const levels = [
                    { id: 1, title: 'PARTNER ATTIVO', reward: 60 },
                    { id: 2, title: 'PARTNER PRODUTTIVO', reward: 180 },
                    { id: 3, title: 'PARTNER COMPUTE', reward: 300 },
                    { id: 4, title: 'NETWORK BUILDER', reward: 500 },
                    { id: 5, title: 'SENIOR PARTNER', reward: 1000 },
                    { id: 6, title: 'LEADER DI RETE', reward: 2500 },
                    { id: 7, title: 'EXECUTIVE PARTNER', reward: 5000 }
                ];

                // render list (one-time)
                claimsList.innerHTML = '';
                levels.forEach(l => {
                    const row = document.createElement('div');
                    row.style.display = 'flex';
                    row.style.justifyContent = 'space-between';
                    row.style.alignItems = 'center';
                    row.style.gap = '8px';
                    row.innerHTML = `
                        <label style="display:flex;align-items:center;gap:8px;flex:1">
                            <input type="checkbox" class="career-claim-checkbox" data-level="${l.id}" />
                            <div style="font-size:13px"><strong>${l.title}</strong> — Premio: $${l.reward}</div>
                        </label>
                        <div style="display:flex;gap:8px;align-items:center">
                            <button class="btn-sm btn-outline career-claim-btn" data-level="${l.id}" data-reward="${l.reward}">Claim</button>
                        </div>
                    `;
                    claimsList.appendChild(row);
                });

                // attach handlers with eligibility checks per level
                claimsList.querySelectorAll('.career-claim-btn').forEach(btn => {
                    btn.onclick = async (ev) => {
                        ev.preventDefault();
                        const level = Number(btn.dataset.level);
                        const reward = Number(btn.dataset.reward || 0);
                        const checkbox = claimsList.querySelector(`.career-claim-checkbox[data-level="${level}"]`);
                        const ui = window.UI || null;

                        // require checkbox tick to avoid accidental claims
                        if (!checkbox || !checkbox.checked) {
                            if (ui && ui.notify) ui.notify('Spunta la casella per confermare il claim', 'error');
                            return;
                        }

                        // compute current achievement metrics from provided data
                        const myRefCount = (user && user.referrals) ? user.referrals.length : 0;
                        // network deposits: sum of deposit transactions across allTransactions
                        const networkDeposits = (allTransactions || []).reduce((s, t) => {
                            if (!t || !t.type) return s;
                            const typ = (t.type || '').toLowerCase();
                            if (typ === 'deposit' || typ === 'deposit_credit') return s + Math.abs(Number(t.amount || 0));
                            return s;
                        }, 0);
                        // network TFLOPS: sum of tflops from allUsers' gpus if present in allTransactions or users (best-effort)
                        // Use users' gpus via API if available (fallback to 0)
                        let networkTFLOPS = 0;
                        try {
                            // try to approximate by summing gpus in global MockData via API.getAllUsers + API.getAllTransactions isn't necessary here,
                            // instead check window.__CUP9_GLOBAL_GPU_CACHE if present
                            if (window.__CUP9_GLOBAL_GPU_CACHE && Array.isArray(window.__CUP9_GLOBAL_GPU_CACHE)) {
                                networkTFLOPS = window.__CUP9_GLOBAL_GPU_CACHE.reduce((s,g)=>s + Number(g.tflops || g.computeTFLOPS || 0), 0);
                            } else {
                                // fallback: estimate from allUsers if they include gpu summaries
                                if (Array.isArray(allUsers)) {
                                    allUsers.forEach(u => {
                                        if (u && u.gpus && Array.isArray(u.gpus)) {
                                            u.gpus.forEach(g => {
                                                networkTFLOPS += Number(g.tflops || g.computeTFLOPS || 0) || 0;
                                            });
                                        }
                                    });
                                }
                            }
                        } catch (e) {
                            networkTFLOPS = 0;
                        }

                        // verify requirements per level (mirror displayed career plan):
                        // Level 1: Licenza Base attiva (hasReferralLicense) && 10 referrals
                        // Level 2: 10 referrals && network deposits >= 3,000
                        // Level 3: 20 total users in network (use allUsers length) && network deposits >= 6,000 && networkTFLOPS >= 1000
                        // Level 4: 35 users && network deposits >= 15,000
                        // Level 5: 60 users && network deposits >= 30,000
                        // Level 6: 100 users && network deposits >= 60,000
                        // Level 7: 180 users && network deposits >= 150,000

                        const totalNetworkUsers = Array.isArray(allUsers) ? allUsers.length : 0;
                        const hasLicense = !!(user && user.hasReferralLicense);

                        let eligible = false;
                        let reason = '';

                        switch (level) {
                            case 1:
                                if (hasLicense && myRefCount >= 10) eligible = true;
                                else reason = 'Serve Licenza attiva e almeno 10 invitati diretti.';
                                break;
                            case 2:
                                if (myRefCount >= 10 && networkDeposits >= 3000) eligible = true;
                                else reason = 'Serve 10 invitati diretti e Depositi rete ≥ 3.000 USDT.';
                                break;
                            case 3:
                                if (totalNetworkUsers >= 20 && networkDeposits >= 6000 && networkTFLOPS >= 1000) eligible = true;
                                else reason = 'Serve 20 utenti, Depositi rete ≥ 6.000 USDT e Potenza rete ≥ 1.000 TFLOPS.';
                                break;
                            case 4:
                                if (totalNetworkUsers >= 35 && networkDeposits >= 15000) eligible = true;
                                else reason = 'Serve 35 utenti e Depositi rete ≥ 15.000 USDT.';
                                break;
                            case 5:
                                if (totalNetworkUsers >= 60 && networkDeposits >= 30000) eligible = true;
                                else reason = 'Serve 60 utenti e Depositi rete ≥ 30.000 USDT.';
                                break;
                            case 6:
                                if (totalNetworkUsers >= 100 && networkDeposits >= 60000) eligible = true;
                                else reason = 'Serve 100 utenti e Depositi rete ≥ 60.000 USDT.';
                                break;
                            case 7:
                                if (totalNetworkUsers >= 180 && networkDeposits >= 150000) eligible = true;
                                else reason = 'Serve 180+ utenti e Depositi rete ≥ 150.000 USDT.';
                                break;
                            default:
                                reason = 'Livello non riconosciuto';
                        }

                        if (!eligible) {
                            if (ui && ui.notify) ui.notify(`Non idoneo: ${reason}`, 'error');
                            return;
                        }

                        // proceed to create transaction claim
                        const token = (Auth && Auth.getToken) ? Auth.getToken() : null;
                        if (!token) {
                            if (ui && ui.notify) ui.notify('Non autenticato', 'error');
                            return;
                        }

                        // disable button to avoid double clicks
                        btn.disabled = true;
                        btn.innerText = 'Processing...';

                        try {
                            const res = await API.createTransaction(token, 'career_reward', reward, { level: Number(level), note: `Career reward level ${level}` });
                            if (res && res.success) {
                                if (ui && ui.notify) ui.notify(`Premio livello ${level} richiesto: $${reward}`, 'success');
                                // mark claimed UI
                                checkbox.checked = false;
                                checkbox.disabled = true;
                                btn.innerText = 'Claimed';
                                btn.classList.remove('btn-outline');
                                btn.classList.add('btn-success');
                                // attempt to refresh profile data if refresh function available on UI
                                if (typeof window.refreshData === 'function') window.refreshData();
                            } else {
                                if (ui && ui.notify) ui.notify(res && res.error ? res.error : 'Claim fallito', 'error');
                                btn.disabled = false;
                                btn.innerText = 'Claim';
                            }
                        } catch (err) {
                            console.error(err);
                            if (ui && ui.notify) ui.notify('Errore durante il claim', 'error');
                            btn.disabled = false;
                            btn.innerText = 'Claim';
                        }
                    };
                });
            } else if (claimsArea) {
                // not licensed: show a short hint
                claimsList.innerHTML = `<div style="font-size:13px;color:var(--text-dim)">Devi possedere una Licenza Partner per poter reclamare i premi della carriera.</div>`;
                claimsArea.style.display = 'block';
            }
        } catch (e) {
            console.warn('Could not initialize career claims UI', e);
        }
    }

    listEl.innerHTML = '';
    const referrals = (user && user.referrals) ? user.referrals : [];

    if (!referrals.length) {
        listEl.innerHTML = '<div class="empty-state">Non hai membri del team ancora.</div>';
    } else {
        // Build transaction index by userId for quick summaries
        const txByUser = {};
        (allTransactions || []).forEach(tx => {
            if (!tx || !tx.userId) return;
            txByUser[tx.userId] = txByUser[tx.userId] || [];
            txByUser[tx.userId].push(tx);
        });

        referrals.forEach(id => {
            const member = allUsers.find(u => u.id === id) || { id, email: 'unknown@user.local', balance: 0, status: 'unknown' };
            const memberTx = txByUser[id] || [];

            // compute totals: purchases (acquisto), deposits, earnings (cycle_payout)
            let purchasesTotal = 0, depositsTotal = 0, earningsTotal = 0;
            memberTx.forEach(t => {
                const typ = (t.type || '').toLowerCase();
                if (typ.includes('acquisto') || typ === 'acquisto') purchasesTotal += Math.abs(t.amount || 0);
                if (typ === 'deposit') depositsTotal += Math.abs(t.amount || 0);
                if (typ === 'cycle_payout' || typ === 'payout' || typ === 'earning' ) earningsTotal += (t.amount || 0);
                // also treat generic positive completed txs as earnings
                if (t.status === 'completed' && t.amount > 0 && !['deposit','cycle_payout'].includes(typ)) earningsTotal += t.amount;
            });

            const item = document.createElement('div');
            item.className = 'list-item';
            item.innerHTML = `
                <div style="flex:1">
                    <div class="item-info">
                        <span class="item-title">${member.email}</span>
                        <span class="item-sub">ID: ${member.id}</span>
                    </div>
                    <div style="display:flex;gap:12px;margin-top:8px;flex-wrap:wrap">
                        <div style="font-size:13px;color:var(--text-dim)"><strong>Acquisti:</strong> $${purchasesTotal.toFixed(2)}</div>
                        <div style="font-size:13px;color:var(--text-dim)"><strong>Depositi:</strong> $${depositsTotal.toFixed(2)}</div>
                        <div style="font-size:13px;color:var(--text-dim)"><strong>Guadagni:</strong> $${earningsTotal.toFixed(2)}</div>
                    </div>
                </div>
                <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px">
                    <div class="item-main">$${(member.balance||0).toFixed(2)}</div>
                    <span class="badge status-${member.status || 'unknown'}">${member.status || 'unknown'}</span>
                </div>
            `;
            listEl.appendChild(item);
        });
    }

    container.classList.remove('hidden');

    const backBtn = document.getElementById('referral-back-btn');
    if (backBtn) backBtn.onclick = () => container.classList.add('hidden');
    const inviteBtn = document.getElementById('referral-invite-btn');
    if (inviteBtn) inviteBtn.onclick = () => {
        const code = document.getElementById('referral-code')?.innerText || '';
        if (!code) {
            const ui = window.UI || null;
            if (ui && ui.notify) ui.notify('Referral code not available', 'error');
            return;
        }
        const base = window.baseUrl || (window.location.origin + window.location.pathname);
        const link = `${base}?ref=${encodeURIComponent(code)}`;
        navigator.clipboard.writeText(link).then(() => {
            const ui = window.UI || null;
            if (ui && ui.notify) ui.notify('Referral link copiato negli appunti');
        }).catch(() => {
            const ui = window.UI || null;
            if (ui && ui.notify) ui.notify('Impossibile copiare il link', 'error');
        });
    };

    const profileTab = document.getElementById('profile-tab');
    if (profileTab) profileTab.scrollTop = container.offsetTop - 20;
}