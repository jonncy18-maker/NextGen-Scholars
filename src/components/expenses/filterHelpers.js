export const EMPTY_FILTERS = {
  item: '',
  cats: [],
  dateFrom: '',
  dateTo: '',
  amtMin: '',
  amtMax: '',
  statuses: [],
  sents: [],
};

export function countActiveFilters(f) {
  return (f.item ? 1 : 0) +
    (f.cats.length ? 1 : 0) +
    (f.dateFrom || f.dateTo ? 1 : 0) +
    (f.amtMin !== '' || f.amtMax !== '' ? 1 : 0) +
    (f.statuses.length ? 1 : 0) +
    (f.sents.length ? 1 : 0);
}

export function applyFilters(rows, f) {
  return rows.filter(r => {
    if (f.item && !r.item.toLowerCase().includes(f.item.toLowerCase())) return false;
    if (f.cats.length > 0 && !f.cats.includes(r.cat)) return false;
    if (f.dateFrom && r.date < f.dateFrom) return false;
    if (f.dateTo && r.date > f.dateTo) return false;
    if (f.amtMin !== '' && r.amount < parseFloat(f.amtMin)) return false;
    if (f.amtMax !== '' && r.amount > parseFloat(f.amtMax)) return false;
    if (f.statuses.length > 0 && !f.statuses.includes(r.status)) return false;
    if (f.sents.length > 0 && !f.sents.includes(r.sent)) return false;
    return true;
  });
}

export function applySorting(rows, field, dir) {
  if (!field) return rows;
  return [...rows].sort((a, b) => {
    let va, vb;
    if (field === 'item')   { va = a.item   || ''; vb = b.item   || ''; }
    if (field === 'cat')    { va = a.cat    || ''; vb = b.cat    || ''; }
    if (field === 'date')   { va = a.date   || ''; vb = b.date   || ''; }
    if (field === 'amount') { va = a.amount || 0;  vb = b.amount || 0;  }
    if (field === 'qty')    { va = a.qty    || 1;  vb = b.qty    || 1;  }
    if (field === 'total')  { va = (a.amount || 0) * (a.qty || 1); vb = (b.amount || 0) * (b.qty || 1); }
    if (field === 'status') { va = a.status || ''; vb = b.status || ''; }
    if (field === 'sent')   { va = a.sent   || ''; vb = b.sent   || ''; }
    const cmp = typeof va === 'number' ? va - vb : va.localeCompare(vb);
    return dir === 'asc' ? cmp : -cmp;
  });
}
