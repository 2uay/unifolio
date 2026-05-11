import React from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

function reorder(list, startIndex, endIndex) {
  const next = Array.from(list);
  const [removed] = next.splice(startIndex, 1);
  next.splice(endIndex, 0, removed);
  return next;
}

export function TableColumnGrip({ dragHandleProps, className = '' }) {
  return (
    <span
      {...dragHandleProps}
      className={cn(
        'inline-flex cursor-grab items-center justify-center rounded text-muted-foreground/55 transition-colors hover:text-foreground active:cursor-grabbing',
        className
      )}
      title="Drag to reorder column"
      aria-label="Drag to reorder column"
      onClick={(event) => event.stopPropagation()}
    >
      <GripVertical className="h-3.5 w-3.5" />
    </span>
  );
}

export default function DraggableTableHeader({
  columns,
  orderedColumnIds,
  onOrderChange,
  renderCell,
  rowClassName = '',
  cellClassName = '',
  droppableId = 'table-header',
}) {
  const orderedColumns = orderedColumnIds
    .map((id) => columns.find((column) => column.id === id))
    .filter(Boolean);

  const handleDragEnd = (result) => {
    const { destination, source } = result;
    if (!destination) return;
    if (destination.index === source.index) return;
    const nextOrder = reorder(orderedColumnIds, source.index, destination.index);
    onOrderChange?.(nextOrder);
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <Droppable droppableId={droppableId} direction="horizontal">
        {(provided) => (
          <thead>
            <tr
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={rowClassName}
            >
              {orderedColumns.map((column, index) => (
                <Draggable key={column.id} draggableId={column.id} index={index}>
                  {(dragProvided, snapshot) => (
                    <th
                      ref={dragProvided.innerRef}
                      {...dragProvided.draggableProps}
                      {...dragProvided.dragHandleProps}
                      className={cn(
                        'whitespace-nowrap align-middle cursor-grab active:cursor-grabbing',
                        snapshot.isDragging && 'bg-secondary/90 shadow-lg',
                        cellClassName,
                        column.headerClassName
                      )}
                    >
                      {renderCell
                        ? renderCell(column, null, snapshot)
                        : <span>{column.label}</span>}
                    </th>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </tr>
          </thead>
        )}
      </Droppable>
    </DragDropContext>
  );
}
