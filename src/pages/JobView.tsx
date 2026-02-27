import { useState, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useOrders } from '@/hooks/useOrders';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { CaseItem } from '@/types/rental';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import DraggableItem from '@/components/DraggableItem';
import DroppableCase from '@/components/DroppableCase';
import {
  ArrowLeft, Save, Loader2, Package, GripVertical,
  CheckSquare, MousePointerClick, Calendar, MapPin,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useDroppable } from '@dnd-kit/core';

const UNASSIGNED_ID = '__unassigned__';

const JobView = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { orders } = useOrders();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<'drag' | 'checkbox'>('drag');
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const order = orders.find((o) => o.id === orderId);

  // Build item map: id -> CaseItem
  const itemsById = useMemo(() => {
    const map = new Map<string, CaseItem>();
    if (!order) return map;
    order.items.forEach((item, i) => {
      map.set(`item-${i}`, item);
    });
    return map;
  }, [order]);

  // Determine which items are cases vs content
  const { caseIds, contentIds } = useMemo(() => {
    if (!order) return { caseIds: [] as string[], contentIds: [] as string[] };
    const cases: string[] = [];
    const content: string[] = [];
    order.items.forEach((item, i) => {
      const id = `item-${i}`;
      if (item.productCategory?.toLowerCase() === 'case') {
        cases.push(id);
      } else {
        content.push(id);
      }
    });
    return { caseIds: cases, contentIds: content };
  }, [order]);

  // Track which items user has manually elected as cases
  const [electedCaseIds, setElectedCaseIds] = useState<Set<string>>(new Set());

  const allCaseIds = useMemo(
    () => [...caseIds, ...Array.from(electedCaseIds)],
    [caseIds, electedCaseIds]
  );

  const allContentIds = useMemo(
    () => contentIds.filter((id) => !electedCaseIds.has(id)),
    [contentIds, electedCaseIds]
  );

  // Assignments: caseId -> itemId[]
  const [assignments, setAssignments] = useState<Record<string, string[]>>({});

  // Compute unassigned items
  const assignedSet = useMemo(() => {
    const set = new Set<string>();
    Object.values(assignments).forEach((ids) => ids.forEach((id) => set.add(id)));
    return set;
  }, [assignments]);

  const unassignedIds = useMemo(
    () => allContentIds.filter((id) => !assignedSet.has(id)),
    [allContentIds, assignedSet]
  );

  // Checkbox mode state
  const [activeCaseForCheckbox, setActiveCaseForCheckbox] = useState<string | null>(null);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  // Find which container an item is in
  const findContainer = useCallback(
    (itemId: string): string => {
      for (const [caseId, items] of Object.entries(assignments)) {
        if (items.includes(itemId)) return caseId;
      }
      return UNASSIGNED_ID;
    },
    [assignments]
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Don't allow dragging cases
    if (allCaseIds.includes(activeId)) return;

    const activeContainer = findContainer(activeId);
    let overContainer: string;

    // Determine target container
    if (allCaseIds.includes(overId) || overId === UNASSIGNED_ID) {
      overContainer = overId;
    } else {
      overContainer = findContainer(overId);
    }

    if (activeContainer === overContainer) return;

    setAssignments((prev) => {
      const next = { ...prev };

      // Remove from source
      if (activeContainer !== UNASSIGNED_ID) {
        next[activeContainer] = (next[activeContainer] || []).filter((id) => id !== activeId);
      }

      // Add to target
      if (overContainer !== UNASSIGNED_ID) {
        const targetItems = [...(next[overContainer] || [])];
        if (!targetItems.includes(activeId)) {
          targetItems.push(activeId);
        }
        next[overContainer] = targetItems;
      }

      return next;
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null);
  };

  const toggleCheckboxAssign = (itemId: string) => {
    if (!activeCaseForCheckbox) return;
    setAssignments((prev) => {
      const next = { ...prev };
      // Remove from any existing case
      for (const key of Object.keys(next)) {
        next[key] = next[key].filter((id) => id !== itemId);
      }
      // Add to active case if not already there
      const current = next[activeCaseForCheckbox] || [];
      if (!current.includes(itemId)) {
        next[activeCaseForCheckbox] = [...current, itemId];
      }
      return next;
    });
  };

  const toggleElectCase = (id: string) => {
    setElectedCaseIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setAssignments((a) => {
          const n = { ...a };
          delete n[id];
          return n;
        });
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const saveAssignments = async () => {
    if (!user || !order) return;
    setSaving(true);
    try {
      await supabase.from('case_assignments').delete().eq('user_id', user.id).eq('order_id', order.id);

      const inserts = allCaseIds.map((caseId) => {
        const caseItem = itemsById.get(caseId);
        const itemIds = assignments[caseId] || [];
        return {
          user_id: user.id,
          order_id: order.id,
          case_item_name: caseItem?.name || 'Unknown',
          assigned_items: JSON.stringify(
            itemIds.map((id) => {
              const item = itemsById.get(id);
              return { name: item?.name, quantity: item?.quantity, id };
            })
          ),
        };
      });

      if (inserts.length > 0) {
        const { error } = await supabase.from('case_assignments').insert(inserts);
        if (error) throw error;
      }

      toast({ title: 'Saved', description: 'Case assignments saved successfully.' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Order not found</p>
          <Button variant="outline" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
        </div>
      </div>
    );
  }

  const activeItem = activeDragId ? itemsById.get(activeDragId) : null;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border bg-card/60 backdrop-blur-sm sticky top-0 z-20">
        <div className="container max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-lg font-bold text-foreground tracking-tight">{order.jobName}</h1>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>{order.customerName}</span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(order.jobDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {order.venue.split(',')[0]}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Mode toggle */}
            <div className="flex border border-border rounded-md overflow-hidden">
              <button
                onClick={() => setMode('drag')}
                className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors ${
                  mode === 'drag' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <GripVertical className="h-3.5 w-3.5" />
                Drag
              </button>
              <button
                onClick={() => setMode('checkbox')}
                className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors ${
                  mode === 'checkbox' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <CheckSquare className="h-3.5 w-3.5" />
                Checkbox
              </button>
            </div>
            <Button onClick={saveAssignments} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save
            </Button>
          </div>
        </div>
      </header>

      <div className="container max-w-6xl mx-auto px-4 py-6">
        {/* Elect cases section */}
        {allContentIds.length > 0 && contentIds.some((id) => !caseIds.includes(id)) && (
          <div className="mb-6 bg-card border border-border rounded-lg p-4">
            <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
              <Package className="h-4 w-4 text-accent" />
              Designate Additional Cases
            </h3>
            <p className="text-xs text-muted-foreground mb-3">
              Check any items that should be treated as cases/containers.
            </p>
            <div className="flex flex-wrap gap-2">
              {contentIds.map((id) => {
                const item = itemsById.get(id);
                if (!item) return null;
                const elected = electedCaseIds.has(id);
                return (
                  <button
                    key={id}
                    onClick={() => toggleElectCase(id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-md border text-sm transition-all ${
                      elected
                        ? 'border-accent bg-accent/10 text-accent'
                        : 'border-border bg-card text-foreground hover:border-accent/50'
                    }`}
                  >
                    <Checkbox checked={elected} className="pointer-events-none" />
                    <span className="truncate max-w-[200px]">{item.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {mode === 'drag' ? (
          /* ─── Drag & Drop Mode ─── */
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Unassigned items */}
              <div className="lg:col-span-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Unassigned ({unassignedIds.length})
                </h3>
                <UnassignedDropZone>
                  <SortableContext items={unassignedIds} strategy={verticalListSortingStrategy}>
                    <div className="space-y-1.5 min-h-[100px]">
                      {unassignedIds.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-8">
                          All items assigned ✓
                        </p>
                      ) : (
                        unassignedIds.map((id) => {
                          const item = itemsById.get(id);
                          if (!item) return null;
                          return <DraggableItem key={id} id={id} item={item} />;
                        })
                      )}
                    </div>
                  </SortableContext>
                </UnassignedDropZone>
              </div>

              {/* Cases */}
              <div className="lg:col-span-8 space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Cases ({allCaseIds.length})
                </h3>
                {allCaseIds.length === 0 ? (
                  <div className="border border-dashed border-border rounded-lg p-8 text-center">
                    <p className="text-sm text-muted-foreground">
                      No cases found. Designate items as cases above.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {allCaseIds.map((caseId) => {
                      const caseItem = itemsById.get(caseId);
                      if (!caseItem) return null;
                      return (
                        <DroppableCase
                          key={caseId}
                          caseId={caseId}
                          caseItem={caseItem}
                          assignedItemIds={assignments[caseId] || []}
                          allItems={itemsById}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <DragOverlay>
              {activeDragId && activeItem ? (
                <DraggableItem id={activeDragId} item={activeItem} isOverlay />
              ) : null}
            </DragOverlay>
          </DndContext>
        ) : (
          /* ─── Checkbox Mode ─── */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Case selector */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Select a Case
              </h3>
              <div className="space-y-2">
                {allCaseIds.map((caseId) => {
                  const caseItem = itemsById.get(caseId);
                  if (!caseItem) return null;
                  const count = (assignments[caseId] || []).length;
                  const isActive = activeCaseForCheckbox === caseId;
                  return (
                    <button
                      key={caseId}
                      onClick={() => setActiveCaseForCheckbox(caseId)}
                      className={`w-full flex items-center justify-between p-4 rounded-lg border transition-all text-left ${
                        isActive
                          ? 'border-accent bg-accent/10'
                          : 'border-border bg-card hover:border-accent/50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Package className={`h-4 w-4 ${isActive ? 'text-accent' : 'text-muted-foreground'}`} />
                        <div>
                          <p className="font-semibold text-sm text-foreground">{caseItem.name}</p>
                          {caseItem.serialNumber && (
                            <p className="text-xs text-muted-foreground font-mono">{caseItem.serialNumber}</p>
                          )}
                        </div>
                      </div>
                      <Badge variant={isActive ? 'default' : 'secondary'} className="font-mono">
                        {count} items
                      </Badge>
                    </button>
                  );
                })}
                {allCaseIds.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No cases. Designate items as cases above.
                  </p>
                )}
              </div>
            </div>

            {/* Assign items */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                {activeCaseForCheckbox
                  ? `Assign to: ${itemsById.get(activeCaseForCheckbox)?.name}`
                  : 'Select a case first'}
              </h3>
              <div className="space-y-1.5">
                {allContentIds.map((id) => {
                  const item = itemsById.get(id);
                  if (!item) return null;
                  const currentCase = Object.entries(assignments).find(([, ids]) => ids.includes(id));
                  const isAssignedHere = currentCase?.[0] === activeCaseForCheckbox;
                  const isAssignedElsewhere = currentCase && currentCase[0] !== activeCaseForCheckbox;
                  return (
                    <div
                      key={id}
                      className={`flex items-center gap-3 p-3 rounded-md border transition-colors ${
                        isAssignedHere
                          ? 'border-accent bg-accent/5'
                          : isAssignedElsewhere
                          ? 'border-muted opacity-50'
                          : 'border-border'
                      }`}
                    >
                      <Checkbox
                        checked={isAssignedHere}
                        disabled={!activeCaseForCheckbox || !!isAssignedElsewhere}
                        onCheckedChange={() => toggleCheckboxAssign(id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground truncate">{item.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">
                          ×{item.quantity}
                          {item.serialNumber && ` · ${item.serialNumber}`}
                        </p>
                      </div>
                      {isAssignedElsewhere && (
                        <Badge variant="outline" className="text-xs shrink-0">
                          In: {itemsById.get(currentCase[0])?.name}
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/** Droppable zone for unassigned items */
const UnassignedDropZone = ({ children }: { children: React.ReactNode }) => {
  const { setNodeRef, isOver } = useDroppable({ id: UNASSIGNED_ID });
  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg border-2 border-dashed p-3 transition-colors ${
        isOver ? 'border-accent bg-accent/5' : 'border-border'
      }`}
    >
      {children}
    </div>
  );
};

export default JobView;
