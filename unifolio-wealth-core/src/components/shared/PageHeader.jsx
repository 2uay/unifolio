import React from 'react';

export default function PageHeader({ title, description, actions }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-4 mb-4 sm:mb-6">
      <div className="min-w-0">
        <h1 className="text-lg sm:text-xl md:text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-[11px] sm:text-xs text-muted-foreground/60 mt-0.5">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-1 sm:gap-2 flex-wrap">{actions}</div>}
    </div>);

}