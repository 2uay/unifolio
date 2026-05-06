/**
 * Precious Metals Spot Prices
 * Sample data structure for metals pricing
 * Future: integrate real metals market data APIs
 */

// Troy ounce conversions (standard for metals pricing)
export const UNIT_TO_TROY_OZ = {
  'troy_ounce': 1,
  'ounce': 0.911458,
  'gram': 0.032151,
  'kilogram': 32.1507,
};

export const WEIGHT_UNITS = [
  { id: 'gram', label: 'Grams (g)' },
  { id: 'kilogram', label: 'Kilograms (kg)' },
  { id: 'ounce', label: 'Ounces (oz)' },
  { id: 'troy_ounce', label: 'Troy Ounces (oz t)' },
];

// Sample spot prices (updated daily in production)
export const SAMPLE_SPOT_PRICES = {
  'Gold': {
    metal_type: 'Gold',
    price_per_troy_ounce: 2350, // USD
    currency: 'USD',
    source: 'Sample Data',
    last_updated: new Date().toISOString(),
    status: 'Sample data',
  },
  'Silver': {
    metal_type: 'Silver',
    price_per_troy_ounce: 28.50, // USD
    currency: 'USD',
    source: 'Sample Data',
    last_updated: new Date().toISOString(),
    status: 'Sample data',
  },
  'Platinum': {
    metal_type: 'Platinum',
    price_per_troy_ounce: 1050, // USD
    currency: 'USD',
    source: 'Sample Data',
    last_updated: new Date().toISOString(),
    status: 'Sample data',
  },
  'Palladium': {
    metal_type: 'Palladium',
    price_per_troy_ounce: 950, // USD
    currency: 'USD',
    source: 'Sample Data',
    last_updated: new Date().toISOString(),
    status: 'Sample data',
  },
};

export const PURITY_OPTIONS = {
  'Gold': [
    { label: '24k (99.9%)', value: 0.999 },
    { label: '22k (91.67%)', value: 0.9167 },
    { label: '18k (75%)', value: 0.75 },
    { label: '14k (58.3%)', value: 0.583 },
    { label: 'Custom', value: 'custom' },
  ],
  'Silver': [
    { label: '999 Fine (99.9%)', value: 0.999 },
    { label: '925 Sterling (92.5%)', value: 0.925 },
    { label: 'Custom', value: 'custom' },
  ],
  'Platinum': [
    { label: '950 Fine (95%)', value: 0.95 },
    { label: '900 Fine (90%)', value: 0.90 },
    { label: 'Custom', value: 'custom' },
  ],
  'Palladium': [
    { label: '950 Fine (95%)', value: 0.95 },
    { label: '500 Fine (50%)', value: 0.50 },
    { label: 'Custom', value: 'custom' },
  ],
  'Other': [
    { label: 'Custom', value: 'custom' },
  ],
};

export const METAL_FORMS = [
  'Coin',
  'Bar',
  'Jewelry',
  'Scrap',
  'Bullion',
  'Other',
];

export const METAL_TYPES = ['Gold', 'Silver', 'Platinum', 'Palladium', 'Other'];

/**
 * Calculate precious metal value based on weight, purity, and spot price
 * @param {number} weight - Weight of metal
 * @param {string} weightUnit - Unit of weight (gram, kilogram, ounce, troy_ounce)
 * @param {number} purity - Purity as decimal (0.999, 0.925, etc.)
 * @param {number} spotPrice - Price per troy ounce in USD
 * @returns {object} Valuation object with gross value and details
 */
export function calculateMetalValue(weight, weightUnit, purity, spotPrice) {
  if (!weight || weight <= 0 || !purity || purity <= 0 || !spotPrice || spotPrice <= 0) {
    return null;
  }

  // Convert to troy ounces
  const conversionFactor = UNIT_TO_TROY_OZ[weightUnit] || UNIT_TO_TROY_OZ['gram'];
  const troyOunces = weight * conversionFactor;

  // Apply purity
  const pureMetalOz = troyOunces * purity;

  // Calculate gross value in USD
  const grossValue = pureMetalOz * spotPrice;

  return {
    weight,
    weightUnit,
    purity,
    spotPrice,
    troyOunces: Math.round(troyOunces * 10000) / 10000,
    pureMetalOz: Math.round(pureMetalOz * 10000) / 10000,
    grossValue: Math.round(grossValue * 100) / 100,
  };
}

/**
 * Get spot price for a metal (currently returns sample data)
 * Future: call real metals market API
 */
export function getMetalSpotPrice(metalType) {
  return SAMPLE_SPOT_PRICES[metalType] || SAMPLE_SPOT_PRICES['Gold'];
}

/**
 * Generate realistic appraisal for precious metals
 */
export function generateMetalAppraisal(metalType, weight, weightUnit, purity, manualValue = null) {
  const spotData = getMetalSpotPrice(metalType);
  const valuation = calculateMetalValue(weight, weightUnit, purity, spotData.price_per_troy_ounce);

  if (!valuation) {
    return {
      appraisable: false,
      status: 'Manual Required',
      message: 'Invalid metal parameters.',
    };
  }

  // Metals have very tight spreads, so low/high are close
  const low = Math.round(valuation.grossValue * 0.99); // 1% below spot
  const mid = Math.round(valuation.grossValue);
  const high = Math.round(valuation.grossValue * 1.01); // 1% above spot

  let discrepancy = null;
  let discrepancyWarning = null;

  if (manualValue && manualValue > 0) {
    const diff = manualValue - mid;
    const pct = (diff / mid) * 100;
    discrepancy = {
      amount: diff,
      percent: pct,
    };

    if (Math.abs(pct) >= 5) {
      if (pct > 0) {
        discrepancyWarning = `Your value is ${Math.abs(pct).toFixed(1)}% above melt value. This may reflect collectibility, craftsmanship, rarity, or market premium.`;
      } else {
        discrepancyWarning = `Your value is ${Math.abs(pct).toFixed(1)}% below melt value.`;
      }
    }
  }

  return {
    appraisable: true,
    status: 'Available',
    provider: spotData.source,
    confidence: 95, // Metals are highly liquid
    lowValue: low,
    midValue: mid,
    highValue: high,
    spotPrice: spotData.price_per_troy_ounce,
    spotCurrency: spotData.currency,
    metalDetails: {
      metal_type: metalType,
      weight,
      weight_unit: weightUnit,
      purity,
      troy_ounces: valuation.troyOunces,
      pure_metal_oz: valuation.pureMetalOz,
    },
    discrepancy,
    discrepancyWarning,
    sourceData: {
      pricing_source: spotData.source,
      last_updated: spotData.last_updated,
      pricing_status: spotData.status,
    },
  };
}