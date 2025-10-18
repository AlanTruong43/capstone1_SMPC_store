// Handle hero search form: redirect to product_list.html?query=...
(function(){
  const form = document.getElementById('hero-search-form');
  if(!form) return;
  form.addEventListener('submit', function(e){
    // allow default behaviour to preserve GET form, but ensure encoding/trim
    const input = document.getElementById('hero-search-input');
    if(!input) return;
    const val = input.value.trim();
    if(!val){
      e.preventDefault();
      input.focus();
      return;
    }
    // encode and set value to ensure proper URL
    input.value = val; // form GET will automatically URL-encode
    // no need to preventDefault; the browser will navigate to product_list.html?query=...
  });
})();
