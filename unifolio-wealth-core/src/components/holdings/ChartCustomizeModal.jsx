import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { X, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function ChartCustomizeModal({ open, onClose, prefs, onSave, chartDefinitions }) {
  const [visible, setVisible] = useState([]);
  const [hidden, setHidden] = useState([]);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (!open || !chartDefinitions) return;
    const orderedVisible = (prefs.orderedChartIds || chartDefinitions.map(c => c.id))
      .filter(id => (prefs.visibleChartIds || chartDefinitions.map(c => c.id)).includes(id))
      .map(id => chartDefinitions.find(c => c.id === id))
      .filter(Boolean);
    const orderedHidden = (prefs.orderedChartIds || chartDefinitions.map(c => c.id))
      .filter(id => !(prefs.visibleChartIds || chartDefinitions.map(c => c.id)).includes(id))
      .map(id => chartDefinitions.find(c => c.id === id))
      .filter(Boolean);
    setVisible(orderedVisible);
    setHidden(orderedHidden);
    setIsDirty(false);
  }, [open, prefs, chartDefinitions]);

  if (!open) return null;

  const handleDragEnd = (result) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const newVisible = Array.from(visible);
    const newHidden = Array.from(hidden);
    const chart = chartDefinitions.find(c => c.id === draggableId);
    if (!chart) return;

    if (source.droppableId === 'hidden' && destination.droppableId === 'visible') {
      newHidden.splice(source.index, 1);
      newVisible.splice(destination.index, 0, chart);
    } else if (source.droppableId === 'visible' && destination.droppableId === 'hidden') {
      newVisible.splice(source.index, 1);
      newHidden.splice(destination.index, 0, chart);
    } else if (source.droppableId === 'visible' && destination.droppableId === 'visible') {
      const [removed] = newVisible.splice(source.index, 1);
      newVisible.splice(destination.index, 0, removed);
    } else if (source.droppableId === 'hidden' && destination.droppableId === 'hidden') {
      const [removed] = newHidden.splice(source.index, 1);
      newHidden.splice(destination.index, 0, removed);
    }

    setVisible(newVisible);
    setHidden(newHidden);
    setIsDirty(true);
  };

  const handleReset = () => {
    const all = chartDefinitions.map(c => c);
    setVisible(all);
    setHidden([]);
    setIsDirty(true);
  };

  const handleSave = () => {
    onSave({
      ...prefs,
      visibleChartIds: visible.map(c => c.id),
      orderedChartIds: [...visible, ...hidden].map(c => c.id),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card rounded-lg border border-border w-full max-w-4xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border/50">
          <h2 className="text-sm sm:text-base font-semibold">Customize Charts</h2>
          <button onClick={onClose} className="p-1 hover:bg-secondary rounded transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col sm:flex-row gap-4 p-4 sm:p-5">
          <DragDropContext onDragEnd={handleDragEnd}>
            {/* Hidden charts */}
            <div className="flex-1 flex flex-col min-w-0">
              <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-3">Hidden Charts</h3>
              <Droppable droppableId="hidden" type="CHART">
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn(
                      'flex-1 border border-border/50 rounded-lg p-3 overflow-y-auto space-y-2 min-h-[200px] sm:min-h-0',
                      snapshot.isDraggingOver && 'bg-secondary/50 border-primary/50'
                    )}
                  >
                    {hidden.map((chart, idx) => (
                      <Draggable key={chart.id} draggableId={chart.id} index={idx}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={cn(
                              'p-2.5 rounded border border-border/30 text-xs cursor-grab active:cursor-grabbing bg-secondary/50 hover:bg-secondary transition-colors text-foreground',
                              snapshot.isDragging && 'bg-primary/20 border-primary/50 shadow-lg'
                            )}
                          >
                            {chart.title}
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                    {hidden.length === 0 && (
                      <div className="flex items-center justify-center h-full text-muted-foreground/60 text-xs italic">
                        All charts visible
                      </div>
                    )}
                  </div>
                )}
              </Droppable>
            </div>

            {/* Visible charts */}
            <div className="flex-1 flex flex-col min-w-0">
              <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-3">Visible Charts</h3>
              <Droppable droppableId="visible" type="CHART">
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn(
                      'flex-1 border border-border/50 rounded-lg p-3 overflow-y-auto space-y-2 min-h-[200px] sm:min-h-0',
                      snapshot.isDraggingOver && 'bg-primary/10 border-primary/50'
                    )}
                  >
                    {visible.map((chart, idx) => (
                      <Draggable key={chart.id} draggableId={chart.id} index={idx}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={cn(
                              'p-2.5 rounded border border-primary/30 text-xs cursor-grab active:cursor-grabbing bg-primary/5 hover:bg-primary/10 transition-colors text-foreground',
                              snapshot.isDragging && 'bg-primary/30 border-primary/50 shadow-lg'
                            )}
                          >
                            {chart.title}
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                    {visible.length === 0 && (
                      <div className="flex items-center justify-center h-full text-muted-foreground/60 text-xs italic">
                        Drag charts here
                      </div>
                    )}
                  </div>
                )}
              </Droppable>
            </div>
          </DragDropContext>
        </div>

        <div className="flex items-center justify-between p-4 sm:p-5 border-t border-border/50 gap-2 flex-wrap">
          <Button variant="ghost" size="sm" onClick={handleReset} className="text-xs gap-1.5">
            <RotateCcw className="w-3 h-3" />
            Reset to Default
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose} className="text-xs">Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={!isDirty} className="text-xs">Save Changes</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
