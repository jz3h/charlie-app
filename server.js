const express = require("express");
const axios = require("axios");
const path = require("path");
const crypto = require("crypto");
const dns = require("dns");
const net = require("net");
const { execSync } = require("child_process");
const fs = require("fs");
const app = express();
const PORT = 4000;
const LLM = "http://localhost:11434";

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/status", async (req, res) => {
  try {
    const r = await axios.get(LLM + "/api/tags", { timeout: 5000 });
    const models = r.data.models ? r.data.models.map(m => m.name) : [];
    res.json({ status: "online", ollama: true, models, tailscale: "100.116.60.65", uptime: process.uptime() });
  } catch(e) { res.json({ status: "ollama_error", detail: e.message }); }
});

app.post("/api/say", async (req, res) => {
  const msg = req.body.message || "";
  try {
    const r = await axios.post(LLM + "/api/chat", {
      model: "hermes3:latest",
      messages: [{ role: "user", content: msg }],
      stream: false,
      options: { temperature: 0.7, num_predict: 500 }
    }, { timeout: 30000 });
    res.json({ response: r.data.message.content });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/pix-scan", (req, res) => {
  const qr = req.body.qr || "";
  const result = {};
  if (!qr) return res.json({ error: "vazio" });
  const pairs = qr.split("&");
  pairs.forEach(p => { if (p.includes("=")) { const [k,v] = p.split("="); result[decodeURIComponent(k)] = decodeURIComponent(v || ""); } });
  if (qr.includes("br.com.bcb.pix") || qr.includes("pix")) result.type = "pix_brcode";
  else if (qr.length >= 11 && qr.length <= 51) result.type = "pix_chave";
  else result.type = "unknown";
  result.raw = qr.substring(0, 200);
  res.json(result);
});

app.post("/api/pix-validate", (req, res) => {
  const { amount, key } = req.body;
  if (!amount || !key) return res.json({ valid: false, reason: "dados faltantes" });
  const hash = crypto.createHash("sha256").update(amount + key + Date.now().toString()).digest("hex");
  res.json({ valid: true, transaction_id: hash.substring(0, 16), amount, key: key.substring(0, 6) + "****" + key.substring(key.length - 4), status: "confirmed", timestamp: new Date().toISOString() });
});

app.get("/api/scan-ports", async (req, res) => {
  const host = req.query.host || "127.0.0.1";
  const ports = [22, 80, 443, 8080, 3000, 4000, 11434, 5678, 20128, 8000, 9000];
  const open = [];
  for (const p of ports) {
    try {
      const s = new net.Socket();
      await new Promise((resolve) => {
        s.setTimeout(800);
        s.connect(p, host, () => { open.push(p); s.destroy(); resolve(); });
        s.on("error", () => { s.destroy(); resolve(); });
        s.on("timeout", () => { s.destroy(); resolve(); });
      });
    } catch(e) {}
  }
  res.json({ host, open_ports: open });
});

app.get("/api/dns", async (req, res) => {
  const host = req.query.host || "google.com";
  dns.lookup(host, (err, addr) => {
    if (err) res.json({ host, error: err.message });
    else res.json({ host, ip: addr });
  });
});

app.get("/api/hash", async (req, res) => {
  const text = req.query.text || "";
  const algo = req.query.algo || "sha256";
  const h = crypto.createHash(algo).update(text).digest("hex");
  res.json({ text_preview: text.substring(0, 50) + (text.length > 50 ? "..." : ""), algo, hash: h, length: text.length });
});

app.post("/api/encrypt", async (req, res) => {
  const { text, key, iv } = req.body;
  if (!text || !key || !iv) return res.json({ error: "faltam campos" });
  try {
    const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(key, "hex"), Buffer.from(iv, "hex"));
    let enc = cipher.update(text, "utf8", "hex");
    enc += cipher.final("hex");
    res.json({ encrypted: enc });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/decrypt", async (req, res) => {
  const { enc, key, iv } = req.body;
  if (!enc || !key || !iv) return res.json({ error: "faltam campos" });
  try {
    const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(key, "hex"), Buffer.from(iv, "hex"));
    let dec = decipher.update(enc, "hex", "utf8");
    dec += decipher.final("utf8");
    res.json({ decrypted: dec });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/network", async (req, res) => {
  const info = {};
  try { info.interfaces = execSync("ip addr 2>/dev/null || echo 'unavailable'").toString(); } catch(e) { info.interfaces = "unavailable"; }
  try { info.routes = execSync("ip route 2>/dev/null || echo 'unavailable'").toString(); } catch(e) { info.routes = "unavailable"; }
  try { info.public_ip = execSync("curl -s ifconfig.me 2>/dev/null || echo 'unknown'").toString().trim(); } catch(e) { info.public_ip = "unknown"; }
  res.json(info);
});

app.get("/api/gen-password", async (req, res) => {
  const length = parseInt(req.query.length) || 16;
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let pw = "";
  for (let i = 0; i < length; i++) pw += charset.charAt(Math.floor(Math.random() * charset.length));
  res.json({ password: pw, length, strength: length >= 16 ? "strong" : "medium" });
});

app.get("/api/server", async (req, res) => {
  const info = {};
  try { info.os = execSync("uname -a 2>/dev/null || echo 'unknown'").toString().trim(); } catch(e) { info.os = "unknown"; }
  try { info.cpu = execSync("cat /proc/cpuinfo 2>/dev/null | grep 'model name' | head -1 || echo 'unknown'").toString().trim(); } catch(e) { info.cpu = "unknown"; }
  try { info.mem = execSync("free -h 2>/dev/null | grep Mem || echo 'unknown'").toString().trim(); } catch(e) { info.mem = "unknown"; }
  try { info.disk = execSync("df -h / 2>/dev/null | tail -1 || echo 'unknown'").toString().trim(); } catch(e) { info.disk = "unknown"; }
  try { info.uptime = execSync("uptime 2>/dev/null || echo 'unknown'").toString().trim(); } catch(e) { info.uptime = "unknown"; }
  res.json(info);
});

app.listen(PORT, "0.0.0.0", () => console.log("CharlieApp v3 on port " + PORT));
