/* === CUP9GPU TOKEN ADMIN LOGIN (WEBSIM ONLY) === */
(() => {
  const TOKEN_KEY = "CUP9GPU_ADMIN_TOKEN";

  // TOKEN ATTIVI (puoi cambiarli quando vuoi)
  const TOKENS = {
    "jwt-admin-0-aoq5zztaj7w": { email: "approve@gmail.com", role: "approve" },
    "jwt-admin-full-123":     { email: "admin@gmail.com", role: "admin" }
  };

  // 1️⃣ Legge token da URL
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");

  if (token && TOKENS[token]) {
    const user = TOKENS[token];
    localStorage.setItem("user", JSON.stringify(user));
    localStorage.setItem(TOKEN_KEY, token);

    // pulisce URL
    history.replaceState({}, "", location.pathname);

    location.reload();
    return;
  }

  // 2️⃣ Ripristino sessione da token salvato
  const savedToken = localStorage.getItem(TOKEN_KEY);
  if (savedToken && TOKENS[savedToken]) {
    window.CURRENT_USER = TOKENS[savedToken];
  }

  // 3️⃣ Logout forzato
  window.logoutAdmin = function () {
    localStorage.removeItem("user");
    localStorage.removeItem(TOKEN_KEY);
    location.reload();
  };
})();