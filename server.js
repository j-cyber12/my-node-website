const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_CODE = process.env.ADMIN_CODE || '@dX1-9aD';

// Paths
const DATA_DIR = path.join(__dirname, 'data');
const PUBLIC_DIR = path.join(__dirname, 'public');
const UPLOADS_DIR = path.join(PUBLIC_DIR, 'uploads');
const VIEWS_DIR = path.join(__dirname, 'views');
const IMAGES_DIR = path.join(UPLOADS_DIR, 'images');
const VIDEOS_DIR = path.join(UPLOADS_DIR, 'videos');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');

// Ensure needed folders exist
[DATA_DIR, PUBLIC_DIR, UPLOADS_DIR, IMAGES_DIR, VIDEOS_DIR, VIEWS_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Initialize data file if missing
if (!fs.existsSync(PRODUCTS_FILE)) {
  fs.writeFileSync(PRODUCTS_FILE, JSON.stringify([], null, 2));
}

// Block old admin paths from being served directly as static files
app.use((req, res, next) => {
  const p = (req.path || '').toLowerCase();
  if (p === '/admin' || p === '/admin/' || p === '/admin.html') {
    return res.status(404).send('Not found');
  }
  next();
});

// Static
app.use(express.static(PUBLIC_DIR));
// JSON parser for API updates
app.use(express.json());

// Simple admin gate: accept any of (query ?code=, cookie admin_code, header x-admin-code, or Basic Auth password)
function requireAdmin(req, res, next) {
  const challenged = () => {
    res.set('WWW-Authenticate', 'Basic realm="G4A Admin", charset="UTF-8"');
    return res.status(401).send('Authentication required');
  };

  try {
    // 1) Query param
    const q = (req.query && (req.query.code || req.query.auth || req.query.token)) || '';
    if (typeof q === 'string' && q === ADMIN_CODE) {
      try { res.cookie('admin_code', ADMIN_CODE, { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 }); } catch (_) {}
      return next();
    }

    // 2) Cookie
    const cookieHeader = req.headers['cookie'] || '';
    if (cookieHeader) {
      const cookies = Object.fromEntries(cookieHeader.split(';').map(p => {
        const i = p.indexOf('=');
        const k = p.slice(0, i >= 0 ? i : undefined).trim();
        const v = i >= 0 ? decodeURIComponent(p.slice(i + 1).trim()) : '';
        return [k, v];
      }));
      if (cookies['admin_code'] === ADMIN_CODE) return next();
    }

    // 3) Header
    const headerCode = req.headers['x-admin-code'];
    if (typeof headerCode === 'string' && headerCode === ADMIN_CODE) return next();

    // 4) Basic Auth
    const hdr = req.headers['authorization'] || '';
    if (hdr.startsWith('Basic ')) {
      const b64 = hdr.slice(6);
      let pass = '';
      try {
        const raw = Buffer.from(b64, 'base64').toString('utf8');
        const idx = raw.indexOf(':');
        pass = idx >= 0 ? raw.slice(idx + 1) : raw;
      } catch (_) {
        return challenged();
      }
      if (pass === ADMIN_CODE) {
        try { res.cookie('admin_code', ADMIN_CODE, { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 }); } catch (_) {}
        return next();
      }
    }

    return challenged();
  } catch (_) {
    return challenged();
  }
}

// Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const isImage = file.mimetype.startsWith('image/');
    const isVideo = file.mimetype.startsWith('video/');
    if (isImage) return cb(null, IMAGES_DIR);
    if (isVideo) return cb(null, VIDEOS_DIR);
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext)
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-');
    const stamp = Date.now();
    cb(null, `${base}-${stamp}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB per file
    files: 10,
  },
});

// Helpers
function readProducts() {
  try {
    const raw = fs.readFileSync(PRODUCTS_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function writeProducts(list) {
  fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(list, null, 2));
}

function newId() {
  if (crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  // Fallback
  return 'p_' + Math.random().toString(36).slice(2) + Date.now();
}

// API: Get all products
app.get('/api/products', (req, res) => {
  const products = readProducts();
  res.json(products);
});

// API: Get single product
app.get('/api/products/:id', (req, res) => {
  const products = readProducts();
  const item = products.find((p) => p.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

// API: Create product (multipart)
// Fields: name, price, description; files: images (array), video (single)
app.post(
  '/api/products',
  requireAdmin,
  upload.fields([
    { name: 'images', maxCount: 8 },
    { name: 'video', maxCount: 1 },
  ]),
  (req, res) => {
    try {
      const { name, price, description, outOfStock } = req.body;
      if (!name || !price) {
        return res.status(400).json({ error: 'name and price are required' });
      }

      const images = (req.files.images || []).map((f) =>
        path.join('/uploads/images', path.basename(f.path)).replace(/\\/g, '/')
      );
      const videoFile = (req.files.video || [])[0];
      const video = videoFile
        ? path
            .join('/uploads/videos', path.basename(videoFile.path))
            .replace(/\\/g, '/')
        : null;

      const product = {
        id: newId(),
        name: String(name),
        price: Number(price),
        description: description ? String(description) : '',
        inStock: String(outOfStock).toLowerCase() === 'on' || String(outOfStock).toLowerCase() === 'true' ? false : true,
        images,
        video,
        createdAt: Date.now(),
      };

      const products = readProducts();
      products.unshift(product);
      writeProducts(products);

      res.status(201).json(product);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to create product' });
    }
  }
);

// API: Update product (partial) - currently supports toggling inStock
app.patch('/api/products/:id', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    console.log('PATCH /api/products/%s body=%j', id, req.body);
    const products = readProducts();
    const idx = products.findIndex((p) => p.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });

    const current = products[idx];
    const next = { ...current };

    // Robust boolean parsing for inStock
    const hasInStock = Object.prototype.hasOwnProperty.call(req.body, 'inStock');
    if (hasInStock) {
      const v = req.body.inStock;
      let b;
      if (typeof v === 'boolean') b = v;
      else if (typeof v === 'number') b = v !== 0;
      else if (typeof v === 'string') {
        const s = v.toLowerCase();
        if (['false', '0', 'off', 'no'].includes(s)) b = false;
        else if (['true', '1', 'on', 'yes'].includes(s)) b = true;
        else b = Boolean(v);
      } else {
        b = Boolean(v);
      }
      next.inStock = b;
    }

    products[idx] = next;
    writeProducts(products);
    console.log('Updated product %s inStock=%s', id, String(next.inStock));
    res.json(next);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// Routes for HTML convenience
// Admin portal (moved to secret-ish path and protected)
app.get('/access-portal-a94h2f1d', requireAdmin, (req, res) => {
  res.sendFile(path.join(VIEWS_DIR, 'admin.html'));
});

app.get('/product', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'product.html'));
});

app.use((req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`GadGets4all server running on http://localhost:${PORT}`);
});
