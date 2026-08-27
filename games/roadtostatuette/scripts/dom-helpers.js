/**
 * dom-helpers.js
 * Atalhos genéricos usados em vários pontos do jogo, sem lógica de negócio:
 * - $: abreviação para document.querySelector
 * - sortear: escolhe um item aleatório de um array
 * Existe como arquivo próprio para evitar importação circular entre
 * script.js e canvas-utils.js, já que os dois precisam desses atalhos.
 */
export const $ = (s) => document.querySelector(s);
export const sortear = (arr) => arr[Math.floor(Math.random() * arr.length)];