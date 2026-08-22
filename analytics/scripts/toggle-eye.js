document.getElementById('toggleEye').addEventListener('click', function(){
  var pass = document.getElementById('pass');
  var btn = this;
  if (pass.type === 'password') {
    pass.type = 'text';
    btn.setAttribute('aria-label', 'Esconder senha');
    btn.style.opacity = '1';
  } else {
    pass.type = 'password';
    btn.setAttribute('aria-label', 'Mostrar senha');
    btn.style.opacity = '.6';
  }
});