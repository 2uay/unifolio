import React, { useState } from 'react';
import { TrendingUp, TrendingDown, Plus, BarChart3, Calendar, DollarSign, Eye, Lock } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { usePrivacy } from '@/lib/PrivacyContext.jsx';
import { useCurrency } from '@/lib/CurrencyContext';
import { formatCurrency, PnlValue, StatCard } from '@/components/shared/ValueDisplay';
import PredictionMarketPlatformCard from '@/components/predictionmarkets/PredictionMarketPlatformCard';
import PredictionMarketPositionsTable from '@/components/predictionmarkets/PredictionMarketPositionsTable';

export default function PredictionMarkets() {
  const { privacyMode } = usePrivacy();
  const { convert, displayCurrency } = useCurrency();
  const queryClient = useQueryClient();
  const PM = '••••••';

  // Fetch accounts and positions
  const { data: accounts = [] } = useQuery({
    queryKey: ['predictionMarketAccounts'],
    queryFn: () => base44.entities.PredictionMarketAccount.list('-created_date'),
  });

  const { data: positions = [] } = useQuery({
    queryKey: ['predictionMarketPositions'],
    queryFn: () => base44.entities.PredictionMarketPosition.list('-created_date'),
  });

  // Calculate totals
  const includedAccounts = accounts.filter(a => a.included_in_net_value !== false);
  const totalCashBalance = includedAccounts.reduce((s, a) => s + convert(a.cash_balance || 0, a.currency || 'USD'), 0);
  const totalPositionValue = includedAccounts.reduce((s, a) => s + convert(a.total_position_value || 0, a.currency || 'USD'), 0);
  const totalAccountValue = includedAccounts.reduce((s, a) => s + convert(a.total_account_value || 0, a.currency || 'USD'), 0);
  const totalUnrealizedPnL = positions.filter(p => p.status === 'Open').reduce((s, p) => s + convert(p.unrealized_gain_loss || 0, p.currency || 'USD'), 0);
  const totalRealizedPnL = positions.reduce((s, p) => s + convert(p.realized_gain_loss || 0, p.currency || 'USD'), 0);

  const openPositionsCount = positions.filter(p => p.status === 'Open').length;
  const settledPositionsCount = positions.filter(p => ['Settled', 'Closed', 'Expired'].includes(p.status)).length;

  // Best and worst performing positions
  const sortedByUnrealized = [...positions].sort((a, b) => (b.unrealized_gain_loss || 0) - (a.unrealized_gain_loss || 0));
  const bestPosition = sortedByUnrealized[0];
  const worstPosition = sortedByUnrealized[sortedByUnrealized.length - 1];

  // Fetch platforms
  const { data: platforms = [] } = useQuery({
    queryKey: ['predictionMarketPlatforms'],
    queryFn: () => base44.entities.PredictionMarketPlatform.list('-created_date'),
  });

  const polymarket = platforms.find(p => p.platform_name === 'Polymarket');
  const kalshi = platforms.find(p => p.platform_name === 'Kalshi');

  const hasConnectedAccounts = accounts.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Prediction Markets"
        description="Track your Polymarket and Kalshi positions"
      />

      {!hasConnectedAccounts ? (
        // Empty state
        <div className="bg-card rounded-xl border border-border border-dashed p-10 text-center space-y-4">
          <BarChart3 className="w-12 h-12 mx-auto text-muted-foreground/40" />
          <div>
            <p className="text-base font-semibold text-foreground mb-1">No prediction market accounts connected</p>
            <p className="text-sm text-muted-foreground mb-4">
              Connect Polymarket or Kalshi to track prediction market positions.
            </p>
            <p className="text-xs text-muted-foreground/60 mb-6">
              API integration coming soon. For now, use manual connections.
            </p>
          </div>

          {/* Platform connection cards */}
          <div className="grid sm:grid-cols-2 gap-4 mt-6 max-w-2xl mx-auto">
            <PredictionMarketPlatformCard platform="Polymarket" />
            <PredictionMarketPlatformCard platform="Kalshi" />
          </div>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
            <StatCard
              title={`Total Value (${displayCurrency})`}
              value={formatCurrency(totalAccountValue)}
              icon={DollarSign}
            />
            <StatCard
              title="Cash Balance"
              value={formatCurrency(totalCashBalance)}
              icon={Eye}
            />
            <StatCard
              title="Position Value"
              value={formatCurrency(totalPositionValue)}
              icon={BarChart3}
            />
            <StatCard
              title="Unrealized P&L"
              value={<PnlValue value={totalUnrealizedPnL} className="text-xl md:text-2xl font-bold" />}
              icon={totalUnrealizedPnL >= 0 ? TrendingUp : TrendingDown}
            />
            <StatCard
              title="Realized P&L"
              value={<PnlValue value={totalRealizedPnL} className="text-xl md:text-2xl font-bold" />}
              icon={totalRealizedPnL >= 0 ? TrendingUp : TrendingDown}
            />
          </div>

          {/* Positions stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-card rounded-xl border border-border p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Open Positions</p>
              <p className="text-2xl font-bold mt-2">{openPositionsCount}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Settled</p>
              <p className="text-2xl font-bold mt-2">{settledPositionsCount}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Best Market</p>
              <p className="text-sm font-semibold mt-2 text-emerald-400 truncate">{bestPosition?.market_title || '—'}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Worst Market</p>
              <p className="text-sm font-semibold mt-2 text-red-400 truncate">{worstPosition?.market_title || '—'}</p>
            </div>
          </div>

          {/* Platform connection status */}
          <div className="space-y-3">
            <h2 className="font-semibold text-sm">Connected Platforms</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              <PredictionMarketPlatformCard platform="Polymarket" connectedData={polymarket} />
              <PredictionMarketPlatformCard platform="Kalshi" connectedData={kalshi} />
            </div>
          </div>

          {/* Positions table */}
          {positions.length > 0 && (
            <div className="space-y-3">
              <h2 className="font-semibold text-sm">Open Positions</h2>
              <PredictionMarketPositionsTable positions={positions.filter(p => p.status === 'Open')} />
            </div>
          )}
        </>
      )}
    </div>
  );
}