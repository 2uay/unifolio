import React, { useState } from 'react';
import { Zap, AlertTriangle, Building2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { institutions, accounts, getInstitution } from '@/lib/mockData';
import { formatCurrency } from '@/components/shared/ValueDisplay';
import PageHeader from '@/components/shared/PageHeader';

export default function TradeCenter() {
  const [instId, setInstId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [ticker, setTicker] = useState('');
  const [orderType, setOrderType] = useState('market');
  const [side, setSide] = useState('buy');
  const [quantity, setQuantity] = useState('');
  const [limitPrice, setLimitPrice] = useState('');

  const connectedInst = institutions.filter(i => i.status === 'connected');
  const filteredAccounts = accounts.filter(a => a.institutionId === instId);
  const estimatedValue = quantity ? parseFloat(quantity) * (parseFloat(limitPrice) || 0) : 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Trade Center" description="Place orders across your connected accounts" />

      {/* Coming Soon Banner */}
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 md:p-5 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="font-semibold text-amber-400 text-sm">Trading Integration Coming Soon</h3>
          <p className="text-sm text-muted-foreground mt-1">
            This is a preview of the upcoming trading functionality. Orders cannot be submitted yet.
            When live, you'll be able to trade directly through connected brokerages.
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Order Form */}
        <div className="bg-card rounded-xl border border-border p-6 space-y-5">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" /> New Order
          </h2>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Side</Label>
                <Select value={side} onValueChange={setSide}>
                  <SelectTrigger className="bg-secondary border-border mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="buy">Buy</SelectItem>
                    <SelectItem value="sell">Sell</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Order Type</Label>
                <Select value={orderType} onValueChange={setOrderType}>
                  <SelectTrigger className="bg-secondary border-border mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="market">Market</SelectItem>
                    <SelectItem value="limit">Limit</SelectItem>
                    <SelectItem value="stop">Stop</SelectItem>
                    <SelectItem value="stop_limit">Stop Limit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Institution</Label>
              <Select value={instId} onValueChange={(v) => { setInstId(v); setAccountId(''); }}>
                <SelectTrigger className="bg-secondary border-border mt-1"><SelectValue placeholder="Select institution" /></SelectTrigger>
                <SelectContent>
                  {connectedInst.map(i => (
                    <SelectItem key={i.id} value={i.id}>{i.logo} {i.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Account</Label>
              <Select value={accountId} onValueChange={setAccountId} disabled={!instId}>
                <SelectTrigger className="bg-secondary border-border mt-1"><SelectValue placeholder="Select account" /></SelectTrigger>
                <SelectContent>
                  {filteredAccounts.map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.type} ({a.currency})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Ticker Symbol</Label>
              <Input
                placeholder="e.g. AAPL"
                value={ticker}
                onChange={e => setTicker(e.target.value.toUpperCase())}
                className="bg-secondary border-border mt-1 font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Quantity</Label>
                <Input type="number" placeholder="0" value={quantity} onChange={e => setQuantity(e.target.value)} className="bg-secondary border-border mt-1 font-mono" />
              </div>
              {orderType !== 'market' && (
                <div>
                  <Label className="text-xs text-muted-foreground">Limit Price</Label>
                  <Input type="number" placeholder="0.00" value={limitPrice} onChange={e => setLimitPrice(e.target.value)} className="bg-secondary border-border mt-1 font-mono" />
                </div>
              )}
            </div>

            {estimatedValue > 0 && (
              <div className="p-3 rounded-lg bg-secondary/50 flex justify-between text-sm">
                <span className="text-muted-foreground">Estimated Value</span>
                <span className="font-mono font-semibold">{formatCurrency(estimatedValue)}</span>
              </div>
            )}

            <Button disabled className="w-full" size="lg">
              <Zap className="w-4 h-4 mr-2" />
              Submit Order (Coming Soon)
            </Button>
          </div>
        </div>

        {/* Order Preview */}
        <div className="bg-card rounded-xl border border-border p-6">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">Order Preview</h2>
          <div className="space-y-3 text-sm">
            {[
              ['Side', side.toUpperCase()],
              ['Order Type', orderType.replace('_', ' ').toUpperCase()],
              ['Institution', instId ? getInstitution(instId)?.name : '—'],
              ['Account', accountId ? accounts.find(a => a.id === accountId)?.type : '—'],
              ['Ticker', ticker || '—'],
              ['Quantity', quantity || '—'],
              ['Limit Price', limitPrice ? '$' + parseFloat(limitPrice).toFixed(2) : orderType === 'market' ? 'Market' : '—'],
              ['Estimated Value', estimatedValue > 0 ? formatCurrency(estimatedValue) : '—'],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between py-2 border-b border-border/30">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-mono">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}