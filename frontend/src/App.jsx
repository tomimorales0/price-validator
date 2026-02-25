import { useState } from "react";
import SearchBar from "./components/SearchBar";
import PriceDisplay from "./components/PriceDisplay";
import ProductCard from "./components/ProductCard";

const API_URL = "http://localhost:3001/api/precio-promedio";

export default function App() {
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

      if (!res.ok) {
        throw new Error(data.error || "Error desconocido del servidor.");
      }

      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      {/* Header */}
      <header className="header">
        <div className="badge">🇦🇷 Mercado Libre Argentina</div>
        <h1>
          Validador de<br />
          <span>Precios ML</span>
        </h1>
        <p>Ingresá un producto y calculamos el precio promedio real del mercado.</p>
      </header>

      {/* Search */}
      <SearchBar
        value={query}
        onChange={setQuery}
        onSubmit={handleSearch}
        loading={loading}
      />

      {/* Error */}
      {error && (
        <div className="error-box fade-in">
          ⚠️ {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="loader-wrap fade-in">
          <div className="spinner" />
          <p>Consultando Mercado Libre...</p>
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <>
          <PriceDisplay
            precio={result.precio_promedio}
            cantidad={result.productos_usados}
            query={result.query}
          />

          <div className="section-title">
            Productos de referencia utilizados
          </div>

          <div className="products-grid stagger">
            {result.productos.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}