/**
 * cartas.js
 * Monta o HTML de uma carta de elenco/direção/fotografia: a faixa de
 * qualidade (bronze/prata/ouro/lendário conforme o overall), os selos
 * (vencedor/indicado, estatuetas do filme) e o layout final da carta.
 * Puro: recebe filme/carta como parâmetro, não lê nenhum estado do jogo.
 */
import { ROTULOS } from './dados-filmes.js';

export function faixa(ov){
  if (ov >= 90) return 'lendario';
  if (ov >= 75) return 'ouro';
  if (ov >= 60) return 'prata';
  return 'bronze';
}
export function cartaDe(filme, catId){
  return filme.c.find(c => c.k === catId);
}

export function htmlCarta(filme, carta, opcoes = {}){
  const selos = [];
  if (carta.v) selos.push('<span class="selo vitoria">&#127942; Venceu</span>');
  else if (carta.i) selos.push('<span class="selo">Indicado</span>');
  // deixa explícito que este selo é do filme, não da pessoa
  if (filme.w > 0) selos.push('<span class="selo filme-selo">Filme &middot; ' + filme.w + (filme.w > 1 ? ' estatuetas' : ' estatueta') + '</span>');
  const titulo = filme.t !== filme.o ? filme.t + ' <span style="opacity:.6">(' + filme.o + ')</span>' : filme.t;
  return '<div class="carta ' + faixa(carta.ov) + (opcoes.clicavel ? ' clicavel' : '') +
    (opcoes.usada ? ' usada' : '') + '"' + (opcoes.attr || '') + '>' +
      '<div class="topo"><span class="ov">' + carta.ov + '</span>' +
      '<span class="cat">' + (carta.l || ROTULOS[carta.k]) + '</span></div>' +
      '<div class="nome">' + carta.p + '</div>' +
      '<div class="selos">' + selos.join('') + '</div>' +
      '<div class="filme">' + titulo + ' &middot; ' + filme.a + '</div>' +
    '</div>' +
    (opcoes.usada ? '' : '');
}