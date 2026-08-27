/**
 * script.js
 * Motor principal do jogo: menu, modos (draft, torneio, gala de premiação),
 * navegação entre telas e placar. Ainda concentra a maior parte da lógica —
 * outros pedaços (dados dos filmes, helpers de DOM, geração de imagem para
 * compartilhar) já foram extraídos para seus próprios arquivos.
 */
import { DADOS } from './dados-filmes.js';
import { $, sortear } from './dom-helpers.js';
import { gerarImagemElenco } from './canvas-utils.js';
import { faixa, cartaDe, htmlCarta } from './cartas.js';

const CATS = DADOS.cats;
const FILMES = DADOS.filmes;
const ROTULOS = Object.fromEntries(CATS.map(c => [c.id, c.label]));
const RODADAS = 8;
// destino do botão de apoio no rodapé — troque pelo seu link do pix.gg
const LINK_APOIO = 'https://pixgg.com/ian.brito';
// destino do botão de voltar ao hub
const LINK_HUB = "/";

const GIROS_EXTRAS = 3;   // rodadas de "não gostei" para o draft inteiro
const PAUSA_DUELO = 900;  // ms entre a revelação de um embate e o próximo


/* ---------- modos ---------- */
const MODOS = {
  corrida: {
    nome: 'Temporada de Prêmios',
    cor: '#d4af37', corClara: '#f0d878',
    curto: 'O caminho longo: 8 rodadas de mata-mata, uma derrota elimina.',
    detalhes: [
      'Elenco de 6 contra 8 filmes sorteados, um por rodada',
      'Cada categoria vale um ponto: maior Overall vence',
      'Uma derrota elimina; empate decide na média',
    ],
    regras: '8 rodadas · 3 trocas · sozinho',
    trocas: 3, rodadas: 8, rival: 'sorteado',
  },
  academia: {
    nome: 'Sorteio do Dia',
    cor: '#4fa8c9', corClara: '#8fd3ea',
    curto: 'Um desafio por dia, ancorado num vencedor de Melhor Filme. Uma tentativa oficial, depois treino livre.',
    detalhes: [
      'Todo dia um vencedor de Melhor Filme dá o tema da rodada',
      'O adversário sai entre os indicados daquele ano',
      'Uma tentativa oficial por dia; depois, treino livre',
    ],
    regras: '1 partida por dia · 3 trocas · sequência salva',
    trocas: 3, rodadas: 1, rival: 'ano',
  },
  gala: {
    nome: 'Noite de Gala',
    cor: '#a06be0', corClara: '#c9a4f5',
    curto: 'De 2 a 6 pessoas no mesmo aparelho, escalando em rodízio. No fim, a cerimônia entrega as estatuetas.',
    detalhes: [
      'De 2 a 6 jogadores, cada um nomeia o seu filme',
      'Rodízio: gira, escala uma carta e passa adiante',
      'Uma estatueta por categoria; quem tiver mais leva Melhor Filme',
    ],
    regras: '2 a 6 jogadores · 3 trocas cada · cerimônia no fim',
    multi: true,
    trocas: 3, rodadas: 0, rival: 'gala',
  },
  maratona: {
    nome: 'Maratona',
    cor: '#e0703c', corClara: '#f5a077',
    curto: 'Um time só contra adversários sem fim. O placar é a sequência.',
    detalhes: [
      'Um elenco contra adversários sorteados, sem fim',
      'Cada vitória aumenta a sequência; a primeira derrota encerra',
      'O recorde fica salvo neste aparelho',
    ],
    regras: 'sem limite de rodadas · 3 trocas · recorde salvo',
    trocas: 3, rodadas: Infinity, rival: 'sorteado',
  },
};

/* ---------- estado ---------- */
let modo = 'corrida';
let time = {};        // catId -> { filme, carta }
let giroAtual = null;
let girosExtras = 3;  // estoque de trocas do draft inteiro
let revelando = false;
// Cada revelação de duelo recebe um número. Trocar de modo ou reiniciar avança o
// contador, e os temporizadores da revelação antiga desistem em vez de mexer
// num time que já foi zerado.
let geracaoDuelo = 0;
let adversarios = [];
let rodada = 0;
let vitorias = 0;
let historico = [];
let catsVencidas = 0, catsPerdidas = 0;
let desafioHoje = null;   // { ancora, cartas } do desafio do dia
let oficialHoje = false;  // a partida em curso conta para o placar diário
let nomeFilmeJogador = ''; // nome que o jogador dá ao próprio filme, na claquete
let jogadores = [];       // Noite de Gala: [{ nome, time, girosExtras, estatuetas }]
let vez = 0;              // índice do jogador da vez
let qtdJogadores = 3;

const M = () => MODOS[modo];

/* ---------- memória entre sessões ---------- */
const DEPOSITO = 'academy_draft_v1';
function lerDados(){
  try { return JSON.parse(localStorage.getItem(DEPOSITO)) || {}; } catch (e) { return {}; }
}
function gravarDados(d){
  try { localStorage.setItem(DEPOSITO, JSON.stringify(d)); } catch (e) {}
}

/* ---------- sorteio estável do dia ---------- */
const diaISO = (d) => d.getFullYear() + '-' +
  String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

function semente(txt){
  let h = 2166136261;
  for (let i = 0; i < txt.length; i++){ h ^= txt.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rngCom(s){
  let a = s;
  return () => {
    a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const VENCEDORES_BP = FILMES.filter(f => f.bp === 2);

// O adversário do dia sai sorteado entre os indicados daquele ano, categoria por
// categoria. Por isso às vezes vem um time fraco e às vezes um monstro.
function desafioDoDia(dia){
  const r = rngCom(semente('academy-draft|' + dia));
  const ancora = VENCEDORES_BP[Math.floor(r() * VENCEDORES_BP.length)];
  const doAno = FILMES.filter(f => f.a === ancora.a);
  const escolhas = CATS.map(cat => {
    const f = doAno[Math.floor(r() * doAno.length)];
    return { filme: f, carta: cartaDe(f, cat.id) };
  });
  return { ancora, escolhas };
}

function timeComposto(nome, ano, escolhas){
  return {
    t: nome, o: nome, a: ano, r: 0, n: 0, w: 0,
    composto: escolhas,
    c: escolhas.map(e => e.carta),
  };
}
function filmeDaCarta(t, catId){
  if (t.composto){
    const e = t.composto.find(x => x.carta.k === catId);
    return e ? e.filme.t : t.t;
  }
  return t.t;
}

function estadoDiario(){
  const d = lerDados();
  const dia = diaISO(new Date());
  return {
    dia,
    jogado: !!(d.diario && d.diario.dia === dia),
    reg: (d.diario && d.diario.dia === dia) ? d.diario : null,
    streak: d.streak || 0,
    melhor: d.melhorStreak || 0,
  };
}
function registrarDiario(venceu, placar){
  const d = lerDados();
  const dia = diaISO(new Date());
  if (d.diario && d.diario.dia === dia) return;   // treino nunca conta
  d.diario = { dia, venceu, placar };
  if (venceu){
    const ontem = diaISO(new Date(Date.now() - 86400000));
    d.streak = (d.ultimoDia === ontem ? (d.streak || 0) : 0) + 1;
    d.melhorStreak = Math.max(d.melhorStreak || 0, d.streak);
  } else {
    d.streak = 0;
  }
  d.ultimoDia = dia;
  // histórico curto, para desenhar a semana; guarda 90 dias e descarta o resto
  d.dias = d.dias || {};
  d.dias[dia] = venceu ? 1 : 0;
  const limite = diaISO(new Date(Date.now() - 90 * 86400000));
  for (const k of Object.keys(d.dias)) if (k < limite) delete d.dias[k];
  gravarDados(d);
}

// os últimos 7 dias, do mais antigo para hoje
// semana fixa de domingo a sábado, não os últimos 7 dias corridos
function semanaDiaria(){
  const d = lerDados();
  const dias = d.dias || {};
  const presenca = d.presenca || {};
  const hoje = new Date();
  const domingo = new Date(hoje);
  domingo.setDate(hoje.getDate() - hoje.getDay());
  const isoHoje = diaISO(hoje);
  return Array.from({ length: 7 }, (_, i) => {
    const data = new Date(domingo.getTime() + i * 86400000);
    const iso = diaISO(data);
    return {
      iso,
      letra: ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'][i],
      hoje: iso === isoHoje,
      // dourado cheio = encarou o desafio do dia (venceu ou não);
      // dourado vazado = apareceu e jogou algum outro modo
      estado: dias[iso] === 1 ? 'ganhou'
            : iso in dias ? 'diario'
            : presenca[iso] ? 'jogou' : 'vazio',
    };
  });
}

// Marca que a pessoa apareceu e jogou hoje, em qualquer modo. É o que acende o
// dia na tira da semana, independente de ter vencido o desafio diário.
function registrarPresenca(){
  const d = lerDados();
  const dia = diaISO(new Date());
  d.presenca = d.presenca || {};
  if (d.presenca[dia]) return;
  d.presenca[dia] = 1;
  const limite = diaISO(new Date(Date.now() - 90 * 86400000));
  for (const k of Object.keys(d.presenca)) if (k < limite) delete d.presenca[k];
  gravarDados(d);
}

/* ---------- troca de tela com cortina ---------- */
function comCortina(troca){
  const t = $('#transicao');
  t.classList.add('rodando');
  requestAnimationFrame(() => t.classList.add('fechada'));
  setTimeout(() => { troca(); window.scrollTo({ top: 0 }); }, 640);
  setTimeout(() => t.classList.remove('fechada'), 880);
  setTimeout(() => t.classList.remove('rodando'), 1540);
}
const TELAS = ['#tela-inicio', '#tela-draft', '#tela-torneio', '#tela-nomes', '#tela-passagem', '#tela-cerimonia'];
function mostrarTela(qual){
  TELAS.forEach(s => $(s).classList.add('oculto'));
  $(qual).classList.remove('oculto');
  // na escolha de modo o destino é o hub; dentro do jogo, a tela anterior
  const noInicio = qual === '#tela-inicio';
  $('#btn-hub').classList.toggle('oculto', !noInicio);
  $('#btn-voltar-tela').classList.toggle('oculto', noInicio);
}

/* ---------- sequência diária ---------- */
function renderSequencia(){
  const dia = estadoDiario();
  const semana = semanaDiaria();
  const jogouHoje = dia.jogado;

  $('#sequencia').innerHTML =
    '<span class="fogo">' + (dia.streak > 0 ? '&#128293;' : '&#127916;') + '</span>' +
    '<span class="chama"><span class="n">' + dia.streak + '</span>' +
      '<span class="rot">' + (dia.streak === 1 ? 'dia seguido' : 'dias seguidos') + '</span></span>' +
    (dia.melhor > dia.streak ? '<span class="recorde">recorde: ' + dia.melhor + '</span>' : '') +
    '<span class="aviso">' + (jogouHoje
        ? (dia.reg.venceu ? 'Desafio de hoje vencido' : 'Hoje não deu &middot; volte amanhã')
        : 'Desafio de hoje em aberto') + '</span>' +
    '<span class="semana">' + semana.map((d) =>
      '<span class="dia-sel ' + d.estado + (d.hoje ? ' hoje' : '') + '">' +
      d.letra + '</span>').join('') + '</span>';
}

// Selo que diz de cara se o modo é sozinho ou com gente na sala.
// O ícone é SVG, e não emoji, porque emoji vem com cor própria e escura:
// assim ele herda a cor clara do modo e fica legível no fundo preto.
const ICONE_SOLO =
  '<svg class="icone" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
    '<circle cx="12" cy="7.2" r="4.2"/>' +
    '<path d="M12 13.4c-4.5 0-8.2 2.7-8.2 6V21h16.4v-1.6c0-3.3-3.7-6-8.2-6z"/>' +
  '</svg>';
const ICONE_MULTI =
  '<svg class="icone larga" viewBox="0 0 30 24" fill="currentColor" aria-hidden="true">' +
    '<circle cx="10" cy="7.2" r="4.2"/>' +
    '<path d="M10 13.4c-4.5 0-8.2 2.7-8.2 6V21h16.4v-1.6c0-3.3-3.7-6-8.2-6z"/>' +
    '<circle cx="21.5" cy="8.4" r="3.4" opacity=".72"/>' +
    '<path d="M21.5 14c-1.4 0-2.7.3-3.8.8 1.5 1.3 2.4 3 2.4 4.8V21h8.2v-1.4c0-3-3-5.6-6.8-5.6z" opacity=".72"/>' +
  '</svg>';

function seloJogadores(m){
  return m.multi
    ? '<span class="selo-jogadores">' + ICONE_MULTI + '2 a 6 jogadores</span>'
    : '<span class="selo-jogadores">' + ICONE_SOLO + 'Solo</span>';
}

/* ---------- como jogar ---------- */
function abrirAjuda(id){
  const m = MODOS[id];
  const caixa = $('#modal-ajuda .caixa-ajuda');
  caixa.style.setProperty('--cor', m.cor);
  caixa.style.setProperty('--cor-clara', m.corClara);
  $('#ajuda-jogadores').outerHTML = seloJogadores(m).replace('class="selo-jogadores"', 'class="selo-jogadores" id="ajuda-jogadores"');
  $('#ajuda-titulo').textContent = m.nome;
  $('#ajuda-chamada').textContent = m.curto;
  $('#ajuda-detalhes').innerHTML = m.detalhes.map(d => '<li>' + d + '</li>').join('');
  $('#ajuda-regras').textContent = m.regras;
  $('#modal-ajuda').classList.remove('oculto');
}
function fecharAjuda(){ $('#modal-ajuda').classList.add('oculto'); }

// a explicação aparece sozinha só na primeira vez em cada modo
function jaViuAjuda(id){
  const d = lerDados();
  return !!(d.tutoriais && d.tutoriais[id]);
}
function marcarAjudaVista(id){
  const d = lerDados();
  d.tutoriais = d.tutoriais || {};
  d.tutoriais[id] = 1;
  gravarDados(d);
}

/* ---------- menu ---------- */
function renderMenu(){
  renderSequencia();
  const dia = estadoDiario();
  const dados = lerDados();
  const recorde = dados.recordeMaratona || 0;
  const desafio = desafioDoDia(dia.dia);

  const extras = {
    academia: (dia.jogado
        ? '<span class="tag ' + (dia.reg.venceu ? 'feito' : 'perdido') + '">' +
          (dia.reg.venceu ? 'vencido hoje &middot; ' + dia.reg.placar : 'perdido hoje &middot; ' + dia.reg.placar) +
          '</span>'
        : '<span class="tag">tentativa de hoje em aberto</span>') +
      '<span class="placar-modo">Hoje é a temporada de <strong>' + desafio.ancora.t + '</strong> (' + desafio.ancora.a + ')' +
      (dia.streak ? ' &middot; sequência de ' + dia.streak : '') + '</span>',
    maratona: recorde ? '<span class="placar-modo">Seu recorde: ' + recorde +
      (recorde > 1 ? ' vitórias seguidas' : ' vitória') + '</span>' : '',
    corrida: '', gala: '',
  };

  $('#modos').innerHTML = Object.keys(MODOS).map(id => {
    const m = MODOS[id];
    return '<button class="modo" data-modo="' + id + '" style="--cor:' + m.cor + ';--cor-clara:' + m.corClara + '">' +
      seloJogadores(m) +
      '<h3>' + m.nome + '</h3>' +
      '<p class="chamada">' + m.curto + '</p>' +
      (extras[id] || '') +
    '</button>';
  }).join('');

  $('#modos').querySelectorAll('.modo').forEach(el => {
    el.onclick = () => comCortina(() => iniciarModo(el.dataset.modo));
  });
}

/* ---------- início de partida ---------- */
function iniciarModo(id){
  modo = id;
  time = {}; giroAtual = null; historico = []; nomeFilmeJogador = '';
  rodada = 0; vitorias = 0; catsVencidas = 0; catsPerdidas = 0;
  revelando = false;
  geracaoDuelo++;
  girosExtras = M().trocas;
  fecharPalco();
  registrarPresenca();

  // na primeira vez em cada modo, a explicação abre sozinha
  if (!jaViuAjuda(id)){
    abrirAjuda(id);
    marcarAjudaVista(id);
  }

  if (modo === 'academia'){
    const dia = estadoDiario();
    desafioHoje = desafioDoDia(dia.dia);
    oficialHoje = !dia.jogado;
  } else {
    desafioHoje = null;
    oficialHoje = false;
  }

  $('#modo-titulo').textContent = M().nome;
  $('#modo-sub').innerHTML = modo === 'academia'
    ? 'Hoje é a temporada de <strong>' + desafioHoje.ancora.t + '</strong> (' + desafioHoje.ancora.a + '). ' +
      'O adversário sai sorteado entre os indicados daquele ano. ' +
      (oficialHoje ? 'Esta é a sua tentativa oficial.' : 'Tentativa de hoje já usada: isto aqui é treino e não conta.')
    : M().curto;

  $('#fila-gala').classList.add('oculto');
  // a cor do modo escolhido acompanha o jogador nas telas seguintes
  document.body.classList.add('jogando');
  document.documentElement.style.setProperty('--cor-modo', M().cor);
  document.documentElement.style.setProperty('--cor-modo-clara', M().corClara);

  if (modo === 'gala'){ telaNomes(); return; }

  mostrarTela('#tela-draft');
  atualizarDraft();
  girar();
}

/* ---------- Noite de Gala ---------- */
function telaNomes(){
  $('#qtd-jogadores').innerHTML = '<span>Quantos jogam</span>' +
    [2,3,4,5,6].map(n => '<button data-n="' + n + '"' +
      (n === qtdJogadores ? ' class="ativo"' : '') + '>' + n + '</button>').join('');
  $('#qtd-jogadores').querySelectorAll('button').forEach(b => {
    b.onclick = () => { qtdJogadores = +b.dataset.n; telaNomes(); };
  });

  const antigos = [...document.querySelectorAll('.campo-nome input')].map(i => i.value);
  $('#lista-nomes').innerHTML = Array.from({ length: qtdJogadores }, (_, i) =>
    '<div class="campo-nome"><label>Filme ' + (i + 1) + '</label>' +
    '<input maxlength="28" placeholder="Nome do seu filme" value="' +
      (antigos[i] || '').replace(/"/g, '&quot;') + '"></div>').join('');

  mostrarTela('#tela-nomes');
}

function comecarGala(){
  const entradas = [...document.querySelectorAll('.campo-nome input')];
  jogadores = entradas.map((inp, i) => ({
    nome: (inp.value.trim() || 'Filme ' + (i + 1)).slice(0, 28),
    time: {}, girosExtras: M().trocas, estatuetas: 0,
  }));
  vez = 0;
  comCortina(() => passarAVez());
}

const escalacoesFeitas = (j) => Object.keys(j.time).length;

function renderFilaGala(){
  const fila = $('#fila-gala');
  fila.classList.remove('oculto');
  fila.innerHTML = jogadores.map((j, i) => {
    // o jogador da vez tem o contador vivo; os outros, o que ficou guardado
    const trocas = i === vez ? girosExtras : j.girosExtras;
    return '<span class="ficha' + (i === vez ? ' vez' : '') +
      (escalacoesFeitas(j) === CATS.length ? ' completo' : '') + '">' +
      '<span class="nome-ficha">' + j.nome + '</span>' +
      '<span class="cheio">' + escalacoesFeitas(j) + '/' + CATS.length +
      ' · ' + trocas + (trocas === 1 ? ' troca' : ' trocas') + '</span></span>';
  }).join('');
}

function passarAVez(){
  const j = jogadores[vez];
  $('#passagem-nome').textContent = j.nome;
  $('#passagem-sub').textContent = 'Escalação ' + (escalacoesFeitas(j) + 1) + ' de ' + CATS.length +
    ' · ' + j.girosExtras + (j.girosExtras === 1 ? ' troca disponível' : ' trocas disponíveis');
  mostrarTela('#tela-passagem');
}

function comecarVez(){
  const j = jogadores[vez];
  time = j.time;
  girosExtras = j.girosExtras;
  giroAtual = null;
  $('#modo-titulo').textContent = M().nome;
  $('#modo-sub').innerHTML = 'Vez de <strong>' + j.nome + '</strong> · uma carta por rodada';
  comCortina(() => {
    mostrarTela('#tela-draft');
    atualizarDraft();
    girar();
  });
}

// No rodízio cada jogador escala uma carta e passa adiante.
function fimDaJogada(){
  jogadores[vez].girosExtras = girosExtras;
  if (jogadores.every(j => escalacoesFeitas(j) === CATS.length)){
    comCortina(() => cerimonia());
    return;
  }
  do { vez = (vez + 1) % jogadores.length; }
  while (escalacoesFeitas(jogadores[vez]) === CATS.length);
  comCortina(() => passarAVez());
}

const mediaDe = (t) => CATS.reduce((s, c) => s + t[c.id].carta.ov, 0) / CATS.length;

function renderQuadroGala(){
  const lider = Math.max(...jogadores.map(j => j.estatuetas));
  $('#quadro-gala').innerHTML = jogadores.map((j, i) =>
    '<div class="linha-gala' + (j.estatuetas === lider && lider > 0 ? ' lider' : '') + '" data-j="' + i + '">' +
      '<span class="nome-filme">' + j.nome + '</span>' +
      '<span class="conta">' + j.estatuetas + '</span></div>').join('');
}

// a matriz nasce montada e fechada; cada envelope abre uma linha
function montarMatriz(){
  const cabeca = '<tr><th class="cat"></th>' +
    jogadores.map(j => '<th>' + j.nome + '</th>').join('') + '</tr>';
  const corpo = CATS.map((cat, i) =>
    '<tr class="fechada" data-linha="' + i + '"><td class="cat">' + cat.label + '</td>' +
    jogadores.map((j, k) => '<td class="cel" data-l="' + i + '" data-c="' + k + '">' +
      '<span class="valor-cel">—</span></td>').join('') + '</tr>').join('');
  const rodape = '<tr><td class="cat">Estatuetas</td>' +
    jogadores.map((j, k) => '<td id="tot-' + k + '">0</td>').join('') + '</tr>';
  $('#premios').innerHTML = '<table><thead>' + cabeca + '</thead><tbody>' + corpo +
    '</tbody><tfoot>' + rodape + '</tfoot></table>';
}

function cerimonia(){
  jogadores.forEach(j => j.estatuetas = 0);
  mostrarTela('#tela-cerimonia');
  $('#painel-melhor-filme').classList.add('oculto');
  $('#btn-compartilhar-gala').classList.add('oculto');
  montarMatriz();
  $('#sub-cerimonia').textContent = 'Uma estatueta por categoria, entre os ' +
    jogadores.length + ' filmes da noite.';
  $('#btn-premio').classList.remove('oculto');
  $('#btn-premio').disabled = false;
  $('#btn-premio').textContent = 'Abrir o primeiro envelope';
  renderQuadroGala();
  window.catPremio = 0;
}

function abrirEnvelope(){
  const i = window.catPremio;
  if (i >= CATS.length) return;
  const cat = CATS[i];
  const btn = $('#btn-premio');
  btn.disabled = true;

  // maior Overall leva; empate se decide pela média do elenco
  const disputa = jogadores.map(j => ({ j, carta: j.time[cat.id].carta, filme: j.time[cat.id].filme }))
    .sort((a, b) => b.carta.ov - a.carta.ov || mediaDe(b.j.time) - mediaDe(a.j.time));
  const venc = disputa[0];
  venc.j.estatuetas++;

  // preenche a linha da categoria: cada jogador na sua coluna
  const linha = $('#premios tr[data-linha="' + i + '"]');
  linha.classList.remove('fechada');
  linha.classList.add('aberta');
  jogadores.forEach((j, k) => {
    const cel = linha.querySelector('td.cel[data-c="' + k + '"]');
    const carta = j.time[cat.id].carta;
    const ganhou = j === venc.j;
    if (ganhou) cel.classList.add('venceu');
    cel.innerHTML = (ganhou ? '<span class="trofeu">&#127942;</span>' : '') +
      carta.ov + '<span class="quem">' + carta.p + '</span>';
  });
  linha.querySelector('td.cat').textContent = venc.carta.l || cat.label;

  renderQuadroGala();
  const idx = jogadores.indexOf(venc.j);
  const tot = $('#tot-' + idx);
  if (tot){ tot.textContent = venc.j.estatuetas; void tot.offsetWidth; }
  const conta = $('#quadro-gala .linha-gala[data-j="' + idx + '"] .conta');
  if (conta){ void conta.offsetWidth; conta.classList.add('pulso'); }

  window.catPremio++;
  setTimeout(() => {
    btn.disabled = false;
    if (window.catPremio >= CATS.length){
      btn.classList.add('oculto');
      anunciarMelhorFilme();
    } else {
      btn.textContent = 'Próximo envelope (' + (CATS.length - window.catPremio) + ')';
    }
  }, 650);
}

function anunciarMelhorFilme(){
  const ranking = [...jogadores].sort((a, b) =>
    b.estatuetas - a.estatuetas || mediaDe(b.time) - mediaDe(a.time));
  const campeao = ranking[0];
  const empatou = ranking[1] && ranking[1].estatuetas === campeao.estatuetas;

  $('#painel-melhor-filme').classList.remove('oculto');
  $('#titulo-melhor-filme').innerHTML = '&#127942; Melhor Filme: ' + campeao.nome;
  $('#sub-melhor-filme').innerHTML =
    campeao.estatuetas + (campeao.estatuetas === 1 ? ' estatueta' : ' estatuetas') +
    ' · média do elenco ' + fmtMedia(mediaDe(campeao.time)) +
    (empatou ? ' · desempate na média do elenco' : '') +
    '<br><span style="font-size:12px">Classificação: ' +
    ranking.map((j, i) => (i + 1) + 'º ' + j.nome + ' (' + j.estatuetas + ')').join(' · ') +
    '</span>';
  renderTime($('#elenco-vencedor'), false, campeao.time);
  $('#btn-compartilhar-gala').classList.remove('oculto');
  setTimeout(() => $('#painel-melhor-filme').scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
}

/* ---------- draft ---------- */
function renderTime(alvo, interativo, qual){
  const t = qual || time;
  const campos = CATS.map(cat => {
    const escolhido = t[cat.id];
    if (!escolhido){
      // a claquete só mostra o time: escalar é clicando na carta do giro
      return '<div class="campo vaga">' +
        '<span class="rotulo">' + cat.label + '</span>' +
        '<span class="valor">a definir</span>' +
        '<span class="risco"></span></div>';
    }
    const c = escolhido.carta;
    return '<div class="campo ' + faixa(c.ov) + '">' +
      '<span class="rotulo">' + (c.l || cat.label) + '</span>' +
      '<span class="valor"><span class="nota">' + c.ov + '</span>' + c.p +
        (c.v ? ' &#127942;' : '') + '</span>' +
      '<span class="fonte">' + escolhido.filme.t + ' &middot; ' + escolhido.filme.a + '</span></div>';
  }).join('');

  // o nome do filme fica na própria claquete, como a linha de produção da lousa
  const nome = qual ? nomeDoTime(qual) : nomeDoTime(time);
  const editavel = interativo && modo !== 'gala';
  const titulo =
    '<div class="titulo-claquete">' +
      '<span class="rot-claquete">Produção</span>' +
      '<input class="entrada-filme" maxlength="28" value="' + nome.replace(/"/g, '&quot;') + '"' +
        (editavel ? ' placeholder="dê um nome ao seu filme"' : ' readonly') + '></div>';

  alvo.innerHTML =
    '<div class="claquete">' +
      '<div class="bracos"></div><div class="pino"></div>' +
      '<div class="base"></div>' +
      titulo +
      '<div class="campos">' + campos + '</div>' +
    '</div>';

  if (editavel){
    const inp = alvo.querySelector('.entrada-filme');
    inp.oninput = () => { nomeFilmeJogador = inp.value; };
  }
}

// na Noite de Gala o nome vem do jogador da vez; nos outros modos é do próprio jogador
function nomeDoTime(t){
  if (modo === 'gala'){
    const j = jogadores.find(x => x.time === t);
    return j ? j.nome : '';
  }
  return nomeFilmeJogador;
}

/* ---------- compartilhar score ---------- */
let textoScoreAtual = '';

function mediaElencoScore(t){
  const vals = CATS.map(c => t && t[c.id] && t[c.id].carta ? t[c.id].carta.ov : null).filter(v => v !== null);
  return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
}
// uma faixa de quadradinhos com o resultado das últimas rodadas, tipo Wordle
function trilhaScore(){
  if (!historico.length) return '';
  const limite = 12;
  const fatia = historico.slice(-limite);
  return (historico.length > limite ? '…' : '') + fatia.map((h) => h.ganhou ? '\u{1F7E9}' : '\u{1F7E5}').join('');
}
function montarTextoScore(){
  const linhas = ['Road to Statuette \u{1F3AC}'];
  if (modo === 'corrida'){
    const ultimo = historico[historico.length - 1];
    const campeao = !!(ultimo && ultimo.ganhou && rodada >= M().rodadas);
    linhas.push('\u{1F3C6} ' + (nomeDoTime(time) || M().nome) + ' \u{00B7} ' + (campeao ? 'CAMPEÃO' : 'eliminado'));
    linhas.push('\u{1F39E}️ ' + trilhaScore() + '  ' + vitorias + '/' + M().rodadas);
    linhas.push('⭐ Elenco ' + fmtMedia(mediaElencoScore(time)));
  } else if (modo === 'academia'){
    const h = historico[historico.length - 1];
    const d = lerDados();
    linhas.push('\u{1F39F}️ Sorteio do Dia \u{00B7} ' + (h && h.ganhou ? '✅ vitória' : '❌ derrota'));
    if (h) linhas.push('\u{1F3AC} Placar ' + h.meus + '×' + h.dele + ' \u{00B7} elenco ' + fmtMedia(mediaElencoScore(time)));
    linhas.push('\u{1F525} Sequência ' + (d.streak || 0) + ' \u{00B7} recorde ' + (d.melhorStreak || 0));
  } else if (modo === 'maratona'){
    const d = lerDados();
    linhas.push('\u{1F525} Maratona \u{00B7} ' + vitorias + (vitorias === 1 ? ' vitória' : ' vitórias'));
    linhas.push('\u{1F39E}️ ' + (trilhaScore() || '\u{1F7E5}'));
    linhas.push('\u{1F3C5} Recorde ' + (d.recordeMaratona || 0) + ' \u{00B7} elenco ' + fmtMedia(mediaElencoScore(time)));
  } else if (modo === 'gala'){
    const ranking = [...jogadores].sort((a, b) => b.estatuetas - a.estatuetas || mediaDe(b.time) - mediaDe(a.time));
    const campeao = ranking[0];
    linhas.push('\u{1F3AD} Noite de Gala \u{00B7} ' + jogadores.length + (jogadores.length === 1 ? ' filme' : ' filmes'));
    if (campeao){
      linhas.push('\u{1F3C6} Melhor Filme: ' + campeao.nome);
      linhas.push('\u{1F3C5} ' + campeao.estatuetas + '/' + CATS.length + ' estatuetas \u{00B7} elenco ' + fmtMedia(mediaDe(campeao.time)));
    }
  }
  linhas.push('#RoadToStatuette');
  linhas.push(location.origin + location.pathname);
  return linhas.join('\n');
}
function abrirCompartilhamento(){
  textoScoreAtual = montarTextoScore();
  $('#share-preview').textContent = textoScoreAtual;
  $('#btn-copiar-score').innerHTML = '&#128203; Copiar resultado';
  $('#modal-share').classList.remove('oculto');
  window.RTAnalytics?.track('share_open');
  setTimeout(() => $('#btn-copiar-score').focus(), 0);
}
function fecharCompartilhamento(){ $('#modal-share').classList.add('oculto'); }
async function copiarScore(){
  const texto = textoScoreAtual || montarTextoScore();
  let ok = false;
  try {
    if (navigator.clipboard && window.isSecureContext){ await navigator.clipboard.writeText(texto); ok = true; }
  } catch (e){}
  if (!ok){
    const area = document.createElement('textarea');
    area.value = texto; area.setAttribute('readonly', ''); area.style.position = 'fixed'; area.style.opacity = '0';
    document.body.appendChild(area); area.select();
    try { ok = document.execCommand('copy'); } catch (e){}
    area.remove();
  }
  window.RTAnalytics?.track('share_copy', { ok });
  const btn = $('#btn-copiar-score');
  btn.textContent = ok ? '✓ Copiado!' : 'Selecione e copie o texto';
  setTimeout(() => { btn.innerHTML = '&#128203; Copiar resultado'; }, 1800);
}
function abrirTwitterScore(){
  const texto = textoScoreAtual || montarTextoScore();
  window.RTAnalytics?.track('share_twitter');
  window.open('https://x.com/intent/tweet?text=' + encodeURIComponent(texto), '_blank', 'noopener,noreferrer,width=720,height=620');
}

function renderGiro(){
  const grade = $('#grade-giro');
  if (!giroAtual){
    grade.innerHTML = '';
    $('#titulo-giro').textContent = 'Giro';
    $('#sub-giro').textContent = 'Gire para sortear um filme.';
    return;
  }
  const f = giroAtual;
  $('#titulo-giro').innerHTML = f.t + (f.t !== f.o ? ' <span style="font-size:15px;opacity:.55">' + f.o + '</span>' : '');
  $('#sub-giro').textContent = f.a + ' · ' + (f.cr ? 'Crítica ' : 'Repercussão ') + f.r.toFixed(1) + ' · ' +
    f.n + (f.n > 1 ? ' indicações' : ' indicação') + (f.w ? ', ' + f.w + (f.w > 1 ? ' vitórias' : ' vitória') : '') +
    '  —  ' + (girosExtras ? girosExtras + (girosExtras > 1 ? ' trocas restantes' : ' troca restante') : 'sem trocas restantes');

  grade.innerHTML = CATS.map(cat => {
    const carta = cartaDe(f, cat.id);
    const usada = !!time[cat.id];
    const html = htmlCarta(f, carta, { clicavel: !usada, usada, attr: ' data-cat="' + cat.id + '"' });
    if (!usada) return html;
    return '<div style="position:relative">' + html + '<div class="aviso-usada">já escalado</div></div>';
  }).join('');

  grade.querySelectorAll('.carta.clicavel').forEach(el => {
    el.onclick = () => escalar(el.dataset.cat);
  });
}

function escalar(catId){
  if (!giroAtual || time[catId]) return;
  const filme = giroAtual;
  time[catId] = { filme, carta: cartaDe(filme, catId) };

  giroAtual = null;
  atualizarDraft();
  if (modo === 'gala'){
    setTimeout(fimDaJogada, 420);
  } else if (Object.keys(time).length === CATS.length){
    setTimeout(pedirNomeProducao, 420);
  }
}

function atualizarDraft(){
  const feitos = Object.keys(time).length;
  $('#status-draft').textContent = feitos + ' de ' + CATS.length + ' categorias preenchidas.' +
    (giroAtual ? ' Clique numa carta do giro para escalar.' : '');
  $('#prog').style.width = (feitos / CATS.length * 100) + '%';

  const btn = $('#btn-girar');
  if (!giroAtual){
    btn.disabled = false;
    btn.textContent = 'Girar filme';
  } else if (girosExtras > 0){
    btn.disabled = false;
    btn.textContent = 'Não gostei, trocar de filme (' + girosExtras + ')';
  } else {
    btn.disabled = true;
    btn.textContent = 'Sem trocas — escolha uma carta';
  }

  renderTime($('#grade-time'), true);
  if (modo === 'gala') renderFilaGala();
  renderGiro();
}

function girar(){
  if (giroAtual){
    if (girosExtras <= 0) return;
    girosExtras--;
  }
  // na gala nenhum filme se repete entre os jogadores: duas pessoas com a mesma
  // carta empatariam a categoria e a estatueta viraria sorteio
  const usados = new Set();
  if (modo === 'gala') jogadores.forEach(j => Object.values(j.time).forEach(e => usados.add(e.filme)));
  else Object.values(time).forEach(e => usados.add(e.filme));
  const disponiveis = FILMES.filter(f => f !== giroAtual && !usados.has(f));
  giroAtual = sortear(disponiveis.length ? disponiveis : FILMES);
  atualizarDraft();
}

/* ---------- partida ---------- */
function novoAdversarioSorteado(){
  const usados = new Set(Object.values(time).map(e => e.filme));
  historico.forEach(h => usados.add(h.filme));
  const pool = FILMES.filter(f => !usados.has(f));
  return sortear(pool.length ? pool : FILMES);
}

function pedirNomeProducao(){
  const campo = $("#campo-nome-producao");
  campo.value = nomeFilmeJogador;
  $("#modal-nome").classList.remove("oculto");
  setTimeout(() => campo.focus(), 60);
}

function fecharNomeProducao(salvar){
  if (salvar) nomeFilmeJogador = $("#campo-nome-producao").value.trim();
  $("#modal-nome").classList.add("oculto");
  comCortina(iniciarTorneio);
}

function iniciarTorneio(){
  mostrarTela('#tela-torneio');
  renderTime($('#grade-time-2'), false);
  $('#painel-caminho').classList.toggle('oculto', M().rodadas === 1);
  $('#btn-compartilhar-torneio').classList.add('oculto');

  adversarios = [];
  if (M().rival === 'sorteado' && M().rodadas !== Infinity){
    for (let i = 0; i < M().rodadas; i++) adversarios.push(novoAdversarioSorteado());
  } else if (M().rival === 'ano'){
    adversarios = [timeComposto('Indicados de ' + desafioHoje.ancora.a, desafioHoje.ancora.a, desafioHoje.escolhas)];
  }

  rodada = 0; vitorias = 0; historico = [];
  revelando = false;
  geracaoDuelo++;
  $('#btn-proxima').classList.remove('oculto');
  $('#btn-proxima').disabled = false;
  $('#btn-proxima').textContent = M().rodadas === 1 ? 'Revelar o duelo' : 'Rodada 1';
  $('#titulo-rodada').textContent = M().nome;
  $('#sub-rodada').textContent =
    modo === 'maratona' ? 'Vença enquanto conseguir. Empate no placar é decidido pela média.' :
    M().rodadas === 1 ? 'Uma partida só, categoria por categoria.' :
    M().rodadas + ' rodadas até o título. Empate é decidido pela média de Overall.';
  $('#placar').innerHTML = '';
  $('#duelos').innerHTML = '';
  renderCaminho('andando');
}

const fmtMedia = (n) => n.toFixed(1).replace('.', ',');

function proximaRodada(){
  if (revelando) return;
  const adv = adversarios[rodada] || (adversarios[rodada] = novoAdversarioSorteado());
  rodada++;
  revelando = true;

  const btn = $('#btn-proxima');
  btn.disabled = true;
  btn.textContent = 'Revelando...';

  $('#titulo-rodada').textContent = M().rodadas === 1 ? M().nome
    : 'Rodada ' + rodada + (M().rodadas === Infinity ? '' : ' de ' + M().rodadas);
  const meuNome = nomeDoTime(time) || 'Seu time';
  $('#sub-rodada').innerHTML = '<strong>' + meuNome + '</strong> contra <strong>' + adv.t + '</strong>' +
    (adv.composto ? '' : ' (' + adv.a + ')');
  $('#placar').innerHTML =
    '<div class="quem">' + meuNome + '</div>' +
    '<div class="contagem"><b id="pt-eu">0</b>&times;<b id="pt-ele">0</b></div>' +
    '<div class="quem dir">' + adv.t + '</div>' +
    '<div class="veredito" id="veredito"></div>';

  $('#duelos').innerHTML = CATS.map((cat, i) => {
    const minha = time[cat.id].carta;
    const dela = cartaDe(adv, cat.id);
    return '<div class="duelo oculta" data-i="' + i + '">' +
      '<div class="lado"><span>' + minha.p + (minha.v ? ' &#127942;' : '') + '</span>' +
        '<small>' + time[cat.id].filme.t + '</small></div>' +
      '<div style="display:flex;align-items:center;gap:4px">' +
        '<span class="num neutro" data-lado="eu">' + minha.ov + '</span>' +
        '<span style="color:#6b5f58;font-size:11px">' + (minha.l || cat.label) + '</span>' +
        '<span class="num neutro" data-lado="ele">' + dela.ov + '</span></div>' +
      '<div class="lado dir"><span>' + dela.p + (dela.v ? ' &#127942;' : '') + '</span>' +
        '<small>' + filmeDaCarta(adv, cat.id) + '</small></div>' +
    '</div>';
  }).join('');

  const geracao = ++geracaoDuelo;
  let meus = 0, dele = 0, i = 0;

  const revelarUm = () => {
    if (geracao !== geracaoDuelo) return;
    const cat = CATS[i];
    const linha = $('#duelos .duelo[data-i="' + i + '"]');
    const minha = time[cat.id].carta;
    const dela = cartaDe(adv, cat.id);
    const nEu = linha.querySelector('[data-lado="eu"]');
    const nEle = linha.querySelector('[data-lado="ele"]');

    linha.classList.remove('oculta');
    linha.classList.add('destaque');
    setTimeout(() => linha.classList.remove('destaque'), PAUSA_DUELO - 100);

    let ponto = null;
    if (minha.ov > dela.ov){ meus++; nEu.className = 'num venceu'; nEle.className = 'num perdeu'; ponto = 'eu'; }
    else if (dela.ov > minha.ov){ dele++; nEle.className = 'num venceu'; nEu.className = 'num perdeu'; ponto = 'ele'; }

    if (ponto){
      const alvo = $(ponto === 'eu' ? '#pt-eu' : '#pt-ele');
      alvo.textContent = ponto === 'eu' ? meus : dele;
      alvo.className = ponto === 'eu' ? 'venceu' : 'perdeu';
      alvo.classList.remove('pulso');
      void alvo.offsetWidth;
      alvo.classList.add('pulso');
    }

    i++;
    if (i < CATS.length) setTimeout(revelarUm, PAUSA_DUELO);
    else setTimeout(() => { if (geracao === geracaoDuelo) fecharRodada(adv, meus, dele); }, 500);
  };

  setTimeout(revelarUm, 350);
}

function fecharRodada(adv, meus, dele){
  catsVencidas += meus;
  catsPerdidas += dele;

  const media = (ovs) => ovs.reduce((s, o) => s + o, 0) / ovs.length;
  const minhaMedia = media(CATS.map(c => time[c.id].carta.ov));
  const suaMedia = media(CATS.map(c => cartaDe(adv, c.id).ov));
  const empatou = meus === dele;
  const ganhou = empatou ? minhaMedia > suaMedia : meus > dele;
  if (ganhou) vitorias++;

  $('#veredito').innerHTML = empatou
    ? 'Empate no placar &middot; desempate pela média: <span class="' + (ganhou ? 'venceu' : 'perdeu') + '">' +
      fmtMedia(minhaMedia) + '</span> contra ' + fmtMedia(suaMedia)
    : '<span class="' + (ganhou ? 'venceu' : 'perdeu') + '">' +
      (ganhou ? (M().rodadas === 1 ? 'Você venceu' : 'Você passou de fase') : 'Você perdeu') + '</span>';

  historico.push({
    r: rodada, meus, dele, empatou, ganhou,
    adv: adv.t, ano: adv.a, composto: !!adv.composto, filme: adv,
    minhaMedia, suaMedia,
  });

  const btn = $('#btn-proxima');
  revelando = false;
  btn.disabled = false;

  const acabou = !ganhou || rodada >= M().rodadas;

  if (modo === 'academia' && oficialHoje){
    registrarDiario(ganhou, meus + '×' + dele);
    oficialHoje = false;
  }
  if (modo === 'maratona' && !ganhou){
    const d = lerDados();
    if (vitorias > (d.recordeMaratona || 0)){ d.recordeMaratona = vitorias; gravarDados(d); }
  }

  if (acabou){
    btn.classList.add('oculto');
    $('#btn-compartilhar-torneio').classList.remove('oculto');
    renderCaminho(ganhou ? 'campeao' : 'eliminado');
    if (ganhou || (modo === 'maratona' && vitorias > 0)) setTimeout(celebrar, 700);
    else setTimeout(derrota, 700);
  } else {
    renderCaminho('andando');
    btn.textContent = modo === 'maratona' ? 'Próximo adversário' : 'Rodada ' + (rodada + 1);
  }
}

function renderCaminho(estado){
  const alvo = $('#historico');
  if (!historico.length){
    alvo.innerHTML = '<p class="vazio-caminho">O caminho aparece aqui a cada rodada.</p>';
    return;
  }

  const passos = historico.map(h => {
    const placar = h.meus + '×' + h.dele;
    const resumo = h.empatou
      ? 'Empatou em ' + placar + ' e ' + (h.ganhou ? 'passou' : 'caiu') + ' na média'
      : (h.ganhou ? 'Venceu por ' : 'Perdeu por ') + placar;
    const detalhe = h.empatou ? 'média ' + fmtMedia(h.minhaMedia) + ' contra ' + fmtMedia(h.suaMedia) : '';
    return '<li class="passo ' + (h.ganhou ? 'ok' : 'ko') + '">' +
      '<span class="medalha">' + h.r + '</span>' +
      '<span class="placa">' +
        '<span class="placar-txt">' + resumo + '</span> contra ' +
        '<span class="filme">' + h.adv + '</span>' + (h.composto ? '' : ' (' + h.ano + ')') +
        (detalhe ? '<span class="detalhe">' + detalhe + '</span>' : '') +
      '</span></li>';
  }).join('');

  let fim = '';
  if (estado === 'eliminado'){
    fim = '<div class="fim eliminado"><span class="postes"><i></i><i></i></span>' +
      (modo === 'maratona'
        ? 'A maratona parou em ' + vitorias + (vitorias === 1 ? ' vitória' : ' vitórias')
        : 'Fim do tapete na rodada ' + rodada) + '</div>';
  } else if (estado === 'campeao'){
    fim = '<div class="fim campeao"><span class="postes"><i></i><i></i></span>' +
      '&#127942; ' + (M().rodadas === 1 ? 'Vitória' : 'Campeão &middot; ' + RODADAS_TXT()) + '</div>';
  }

  alvo.innerHTML = '<ol class="passos">' + passos + '</ol>' + fim;
}
const RODADAS_TXT = () => M().rodadas + ' rodadas invicto';

/* ---------- celebração ---------- */
function celebrar(){
  const ovs = CATS.map(c => time[c.id].carta.ov);
  const mediaTime = ovs.reduce((s, o) => s + o, 0) / ovs.length;
  const melhor = CATS.map(c => time[c.id]).sort((a, b) => b.carta.ov - a.carta.ov)[0];
  const trocas = M().trocas - girosExtras;
  const dados = lerDados();

  let titulo = 'Campeão', selo = '', resumo = '';

  if (modo === 'corrida'){
    selo = M().rodadas + ' rodadas &middot; invicto';
    resumo = '<strong>' + (nomeDoTime(time) || 'Seu time') + '</strong> atravessou as ' + M().rodadas + ' rodadas sem perder nenhuma.<br>';
  } else if (modo === 'academia'){
    titulo = 'Desafio cumprido';
    selo = 'Temporada de ' + desafioHoje.ancora.t;
    const st = lerDados().streak || 0;
    resumo = 'Você bateu os indicados de ' + desafioHoje.ancora.a + '.<br>' +
      (st ? 'Sequência de <b>' + st + (st > 1 ? ' dias</b>' : ' dia</b>') + '. ' : '') +
      'Recorde: <b>' + (dados.melhorStreak || st || 0) + '</b>.<br>';
  } else if (modo === 'maratona'){
    const recorde = dados.recordeMaratona || 0;
    titulo = vitorias >= recorde && vitorias > 0 ? 'Novo recorde' : 'Fim da maratona';
    selo = vitorias + (vitorias === 1 ? ' vitória seguida' : ' vitórias seguidas');
    resumo = 'Recorde na máquina: <b>' + recorde + '</b>.<br>';
  }

  $('#palco h2').textContent = titulo;
  $('#selo-invicto').innerHTML = selo;
  $('#resumo-campeao').innerHTML = resumo +
    '<b>' + catsVencidas + '</b> categorias vencidas contra <b>' + catsPerdidas + '</b>' +
    ' &middot; média do elenco <b>' + fmtMedia(mediaTime) + '</b><br>' +
    'Carta mais forte: <b>' + melhor.carta.p + '</b> (' + melhor.carta.ov + ') em ' + melhor.filme.t + '<br>' +
    (trocas ? 'Você gastou ' + trocas + (trocas > 1 ? ' trocas' : ' troca') + ' no draft.'
            : 'E sem gastar nenhuma troca no draft.');

  const palco = $('#palco');
  palco.querySelectorAll('.faisca').forEach(f => f.remove());
  const tons = ['#d4af37', '#f0d878', '#fff3cd', '#b98f2a'];
  for (let i = 0; i < 46; i++){
    const f = document.createElement('i');
    f.className = 'faisca';
    f.style.left = Math.random() * 100 + '%';
    f.style.background = tons[i % tons.length];
    f.style.animationDuration = (3.4 + Math.random() * 3.2) + 's';
    f.style.animationDelay = (Math.random() * 3.5) + 's';
    f.style.transform = 'scale(' + (0.5 + Math.random()) + ')';
    palco.appendChild(f);
  }
  palco.classList.remove('oculto');
  sincronizarOverlay();
}

// uma tela de resultado aberta esconde a cápsula do hub, que senão flutua por
// cima da celebração (ver o comentário do .wrap no CSS)
function sincronizarOverlay(){
  const algumAberto = ['#palco', '#tela-derrota', '#tela-elenco']
    .some(s => !$(s).classList.contains('oculto'));
  document.body.classList.toggle('com-overlay', algumAberto);
}

function fecharPalco(){ $('#palco').classList.add('oculto'); sincronizarOverlay(); }

/* ---------- tela de derrota: simétrica ao celebrar(), em vermelho ---------- */
function derrota(){
  const ultimo = historico[historico.length - 1];
  if (!ultimo) return;

  $('#kicker-derrota').textContent = modo === 'academia' && desafioHoje
    ? 'Temporada de ' + desafioHoje.ancora.t : 'Temporada de Prêmios';
  $('#subtitulo-derrota').textContent = modo === 'maratona'
    ? 'A maratona parou em ' + vitorias + (vitorias === 1 ? ' vitória' : ' vitórias')
    : 'Caiu na rodada ' + rodada + ' de ' + M().rodadas;

  $('#placar-derrota-eu').textContent = ultimo.meus;
  $('#placar-derrota-ele').textContent = ultimo.dele;
  $('#nome-derrota-eu').textContent = nomeDoTime(time) || 'Seu time';
  $('#nome-derrota-ele').textContent = ultimo.adv;

  const piorCat = [...CATS].sort((a, b) =>
    (cartaDe(ultimo.filme, b.id).ov - time[b.id].carta.ov) -
    (cartaDe(ultimo.filme, a.id).ov - time[a.id].carta.ov))[0];
  const cartaAdversaria = cartaDe(ultimo.filme, piorCat.id);
  const minhaCarta = time[piorCat.id].carta;
  const mediaTime = CATS.reduce((s, c) => s + time[c.id].carta.ov, 0) / CATS.length;

  // nada de afirmar "margem apertada" sem olhar o placar: numa derrota de 0x6
  // isso seria mentira. O texto descreve o que realmente aconteceu.
  const abertura = ultimo.empatou
    ? 'Empatou no placar e caiu no desempate pela média do elenco.<br>'
    : '';

  // só afirmar que a carta adversária passou pela sua se ela realmente passou:
  // senão o texto acaba dizendo coisas como "62 passou pela sua carta de 68"
  const deficit = cartaAdversaria.ov - minhaCarta.ov;
  const trechoCarta = deficit > 0
    ? 'A categoria que mais pesou contra você foi <b>' + (minhaCarta.l || piorCat.label) + '</b>: ' +
      '<span style="color:#f5726b">' + cartaAdversaria.p + ' (' + cartaAdversaria.ov + ')</span> ' +
      'passou pela sua carta de <b>' + minhaCarta.ov + '</b>.<br>'
    : 'Seu elenco foi parelho carta a carta: a rodada se decidiu no conjunto.<br>';

  $('#resumo-derrota').innerHTML = abertura + trechoCarta +
    'Média do seu elenco: <b>' + fmtMedia(mediaTime) + '</b>.';

  $('#tela-derrota').classList.remove('oculto');
  sincronizarOverlay();
}
function fecharTelaDerrota(){ $('#tela-derrota').classList.add('oculto'); sincronizarOverlay(); }

/* ---------- "ver elenco": reaproveita renderTime(), sem duplicar nada ---------- */
function abrirTelaElenco(){
  renderTime($('#claquete-resultado'), false, time);
  const tela = $('#tela-elenco');
  tela.classList.remove('oculto');
  sincronizarOverlay();
  requestAnimationFrame(() => tela.classList.add('aberta'));
}
function fecharTelaElenco(){
  const tela = $('#tela-elenco');
  tela.classList.remove('aberta');
  setTimeout(() => { tela.classList.add('oculto'); sincronizarOverlay(); }, 380);
}

/* ---------- imagem do elenco: desenhada à mão num canvas (sem libs externas),
   lendo as medidas reais da claquete que renderTime() acabou de montar ---------- */
const TEXTO_COMPARTILHAR = 'Esse foi meu elenco no Road to Statuette, monte o seu e enfrente o tapete vermelho! https://justchilling.com.br/roadtostatuette';
const CORES_FAIXA_IMG = { ouro: '#d4af37', prata: '#c7ccd1', lendario: '#e879f9', bronze: '#a2703f' };


async function comFeedbackImagem(btn, txtEl, textoCarregando, tarefa){
  const original = txtEl.textContent;
  btn.disabled = true;
  txtEl.textContent = textoCarregando;
  try {
    await tarefa();
  } catch (e){
    if (e.name !== 'AbortError') txtEl.textContent = 'Não deu, tenta de novo';
  } finally {
    setTimeout(() => { txtEl.textContent = original; btn.disabled = false; }, 2000);
  }
}

$('#btn-compartilhar-img').onclick = () => {
  const btn = $('#btn-compartilhar-img');
  const txt = $('#txt-compartilhar-elenco');
  comFeedbackImagem(btn, txt, 'Compartilhando…', async () => {
    const blob = await gerarImagemElenco();
    const arquivo = new File([blob], 'road-to-statuette-elenco.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [arquivo] })){
      await navigator.share({ files: [arquivo], title: 'Road to Statuette', text: TEXTO_COMPARTILHAR });
    } else {
      txt.textContent = 'Use Salvar neste aparelho';
    }
  });
};

$('#btn-salvar-img').onclick = () => {
  const btn = $('#btn-salvar-img');
  const txt = $('#txt-salvar-elenco');
  comFeedbackImagem(btn, txt, 'Salvando…', async () => {
    const blob = await gerarImagemElenco();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'road-to-statuette-elenco.png';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    txt.textContent = 'Imagem salva!';
  });
};

$('#btn-elenco-palco').onclick = abrirTelaElenco;
$('#btn-elenco-derrota').onclick = abrirTelaElenco;
$('#btn-voltar-elenco').onclick = fecharTelaElenco;
$('#btn-tentar-de-novo').onclick = () => { fecharTelaDerrota(); reiniciar(); };
$('#btn-ver-caminho-derrota').onclick = fecharTelaDerrota;
$('#btn-outro-modo-palco').onclick = voltarAoMenu;
$('#btn-outro-modo-derrota').onclick = () => { fecharTelaDerrota(); voltarAoMenu(); };
$('#btn-jogar-de-novo-elenco').onclick = () => { fecharTelaElenco(); fecharTelaDerrota(); reiniciar(); };
$('#btn-outro-modo-elenco').onclick = () => { fecharTelaElenco(); fecharTelaDerrota(); voltarAoMenu(); };

function reiniciar(){
  comCortina(() => iniciarModo(modo));
}
function voltarAoMenu(){
  comCortina(() => {
    fecharPalco();
    document.body.classList.remove('jogando');
    renderMenu();
    mostrarTela('#tela-inicio');
  });
}

/* ---------- boot ---------- */
$('#tamanho-pool').textContent = FILMES.length + ' filmes no baralho · ' + (FILMES.length * 6) + ' cartas';
// o rodapé traz só o alcance dos dados
const ANOS = FILMES.map(f => f.a);
$('#rodape').textContent = 'Dados de ' + Math.min(...ANOS) + ' a ' + Math.max(...ANOS) + '.';
$('#btn-apoio').href = LINK_APOIO;
$('#btn-apoio-topo').href = LINK_APOIO;
$("#btn-hub").onclick = () => {
  window.location.href = LINK_HUB;
};
$('#btn-voltar-tela').onclick = voltarAoMenu;
$('#btn-ajuda').onclick = () => abrirAjuda(modo);
$('#btn-lado').onclick = () => {
  const c = $('#col-lado');
  const abriu = c.classList.toggle('aberta');
  $('#btn-lado').textContent = abriu ? 'Esconder' : 'Caminho e time';
  if (abriu) c.scrollIntoView({ behavior: 'smooth', block: 'start' });
};
$('#btn-ajuda-ok').onclick = fecharAjuda;
$('#btn-salvar-nome').onclick = () => fecharNomeProducao(true);
$('#btn-pular-nome').onclick = () => fecharNomeProducao(false);
$('#campo-nome-producao').addEventListener('keydown', (e) => {
  if (e.key === 'Enter'){ e.preventDefault(); fecharNomeProducao(true); }
});
$('#modal-ajuda').onclick = (e) => { if (e.target.id === 'modal-ajuda') fecharAjuda(); };
$('#btn-compartilhar-torneio').onclick = abrirCompartilhamento;
$('#btn-compartilhar-gala').onclick = abrirCompartilhamento;
$('#btn-compartilhar-palco').onclick = abrirCompartilhamento;
$('#btn-fechar-share').onclick = fecharCompartilhamento;
$('#btn-copiar-score').onclick = copiarScore;
$('#btn-twitter-score').onclick = abrirTwitterScore;
$('#modal-share').onclick = (e) => { if (e.target.id === 'modal-share') fecharCompartilhamento(); };
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!$('#modal-ajuda').classList.contains('oculto')) fecharAjuda();
  if (!$('#modal-share').classList.contains('oculto')) fecharCompartilhamento();
});
renderMenu();
$('#btn-girar').onclick = girar;
$('#btn-proxima').onclick = proximaRodada;
$('#btn-reiniciar').onclick = reiniciar;
$('#btn-ver-caminho').onclick = fecharPalco;
$('#btn-novo-draft').onclick = reiniciar;
$('#btn-menu').onclick = voltarAoMenu;
$('#btn-menu-2').onclick = voltarAoMenu;
$('#btn-menu-3').onclick = voltarAoMenu;
$('#btn-menu-4').onclick = voltarAoMenu;
$('#btn-comecar-gala').onclick = comecarGala;
$('#btn-pronto').onclick = comecarVez;
$('#btn-premio').onclick = abrirEnvelope;
$('#btn-nova-gala').onclick = () => comCortina(() => iniciarModo('gala'));