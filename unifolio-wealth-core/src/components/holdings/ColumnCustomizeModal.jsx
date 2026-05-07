// @ts-nocheck
import React, { useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { X, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { COLUMN_DEFINITIONS, getDefaultColumnOrder, saveColumnOrder, saveColumnOrderToSupabase } from '@/lib/columnConfig';
import { cn } from '@/lib/utils';

export default function ColumnCustomizeModal({ visibleColumns, onClose, onSave }) {
  const [visible, setVisible] = useState(visibleColumns || []);
  const [isDirty, setIsDirty] = useState(false);

  const availableColumns = COLUMN_DEFINITIONS.filter(col => !visible.includes(col.id));

  const handleDragEnd = (result) => {
    const { source, destination, draggableId } = result;

    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const newVisible = Array.from(visible);

    // Moving from available to visible
    if (source.droppableId === 'available' && destination.droppableId === 'visible') {
      newVisible.splice(destination.index, 0, draggableId);
    }
    // Moving from visible to available
    else if (source.droppableId === 'visible' && destination.droppableId === 'available') {
      newVisible.splice(source.index, 1);
    }
    // Reordering within visible
    else if (source.droppableId === 'visible' && destination.droppableId === 'visible') {
      const [removed] = newVisible.splice(source.index, 1);
      newVisible.splice(destination.index, 0, removed);
    }

    setVisible(newVisible);
    setIsDirty(true);
  };

  const handleReset = () => {
    const defaults = getDefaultColumnOrder();
    setVisible(defaults);
    setIsDirty(true);
  };

  const handleSave = () => {
    saveColumnOrder(visible);          // localStorage — instant
    saveColumnOrderToSupabase(visible); // Supabase — async, fire-and-forget
    onSave(visible);
    onClose();
  };

  const visibleColumnDefs = visible.map(id => COLUMN_DEFINITIONS.find(c => c.id === id)).filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card rounded-lg border border-border w-full max-w-4xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border/50">
          <h2 className="text-sm sm:text-base font-semibold">Customize Columns</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-secondary rounded transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col sm:flex-row gap-4 p-4 sm:p-5">
          <DragDropContext onDragEnd={handleDragEnd}>
            {/* Available Columns */}
            <div className="flex-1 flex flex-col min-w-0">
              <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-3">Available Columns</h3>
              <Droppable droppableId="available" type="COLUMN">
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn(
                      'flex-1 border border-border/50 rounded-lg p-3 overflow-y-auto space-y-2 min-h-[300px] sm:min-h-0',
                      snapshot.isDraggingOver && 'bg-secondary/50 border-primary/50'
                    )}
                  >
                    {availableColumns.map((col, idx) => (
                      <Draggable key={col.id} draggableId={col.id} index={idx}>
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
                            {col.label}
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                    {availableColumns.length === 0 && (
                      <div className="flex items-center justify-center h-full text-muted-foreground/60 text-xs italic">
                        All columns visible
                      </div>
                    )}
                  </div>
                )}
              </Droppable>
            </div>

            {/* Visible Columns */}
            <div className="flex-1 flex flex-col min-w-0">
              <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-3">Visible Columns</h3>
              <Droppable droppableId="visible" type="COLUMN">
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn(
                      'flex-1 border border-border/50 rounded-lg p-3 overflow-y-auto space-y-2 min-h-[300px] sm:min-h-0',
                      snapshot.isDraggingOver && 'bg-primary/10 border-primary/50'
                    )}
                  >
                    {visibleColumnDefs.map((col, idx) => (
                      <Draggable key={col.id} draggableId={col.id} index={idx}>
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
                            {col.label}
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                    {visible.length === 0 && (
                      <div className="flex items-center justify-center h-full text-muted-foreground/60 text-xs italic">
                        Drag columns here
                      </div>
                    )}
                  </div>
                )}
              </Droppable>
            </div>
          </DragDropContext>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-t border-border/50 gap-2 flex-wrap">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="text-xs gap-1.5"
          >
            <RotateCcw className="w-3 h-3" />
            Reset Columns
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
              Cancel
            </Button>
            <Button 
              size="sm" 
              onClick={handleSave}
              disabled={!isDirty}
              className="text-xs"
            >
              Save Changes
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}