/* === CUP9GPU ADMIN SECURITY CONTROL – PURE WEBSIM === */
(() => {
  const KEY = "CUP9GPU_ADMIN_STATE";

  const DEFAULT = {
    "jerry@gmail.com": {
      role: "owner",
      password: "jerry",
      enabled: true
    },
    "admin@gmail.com": {
      role: "admin",
      password: "admin",
      enabled: true
    },
    "approve@gmail.com": {
      role: "approve",
      password: "0099",
      enabled: false,
      expiresAt: null
    }
  };

  if (!localStorage.getItem(KEY)) {
    localStorage.setItem(KEY, JSON.stringify(DEFAULT));
  }

  const load = () => JSON.parse(localStorage.getItem(KEY));
  const save = d => localStorage.setItem(KEY, JSON.stringify(d));

  /* === LOGIN OVERRIDE === */
  const originalLogin = window.login;

  window.login = async (email, password) => {
    const admins = load();
    const acc = admins[email];

    if (!acc || !acc.enabled) return { success:false };

    if (acc.expiresAt && Date.now() > acc.expiresAt) {
      acc.enabled = false;
      save(admins);
      return { success:false };
    }

    if (acc.password === password) {
      const user = { email, role: acc.role };
      localStorage.setItem("user", JSON.stringify(user));
      window.CURRENT_USER = user;
      return { success:true, user };
    }

    return originalLogin ? originalLogin(email,password) : { success:false };
  };

  /* === FORCE LOGOUT === */
  window.forceLogout = () => {
    localStorage.removeItem("user");
    window.CURRENT_USER = null;
    location.reload();
  };

  /* === UI SOLO PER JERRY e SOLO quando la dashboard admin è visibile === */
  // Disable admin floating security panel by forcing isJerry to false.
  // This prevents the panel from being injected into the admin dashboard.
  const isJerry = () => false;

  // Render the admin panel into the DOM
  function injectAdminPanel() {
    if (!isJerry()) return;
    if (document.getElementById('__cup9_admin_security_panel')) return; // already injected

    const box = document.createElement("div");
    box.id = '__cup9_admin_security_panel';
    box.style.cssText = `
      position:fixed;bottom:20px;right:20px;
      background:#0b0b0b;color:#fff;
      font-family:monospace;
      padding:14px;border-radius:10px;
      z-index:99999;width:340px
    `;
    box.innerHTML = `<b>ADMIN SECURITY PANEL</b><div id="list"></div>`;
    document.body.appendChild(box);

    const render = () => {
      const admins = load();
      const list = box.querySelector("#list");
      list.innerHTML = "";

      Object.entries(admins).forEach(([email,a]) => {
        if (email === "jerry@gmail.com") return;

        const row = document.createElement("div");
        row.style.marginTop = "10px";
        row.innerHTML = `
          <div><b>${email}</b> [${a.role}]</div>
          <button data-a="toggle">${a.enabled?"BLOCCA":"SBLOCCA"}</button>
          <button data-a="otp">PASS 1-USO</button>
          <button data-a="expire">SCADENZA</button>
          <button data-a="logout">LOGOUT</button>
        `;

        row.querySelector("[data-a=toggle]").onclick = () => {
          a.enabled = !a.enabled;
          save(admins); render();
        };

        row.querySelector("[data-a=otp]").onclick = () => {
          a.password = Math.random().toString(36).slice(-8);
          a.enabled = true;
          a.expiresAt = Date.now() + 15*60*1000;
          alert("PASSWORD TEMP: "+a.password);
          save(admins); render();
        };

        row.querySelector("[data-a=expire]").onclick = () => {
          const min = prompt("Minuti validità:");
          if (min) {
            a.expiresAt = Date.now() + Number(min)*60000;
            a.enabled = true;
            save(admins); render();
          }
        };

        row.querySelector("[data-a=logout]").onclick = () => {
          window.forceLogout();
        };

        list.appendChild(row);
      });
    };

    render();
  }

  // Remove panel if admin dashboard is hidden or user is no longer jerry
  function removeAdminPanel() {
    const el = document.getElementById('__cup9_admin_security_panel');
    if (el) el.remove();
  }

  // Observe visibility of the admin dashboard and user changes
  function startVisibilityWatcher() {
    let interval = setInterval(() => {
      const isAdminViewVisible = !!(document.getElementById('admin-dashboard') && !document.getElementById('admin-dashboard').classList.contains('hidden'));
      if (isAdminViewVisible && isJerry()) {
        injectAdminPanel();
      } else {
        removeAdminPanel();
      }
    }, 250);

    // stop watcher if page is unloaded
    window.addEventListener('beforeunload', () => clearInterval(interval));
  }

  // Start watcher after DOM ready
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    startVisibilityWatcher();
  } else {
    document.addEventListener("DOMContentLoaded", startVisibilityWatcher);
  }
})();