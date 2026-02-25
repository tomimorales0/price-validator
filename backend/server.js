import express from "express";
import cors from "cors";
import puppeteer from "puppeteer";

const app = express();
const PORT = 3001;

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

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

async function scrapearML(query) {
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
    console.log(`🌐 Buscando: "${query}"`);

    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
    await page.waitForSelector(".ui-search-layout__item", { timeout: 10000 }).catch(() => {});

    const productos = await page.evaluate(() => {
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

    console.log(`✅ ${productos.length} productos encontrados`);
    return productos;
  } finally {
    await browser.close();
  }
}

app.get("/api/precio-promedio", async (req, res) => {
  const { q } = req.query;
  if (!q || !q.trim()) {
    return res.status(400).json({ error: "El parámetro 'q' es requerido." });
  }

  try {
    const productos = await scrapearML(q);

    if (productos.length === 0) {
      return res.status(404).json({
        error: "No se encontraron productos. Intentá con otro término.",
      });
    }

    const preciosFiltrados = filtrarOutliers(productos.map((p) => p.price));
    const productosFiltrados = productos.filter((p) =>
      preciosFiltrados.includes(p.price)
    );

    const suma = productosFiltrados.reduce((acc, p) => acc + p.price, 0);
    const promedio = suma / productosFiltrados.length;

    return res.json({
      query: q,
      total_resultados: productos.length,
      productos_usados: productosFiltrados.length,
      precio_promedio: Math.round(promedio * 100) / 100,
      productos: productosFiltrados,
    });
  } catch (error) {
    console.error("Error:", error.message);
    return res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n✅ Backend en http://localhost:${PORT}`);
  console.log("👉 Abrí http://localhost:5173");
  console.log("⚠️  Cada búsqueda tarda ~5 segundos (abre Chrome en segundo plano)\n");
});