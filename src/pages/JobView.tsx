import { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useOrders } from '@/hooks/useOrders';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { CaseItem } from '@/types/rental';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Package, Save, Loader2, Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const JobView = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { orders } = useOrders();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const order = orders.find((o) => o.id === orderId);

  // Track which items the user has elected as cases
  const [electedCases, setElectedCases] = useState<Set<number>>(new Set());
  // Track manual assignments: caseIndex -> Set<itemIndex>
  const [assignments, setAssignments] = useState<Map<number, Set<number>>>(new Map());
  // Which case is currently selected for assigning items
  const [activeCaseIdx, setActiveCaseIdx] = useState<number | null>(null);

  // Determine cases: auto-detected + user-elected
  const caseIndices = useMemo(() => {
    if (!order) return new Set<number>();
    const auto = new Set<number>();
    order.items.forEach((item, i) => {
      if (item.productCategory?.toLowerCase() === 'case') auto.add(i);
    });
    electedCases.forEach((i) => auto.add(i));
    return auto;
  }, [order, electedCases]);

  const contentIndices = useMemo(() => {
    if (!order) return [] as number[];
    return order.items.map((_, i) => i).filter((i) => !caseIndices.has(i));
  }, [order, caseIndices]);

  if (!order) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Order not found</p>
          <Button variant="outline" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
        </div>
      </div>
    );
  }

  const toggleElectCase = (idx: number) => {
    setElectedCases((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
        // Remove any assignments to this case
        setAssignments((a) => { const n = new Map(a); n.delete(idx); return n; });
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  const toggleAssignment = (itemIdx: number) => {
    if (activeCaseIdx === null) return;
    setAssignments((prev) => {
      const next = new Map(prev);
      const current = new Set(next.get(activeCaseIdx) || []);
      if (current.has(itemIdx)) current.delete(itemIdx);
      else current.add(itemIdx);
      next.set(activeCaseIdx, current);
      return next;
    });
  };

  const getAssignedCaseForItem = (itemIdx: number): number | null => {
    for (const [caseIdx, items] of assignments) {
      if (items.has(itemIdx)) return caseIdx;
    }
    return null;
  };

  const saveAssignments = async () => {
    if (!user) return;
    setSaving(true);
    try {
      // Delete existing assignments for this order
      await supabase.from('case_assignments').delete().eq('user_id', user.id).eq('order_id', order.id);

      // Insert new assignments
      const inserts = Array.from(caseIndices).map((caseIdx) => ({
        user_id: user.id,
        order_id: order.id,
        case_item_name: order.items[caseIdx].name,
        assigned_items: JSON.stringify(
          Array.from(assignments.get(caseIdx) || []).map((i) => ({
            name: order.items[i].name,
            quantity: order.items[i].quantity,
            index: i,
          }))
        ),
      }));

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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="container max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-lg font-bold text-foreground tracking-tight">{order.jobName}</h1>
              <p className="text-xs text-muted-foreground">{order.customerName} · {order.orderRef}</p>
            </div>
          </div>
          <Button onClick={saveAssignments} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Assignments
          </Button>
        </div>
      </header>

      <div className="container max-w-5xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* All Items - Elect as Case */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4" />
                All Items — Elect Cases
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Check items that are cases/containers. Items auto-detected as cases are pre-checked.
              </p>
            </CardHeader>
            <CardContent className="space-y-2">
              {order.items.map((item, idx) => {
                const isAutoCase = item.productCategory?.toLowerCase() === 'case';
                const isCase = caseIndices.has(idx);
                return (
                  <div
                    key={idx}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                      isCase ? 'border-primary bg-primary/5' : 'border-border'
                    }`}
                  >
                    <Checkbox
                      checked={isCase}
                      disabled={isAutoCase}
                      onCheckedChange={() => toggleElectCase(idx)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Qty: {item.quantity}
                        {item.serialNumber && ` · ${item.serialNumber}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge variant={isAutoCase ? 'default' : isCase ? 'secondary' : 'outline'} className="text-xs">
                        {isAutoCase ? 'Auto Case' : isCase ? 'Manual Case' : item.productCategory || 'general'}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Case Assignment */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Assign Items to Cases</CardTitle>
              <p className="text-xs text-muted-foreground">
                Select a case, then check items to assign to it.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Case tabs */}
              {Array.from(caseIndices).length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No cases detected or elected. Check items on the left to mark them as cases.
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    {Array.from(caseIndices).map((caseIdx) => (
                      <Button
                        key={caseIdx}
                        variant={activeCaseIdx === caseIdx ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setActiveCaseIdx(caseIdx)}
                        className="gap-1.5"
                      >
                        <Package className="h-3.5 w-3.5" />
                        {order.items[caseIdx].name}
                      </Button>
                    ))}
                  </div>

                  {activeCaseIdx !== null && (
                    <div className="space-y-2 border-t border-border pt-3">
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                        Assign to: {order.items[activeCaseIdx].name}
                      </p>
                      {contentIndices.map((itemIdx) => {
                        const assignedTo = getAssignedCaseForItem(itemIdx);
                        const isAssignedHere = assignedTo === activeCaseIdx;
                        const isAssignedElsewhere = assignedTo !== null && assignedTo !== activeCaseIdx;
                        return (
                          <div
                            key={itemIdx}
                            className={`flex items-center gap-3 p-2.5 rounded-lg border transition-colors ${
                              isAssignedHere
                                ? 'border-primary bg-primary/5'
                                : isAssignedElsewhere
                                ? 'border-muted opacity-50'
                                : 'border-border'
                            }`}
                          >
                            <Checkbox
                              checked={isAssignedHere}
                              disabled={isAssignedElsewhere}
                              onCheckedChange={() => toggleAssignment(itemIdx)}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-foreground truncate">{order.items[itemIdx].name}</p>
                              <p className="text-xs text-muted-foreground">×{order.items[itemIdx].quantity}</p>
                            </div>
                            {isAssignedElsewhere && (
                              <Badge variant="outline" className="text-xs">
                                In: {order.items[assignedTo!].name}
                              </Badge>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default JobView;
