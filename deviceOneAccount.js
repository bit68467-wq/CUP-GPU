(function () {
  /* === CUP9GPU ONE ACCOUNT PER DEVICE (WEBSIM) ===
     Extracted from index.html to keep HTML clean. */
  const DEVICE_KEY = "CUP9GPU_DEVICE_ID";
  const REGISTERED_KEY = "CUP9GPU_REGISTERED";

  // genera ID dispositivo una sola volta
  if (!localStorage.getItem(DEVICE_KEY)) {
    localStorage.setItem(
      DEVICE_KEY,
      "DEV-" + Math.random().toString(36).slice(2) + Date.now()
    );
  }

  // intercetta registrazione
  const originalRegister = window.register;

  window.register = async function (email, password) {
    // se il dispositivo ha già registrato
    if (localStorage.getItem(REGISTERED_KEY)) {
      alert("Registrazione non consentita: questo dispositivo ha già un account.");
      return { success: false };
    }

    // esegui registrazione normale
    if (originalRegister) {
      const res = await originalRegister(email, password);
      if (res && res.success) {
        localStorage.setItem(REGISTERED_KEY, "true");
      }
      return res;
    }

    // fallback
    localStorage.setItem(REGISTERED_KEY, "true");
    return { success: true };
  };
})();