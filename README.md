# Road to Statuette — CRM de tráfego v2

Esta versão separa abandono por **modo + etapa exata** e foi preparada para acompanhar o arquivo mais recente do jogo sem precisar manter um HTML instrumentado paralelo.

## Base do repositório verificada

Em 14/08/2026, o `main` de `IaumB/roadtostatuette` estava no commit `14db0fa6d12dc5d937a84e4713804157559ede59`. O arquivo de jogo mais novo presente no repositório era `road_to_statuette_WIKIDATA_Pix.html`.

## Como ligar ao repositório

Coloque estes três arquivos na raiz do clone local do repositório:

- `analytics_server.py`
- `analytics.js`
- `crm.html`

O servidor procura o jogo nesta ordem:

1. caminho definido em `RT_GAME_FILE`;
2. `road_to_statuette_WIKIDATA_Pix.html`;
3. `road_to_statuette_WIKIDATA.html`;
4. `road_to_statuette_ANALYTICS.html` como fallback.

Ele **não altera o HTML do jogo**. Ao servir `/`, injeta `analytics.js` em memória. Portanto, depois de um `git pull`, basta reiniciar o servidor para ele usar o arquivo atual da pasta.

```bash
python analytics_server.py
```

Jogo: `http://127.0.0.1:8080/`

CRM: `http://127.0.0.1:8080/crm`

Diagnóstico: `http://127.0.0.1:8080/health`

O `/health` informa qual arquivo está sendo servido.

### Escolher explicitamente outro HTML

Linux/macOS:

```bash
RT_GAME_FILE=meu_jogo.html python analytics_server.py
```

PowerShell:

```powershell
$env:RT_GAME_FILE="meu_jogo.html"
python analytics_server.py
```

## Abandono v2

Antes, o painel agrupava apenas por `stage`. Assim, um abandono em `draft` da Corrida e outro em `draft` da Maratona apareciam na mesma linha.

Agora o backend agrupa por:

`mode + stage`

Exemplos de linhas independentes:

- Corrida · Draft · aguardando giro
- Corrida · Draft · escolhendo carta
- Corrida · Torneio · entre rodadas
- Maratona · Draft · aguardando giro
- Maratona · Draft · escolhendo carta
- Maratona · Torneio · entre rodadas
- Academia · Draft · escolhendo carta
- Noite de Gala · passagem de vez
- Noite de Gala · cerimônia

O CRM mostra também, para cada modo, `abandonos / jogos iniciados`, permitindo comparar a taxa de abandono entre modos com volumes diferentes.

## Eventos e mídia paga

Continuam disponíveis pageview, sessão, UTM, IDs de clique, dispositivo, tempo ativo, modo escolhido, início da partida, giros, escolha de carta, draft completo, torneio, rodadas, conclusão, replay e abandono.

O CSV exportado contém `mode` e `stage` em colunas separadas.

## Privacidade

O coletor não envia os nomes digitados pelos jogadores. O servidor não salva IP no banco de eventos. O banner de consentimento continua ativo por padrão.

## Proteger o CRM

Opcionalmente:

```bash
CRM_USER=admin CRM_PASSWORD='uma-senha-forte' python analytics_server.py
```

Em produção, use HTTPS e mantenha o CRM fora de acesso público sempre que possível.
