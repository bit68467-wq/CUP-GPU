/**
 * depositModal.js - extracted deposit modal logic (moved out of modals.js for clarity)
 */
import { Auth } from './auth.js';
import { UI } from './ui.js';
import { API } from './api.js';

export async function showDepositModal() {
    const container = document.getElementById('modal-container');
    const title = document.getElementById('modal-title');
    const body = document.getElementById('modal-body');
    const confirmBtn = document.getElementById('modal-action');
    const closeBtn = document.getElementById('modal-close');

    confirmBtn.disabled = false;

    title.innerText = 'Deposit (USDT)';
    body.innerHTML = `
        <div id="deposit-step-1">
            <div class="input-group">
                <i class="fas fa-dollar-sign"></i>
                <input type="number" id="modal-amount" placeholder="Amount (USDT)" step="0.01">
            </div>
            <div class="input-group">
                <i class="fas fa-network-wired"></i>
                <select id="modal-network">
                    <option value="BEP20">BEP20 (BNB - BSC)</option>
                    <option value="BTC">BTC</option>
                    <option value="TRC20">TRC20 (TRON)</option>
                </select>
            </div>
            <p style="font-size:12px; color:var(--text-dim)">Enter the amount and choose the network to generate a deposit address. After generating the address, you'll enter the TxHash you used and upload proof; the admin must enter the same TxHash to confirm the deposit.</p>
        </div>

        <div id="deposit-step-2" class="hidden">
            <h4>Send USDT to the address below</h4>
            <div id="generated-address" style="word-break:break-all; background:rgba(255,255,255,0.02); padding:12px; border-radius:8px; border:1px solid var(--border-color)"></div>
            <div style="margin-top:10px; display:flex; gap:8px;">
                <button id="copy-address" class="btn-sm btn-outline">Copy</button>
                <button id="download-qr" class="btn-sm btn-secondary">Download QR</button>
            </div>
            <p style="font-size:12px; color:var(--text-dim); margin-top:10px">After sending funds, enter the TxHash you obtained from the blockchain and upload a screenshot or transaction proof.</p>

            <div style="margin-top:12px;">
                <div class="input-group">
                    <i class="fas fa-hashtag"></i>
                    <input type="text" id="modal-user-txhash" placeholder="Your TxHash (transaction id) - inserire TxHash">
                </div>
                <input type="file" id="proof-file" accept="image/*,application/pdf" />
            </div>
        </div>
    `;

    container.classList.remove('hidden');

    const NETWORK_ADDRESS_MAP = {
        'BEP20': '0x2859d146Dc8e4cB332736986feE9D32B641fbde8',
        'BNB':   '0x2859d146Dc8e4cB332736986feE9D32B641fbde8',
        'BTC':   'bc1par0exs9cyw9w53xsceyh6wzl7f43gdjn6xsq0kyq4qsqsvr2uynqf5llc6',
        'TRC20': 'TYQgWx4eQ6Js94UMexfyLXbqNE4Fucfg7Y'
    };

    const generateFallbackAddress = (network) => {
        const uid = (Auth.getUser() && Auth.getUser().id) || 'guest';
        const seed = `${uid}-${network}-${Date.now()}`;
        return `${network.slice(0,4)}_${Math.abs(hashCode(seed)).toString(36).toUpperCase().slice(0,24)}`;
    };

    const generateAddress = (network) => {
        const key = (network || '').toUpperCase();
        if (NETWORK_ADDRESS_MAP[key]) return NETWORK_ADDRESS_MAP[key];
        if (key.startsWith('ERC') || key === 'SOL' || key === 'ETH') return generateFallbackAddress(network);
        return generateFallbackAddress(network);
    };

    function hashCode(str) {
        let h = 0;
        for (let i = 0; i < str.length; i++) {
            h = (h << 5) - h + str.charCodeAt(i);
            h |= 0;
        }
        return h;
    }

    // Step navigation
    confirmBtn.innerText = 'Generate Address';

    // helper to build submission handler (used after generation)
    const attachSubmitHandler = () => {
        confirmBtn.onclick = async () => {
            if (!confirmBtn.dataset.generatedAddress) return UI.notify('Generate an address first', 'error');
            const addr = confirmBtn.dataset.generatedAddress;
            const network = confirmBtn.dataset.network;
            // For ledger consistency use the total required to send as tx amount (including fee)
            const amount = parseFloat(confirmBtn.dataset.amount);
            const requested = parseFloat(confirmBtn.dataset.requestedAmount) || amount;
            const fee = parseFloat(confirmBtn.dataset.fee) || 0;

            const userTxHashEl = document.getElementById('modal-user-txhash') || {};
            const userTxHash = (userTxHashEl.value || '').trim();
            if (!userTxHash) return UI.notify('Inserire il TxHash usato per il pagamento', 'error');

            // NOTE: per requisito di prodotto non applichiamo qui una convalida rigorosa del formato
            // (accettiamo TxHash liberi con lunghezza comune: 64 o 66 caratteri). Salviamo semplicemente
            // il valore come riferimento nella richiesta di deposito.
            if (!(userTxHash.length === 64 || userTxHash.length === 66)) {
                // non blocchiamo l'invio: mostriamo solo un avviso informativo ma permettiamo comunque il proseguimento
                UI.notify('Avviso: TxHash non in formato tipico (64/66 caratteri); verrà comunque salvato come riferimento', 'success');
            }

            const fileInput = document.getElementById('proof-file');
            const files = fileInput && fileInput.files ? Array.from(fileInput.files) : [];

            if (!files.length) return UI.notify('Please upload at least one proof image or file', 'error');

            UI.setLoading(true);

            // upload all files (use websim.upload when available; fallback to object URLs)
            const uploaded = [];
            try {
                for (const f of files) {
                    if (window.websim && window.websim.upload) {
                        uploaded.push(await window.websim.upload(f));
                    } else {
                        uploaded.push(URL.createObjectURL(f));
                    }
                }
            } catch (err) {
                console.error(err);
                UI.setLoading(false);
                return UI.notify('One or more uploads failed', 'error');
            }

            const metadata = {
                network,
                destinationAddress: addr,
                proofUrls: uploaded,
                currency: 'USDT',
                requestedAmount: requested,
                fee: fee,
                userTxHash: String(userTxHash)
            };

            const res = await API.createTransaction(Auth.getToken(), 'deposit', amount, metadata);
            UI.setLoading(false);
            if (res && res.success) {
                // persist used txhash locally to prevent reuse from the client side
                try {
                    const usedRaw = localStorage.getItem('CUP9_USED_DEPOSIT_TXHASHES');
                    const used = usedRaw ? JSON.parse(usedRaw) : [];
                    used.push(String(userTxHash));
                    localStorage.setItem('CUP9_USED_DEPOSIT_TXHASHES', JSON.stringify(Array.from(new Set(used))));
                } catch (e) {
                    console.warn('Could not save used txhash locally', e);
                }

                UI.notify('Deposit request submitted. Admin will verify the proof and TxHash.');
                container.classList.add('hidden');
            } else {
                UI.notify(res && res.error ? res.error : 'Error submitting deposit', 'error');
            }
        };
    };

    // initial generate action (adds fixed deposit commission of 2.5 USDT)
    confirmBtn.onclick = async () => {
        const amount = parseFloat(document.getElementById('modal-amount').value);
        const network = document.getElementById('modal-network').value;
        if (!amount || amount <= 0) return UI.notify('Invalid amount', 'error');

        const FEE = 2.5; // fixed deposit commission
        const totalToSend = parseFloat((amount + FEE).toFixed(8)); // keep precision for crypto

        const addr = generateAddress(network);
        // Ensure BNB/BEP20 deposit addresses are displayed with explicit USDT scheme label,
        // while QR and clipboard use the raw address value for compatibility.
        const addrRaw = addr;
        const displayAddr = (network.toUpperCase() === 'BEP20' || network.toUpperCase() === 'BNB')
            ? `usdt : ${addrRaw}`
            : addrRaw;

        // show breakdown: original desired credit and total required to send (fee hidden)
        document.getElementById('generated-address').innerHTML = `
            <div style="display:flex;flex-direction:column;gap:6px">
                <div style="word-break:break-all;font-weight:700;color:var(--text-color)">${displayAddr}</div>
                <div style="color:var(--text-dim)">Network: <strong style="color:var(--text-color)">${network}</strong></div>
                <div style="color:var(--text-dim)">Importo richiesto (netto): <strong style="color:var(--text-color)">${amount.toFixed(2)} USDT</strong></div>
                <div style="margin-top:6px;padding:10px;border-radius:8px;background:rgba(255,255,255,0.03);border:1px solid var(--border-color);display:flex;justify-content:space-between;align-items:center">
                    <div style="font-size:13px;color:var(--text-dim)">Totale da inviare</div>
                    <div style="font-weight:900;color:var(--primary-color);font-size:16px">${totalToSend.toFixed(8)} USDT</div>
                </div>
            </div>
        `;

        const qrText = encodeURIComponent(`usdt:${addrRaw}?amount=${totalToSend}&network=${network}`);
        const qrImgUrl = `https://chart.googleapis.com/chart?cht=qr&chs=200x200&chl=${qrText}`;
        const img = document.createElement('img');
        img.src = qrImgUrl;
        img.alt = 'QR';
        img.style.width = '120px';
        img.style.height = '120px';
        img.style.marginTop = '10px';
        const genAddrEl = document.getElementById('generated-address');
        if (!document.getElementById('deposit-qr')) {
            const wrapper = document.createElement('div');
            wrapper.id = 'deposit-qr';
            wrapper.style.marginTop = '10px';
            wrapper.appendChild(img);
            genAddrEl.parentElement.insertBefore(wrapper, genAddrEl.nextSibling);
        } else {
            document.getElementById('deposit-qr').querySelector('img').src = qrImgUrl;
        }

        document.getElementById('copy-address').onclick = () => {
            navigator.clipboard.writeText(addrRaw).then(() => UI.notify('Address copied'));
        };
        document.getElementById('download-qr').onclick = () => {
            const a = document.createElement('a');
            a.href = qrImgUrl;
            a.download = `CUP9-deposit-${network}.png`;
            document.body.appendChild(a);
            a.click();
            a.remove();
        };

        // ensure the proof-file input accepts multiple and show preview area
        const proofInput = document.getElementById('proof-file');
        proofInput.setAttribute('multiple', 'multiple');
        proofInput.addEventListener('change', () => {
            const previewWrapId = 'proof-previews';
            let previewWrap = document.getElementById(previewWrapId);
            if (!previewWrap) {
                previewWrap = document.createElement('div');
                previewWrap.id = previewWrapId;
                previewWrap.style.display = 'flex';
                previewWrap.style.gap = '8px';
                previewWrap.style.marginTop = '10px';
                previewWrap.style.flexWrap = 'wrap';
                const step2 = document.getElementById('deposit-step-2');
                step2.appendChild(previewWrap);
            }
            previewWrap.innerHTML = '';
            const files = proofInput.files ? Array.from(proofInput.files) : [];
            files.forEach(f => {
                const item = document.createElement('div');
                item.style.width = '72px';
                item.style.height = '72px';
                item.style.border = '1px solid var(--border-color)';
                item.style.borderRadius = '8px';
                item.style.overflow = 'hidden';
                item.style.display = 'flex';
                item.style.alignItems = 'center';
                item.style.justifyContent = 'center';
                item.style.background = 'rgba(255,255,255,0.02)';
                if (f.type.startsWith('image/')) {
                    const im = document.createElement('img');
                    im.src = URL.createObjectURL(f);
                    im.style.width = '100%';
                    im.style.height = '100%';
                    im.style.objectFit = 'cover';
                    item.appendChild(im);
                } else {
                    const ic = document.createElement('div');
                    ic.innerText = f.name.slice(0,10) + (f.name.length>10?'...':'');
                    ic.style.fontSize = '11px';
                    ic.style.color = 'var(--text-dim)';
                    ic.style.textAlign = 'center';
                    item.appendChild(ic);
                }
                previewWrap.appendChild(item);
            });
        });

        // reveal step 2 where user enters TxHash and proof
        document.getElementById('deposit-step-1').classList.add('hidden');
        document.getElementById('deposit-step-2').classList.remove('hidden');

        // update confirm button to submission mode and store dataset values
        confirmBtn.innerText = 'Submit Deposit Request';
        confirmBtn.dataset.generatedAddress = addr;
        confirmBtn.dataset.amount = totalToSend;
        confirmBtn.dataset.requestedAmount = amount;
        confirmBtn.dataset.fee = FEE;
        confirmBtn.dataset.network = network;

        // swap to submission handler
        attachSubmitHandler();
    };

    closeBtn.onclick = () => {
        container.classList.add('hidden');
        confirmBtn.dataset.generatedAddress = '';
        confirmBtn.dataset.amount = '';
        confirmBtn.dataset.network = '';
        confirmBtn.innerText = 'Confirm';
    };
}