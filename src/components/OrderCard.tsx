import { RentalOrder } from '@/types/rental';
import { Package, Calendar, MapPin, ChevronRight } from 'lucide-react';

interface OrderCardProps {
  order: RentalOrder;
  selected: boolean;
  onSelect: (id: string) => void;
}

const statusStyles = {
  confirmed: 'bg-badge-success/15 text-badge-success',
  in_progress: 'bg-badge-warning/15 text-badge-warning',
  returned: 'bg-muted text-muted-foreground',
};

const statusLabels = {
  confirmed: 'Confirmed',
  in_progress: 'In Progress',
  returned: 'Returned',
};

const OrderCard = ({ order, selected, onSelect }: OrderCardProps) => {
  const caseItems = order.items.filter((i) => i.productCategory?.toLowerCase() === 'case');
  const caseCount = caseItems.length;
  const caseName = caseItems[0]?.name ?? 'No case';

  return (
    <button
      onClick={() => onSelect(order.id)}
      className={`w-full text-left p-4 rounded-lg border transition-all duration-200 ${
        selected
          ? 'border-accent bg-accent/5 shadow-sm'
          : 'border-border bg-card hover:border-accent/50'
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-accent" />
          <span className="font-mono font-bold text-sm text-foreground">
            {caseCount} case{caseCount !== 1 ? 's' : ''}
          </span>
        </div>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusStyles[order.status]}`}>
          {statusLabels[order.status]}
        </span>
      </div>

      <h4 className="font-semibold text-foreground text-sm">{caseName}</h4>
      <p className="text-xs text-muted-foreground mt-0.5">{order.jobName}</p>

      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {new Date(order.jobDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
        </span>
        <span className="flex items-center gap-1">
          <MapPin className="h-3 w-3" />
          {order.venue.split(',')[0]}
        </span>
      </div>

      <div className="flex items-center justify-between mt-2">
        <span className="font-mono text-xs text-muted-foreground">{order.orderRef}</span>
        <ChevronRight className={`h-4 w-4 transition-colors ${selected ? 'text-accent' : 'text-muted-foreground'}`} />
      </div>
    </button>
  );
};

export default OrderCard;
