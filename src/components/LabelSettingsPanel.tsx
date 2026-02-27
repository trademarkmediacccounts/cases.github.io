import { LabelSettings, LabelPreset, LABEL_PRESETS, getEffectiveDimensions } from '@/types/rental';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Settings2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LabelSettingsPanelProps {
  settings: LabelSettings;
  onChange: (settings: LabelSettings) => void;
}

const LabelSettingsPanel = ({ settings, onChange }: LabelSettingsPanelProps) => {
  const update = (partial: Partial<LabelSettings>) => {
    onChange({ ...settings, ...partial });
  };

  const handlePresetChange = (preset: LabelPreset) => {
    if (preset !== 'custom') {
      const def = LABEL_PRESETS[preset];
      update({
        labelPreset: preset,
        labelWidth: def.width,
        labelHeight: def.height,
        labelMode: preset === 'thermal-receipt' ? 'thermal-receipt' : 'label',
      });
    } else {
      update({ labelPreset: 'custom' });
    }
  };

  const dims = getEffectiveDimensions(settings);

  return (
    <div className="bg-card border border-border rounded-lg p-5 space-y-5">
      <div className="flex items-center gap-2 mb-1">
        <Settings2 className="h-5 w-5 text-accent" />
        <h3 className="font-semibold text-foreground">Label Settings</h3>
      </div>

      {/* Company Name */}
      <div className="space-y-1.5">
        <Label className="text-muted-foreground text-xs uppercase tracking-wide">Company Name</Label>
        <Input
          value={settings.companyName}
          onChange={(e) => update({ companyName: e.target.value })}
          className="font-mono"
        />
      </div>

      {/* Font Size */}
      <div className="space-y-1.5">
        <Label className="text-muted-foreground text-xs uppercase tracking-wide">Font Size</Label>
        <Select value={settings.fontSize} onValueChange={(v) => update({ fontSize: v as LabelSettings['fontSize'] })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="small">Small</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="large">Large</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Label Size Preset */}
      <div className="space-y-1.5">
        <Label className="text-muted-foreground text-xs uppercase tracking-wide">Label Size</Label>
        <Select value={settings.labelPreset} onValueChange={(v) => handlePresetChange(v as LabelPreset)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="flightcase-small">Flightcase 127×178mm</SelectItem>
            <SelectItem value="flightcase-large">Flightcase 150×210mm</SelectItem>
            <SelectItem value="thermal-4x6">Thermal 4″×6″ (B&W)</SelectItem>
            <SelectItem value="thermal-receipt">Thermal Receipt</SelectItem>
            <SelectItem value="custom">Custom</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground font-mono">
          {dims.width}mm × {dims.height > 0 ? `${dims.height}mm` : 'auto'}
          {settings.orientation === 'landscape' && dims.height > 0 ? ' (landscape)' : ''}
        </p>
      </div>

      {/* Orientation */}
      {settings.labelPreset !== 'thermal-receipt' && (
        <div className="space-y-1.5">
          <Label className="text-muted-foreground text-xs uppercase tracking-wide">Orientation</Label>
          <div className="flex gap-2">
            <Button
              variant={settings.orientation === 'portrait' ? 'default' : 'outline'}
              size="sm"
              className="flex-1"
              onClick={() => update({ orientation: 'portrait' })}
            >
              Portrait
            </Button>
            <Button
              variant={settings.orientation === 'landscape' ? 'default' : 'outline'}
              size="sm"
              className="flex-1 gap-1.5"
              onClick={() => update({ orientation: 'landscape' })}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Landscape
            </Button>
          </div>
        </div>
      )}

      {/* Custom Dimensions */}
      {settings.labelPreset === 'custom' && (
        <>
          <div className="space-y-3">
            <Label className="text-muted-foreground text-xs uppercase tracking-wide">
              Width: {settings.labelWidth}mm
            </Label>
            <Slider
              value={[settings.labelWidth]}
              onValueChange={([v]) => update({ labelWidth: v })}
              min={50}
              max={250}
              step={1}
            />
          </div>
          <div className="space-y-3">
            <Label className="text-muted-foreground text-xs uppercase tracking-wide">
              Height: {settings.labelHeight}mm
            </Label>
            <Slider
              value={[settings.labelHeight]}
              onValueChange={([v]) => update({ labelHeight: v })}
              min={50}
              max={300}
              step={1}
            />
          </div>
        </>
      )}

      {/* Thermal Receipt Width */}
      {settings.labelPreset === 'thermal-receipt' && (
        <div className="space-y-1.5">
          <Label className="text-muted-foreground text-xs uppercase tracking-wide">Receipt Width</Label>
          <Select
            value={String(settings.thermalReceiptWidth)}
            onValueChange={(v) => update({ thermalReceiptWidth: Number(v), labelWidth: Number(v) })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="58">58mm (2¼″)</SelectItem>
              <SelectItem value="80">80mm (3⅛″)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Toggles */}
      <div className="space-y-3 pt-2 border-t border-border">
        <Label className="text-muted-foreground text-xs uppercase tracking-wide">Visibility</Label>
        {([
          ['showLogo', 'Company Name'],
          ['showBarcode', 'Barcode'],
          ['showContents', 'Contents List'],
          ['showDates', 'Dates'],
          ['showNotes', 'Notes'],
          ['showVenue', 'Venue'],
          ['showWeight', 'Weight Total'],
        ] as const).map(([key, label]) => (
          <div key={key} className="flex items-center justify-between">
            <Label className="text-sm text-foreground">{label}</Label>
            <Switch
              checked={settings[key]}
              onCheckedChange={(v) => update({ [key]: v })}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default LabelSettingsPanel;
