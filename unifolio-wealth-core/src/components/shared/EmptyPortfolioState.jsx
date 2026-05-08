import React from 'react';
import { Link } from 'react-router-dom';
import { Upload, PlayCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function EmptyPortfolioState({ className = '', compact = false }) {
  return (
    <div className={cn('rounded-xl border border-border bg-card/70 p-6 text-center', compact ? 'py-5' : 'py-10', className)}>
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Upload className="h-5 w-5" />
      </div>
      <h2 className="text-base font-semibold text-foreground">Import your portfolio to populate Unifolio</h2>
      <p className="mx-auto mt-1 max-w-xl text-sm text-muted-foreground">
        Signed-in accounts now use imported broker data as the source of truth. Upload your latest CSV/Flex export to fill holdings, accounts, transactions, realized positions, and performance.
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <Button asChild size="sm" className="gap-1.5">
          <Link to="/import"><Upload className="h-3.5 w-3.5" /> Import CSV</Link>
        </Button>
        <Button asChild size="sm" variant="outline" className="gap-1.5">
          <Link to="/instructions"><PlayCircle className="h-3.5 w-3.5" /> Export instructions</Link>
        </Button>
      </div>
    </div>
  );
}
