/* Auto-login helper: restore saved localStorage users & tokens into mock DB sessions mapping
   while ensuring per-device isolation by only attaching tokens that clearly belong to the current device.
   This respects the persistent device id stored under CUP9GPU_DEVICE_ID and avoids mapping tokens
   harvested from other devices' localStorage keys.
*/
(function(){
  try {
    const safeParse = (s) => { try { return JSON.parse(s); } catch (e) { return null; } };

    // Device identifier used across the app to mark device-scoped keys
    const DEVICE_KEY = 'CUP9GPU_DEVICE_ID';
    const deviceId = localStorage.getItem(DEVICE_KEY) || null;

    // helper to check whether a localStorage key/value appears to belong to this device
    function appearsLocalToThisDevice(key, value) {
      if (!deviceId) return false; // if no device id, be conservative and avoid guessing
      try {
        // If the key name contains the device id, treat as local
        if (key && key.indexOf(deviceId) !== -1) return true;
        // If the stored JSON value references the device id, treat as local
        const parsed = safeParse(value);
        if (parsed) {
          if (parsed.deviceId && String(parsed.deviceId) === String(deviceId)) return true;
          // sometimes token wrappers include an owner email; prefer mapping only when email matches current 'user' object
        }
        // also allow explicit primary keys that are single-device by design
        if (key === 'CUP9_SESSION_TOKEN' || key === 'user' || key === 'CUP9GPU_REGISTERED' || key === 'CUP9GPU_INVITE_CODE') {
          return true;
        }
      } catch (e) { /* ignore */ }
      return false;
    }

    // collect tokens but only from keys/values that appear local to this device
    const discoveredTokens = new Set();
    const mainToken = localStorage.getItem('CUP9_SESSION_TOKEN');
    if (mainToken) discoveredTokens.add(mainToken);

    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      const v = localStorage.getItem(k);
      if (!k || !v) continue;

      // prefer device-scoped entries only
      if (!appearsLocalToThisDevice(k, v)) continue;

      if (/token/i.test(k) && typeof v === 'string' && v.length > 8) discoveredTokens.add(v);
      if (/^jwt-/.test(v) || /^tg-jwt-/.test(v) || /^jwt-admin-/.test(v)) discoveredTokens.add(v);
    }

    // Gather user objects present on this device (only from device-local keys)
    const localUsers = [];
    const rawUser = localStorage.getItem('user');
    if (rawUser && appearsLocalToThisDevice('user', rawUser)) {
      const parsed = safeParse(rawUser);
      if (parsed && parsed.email) localUsers.push(parsed);
    }

    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (!appearsLocalToThisDevice(k, localStorage.getItem(k))) continue;
      if (k === 'CUP9_GPU_DB') continue;
      const maybe = safeParse(localStorage.getItem(k));
      if (maybe && (maybe.email || maybe.id)) localUsers.push(maybe);
    }

    // If still no local users found, do not attempt to guess global users; bail gracefully
    if (!localUsers.length) {
      // do not seed a default admin here to avoid leaking sessions across devices
      // leave current state as-is and exit early
      return;
    }

    // Load or create minimal DB and attach sessions only for tokens originating from this device
    const dbRaw = localStorage.getItem('CUP9_GPU_DB');
    if (dbRaw) {
      try {
        const db = safeParse(dbRaw) || {};
        db.sessions = db.sessions || {};

        const usersList = db.users || [];

        // For each discovered token (device-local), attempt to map to the best matching user in DB
        Array.from(discoveredTokens).forEach(t => {
          if (db.sessions && db.sessions[t]) return; // preserve existing mappings

          // Prefer mapping token to a local 'user' email if it exists in DB
          let mapped = null;
          for (const lu of localUsers) {
            if (!lu || !lu.email) continue;
            const found = usersList.find(dbu => dbu.email && String(dbu.email).toLowerCase() === String(lu.email).toLowerCase());
            if (found) { mapped = found.id; break; }
          }

          // Fallback: if no email match, prefer a local admin user in DB to avoid accidental mapping to random user
          if (!mapped) {
            const adminUser = usersList.find(x => x.role === 'admin' && x.status === 'active');
            if (adminUser) mapped = adminUser.id;
          }

          // Final conservative fallback: do not map if no clear candidate found
          if (mapped) {
            db.sessions[t] = mapped;
          } else {
            console.warn('[autoLogin] Skipped mapping token to DB because no clear local user found for this device.');
          }
        });

        // Ensure the explicit CUP9_SESSION_TOKEN (if present and device-local) aligns with local 'user' entry
        if (mainToken) {
          try {
            const parsedMainUser = safeParse(localStorage.getItem('user'));
            if (parsedMainUser && parsedMainUser.email) {
              const found = (db.users || []).find(u => u.email && String(u.email).toLowerCase() === String(parsedMainUser.email).toLowerCase());
              if (found) db.sessions[mainToken] = found.id;
            }
          } catch (e) { /* ignore */ }
        }

        localStorage.setItem('CUP9_GPU_DB', JSON.stringify(db));
      } catch (e) {
        console.warn('Could not restore device-local sessions into CUP9_GPU_DB', e);
      }
    } else {
      // No DB present: create a minimal DB seeded only from device-local users and tokens
      if (discoveredTokens.size && localUsers.length) {
        const users = [];
        localUsers.forEach((u, idx) => {
          const id = u.id || `restored-${idx}-${Date.now()}`;
          users.push({
            id,
            email: u.email || `user${idx}@local`,
            password: u.password || '',
            role: u.role || 'user',
            balance: typeof u.balance === 'number' ? u.balance : 0,
            earnings: typeof u.earnings === 'number' ? u.earnings : 0,
            status: u.status || 'active',
            referrals: u.referrals || [],
            addresses: u.addresses || {},
            deviceId: deviceId // persist device linkage to avoid cross-device reuse later
          });
        });

        const db = { users, gpus: [], availableGpus: [], transactions: [], notifications: [], sessions: {} };
        const firstId = users[0] && users[0].id;
        Array.from(discoveredTokens).forEach(t => {
          if (firstId) db.sessions[t] = firstId;
        });

        localStorage.setItem('CUP9_GPU_DB', JSON.stringify(db));
      }
    }

    // Expose CURRENT_USER only if it's device-local (avoid manufacturing cross-device global)
    const possibleUser = safeParse(localStorage.getItem('user'));
    if (possibleUser && appearsLocalToThisDevice('user', localStorage.getItem('user'))) {
      if (!window.CURRENT_USER) window.CURRENT_USER = possibleUser;
    }

    // Do not pick an arbitrary discovered token as primary; only leave existing CUP9_SESSION_TOKEN untouched
  } catch (e) {
    console.warn('Device-scoped auto-login helper failed', e);
  }
})();