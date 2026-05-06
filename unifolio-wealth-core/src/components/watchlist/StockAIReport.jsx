import React, { useState, useEffect } from 'react';
import { Sparkles, Loader2, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { getSavedReport, generateReport } from '@/lib/aiReports';
import { cn } from '@/lib/utils';

function ReportSection({ title, content, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border/50 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-left bg-secondary/30 hover:bg-secondary/50 transition-colors"
      >
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{title}</span>
        {open ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
      </button>
      {open && (
        <div className="px-3 py-2.5 bg-secondary/10">
          {Array.isArray(content) ? (
            <ul className="space-y-1">
              {content.map((item, i) => (
                <li key={i} className="text-[11px] text-muted-foreground leading-relaxed flex gap-2">
                  <span className="text-primary/50 mt-0.5">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[11px] text-muted-foreground leading-relaxed">{content}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function StockAIReport({ ticker, name }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setReport(getSavedReport(ticker));
  }, [ticker]);

  const handleGenerate = async () => {
    setLoading(true);
    const r = await generateReport(ticker, name);
    setReport(r);
    setLoading(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Sparkles className="w-3 h-3" /> AI Report
        </p>
        {report && !loading && (
          <button
            onClick={handleGenerate}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className="w-2.5 h-2.5" /> Regenerate
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
          Generating report for {ticker}…
        </div>
      ) : !report ? (
        <div className="text-center py-5 rounded-lg bg-secondary/20 border border-border/50">
          <Sparkles className="w-5 h-5 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground mb-3">No AI report generated yet.</p>
          <button
            onClick={handleGenerate}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors mx-auto"
          >
            <Sparkles className="w-3 h-3" /> Generate AI Report
          </button>
        </div>
      ) : (
        <div className="space-y-1.5">
          <ReportSection title="Business Summary" content={report.sections.business_summary} defaultOpen={true} />
          <ReportSection title="Recent Performance" content={report.sections.recent_performance} />
          <ReportSection title="Key Strengths" content={report.sections.key_strengths} />
          <ReportSection title="Key Risks" content={report.sections.key_risks} />
          <ReportSection title="Valuation Notes" content={report.sections.valuation_notes} />
          <ReportSection title="Bull Case" content={report.sections.bull_case} />
          <ReportSection title="Bear Case" content={report.sections.bear_case} />
          <ReportSection title="Neutral Summary" content={report.sections.neutral_summary} />
          <p className="text-[9px] text-muted-foreground/40 mt-2 leading-relaxed">
            This AI report is for informational purposes only and is not financial advice. Generated{' '}
            {new Date(report.generated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}.
          </p>
        </div>
      )}
    </div>
  );
}