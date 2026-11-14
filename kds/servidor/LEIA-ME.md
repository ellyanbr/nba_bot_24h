# KDS — Instalação no PC da cozinha

Este sistema roda **no próprio PC da cozinha**, sem internet e sem mensalidade.
Ele se passa pela impressora: a Sirrus e o Cook Mobile continuam "imprimindo" como
sempre, o KDS lê cada comprovante, cria o card com cronômetro e **repassa o comprovante
para a impressora real**. O papel continua saindo.

```
Sirrus / Cook Mobile ──► PC da cozinha (porta 9100) ──► Impressora térmica
                              │
                              └──► Tela KDS (cozinha) + tela do caixa + métricas
```

## 1. Preparar o PC da cozinha (uma vez só)

1. **Cabo de rede** no PC da cozinha (o Wi-Fi não é usado pelo sistema).
2. **IP fixo** para o PC da cozinha. Peça para quem cuida da rede/roteador reservar um IP
   (ex.: `192.168.0.50`). Se o IP mudar, a Sirrus para de achar o KDS.
3. Instale o **Node.js LTS** (versão 22 ou mais nova): https://nodejs.org → botão "LTS" → avançar, avançar, concluir.
4. Copie a pasta `servidor` para `C:\KDS`.
5. Clique com o botão direito em `liberar-firewall.bat` → **Executar como administrador**.

## 2. Configurar

Descubra o **IP atual da impressora** (na configuração de impressoras da Sirrus, ou imprimindo
a página de autoteste da impressora — segure o botão FEED ao ligar).

Abra `config.json` no Bloco de Notas e troque o IP:

```json
"impressora": { "ip": "192.168.0.100", "porta": 9100 },
```

Se os acentos saírem errados na tela, troque `"codificacao": "cp850"` por `"cp860"` ou `"latin1"`.

## 3. Testar SEM mexer na Sirrus

1. Dê dois cliques em `iniciar-kds.bat`. A janela mostra os endereços — **não feche essa janela**.
2. Abra o Chrome e acesse `http://localhost:8080`.
3. Dê dois cliques em `testar-comprovantes.bat`. Devem aparecer 3 pedidos na tela **e** 3 comprovantes
   devem sair na impressora. Se o papel saiu, o repasse está funcionando.
4. Na tela do caixa, acesse `http://IP-DO-PC-DA-COZINHA:8080` (o endereço aparece na janela preta).

## 4. Ligar de verdade (faça num horário calmo)

Na Sirrus (e onde estiver configurada a impressão do Cook Mobile), troque o **IP da impressora
da cozinha** pelo **IP do PC da cozinha**, mantendo a porta 9100.

- Se a impressora estiver instalada no Windows (Painel de Controle → Impressoras → Propriedades
  da impressora → Portas → Configurar porta), troque o endereço ali.
- Se a Sirrus roda no próprio PC da cozinha, use `127.0.0.1`.

Faça um pedido de teste de mesa, um do site e um manual. Os três devem aparecer na tela e no papel.

**Para voltar atrás** a qualquer momento: coloque de novo o IP original da impressora na Sirrus.
Tudo volta a ser como antes.

## 5. Abrir sozinho ao ligar o PC

1. Aperte `Windows + R`, digite `shell:startup` e Enter.
2. Crie ali um atalho para `C:\KDS\iniciar-kds.bat`.
3. No Chrome, deixe `http://localhost:8080` como página inicial e use `F11` para tela cheia.

Se o servidor travar, o `iniciar-kds.bat` reinicia sozinho em 5 segundos. Os pedidos ficam salvos
em `dados\estado.json` e voltam para a tela.

## Uso no dia a dia

| Ação | Onde |
|---|---|
| Item pronto | Toque no item (toque de novo desfaz) |
| Pedido pronto | **Expedir pedido** — é aqui que o cronômetro para e o tempo vai para as métricas |
| Expediu errado | **↶ Desfazer expedição** |
| Pedido cancelado ou duplicado | Link **comprovante** no card → *Remover pedido da tela* |
| Card com "⚠ Leitura incompleta" | Abra o **comprovante** no card e confira. Me mande uma foto desse comprovante para eu ajustar a leitura |
| Pico | **Modo compacto** — cabem bem mais pedidos por tela |
| Fim do expediente | **Métricas → Fechar o dia**. Arquiva o dia e zera a tela (as baixas na Sirrus continuam como hoje) |

Faixa vermelha no topo = a impressora não está respondendo. Os pedidos continuam chegando na tela,
mas o papel não sai — verifique se a impressora está ligada e com cabo.

## Arquivos

- `server.js` — servidor (captura da impressão + telas)
- `parser.js` — leitura dos comprovantes
- `public/index.html` — telas do KDS, lançamento e métricas
- `dados/` — pedidos, fechamentos diários e cópia bruta de cada comprovante recebido (`dados/comprovantes`).
  Esses arquivos brutos servem para ajustar a leitura ao formato exato da Sirrus.
