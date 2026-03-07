/* === CUP9GPU INVITE CODE TRACKING (WEBSIM ONLY) === */
(() => {
  const INVITE_KEY = "CUP9GPU_INVITE_CODE";
  const STATS_KEY  = "CUP9GPU_INVITE_STATS";

  const params = new URLSearchParams(location.search);
  const ref = params.get("ref");
  if (ref && !localStorage.getItem(INVITE_KEY)) {
    localStorage.setItem(INVITE_KEY, ref);
  }

  if (!localStorage.getItem(STATS_KEY)) {
    localStorage.setItem(STATS_KEY, JSON.stringify({}));
  }

  const loadStats = () => JSON.parse(localStorage.getItem(STATS_KEY));
  const saveStats = d => localStorage.setItem(STATS_KEY, JSON.stringify(d));

  function attachRegisterHook() {
    if (typeof window.register !== "function") return;

    const originalRegister = window.register;
    window.register = async function(email, password) {
      const invite = localStorage.getItem(INVITE_KEY);
      const result = await originalRegister(email, password);

      if (result?.success && invite) {
        const stats = loadStats();
        stats[invite] = (stats[invite] || 0) + 1;
        saveStats(stats);

        const u = JSON.parse(localStorage.getItem("user") || "{}");
        u.inviteCode = invite;
        localStorage.setItem("user", JSON.stringify(u));
      }
      return result;
    };
  }

  const i = setInterval(() => {
    if (typeof window.register === "function") {
      clearInterval(i);
      attachRegisterHook();
    }
  }, 200);

  window.CUP9GPU_INVITES = {
    getStats: () => loadStats(),
    getMyInvite: () => {
      try { return JSON.parse(localStorage.getItem("user"))?.inviteCode || null; }
      catch { return null; }
    }
  };
})();