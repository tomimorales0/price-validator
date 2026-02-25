import { useState } from "react";
import SearchBar from "./components/SearchBar";
import PriceDisplay from "./components/PriceDisplay";
import ProductCard from "./components/ProductCard";
import Reporte from "./components/Reporte";

const API_URL = "http://localhost:3001/api/precio-promedio";

export default function App() {
  const [tab, setTab] = useState("buscar");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`${API_URL}?q=${encodeURIComponent(query.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error desconocido.");
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <header className="header">
        <div className="badge">🇦🇷 Mercado Libre Argentina</div>
        <h1>
          Validador de<br />
          <span>Precios ML</span>
        </h1>
        <p>Calculá el precio promedio real del mercado.</p>
      </header>

      {/* Tabs */}
      <div className="tabs">
        <button
          className={`tab-btn ${tab === "buscar" ? "tab-btn--active" : ""}`}
          onClick={() => setTab("buscar")}
        >
          🔍 Búsqueda Manual
        </button>
        <button
          className={`tab-btn ${tab === "reporte" ? "tab-btn--active" : ""}`}
          onClick={() => setTab("reporte")}
        >
          📋 Reporte Catálogo
        </button>
      </div>

      {/* Tab: Búsqueda manual */}
      {tab === "buscar" && (
        <>
          <SearchBar
            value={query}
            onChange={setQuery}
            onSubmit={handleSearch}
            loading={loading}
          />
          {error && <div className="error-box fade-in">⚠️ {error}</div>}
          {loading && (
            <div className="loader-wrap fade-in">
              <div className="spinner" />
              <p>Consultando Mercado Libre...</p>
            </div>
          )}
          {result && !loading && (
            <>
              <PriceDisplay
                precio={result.precio_promedio}
                cantidad={result.productos_usados}
                query={result.query}
              />
              <div className="section-title">Productos de referencia</div>
              <div className="products-grid stagger">
                {result.productos.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* Tab: Reporte catálogo */}
      {tab === "reporte" && <Reporte />}
    </div>
  );
}