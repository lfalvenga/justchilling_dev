/**
 * draft.js
 * O "giro" de sorteio de filme e a escalação das cartas no time: mostra
 * o filme sorteado, deixa escalar numa categoria livre, atualiza a barra
 * de progresso e o botão de girar, e decide o que acontece a seguir
 * (próxima jogada na gala, ou pedir nome da produção quando o time
 * está completo).
 * giroAtual/girosExtras são escritos via setters do script.js (definirGiroAtual,
 * usarTroca), já que este módulo não pode reatribuir variáveis importadas
 * diretamente — só mutar objetos (é por isso que time[catId] = ... funciona
 * sem setter, mas giroAtual = ... precisaria de um).
 */
import { $, sortear } from './dom-helpers.js';
import { CATS, FILMES } from './dados-filmes.js';
import { cartaDe, htmlCarta } from './cartas.js';
import { renderTime } from './time-e-placar.js';
import {
  giroAtual, girosExtras, time, modo, jogadores,
  definirGiroAtual, usarTroca,
  renderFilaGala, fimDaJogada, pedirNomeProducao
} from './script.js';

export function renderGiro(){
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

export function escalar(catId){
  if (!giroAtual || time[catId]) return;
  const filme = giroAtual;
  time[catId] = { filme, carta: cartaDe(filme, catId) };

  definirGiroAtual(null);
  atualizarDraft();
  if (modo === 'gala'){
    setTimeout(fimDaJogada, 420);
  } else if (Object.keys(time).length === CATS.length){
    setTimeout(pedirNomeProducao, 420);
  }
}

export function atualizarDraft(){
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

export function girar(){
  if (giroAtual){
    if (girosExtras <= 0) return;
    usarTroca();
  }
  // na gala nenhum filme se repete entre os jogadores: duas pessoas com a mesma
  // carta empatariam a categoria e a estatueta viraria sorteio
  const usados = new Set();
  if (modo === 'gala') jogadores.forEach(j => Object.values(j.time).forEach(e => usados.add(e.filme)));
  else Object.values(time).forEach(e => usados.add(e.filme));
  const disponiveis = FILMES.filter(f => f !== giroAtual && !usados.has(f));
  definirGiroAtual(sortear(disponiveis.length ? disponiveis : FILMES));
  atualizarDraft();
}