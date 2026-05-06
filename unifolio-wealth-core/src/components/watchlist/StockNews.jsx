import React from 'react';
import { Newspaper, ExternalLink } from 'lucide-react';
import { getNewsForTicker } from '@/lib/stockNews';
import { cn } from '@/lib/utils';

const SENTIMENT_COLORS = {
  positive: 'text-emerald-400',
  negative: 'text-red-400',
  neutral: 'text-muted-foreground',
};

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return 'Just now';
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function StockNews({ ticker }) {
  const news = getNewsForTicker(ticker);

  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
        <Newspaper className="w-3 h-3" /> News
      </p>

      {news.length === 0 ? (
        <p className="text-xs text-muted-foreground/60 italic">No recent news available.</p>
      ) : (
        <div className="space-y-2.5">
          {news.map(item => (
            <div key={item.id} className="group">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-medium leading-snug text-foreground group-hover:text-primary transition-colors cursor-pointer flex-1">
                  {item.headline}
                </p>
                <ExternalLink className="w-3 h-3 text-muted-foreground/40 flex-shrink-0 mt-0.5" />
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] text-muted-foreground/60">{item.source}</span>
                <span className="text-muted-foreground/30">·</span>
                <span className="text-[10px] text-muted-foreground/60">{timeAgo(item.published_at)}</span>
                {item.sentiment && (
                  <>
                    <span className="text-muted-foreground/30">·</span>
                    <span className={cn('text-[10px] capitalize', SENTIMENT_COLORS[item.sentiment])}>
                      {item.sentiment}
                    </span>
                  </>
                )}
              </div>
              {item.summary && (
                <p className="text-[10px] text-muted-foreground/60 mt-1 leading-relaxed line-clamp-2">
                  {item.summary}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}