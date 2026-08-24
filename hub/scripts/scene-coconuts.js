/**
 * Coqueiros da cena: ao clicar no coqueiro ou no tronco,
 * balança a árvore e derruba um coco, que cai e rola até a areia
 * com uma nuvem de poeira no impacto. Posições ajustam entre
 * modo retrato e paisagem.
 */

(function () {
  var scene = document.getElementById('scene');
  var COCO = "/hub/assets/coco.png";
  var TREES = {
    L: { x: 19.6, y: 31.0, ground: 93.5, roll: 3.2, palm: 'palmL' },
    R: { x: 80.6, y: 27.5, ground: 92.0, roll: -3.0, palm: 'palmR' }
  };
  var TREES_M = {
    L: { x: 23.5, y: 39.5, ground: 90.5, roll: 2.0, palm: 'palmLM' },
    R: { x: 76.5, y: 37.5, ground: 89.5, roll: -2.0, palm: 'palmRM' }
  };
  function isPortrait() { return window.matchMedia('(orientation: portrait)').matches; }
  function dropCoco(k) {
    var t = (isPortrait() ? TREES_M : TREES)[k], palm = document.getElementById(t.palm);
    palm.classList.remove('shake'); void palm.offsetWidth; palm.classList.add('shake');
    setTimeout(function () { palm.classList.remove('shake'); }, 780);

    var c = document.createElement('img');
    c.src = COCO; c.className = 'coconut px';
    c.style.left = t.x + '%'; c.style.top = t.y + '%';
    /* the fall/roll distance has to be computed in real pixels from the scene's own
       rendered box, not vh/vw — the scene can be taller or wider than the actual
       viewport (it overscans to crop instead of ever showing bars), so vh/vw undershoots
       or overshoots the % based start/end points and the coconut lands short, sometimes
       stopping in the water instead of reaching the sand */
    var r = scene.getBoundingClientRect();
    c.style.setProperty('--fall', ((t.ground - t.y) / 100 * r.height) + 'px');
    c.style.setProperty('--roll', (t.roll / 100 * r.width) + 'px');
    scene.appendChild(c);
    setTimeout(function () { c.style.animation = 'coco 2.1s forwards'; }, 120);

    setTimeout(function () {
      var p = document.createElement('div'); p.className = 'puff';
      p.style.left = t.x + '%'; p.style.top = t.ground + '%';
      var h = '', dirs = [[-16, -9], [0, -13], [15, -8], [-9, -4], [9, -5]];
      for (var j = 0; j < dirs.length; j++)
        h += '<i style="--px:' + dirs[j][0] + 'px;--py:' + dirs[j][1] + 'px;animation-delay:' + (j * 20) + 'ms"></i>';
      p.innerHTML = h; scene.appendChild(p);
      setTimeout(function () { p.remove(); }, 700);
    }, 120 + 2100 * 0.52);

    setTimeout(function () {
      c.style.transition = 'opacity .5s'; c.style.opacity = '0';
      setTimeout(function () { c.remove(); }, 520);
    }, 3600);
  }
  document.getElementById('hitTreeL').addEventListener('click', function () { dropCoco('L'); });
  document.getElementById('hitTreeR').addEventListener('click', function () { dropCoco('R'); });
  document.getElementById('hitTrunkL').addEventListener('click', function () { dropCoco('L'); });
  document.getElementById('hitTrunkR').addEventListener('click', function () { dropCoco('R'); });
})();