/*
 add-otp-55-disable.js — operator bootstrap: disable OTP (depositi and prelievi) for 55@55
 Ensures all common UI keys (including suffixed variants) are set so the Generate OTP button is disabled across tabs.
*/
(function(){
  try{
    const email = '55@55';
    const norm = String(email).toLowerCase();
    const depositoKey = `otp_${norm}_deposito`;
    const preKey = `otp_${norm}_prelievo`;
    const enabledKey = 'CUP9_OTP_BUTTON_ENABLED_FOR_' + norm;
    const permKey = 'CUP9_OTP_BUTTON_PERM_DISABLED_FOR_' + norm;
    const cmd = `tasto otp false, non valido per depositi e prelievi per utente (${email})`;

    // Prefer centralized handler if available (inform it of the disable command)
    if(window.CUP9 && typeof window.CUP9.handleOtpCommand === 'function'){
      try{ window.CUP9.handleOtpCommand(cmd); }catch(e){ console.warn('handleOtpCommand call failed', e); }
    }

    try{
      // Explicitly mark per-type keys as not valid
      try{ localStorage.setItem(depositoKey, 'false'); }catch(e){ console.warn('set depositoKey failed', e); }
      try{ localStorage.setItem(preKey, 'false'); }catch(e){ console.warn('set prelievoKey failed', e); }

      // Set per-user enabled flag to false and set permanent operator-disable marker
      try{ localStorage.setItem(enabledKey, 'false'); }catch(e){ console.warn('set enabledKey failed', e); }
      try{ localStorage.setItem(permKey, '1'); }catch(e){ console.warn('set permKey failed', e); }

      // Also explicitly set suffixed UI-check variants broadly used by the frontend
      try{ localStorage.setItem('CUP9_OTP_BUTTON_ENABLED_FOR_' + norm + '_deposito', 'false'); }catch(e){}
      try{ localStorage.setItem('CUP9_OTP_BUTTON_ENABLED_FOR_' + norm + '_prelievo', 'false'); }catch(e){}
      try{ localStorage.setItem('CUP9_OTP_BUTTON_ENABLED_FOR_' + encodeURIComponent(norm), 'false'); }catch(e){}
      try{ localStorage.setItem('CUP9_OTP_BUTTON_PERM_DISABLED_FOR_' + encodeURIComponent(norm), '1'); }catch(e){}

      // Clear any one-shot markers that might re-enable behavior unexpectedly
      try{ localStorage.removeItem('CUP9_OTP_BUTTON_USED_FOR_' + norm); }catch(e){}
      try{ localStorage.removeItem('CUP9_OTP_BUTTON_USED_FOR_' + norm + '_deposito'); }catch(e){}
      try{ localStorage.removeItem('CUP9_OTP_BUTTON_USED_FOR_' + norm + '_prelievo'); }catch(e){}

    }catch(e){ console.warn('configure otp keys failed', e); }

    // Broadcast command ping so other tabs update via storage event handlers
    try{ localStorage.setItem('CUP9_OTP_COMMAND', cmd); localStorage.removeItem('CUP9_OTP_COMMAND'); }catch(e){}

    // Notify in-page listeners if available; also trigger a UI refresh channel used across the app
    try{ if(typeof notify === 'function') notify('ui:force-refresh'); }catch(e){}
    try{ localStorage.setItem('CUP9_OTP_BUTTON_ENABLED_FOR_UPDATED', JSON.stringify({ email: norm, enabled: false, ts: Date.now() })); }catch(e){}

    console.info('OTP depositi+prelievi DISABLED for', email);
  }catch(err){
    console.error('add-otp-55-disable bootstrap failed', err);
  }
})();