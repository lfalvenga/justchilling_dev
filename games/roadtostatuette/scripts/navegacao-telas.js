/**
 * navegacao-telas.js
 * Troca de tela com efeito de cortina, o modal "Como jogar" de cada modo,
 * o registro de "já viu essa ajuda" (some sozinho depois da 1ª vez), e a
 * faixa de sequência diária no topo da tela inicial.
 * abrirAjuda recebe o objeto do modo já resolvido (não o id), assim este
 * arquivo não precisa conhecer o MODOS que ainda vive no script.js.
 */
import { $ } from './dom-helpers.js';
import { lerDados, gravarDados, estadoDiario, semanaDiaria } from './dados-persistencia.js';

export function comCortina(troca){
  const t = $('#transicao');
  t.classList.add('rodando');
  requestAnimationFrame(() => t.classList.add('fechada'));
  setTimeout(() => { troca(); window.scrollTo({ top: 0 }); }, 640);
  setTimeout(() => t.classList.remove('fechada'), 880);
  setTimeout(() => t.classList.remove('rodando'), 1540);
}
const TELAS = ['#tela-inicio', '#tela-draft', '#tela-torneio', '#tela-nomes', '#tela-passagem', '#tela-cerimonia'];
export function mostrarTela(qual){
  TELAS.forEach(s => $(s).classList.add('oculto'));
  $(qual).classList.remove('oculto');
  // na escolha de modo o destino é o hub; dentro do jogo, a tela anterior
  const noInicio = qual === '#tela-inicio';
  $('#btn-hub').classList.toggle('oculto', !noInicio);
  $('#btn-voltar-tela').classList.toggle('oculto', noInicio);
}

/* ---------- sequência diária ---------- */
export function renderSequencia(){
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

export function seloJogadores(m){
  return m.multi
    ? '<span class="selo-jogadores">' + ICONE_MULTI + '2 a 6 jogadores</span>'
    : '<span class="selo-jogadores">' + ICONE_SOLO + 'Solo</span>';
}

/* ---------- como jogar ---------- */
export function abrirAjuda(m){
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
export function fecharAjuda(){ $('#modal-ajuda').classList.add('oculto'); }

// a explicação aparece sozinha só na primeira vez em cada modo
export function jaViuAjuda(id){
  const d = lerDados();
  return !!(d.tutoriais && d.tutoriais[id]);
}
export function marcarAjudaVista(id){
  const d = lerDados();
  d.tutoriais = d.tutoriais || {};
  d.tutoriais[id] = 1;
  gravarDados(d);
}