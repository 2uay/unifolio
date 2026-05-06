import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  DEBT_TYPES,
  LOAN_TYPES,
  PAYMENT_PROVIDERS,
  CONNECTION_STATUSES,
} from '@/lib/debtEngine';

const DEBT_TYPE_CONFIG = {
  'Credit card': { icon: '💳', fields: 'creditCard' },
  'Mortgage': { icon: '🏠', fields: 'loan', loanType: 'Mortgage' },
  'Auto loan': { icon: '🚗', fields: 'loan', loanType: 'Auto loan' },
  'Student loan': { icon: '🎓', fields: 'loan', loanType: 'Student loan' },
  'Personal loan': { icon: '💰', fields: 'loan', loanType: 'Personal loan' },
  'Line of credit': { icon: '📋', fields: 'loan', loanType: 'Line of credit' },
  'Payment app balance': { icon: '📱', fields: 'paymentBalance' },
  'Other liability': { icon: '⚠️', fields: 'loan', loanType: 'Other' },
  'Other cash balance': { icon: '💵', fields: 'paymentBalance' },
};

export default function DebtEntryModal({ onClose, onSave }) {
  const [step, setStep] = useState(1);
  const [debtType, setDebtType] = useState('');
  const [data, setData] = useState({});
  const [currency, setCurrency] = useState('USD');

  const config = DEBT_TYPE_CONFIG[debtType];
  const isCreditCard = config?.fields === 'creditCard';
  const isLoan = config?.fields === 'loan';
  const isPayment = config?.fields === 'paymentBalance';

  const handleNext = () => {
    if (step === 1 && !debtType) return;
    if (step === 2) {
      // Validate required fields
      if (isCreditCard && (!data.provider_name || !data.card_name || !data.current_balance)) return;
      if (isLoan && (!data.lender_name || !data.loan_name || !data.outstanding_balance)) return;
      if (isPayment && (!data.provider_name || !data.account_name || data.balance === undefined)) return;
    }
    setStep(step + 1);
  };

  const handlePrevious = () => setStep(Math.max(1, step - 1));

  const handleSave = () => {
    let payload = { currency };

    if (isCreditCard) {
      payload = {
        ...payload,
        type: 'CreditCard',
        provider_name: data.provider_name,
        card_name: data.card_name,
        last_four_digits: data.last_four_digits,
        current_balance: parseFloat(data.current_balance) || 0,
        credit_limit: data.credit_limit ? parseFloat(data.credit_limit) : null,
        available_credit: data.available_credit ? parseFloat(data.available_credit) : null,
        minimum_payment: data.minimum_payment ? parseFloat(data.minimum_payment) : null,
        payment_due_date: data.payment_due_date || null,
        interest_rate: data.interest_rate ? parseFloat(data.interest_rate) : null,
        connection_status: 'Manual',
        include_in_net_value: true,
      };
    } else if (isLoan) {
      payload = {
        ...payload,
        type: 'Loan',
        loan_type: config.loanType,
        lender_name: data.lender_name,
        loan_name: data.loan_name,
        outstanding_balance: parseFloat(data.outstanding_balance) || 0,
        original_balance: data.original_balance ? parseFloat(data.original_balance) : null,
        interest_rate: data.interest_rate ? parseFloat(data.interest_rate) : null,
        monthly_payment: data.monthly_payment ? parseFloat(data.monthly_payment) : null,
        next_payment_date: data.next_payment_date || null,
        maturity_date: data.maturity_date || null,
        connection_status: 'Manual',
        include_in_net_value: true,
      };
    } else if (isPayment) {
      payload = {
        ...payload,
        type: 'PaymentBalance',
        provider_name: data.provider_name,
        account_name: data.account_name,
        balance: parseFloat(data.balance) || 0,
        balance_type: data.balance ? (parseFloat(data.balance) > 0 ? 'Positive balance' : 'Amount owed') : 'Pending balance',
        connection_status: 'Manual',
        include_in_net_value: true,
      };
    }

    onSave(payload);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card rounded-2xl border border-border w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Add Debt or Balance</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">✕</button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Step 1: Type Selection */}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">What are you adding?</h3>
              <div className="grid grid-cols-2 gap-3">
                {DEBT_TYPES.map(type => {
                  const cfg = DEBT_TYPE_CONFIG[type];
                  return (
                    <button
                      key={type}
                      onClick={() => setDebtType(type)}
                      className={cn(
                        'p-4 rounded-lg border-2 transition-all text-left space-y-2',
                        debtType === type
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-primary/50'
                      )}
                    >
                      <span className="text-2xl">{cfg?.icon || '📌'}</span>
                      <div className="text-sm font-medium">{type}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 2: Details */}
          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Details</h3>

              {isCreditCard && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold mb-2 block">Provider *</label>
                    <Input
                      placeholder="Amex, Visa, Mastercard, etc."
                      value={data.provider_name || ''}
                      onChange={e => setData({ ...data, provider_name: e.target.value })}
                      className="h-9 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold mb-2 block">Card Name *</label>
                    <Input
                      placeholder="e.g., Amex Cobalt, RBC Visa"
                      value={data.card_name || ''}
                      onChange={e => setData({ ...data, card_name: e.target.value })}
                      className="h-9 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold mb-2 block">Last 4 Digits</label>
                    <Input
                      placeholder="1234"
                      value={data.last_four_digits || ''}
                      onChange={e => setData({ ...data, last_four_digits: e.target.value })}
                      className="h-9 text-xs"
                      maxLength="4"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold mb-2 block">Current Balance *</label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={data.current_balance || ''}
                        onChange={e => setData({ ...data, current_balance: e.target.value })}
                        className="h-9 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold mb-2 block">Credit Limit</label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={data.credit_limit || ''}
                        onChange={e => setData({ ...data, credit_limit: e.target.value })}
                        className="h-9 text-xs"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold mb-2 block">Minimum Payment</label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={data.minimum_payment || ''}
                        onChange={e => setData({ ...data, minimum_payment: e.target.value })}
                        className="h-9 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold mb-2 block">Interest Rate (%)</label>
                      <Input
                        type="number"
                        placeholder="19.99"
                        step="0.01"
                        value={data.interest_rate || ''}
                        onChange={e => setData({ ...data, interest_rate: e.target.value })}
                        className="h-9 text-xs"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold mb-2 block">Payment Due Date</label>
                    <Input
                      type="date"
                      value={data.payment_due_date || ''}
                      onChange={e => setData({ ...data, payment_due_date: e.target.value })}
                      className="h-9 text-xs"
                    />
                  </div>
                </div>
              )}

              {isLoan && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold mb-2 block">Lender Name *</label>
                    <Input
                      placeholder="e.g., Royal Bank, TD, BMO"
                      value={data.lender_name || ''}
                      onChange={e => setData({ ...data, lender_name: e.target.value })}
                      className="h-9 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold mb-2 block">Loan Name *</label>
                    <Input
                      placeholder="e.g., Primary Mortgage, Auto Loan"
                      value={data.loan_name || ''}
                      onChange={e => setData({ ...data, loan_name: e.target.value })}
                      className="h-9 text-xs"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold mb-2 block">Outstanding Balance *</label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={data.outstanding_balance || ''}
                        onChange={e => setData({ ...data, outstanding_balance: e.target.value })}
                        className="h-9 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold mb-2 block">Original Balance</label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={data.original_balance || ''}
                        onChange={e => setData({ ...data, original_balance: e.target.value })}
                        className="h-9 text-xs"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold mb-2 block">Interest Rate (%)</label>
                      <Input
                        type="number"
                        placeholder="5.5"
                        step="0.01"
                        value={data.interest_rate || ''}
                        onChange={e => setData({ ...data, interest_rate: e.target.value })}
                        className="h-9 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold mb-2 block">Monthly Payment</label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={data.monthly_payment || ''}
                        onChange={e => setData({ ...data, monthly_payment: e.target.value })}
                        className="h-9 text-xs"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold mb-2 block">Next Payment Date</label>
                      <Input
                        type="date"
                        value={data.next_payment_date || ''}
                        onChange={e => setData({ ...data, next_payment_date: e.target.value })}
                        className="h-9 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold mb-2 block">Maturity/Payoff Date</label>
                      <Input
                        type="date"
                        value={data.maturity_date || ''}
                        onChange={e => setData({ ...data, maturity_date: e.target.value })}
                        className="h-9 text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              {isPayment && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold mb-2 block">Provider *</label>
                    <select
                      value={data.provider_name || ''}
                      onChange={e => setData({ ...data, provider_name: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs h-9"
                    >
                      <option value="">Select provider</option>
                      {PAYMENT_PROVIDERS.map(p => <option key={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold mb-2 block">Account Name *</label>
                    <Input
                      placeholder="e.g., PayPal, Venmo, Cash App"
                      value={data.account_name || ''}
                      onChange={e => setData({ ...data, account_name: e.target.value })}
                      className="h-9 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold mb-2 block">Balance *</label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={data.balance !== undefined ? data.balance : ''}
                      onChange={e => setData({ ...data, balance: e.target.value })}
                      className="h-9 text-xs"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">Positive for cash balance, negative for amount owed</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Currency & Confirm */}
          {step === 3 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Currency & Settings</h3>
              <div>
                <label className="text-xs font-semibold mb-2 block">Currency</label>
                <select
                  value={currency}
                  onChange={e => setCurrency(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs"
                >
                  <option>USD</option>
                  <option>CAD</option>
                  <option>EUR</option>
                  <option>GBP</option>
                </select>
              </div>

              <div className="p-3 rounded-lg bg-secondary/40 space-y-2">
                <p className="text-xs font-semibold">Summary</p>
                <div className="text-[11px] space-y-1 text-muted-foreground">
                  {isCreditCard && (
                    <>
                      <div className="flex justify-between"><span>{data.card_name}</span><span>{data.current_balance} {currency}</span></div>
                      {data.credit_limit && <div className="flex justify-between"><span>Credit Limit</span><span>{data.credit_limit} {currency}</span></div>}
                    </>
                  )}
                  {isLoan && (
                    <>
                      <div className="flex justify-between"><span>{data.loan_name}</span><span>{data.outstanding_balance} {currency}</span></div>
                      {data.interest_rate && <div className="flex justify-between"><span>Interest Rate</span><span>{data.interest_rate}%</span></div>}
                    </>
                  )}
                  {isPayment && (
                    <div className="flex justify-between"><span>{data.account_name}</span><span>{data.balance} {currency}</span></div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-6 py-4 flex items-center justify-between bg-card">
          <button
            onClick={handlePrevious}
            disabled={step === 1}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-border text-muted-foreground disabled:opacity-50"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Previous
          </button>

          <span className="text-xs text-muted-foreground">Step {step} of 3</span>

          <div className="flex items-center gap-2">
            {step < 3 ? (
              <Button onClick={handleNext} size="sm" disabled={!debtType || (step === 2 && !data.provider_name)} className="gap-1.5">
                Next <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            ) : (
              <Button onClick={handleSave} size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
                <CheckCircle className="w-3.5 h-3.5" /> Save
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}