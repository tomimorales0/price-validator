export default function SearchBar({ value, onChange, onSubmit, loading }) {
  return (
    <form
      className="search-form"
      onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
    >
      <input
        className="search-input"
        type="text"
        placeholder='Ej: "iPhone 15", "zapatillas Nike", "Smart TV 55"...'
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={loading}
      />
      <button className="search-btn" type="submit" disabled={loading || !value.trim()}>
        {loading ? "Buscando..." : "Calcular Promedio"}
      </button>
    </form>
  );
}