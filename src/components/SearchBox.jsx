import { useEffect, useRef } from 'react';
import { MapPin, Search, LoaderCircle, X } from 'lucide-react';

export default function SearchBox({ value, onChange, results, loading, onSelect, onSubmit, onClear, errorMessage = '', compact = false }) {
  const rootRef = useRef(null);
  useEffect(() => {
    function closeOnOutside(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) onClear?.();
    }
    document.addEventListener('pointerdown', closeOnOutside);
    return () => document.removeEventListener('pointerdown', closeOnOutside);
  }, [onClear]);

  return (
    <div className={`search-box ${compact ? 'search-box--compact' : ''}`} ref={rootRef}>
      <form className="search-box__field" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
        <Search size={17} aria-hidden="true" />
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Pesquisar cidade..."
          aria-label="Pesquisar cidade"
          autoComplete="off"
        />
        {loading ? <LoaderCircle className="spin" size={16} /> : value ? <button type="button" className="icon-button search-clear" onClick={() => onChange('')} aria-label="Limpar pesquisa"><X size={15} /></button> : null}
      </form>
      {results.length > 0 && (
        <div className="search-results" role="listbox">
          {results.map((city) => (
            <button key={city.id || `${city.latitude}-${city.longitude}`} type="button" className="search-result" onClick={() => onSelect(city)} role="option">
              <span className="search-result__pin"><MapPin size={15} /></span>
              <span><strong>{city.name}</strong><small>{[city.region, city.country].filter(Boolean).join(', ')}</small></span>
            </button>
          ))}
        </div>
      )}
      {value.trim().length >= 2 && !loading && results.length === 0 && (
        <div className={`search-feedback ${errorMessage ? 'search-feedback--error' : ''}`} role="status">
          {errorMessage || 'Nenhuma cidade encontrada. Tente informar também o estado ou o país.'}
        </div>
      )}
    </div>
  );
}
