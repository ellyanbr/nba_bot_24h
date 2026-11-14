'use strict';
// Envia comprovantes de exemplo para o KDS como se fosse a Sirrus imprimindo.
// Uso:  node simular-impressao.js            (manda 3 exemplos para este PC)
//       node simular-impressao.js 192.168.0.50  (manda para o PC da cozinha a partir de outro PC)
const net = require('net');
const host = process.argv[2] || '127.0.0.1';
const port = +(process.argv[3] || 9100);

const ESC = '\x1b', GS = '\x1d';
const cp850 = s => Buffer.from([...s].map(ch => {
  const map = { 'ç': 0x87, 'Ç': 0x80, 'ã': 0xc6, 'Ã': 0xc7, 'õ': 0xe4, 'Õ': 0xe5, 'á': 0xa0, 'é': 0x82, 'í': 0xa1, 'ó': 0xa2, 'ú': 0xa3, 'â': 0x83, 'ê': 0x88, 'ô': 0x93, 'à': 0x85, 'º': 0xa7, 'ª': 0xa6 };
  return map[ch] ?? ch.charCodeAt(0);
}));
const ticket = lines => Buffer.concat([Buffer.from(ESC + '@' + ESC + 'a\x01' + ESC + 'E\x01'), cp850(lines[0] + '\n'), Buffer.from(ESC + 'E\x00' + ESC + 'a\x00'),
  cp850(lines.slice(1).join('\n') + '\n\n\n'), Buffer.from(GS + 'V\x41\x03')]);

const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const n = Math.floor(Math.random() * 900) + 100;
const exemplos = [
  ticket(['MESA 12', '--------------------------------', `Pedido: ${n}   ${hora}`, 'Garçom: Carlos (Cook Mobile)', '--------------------------------',
    '2 X Picanha na chapa', '  - 1 ao ponto, 1 bem passada', '1 X Arroz biro biro', '1 X Fritas grande', '  OBS: bem crocante', '--------------------------------']),
  ticket(['DELIVERY', '--------------------------------', `Pedido #${n + 1} - Site`, `Data: 14/11  ${hora}`, 'Cliente: Maria Souza', 'Endereço: Rua das Flores, 120',
    '--------------------------------', '1 Strogonoff de frango   R$ 42,90', '   sem champignon', '2 Refrigerante lata       R$ 12,00', '1 Pudim                  R$ 14,00',
    '--------------------------------', 'TOTAL                    R$ 68,90']),
  ticket(['RETIRADA', '--------------------------------', `Pedido: ${n + 2}`, 'Cliente: João', '--------------------------------', '3x X-Burger', '  - sem cebola', '1x Batata frita']),
];

let i = 0;
(function next() {
  if (i >= exemplos.length) return console.log('Pronto. Confira a tela do KDS.');
  const s = net.connect(port, host, () => { s.end(exemplos[i]); });
  s.on('close', () => { console.log(`Comprovante ${i + 1} enviado`); i++; setTimeout(next, 400); });
  s.on('error', e => { console.error(`Não consegui conectar em ${host}:${port} (${e.code}). O KDS está aberto?`); process.exit(1); });
})();
