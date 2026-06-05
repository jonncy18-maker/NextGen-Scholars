import React from 'react';

export function FilterPanel({ filters, setFilters, uniqueCats, uniqueStatuses, uniqueSents, onClear }) {
  function toggleArr(key, val) {
    setFilters(f => {
      const arr = f[key];
      return { ...f, [key]: arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val] };
    });
  }

  return (
    <div className="filter-panel">
      <div className="filter-grid">
        <div className="filter-col">
          <div className="filter-label">Item</div>
          <input
            type="text"
            className="filter-text"
            placeholder="Search item name…"
            value={filters.item}
            onChange={e => setFilters(f => ({ ...f, item: e.target.value }))}
          />
        </div>

        <div className="filter-col">
          <div className="filter-label">Category</div>
          <div className="filter-chips">
            {uniqueCats.map(cat => (
              <button
                key={cat}
                className={`filter-chip${filters.cats.includes(cat) ? ' active' : ''}`}
                onClick={() => toggleArr('cats', cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="filter-col">
          <div className="filter-label">Date range</div>
          <div className="filter-range">
            <input type="date" value={filters.dateFrom} onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value }))} />
            <span className="filter-range-sep">→</span>
            <input type="date" value={filters.dateTo} onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value }))} />
          </div>
        </div>

        <div className="filter-col">
          <div className="filter-label">Amount (₱)</div>
          <div className="filter-range">
            <input type="number" placeholder="Min" value={filters.amtMin} min="0" onChange={e => setFilters(f => ({ ...f, amtMin: e.target.value }))} />
            <span className="filter-range-sep">→</span>
            <input type="number" placeholder="Max" value={filters.amtMax} min="0" onChange={e => setFilters(f => ({ ...f, amtMax: e.target.value }))} />
          </div>
        </div>

        <div className="filter-col">
          <div className="filter-label">Status</div>
          <div className="filter-chips">
            {uniqueStatuses.map(st => (
              <button
                key={st}
                className={`filter-chip filter-chip-status${filters.statuses.includes(st) ? ' active' : ''}`}
                onClick={() => toggleArr('statuses', st)}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        <div className="filter-col">
          <div className="filter-label">Sent</div>
          <div className="filter-chips">
            {uniqueSents.map(s => (
              <button
                key={s}
                className={`filter-chip${filters.sents.includes(s) ? ' active' : ''}`}
                onClick={() => toggleArr('sents', s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="filter-footer">
        <button className="filter-clear" onClick={onClear}>Clear all filters</button>
      </div>
    </div>
  );
}
