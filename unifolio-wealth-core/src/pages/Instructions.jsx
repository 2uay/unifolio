import React, { useMemo, useState } from 'react';
import { BookOpen, Download, ExternalLink, FileText, Search } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { bankExportInstructions, downloadInstructionAsset } from '@/lib/bankExportInstructions';
import { cn } from '@/lib/utils';

export default function Instructions() {
  const [query, setQuery] = useState('');
  const [activeId, setActiveId] = useState(bankExportInstructions[0]?.id);

  const filteredBanks = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return bankExportInstructions;
    return bankExportInstructions.filter(bank =>
      [bank.name, bank.country, ...(bank.exportTypes || [])].join(' ').toLowerCase().includes(needle)
    );
  }, [query]);

  const activeBank = bankExportInstructions.find(bank => bank.id === activeId) || filteredBanks[0] || bankExportInstructions[0];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Instructions"
        description="Bank-specific export steps for getting clean CSV data into Unifolio"
      />

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <aside className="rounded-xl border border-border/60 bg-card/75 p-3">
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Find a bank"
              className="h-8 bg-background/50 pl-8 text-xs"
            />
          </div>

          <div className="space-y-1">
            {filteredBanks.map(bank => (
              <button
                key={bank.id}
                type="button"
                onClick={() => setActiveId(bank.id)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors',
                  activeBank?.id === bank.id
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                )}
              >
                <span className="text-sm">{bank.logo}</span>
                <span className="min-w-0 flex-1 truncate font-medium">{bank.name}</span>
                <span className="text-[9px] uppercase opacity-60">{bank.country}</span>
              </button>
            ))}
          </div>
        </aside>

        {activeBank && (
          <section className="rounded-xl border border-border/60 bg-card/75 p-4">
            <div className="flex flex-col gap-3 border-b border-border/50 pb-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{activeBank.logo}</span>
                  <h2 className="text-lg font-semibold text-foreground">{activeBank.name}</h2>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {activeBank.exportTypes.map(type => (
                    <span key={type} className="rounded-full border border-border/60 bg-secondary/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {type.replaceAll('_', ' ')}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {activeBank.links.map(link => (
                  <Button key={link.url} asChild variant="outline" size="sm" className="gap-1.5">
                    <a href={link.url} target="_blank" rel="noreferrer">
                      {link.label}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                ))}
              </div>
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_280px]">
              <div className="space-y-3">
                {activeBank.steps.map((step, index) => (
                  <div key={step.title} className="flex gap-3 rounded-lg border border-border/50 bg-background/35 p-3">
                    <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                      {index + 1}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-foreground">{step.title}</p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                {activeBank.screenshots.map(shot => (
                  <div key={shot.alt} className="aspect-video rounded-lg border border-dashed border-border bg-secondary/25 p-3">
                    <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
                      <BookOpen className="h-6 w-6 text-primary/70" />
                      <p className="text-xs font-medium">{shot.alt}</p>
                      <p className="text-[10px] opacity-70">Screenshot placeholder</p>
                    </div>
                  </div>
                ))}

                <div className="rounded-lg border border-border/50 bg-background/35 p-3">
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-foreground">
                    <FileText className="h-3.5 w-3.5 text-primary" />
                    Templates
                  </div>
                  <div className="space-y-1.5">
                    {activeBank.downloads.map(download => (
                      <button
                        key={download.filename}
                        type="button"
                        onClick={() => downloadInstructionAsset(download)}
                        className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                      >
                        <span className="truncate">{download.label}</span>
                        <Download className="h-3.5 w-3.5 flex-shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
