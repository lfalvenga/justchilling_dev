/**
 * Céu da cena: gera as estrelas espalhadas aleatoriamente
 * e controla o ciclo dia/noite (troca automática a cada 1 min,
 * ou manual ao clicar no botão de sol/lua). Também troca o favicon
 * da aba conforme o período.
 */

(function () {
  var scene = document.getElementById('scene');

  var starsEl = document.getElementById('stars'), placed = 0, guard = 0;
  while (placed < 95 && guard++ < 2000) {
    /* sky only: above the headlands (they start at ~45% of the height) */
    var sx = Math.random() * 100, sy = Math.random() * 43;
    /* and never on top of the moon */
    if (sx > 32 && sx < 62 && sy > 25) continue;
    var st = document.createElement('div'); st.className = 'star';
    st.style.left = sx + '%'; st.style.top = sy + '%';
    st.style.animationDelay = (Math.random() * 3.4) + 's';
    starsEl.appendChild(st); placed++;
  }

  var nb = document.getElementById('nightBtn');
  var dayNightTimer = null;
  var FAV_DAY = "/hub/assets/favicon_day.png",
    FAV_NIGHT = "/hub/assets/favicon_night.png";
  var faviconEl = document.getElementById('favicon');
  function setNight(on) {
    scene.classList.toggle('night', on);
    nb.innerHTML = on ? '☀️' : '🌙';
    faviconEl.href = on ? FAV_NIGHT : FAV_DAY;
  }
  function restartDayNightCycle() {
    if (dayNightTimer) clearInterval(dayNightTimer);
    dayNightTimer = setInterval(function () {
      setNight(!scene.classList.contains('night'));
    }, 60000); /* alterna dia/noite a cada 1 minuto */
  }
  nb.addEventListener('click', function () {
    setNight(!scene.classList.contains('night'));
    restartDayNightCycle(); /* clicar manualmente reinicia a contagem de 1min */
  });
  restartDayNightCycle();
})();