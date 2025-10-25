(() => {
  const form = document.getElementById('product-form');
  const list = document.getElementById('admin-product-list');
  const statusEl = document.getElementById('status');
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  function formatPrice(n) {
    if (Number.isNaN(n)) return '';
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(n);
  }

  function smallCard(p) {
    const cover = p.images && p.images[0] ? p.images[0] : '';
    const item = document.createElement('div');
    item.className = 'card product-card';
    const badge = p.inStock === false ? '<span class="badge-out">Out</span>' : '';
    // Card with footer controls (stock toggle)
    item.innerHTML = `
      <a href="/product?id=${encodeURIComponent(p.id)}">
        <div class="thumb" style="position:relative;">${badge}${cover ? `<img src="${cover}" alt="${p.name}" loading="lazy" />` : ''}</div>
        <div class="product-body">
          <div class="product-name">${p.name}</div>
          <div class="price">${formatPrice(p.price)}</div>
        </div>
      </a>
      <div class="product-admin-actions" style="padding:.6rem .8rem; border-top:1px solid #eef2ff; display:flex; justify-content:flex-start; position:relative; z-index:1;">
        <label class="switch" title="Toggle availability">
          <input type="checkbox" aria-label="Out of stock" ${p.inStock === false ? 'checked' : ''} />
          <span class="slider" aria-hidden="true"></span>
          <span class="switch-label">Out of stock</span>
        </label>
      </div>
    `;

    // Wire toggle: checked means Out of stock -> inStock = false
    const checkbox = item.querySelector('input[type="checkbox"]');
    const actions = item.querySelector('.product-admin-actions');
    const switchLabel = item.querySelector('.switch');
    if (actions) {
      actions.addEventListener('click', (ev) => ev.stopPropagation());
    }
    if (checkbox) {
      // Prevent anchor navigation when interacting with the switch
      checkbox.addEventListener('click', (ev) => {
        ev.stopPropagation();
      });
      // Make the entire label reliably toggle the checkbox and trigger change
      if (switchLabel) {
        switchLabel.addEventListener('click', (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          checkbox.checked = !checkbox.checked;
          checkbox.dispatchEvent(new Event('change', { bubbles: true }));
        });
      }
      checkbox.addEventListener('change', async (ev) => {
        const outOfStockChecked = checkbox.checked;
        const inStock = !outOfStockChecked;
        try {
          checkbox.disabled = true;
          const res = await fetch(`/api/products/${encodeURIComponent(p.id)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ inStock }),
          });
          if (!res.ok) throw new Error('Failed to update');
          // Refresh list to update badges/order
          await refreshList();
        } catch (e) {
          // Revert UI on error
          checkbox.checked = !outOfStockChecked;
          alert('Failed to update stock status.');
        } finally {
          checkbox.disabled = false;
        }
      });
    }
    return item;
  }

  async function refreshList() {
    try {
      const res = await fetch('/api/products');
      const items = await res.json();
      list.innerHTML = '';
      for (const p of items) list.appendChild(smallCard(p));
    } catch (e) {
      list.innerHTML = '<p>Failed to load products.</p>';
    }
  }

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    statusEl.textContent = 'Uploading...';
    const fd = new FormData(form);
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        body: fd,
      });
      if (!res.ok) throw new Error('Failed');
      await res.json();
      form.reset();
      statusEl.textContent = 'Product added!';
      refreshList();
    } catch (err) {
      statusEl.textContent = 'Failed to add product.';
    } finally {
      setTimeout(() => (statusEl.textContent = ''), 2000);
    }
  });

  refreshList();
})();
