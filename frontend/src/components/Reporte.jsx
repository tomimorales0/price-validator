import { useState } from "react";

const API_URL = "http://localhost:3001";

export default function Reporte() {
  const [loading, setLoading] = useState(false);
  const [reporte, setReporte] = useState(null);
  const [error, setError] = useState(null);
  const [expandido, setExpandido] = useState(null);

  const generarReporte = async () => {
    setLoading(true);
    setError(null);
    setReporte(null);
    setExpandido(null);
    try {
      const res = await fetch(`${API_URL}/api/generar-reporte`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setReporte(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpandido = (id) => setExpandido((prev) => (prev === id ? null : id));

  const formatPrice = (price) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0 }).format(price);

  return (
    <div>
      <div className="reporte-header">
        <div>
          <h2 className="reporte-title">Reporte de Catálogo</h2>
          <p className="reporte-subtitle">Precios promedio de todos tus productos de importación</p>
        </div>
        <button className="search-btn" onClick={generarReporte} disabled={loading} style={{ whiteSpace: "nowrap" }}>
          {loading ? "Generando..." : "⚡ Generar Reporte"}
        </button>
      </div>

      {loading && (
        <div className="loader-wrap fade-in">
          <div className="spinner" />
          <p>Analizando catálogo completo...</p>
          <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginTop: 8 }}>Se abre Chrome en segundo plano para cada producto (~1 minuto)</p>
        </div>
      )}

      {error && <div className="error-box fade-in">⚠️ {error}</div>}

      {reporte && (
        <div className="fade-in">
          <div className="reporte-resumen">
            <div className="resumen-card">
              <div className="resumen-num">{reporte.total_productos}</div>
              <div className="resumen-label">Productos analizados</div>
            </div>
            <div className="resumen-card">
              <div className="resumen-num" style={{ color: "var(--green)" }}>{reporte.exitosos}</div>
              <div className="resumen-label">Con datos</div>
            </div>
            <div className="resumen-card">
              <div className="resumen-num" style={{ color: "#ff8080" }}>{reporte.con_errores}</div>
              <div className="resumen-label">Con errores</div>
            </div>
            <div className="resumen-card">
              <div className="resumen-num" style={{ fontSize: "0.9rem" }}>{new Date(reporte.generado_en).toLocaleTimeString("es-AR")}</div>
              <div className="resumen-label">Generado a las</div>
            </div>
          </div>

          <div className="section-title" style={{ marginTop: 32 }}>Detalle por producto</div>

          <div className="reporte-tabla">
            {reporte.reporte.map((item) => (
              <div key={item.id} className={`reporte-row-wrap ${item.error ? "reporte-row--error" : ""}`}>

                <div className="reporte-row" onClick={() => !item.error && toggleExpandido(item.id)} style={{ cursor: item.error ? "default" : "pointer" }}>
                  <div className="reporte-row__info">
                    <div className="reporte-row__nombre">
                      {!item.error && <span className="reporte-chevron">{expandido === item.id ? "▾" : "▸"}</span>}
                      {item.nombreOriginal}
                    </div>
                    <div className="reporte-row__query">🔍 "{item.queryBusqueda}"</div>
                  </div>

                  {item.error ? (
                    <div className="reporte-row__error">Sin datos</div>
                  ) : (
                    <div className="reporte-row__precios">
                      <div className="reporte-precio reporte-precio--main">
                        <span className="reporte-precio__label">Promedio</span>
                        <span className="reporte-precio__value">{formatPrice(item.precio_promedio)}</span>
                      </div>
                      <div className="reporte-precio">
                        <span className="reporte-precio__label">Mín</span>
                        <span className="reporte-precio__value reporte-precio__value--muted">{formatPrice(item.precio_minimo)}</span>
                      </div>
                      <div className="reporte-precio">
                        <span className="reporte-precio__label">Máx</span>
                        <span className="reporte-precio__value reporte-precio__value--muted">{formatPrice(item.precio_maximo)}</span>
                      </div>
                      <div className="reporte-precio">
                        <span className="reporte-precio__label">Muestras</span>
                        <span className="reporte-precio__value reporte-precio__value--muted">{item.productos_usados}</span>
                      </div>
                    </div>
                  )}
                </div>

                {expandido === item.id && item.productos?.length > 0 && (
                  <div className="reporte-detalle">
                    <div className="reporte-detalle__header">
                      <span>Publicaciones usadas como muestra</span>
                      <span>{item.productos.length} resultados</span>
                    </div>
                    {item.productos.map((p, idx) => (
                      <a key={idx} href={p.permalink} target="_blank" rel="noopener noreferrer" className="reporte-detalle__item" onClick={(e) => e.stopPropagation()}>
                        <span className="reporte-detalle__idx">{idx + 1}</span>
                        <span className="reporte-detalle__titulo">{p.title}</span>
                        <span className="reporte-detalle__precio">{formatPrice(p.price)}</span>
                        <span className="reporte-detalle__link">↗</span>
                      </a>
                    ))}
                  </div>
                )}

              </div>
            ))}
          </div>
        </div>
      )}

      {!reporte && !loading && (
        <div className="reporte-empty">
          <div style={{ fontSize: "3rem", marginBottom: 16 }}>📋</div>
          <p>Hacé click en "Generar Reporte" para analizar todos los productos del catálogo.</p>
          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: 8 }}>El proceso tarda ~1 minuto por los delays entre búsquedas.</p>
        </div>
      )}
    </div>
  );
}