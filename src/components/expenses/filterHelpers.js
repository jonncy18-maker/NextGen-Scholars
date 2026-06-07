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

function getGroupKey(row, groupBy) {
  if (groupBy === 'month') {
    if (!row.date) return 'Unknown';
    const parts = row.date.split('-');
    return parts.length >= 2 ? `${parts[0]}-${parts[1]}` : 'Unknown';
  }
  if (groupBy === 'year') {
    if (!row.date) return 'Unknown';
    return row.date.split('-')[0] || 'Unknown';
  }
  if (groupBy === 'category') return row.cat || 'Uncategorized';
  if (groupBy === 'semester') return row.sem || 'Unknown';
  return 'All';
}

function getGroupLabel(key, groupBy) {
  if (groupBy === 'month') {
    const [year, month] = key.split('-');
    if (!year || !month) return key;
    return new Date(parseInt(year), parseInt(month) - 1, 1)
      .toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }
  return key;
}

function buildLevelGroups(rows, dimensions, parentKey) {
  const [dim, ...rest] = dimensions;
  const map = new Map();
  rows.forEach(row => {
    const rawKey = getGroupKey(row, dim);
    if (!map.has(rawKey)) map.set(rawKey, []);
    map.get(rawKey).push(row);
  });
  const groups = Array.from(map.entries()).map(([rawKey, grpRows]) => {
    const fullKey = parentKey ? `${parentKey}|${rawKey}` : rawKey;
    const total = grpRows.reduce((s, r) => s + (r.amount || 0) * (r.qty || 1), 0);
    if (rest.length > 0) {
      return { key: fullKey, rawKey, label: getGroupLabel(rawKey, dim), dim, total,
               subgroups: buildLevelGroups(grpRows, rest, fullKey) };
    }
    return { key: fullKey, rawKey, label: getGroupLabel(rawKey, dim), dim, total, rows: grpRows };
  });
  if (dim === 'month' || dim === 'year' || dim === 'semester') {
    groups.sort((a, b) => a.rawKey.localeCompare(b.rawKey));
  }
  return groups;
}

export function groupMultiLevel(rows, dimensions) {
  if (!dimensions || dimensions.length === 0) return null;
  return buildLevelGroups(rows, dimensions, '');
}

export function groupExpenses(rows, groupBy) {
  if (!groupBy || groupBy === 'none') return null;
  const map = new Map();
  rows.forEach(row => {
    const key = getGroupKey(row, groupBy);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  });
  const groups = Array.from(map.entries()).map(([key, grpRows]) => ({
    key,
    label: getGroupLabel(key, groupBy),
    rows: grpRows,
    total: grpRows.reduce((s, r) => s + (r.amount || 0) * (r.qty || 1), 0),
  }));
  if (groupBy === 'month' || groupBy === 'year') groups.sort((a, b) => a.key.localeCompare(b.key));
  if (groupBy === 'semester') groups.sort((a, b) => a.key.localeCompare(b.key));
  return groups;
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
