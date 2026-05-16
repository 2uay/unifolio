// @ts-nocheck
import { Lightbulb } from 'lucide-react';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

// Per-page "Why this page?" affordance. Lives in the page header, top-right
// of the title row. Modal explains, in plain language:
//   1. The concrete benefit (dollar-impact bullets where possible)
//   2. How to use the page (numbered action steps)
//   3. What the page is for (one-sentence summary)
//   4. Who the page is for (including the negative case — "skip if X")
//
// Reuses the shadcn Dialog primitive so behavior (Esc, overlay click, focus
// trap, mobile responsive) matches every other modal in the app.
export default function PageBenefitsDialog({
  title,
  benefits,
  howToUse,
  whatItsFor,
  whoItsFor,
  triggerLabel = 'Why this page?',
}) {
  const benefitItems = Array.isArray(benefits) ? benefits : [];
  const howToUseItems = Array.isArray(howToUse) ? howToUse : [];
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-xs h-7 px-2.5 text-muted-foreground hover:text-foreground hover:bg-secondary"
        >
          <Lightbulb className="w-3.5 h-3.5" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Lightbulb className="w-4 h-4 text-amber-400" />
            {title}
          </DialogTitle>
          <DialogDescription className="text-xs">
            A plain-English overview — what this page does for you and when to use it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {benefitItems.length > 0 && (
            <section>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400/90 mb-1.5">
                The benefit
              </h3>
              <ul className="space-y-1.5 text-sm text-foreground/90">
                {benefitItems.map((b, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-emerald-400/60 flex-shrink-0 mt-0.5">•</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {howToUseItems.length > 0 && (
            <section>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-primary/90 mb-1.5">
                How to use it
              </h3>
              <ol className="space-y-1.5 text-sm text-foreground/90 list-decimal list-inside marker:text-primary/60">
                {howToUseItems.map((step, i) => (
                  <li key={i} className="pl-1">{step}</li>
                ))}
              </ol>
            </section>
          )}

          {whatItsFor && (
            <section>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                What this page is for
              </h3>
              <p className="text-sm text-foreground/90 leading-relaxed">{whatItsFor}</p>
            </section>
          )}

          {whoItsFor && (
            <section>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Who this page is for
              </h3>
              <p className="text-sm text-foreground/90 leading-relaxed">{whoItsFor}</p>
            </section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
