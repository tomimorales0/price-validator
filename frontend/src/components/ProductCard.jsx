export default function ProductCard({ product }) {
  const formatted = new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(product.price);

  const handleError = (e) => {
    e.target.src = "https://http2.mlstatic.com/resources/frontend/statics/img/logo_large_v2@2x.png";
  };

  return (
    <a className="product-card" href={product.permalink} target="_blank" rel="noopener noreferrer">
      <img src={product.thumbnail} alt={product.title} loading="lazy" onError={handleError} />
      <div className="card-body">
        <div className="card-title">{product.title}</div>
        <div className="card-price">{formatted}</div>
        <div className="card-link">Ver en Mercado Libre</div>
      </div>
    </a>
  );
}