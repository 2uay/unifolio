import React from 'react';
import { useStarredStocks } from '@/lib/StarredStocksContext';
import StarIcon from './StarIcon';
import { cn } from '@/lib/utils';

export default function TickerWithStar({ 
  ticker, 
  className = '',
  starClassName = 'w-3.5 h-3.5',
  showEmptyOnHover = true,
  onStarClick,
  interactive = true
}) {
  const { isStar } = useStarredStocks();
  const isStarred = isStar(ticker);

  return (
    <div className={cn('inline-flex items-center gap-1', className)}>
      <span>{ticker}</span>
      {interactive ? (
        <StarIcon 
          isStarred={isStarred}
          onClick={onStarClick}
          className={starClassName}
          interactive
        />
      ) : (
        <StarIcon 
          isStarred={isStarred}
          className={starClassName}
          interactive={false}
          showEmptyOnHover={showEmptyOnHover}
        />
      )}
    </div>
  );
}