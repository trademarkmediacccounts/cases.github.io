import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useOrders } from '@/hooks/useOrders';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Tag, Search, Settings, LogOut, RefreshCw, AlertCircle, Loader2,
  Calendar, MapPin, Package, ChevronRight,
} from 'lucide-react';

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

const Index = () => {
  const { orders, loading, error, usingMockData, refetch } = useOrders();
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const filteredOrders = orders.filter((o) => {
    const q = search.toLowerCase();
    return (
      o.jobName.toLowerCase().includes(q) ||
      o.customerName.toLowerCase().includes(q) ||
      o.orderRef.toLowerCase().includes(q) ||
      o.venue.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-card/60 backdrop-blur-sm">
        <div className="container max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-md bg-primary flex items-center justify-center">
              <Tag className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground tracking-tight">Case Labels</h1>
              <p className="text-xs text-muted-foreground">
                {usingMockData ? 'Sample Data' : 'Live Orders'} · {orders.length} jobs
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={refetch} disabled={loading} title="Refresh">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => navigate('/settings')} title="Settings">
              <Settings className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={signOut} title="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="container max-w-4xl mx-auto px-4 py-6 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search jobs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 font-mono text-sm"
          />
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-xs">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">No jobs found</div>
        ) : (
          <div className="space-y-2">
            {filteredOrders.map((order) => {
              const caseCount = order.items.filter((i) => i.productCategory?.toLowerCase() === 'case').length;
              const itemCount = order.items.length;
              return (
                <button
                  key={order.id}
                  onClick={() => navigate(`/job/${order.id}`)}
                  className="w-full text-left p-4 rounded-lg border border-border bg-card hover:border-accent/50 transition-all group"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <h3 className="font-semibold text-foreground text-sm">{order.jobName}</h3>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-xs ${statusStyles[order.status]}`}>
                        {statusLabels[order.status]}
                      </Badge>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-accent transition-colors" />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">{order.customerName}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(order.jobDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                    {order.venue && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {order.venue.split(',')[0]}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Package className="h-3 w-3" />
                      {caseCount} case{caseCount !== 1 ? 's' : ''} · {itemCount} items
                    </span>
                  </div>
                  <span className="font-mono text-xs text-muted-foreground mt-1 block">{order.orderRef}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
