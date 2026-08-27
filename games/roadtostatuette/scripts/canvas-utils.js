/**
 * canvas-utils.js
 * Gera a imagem PNG de compartilhamento do elenco (a "claquete" que o
 * jogador compartilha no WhatsApp/Twitter ou salva no celular).
 * - arredondadoImg / preencherListrasImg: helpers internos de desenho
 *   (retângulo com cantos arredondados e o padrão de listras douradas).
 * - gerarImagemElenco: função exportada, lê o resultado já renderizado
 *   na tela e redesenha tudo em um <canvas>, retornando um PNG (blob).
 * Só depende do $ (dom-helpers.js) — não usa nenhum dado do jogo direto,
 * só lê o que já está montado no HTML da tela de resultado.
 */
import { $ } from './dom-helpers.js';

function arredondadoImg(ctx, x, y, w, h, r){
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function preencherListrasImg(ctx, x, y, w, h){
  ctx.fillStyle = '#15141a';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#f3e7c8';
  const passo = 46, largura = 24;
  for (let sx = x - h; sx < x + w + h; sx += passo){
    ctx.save();
    ctx.translate(sx, y);
    ctx.transform(1, 0, -0.55, 1, 0, 0);
    ctx.fillRect(0, 0, largura, h);
    ctx.restore();
  }
}

export async function gerarImagemElenco(){
  await document.fonts.ready;

  const claqueteEl = $('#claquete-resultado .claquete');
  const bracosEl = claqueteEl.querySelector('.bracos');
  const esquerdaMin = Math.min(0, bracosEl.offsetLeft);
  const direitaMax = Math.max(claqueteEl.offsetWidth, bracosEl.offsetLeft + bracosEl.offsetWidth);
  const topoMin = Math.min(0, bracosEl.offsetTop);
  const larguraReal = direitaMax - esquerdaMin;
  const alturaReal = claqueteEl.offsetHeight - topoMin;

  const derrotaAberta = !$('#tela-derrota').classList.contains('oculto');

  const W = 1000;
  const ESCALA = W / (larguraReal + 140); // margem lateral um pouco maior, a imagem respira
  const cardX = (W - larguraReal * ESCALA) / 2;
  // a derrota carrega placar e adversário no cabeçalho, então precisa de mais
  // altura antes da claquete do que a vitória
  const cardTopo = derrotaAberta ? 556 : 390;
  const rodapeImg = 130;
  const H = Math.round(cardTopo + alturaReal * ESCALA + rodapeImg);

  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.textBaseline = 'middle';

  const fundo = ctx.createRadialGradient(W/2, H*0.1, 80, W/2, H*0.1, W*0.9);
  fundo.addColorStop(0, derrotaAberta ? '#2b1216' : '#2a1e08');
  fundo.addColorStop(1, '#0a0708');
  ctx.fillStyle = fundo;
  ctx.fillRect(0, 0, W, H);

  // moldura fina de sala de cinema, encostada na borda: fecha a composição
  ctx.strokeStyle = derrotaAberta ? 'rgba(245,114,107,.22)' : 'rgba(212,175,55,.28)';
  ctx.lineWidth = 2;
  ctx.strokeRect(18, 18, W - 36, H - 36);

  ctx.textAlign = 'center';

  // 1. assinatura discreta no topo: a marca não disputa com o resultado
  ctx.fillStyle = derrotaAberta ? 'rgba(212,175,55,.75)' : 'rgba(212,175,55,.85)';
  ctx.font = '700 19px Inter, sans-serif';
  ctx.letterSpacing = '5px';
  ctx.fillText('ROAD TO STATUETTE', W/2, 66);
  ctx.letterSpacing = '0px';

  // fio dourado com losango ao centro, tipo cartaz de cinema
  const fioY = 100, fioMeio = 26, fioLarg = 150;
  ctx.strokeStyle = 'rgba(212,175,55,.35)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(W/2 - fioMeio - fioLarg, fioY); ctx.lineTo(W/2 - fioMeio, fioY);
  ctx.moveTo(W/2 + fioMeio, fioY); ctx.lineTo(W/2 + fioMeio + fioLarg, fioY);
  ctx.stroke();
  ctx.save();
  ctx.translate(W/2, fioY); ctx.rotate(Math.PI/4);
  ctx.fillStyle = 'rgba(212,175,55,.6)';
  ctx.fillRect(-4, -4, 8, 8);
  ctx.restore();

  // 2. o veredito é o que a pessoa quer mostrar, então é o maior elemento
  const veredito = derrotaAberta
    ? $('#tela-derrota h2').textContent.trim()
    : $('#palco h2').textContent.trim();
  ctx.font = '800 62px "Playfair Display", Georgia, serif';
  if (derrotaAberta){
    ctx.fillStyle = '#f3a09a';
  } else {
    const g = ctx.createLinearGradient(0, 140, 0, 196);
    g.addColorStop(0, '#fff6d4'); g.addColorStop(0.5, '#e5c356'); g.addColorStop(1, '#a8801f');
    ctx.fillStyle = g;
  }
  ctx.fillText(veredito, W/2, 168, W - 140);

  // 3. a linha de contexto (rodada, sequência) fica miúda, é legenda
  const subtitulo = derrotaAberta ? $('#subtitulo-derrota').textContent.trim() : $('#selo-invicto').textContent.trim();
  ctx.fillStyle = derrotaAberta ? 'rgba(245,114,107,.85)' : 'rgba(240,216,120,.85)';
  ctx.font = '700 20px Inter, sans-serif';
  ctx.letterSpacing = '3px';
  ctx.fillText(subtitulo.toUpperCase(), W/2, 220, W - 140);
  ctx.letterSpacing = '0px';

  // 4. o nome do filme é o herói da imagem
  const nomeFilme = (nomeDoTime(time) || 'Seu time');
  ctx.fillStyle = '#fdf6e6';
  ctx.font = '800 74px "Playfair Display", Georgia, serif';
  ctx.fillText(nomeFilme, W/2, derrotaAberta ? 296 : 306, W - 150);

  if (derrotaAberta){
    const meu = $('#placar-derrota-eu').textContent.trim();
    const dele = $('#placar-derrota-ele').textContent.trim();
    const adv = $('#nome-derrota-ele').textContent.trim();
    const placarY = 418;

    // placar numa cápsula, pra ler como resultado e não como número solto
    const capsulaW = 300, capsulaH = 92;
    arredondadoImg(ctx, W/2 - capsulaW/2, placarY - capsulaH/2, capsulaW, capsulaH, 16);
    ctx.fillStyle = 'rgba(0,0,0,.3)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(245,114,107,.22)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // textBaseline 'middle' usa o meio da caixa em, que não é o meio óptico do
    // algarismo: os números encostam no topo da cápsula. Medindo a caixa real
    // do glifo dá pra centralizar de verdade.
    const fonteNum = '800 58px "Playfair Display", Georgia, serif';
    ctx.textBaseline = 'alphabetic';
    ctx.font = fonteNum;
    const cx = ctx.measureText(meu + dele);
    const baseNum = placarY + (cx.actualBoundingBoxAscent - cx.actualBoundingBoxDescent) / 2;

    ctx.fillStyle = '#a49a95';
    ctx.fillText(meu, W/2 - 78, baseNum);
    ctx.fillStyle = '#f5726b';
    ctx.fillText(dele, W/2 + 78, baseNum);

    ctx.font = '400 30px "Playfair Display", Georgia, serif';
    const cxX = ctx.measureText('×');
    ctx.fillStyle = '#6b6360';
    ctx.fillText('×', W/2, placarY + (cxX.actualBoundingBoxAscent - cxX.actualBoundingBoxDescent) / 2);
    ctx.textBaseline = 'middle';

    ctx.fillStyle = 'rgba(154,143,136,.9)';
    ctx.font = '500 23px Inter, sans-serif';
    ctx.fillText('contra ' + adv, W/2, placarY + 78, W - 160);
  }

  const baseEl = claqueteEl.querySelector('.base');
  const pinoEl = claqueteEl.querySelector('.pino');
  const tituloEl = claqueteEl.querySelector('.titulo-claquete');
  const campos = [...claqueteEl.querySelectorAll('.campo')];

  function med(el){
    return {
      x: cardX + (el.offsetLeft - esquerdaMin) * ESCALA,
      y: cardTopo + (el.offsetTop - topoMin) * ESCALA,
      w: el.offsetWidth * ESCALA,
      h: el.offsetHeight * ESCALA,
    };
  }
  const corpoRect = { x: cardX + (0 - esquerdaMin) * ESCALA, y: cardTopo + (0 - topoMin) * ESCALA, w: claqueteEl.offsetWidth * ESCALA, h: claqueteEl.offsetHeight * ESCALA };
  const raio = 5 * ESCALA;

  ctx.save();
  arredondadoImg(ctx, corpoRect.x, corpoRect.y, corpoRect.w, corpoRect.h, raio);
  ctx.clip();
  const corpoGrad = ctx.createLinearGradient(corpoRect.x, corpoRect.y, corpoRect.x + corpoRect.w*0.3, corpoRect.y + corpoRect.h);
  corpoGrad.addColorStop(0, '#23222a'); corpoGrad.addColorStop(0.55, '#17161c'); corpoGrad.addColorStop(1, '#101014');
  ctx.fillStyle = corpoGrad;
  ctx.fillRect(corpoRect.x, corpoRect.y, corpoRect.w, corpoRect.h);
  ctx.restore();
  arredondadoImg(ctx, corpoRect.x, corpoRect.y, corpoRect.w, corpoRect.h, raio);
  ctx.lineWidth = 3 * ESCALA; ctx.strokeStyle = '#c9a961'; ctx.stroke();

  const b = med(baseEl);
  ctx.save();
  arredondadoImg(ctx, b.x, b.y, b.w, b.h, 4 * ESCALA);
  ctx.clip();
  preencherListrasImg(ctx, b.x, b.y, b.w, b.h);
  ctx.restore();
  arredondadoImg(ctx, b.x, b.y, b.w, b.h, 4 * ESCALA);
  ctx.lineWidth = 3 * ESCALA; ctx.strokeStyle = '#c9a961'; ctx.stroke();

  const br = med(bracosEl);
  const origemX = br.x + 6 * ESCALA, origemY = br.y + br.h;
  ctx.save();
  ctx.translate(origemX, origemY);
  ctx.rotate(-1.2 * Math.PI / 180);
  ctx.translate(-origemX, -origemY);
  ctx.save();
  arredondadoImg(ctx, br.x, br.y, br.w, br.h, 4 * ESCALA);
  ctx.clip();
  preencherListrasImg(ctx, br.x, br.y, br.w, br.h);
  ctx.restore();
  arredondadoImg(ctx, br.x, br.y, br.w, br.h, 4 * ESCALA);
  ctx.lineWidth = 3 * ESCALA; ctx.strokeStyle = '#c9a961'; ctx.stroke();
  ctx.restore();

  const p = med(pinoEl);
  const pinoCX = p.x + p.w/2, pinoCY = p.y + p.h/2, pinoR = p.w/2;
  const pino = ctx.createRadialGradient(pinoCX - pinoR*0.3, pinoCY - pinoR*0.3, pinoR*0.15, pinoCX, pinoCY, pinoR);
  pino.addColorStop(0, '#ffffff'); pino.addColorStop(0.55, '#9a9aa2'); pino.addColorStop(1, '#3a3a41');
  ctx.beginPath(); ctx.arc(pinoCX, pinoCY, pinoR, 0, Math.PI * 2);
  ctx.fillStyle = pino; ctx.fill();
  ctx.lineWidth = ESCALA; ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.stroke();

  const t = med(tituloEl);
  ctx.strokeStyle = 'rgba(201,169,97,.42)'; ctx.lineWidth = ESCALA;
  ctx.beginPath(); ctx.moveTo(corpoRect.x, t.y + t.h); ctx.lineTo(corpoRect.x + corpoRect.w, t.y + t.h); ctx.stroke();
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(243,231,200,.62)';
  ctx.font = '700 ' + (9*ESCALA) + 'px Inter, sans-serif';
  ctx.letterSpacing = (1.7*ESCALA) + 'px';
  ctx.fillText('PRODUÇÃO', t.x + 13*ESCALA, t.y + t.h/2);
  ctx.letterSpacing = '0px';
  ctx.fillStyle = '#f3e7c8';
  ctx.font = '700 ' + (16*ESCALA) + 'px "Playfair Display", Georgia, serif';
  // o nome começa onde o campo começa na claquete de verdade: medir aqui evita
  // chutar a largura do rótulo com a fonte errada e abrir um vão que não existe
  const campoNome = claqueteEl.querySelector('.entrada-filme');
  const nomeX = campoNome ? med(campoNome).x : t.x + 150*ESCALA;
  ctx.fillText(nomeFilme, nomeX, t.y + t.h/2, corpoRect.x + corpoRect.w - 13*ESCALA - nomeX);

  const cols = 2, rows = Math.ceil(campos.length / cols);
  campos.forEach((campo, i) => {
    const c = med(campo);
    const col = i % cols, row = Math.floor(i / cols);
    ctx.strokeStyle = 'rgba(201,169,97,.42)'; ctx.lineWidth = 1.2 * ESCALA;
    if (col > 0){ ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(c.x, c.y+c.h); ctx.stroke(); }
    if (row > 0){ ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(c.x+c.w, c.y); ctx.stroke(); }

    if (campo.classList.contains('vaga')) return;

    const faixa = ['ouro','prata','lendario','bronze'].find(f => campo.classList.contains(f));
    const cor = CORES_FAIXA_IMG[faixa] || '#eceae2';
    const rot = (campo.querySelector('.rotulo') || {}).textContent || '';
    const notaEl = campo.querySelector('.nota');
    const nota = notaEl ? notaEl.textContent.trim() : '';
    const valorEl = campo.querySelector('.valor');
    let nome = '';
    if (valorEl){
      nome = [...valorEl.childNodes]
        .filter(n => n.nodeType === Node.TEXT_NODE)
        .map(n => n.textContent).join('').trim();
    }
    const fonteEl = campo.querySelector('.fonte');
    const fonte = fonteEl ? fonteEl.textContent.trim() : '';
    const px = c.x + 13*ESCALA;
    let py = c.y + 10*ESCALA;

    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(243,231,200,.62)';
    ctx.font = '700 ' + (9*ESCALA) + 'px Inter, sans-serif';
    ctx.letterSpacing = (1.6*ESCALA) + 'px';
    ctx.fillText(rot.toUpperCase(), px, py);
    ctx.letterSpacing = '0px';
    py += 22*ESCALA;

    ctx.fillStyle = cor;
    ctx.font = '800 ' + (19*ESCALA) + 'px "Playfair Display", Georgia, serif';
    ctx.shadowColor = cor; ctx.shadowBlur = 10*ESCALA;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(nota, px, py + 15*ESCALA);
    ctx.shadowBlur = 0;
    const larguraNota = ctx.measureText(nota).width;

    ctx.fillStyle = '#f3e7c8';
    ctx.font = '600 ' + (15*ESCALA) + 'px "Playfair Display", Georgia, serif';
    ctx.fillText(nome, px + larguraNota + 6*ESCALA, py + 15*ESCALA, c.w - larguraNota - 32*ESCALA);
    ctx.textBaseline = 'middle';

    if (fonte){
      ctx.fillStyle = 'rgba(243,231,200,.5)';
      ctx.font = '400 ' + (10*ESCALA) + 'px Inter, sans-serif';
      ctx.fillText(fonte, px, py + 28*ESCALA, c.w - 32*ESCALA);
    }
  });

  // rodapé: fio curto e a assinatura, o mesmo par que abre a imagem lá em cima.
  // A moldura fica em H-18, então a assinatura precisa parar bem antes disso.
  ctx.textAlign = 'center';
  const rodapeY = H - 84;
  ctx.strokeStyle = 'rgba(212,175,55,.22)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(W/2 - 90, rodapeY); ctx.lineTo(W/2 + 90, rodapeY);
  ctx.stroke();

  ctx.fillStyle = 'rgba(196,182,172,.85)';
  ctx.font = '500 19px Inter, sans-serif';
  ctx.fillText('Monte seu elenco · enfrente o tapete vermelho', W/2, rodapeY + 34);

  return new Promise(resolve => canvas.toBlob(resolve, 'image/png', 0.95));
}