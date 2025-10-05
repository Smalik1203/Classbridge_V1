// Production-ready data adapters for Fees Analytics (UI-only)

/**
 * Component Breakdown → 100% stacked horizontal
 * Input: rows with { component, collected, outstanding }
 * Output: rows with { component, collectedPct, outstandingPct, collected, outstanding }
 */
export function adaptComponentBreakdown(rows) {
  return rows
    .map(r => {
      const c = Math.max(0, Number(r.collected ?? 0));
      const o = Math.max(0, Number(r.outstanding ?? 0));
      const total = c + o;
      const collectedPct = total > 0 ? (c / total) * 100 : 0;
      const outstandingPct = total > 0 ? 100 - collectedPct : 0;
      return { 
        component: r.component, 
        collectedPct, 
        outstandingPct, 
        collected: c, 
        outstanding: o, 
        total 
      };
    })
    .sort((a, b) => b.outstandingPct - a.outstandingPct); // most problematic first
}

/**
 * Daily Trends (line/area)
 * Input: rows { date, collected, outstanding }
 * Output: same keys + safe defaults; sorted by date asc
 */
export function adaptDailyTrends(rows) {
  const cleaned = rows.map(r => ({
    date: new Date(r.date),
    collected: Math.max(0, Number(r.collected ?? 0)),
    outstanding: Math.max(0, Number(r.outstanding ?? 0)),
  }));
  cleaned.sort((a, b) => a.date.getTime() - b.date.getTime());
  return cleaned;
}

/**
 * Class-wise Ranking (horizontal bars)
 * Input: rows { className, collected, outstanding }
 * Output: { className, collectionRatePct, outstanding }, sorted desc by collectionRatePct
 */
export function adaptClasswise(rows) {
  return rows
    .map(r => {
      const c = Math.max(0, Number(r.collected ?? 0));
      const o = Math.max(0, Number(r.outstanding ?? 0));
      const total = c + o;
      const pct = total > 0 ? (c / total) * 100 : 0;
      return { 
        className: r.className, 
        collectionRatePct: pct, 
        outstanding: o, 
        total, 
        collected: c 
      };
    })
    .sort((a, b) => b.collectionRatePct - a.collectionRatePct);
}
