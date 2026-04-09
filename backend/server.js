import express from "express";
import cors from "cors";
import puppeteer from "puppeteer";
import { CATALOGO } from "./catalogo.js";

const app = express();
// 🔥 CAMBIO 1: Puerto dinámico para Railway
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

// ── Utilidades ────────────────────────────────────────────

function filtrarOutliers(precios) {
  if (precios.length < 4) return precios;
  const sorted = [...precios].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;
  return precios.filter((p) => p >= lowerBound && p <= upperBound);
}

function normalizar(texto) {
  return texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function contienePalabraProhibida(titulo, palabrasProhibidas = []) {
  if (!palabrasProhibidas.length) return false;
  const t = normalizar(titulo);
  return palabrasProhibidas.some((p) => t.includes(normalizar(p)));
}

function contieneTodasLasPalabrasObligatorias(titulo, palabrasObligatorias = []) {
  if (!palabrasObligatorias.length) return true;
  const t = normalizar(titulo);
  return palabrasObligatorias.every((p) => t.includes(normalizar(p)));
}

function contieneAlgunaPalabraSemiObligatoria(titulo, palabrasSemiObligatorias = []) {
  if (!palabrasSemiObligatorias.length) return true;
  const t = normalizar(titulo);
  return palabrasSemiObligatorias.some((p) => t.includes(normalizar(p)));
}

function calcularEstadisticas(productos) {
  if (productos.length === 0) return null;

  const preciosFiltrados = filtrarOutliers(productos.map((p) => p.price));
  const productosFiltrados = productos.filter((p) =>
    preciosFiltrados.includes(p.price)
  );

  const suma = productosFiltrados.reduce((acc, p) => acc + p.price, 0);
  const promedio = suma / productosFiltrados.length;
  const precios = productosFiltrados.map((p) => p.price).sort((a, b) => a - b);
  const mediana = precios[Math.floor(precios.length / 2)];

  return {
    precio_promedio: Math.round(promedio * 100) / 100,
    precio_mediana: mediana,
    precio_minimo: precios[0],
    precio_maximo: precios[precios.length - 1],
    productos_usados: productosFiltrados.length,
    productos: productosFiltrados,
  };
}

// ── Scraper ───────────────────────────────────────────────

async function scrapearML(query, opciones = {}) {
  const {
    palabrasProhibidas = [],
    palabrasObligatorias = [],
    palabrasSemiObligatorias= [],
    precioMin = null,
    precioMax = null,
  } = opciones;

  const browser = await puppeteer.launch({
    headless: "new", // 🔥 CAMBIO 2: Modo headless moderno
    args: [
      "--no-sandbox", 
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage" // 🔥 CAMBIO 3: Evita crashes por falta de memoria compartida
    ],
  });

  try {
    const page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );
    await page.setExtraHTTPHeaders({ "Accept-Language": "es-AR,es;q=0.9" });

    const searchQuery = query.trim().replace(/\s+/g, "-");
    const url = `https://listado.mercadolibre.com.ar/${encodeURIComponent(searchQuery)}`;

    console.log(`\n🌐 Buscando: "${query}"`);

    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
    await page.waitForSelector(".ui-search-layout__item", { timeout: 10000 }).catch(() => {});

    const todosLosProductos = await page.evaluate(() => {
      const items = document.querySelectorAll(".ui-search-layout__item");
      const results = [];

      items.forEach((el, i) => {
        if (i >= 20) return;

        const title =
          el.querySelector(".poly-component__title")?.textContent?.trim() ||
          el.querySelector(".ui-search-item__title")?.textContent?.trim();

        const priceEl = el.querySelector(".poly-price__current .andes-money-amount__fraction") ||
                el.querySelector(".andes-money-amount:not(.andes-money-amount--previous) .andes-money-amount__fraction");
        const priceText = priceEl?.textContent?.replace(/\./g, "").trim();
        const price = parseInt(priceText, 10);

        const permalink =
          el.querySelector("a.poly-component__title")?.href ||
          el.querySelector("a")?.href;

        const imgEl = el.querySelector("img");
        const thumbnail = imgEl?.src || imgEl?.getAttribute("data-src");

        if (title && price && !isNaN(price)) {
          results.push({ id: `ML_${i}`, title, price, thumbnail, permalink });
        }
      });

      return results;
    });

    const productosFiltrados = todosLosProductos.filter((p) => {
      if (contienePalabraProhibida(p.title, palabrasProhibidas)) return false;
      if (!contieneTodasLasPalabrasObligatorias(p.title, palabrasObligatorias)) return false;
      if (!contieneAlgunaPalabraSemiObligatoria(p.title, palabrasSemiObligatorias)) return false;
      if (precioMin !== null && p.price < precioMin) return false;
      if (precioMax !== null && p.price > precioMax) return false;
      return true;
    });

    console.log(`📊 Resultado: ${productosFiltrados.length}/${todosLosProductos.length} válidos`);

    return productosFiltrados;
  } finally {
    await browser.close();
  }
}

// ── Endpoints ────────────────────────────────────────────

app.get("/api/precio-promedio", async (req, res) => {
  const { q } = req.query;
  if (!q || !q.trim()) return res.status(400).json({ error: "Falta parámetro 'q'." });

  try {
    const productos = await scrapearML(q, {});
    if (productos.length === 0) return res.status(404).json({ error: "Sin resultados." });
    const stats = calcularEstadisticas(productos);
    return res.json({ query: q, total_resultados: productos.length, ...stats });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.get("/api/generar-reporte", async (req, res) => {
  const reporte = [];
  for (const item of CATALOGO) {
    try {
      const productos = await scrapearML(item.queryBusqueda, {
        palabrasProhibidas: item.palabrasProhibidas,
        palabrasObligatorias: item.palabrasObligatorias,
        precioMin: item.precioMin,
        precioMax: item.precioMax,
      });

      if (productos.length > 0) {
        const stats = calcularEstadisticas(productos);
        reporte.push({ id: item.id, nombreOriginal: item.nombreOriginal, ...stats });
      }

      if (CATALOGO.indexOf(item) < CATALOGO.length - 1) {
        await new Promise((r) => setTimeout(r, 4000));
      }
    } catch (e) {
      reporte.push({ id: item.id, error: e.message });
    }
  }
  return res.json({ generado_en: new Date().toISOString(), reporte });
});

app.listen(PORT, () => {
  console.log(`\n✅ Servidor listo en puerto ${PORT}`);
});