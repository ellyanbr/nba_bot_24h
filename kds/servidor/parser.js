'use strict';
// Leitura dos comprovantes de cozinha enviados para a impressora (ESC/POS).
// 1) remove os comandos de impressora, 2) decodifica o texto, 3) tenta montar o pedido.
// Se a leitura não for confiável, o pedido entra mesmo assim com o texto bruto,
// marcado como "conferir comprovante". Nada que foi impresso fica de fora da tela.

const ESC = 0x1b, GS = 0x1d, FS = 0x1c, DLE = 0x10;

// Comprimento (em bytes, depois do comando) dos comandos ESC mais comuns.
const ESC_ARGS = { 0x40: 0, 0x21: 1, 0x45: 1, 0x47: 1, 0x2d: 1, 0x61: 1, 0x64: 1, 0x74: 1, 0x4d: 1, 0x32: 0,
  0x33: 1, 0x4a: 1, 0x52: 1, 0x56: 1, 0x7b: 1, 0x20: 1, 0x63: 2, 0x70: 3, 0x24: 2, 0x5c: 2, 0x69: 0, 0x6d: 0, 0x42: 2, 0x43: 1 };
const GS_ARGS = { 0x21: 1, 0x42: 1, 0x48: 1, 0x66: 1, 0x68: 1, 0x77: 1, 0x4c: 2, 0x57: 2, 0x62: 1, 0x72: 1, 0x49: 1, 0x61: 1, 0x2f: 1, 0x3a: 0 };

// Remove comandos ESC/POS. Devolve { text: Buffer, cuts: [offsets] } — os cortes de papel separam comprovantes.
function stripEscPos(buf) {
  const out = []; const cuts = [];
  let i = 0;
  while (i < buf.length) {
    const b = buf[i];
    if (b === ESC) {
      const c = buf[i + 1];
      if (c === 0x2a) { // ESC * m nL nH (imagem em bits)
        const m = buf[i + 2], n = buf[i + 3] + buf[i + 4] * 256;
        i += 5 + n * (m >= 32 ? 3 : 1); continue;
      }
      if (c === 0x69 || c === 0x6d) { cuts.push(out.length); i += 2; continue; } // corte parcial/total (antigo)
      i += 2 + (ESC_ARGS[c] ?? 1); continue;
    }
    if (b === GS) {
      const c = buf[i + 1];
      if (c === 0x56) { // GS V m [n] — corte de papel
        cuts.push(out.length);
        const m = buf[i + 2]; i += (m === 0x41 || m === 0x42 || m === 65 || m === 66) ? 4 : 3; continue;
      }
      if (c === 0x76 && buf[i + 2] === 0x30) { // GS v 0 m xL xH yL yH dados (logo raster)
        const x = buf[i + 4] + buf[i + 5] * 256, y = buf[i + 6] + buf[i + 7] * 256;
        i += 8 + x * y; continue;
      }
      if (c === 0x28 || c === 0x38) { // GS ( fn pL pH ... (QR code etc.) / GS 8 L p1..p4
        if (c === 0x38) { const n = buf[i + 3] + buf[i + 4] * 256 + buf[i + 5] * 65536 + buf[i + 6] * 16777216; i += 7 + n; continue; }
        const n = buf[i + 3] + buf[i + 4] * 256; i += 5 + n; continue;
      }
      if (c === 0x6b) { // GS k m ... código de barras
        const m = buf[i + 2];
        if (m <= 6) { let j = i + 3; while (j < buf.length && buf[j] !== 0) j++; i = j + 1; }
        else i += 4 + buf[i + 3];
        continue;
      }
      i += 2 + (GS_ARGS[c] ?? 1); continue;
    }
    if (b === FS) { const c = buf[i + 1]; i += c === 0x70 ? 4 : c === 0x21 ? 3 : 2; continue; }
    if (b === DLE) { i += 3; continue; } // consultas de status (DLE EOT n / DLE ENQ n)
    if (b === 0x0c) { cuts.push(out.length); i++; continue; } // form feed
    if (b === 0x0a || b === 0x0d || b === 0x09 || b >= 0x20) out.push(b);
    i++;
  }
  return { text: Buffer.from(out), cuts };
}

// Tabela CP850 (128–255), a página de código mais usada nas térmicas no Brasil.
const CP850 = 'ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜø£Ø×ƒáíóúñÑªº¿®¬½¼¡«»░▒▓│┤ÁÂÀ©╣║╗╝¢¥┐└┴┬├─┼ãÃ╚╔╩╦╠═╬¤ðÐÊËÈıÍÎÏ┘┌█▄¦Ì▀ÓßÔÒõÕµþÞÚÛÙýÝ¯´­±‗¾¶§÷¸°¨·¹³²■ ';
// CP860 (português): difere da CP850 apenas em alguns pontos da primeira metade.
const CP860 = 'ÇüéâãàÁçêÊèÍÔìÃÂÉÀÈôõòÚùÌÕÜ¢£Ù₧ÓáíóúñÑªº¿Ò¬½¼¡«»' + CP850.slice(48);

function decode(buf, encoding) {
  if (encoding === 'utf8') return buf.toString('utf8');
  if (encoding === 'latin1' || encoding === 'cp1252') return buf.toString('latin1');
  const table = encoding === 'cp860' ? CP860 : CP850;
  let s = '';
  for (const b of buf) s += b < 128 ? String.fromCharCode(b) : table[b - 128];
  return s;
}

// Separa o fluxo recebido em comprovantes (um por corte de papel) já como texto limpo.
function splitTickets(buf, encoding = 'cp850') {
  const { text, cuts } = stripEscPos(buf);
  const parts = []; let start = 0;
  for (const c of [...cuts, text.length]) { if (c > start) parts.push(text.subarray(start, c)); start = c; }
  return parts.map(p => decode(p, encoding).replace(/\r/g, '').replace(/[ \t]+$/gm, '').replace(/^\n+|\n+$/g, ''))
    .filter(t => t.replace(/[\s\-=_*.]/g, '').length > 3);
}

const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
const DIVIDER = /^[\s\-=_*.~#]{3,}$/;
// Linhas de cabeçalho/rodapé que não são itens.
const NOISE = /^(TOTAL|SUBTOTAL|TAXA|DESCONTO|TROCO|PAGAMENTO|FORMA DE PAG|VALOR|CPF|CNPJ|TEL|FONE|DATA|HORA|OPERADOR|ATENDENTE|GARCOM|GARÇOM|CAIXA|ENDERECO|ENDEREÇO|BAIRRO|CEP|REFERENCIA|COMPLEMENTO|CLIENTE|OBRIGADO|VOLTE SEMPRE|SIRRUS|WWW\.|HTTP|VIA |COZINHA$|COMANDA|CONFERENCIA|NAO E DOCUMENTO|NÃO É DOCUMENTO)/;
const ITEM = /^\s*(\d{1,3})\s*(?:x|X|un|UN|und|UND|\*)?\s+([^\d\s].*?)(?:\s+R?\$?\s*\d+[.,]\d{2})*\s*$/;
const ITEM_SUFFIX = /^\s*([^\d\s].*?)\s+(\d{1,3})\s*(?:x|X|un|UN)\s*$/; // "X-Burger 2x"
const OBS = /^\s*(?:[-+>*•]+\s*|obs\.?:?\s*|observa[cç][aã]o:?\s*|sem\s|com\s|sem$|ponto\s|bem\s|mal\s|pouco\s|muito\s|extra\s|adicional\s|\(\s*)/i;

function parseTicket(text, rules = {}) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const N = norm(text);
  let type = 'Mesa', ident = '', origin = 'Sirrus';

  const mesa = N.match(/\b(?:MESA|MES)\s*[:Nº°#.]*\s*(\d{1,3})\b/);
  const comanda = N.match(/\bCOMANDA\s*[:Nº°#.]*\s*(\d{1,5})\b/);
  const pedido = N.match(/\b(?:PEDIDO|PED|ORDEM|SENHA)\s*[:Nº°#.]*\s*(\d{1,7})\b/) || N.match(/#\s*(\d{2,7})\b/);
  if (/\b(DELIVERY|ENTREGA|MOTOBOY|IFOOD)\b/.test(N)) type = 'Delivery';
  else if (/\b(RETIRADA|RETIRAR|BALCAO|VIAGEM|TAKE ?AWAY|PARA LEVAR)\b/.test(N)) type = 'Retirada';
  else if (!mesa && pedido && !comanda) type = 'Retirada';

  if (type === 'Mesa') ident = mesa ? mesa[1].padStart(2, '0') : comanda ? 'Comanda ' + comanda[1] : pedido ? '#' + pedido[1] : '?';
  else ident = pedido ? '#' + pedido[1] : '?';
  if (/\b(SITE|ONLINE|CARDAPIO DIGITAL|WHATSAPP)\b/.test(N)) origin = 'Site';
  else if (/\b(COOK|MOBILE|GARCOM)\b/.test(N) && type === 'Mesa') origin = 'Garçom';

  const cliente = text.match(/cliente\s*:?\s*(.+)/i);
  const customer = cliente ? cliente[1].trim().slice(0, 30) : '';
  if (type !== 'Mesa' && customer) ident = (ident !== '?' ? ident + ' · ' : '') + customer;

  const items = []; const generalObs = [];
  for (const line of lines) {
    if (DIVIDER.test(line)) continue;
    const L = norm(line);
    const isObsLine = OBS.test(line);
    let m;
    if (!isObsLine && (m = line.match(ITEM)) && !NOISE.test(norm(m[2]))) {
      items.push({ qty: +m[1], name: m[2].replace(/\s{2,}/g, ' ').trim(), obs: '' });
      continue;
    }
    if (!isObsLine && (m = line.match(ITEM_SUFFIX)) && !NOISE.test(norm(m[1]))) {
      items.push({ qty: +m[2], name: m[1].trim(), obs: '' });
      continue;
    }
    if (isObsLine && items.length && !NOISE.test(L)) {
      const o = line.replace(/^\s*(?:[-+>*•]+\s*|obs\.?:?\s*|observa[cç][aã]o:?\s*)/i, '').replace(/^\(|\)$/g, '').trim();
      if (o) items[items.length - 1].obs = items[items.length - 1].obs ? items[items.length - 1].obs + ', ' + o : o;
      continue;
    }
    if (/^OBS/.test(L) && !items.length) generalObs.push(line.replace(/^obs\.?:?\s*/i, ''));
  }

  const station = name => {
    for (const [st, re] of Object.entries(rules.stations || {})) if (new RegExp(re, 'i').test(name)) return st;
    return rules.defaultStation || 'Cozinha';
  };
  const ok = items.length > 0 && ident !== '?';
  return {
    ok, type, ident: ident === '?' ? 'Conferir' : ident, origin,
    obs: [ok ? '' : '⚠ Leitura incompleta — conferir comprovante', ...generalObs].filter(Boolean).join(' · '),
    items: items.length ? items.map(i => ({ ...i, station: station(i.name) }))
      : [{ qty: 1, name: lines.slice(0, 6).join(' / ').slice(0, 140) || 'Comprovante sem itens', obs: '', station: rules.defaultStation || 'Cozinha' }]
  };
}

module.exports = { stripEscPos, decode, splitTickets, parseTicket };
