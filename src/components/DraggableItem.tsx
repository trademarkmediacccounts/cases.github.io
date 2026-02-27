import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CaseItem } from '@/types/rental';
import { GripVertical } from 'lucide-react';

interface DraggableItemProps {
  id: string;
  item: CaseItem;
  isOverlay?: boolean;
}

const DraggableItem = ({ id, item, isOverlay }: DraggableItemProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-card text-sm
        ${isOverlay ? 'shadow-xl border-accent ring-2 ring-accent/30' : ''}
        ${isDragging ? 'z-50' : ''}
      `}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground truncate">{item.name}</p>
        <p className="text-xs text-muted-foreground font-mono">
          ×{item.quantity}
          {item.serialNumber && ` · ${item.serialNumber}`}
          {item.weight ? ` · ${(item.weight * item.quantity).toFixed(1)}kg` : ''}
        </p>
      </div>
    </div>
  );
};

export default DraggableItem;
