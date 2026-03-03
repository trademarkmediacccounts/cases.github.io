import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  DndContext, DragOverlay, closestCenter,
  PointerSensor, TouchSensor, useSensor, useSensors,
  DragStartEvent, DragEndEvent, DragOverEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { useOrders } from '@/hooks/useOrders';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { CaseItem, ResolvedCase, LabelSettings, defaultLabelSettings } from '@/types/rental';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import DraggableItem from '@/components/DraggableItem';
import DroppableCase from '@/components/DroppableCase';
import CaseLabel from '@/components/CaseLabel';
import LabelSettingsPanel from '@/components/LabelSettingsPanel';
import BrandingPresetsPanel from '@/components/BrandingPresetsPanel';
import ThermalPrintButton from '@/components/ThermalPrintButton';
import {
  ArrowLeft, Save, Loader2, Package, GripVertical,
  CheckSquare, Calendar, MapPin, Printer, Tag,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const UNASSIGNED_ID = '__unassigned__';

const JobView = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { orders, loading: ordersLoading } = useOrders();
  const { toast } = useToast();
  const printRef = useRef<HTMLDivElement>(null);

  const [saving, setSaving] = useState(false);
  const [loadingAssignments, setLoadingAssignments] = useState(true);
  const [assignMode, setAssignMode] = useState<'drag' | 'checkbox'>('drag');
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('assign');

  // Label settings
  const [settings, setSettings] = useState<LabelSettings>(defaultLabelSettings);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  const order = orders.find((o) => o.id === orderId);

  // Build item map: id -> CaseItem
  const itemsById = useMemo(() => {
    const map = new Map<string, CaseItem>();
    if (!order) return map;
    order.items.forEach((item, i) => map.set(`item-${i}`, item));
    return map;
  }, [order]);

  // Categorise items
  const { caseIds, contentIds } = useMemo(() => {
    if (!order) return { caseIds: [] as string[], contentIds: [] as string[] };
    const cases: string[] = [];
    const content: string[] = [];
    order.items.forEach((item, i) => {
      const id = `item-${i}`;
      if (item.productCategory?.toLowerCase() === 'case') cases.push(id);
      else content.push(id);
    });
    return { caseIds: cases, contentIds: content };
  }, [order]);

  const [electedCaseIds, setElectedCaseIds] = useState<Set<string>>(new Set());
  const allCaseIds = useMemo(() => [...caseIds, ...Array.from(electedCaseIds)], [caseIds, electedCaseIds]);
  const allContentIds = useMemo(() => contentIds.filter((id) => !electedCaseIds.has(id)), [contentIds, electedCaseIds]);

  // Assignments: caseId -> itemId[]
  const [assignments, setAssignments] = useState<Record<string, string[]>>({});

  // Load saved assignments
  useEffect(() => {
    if (!user || !order) { setLoadingAssignments(false); return; }
    const load = async () => {
      setLoadingAssignments(true);
      try {
        const { data } = await supabase
          .from('case_assignments').select('*')
          .eq('user_id', user.id).eq('order_id', order.id);
        if (data && data.length > 0) {
          const loaded: Record<string, string[]> = {};
          const electedSet = new Set<string>();
          data.forEach((row: any) => {
            const caseId = Array.from(itemsById.entries()).find(([, item]) => item.name === row.case_item_name)?.[0];
            if (!caseId) return;
            if (!caseIds.includes(caseId)) electedSet.add(caseId);
            const items: { id: string }[] = typeof row.assigned_items === 'string' ? JSON.parse(row.assigned_items) : row.assigned_items;
            loaded[caseId] = items.map((a: any) => a.id).filter((id: string) => itemsById.has(id));
          });
          setElectedCaseIds(electedSet);
          setAssignments(loaded);
        }
      } catch { /* silently fail */ }
      finally { setLoadingAssignments(false); }
    };
    load();
  }, [user, order?.id, itemsById.size]); // eslint-disable-line react-hooks/exhaustive-deps

  const assignedSet = useMemo(() => {
    const set = new Set<string>();
    Object.values(assignments).forEach((ids) => ids.forEach((id) => set.add(id)));
    return set;
  }, [assignments]);

  const unassignedIds = useMemo(() => allContentIds.filter((id) => !assignedSet.has(id)), [allContentIds, assignedSet]);

  // Build resolved cases from manual assignments only
  const resolvedCases: ResolvedCase[] = useMemo(() => {
    if (!order) return [];
    return allCaseIds
      .filter((caseId) => (assignments[caseId] || []).length > 0)
      .map((caseId) => {
        const caseItem = itemsById.get(caseId)!;
        const contentItemIds = assignments[caseId] || [];
        const contents = contentItemIds.map((id) => itemsById.get(id)!).filter(Boolean);
        const contentsWeight = contents.reduce((s, item) => s + (item.weight ?? 0) * item.quantity, 0);
        const totalWeight = contentsWeight + (caseItem.weight ?? 0);
        return {
          orderId: order.id,
          orderRef: order.orderRef,
          customerName: order.customerName,
          jobName: order.jobName,
          jobDate: order.jobDate,
          returnDate: order.returnDate,
          venue: order.venue,
          status: order.status,
          caseItem,
          caseAssetCode: caseItem.serialNumber ?? order.caseAssetCode,
          contents,
          totalWeight: Math.round(totalWeight * 100) / 100,
          notes: order.notes,
        };
      });
  }, [order, allCaseIds, assignments, itemsById]);

  // Checkbox mode
  const [activeCaseForCheckbox, setActiveCaseForCheckbox] = useState<string | null>(null);

  // DnD
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  const findContainer = useCallback((itemId: string): string => {
    for (const [caseId, items] of Object.entries(assignments)) {
      if (items.includes(itemId)) return caseId;
    }
    return UNASSIGNED_ID;
  }, [assignments]);

  const handleDragStart = (e: DragStartEvent) => setActiveDragId(e.active.id as string);

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;
    const activeId = active.id as string;
    const overId = over.id as string;
    if (allCaseIds.includes(activeId)) return;
    const activeContainer = findContainer(activeId);
    let overContainer: string;
    if (allCaseIds.includes(overId) || overId === UNASSIGNED_ID) overContainer = overId;
    else overContainer = findContainer(overId);
    if (activeContainer === overContainer) return;
    setAssignments((prev) => {
      const next = { ...prev };
      if (activeContainer !== UNASSIGNED_ID) next[activeContainer] = (next[activeContainer] || []).filter((id) => id !== activeId);
      if (overContainer !== UNASSIGNED_ID) {
        const t = [...(next[overContainer] || [])];
        if (!t.includes(activeId)) t.push(activeId);
        next[overContainer] = t;
      }
      return next;
    });
  };

  const handleDragEnd = () => setActiveDragId(null);

  const toggleCheckboxAssign = (itemId: string) => {
    if (!activeCaseForCheckbox) return;
    setAssignments((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next)) next[key] = next[key].filter((id) => id !== itemId);
      const current = next[activeCaseForCheckbox] || [];
      if (!current.includes(itemId)) next[activeCaseForCheckbox] = [...current, itemId];
      return next;
    });
  };

  const toggleElectCase = (id: string) => {
    setElectedCaseIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); setAssignments((a) => { const n = { ...a }; delete n[id]; return n; }); }
      else next.add(id);
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
          assigned_items: JSON.stringify(itemIds.map((id) => {
            const item = itemsById.get(id);
            return { name: item?.name, quantity: item?.quantity, id };
          })),
        };
      });
      if (inserts.length > 0) {
        const { error } = await supabase.from('case_assignments').insert(inserts);
        if (error) throw error;
      }
      toast({ title: 'Saved', description: 'Case assignments saved.' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const handlePrint = () => window.print();

  const handleLoadPreset = (presetSettings: LabelSettings, presetLogoUrl: string | null) => {
    setSettings(presetSettings);
    setLogoUrl(presetLogoUrl);
  };

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          {ordersLoading ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto" />
              <p className="text-muted-foreground text-sm">Loading order…</p>
            </>
          ) : (
            <>
              <p className="text-muted-foreground">Order not found</p>
              <Button variant="outline" onClick={() => navigate('/')}><ArrowLeft className="h-4 w-4 mr-2" /> Back</Button>
            </>
          )}
        </div>
      </div>
    );
  }

  const activeItem = activeDragId ? itemsById.get(activeDragId) : null;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="no-print border-b border-border bg-card/60 backdrop-blur-sm sticky top-0 z-20">
        <div className="container max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-lg font-bold text-foreground tracking-tight">{order.jobName}</h1>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>{order.customerName}</span>
                <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />
                  {new Date(order.jobDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
                {order.venue && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{order.venue.split(',')[0]}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={saveAssignments} disabled={saving} variant="outline" className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save
            </Button>
            <ThermalPrintButton cases={resolvedCases} settings={settings} />
            <Button onClick={handlePrint} disabled={resolvedCases.length === 0} className="gap-2">
              <Printer className="h-4 w-4" />
              Print {resolvedCases.length > 0 && `(${resolvedCases.length})`}
            </Button>
          </div>
        </div>
      </header>

      <div className="container max-w-7xl mx-auto px-4 py-6 no-print">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="assign" className="gap-1.5"><Package className="h-3.5 w-3.5" /> Assign Items</TabsTrigger>
            <TabsTrigger value="labels" className="gap-1.5"><Tag className="h-3.5 w-3.5" /> Labels ({resolvedCases.length})</TabsTrigger>
          </TabsList>

          {/* ─── Assign Tab ─── */}
          <TabsContent value="assign">
            {loadingAssignments ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-3 text-sm text-muted-foreground">Loading…</span>
              </div>
            ) : (
              <>
                {/* Elect cases */}
                {contentIds.length > 0 && (
                  <div className="mb-6 bg-card border border-border rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                      <Package className="h-4 w-4 text-accent" /> Designate Additional Cases
                    </h3>
                    <p className="text-xs text-muted-foreground mb-3">Check items that should be treated as cases/containers.</p>
                    <div className="flex flex-wrap gap-2">
                      {contentIds.map((id) => {
                        const item = itemsById.get(id);
                        if (!item) return null;
                        const elected = electedCaseIds.has(id);
                        return (
                          <button key={id} onClick={() => toggleElectCase(id)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-md border text-sm transition-all ${
                              elected ? 'border-accent bg-accent/10 text-accent' : 'border-border bg-card text-foreground hover:border-accent/50'
                            }`}>
                            <Checkbox checked={elected} className="pointer-events-none" />
                            <span className="truncate max-w-[200px]">{item.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Mode toggle */}
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex border border-border rounded-md overflow-hidden">
                    <button onClick={() => setAssignMode('drag')}
                      className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors ${
                        assignMode === 'drag' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground'
                      }`}><GripVertical className="h-3.5 w-3.5" /> Drag</button>
                    <button onClick={() => setAssignMode('checkbox')}
                      className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors ${
                        assignMode === 'checkbox' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground'
                      }`}><CheckSquare className="h-3.5 w-3.5" /> Checkbox</button>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {unassignedIds.length} unassigned · {assignedSet.size} assigned
                  </span>
                </div>

                {assignMode === 'drag' ? (
                  <DndContext sensors={sensors} collisionDetection={closestCenter}
                    onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                      <div className="lg:col-span-4">
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Unassigned ({unassignedIds.length})</h3>
                        <UnassignedDropZone>
                          <SortableContext items={unassignedIds} strategy={verticalListSortingStrategy}>
                            <div className="space-y-1.5 min-h-[100px]">
                              {unassignedIds.length === 0 ? (
                                <p className="text-xs text-muted-foreground text-center py-8">All items assigned ✓</p>
                              ) : unassignedIds.map((id) => {
                                const item = itemsById.get(id);
                                return item ? <DraggableItem key={id} id={id} item={item} /> : null;
                              })}
                            </div>
                          </SortableContext>
                        </UnassignedDropZone>
                      </div>
                      <div className="lg:col-span-8 space-y-4">
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Cases ({allCaseIds.length})</h3>
                        {allCaseIds.length === 0 ? (
                          <div className="border border-dashed border-border rounded-lg p-8 text-center">
                            <p className="text-sm text-muted-foreground">No cases found. Designate items as cases above.</p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {allCaseIds.map((caseId) => {
                              const caseItem = itemsById.get(caseId);
                              return caseItem ? (
                                <DroppableCase key={caseId} caseId={caseId} caseItem={caseItem}
                                  assignedItemIds={assignments[caseId] || []} allItems={itemsById} />
                              ) : null;
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                    <DragOverlay>
                      {activeDragId && activeItem ? <DraggableItem id={activeDragId} item={activeItem} isOverlay /> : null}
                    </DragOverlay>
                  </DndContext>
                ) : (
                  <CheckboxMode allCaseIds={allCaseIds} allContentIds={allContentIds} assignments={assignments}
                    itemsById={itemsById} activeCaseForCheckbox={activeCaseForCheckbox}
                    setActiveCaseForCheckbox={setActiveCaseForCheckbox} toggleCheckboxAssign={toggleCheckboxAssign} />
                )}
              </>
            )}
          </TabsContent>

          {/* ─── Labels Tab ─── */}
          <TabsContent value="labels">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-8">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Label Preview — {resolvedCases.length} label{resolvedCases.length !== 1 ? 's' : ''}
                </h2>
                {resolvedCases.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 border border-dashed border-border rounded-lg">
                    <p className="text-muted-foreground text-sm mb-2">No labels yet</p>
                    <p className="text-xs text-muted-foreground">Assign items to cases in the Assign tab first.</p>
                  </div>
                ) : (
                  <div className="space-y-6 flex flex-col items-center">
                    {resolvedCases.map((rc, i) => (
                      <div key={`${rc.caseAssetCode}-${i}`} className="animate-fade-in">
                        <CaseLabel resolvedCase={rc} settings={settings}
                          caseIndex={i} totalCases={resolvedCases.length} logoUrl={logoUrl} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="lg:col-span-4 space-y-4">
                <LabelSettingsPanel settings={settings} onChange={setSettings} />
                <BrandingPresetsPanel settings={settings} onLoadPreset={handleLoadPreset} />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Print area */}
      <div ref={printRef} className="print-area hidden print:block">
        <div className="space-y-8">
          {resolvedCases.map((rc, i) => (
            <div key={`${rc.caseAssetCode}-${i}-print`} className="page-break-after">
              <CaseLabel resolvedCase={rc} settings={settings} logoUrl={logoUrl} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ─── Sub-components ─── */

const UnassignedDropZone = ({ children }: { children: React.ReactNode }) => {
  const { setNodeRef, isOver } = useDroppable({ id: UNASSIGNED_ID });
  return (
    <div ref={setNodeRef}
      className={`rounded-lg border-2 border-dashed p-3 transition-colors ${isOver ? 'border-accent bg-accent/5' : 'border-border'}`}>
      {children}
    </div>
  );
};

interface CheckboxModeProps {
  allCaseIds: string[];
  allContentIds: string[];
  assignments: Record<string, string[]>;
  itemsById: Map<string, CaseItem>;
  activeCaseForCheckbox: string | null;
  setActiveCaseForCheckbox: (id: string) => void;
  toggleCheckboxAssign: (itemId: string) => void;
}

const CheckboxMode = ({ allCaseIds, allContentIds, assignments, itemsById,
  activeCaseForCheckbox, setActiveCaseForCheckbox, toggleCheckboxAssign }: CheckboxModeProps) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
    <div>
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Select a Case</h3>
      <div className="space-y-2">
        {allCaseIds.map((caseId) => {
          const caseItem = itemsById.get(caseId);
          if (!caseItem) return null;
          const count = (assignments[caseId] || []).length;
          const isActive = activeCaseForCheckbox === caseId;
          return (
            <button key={caseId} onClick={() => setActiveCaseForCheckbox(caseId)}
              className={`w-full flex items-center justify-between p-4 rounded-lg border transition-all text-left ${
                isActive ? 'border-accent bg-accent/10' : 'border-border bg-card hover:border-accent/50'
              }`}>
              <div className="flex items-center gap-2">
                <Package className={`h-4 w-4 ${isActive ? 'text-accent' : 'text-muted-foreground'}`} />
                <div>
                  <p className="font-semibold text-sm text-foreground">{caseItem.name}</p>
                  {caseItem.serialNumber && <p className="text-xs text-muted-foreground font-mono">{caseItem.serialNumber}</p>}
                </div>
              </div>
              <Badge variant={isActive ? 'default' : 'secondary'} className="font-mono">{count} items</Badge>
            </button>
          );
        })}
        {allCaseIds.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No cases.</p>}
      </div>
    </div>
    <div>
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
        {activeCaseForCheckbox ? `Assign to: ${itemsById.get(activeCaseForCheckbox)?.name}` : 'Select a case first'}
      </h3>
      <div className="space-y-1.5">
        {allContentIds.map((id) => {
          const item = itemsById.get(id);
          if (!item) return null;
          const currentCase = Object.entries(assignments).find(([, ids]) => ids.includes(id));
          const isAssignedHere = currentCase?.[0] === activeCaseForCheckbox;
          const isAssignedElsewhere = currentCase && currentCase[0] !== activeCaseForCheckbox;
          return (
            <div key={id} className={`flex items-center gap-3 p-3 rounded-md border transition-colors ${
              isAssignedHere ? 'border-accent bg-accent/5' : isAssignedElsewhere ? 'border-muted opacity-50' : 'border-border'
            }`}>
              <Checkbox checked={isAssignedHere} disabled={!activeCaseForCheckbox || !!isAssignedElsewhere}
                onCheckedChange={() => toggleCheckboxAssign(id)} />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground truncate">{item.name}</p>
                <p className="text-xs text-muted-foreground font-mono">×{item.quantity}{item.serialNumber && ` · ${item.serialNumber}`}</p>
              </div>
              {isAssignedElsewhere && (
                <Badge variant="outline" className="text-xs shrink-0">In: {itemsById.get(currentCase[0])?.name}</Badge>
              )}
            </div>
          );
        })}
      </div>
    </div>
  </div>
);

export default JobView;
