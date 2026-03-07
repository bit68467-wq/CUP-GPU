const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static('public')); // se hai frontend nella cartella public

const REQUESTS_FILE = path.join(__dirname, 'requests.json');

// Endpoint per leggere tutte le richieste
app.get('/api/requests', (req, res) => {
  const requests = JSON.parse(fs.readFileSync(REQUESTS_FILE));
  res.json(requests.filter(r => r.status === 'pending'));
});

// Endpoint per abilitare OTP di un utente
app.post('/api/requests/:userId/enable', (req, res) => {
  const userId = parseInt(req.params.userId);
  let requests = JSON.parse(fs.readFileSync(REQUESTS_FILE));
  
  requests = requests.map(r => {
    if (r.user_id === userId) {
      r.otp_enabled = true;
      r.status = "approved"; // marca la richiesta come approvata
    }
    return r;
  });
  
  fs.writeFileSync(REQUESTS_FILE, JSON.stringify(requests, null, 2));
  res.json({ success: true });
});

// Porta dinamica per Render
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
app.post('/api/requests', (req, res) => {
  const newRequest = req.body;
  const requests = JSON.parse(fs.readFileSync(REQUESTS_FILE));
  requests.push(newRequest);
  fs.writeFileSync(REQUESTS_FILE, JSON.stringify(requests, null, 2));
  res.json({ success: true });
});

