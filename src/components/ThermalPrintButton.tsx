import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Printer, Loader2, Usb } from 'lucide-react';
import { ResolvedCase, LabelSettings } from '@/types/rental';
import { buildReceiptData, connectAndPrint } from '@/lib/escpos';
import { useToast } from '@/hooks/use-toast';

interface ThermalPrintButtonProps {
  cases: ResolvedCase[];
  settings: LabelSettings;
}

const ThermalPrintButton = ({ cases, settings }: ThermalPrintButtonProps) => {
  const [printing, setPrinting] = useState(false);
  const { toast } = useToast();

  const isWebUSBSupported = 'usb' in navigator;

  const handlePrint = async () => {
    if (cases.length === 0) return;
    setPrinting(true);
    try {
      const data = buildReceiptData(cases, settings);
      await connectAndPrint(data);
      toast({ title: 'Printed', description: 'Receipt sent to thermal printer.' });
    } catch (err: any) {
      toast({
        title: 'Print failed',
        description: err.message || 'Could not connect to printer.',
        variant: 'destructive',
      });
    } finally {
      setPrinting(false);
    }
  };

  if (!isWebUSBSupported) return null;

  return (
    <Button
      variant="outline"
      onClick={handlePrint}
      disabled={printing || cases.length === 0}
      className="gap-2"
      title="Print to USB thermal printer"
    >
      {printing ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Usb className="h-4 w-4" />
      )}
      Thermal
    </Button>
  );
};

export default ThermalPrintButton;
