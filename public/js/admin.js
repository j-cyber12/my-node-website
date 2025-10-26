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

  let editingId = null;

  function setFormForEdit(prod) {
    try {
      const nameEl = form?.querySelector('input[name="name"]');
      const priceEl = form?.querySelector('input[name="price"]');
      const descEl = form?.querySelector('textarea[name="description"]');
      const submitBtn = form?.querySelector('button[type="submit"]');
      if (nameEl) nameEl.value = prod.name || '';
      if (priceEl) priceEl.value = String(prod.price ?? '');
      if (descEl) descEl.value = prod.description || '';
      if (submitBtn) submitBtn.textContent = 'Update Product';
      editingId = prod.id;
      form?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (_) {}
  }

  function resetFormState() {
    const submitBtn = form?.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.textContent = 'Add Product';
    editingId = null;
  }

  function smallCard(p) {
    const cover = p.images && p.images[0] ? p.images[0] : '';
    const item = document.createElement('div');
    item.className = 'card product-card';
    const badge = p.inStock === false ? '<span class="badge-out">Out</span>' : '';
    // Card with footer controls (stock toggle)
    item.innerHTML = `
      <div class="admin-menu" aria-label="Admin actions">
        <button class="kebab-btn" type="button" aria-haspopup="true" aria-expanded="false" aria-label="Open actions">&#8942;</button>
        <div class="menu" role="menu" hidden>
          <button type="button" role="menuitem" class="menu-item edit">Edit</button>
          <button type="button" role="menuitem" class="menu-item delete">Delete</button>
        </div>
      </div>
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
    // Wire admin menu
    const menuWrap = item.querySelector('.admin-menu');
    const kebab = item.querySelector('.kebab-btn');
    const menu = item.querySelector('.menu');
    const editBtn = item.querySelector('.menu .edit');
    const delBtn = item.querySelector('.menu .delete');
    const anchor = item.querySelector('a');
    const closeMenu = () => { if (menu) { menu.hidden = true; kebab?.setAttribute('aria-expanded', 'false'); } };
    const toggleMenu = (ev) => {
      ev.preventDefault(); ev.stopPropagation();
      if (!menu) return;
      menu.hidden = !menu.hidden;
      kebab?.setAttribute('aria-expanded', String(!menu.hidden));
    };
    kebab?.addEventListener('click', toggleMenu);
    anchor?.addEventListener('click', () => closeMenu());
    document.addEventListener('click', (e) => {
      if (!menu || menu.hidden) return;
      if (!item.contains(e.target)) closeMenu();
    });
    editBtn?.addEventListener('click', (ev) => { ev.preventDefault(); ev.stopPropagation(); closeMenu(); setFormForEdit(p); });
    delBtn?.addEventListener('click', async (ev) => {
      ev.preventDefault(); ev.stopPropagation();
      closeMenu();
      if (!confirm('Delete this product?')) return;
      try {
        const res = await fetch(`/api/products/${encodeURIComponent(p.id)}`, { method: 'DELETE' });
        if (!res.ok && res.status !== 204) throw new Error('Failed');
        await refreshList();
      } catch (e) {
        alert('Failed to delete product.');
      }
    });

    return item;
  }

  async function refreshList() {
    try {
      const res = await fetch(`/api/products?ts=${Date.now()}`);
      const items = await res.json();
      list.innerHTML = '';
      for (const p of items) list.appendChild(smallCard(p));
    } catch (e) {
      list.innerHTML = '<p>Failed to load products.</p>';
    }
  }

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = form?.querySelector('button[type="submit"]');
    const nameEl = form?.querySelector('input[name="name"]');
    const priceEl = form?.querySelector('input[name="price"]');
    const descEl = form?.querySelector('textarea[name="description"]');
    const isEdit = Boolean(editingId);
    statusEl.textContent = isEdit ? 'Updating...' : 'Uploading...';
    try {
      if (isEdit) {
        const payload = {
          name: nameEl?.value || '',
          price: priceEl?.value || '',
          description: descEl?.value || '',
        };
        const res = await fetch(`/api/products/${encodeURIComponent(editingId)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('Failed');
        await res.json();
        statusEl.textContent = 'Product updated!';
        resetFormState();
        refreshList();
      } else {
        const fd = new FormData(form);
        const res = await fetch('/api/products', {
          method: 'POST',
          body: fd,
        });
        if (!res.ok) throw new Error('Failed');
        await res.json();
        form.reset();
        statusEl.textContent = 'Product added!';
        refreshList();
      }
    } catch (err) {
      statusEl.textContent = isEdit ? 'Failed to update product.' : 'Failed to add product.';
    } finally {
      setTimeout(() => (statusEl.textContent = ''), 2000);
    }
  });

  refreshList();
})();



