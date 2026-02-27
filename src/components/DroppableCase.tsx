import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CaseItem } from '@/types/rental';
import DraggableItem from './DraggableItem';
import { Package, Weight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface DroppableCaseProps {
  caseId: string;
  caseItem: CaseItem;
  assignedItemIds: string[];
  allItems: Map<string, CaseItem>;
  isActive?: boolean;
}

const DroppableCase = ({ caseId, caseItem, assignedItemIds, allItems, isActive }: DroppableCaseProps) => {
  const { setNodeRef, isOver } = useDroppable({ id: caseId });

  const totalWeight = assignedItemIds.reduce((sum, id) => {
    const item = allItems.get(id);
    if (!item) return sum;
    return sum + (item.weight ?? 0) * item.quantity;
  }, (caseItem.weight ?? 0));

  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg border-2 transition-all duration-200 ${
        isOver
          ? 'border-accent bg-accent/10 shadow-lg'
          : isActive
          ? 'border-accent/50 bg-card'
          : 'border-border bg-card'
      }`}
    >
      {/* Case header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-accent" />
          <div>
            <p className="font-semibold text-foreground text-sm">{caseItem.name}</p>
            {caseItem.serialNumber && (
              <p className="text-xs text-muted-foreground font-mono">{caseItem.serialNumber}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="font-mono text-xs gap-1">
            <Weight className="h-3 w-3" />
            {totalWeight.toFixed(1)}kg
          </Badge>
          <Badge variant="outline" className="font-mono text-xs">
            {assignedItemIds.length} items
          </Badge>
        </div>
      </div>

      {/* Droppable area */}
      <SortableContext items={assignedItemIds} strategy={verticalListSortingStrategy}>
        <div className="p-3 space-y-1.5 min-h-[60px]">
          {assignedItemIds.length === 0 ? (
            <div className={`text-center py-4 text-xs rounded-md border border-dashed transition-colors ${
              isOver ? 'border-accent text-accent' : 'border-border text-muted-foreground'
            }`}>
              {isOver ? 'Drop here' : 'Drag items here'}
            </div>
          ) : (
            assignedItemIds.map((id) => {
              const item = allItems.get(id);
              if (!item) return null;
              return <DraggableItem key={id} id={id} item={item} />;
            })
          )}
        </div>
      </SortableContext>
    </div>
  );
};

export default DroppableCase;
