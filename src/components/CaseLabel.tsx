import Barcode from 'react-barcode';
import { ResolvedCase, LabelSettings, getEffectiveDimensions, LABEL_PRESETS } from '@/types/rental';
import { Weight } from 'lucide-react';

interface CaseLabelProps {
  resolvedCase: ResolvedCase;
  settings: LabelSettings;
  caseIndex?: number;
  totalCases?: number;
  logoUrl?: string | null;
}

const fontSizeMap = {
  small: { title: 'text-sm', body: 'text-xs', header: 'text-base' },
  medium: { title: 'text-base', body: 'text-sm', header: 'text-lg' },
  large: { title: 'text-lg', body: 'text-base', header: 'text-xl' },
};

const CaseLabel = ({ resolvedCase: rc, settings, caseIndex, totalCases, logoUrl }: CaseLabelProps) => {
  const sizes = fontSizeMap[settings.fontSize];
  const dims = getEffectiveDimensions(settings);
  const isThermal = settings.labelPreset === 'thermal-4x6' || settings.labelPreset === 'thermal-receipt';

  return (
    <div
      className={`label-container rounded-sm overflow-hidden shadow-md print:shadow-none ${
        isThermal ? 'label-thermal' : ''
      }`}
      style={{
        width: `${dims.width}mm`,
        minHeight: dims.height > 0 ? `${dims.height}mm` : undefined,
      }}
    >
      {/* Header */}
      <div className={`label-header px-4 py-3 flex items-center justify-between ${isThermal ? '!bg-foreground !text-background' : ''}`}>
        <div className="flex items-center gap-2">
          {settings.showLogo && logoUrl && (
            <img src={logoUrl} alt="Logo" className="h-8 object-contain" />
          )}
          {settings.showLogo && (
            <h2 className={`${sizes.header} font-mono font-bold tracking-wider`}>
              {settings.companyName}
            </h2>
          )}
        </div>
        <div className="text-right">
          <span className={`${sizes.body} font-mono opacity-80`}>
            {rc.orderRef}
          </span>
          {caseIndex !== undefined && totalCases !== undefined && totalCases > 1 && (
            <p className={`${sizes.body} font-mono opacity-60`}>
              Case {caseIndex + 1} of {totalCases}
            </p>
          )}
        </div>
      </div>

      {/* Job Info */}
      <div className="px-4 py-3 border-b border-label-border">
        <h3 className={`${sizes.title} font-bold text-foreground`}>
          {rc.jobName}
        </h3>
        <p className={`${sizes.body} text-muted-foreground mt-0.5`}>
          {rc.customerName}
        </p>
        {settings.showVenue && (
          <p className={`${sizes.body} text-muted-foreground mt-0.5 font-mono`}>
            📍 {rc.venue}
          </p>
        )}
      </div>

      {/* Case Info */}
      <div className="px-4 py-3 border-b border-label-border bg-muted/50">
        <div className="flex justify-between items-start">
          <div>
            <span className={`${sizes.body} text-muted-foreground`}>Container</span>
            <p className={`${sizes.title} font-mono font-bold text-foreground`}>
              {rc.caseItem.name}
            </p>
          </div>
          {settings.showWeight && (
            <div className="text-right flex items-center gap-1.5 bg-primary text-primary-foreground px-2.5 py-1.5 rounded">
              <Weight className="h-4 w-4" />
              <span className={`${sizes.title} font-mono font-bold`}>
                {rc.totalWeight.toFixed(1)} kg
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Dates */}
      {settings.showDates && (
        <div className="px-4 py-2 border-b border-label-border flex gap-6">
          <div>
            <span className={`${sizes.body} text-muted-foreground`}>Out</span>
            <p className={`${sizes.body} font-mono font-semibold text-foreground`}>
              {new Date(rc.jobDate).toLocaleDateString('en-GB', {
                day: '2-digit', month: 'short', year: 'numeric',
              })}
            </p>
          </div>
          <div>
            <span className={`${sizes.body} text-muted-foreground`}>Return</span>
            <p className={`${sizes.body} font-mono font-semibold text-foreground`}>
              {new Date(rc.returnDate).toLocaleDateString('en-GB', {
                day: '2-digit', month: 'short', year: 'numeric',
              })}
            </p>
          </div>
        </div>
      )}

      {/* Contents */}
      {settings.showContents && rc.contents.length > 0 && (
        <div className="px-4 py-3 border-b border-label-border">
          <span className={`${sizes.body} text-muted-foreground font-semibold uppercase tracking-wide`}>
            Contents
          </span>
          <table className="w-full mt-1.5">
            <tbody>
              {rc.contents.map((item, i) => (
                <tr key={i} className={`${sizes.body} font-mono`}>
                  <td className="py-0.5 text-foreground">{item.name}</td>
                  <td className="py-0.5 text-right text-muted-foreground w-16">
                    {item.weight ? `${(item.weight * item.quantity).toFixed(1)}kg` : ''}
                  </td>
                  <td className="py-0.5 text-right text-muted-foreground w-10">
                    ×{item.quantity}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Notes */}
      {settings.showNotes && rc.notes && (
        <div className="px-4 py-2 border-b border-label-border">
          <span className={`${sizes.body} text-muted-foreground font-semibold uppercase tracking-wide`}>
            Notes
          </span>
          <p className={`${sizes.body} text-foreground mt-0.5`}>{rc.notes}</p>
        </div>
      )}

      {/* Barcode — uses the case's asset code */}
      {settings.showBarcode && (
        <div className="barcode-wrapper px-4 py-3 flex flex-col items-center">
          <Barcode
            value={rc.caseAssetCode}
            width={1.5}
            height={40}
            fontSize={12}
            font="JetBrains Mono"
            background="transparent"
            lineColor={isThermal ? '#000000' : '#f2f2f2'}
            margin={0}
          />
        </div>
      )}
    </div>
  );
};

export default CaseLabel;
