const express = require("express");
const fs = require("fs");
const bodyParser = require("body-parser");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;

// API per testare se funziona
app.get("/", (req, res) => {
  res.send("Backend Admin funzionante!");
});

// API per leggere tutte le richieste
app.get("/requests", (req, res) => {
  let requests = [];
  if(fs.existsSync("requests.json")){
    requests = JSON.parse(fs.readFileSync("requests.json"));
  }
  res.json(requests);
});

// Abilita OTP per un utente
app.post("/admin/enable-otp", (req, res) => {
  const { username } = req.body;
  if(!username) return res.json({ok:false});

  let users = [];
  if(fs.existsSync("users.json")){
    users = JSON.parse(fs.readFileSync("users.json"));
  }

  users = users.map(u => {
    if(u.username === username) u.otp_enabled = true;
    return u;
  });

  fs.writeFileSync("users.json", JSON.stringify(users, null, 2));
  res.json({ok:true});
});

// Disabilita OTP per un utente
app.post("/admin/disable-otp", (req, res) => {
  const { username } = req.body;
  if(!username) return res.json({ok:false});

  let users = [];
  if(fs.existsSync("users.json")){
    users = JSON.parse(fs.readFileSync("users.json"));
  }

  users = users.map(u => {
    if(u.username === username) u.otp_enabled = false;
    return u;
  });

  fs.writeFileSync("users.json", JSON.stringify(users, null, 2));
  res.json({ok:true});
});

// Avvio server
app.listen(PORT, () => console.log(`AdminAPI attivo sulla porta ${PORT}`));
