/**
 * Appraisal Engine — placeholder for auto-appraisal logic
 * Generates realistic appraisal estimates based on asset type and details
 * Future: integrate real third-party appraisal APIs
 */

export const APPRAISA_ASSET_TYPES = [
  'Real Estate',
  'Vehicle',
  'Precious Metals',
  'Watch',
  'Jewelry',
  'Collectible',
  'Art',
  'Private Business',
  'Private Investment',
  'Cash',
  'Crypto Wallet',
  'Other',
];

export const APPRAISABLE_TYPES = {
  'Real Estate': { appraiseble: true, confidence: 85, provider: 'Real Estate API' },
  'Vehicle': { appraisable: true, confidence: 90, provider: 'Vehicle API' },
  'Precious Metals': { appraisable: true, confidence: 95, provider: 'Metals Spot Price' },
  'Watch': { appraisable: true, confidence: 75, provider: 'Marketplace API' },
  'Jewelry': { appraisable: true, confidence: 65, provider: 'Marketplace Comparison' },
  'Collectible': { appraisable: true, confidence: 60, provider: 'Auction Data' },
  'Art': { appraisable: false, confidence: 0, provider: null },
  'Private Business': { appraisable: false, confidence: 0, provider: null },
  'Private Investment': { appraisable: false, confidence: 0, provider: null },
  'Cash': { appraisable: true, confidence: 100, provider: 'Nominal' },
  'Crypto Wallet': { appraisable: true, confidence: 100, provider: 'Exchange Rate' },
  'Other': { appraisable: false, confidence: 0, provider: null },
};

/**
 * Generate a placeholder appraisal based on asset type and details
 * In production, this would call real third-party APIs
 */
export function generatePlaceholderAppraisal(assetType, assetDetails, userValue = null) {
  const config = APPRAISABLE_TYPES[assetType];
  
  if (!config.appraisable) {
    return {
      appraisable: false,
      status: 'Manual Required',
      confidence: 0,
      provider: null,
      message: `${assetType} requires manual appraisal or professional assessment.`,
    };
  }

  // Generate realistic appraisal range based on asset type
  let baseMid = 50000; // default fallback
  let rangePercent = 0.15; // 15% low/high variance

  switch (assetType) {
    case 'Real Estate':
      baseMid = assetDetails?.estimatedValue || 350000;
      rangePercent = 0.12;
      break;
    case 'Vehicle':
      baseMid = assetDetails?.estimatedValue || 25000;
      rangePercent = 0.08;
      break;
    case 'Precious Metals':
      baseMid = assetDetails?.estimatedValue || 15000;
      rangePercent = 0.05; // metals are more stable
      break;
    case 'Watch':
      baseMid = assetDetails?.estimatedValue || 8000;
      rangePercent = 0.20;
      break;
    case 'Jewelry':
      baseMid = assetDetails?.estimatedValue || 3000;
      rangePercent = 0.25;
      break;
    case 'Collectible':
      baseMid = assetDetails?.estimatedValue || 5000;
      rangePercent = 0.30;
      break;
    case 'Cash':
      baseMid = assetDetails?.estimatedValue || 1000;
      rangePercent = 0.0;
      break;
    case 'Crypto Wallet':
      baseMid = assetDetails?.estimatedValue || 10000;
      rangePercent = 0.10;
      break;
    default:
      baseMid = 50000;
      rangePercent = 0.15;
  }

  const lowValue = Math.round(baseMid * (1 - rangePercent));
  const highValue = Math.round(baseMid * (1 + rangePercent));

  // Calculate discrepancy if user provided a value
  let discrepancy = null;
  let discrepancyWarning = null;
  if (userValue !== null && userValue > 0) {
    const diff = userValue - baseMid;
    const pct = (diff / baseMid) * 100;
    discrepancy = {
      amount: diff,
      percent: pct,
    };

    if (Math.abs(pct) >= 15) {
      if (pct > 0) {
        discrepancyWarning = `Your value is ${Math.abs(pct).toFixed(1)}% above the appraised normal estimate.`;
      } else {
        discrepancyWarning = `Your value is ${Math.abs(pct).toFixed(1)}% below the appraised normal estimate.`;
      }
    }
  }

  return {
    appraisable: true,
    status: 'Available',
    provider: config.provider,
    confidence: config.confidence,
    lowValue,
    midValue: baseMid,
    highValue,
    discrepancy,
    discrepancyWarning,
    source_data: {
      comparable_count: Math.floor(Math.random() * 50) + 20,
      last_comparable_date: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0],
      market_trend: ['stable', 'increasing', 'decreasing'][Math.floor(Math.random() * 3)],
    },
  };
}

export const APPRAISAL_METHODS = [
  'Auto-Appraisal',
  'Manual Value',
  'Manual with Comparison',
  'Appraisal Document',
  'Purchase Price',
  'Market Estimate',
  'Other',
];

export const APPRAISAL_STATUSES = [
  'Available',
  'Unavailable',
  'Pending',
  'Failed',
  'Manual Required',
  'API Not Connected',
];

/**
 * Calculate net value from chosen value, ownership %, and liabilities
 */
export function calculateNetValue(chosenValue, ownershipPercent = 100, liabilityAmount = 0) {
  if (!chosenValue || chosenValue <= 0) return 0;
  const grossValue = chosenValue * (ownershipPercent / 100);
  return Math.max(0, grossValue - liabilityAmount);
}

/**
 * Format appraisal result for display
 */
export function formatAppraisalResult(appraisal) {
  if (!appraisal.appraisable) {
    return {
      display: appraisal.message,
      status: appraisal.status,
      confidence: 0,
    };
  }

  return {
    low: appraisal.lowValue,
    mid: appraisal.midValue,
    high: appraisal.highValue,
    confidence: appraisal.confidence,
    provider: appraisal.provider,
    discrepancy: appraisal.discrepancy,
    warning: appraisal.discrepancyWarning,
  };
}