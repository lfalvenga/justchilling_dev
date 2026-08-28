/**
 * menu.js
 * A tabela de configuração de cada modo de jogo (nome, cor, regras,
 * detalhes exibidos na ajuda) e a renderização da tela inicial com os
 * cards de cada modo.
 * renderMenu recebe uma função "aoEscolher" como parâmetro em vez de
 * chamar iniciarModo diretamente — isso evita que este arquivo precise
 * importar do script.js (onde iniciarModo mexe no estado da partida).
 */
import { $ } from './dom-helpers.js';
import { lerDados, estadoDiario, desafioDoDia } from './dados-persistencia.js';
import { renderSequencia, seloJogadores } from './navegacao-telas.js';

export const MODOS = {
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

export function renderMenu(aoEscolher){
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
    el.onclick = () => aoEscolher(el.dataset.modo);
  });
}