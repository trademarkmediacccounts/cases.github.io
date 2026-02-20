import { LabelSettings } from '@/types/rental';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Settings2 } from 'lucide-react';

interface LabelSettingsPanelProps {
  settings: LabelSettings;
  onChange: (settings: LabelSettings) => void;
}

const LabelSettingsPanel = ({ settings, onChange }: LabelSettingsPanelProps) => {
  const update = (partial: Partial<LabelSettings>) => {
    onChange({ ...settings, ...partial });
  };

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

      {/* Dimensions */}
      <div className="space-y-3">
        <Label className="text-muted-foreground text-xs uppercase tracking-wide">
          Width: {settings.labelWidth}mm
        </Label>
        <Slider
          value={[settings.labelWidth]}
          onValueChange={([v]) => update({ labelWidth: v })}
          min={60}
          max={150}
          step={5}
        />
      </div>

      <div className="space-y-3">
        <Label className="text-muted-foreground text-xs uppercase tracking-wide">
          Min Height: {settings.labelHeight}mm
        </Label>
        <Slider
          value={[settings.labelHeight]}
          onValueChange={([v]) => update({ labelHeight: v })}
          min={80}
          max={250}
          step={5}
        />
      </div>

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
