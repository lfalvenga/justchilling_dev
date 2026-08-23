/**
 * Texto de dica no rodapé da cena ("clique no mar, nos coqueiros...").
 * Ajusta a mensagem conforme os coqueiros estão visíveis ou não
 * na tela (em telas muito estreitas/altas eles saem do enquadramento).
 * Não é um HTML pois sua função é fazer com que o texto seja dinâmico
 * em telas mais estreitas.
 */


(function () {
  /* the scene always fills the screen edge-to-edge now (no letterbox bars), which on
     very tall/narrow phones crops the palm trees out of view entirely — so on those
     screens the hint shouldn't invite taps on something that isn't reachable. Checked
     for real against the actual rendered hit-box rather than guessing a breakpoint. */
  var hintEl = document.getElementById('hint');
  var hitTreeL = document.getElementById('hitTreeL');
  function updateHint() {
    var r = hitTreeL.getBoundingClientRect();
    var treeReachable = r.right > 6 && r.left < window.innerWidth - 6;
    hintEl.textContent = treeReachable ? 'clique no mar, nos coqueiros ou no barco' : 'clique no mar ou no barco';
  }
  updateHint();
  window.addEventListener('resize', updateHint);
})();