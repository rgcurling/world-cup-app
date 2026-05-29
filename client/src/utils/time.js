export function formatKickoff(utcStr) {
  return new Date(utcStr).toLocaleTimeString(undefined, {
    hour:   '2-digit',
    minute: '2-digit',
  });
}

export function formatDateHeading(utcStr) {
  const d     = new Date(utcStr);
  const today = new Date();
  const tom   = new Date(today);
  tom.setDate(today.getDate() + 1);

  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === tom.toDateString())   return 'Tomorrow';

  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month:   'short',
    day:     'numeric',
  });
}

export function formatRelative(utcStr) {
  const d = new Date(utcStr);
  return d.toLocaleString(undefined, {
    hour:   '2-digit',
    minute: '2-digit',
    month:  'short',
    day:    'numeric',
  });
}

export function groupByDate(matches) {
  const map = new Map();
  for (const m of matches) {
    const key = new Date(m.kickoff_utc).toDateString();
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(m);
  }
  return [...map.entries()].sort(([a], [b]) => new Date(a) - new Date(b));
}
