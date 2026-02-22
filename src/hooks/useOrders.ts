import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RentalOrder } from '@/types/rental';
import { mockOrders } from '@/data/mockOrders';

export function useOrders() {
  const [orders, setOrders] = useState<RentalOrder[]>(mockOrders);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usingMockData, setUsingMockData] = useState(true);

  const fetchOrders = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('fetch-orders');

      if (fnError) throw fnError;

      if (data?.orders && data.orders.length > 0) {
        setOrders(data.orders);
        setUsingMockData(false);
      } else {
        // No credentials or no orders — fall back to mock data
        setOrders(mockOrders);
        setUsingMockData(true);
        if (data?.message) setError(data.message);
      }

      if (data?.errors?.length) {
        setError(data.errors.join('; '));
      }
    } catch (err: any) {
      console.error('Failed to fetch orders:', err);
      setOrders(mockOrders);
      setUsingMockData(true);
      setError('Failed to fetch orders from API. Showing sample data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  return { orders, loading, error, usingMockData, refetch: fetchOrders };
}
