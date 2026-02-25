import express from "express";
import cors from "cors";
import puppeteer from "puppeteer";
import { CATALOGO } from "./catalogo.js";

const app = express();
const PORT = 3001;

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

function contieneAlgunaPalabraObligatoria(titulo, palabrasObligatorias = []) {
  if (!palabrasObligatorias.length) return true;
  const t = normalizar(titulo);
  return palabrasObligatorias.some((p) => t.includes(normalizar(p)));
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
    precioMin = null,
    precioMax = null,
  } = opciones;

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
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
    if (palabrasProhibidas.length)   console.log(`   ⛔ Prohibidas: [${palabrasProhibidas.join(", ")}]`);
    if (palabrasObligatorias.length) console.log(`   ✔️  Obligatorias: [${palabrasObligatorias.join(", ")}]`);
    if (precioMin || precioMax)      console.log(`   💲 Rango: $${precioMin ?? 0} - $${precioMax ?? "∞"}`);

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

        const fractionEl = el.querySelector(".andes-money-amount__fraction");
        const priceText = fractionEl?.textContent?.replace(/\./g, "").trim();
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

    // ── Aplicar todos los filtros ──
    const productosFiltrados = todosLosProductos.filter((p) => {
      if (contienePalabraProhibida(p.title, palabrasProhibidas)) {
        console.log(`  ❌ Prohibida:          "${p.title}" ($${p.price.toLocaleString("es-AR")})`);
        return false;
      }
      if (!contieneAlgunaPalabraObligatoria(p.title, palabrasObligatorias)) {
        console.log(`  ❌ Sin obligatoria:    "${p.title}" ($${p.price.toLocaleString("es-AR")})`);
        return false;
      }
      if (precioMin !== null && p.price < precioMin) {
        console.log(`  ❌ Precio muy bajo:    "${p.title}" ($${p.price.toLocaleString("es-AR")})`);
        return false;
      }
      if (precioMax !== null && p.price > precioMax) {
        console.log(`  ❌ Precio muy alto:    "${p.title}" ($${p.price.toLocaleString("es-AR")})`);
        return false;
      }
      console.log(`  ✅ Válido:             "${p.title}" ($${p.price.toLocaleString("es-AR")})`);
      return true;
    });

    console.log(`\n  📊 Resultado: ${productosFiltrados.length}/${todosLosProductos.length} productos pasaron los filtros`);

    return productosFiltrados;
  } finally {
    await browser.close();
  }
}

// ── Endpoint 1: búsqueda manual libre ────────────────────

app.get("/api/precio-promedio", async (req, res) => {
  const { q } = req.query;
  if (!q || !q.trim()) {
    return res.status(400).json({ error: "El parámetro 'q' es requerido." });
  }

  try {
    // Búsqueda libre: sin filtros
    const productos = await scrapearML(q, {});

    if (productos.length === 0) {
      return res.status(404).json({
        error: "No se encontraron productos. Intentá con otro término.",
      });
    }

    const stats = calcularEstadisticas(productos);
    return res.json({ query: q, total_resultados: productos.length, ...stats });
  } catch (error) {
    console.error("Error:", error.message);
    return res.status(500).json({ error: error.message });
  }
});

// ── Endpoint 2: reporte del catálogo ─────────────────────

app.get("/api/generar-reporte", async (req, res) => {
  console.log("\n📋 Generando reporte del catálogo...");

  const reporte = [];
  const errores = [];

  for (const item of CATALOGO) {
    try {
      console.log(`\n━━━ [${item.id}] ${item.nombreOriginal} ━━━`);

      const productos = await scrapearML(item.queryBusqueda, {
        palabrasProhibidas:   item.palabrasProhibidas   ?? [],
        palabrasObligatorias: item.palabrasObligatorias ?? [],
        precioMin:            item.precioMin            ?? null,
        precioMax:            item.precioMax            ?? null,
      });

      if (productos.length === 0) {
        errores.push({ id: item.id, nombre: item.nombreOriginal, error: "Sin resultados válidos" });
        reporte.push({
          id: item.id,
          nombreOriginal: item.nombreOriginal,
          queryBusqueda: item.queryBusqueda,
          error: "No se encontraron productos válidos con los filtros configurados",
          productos: [],
        });
        continue;
      }

      const stats = calcularEstadisticas(productos);
      reporte.push({
        id: item.id,
        nombreOriginal: item.nombreOriginal,
        queryBusqueda: item.queryBusqueda,
        ...stats,
        generado_en: new Date().toISOString(),
      });

      // Delay entre búsquedas para no ser bloqueado por ML
      if (CATALOGO.indexOf(item) < CATALOGO.length - 1) {
        console.log("\n  ⏳ Esperando 4 segundos antes de la próxima búsqueda...");
        await new Promise((r) => setTimeout(r, 4000));
      }
    } catch (error) {
      console.error(`  Error en ${item.id}:`, error.message);
      errores.push({ id: item.id, nombre: item.nombreOriginal, error: error.message });
      reporte.push({
        id: item.id,
        nombreOriginal: item.nombreOriginal,
        queryBusqueda: item.queryBusqueda,
        error: error.message,
        productos: [],
      });
    }
  }

  console.log("\n✅ Reporte completo generado\n");

  return res.json({
    generado_en: new Date().toISOString(),
    total_productos: CATALOGO.length,
    exitosos: reporte.filter((r) => !r.error).length,
    con_errores: errores.length,
    reporte,
  });
});

// ── Endpoint 3: catálogo sin datos sensibles ──────────────

app.get("/api/catalogo", (req, res) => {
  res.json(
    CATALOGO.map(({ id, nombreOriginal, queryBusqueda, precioMin, precioMax }) => ({
      id,
      nombreOriginal,
      queryBusqueda,
      precioMin,
      precioMax,
    }))
  );
});

app.listen(PORT, () => {
  console.log(`\n✅ Backend en http://localhost:${PORT}`);
  console.log("👉 Abrí http://localhost:5173");
  console.log(`📋 Catálogo cargado: ${CATALOGO.length} productos\n`);
});