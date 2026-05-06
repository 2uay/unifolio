# Real-Time Simulated Market Movement System

## Overview

A professional, global real-time simulation engine that powers continuous, realistic market movement across the entire Unifolio platform without requiring any manual refresh or separate timers per component.

## Architecture

### Core Components

**1. Global Simulation Engine** (`lib/globalSimulationEngine.js`)
- Single source of truth for all price/probability movements
- Maintains momentum state per asset to simulate realistic trends
- Implements market-open/closed logic (US Eastern Time)
- Exports key functions:
  - `simulatePriceMovement(price, ticker, assetType)` - Realistic price ticks
  - `simulateProbabilityMovement(prob, ticker)` - Keeps prediction markets 0-1
  - `isMarketOpen()` - US market hours check
  - `resetAssetMomentum(ticker)` - Clear momentum for fresh start

**2. Enhanced Live Data Context** (`lib/LiveDataContext.jsx`)
- Manages the global update loop (500-1500ms intervals)
- Registers tickers and prediction markets once, reuses registrations
- Pushes updates to all subscribed components via React state
- Respects `liveDataEnabled` toggle from Settings
- Automatically checks market open/closed status

**3. Animated Numbers** (`components/shared/AnimatedNumber.jsx`)
- Smoothly animates financial values (300ms default)
- Supports currency, percentage, and number formats
- Uses easing for professional feel

**4. Row Flash Effect** (`components/shared/RowFlash.jsx`)
- Detects value changes and applies color flash
- Green for gains, red for losses
- 800ms fade animation

**5. Simulated Live Label** (`components/shared/SimulatedLiveLabel.jsx`)
- Shows "Simulated live data" with pulsing indicator
- Shows "Simulated data paused" when disabled
- Appears on Dashboard and Holdings

## Key Features

### 1. Believable Movement Patterns
- **Momentum Simulation**: Each ticker maintains its own trend state
- **Mean Reversion**: Trends gradually flatten back to neutral
- **Volatility Profiles**:
  - Stocks: 1.0x volatility
  - ETFs: 0.5x volatility (smoother)
  - Crypto: 2.0x volatility (more active)
  - Precious Metals: 0.3x volatility (subtle)
  - Prediction Markets: 0.6x volatility
- **Asset-Specific Behavior**: Different types move independently and realistically

### 2. All Dependent Values Recalculate
When a live price changes, everything updates automatically:
- Market value
- Daily P&L (both amount and %)
- Unrealized gain/loss (both amount and %)
- Portfolio allocation percentages
- Account allocation
- Heatmap colors and intensity
- Top movers list
- Charts
- Watchlist values
- All visible totals

### 3. Market Hours Awareness
- **During Market Hours (9:30 AM - 4:00 PM EST, M-F)**:
  - Stocks and ETFs: Full movement
  - Crypto: Full movement
  - Prediction markets: Full movement
- **After Market Hours**:
  - Stocks and ETFs: 0.0005x movement (very slow)
  - Crypto: Full movement (continues)
  - Prediction markets: Full movement
- **Weekends/Holidays**:
  - Similar to after-hours behavior

### 4. Realized & Closed Positions
- Closed holdings (quantity = 0) do NOT live-update
- Realized/settled prediction markets do NOT update
- Historical values remain fixed
- Only "Open" status positions update

### 5. No Synchronized Movement
- Each ticker moves independently using its own momentum
- Prices don't tick together or in the same direction
- Creates realistic, asynchronous market feel
- Avoids suspicious-looking synchronized patterns

## Integration Points

### Dashboard
- All portfolio totals update continuously
- Daily P&L ticks as prices move
- Unrealized gains update
- Account and sector allocations update
- Top movers list recalculates
- Charts animate with new data

### Holdings Table
- Last price ticks every update
- Daily change % updates
- Position market value updates
- Daily P&L updates
- Unrealized G/L updates
- % of portfolio recalculates
- % of account recalculates
- Heatmap colors shift with new values
- Rows flash subtly on value changes

### Accounts
- Account totals recalculate from live holdings
- Holdings values update inside each account
- Daily P&L per account updates
- Net value updates where live-linked

### Watchlist (When Implemented)
- Each stock price moves independently
- Mini sparklines update smoothly
- Ratios and metrics recalculate
- Search and filtering work on live data

### Prediction Markets (When Implemented)
- Probability fluctuates realistically 0-1
- Contract prices update
- Market value updates
- Position P&L recalculates
- Closed/settled markets stay fixed

### Charts
- Line charts add new points smoothly
- Candlestick candles update logically
- Portfolio value charts animate with totals
- Mini trend sparklines shift naturally

## Settings Control

**Location**: Settings → Market Data → "Simulated Live Data"

**States**:
- **On**: Movement continuous, values update, label shows "Simulated live data"
- **Off**: Movement stops, values freeze, label shows "Simulated data paused"

The toggle respects:
- Privacy mode (values masked but update internally)
- Currency selection (updates in chosen currency)
- Theme and secondary color palette (colors respect selections)

## Performance Optimizations

1. **Single Global Timer**: One 500-1500ms interval, not per component
2. **Efficient Memoization**: Only components with changed data re-render
3. **Lazy Registration**: Tickers registered once, reused
4. **Limited Sparkline Size**: Keep only last 100 points per asset
5. **No Duplicate Updates**: Each asset updates once per cycle
6. **Market Hours Skip**: Slowed updates outside market hours instead of stopping

## Testing Checklist

✅ Open Dashboard → portfolio value moves continuously  
✅ Open Holdings → last prices tick, daily P&L changes  
✅ Daily P&L % updates as prices move  
✅ Unrealized G/L % changes  
✅ Heatmap colors shift with values  
✅ Toggle Settings → "Simulated Live Data" → movement stops/resumes  
✅ Switch currency → values update in new currency  
✅ Turn privacy mode on → values masked but update internally  
✅ Change theme/palette → colors respect new selections  
✅ Navigate pages → no performance lag, no duplicate timers  
✅ Realized positions do NOT update  
✅ After market hours → stocks/ETFs move very slowly, crypto continues  
✅ Top movers list recalculates  
✅ Account allocations update  
✅ Sector allocations update  

## Future Enhancements

When real APIs connect, replace the simulation functions with actual API calls:

```javascript
// Replace simulatePriceMovement() with real data
const newPrice = await fetchLivePrice(ticker);

// Replace simulateProbabilityMovement() with real probabilities
const newProb = await fetchMarketProbability(marketId);

// The rest of the system remains unchanged — same context, same updates
```

## Code Entry Points

1. **Register asset on page load**:
   ```javascript
   const { registerTicker } = useLiveData();
   useEffect(() => {
     holdings.forEach(h => registerTicker(h.ticker, h.assetClass));
   }, [registerTicker]);
   ```

2. **Get live price**:
   ```javascript
   const { liveHoldings } = useLiveData();
   const livePrice = liveHoldings[ticker]?.price ?? fallbackPrice;
   ```

3. **Recalculate dependent values**:
   ```javascript
   const newMarketValue = quantity * livePrice;
   const newUnrealizedGainLoss = newMarketValue - costBasis;
   const newDailyPnl = (livePrice - oldPrice) * quantity;
   // ... update state with new values
   ```

4. **Toggle in Settings**:
   ```javascript
   const { liveDataEnabled, setLiveDataEnabled } = useLiveData();
   <Switch checked={liveDataEnabled} onChange={setLiveDataEnabled} />
   ```

## System Feel

The app feels like a professional trading terminal:
- Continuous, smooth updates without jarring jumps
- Realistic price movements with momentum and trends
- No obvious patterns or synchronized behavior
- Proper market hours respect
- Fast enough to feel responsive, slow enough to be realistic
- Professional animations and transitions
- Privacy-aware (values masked but update internally)
- Elegant toggle to control behavior

No manual refresh needed. No static dashboards. Pure live market simulation.