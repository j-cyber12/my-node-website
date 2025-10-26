(() => {
  const slider = document.querySelector('.banner-slider');
  // Populate the banner circle with product covers (rotating)
  (async () => {
    try {
      const host = document.querySelector('.hero-art .circle');
      const phoneCoverLink = document.getElementById('mhBtn');
      const phoneBg = document.getElementById('mhBg');
      if (!host && !phoneBg) return;
      const res = await fetch(`/api/products?ts=${Date.now()}`);
      if (!res.ok) return;
      const items = await res.json();
      const picks = [];
      for (const p of items) {
        const cover = Array.isArray(p.images) && p.images[0];
        const inStock = p && p.inStock !== false; // only in-stock
        if (cover && inStock) picks.push({ src: cover, id: p.id, name: p.name, price: p.price });
        if (picks.length >= 6) break;
      }
      if (!picks.length) return;
      if (host) {
        const rot = document.createElement('div');
        rot.className = 'circle-rotator';
        host.appendChild(rot);
        picks.forEach((it, i) => {
          const a = document.createElement('a');
          a.className = 'circle-item' + (i === 0 ? ' is-active' : '');
          a.href = `/product?id=${encodeURIComponent(it.id)}`;
          a.setAttribute('aria-label', it.name || 'Product');
          const img = document.createElement('img');
          img.src = it.src;
          img.alt = it.name || 'Product image';
          a.appendChild(img);
          rot.appendChild(a);
        });
        let i = 0;
        setInterval(() => {
          const nodes = rot.children;
          if (!nodes || nodes.length < 2) return;
          nodes[i].classList.remove('is-active');
          i = (i + 1) % nodes.length;
          nodes[i].classList.add('is-active');
        }, 3500);
      }
      if (phoneBg) {
        let idx = 0;
        const title = document.getElementById('mhTitle');
        const sub = document.getElementById('mhSub');
        const fmt = (n) => new Intl.NumberFormat(undefined,{style:'currency',currency:'USD'}).format(Number(n||0));
        const apply = () => {
          phoneBg.style.backgroundImage = `url(${picks[idx].src})`;
          if (phoneCoverLink) phoneCoverLink.href = `/product?id=${encodeURIComponent(picks[idx].id)}`;
          if (title) title.textContent = picks[idx].name || 'Fresh Picks';
          if (sub && picks[idx]) sub.textContent = `From ${fmt(picks[idx].price)}`;
        };
        apply();
        setInterval(() => { idx = (idx + 1) % picks.length; apply(); }, 4000);
      }
    } catch (_) {}
  })();

  if (!slider) return;

  const slides = Array.from(slider.querySelectorAll('.slide'));
  const controls = document.querySelector('.banner-controls');
  const dotsWrap = controls?.querySelector('.dots');
  const prevBtn = controls?.querySelector('.prev');
  const nextBtn = controls?.querySelector('.next');
  const interval = Number(slider.dataset.interval || 5000);
  const autoplay = slider.dataset.autoplay !== 'false';

  let index = Math.max(0, slides.findIndex(s => s.classList.contains('is-active')));
  if (index < 0) index = 0;
  let timer = null;

  function show(i) {
    slides.forEach((s, idx) => s.classList.toggle('is-active', idx === i));
    if (dotsWrap) Array.from(dotsWrap.children).forEach((d, idx) => d.setAttribute('aria-selected', String(idx === i)));
    index = i;
  }

  function next() { show((index + 1) % slides.length); }
  function prev() { show((index - 1 + slides.length) % slides.length); }

  function start() { if (autoplay) { stop(); timer = setInterval(next, interval); } }
  function stop() { if (timer) { clearInterval(timer); timer = null; } }

  // Dots
  if (dotsWrap) {
    slides.forEach((_, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.role = 'tab';
      b.ariaLabel = `Slide ${i + 1}`;
      b.addEventListener('click', () => { show(i); start(); });
      dotsWrap.appendChild(b);
    });
  }

  // Buttons
  prevBtn?.addEventListener('click', () => { prev(); start(); });
  nextBtn?.addEventListener('click', () => { next(); start(); });

  // Hover pause (desktop)
  slider.addEventListener('mouseenter', stop);
  slider.addEventListener('mouseleave', start);

  // Touch swipe
  let x0 = null;
  slider.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; stop(); }, { passive: true });
  slider.addEventListener('touchend', (e) => {
    if (x0 == null) return start();
    const dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 40) { dx > 0 ? prev() : next(); }
    x0 = null; start();
  });

  // Init
  show(index);
  start();
})();
