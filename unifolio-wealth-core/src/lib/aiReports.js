// AI report generation — replace with real backend function later
// Structure: { ticker, generated_at, sections: { ... } }

function getPlaceholderReport(ticker, name) {
  const now = new Date().toISOString();
  return {
    ticker,
    name,
    generated_at: now,
    sections: {
      business_summary: `${name} (${ticker}) is a publicly traded company with a diversified business model. It operates across multiple segments and has established a significant presence in its core markets. The company continues to invest in growth initiatives while managing its cost structure.`,
      recent_performance: `${ticker} has shown ${Math.random() > 0.5 ? 'resilient' : 'mixed'} performance over the past quarter. Revenue trends have been broadly in line with sector peers. Management has reaffirmed guidance, which analysts are taking as a moderately positive signal.`,
      key_strengths: [
        'Strong brand recognition and customer loyalty',
        'Consistent free cash flow generation',
        'Diversified revenue streams reducing single-point risk',
        'Experienced management team with a track record of execution',
      ],
      key_risks: [
        'Macro headwinds from elevated interest rates',
        'Increasing competitive pressure in core segments',
        'Regulatory scrutiny in key markets',
        'Currency exposure from international operations',
      ],
      valuation_notes: `${ticker} trades at a valuation broadly in line with sector medians. Current multiples reflect the market's expectations for moderate growth. A re-rating to the upside would likely require sustained earnings beats or a favorable macro shift.`,
      portfolio_relevance: `Adding ${ticker} could provide ${Math.random() > 0.5 ? 'growth exposure' : 'defensive ballast'} to a portfolio. Its correlation with broader indices is moderate, offering partial diversification benefits. Position sizing should reflect your overall risk tolerance.`,
      bull_case: `In the bull scenario, ${ticker} accelerates top-line growth, expands margins through operational leverage, and benefits from a favorable rate environment — potentially driving significant upside from current levels.`,
      bear_case: `In the bear scenario, macro deterioration, competitive disruption, or execution missteps could compress margins and multiples simultaneously, resulting in meaningful downside from current prices.`,
      neutral_summary: `${ticker} appears fairly valued at current levels. Investors with a medium-to-long term horizon may find the current entry point reasonable, though near-term catalysts are limited. A watchful hold or gradual accumulation approach seems prudent.`,
    },
  };
}

const STORAGE_KEY = 'unifolio_ai_reports';

export function getSavedReport(ticker) {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return all[ticker] || null;
  } catch {
    return null;
  }
}

export function saveReport(ticker, report) {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    all[ticker] = report;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {}
}

export async function generateReport(ticker, name) {
  // Simulate async call — replace with: await base44.functions.invoke('generateStockReport', { ticker, name })
  await new Promise(r => setTimeout(r, 1800));
  const report = getPlaceholderReport(ticker, name);
  saveReport(ticker, report);
  return report;
}