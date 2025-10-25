(() => {
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  const nameEl = document.getElementById('name');
  const priceEl = document.getElementById('price');
  const descEl = document.getElementById('description');
  const mediaEl = document.getElementById('media');
  const crumbNameEl = document.getElementById('crumbName');
  const buyBtn = document.getElementById('buyBtn');
  const addCartBtn = document.getElementById('addCartBtn');
  const mbPrice = document.getElementById('mbPrice');
  const mbBuy = document.getElementById('mbBuy');
  const mbCart = document.getElementById('mbCart');
  const chipsWrap = document.querySelector('.chips');

  function formatPrice(n) {
    if (Number.isNaN(n)) return '';
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(n);
  }

  async function load() {
    if (!id) {
      nameEl.textContent = 'Product not found';
      return;
    }
    try {
      const res = await fetch(`/api/products/${encodeURIComponent(id)}`);
      if (!res.ok) throw new Error('Not found');
      const p = await res.json();
      nameEl.textContent = p.name;
      if (crumbNameEl) crumbNameEl.textContent = p.name;
      const formattedPrice = formatPrice(p.price);
      priceEl.textContent = formattedPrice;
      if (mbPrice) mbPrice.textContent = formattedPrice;
      descEl.textContent = p.description || '';

      const inStock = p.inStock !== false; // default true when undefined
      if (chipsWrap) {
        chipsWrap.innerHTML = '';
        const chip = document.createElement('span');
        chip.className = 'chip ' + (inStock ? 'in-stock' : 'out-stock');
        chip.textContent = inStock ? 'In stock' : 'Out of stock';
        chipsWrap.appendChild(chip);
      }

      // Configure Buy/Contact button (WhatsApp) and disable when out of stock
      const base = 'https://wa.me/message/IGTQJNAKPSIHJ1';
      const msg = encodeURIComponent(
        `Hello GadGets4all! I want to buy:\n- Product: ${p.name}\n- Price: ${formatPrice(p.price)}\n- Product ID: ${p.id}`
      );
      const waUrl = `${base}?text=${msg}`;
      if (inStock) {
        if (buyBtn) {
          buyBtn.textContent = 'Buy';
          buyBtn.classList.remove('disabled');
          buyBtn.setAttribute('href', waUrl);
          buyBtn.setAttribute('target', '_blank');
          buyBtn.removeAttribute('aria-disabled');
          buyBtn.onclick = null;
        }
        if (mbBuy) {
          mbBuy.textContent = 'Buy';
          mbBuy.classList.remove('disabled');
          mbBuy.setAttribute('href', waUrl);
          mbBuy.setAttribute('target', '_blank');
          mbBuy.removeAttribute('aria-disabled');
          mbBuy.onclick = null;
        }
      } else {
        if (buyBtn) {
          buyBtn.textContent = 'Out of stock';
          buyBtn.classList.add('disabled');
          buyBtn.removeAttribute('href');
          buyBtn.removeAttribute('target');
          buyBtn.setAttribute('aria-disabled', 'true');
          buyBtn.addEventListener('click', (e) => e.preventDefault(), { once: true });
        }
        if (mbBuy) {
          mbBuy.textContent = 'Out of stock';
          mbBuy.classList.add('disabled');
          mbBuy.removeAttribute('href');
          mbBuy.removeAttribute('target');
          mbBuy.setAttribute('aria-disabled', 'true');
          mbBuy.addEventListener('click', (e) => e.preventDefault(), { once: true });
        }
      }
      if (mbBuy) mbBuy.href = waUrl;

      if (!inStock) {
        addCartBtn?.setAttribute('disabled', 'true');
        addCartBtn?.classList.add('disabled');
        if (buyBtn) {
          buyBtn.classList.add('disabled');
          buyBtn.setAttribute('aria-disabled', 'true');
          buyBtn.addEventListener('click', (e) => e.preventDefault());
        }
        if (mbCart) mbCart.setAttribute('disabled', 'true');
        if (mbBuy) { mbBuy.classList.add('disabled'); mbBuy.setAttribute('aria-disabled', 'true'); mbBuy.addEventListener('click', (e) => e.preventDefault()); }
      }

      renderGallery(p);
    } catch (e) {
      nameEl.textContent = 'Product Not Found';
      mediaEl.innerHTML = '';
      priceEl.textContent = '';
      descEl.textContent = '';
    }
  }

  function addToCart(item) {
    try {
      const key = 'g4a_cart';
      const raw = localStorage.getItem(key);
      const cart = raw ? JSON.parse(raw) : [];
      const existing = cart.find((c) => c.id === item.id);
      if (existing) existing.qty = (existing.qty || 1) + 1;
      else cart.push({ id: item.id, name: item.name, price: item.price, qty: 1 });
      localStorage.setItem(key, JSON.stringify(cart));
      return true;
    } catch (_) { return false; }
  }

  addCartBtn?.addEventListener('click', async () => {
    try {
      const res = await fetch(`/api/products/${encodeURIComponent(id)}`);
      if (!res.ok) throw new Error('Not found');
      const p = await res.json();
      const ok = addToCart(p);
      const prev = addCartBtn.textContent;
      addCartBtn.textContent = ok ? 'Added!' : 'Failed';
      addCartBtn.disabled = true;
      setTimeout(() => { addCartBtn.textContent = prev; addCartBtn.disabled = false; }, 1200);
    } catch (_) {
      const prev = addCartBtn.textContent;
      addCartBtn.textContent = 'Failed';
      setTimeout(() => { addCartBtn.textContent = prev; }, 1200);
    }
  });

  load();

  function renderGallery(p) {
    const items = [];
    if (Array.isArray(p.images) && p.images.length) {
      for (const src of p.images) items.push({ type: 'image', src });
    }
    if (p.video) items.push({ type: 'video', src: p.video });
    if (!items.length) items.push({ type: 'image', src: '/placeholder.svg' });

    mediaEl.innerHTML = '';
    const viewer = document.createElement('div');
    viewer.className = 'viewer';
    const thumbs = document.createElement('div');
    thumbs.className = 'thumbs';

    mediaEl.appendChild(viewer);
    mediaEl.appendChild(thumbs);

    let currentIndex = 0;
    function setMain(it, idx = 0) {
      currentIndex = idx;
      viewer.innerHTML = '';
      if (it.type === 'video') {
        const v = document.createElement('video');
        v.src = it.src;
        v.controls = true;
        v.playsInline = true;
        if (Array.isArray(p.images) && p.images[0]) v.poster = p.images[0];
        viewer.appendChild(v);
      } else {
        const img = document.createElement('img');
        img.src = it.src;
        img.alt = p.name;
        img.loading = 'lazy';
        viewer.appendChild(img);
      }
    }

    items.forEach((it, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('aria-current', i === 0 ? 'true' : 'false');
      btn.setAttribute('aria-label', (it.type === 'video' ? 'Show video ' : 'Show image ') + (i + 1));
      const wrap = document.createElement('div');
      wrap.style.position = 'relative';
      const img = document.createElement('img');
      img.src = it.type === 'image' ? it.src : '/placeholder.svg';
      img.alt = p.name + ' thumbnail';
      wrap.appendChild(img);
      if (it.type === 'video') {
        const badge = document.createElement('span');
        badge.className = 'vid-badge';
        badge.textContent = 'Video';
        wrap.appendChild(badge);
      }
      btn.appendChild(wrap);
      btn.addEventListener('click', () => {
        setMain(it, i);
        Array.from(thumbs.children).forEach((c) => c.setAttribute('aria-current', 'false'));
        btn.setAttribute('aria-current', 'true');
      });
      thumbs.appendChild(btn);
    });

    setMain(items[0], 0);

    // Lightbox for a closer look
    function openLightbox(index) {
      const overlay = document.createElement('div');
      overlay.className = 'lightbox';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');

      const frame = document.createElement('div');
      frame.className = 'lightbox-content';

      function render(indexToShow) {
        frame.innerHTML = '';
        const cur = items[indexToShow];
        if (cur.type === 'video') {
          const v = document.createElement('video');
          v.src = cur.src;
          v.controls = true;
          v.autoplay = true;
          v.playsInline = true;
          frame.appendChild(v);
        } else {
          const img = document.createElement('img');
          img.src = cur.src;
          img.alt = p.name;
          frame.appendChild(img);
        }
      }

      const close = () => {
        document.removeEventListener('keydown', onKey);
        overlay.remove();
      };

      function onKey(e) {
        if (e.key === 'Escape') close();
        if (e.key === 'ArrowRight') { indexNav(1); }
        if (e.key === 'ArrowLeft') { indexNav(-1); }
      }

      function indexNav(delta) {
        const next = (index + delta + items.length) % items.length;
        index = next;
        render(index);
      }

      const closeBtn = document.createElement('button');
      closeBtn.className = 'lightbox-close';
      closeBtn.type = 'button';
      closeBtn.setAttribute('aria-label', 'Close');
      closeBtn.textContent = 'X';
      closeBtn.textContent = '×';
      closeBtn.addEventListener('click', close);

      overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
      document.addEventListener('keydown', onKey);

      overlay.appendChild(frame);
      overlay.appendChild(closeBtn);
      document.body.appendChild(overlay);
      render(index);
    }

    viewer.addEventListener('click', () => openLightbox(currentIndex));
  }
})();
