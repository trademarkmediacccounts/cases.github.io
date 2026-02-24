import { useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { defaultLabelSettings, LabelSettings, resolveOrderCases, ResolvedCase } from '@/types/rental';
import OrderCard from '@/components/OrderCard';
import CaseLabel from '@/components/CaseLabel';
import LabelSettingsPanel from '@/components/LabelSettingsPanel';
import BrandingPresetsPanel from '@/components/BrandingPresetsPanel';
import { useAuth } from '@/hooks/useAuth';
import { useOrders } from '@/hooks/useOrders';
import { Button } from '@/components/ui/button';
import { Printer, Tag, Search, CheckSquare, Settings, LogOut, RefreshCw, AlertCircle, Loader2, Eye } from 'lucide-react';
import { Input } from '@/components/ui/input';

const Index = () => {
  const { orders, loading, error, usingMockData, refetch } = useOrders();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [settings, setSettings] = useState<LabelSettings>(defaultLabelSettings);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const printRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const filteredOrders = orders.filter((o) => {
    const q = search.toLowerCase();
    return (
      o.jobName.toLowerCase().includes(q) ||
      o.customerName.toLowerCase().includes(q) ||
      o.caseAssetCode.toLowerCase().includes(q) ||
      o.orderRef.toLowerCase().includes(q)
    );
  });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedIds.length === filteredOrders.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredOrders.map((o) => o.id));
    }
  };

  const resolvedCases: ResolvedCase[] = useMemo(() => {
    return orders
      .filter((o) => selectedIds.includes(o.id))
      .flatMap((o) => resolveOrderCases(o));
  }, [selectedIds, orders]);

  const handlePrint = () => {
    window.print();
  };

  const handleLoadPreset = (presetSettings: LabelSettings, presetLogoUrl: string | null) => {
    setSettings(presetSettings);
    setLogoUrl(presetLogoUrl);
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="no-print sticky top-0 z-10 border-b border-border bg-card/60 backdrop-blur-sm">
        <div className="container max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-md bg-primary flex items-center justify-center">
              <Tag className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground tracking-tight">
                Case Label Generator
              </h1>
              <p className="text-xs text-muted-foreground">
                {usingMockData ? 'Sample Data' : 'Live Orders'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={refetch} disabled={loading} title="Refresh orders">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => navigate('/settings')} title="API Settings">
              <Settings className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={signOut} title="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
            <Button
              onClick={handlePrint}
              disabled={resolvedCases.length === 0}
              className="bg-accent text-accent-foreground hover:bg-accent/90 font-semibold gap-2"
            >
              <Printer className="h-4 w-4" />
              Print {resolvedCases.length > 0 && `(${resolvedCases.length} labels)`}
            </Button>
          </div>
        </div>
      </header>

      <div className="container max-w-7xl mx-auto px-4 py-6">
        <div className="no-print grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Orders List */}
          <div className="lg:col-span-3 space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search orders..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 font-mono text-sm"
                />
              </div>
              <Button variant="outline" size="icon" onClick={selectAll} title="Select all">
                <CheckSquare className="h-4 w-4" />
              </Button>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-xs">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <p>{error}</p>
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-2 max-h-[calc(100vh-200px)] overflow-y-auto pr-1">
                {filteredOrders.map((order) => (
                  <div key={order.id} className="relative">
                    <OrderCard
                      order={order}
                      selected={selectedIds.includes(order.id)}
                      onSelect={toggleSelect}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2 h-7 w-7"
                      onClick={(e) => { e.stopPropagation(); navigate(`/job/${order.id}`); }}
                      title="View & assign cases"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                {filteredOrders.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No orders found
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Label Preview */}
          <div className="lg:col-span-6">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Label Preview — {resolvedCases.length} label{resolvedCases.length !== 1 ? 's' : ''}
            </h2>
            {resolvedCases.length === 0 ? (
              <div className="flex items-center justify-center h-64 border border-dashed border-border rounded-lg">
                <p className="text-muted-foreground text-sm">Select orders to preview labels</p>
              </div>
            ) : (
              <div className="space-y-6 flex flex-col items-center">
                {resolvedCases.map((rc, i) => (
                  <div key={`${rc.orderId}-${rc.caseAssetCode}`} className="animate-fade-in">
                    <CaseLabel
                      resolvedCase={rc}
                      settings={settings}
                      caseIndex={i}
                      totalCases={resolvedCases.filter((c) => c.orderId === rc.orderId).length}
                      logoUrl={logoUrl}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Settings */}
          <div className="lg:col-span-3 space-y-4">
            <LabelSettingsPanel settings={settings} onChange={setSettings} />
            <BrandingPresetsPanel settings={settings} onLoadPreset={handleLoadPreset} />
          </div>
        </div>
      </div>

      {/* Print Area */}
      <div ref={printRef} className="print-area hidden print:block">
        <div className="space-y-8">
          {resolvedCases.map((rc) => (
            <div key={`${rc.orderId}-${rc.caseAssetCode}-print`} className="page-break-after">
              <CaseLabel resolvedCase={rc} settings={settings} logoUrl={logoUrl} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Index;
