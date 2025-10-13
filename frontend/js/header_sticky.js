(function(){
  // Make header sticky and toggle scrolled class
  const header = document.querySelector('header');
  if(!header) return;
  header.classList.add('site-header');
  document.body.classList.add('has-sticky-header');

  const toggle = () => {
    if(window.scrollY > 10){
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  };

  toggle();
  window.addEventListener('scroll', toggle, {passive:true});
})();
