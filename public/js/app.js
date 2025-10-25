(() => {
  const grid = document.getElementById('product-grid');
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  function formatPrice(n) {
    if (Number.isNaN(n)) return '';
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(n);
  }

  function card(product) {
    const cover = product.images && product.images[0] ? product.images[0] : '/placeholder.svg';
    const badge = product.inStock === false ? '<span class="badge-out">Out of stock</span>' : '';
    const a = document.createElement('a');
    a.href = `/product?id=${encodeURIComponent(product.id)}`;
    a.className = 'card product-card';
    a.innerHTML = `
      <div class="thumb">${badge}${cover ? `<img src="${cover}" alt="${product.name}" loading="lazy" />` : ''}</div>
      <div class="product-body">
        <div class="product-name">${product.name}</div>
        <div class="price">${formatPrice(product.price)}</div>
      </div>
    `;
    return a;
  }

  async function load() {
    try {
      const res = await fetch('/api/products');
      const items = await res.json();
      grid.innerHTML = '';
      if (!items.length) {
        grid.innerHTML = '<p class="muted">No products yet. Add some from the Admin page.</p>';
        return;
      }
      // Push out-of-stock items to the end
      const available = items.filter((p) => p && p.inStock !== false);
      const out = items.filter((p) => p && p.inStock === false);
      for (const p of [...available, ...out]) grid.appendChild(card(p));
    } catch (e) {
      grid.innerHTML = '<p>Failed to load products.</p>';
    }
  }

  load();
})();
