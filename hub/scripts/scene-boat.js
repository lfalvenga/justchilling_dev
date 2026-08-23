/**
 * Barquinho da cena: navega entre 3 pontos fixos da tela ao ser
 * clicado, com leve inclinação durante o movimento e rastro de
 * espuma (wake) atrás dele enquanto navega.
 */

(function () {
  var scene = document.getElementById('scene');
  var wrapB = document.getElementById('boatWrap'),
      tilt = document.getElementById('boatTilt'),
      bimg = document.getElementById('boatImg');

  var wrap = wrapB;
  var pos = 0, sailing = false, wt = null, STOPS = [0, -32, 14], idx = 0;
  bimg.addEventListener('click', function (e) {
    e.stopPropagation();
    if (sailing) return;
    sailing = true; idx = (idx + 1) % STOPS.length;
    var from = pos, to = STOPS[idx]; pos = to;
    var dir = to < from ? -1 : 1;
    tilt.style.transform = 'rotate(' + (dir * -5) + 'deg)';
    wrap.style.transform = 'translateX(' + to + 'vw)';
    wt = setInterval(function () {
      var r = scene.getBoundingClientRect(), b = bimg.getBoundingClientRect();
      var w = document.createElement('div'); w.className = 'wake';
      w.style.left = (b.left - r.left + b.width * (dir > 0 ? 0.15 : 0.85)) + 'px';
      w.style.top = (b.top - r.top + b.height * 0.92) + 'px';
      scene.appendChild(w);
      setTimeout(function () { w.remove(); }, 950);
    }, 220);
    setTimeout(function () { clearInterval(wt); tilt.style.transform = 'rotate(0deg)'; sailing = false; }, 6500);
  });
})();