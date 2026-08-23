(function () {
  var overlay = document.getElementById('overlay');
  document.getElementById('playBtn').addEventListener('click', function () {
    overlay.classList.add('open');
  });
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay || e.target.hasAttribute('data-close')) {
      overlay.classList.remove('open');
      return;
    }
    var route = e.target.getAttribute && e.target.getAttribute('data-play');
    if (route) window.location.href = route;
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') overlay.classList.remove('open');
  });
})();