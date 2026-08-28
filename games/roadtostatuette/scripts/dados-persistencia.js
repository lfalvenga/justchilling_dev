/**
 * dados-persistencia.js
 * Tudo que lê/grava o progresso do jogador no localStorage: streak de dias
 * seguidos, histórico da semana, presença, e o sorteio determinístico do
 * desafio diário (mesma seed = mesmo desafio pra todo mundo naquele dia).
 * Não depende de nenhum estado de partida em andamento — só do que já
 * foi salvo antes.
 */
import { CATS, FILMES } from './dados-filmes.js';
import { cartaDe } from './cartas.js';

const DEPOSITO = 'academy_draft_v1';
export function lerDados(){
  try { return JSON.parse(localStorage.getItem(DEPOSITO)) || {}; } catch (e) { return {}; }
}
export function gravarDados(d){
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
export function desafioDoDia(dia){
  const r = rngCom(semente('academy-draft|' + dia));
  const ancora = VENCEDORES_BP[Math.floor(r() * VENCEDORES_BP.length)];
  const doAno = FILMES.filter(f => f.a === ancora.a);
  const escolhas = CATS.map(cat => {
    const f = doAno[Math.floor(r() * doAno.length)];
    return { filme: f, carta: cartaDe(f, cat.id) };
  });
  return { ancora, escolhas };
}

export function timeComposto(nome, ano, escolhas){
  return {
    t: nome, o: nome, a: ano, r: 0, n: 0, w: 0,
    composto: escolhas,
    c: escolhas.map(e => e.carta),
  };
}
export function filmeDaCarta(t, catId){
  if (t.composto){
    const e = t.composto.find(x => x.carta.k === catId);
    return e ? e.filme.t : t.t;
  }
  return t.t;
}

export function estadoDiario(){
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
export function registrarDiario(venceu, placar){
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
export function semanaDiaria(){
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
export function registrarPresenca(){
  const d = lerDados();
  const dia = diaISO(new Date());
  d.presenca = d.presenca || {};
  if (d.presenca[dia]) return;
  d.presenca[dia] = 1;
  const limite = diaISO(new Date(Date.now() - 90 * 86400000));
  for (const k of Object.keys(d.presenca)) if (k < limite) delete d.presenca[k];
  gravarDados(d);
}