(() => {
  const readWishlist = () => {
    try { return JSON.parse(localStorage.getItem('premium_drinks_wishlist') || '[]'); }
    catch (e) { return []; }
  };
  const writeWishlist = items => {
    try { localStorage.setItem('premium_drinks_wishlist', JSON.stringify(items)); }
    catch (e) {}
  };

  function initWishlist(scope = document) {
    const saved = new Set(readWishlist().map(String));
    scope.querySelectorAll('[data-wishlist]').forEach(button => {
      if (button.dataset.referenceReady === 'true') return;
      button.dataset.referenceReady = 'true';
      const id = String(button.dataset.productId || '');
      const sync = active => {
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
        button.setAttribute('aria-label', active ? 'Remove from wishlist' : 'Add to wishlist');
      };
      sync(saved.has(id));
      button.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        const current = new Set(readWishlist().map(String));
        if (current.has(id)) current.delete(id); else current.add(id);
        writeWishlist([...current]);
        sync(current.has(id));
      });
    });
  }

  function initRails(scope = document) {
    scope.querySelectorAll('[data-product-rail]').forEach(section => {
      if (section.dataset.referenceReady === 'true') return;
      section.dataset.referenceReady = 'true';
      const track = section.querySelector('[data-product-rail-track]');
      const prev = section.querySelector('[data-rail-prev]');
      const next = section.querySelector('[data-rail-next]');
      if (!track) return;

      const amount = () => Math.max(240, Math.round(track.clientWidth * .72));
      const update = () => {
        if (prev) prev.disabled = track.scrollLeft <= 4;
        if (next) next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
      };
      prev?.addEventListener('click', () => track.scrollBy({left:-amount(), behavior:'smooth'}));
      next?.addEventListener('click', () => track.scrollBy({left:amount(), behavior:'smooth'}));
      track.addEventListener('scroll', update, {passive:true});
      window.addEventListener('resize', update, {passive:true});
      update();
    });
  }

  function init(scope = document) {
    initWishlist(scope);
    initRails(scope);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => init());
  else init();

  document.addEventListener('shopify:section:load', event => init(event.target));
})();
