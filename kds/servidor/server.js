'use strict';
// Servidor KDS — roda no PC da cozinha (Windows 10), sem internet e sem instalar pacotes.
//  • Porta 9100: se passa pela impressora térmica. Cada comprovante recebido vira um card
//    no KDS e é repassado, byte a byte, para a impressora real (a equipe continua com o papel).
//  • Porta 8080: telas do KDS (cozinha), lançamento manual e métricas, em tempo real.

const fs = require('fs');
const path = require('path');
const net = require('net');
const http = require('http');
const crypto = require('crypto');
const os = require('os');
const { splitTickets, parseTicket } = require('./parser');

const DIR = __dirname;
const CONFIG_FILE = path.join(DIR, 'config.json');
const DATA_DIR = path.join(DIR, 'dados');
const STATE_FILE = path.join(DATA_DIR, 'estado.json');
const ARCHIVE_DIR = path.join(DATA_DIR, 'fechamentos');
const CAPTURE_DIR = path.join(DATA_DIR, 'comprovantes');
fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
fs.mkdirSync(CAPTURE_DIR, { recursive: true });

const DEFAULT_CONFIG = {
  impressora: { ip: '192.168.0.100', porta: 9100 },
  portaCaptura: 9100,
  portaWeb: 8080,
  codificacao: 'cp850',
  repassarParaImpressora: true,
  guardarComprovantesBrutos: true,
  ignorarReimpressaoMinutos: 10,
  pracas: { padrao: 'Cozinha', regras: {} }
};
const config = loadConfig();

function loadConfig() {
  let user = {};
  try { user = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); }
  catch (e) { if (e.code !== 'ENOENT') { console.error('config.json inválido:', e.message); process.exit(1); } }
  return { ...DEFAULT_CONFIG, ...user, impressora: { ...DEFAULT_CONFIG.impressora, ...user.impressora }, pracas: { ...DEFAULT_CONFIG.pracas, ...user.pracas } };
}

// ---------------------------------------------------------------- estado
const DEFAULT_TH = { Mesa: { warn: 20, late: 30 }, Delivery: { warn: 20, late: 30 }, Retirada: { warn: 15, late: 25 } };
let state = { seq: 0, dayStartedAt: Date.now(), orders: [], history: [], cfg: { sound: 1, th: DEFAULT_TH } };
try { state = { ...state, ...JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) }; } catch {}
const printer = { online: null, lastError: '', lastJobAt: null, jobs: 0, parsedOk: 0 };
const recentHashes = new Map(); // anti-reimpressão
const undoStack = [];

let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const tmp = STATE_FILE + '.tmp';
    fs.writeFile(tmp, JSON.stringify(state), err => {
      if (err) return console.error('Erro ao salvar:', err.message);
      fs.rename(tmp, STATE_FILE, e => e && console.error('Erro ao salvar:', e.message));
    });
  }, 150);
}
const id = () => crypto.randomBytes(6).toString('hex');

function publicState() {
  return { ...state, printer, now: Date.now(), canUndo: undoStack.length > 0 };
}
function changed() { save(); broadcast(); }

function addOrder({ ident, type, origin, obs, items, raw, parsedOk }) {
  state.seq++;
  const order = {
    id: id(), seq: state.seq, ident: String(ident || '?').slice(0, 60), type: ['Mesa', 'Delivery', 'Retirada'].includes(type) ? type : 'Mesa',
    origin: origin || 'Caixa', obs: String(obs || '').slice(0, 200), createdAt: Date.now(), raw: raw || '', parsedOk: parsedOk !== false,
    items: (items || []).filter(i => i && i.name).map(i => ({
      id: id(), qty: Math.max(1, Math.min(99, +i.qty || 1)), name: String(i.name).slice(0, 120),
      obs: String(i.obs || '').slice(0, 160), station: String(i.station || config.pracas.padrao).slice(0, 30), doneAt: null
    }))
  };
  if (!order.items.length) return null;
  state.orders.push(order);
  changed();
  return order;
}

// ---------------------------------------------------------------- captura da impressora (porta 9100)
function handleTicketBytes(buf) {
  if (!buf.length) return;
  const tickets = splitTickets(buf, config.codificacao);
  if (!tickets.length) return; // conexões só de consulta de status
  printer.jobs++; printer.lastJobAt = Date.now();
  if (config.guardarComprovantesBrutos) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    fs.writeFile(path.join(CAPTURE_DIR, stamp + '.bin'), buf, () => {});
  }
  for (const text of tickets) {
    const hash = crypto.createHash('sha1').update(text.replace(/\d{1,2}:\d{2}(:\d{2})?/g, '')).digest('hex');
    const seen = recentHashes.get(hash);
    if (seen && Date.now() - seen < config.ignorarReimpressaoMinutos * 60000) { console.log('Reimpressão ignorada'); continue; }
    recentHashes.set(hash, Date.now());
    const p = parseTicket(text, { stations: config.pracas.regras, defaultStation: config.pracas.padrao });
    if (p.ok) printer.parsedOk++;
    const o = addOrder({ ...p, raw: text, parsedOk: p.ok });
    if (o) console.log(`Pedido #${o.seq} ${o.type} ${o.ident} — ${o.items.length} item(ns)${p.ok ? '' : ' [CONFERIR]'}`);
  }
  for (const [h, t] of recentHashes) if (Date.now() - t > 3600000) recentHashes.delete(h);
}

const captureServer = net.createServer(client => {
  const chunks = [];
  let upstream = null;
  if (config.repassarParaImpressora) {
    upstream = net.connect(config.impressora.porta, config.impressora.ip);
    upstream.setTimeout(8000);
    upstream.on('connect', () => { if (!printer.online) { printer.online = true; printer.lastError = ''; broadcast(); } });
    upstream.on('data', d => client.writable && client.write(d)); // respostas de status voltam para o sistema
    upstream.on('timeout', () => upstream.destroy(new Error('sem resposta')));
    upstream.on('error', e => {
      printer.online = false; printer.lastError = `Impressora ${config.impressora.ip} inacessível (${e.code || e.message})`;
      console.error(printer.lastError); broadcast();
    });
  }
  client.on('data', d => { chunks.push(d); if (upstream && !upstream.destroyed) upstream.write(d); });
  client.on('end', () => { if (upstream && !upstream.destroyed) upstream.end(); });
  client.on('close', () => handleTicketBytes(Buffer.concat(chunks)));
  client.on('error', () => {});
  client.setTimeout(30000, () => client.end());
});
captureServer.on('error', e => {
  console.error(`\nNão consegui abrir a porta ${config.portaCaptura} (${e.code}). Outro programa está usando? Rode o liberar-firewall.bat como administrador.`);
});
captureServer.listen(config.portaCaptura, '0.0.0.0');

// verifica a impressora a cada 30 s para o aviso na tela
function probePrinter() {
  if (!config.repassarParaImpressora) return;
  const s = net.connect(config.impressora.porta, config.impressora.ip);
  s.setTimeout(4000);
  const done = (ok, err) => {
    s.destroy();
    const changedStatus = printer.online !== ok;
    printer.online = ok; printer.lastError = ok ? '' : `Impressora ${config.impressora.ip} inacessível (${err})`;
    if (changedStatus) broadcast();
  };
  s.on('connect', () => done(true));
  s.on('timeout', () => done(false, 'sem resposta'));
  s.on('error', e => done(false, e.code || e.message));
}
setInterval(probePrinter, 30000); probePrinter();

// ---------------------------------------------------------------- web (porta 8080)
const clients = new Set();
function broadcast() {
  const msg = `data: ${JSON.stringify(publicState())}\n\n`;
  for (const res of clients) res.write(msg);
}
setInterval(() => { for (const res of clients) res.write(': ping\n\n'); }, 20000);

function readBody(req) {
  return new Promise((resolve, reject) => {
    let s = ''; req.on('data', c => { s += c; if (s.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(s ? JSON.parse(s) : {}); } catch (e) { reject(e); } });
  });
}
const json = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(obj)); };

const routes = {
  'POST /api/orders': async b => addOrder({ ...b, raw: '', parsedOk: true }) || { error: 'Pedido sem itens' },
  'POST /api/item': async ({ orderId, itemId }) => {
    const o = state.orders.find(o => o.id === orderId); const it = o && o.items.find(i => i.id === itemId);
    if (!it) return { error: 'não encontrado' };
    it.doneAt = it.doneAt ? null : Date.now(); changed(); return { ok: true };
  },
  'POST /api/bump': async ({ orderId }) => {
    const o = state.orders.find(o => o.id === orderId); if (!o) return { error: 'não encontrado' };
    const now = Date.now();
    state.orders = state.orders.filter(x => x !== o);
    state.history.push({ id: o.id, seq: o.seq, ident: o.ident, type: o.type, origin: o.origin, createdAt: o.createdAt, doneAt: now,
      itemCount: o.items.length, stations: [...new Set(o.items.map(i => i.station))] });
    undoStack.push(o); if (undoStack.length > 30) undoStack.shift();
    changed(); return { ok: true, ms: now - o.createdAt };
  },
  'POST /api/undo': async () => {
    const o = undoStack.pop(); if (!o) return { error: 'Nada para desfazer' };
    state.history = state.history.filter(h => h.id !== o.id); state.orders.push(o); changed(); return { ok: true, ident: o.ident, type: o.type };
  },
  'POST /api/delete': async ({ orderId }) => { // pedido cancelado
    const before = state.orders.length; state.orders = state.orders.filter(o => o.id !== orderId);
    if (before !== state.orders.length) changed(); return { ok: true };
  },
  'POST /api/cfg': async ({ th, sound }) => {
    for (const [t, v] of Object.entries(th || {})) if (!(v.warn > 0 && v.late > v.warn)) return { error: `${t}: vermelho precisa ser maior que amarelo` };
    state.cfg = { sound: sound ? 1 : 0, th: { ...state.cfg.th, ...th } }; changed(); return { ok: true };
  },
  'POST /api/close-day': async () => { // "dar baixa" no fechamento: arquiva o dia e zera
    const stamp = new Date(state.dayStartedAt).toISOString().slice(0, 10) + '_' + Date.now();
    fs.writeFileSync(path.join(ARCHIVE_DIR, stamp + '.json'), JSON.stringify({ dayStartedAt: state.dayStartedAt, closedAt: Date.now(), history: state.history, openOrders: state.orders }));
    state.history = []; state.orders = []; state.seq = 0; state.dayStartedAt = Date.now(); undoStack.length = 0;
    changed(); return { ok: true };
  },
  'GET /api/fechamentos': async () => fs.readdirSync(ARCHIVE_DIR).filter(f => f.endsWith('.json')).sort().reverse().slice(0, 60).map(f => {
    try {
      const d = JSON.parse(fs.readFileSync(path.join(ARCHIVE_DIR, f), 'utf8'));
      const durs = d.history.map(h => h.doneAt - h.createdAt);
      const th = state.cfg.th;
      return { arquivo: f, inicio: d.dayStartedAt, fim: d.closedAt, pedidos: durs.length,
        tmt: durs.length ? durs.reduce((a, b) => a + b, 0) / durs.length : 0,
        noPrazo: durs.length ? d.history.filter(h => h.doneAt - h.createdAt < (th[h.type] || th.Mesa).late * 60000).length / durs.length : 0 };
    } catch { return { arquivo: f, erro: true }; }
  })
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write(`data: ${JSON.stringify(publicState())}\n\n`);
    clients.add(res); req.on('close', () => clients.delete(res)); return;
  }
  if (url.pathname === '/api/state') return json(res, 200, publicState());
  const route = routes[`${req.method} ${url.pathname}`];
  if (route) {
    try { const r = await route(req.method === 'POST' ? await readBody(req) : {}); return json(res, r && r.error ? 400 : 200, r); }
    catch (e) { return json(res, 400, { error: e.message }); }
  }
  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
    return fs.createReadStream(path.join(DIR, 'public', 'index.html')).pipe(res);
  }
  res.writeHead(404); res.end('não encontrado');
});
server.listen(config.portaWeb, '0.0.0.0', () => {
  const ips = Object.values(os.networkInterfaces()).flat().filter(i => i && i.family === 'IPv4' && !i.internal).map(i => i.address);
  console.log('\n================ KDS RODANDO ================');
  console.log(`Tela da cozinha:   http://localhost:${config.portaWeb}`);
  ips.forEach(ip => console.log(`Outras telas:      http://${ip}:${config.portaWeb}`));
  console.log(`Captura impressão: porta ${config.portaCaptura} -> repassa para ${config.repassarParaImpressora ? config.impressora.ip + ':' + config.impressora.porta : '(desligado)'}`);
  console.log(`IP deste PC (use na Sirrus no lugar do IP da impressora): ${ips.join(', ') || '?'}`);
  console.log('Não feche esta janela.\n');
});

process.on('SIGINT', () => { fs.writeFileSync(STATE_FILE, JSON.stringify(state)); process.exit(0); });
