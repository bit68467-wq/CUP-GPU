/* === CUP9GPU GLOBAL DEVICE REGISTRATION LOCK (FINAL) === */
(() => {
  const DEVICE_KEY = "CUP9GPU_DEVICE_ID";
  const REGISTERED_KEY = "CUP9GPU_DEVICE_REGISTERED";

  // ID dispositivo persistente
  if (!localStorage.getItem(DEVICE_KEY)) {
    localStorage.setItem(
      DEVICE_KEY,
      "DEV-" + Math.random().toString(36).slice(2) + Date.now()
    );
  }

  const originalFetch = window.fetch;

  window.fetch = async function(url, options = {}) {
    const method = (options.method || "GET").toUpperCase();

    // intercetta QUALSIASI tentativo di registrazione
    if (method === "POST" && options.body) {
      let bodyText = "";
      try { bodyText = options.body.toString(); } catch {}

      const looksLikeRegister =
        bodyText.includes("email") &&
        bodyText.includes("password") &&
        !bodyText.includes("login");

      if (looksLikeRegister) {
        // se il dispositivo ha già registrato
        if (localStorage.getItem(REGISTERED_KEY)) {
          return new Response(
            JSON.stringify({
              success: false,
              error: "Questo dispositivo ha già registrato un account"
            }),
            { status: 403, headers: { "Content-Type": "application/json" } }
          );
        }

        // prima registrazione consentita
        const res = await originalFetch(url, options);

        try {
          const data = await res.clone().json();
          if (data && data.success) {
            localStorage.setItem(REGISTERED_KEY, "true");
          }
        } catch {}

        return res;
      }
    }

    return originalFetch(url, options);
  };
})();