/**
 * time-e-placar.js
 * Exibe o time montado (a claquete com as 6 categorias preenchidas),
 * calcula a média do elenco e a trilha de vitórias/derrotas, monta o
 * texto de resultado pronto pra compartilhar, e os botões de
 * compartilhar (copiar texto, abrir no Twitter).
 * Lê o estado da partida direto do script.js; a única escrita que faz
 * (nome do filme, ao editar o campo) passa pela função definirNomeFilme,
 * já que um módulo importador não pode reatribuir uma variável importada.
 */
import { $ } from './dom-helpers.js';
import { CATS } from './dados-filmes.js';
import { faixa } from './cartas.js';
import { lerDados } from './dados-persistencia.js';
import {
  time, modo, jogadores, historico, rodada, vitorias,
  M, mediaDe, fmtMedia, definirNomeFilme
} from './script.js';

export function renderTime(alvo, interativo, qual){
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
    inp.oninput = () => { definirNomeFilme(inp.value); };
  }
}

// na Noite de Gala o nome vem do jogador da vez; nos outros modos é do próprio jogador
export function nomeDoTime(t){
  if (modo === 'gala'){
    const j = jogadores.find(x => x.time === t);
    return j ? j.nome : '';
  }
  return nomeFilmeJogador;
}

/* ---------- compartilhar score ---------- */
export let textoScoreAtual = '';

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
export function montarTextoScore(){
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
export function abrirCompartilhamento(){
  textoScoreAtual = montarTextoScore();
  $('#share-preview').textContent = textoScoreAtual;
  $('#btn-copiar-score').innerHTML = '&#128203; Copiar resultado';
  $('#modal-share').classList.remove('oculto');
  window.RTAnalytics?.track('share_open');
  setTimeout(() => $('#btn-copiar-score').focus(), 0);
}
export function fecharCompartilhamento(){ $('#modal-share').classList.add('oculto'); }
export async function copiarScore(){
  const texto = textoScoreAtual || montarTextoScore();
  let ok = false;
  try {
    if (navigator.clipboard && window.isSecureContext){ await navigator.clipboard.writeText(texto); ok = true; }
  } catch (e){}
  if (!ok){
    const area = document.createElement('textsarea');
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
export function abrirTwitterScore(){
  const texto = textoScoreAtual || montarTextoScore();
  window.RTAnalytics?.track('share_twitter');
  window.open('https://x.com/intent/tweet?text=' + encodeURIComponent(texto), '_blank', 'noopener,noreferrer,width=720,height=620');
}