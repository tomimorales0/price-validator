export default function PriceDisplay({ precio, cantidad, query }) {
  const formatted = new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(precio);

  return (
    <div className="price-display fade-in">
      <div>
        <div className="label">Precio promedio de mercado</div>
        <div className="amount">{formatted}</div>
        <div style={{ marginTop: 8, color: "var(--text-muted)", fontSize: "0.85rem" }}>
          para <strong style={{ color: "var(--text)" }}>"{query}"</strong>
        </div>
      </div>
      <div className="meta">
        <div className="count">{cantidad}</div>
        <div className="count-label">productos analizados</div>
      </div>
    </div>
  );
}