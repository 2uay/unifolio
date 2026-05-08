import React, { useState, useMemo } from 'react';
import { Plus, TrendingDown, AlertCircle, PieChart, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/shared/PageHeader';
import DebtEntryModal from '@/components/debts/DebtEntryModal';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrency } from '@/lib/CurrencyContext';
import { usePrivacy } from '@/lib/PrivacyContext.jsx';
import { formatCurrency } from '@/components/shared/ValueDisplay';
import { cn } from '@/lib/utils';
import {
  calculateCreditUtilization,
  findHighestInterestDebt,
  findUpcomingPayments,
  calculateDebtToAssetRatio,
} from '@/lib/debtEngine';

export default function DebtsAndBalances() {
  const { convert } = useCurrency();
  const { privacyMode } = usePrivacy();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const PM = '••••••';
  const listEntity = async (entityName) => {
    try {
      const list = await base44?.entities?.[entityName]?.list?.('-created_date');
      return Array.isArray(list) ? list.filter(Boolean) : [];
    } catch (err) {
      console.warn(`[DebtsAndBalances] ${entityName} unavailable:`, err?.message || err);
      return [];
    }
  };

  // Fetch all debts and balances
  const { data: creditCardsRaw = [] } = useQuery({
    queryKey: ['creditCards'],
    queryFn: () => listEntity('CreditCard'),
  });

  const { data: loansRaw = [] } = useQuery({
    queryKey: ['loans'],
    queryFn: () => listEntity('Loan'),
  });

  const { data: paymentBalancesRaw = [] } = useQuery({
    queryKey: ['paymentBalances'],
    queryFn: () => listEntity('PaymentBalance'),
  });
  const creditCards = Array.isArray(creditCardsRaw) ? creditCardsRaw.filter(Boolean) : [];
  const loans = Array.isArray(loansRaw) ? loansRaw.filter(Boolean) : [];
  const paymentBalances = Array.isArray(paymentBalancesRaw) ? paymentBalancesRaw.filter(Boolean) : [];

  const saveMutation = useMutation({
    mutationFn: (payload) => {
      const { type, ...data } = payload;
      if (type === 'CreditCard') return base44?.entities?.CreditCard?.create?.(data);
      if (type === 'Loan') return base44?.entities?.Loan?.create?.(data);
      if (type === 'PaymentBalance') return base44?.entities?.PaymentBalance?.create?.(data);
      throw new Error('Unsupported debt entry type');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creditCards'] });
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      queryClient.invalidateQueries({ queryKey: ['paymentBalances'] });
      setShowModal(false);
    },
  });

  // Calculations
  const totalCreditCardDebt = useMemo(() => {
    return creditCards
      .filter(c => c.include_in_net_value !== false)
      .reduce((sum, c) => sum + convert(c.current_balance || 0, c.currency || 'USD'), 0);
  }, [creditCards, convert]);

  const totalLoanDebt = useMemo(() => {
    return loans
      .filter(l => l.include_in_net_value !== false)
      .reduce((sum, l) => sum + convert(l.outstanding_balance || 0, l.currency || 'USD'), 0);
  }, [loans, convert]);

  const totalMortgageDebt = useMemo(() => {
    return loans
      .filter(l => l.loan_type === 'Mortgage' && l.include_in_net_value !== false)
      .reduce((sum, l) => sum + convert(l.outstanding_balance || 0, l.currency || 'USD'), 0);
  }, [loans, convert]);

  const totalDebt = totalCreditCardDebt + totalLoanDebt;

  const positivePaymentBalances = useMemo(() => {
    return paymentBalances
      .filter(p => p.balance_type === 'Positive balance' && p.include_in_net_value !== false && p.balance > 0)
      .reduce((sum, p) => sum + convert(p.balance, p.currency || 'USD'), 0);
  }, [paymentBalances, convert]);

  const negativePaymentBalances = useMemo(() => {
    return paymentBalances
      .filter(p => p.balance_type === 'Amount owed' && p.include_in_net_value !== false && p.balance < 0)
      .reduce((sum, p) => sum + Math.abs(convert(p.balance, p.currency || 'USD')), 0);
  }, [paymentBalances, convert]);

  const highestInterestDebt = useMemo(() => {
    const allDebts = [
      ...creditCards.map(c => ({ ...c, type: 'Credit Card', balance: c.current_balance, rate: c.interest_rate })),
      ...loans.map(l => ({ ...l, type: 'Loan', balance: l.outstanding_balance, rate: l.interest_rate })),
    ];
    return findHighestInterestDebt(allDebts);
  }, [creditCards, loans]);

  const upcomingPayments = useMemo(() => {
    const allDebts = [
      ...creditCards.map(c => ({ ...c, type: 'Credit Card', dueDate: c.payment_due_date, minimumPayment: c.minimum_payment })),
      ...loans.map(l => ({ ...l, type: 'Loan', dueDate: l.next_payment_date })),
    ];
    return findUpcomingPayments(allDebts);
  }, [creditCards, loans]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Debts & Balances"
        description="Track credit cards, loans, and payment app balances"
        actions={
          <Button size="sm" onClick={() => setShowModal(true)} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Add Debt or Balance
          </Button>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Debts</p>
          <p className="text-2xl font-bold font-mono mt-2">
            {privacyMode ? PM : formatCurrency(totalDebt)}
          </p>
        </div>

        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Credit Card Debt</p>
          <p className="text-2xl font-bold font-mono mt-2 text-red-400">
            {privacyMode ? PM : formatCurrency(totalCreditCardDebt)}
          </p>
        </div>

        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Loan Debt</p>
          <p className="text-2xl font-bold font-mono mt-2">
            {privacyMode ? PM : formatCurrency(totalLoanDebt)}
          </p>
        </div>

        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Positive Balances</p>
          <p className="text-2xl font-bold font-mono mt-2 text-emerald-400">
            {privacyMode ? PM : formatCurrency(positivePaymentBalances)}
          </p>
        </div>
      </div>

      {/* Alerts */}
      {highestInterestDebt && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 flex gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold">Highest Interest Debt</p>
            <p className="text-xs mt-1">
              {highestInterestDebt.card_name || highestInterestDebt.loan_name} at {highestInterestDebt.interest_rate}%
            </p>
          </div>
        </div>
      )}

      {upcomingPayments.length > 0 && (
        <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-700 flex gap-3">
          <Zap className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold">{upcomingPayments.length} Payment(s) Due Soon</p>
            <p className="text-xs mt-1">
              {upcomingPayments.map(p => p.card_name || p.loan_name).join(', ')} due within 7 days
            </p>
          </div>
        </div>
      )}

      {/* Credit Cards Section */}
      {creditCards.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Credit Cards ({creditCards.length})</h2>
          <div className="space-y-3">
            {creditCards.map(card => {
              const utilization = calculateCreditUtilization(card.current_balance, card.credit_limit);
              return (
                <div key={card.id} className="bg-card rounded-xl border border-border p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold">{card.card_name}</h3>
                      <p className="text-xs text-muted-foreground">{card.provider_name} {card.last_four_digits && `•${card.last_four_digits}`}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold font-mono text-red-400">
                        {privacyMode ? PM : formatCurrency(convert(card.current_balance, card.currency))}
                      </p>
                      {card.interest_rate && <p className="text-[10px] text-muted-foreground">{card.interest_rate}% APR</p>}
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-3 text-[11px]">
                    {card.credit_limit && (
                      <div>
                        <p className="text-muted-foreground mb-1">Limit</p>
                        <p className="font-mono font-semibold">{privacyMode ? PM : formatCurrency(convert(card.credit_limit, card.currency))}</p>
                      </div>
                    )}
                    {utilization && (
                      <div>
                        <p className="text-muted-foreground mb-1">Usage</p>
                        <p className="font-mono font-semibold">{utilization}%</p>
                      </div>
                    )}
                    {card.minimum_payment && (
                      <div>
                        <p className="text-muted-foreground mb-1">Min Payment</p>
                        <p className="font-mono">{privacyMode ? PM : formatCurrency(convert(card.minimum_payment, card.currency))}</p>
                      </div>
                    )}
                    {card.payment_due_date && (
                      <div>
                        <p className="text-muted-foreground mb-1">Due</p>
                        <p className="font-mono">{new Date(card.payment_due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Loans Section */}
      {loans.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Loans ({loans.length})</h2>
          <div className="space-y-3">
            {loans.map(loan => (
              <div key={loan.id} className="bg-card rounded-xl border border-border p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold">{loan.loan_name}</h3>
                    <p className="text-xs text-muted-foreground">{loan.lender_name} • {loan.loan_type}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold font-mono">
                      {privacyMode ? PM : formatCurrency(convert(loan.outstanding_balance, loan.currency))}
                    </p>
                    {loan.interest_rate && <p className="text-[10px] text-muted-foreground">{loan.interest_rate}%</p>}
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-3 text-[11px]">
                  {loan.monthly_payment && (
                    <div>
                      <p className="text-muted-foreground mb-1">Monthly</p>
                      <p className="font-mono font-semibold">{privacyMode ? PM : formatCurrency(convert(loan.monthly_payment, loan.currency))}</p>
                    </div>
                  )}
                  {loan.next_payment_date && (
                    <div>
                      <p className="text-muted-foreground mb-1">Next Payment</p>
                      <p className="font-mono">{new Date(loan.next_payment_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                    </div>
                  )}
                  {loan.maturity_date && (
                    <div>
                      <p className="text-muted-foreground mb-1">Payoff Date</p>
                      <p className="font-mono">{new Date(loan.maturity_date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-muted-foreground mb-1">Status</p>
                    <p className="font-mono text-emerald-400">{loan.connection_status}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payment Balances Section */}
      {paymentBalances.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Payment App Balances ({paymentBalances.length})</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {paymentBalances.map(balance => {
              const isPositive = balance.balance > 0;
              return (
                <div key={balance.id} className={cn('rounded-xl border p-4', isPositive ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20')}>
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-sm">{balance.account_name}</h3>
                      <p className="text-xs text-muted-foreground">{balance.provider_name}</p>
                    </div>
                    <p className={cn('text-lg font-bold font-mono', isPositive ? 'text-emerald-400' : 'text-red-400')}>
                      {privacyMode ? PM : (isPositive ? '+' : '') + formatCurrency(convert(balance.balance, balance.currency))}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {creditCards.length === 0 && loans.length === 0 && paymentBalances.length === 0 && (
        <div className="bg-card rounded-xl border border-border border-dashed p-10 text-center">
          <p className="text-sm text-muted-foreground">No debts or balances added yet.</p>
          <p className="text-xs text-muted-foreground/60 mt-1 mb-4">Track credit cards, loans, and payment app balances here.</p>
          <Button size="sm" onClick={() => setShowModal(true)} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Add your first entry
          </Button>
        </div>
      )}

      {showModal && <DebtEntryModal onClose={() => setShowModal(false)} onSave={(data) => saveMutation.mutate(data)} />}
    </div>
  );
}
