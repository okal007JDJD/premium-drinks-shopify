(() => {
  const body = document.body;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const root = (window.themeConfig?.rootUrl || '/').replace(/\/$/, '');
  const safeStorage = {
    get(k){ try{return localStorage.getItem(k)}catch(e){return null} },
    set(k,v){ try{localStorage.setItem(k,v)}catch(e){} }
  };

  const escapeHtml = (str='') => String(str).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const lock = () => body.classList.add('is-locked');
  const unlockIfClear = () => {
    if (!document.querySelector('.drawer-backdrop.is-open,.modal-shell.is-open,.mobile-drawer.is-open,.cart-drawer.is-open,.filters-drawer.is-open')) body.classList.remove('is-locked');
  };
  const backdrop = (open) => $('#GlobalBackdrop')?.classList.toggle('is-open', open);
  const setAria = (el, open) => el?.setAttribute('aria-hidden', open ? 'false' : 'true');

  function closeDrawers() {
    $$('.mobile-drawer,.cart-drawer,.filters-drawer').forEach(el => {el.classList.remove('is-open');setAria(el,false)});
    backdrop(false); unlockIfClear();
  }
  function openDrawer(selector) {
    closeDrawers();
    const el = $(selector); if (!el) return;
    el.classList.add('is-open'); setAria(el,true); backdrop(true); lock();
  }
  function closeModal(modal) {
    if (!modal) return;
    modal.classList.remove('is-open'); setAria(modal,false); unlockIfClear();
  }
  function openModal(modal) {
    if (!modal) return;
    modal.classList.add('is-open'); setAria(modal,true); lock();
  }
  function toast(message) {
    const el = $('#ThemeToast'); if (!el) return;
    el.textContent = message; el.classList.add('is-open');
    clearTimeout(el._timer); el._timer = setTimeout(() => el.classList.remove('is-open'), 2600);
  }
  function restoreLocation() {
    const saved = safeStorage.get('theme_location');
    if (!saved) return;
    $$('[data-location-label]').forEach(el => el.textContent = saved);
    $$('[data-location-choice]').forEach(el => el.classList.toggle('is-active', el.dataset.locationChoice === saved));
  }

  document.addEventListener('click', (e) => {
    const drawerOpen = e.target.closest('[data-open-drawer]');
    if (drawerOpen) { e.preventDefault(); openDrawer(drawerOpen.dataset.openDrawer); return; }
    if (e.target.closest('[data-close-drawer]') || e.target.id === 'GlobalBackdrop') { e.preventDefault(); closeDrawers(); return; }
    const modalOpen = e.target.closest('[data-open-modal]');
    if (modalOpen) { e.preventDefault(); closeDrawers(); openModal($(modalOpen.dataset.openModal)); return; }
    const modalClose = e.target.closest('[data-close-modal]');
    if (modalClose) { e.preventDefault(); closeModal(modalClose.closest('.modal-shell')); return; }
    const location = e.target.closest('[data-location-choice]');
    if (location) {
      const value = location.dataset.locationChoice || location.textContent.trim(); safeStorage.set('theme_location', value);
      restoreLocation(); closeModal(location.closest('.modal-shell')); toast(`Delivery area: ${value}`); return;
    }
    const qtyBtn = e.target.closest('[data-qty]');
    if (qtyBtn) {
      const input = qtyBtn.closest('.qty')?.querySelector('input'); if (!input) return;
      const min = Number(input.min || 1), max = Number(input.max || 9999), current = Number(input.value || 1);
      input.value = Math.max(min, Math.min(max, current + (qtyBtn.dataset.qty === 'plus' ? 1 : -1)));
      input.dispatchEvent(new Event('change', {bubbles:true})); return;
    }
    const thumb = e.target.closest('[data-product-thumb]');
    if (thumb) {
      const main = $('#ProductMainImage'); if (main && thumb.dataset.productThumb) main.src = thumb.dataset.productThumb;
      $$('.product-thumb').forEach(x => x.classList.remove('is-active')); thumb.classList.add('is-active');
    }
  });

  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    closeDrawers(); $$('.modal-shell.is-open').forEach(closeModal); $$('.predictive-results').forEach(el => el.hidden = true);
  });

  // Age / eligibility gate
  const ageGate = $('#AgeLicenseGate');
  if (ageGate) {
    const key = 'theme_age_license_confirmed';
    const shouldShow = ageGate.dataset.mode === 'always' || !safeStorage.get(key);
    if (shouldShow) openModal(ageGate);
    ageGate.addEventListener('click', e => {
      const confirm = e.target.closest('[data-age-confirm]'); if (!confirm) return;
      safeStorage.set(key, '1'); closeModal(ageGate);
      if (!safeStorage.get('theme_location')) setTimeout(() => openModal($('#LocationModal')), 180);
    });
  }
  restoreLocation();

  // Sort controls
  document.addEventListener('change', e => {
    const select = e.target.closest('[data-sort-by]'); if (!select) return;
    const url = new URL(window.location.href); url.searchParams.set('sort_by', select.value); window.location.href = url.toString();
  });

  // Predictive product search
  function initPredictiveSearch(scope = document) {
    $$('[data-predictive-search]', scope).forEach(form => {
      if (form.dataset.ready === 'true') return; form.dataset.ready = 'true';
      const input = $('[data-search-input]', form), results = $('[data-search-results]', form); if (!input || !results) return;
      let controller, timer;
      input.addEventListener('input', () => {
        clearTimeout(timer); const q = input.value.trim();
        if (q.length < 2) { results.hidden = true; results.innerHTML = ''; return; }
        timer = setTimeout(async () => {
          controller?.abort(); controller = new AbortController();
          try {
            const url = `${root}/search/suggest.json?q=${encodeURIComponent(q)}&resources[type]=product&resources[limit]=5&resources[options][unavailable_products]=last`;
            const res = await fetch(url, {signal:controller.signal, headers:{'Accept':'application/json'}}); if (!res.ok) throw new Error('Search unavailable');
            const data = await res.json(); const products = data?.resources?.results?.products || [];
            if (!products.length) { results.innerHTML = `<div class="predictive-results__head">No products found</div>`; results.hidden = false; return; }
            results.innerHTML = `<div class="predictive-results__head">Products</div>` + products.map(p => {
              const image = p.image ? `<img src="${escapeHtml(p.image)}" alt="">` : '<span></span>';
              const price = p.price ? `<span>${escapeHtml(p.price)}</span>` : '';
              return `<a class="predictive-item" href="${escapeHtml(p.url)}">${image}<strong>${escapeHtml(p.title)}</strong>${price}</a>`;
            }).join('') + `<a class="predictive-view-all" href="${window.themeConfig?.searchUrl || '/search'}?q=${encodeURIComponent(q)}">View all search results →</a>`;
            results.hidden = false;
          } catch (err) { if (err.name !== 'AbortError') results.hidden = true; }
        }, 180);
      });
      input.addEventListener('focus', () => { if (results.innerHTML) results.hidden = false; });
      document.addEventListener('click', e => { if (!form.contains(e.target)) results.hidden = true; });
    });
  }
  initPredictiveSearch();

  // Ajax add-to-cart, then re-render static header/cart drawer.
  async function refreshHeaderAndOpenCart() {
    const response = await fetch(`${root || ''}/?sections=header`, {headers:{'Accept':'application/json'}});
    if (!response.ok) throw new Error('Could not refresh cart');
    const sections = await response.json(); const html = sections.header; if (!html) return;
    const temp = document.createElement('div'); temp.innerHTML = html.trim(); const next = temp.firstElementChild; const current = $('#shopify-section-header');
    if (current && next) current.replaceWith(next);
    restoreLocation(); initPredictiveSearch(next || document); openDrawer('#CartDrawer');
  }

  document.addEventListener('submit', async e => {
    const form = e.target.closest('form[action*="/cart/add"]'); if (!form) return;
    if (e.submitter && e.submitter.name === 'checkout') return;
    e.preventDefault(); const submit = e.submitter || form.querySelector('[type="submit"]');
    if (submit) { submit.disabled = true; submit.dataset.oldText = submit.textContent; submit.textContent = 'Adding…'; }
    try {
      const res = await fetch(`${root}/cart/add.js`, {method:'POST', headers:{'Accept':'application/json','X-Requested-With':'XMLHttpRequest'}, body:new FormData(form)});
      const data = await res.json(); if (!res.ok) throw new Error(data.description || 'Could not add item');
      await refreshHeaderAndOpenCart(); toast('Added to cart');
    } catch (err) { toast(err.message || 'Could not add item'); }
    finally { if (submit && document.contains(submit)) { submit.disabled = false; submit.textContent = submit.dataset.oldText || 'Add to cart'; } }
  });

  // Product variant state
  const productRoot = $('[data-product-root]');
  if (productRoot) {
    const jsonEl = $('[data-product-variants]', productRoot), select = $('[data-variant-select]', productRoot);
    let variants = []; try { variants = JSON.parse(jsonEl?.textContent || '[]'); } catch(e) {}
    const money = cents => {
      const currency = document.documentElement.lang ? '' : '';
      try { return new Intl.NumberFormat(undefined,{style:'currency',currency:window.Shopify?.currency?.active || 'AED'}).format(cents/100); }
      catch(e){ return `${(cents/100).toFixed(2)}`; }
    };
    const update = () => {
      const variant = variants.find(v => String(v.id) === String(select?.value)); if (!variant) return;
      const price = $('[data-product-price]', productRoot), compare = $('[data-product-compare]', productRoot), save = $('[data-product-save]', productRoot), title = $('[data-variant-title]', productRoot), stock = $('[data-stock-note]', productRoot), submit = $('[data-product-submit]', productRoot);
      if (price) price.textContent = money(variant.price);
      if (title) title.textContent = variant.title;
      if (variant.compare_at_price && variant.compare_at_price > variant.price) {
        if (compare) { compare.textContent = money(variant.compare_at_price); compare.classList.remove('is-hidden'); }
        if (save) { save.textContent = `${Math.round((variant.compare_at_price-variant.price)*100/variant.compare_at_price)}% Off`; save.classList.remove('is-hidden'); }
      } else { compare?.classList.add('is-hidden'); save?.classList.add('is-hidden'); }
      if (stock) {
        if (variant.inventory_management && variant.inventory_quantity > 0 && variant.inventory_quantity <= 5) { stock.textContent = `Only ${variant.inventory_quantity} left in stock`; stock.classList.remove('is-hidden'); }
        else stock.classList.add('is-hidden');
      }
      if (submit) { submit.disabled = !variant.available; submit.textContent = variant.available ? 'Add to cart' : 'Sold out'; }
      if (variant.featured_image?.src) { const main = $('#ProductMainImage'); if (main) main.src = variant.featured_image.src; }
      const url = new URL(location.href); url.searchParams.set('variant', variant.id); history.replaceState({},'',url);
    };
    select?.addEventListener('change', update);
  }

  // Hero carousel
  $$('[data-hero-carousel]').forEach(carousel => {
    const track = $('.hero-carousel__track', carousel), items = $$('.hero-carousel__item', carousel), dots = $$('.hero-dot', carousel);
    if (!track || items.length < 2) return; let index = 0, timer;
    const go = i => { index = (i + items.length) % items.length; track.style.transform = `translateX(-${index*100}%)`; dots.forEach((d,n)=>d.classList.toggle('is-active',n===index)); };
    const restart = () => { clearInterval(timer); timer = setInterval(()=>go(index+1), Number(carousel.dataset.autoplay || 6500)); };
    dots.forEach((d,n)=>d.addEventListener('click',()=>{go(n);restart()})); carousel.addEventListener('mouseenter',()=>clearInterval(timer)); carousel.addEventListener('mouseleave',restart); restart();
  });
})();
