import Barcode from 'react-barcode';
import { RentalOrder, LabelSettings } from '@/types/rental';

interface CaseLabelProps {
  order: RentalOrder;
  settings: LabelSettings;
}

const fontSizeMap = {
  small: { title: 'text-sm', body: 'text-xs', header: 'text-base' },
  medium: { title: 'text-base', body: 'text-sm', header: 'text-lg' },
  large: { title: 'text-lg', body: 'text-base', header: 'text-xl' },
};

const CaseLabel = ({ order, settings }: CaseLabelProps) => {
  const sizes = fontSizeMap[settings.fontSize];

  return (
    <div
      className="label-container rounded-sm overflow-hidden shadow-md print:shadow-none"
      style={{
        width: `${settings.labelWidth}mm`,
        minHeight: `${settings.labelHeight}mm`,
      }}
    >
      {/* Header */}
      <div className="label-header px-4 py-3 flex items-center justify-between">
        <div>
          {settings.showLogo && (
            <h2 className={`${sizes.header} font-mono font-bold tracking-wider`}>
              {settings.companyName}
            </h2>
          )}
        </div>
        <div className="text-right">
          <span className={`${sizes.body} font-mono opacity-80`}>
            {order.orderRef}
          </span>
        </div>
      </div>

      {/* Job Info */}
      <div className="px-4 py-3 border-b border-label-border">
        <h3 className={`${sizes.title} font-bold text-foreground`}>
          {order.jobName}
        </h3>
        <p className={`${sizes.body} text-muted-foreground mt-0.5`}>
          {order.customerName}
        </p>
        {settings.showVenue && (
          <p className={`${sizes.body} text-muted-foreground mt-0.5 font-mono`}>
            📍 {order.venue}
          </p>
        )}
      </div>

      {/* Case Info */}
      <div className="px-4 py-3 border-b border-label-border bg-muted/50">
        <div className="flex justify-between items-center">
          <div>
            <span className={`${sizes.body} text-muted-foreground`}>Case</span>
            <p className={`${sizes.title} font-mono font-bold text-foreground`}>
              {order.caseNumber}
            </p>
          </div>
          <div className="text-right">
            <span className={`${sizes.body} text-muted-foreground`}>Type</span>
            <p className={`${sizes.title} font-mono font-semibold text-foreground`}>
              {order.caseType}
            </p>
          </div>
        </div>
      </div>

      {/* Dates */}
      {settings.showDates && (
        <div className="px-4 py-2 border-b border-label-border flex gap-6">
          <div>
            <span className={`${sizes.body} text-muted-foreground`}>Out</span>
            <p className={`${sizes.body} font-mono font-semibold text-foreground`}>
              {new Date(order.jobDate).toLocaleDateString('en-GB', {
                day: '2-digit', month: 'short', year: 'numeric'
              })}
            </p>
          </div>
          <div>
            <span className={`${sizes.body} text-muted-foreground`}>Return</span>
            <p className={`${sizes.body} font-mono font-semibold text-foreground`}>
              {new Date(order.returnDate).toLocaleDateString('en-GB', {
                day: '2-digit', month: 'short', year: 'numeric'
              })}
            </p>
          </div>
        </div>
      )}

      {/* Contents */}
      {settings.showContents && (
        <div className="px-4 py-3 border-b border-label-border">
          <span className={`${sizes.body} text-muted-foreground font-semibold uppercase tracking-wide`}>
            Contents
          </span>
          <table className="w-full mt-1.5">
            <tbody>
              {order.contents.map((item, i) => (
                <tr key={i} className={`${sizes.body} font-mono`}>
                  <td className="py-0.5 text-foreground">{item.name}</td>
                  <td className="py-0.5 text-right text-muted-foreground w-12">
                    ×{item.quantity}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Notes */}
      {settings.showNotes && order.notes && (
        <div className="px-4 py-2 border-b border-label-border">
          <span className={`${sizes.body} text-muted-foreground font-semibold uppercase tracking-wide`}>
            Notes
          </span>
          <p className={`${sizes.body} text-foreground mt-0.5`}>{order.notes}</p>
        </div>
      )}

      {/* Barcode */}
      {settings.showBarcode && (
        <div className="px-4 py-3 flex flex-col items-center">
          <Barcode
            value={order.caseAssetCode}
            width={1.5}
            height={40}
            fontSize={12}
            font="JetBrains Mono"
            background="transparent"
            lineColor="hsl(220, 25%, 15%)"
            margin={0}
          />
        </div>
      )}
    </div>
  );
};

export default CaseLabel;
