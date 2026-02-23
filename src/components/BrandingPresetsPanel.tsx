import { useState, useRef } from 'react';
import { LabelSettings } from '@/types/rental';
import { useLabelPresets, LabelPreset } from '@/hooks/useLabelPresets';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Save, Trash2, Upload, Palette, Loader2, Star } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface BrandingPresetsPanelProps {
  settings: LabelSettings;
  onLoadPreset: (settings: LabelSettings, logoUrl: string | null) => void;
}

const BrandingPresetsPanel = ({ settings, onLoadPreset }: BrandingPresetsPanelProps) => {
  const { presets, activePreset, setActivePreset, savePreset, deletePreset, uploadLogo, loading } = useLabelPresets();
  const { toast } = useToast();
  const [presetName, setPresetName] = useState('');
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  const handleSave = async () => {
    const name = presetName.trim() || activePreset?.name || 'Default';
    setSaving(true);
    await savePreset(name, settings, logoUrl);
    toast({ title: 'Preset Saved', description: `"${name}" saved.` });
    setSaving(false);
    setPresetName('');
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSaving(true);
    const url = await uploadLogo(file);
    if (url) {
      setLogoUrl(url);
      toast({ title: 'Logo Uploaded', description: 'Logo ready to save with preset.' });
    } else {
      toast({ title: 'Upload Failed', variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleLoad = (preset: LabelPreset) => {
    setActivePreset(preset);
    onLoadPreset(preset.settings, preset.logo_url);
    setLogoUrl(preset.logo_url);
    toast({ title: 'Preset Loaded', description: `"${preset.name}" applied.` });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Palette className="h-4 w-4" />
          Branding Presets
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Logo upload */}
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Company Logo</Label>
          {logoUrl && (
            <img src={logoUrl} alt="Logo" className="h-10 object-contain rounded border border-border p-1" />
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={saving} className="gap-1.5">
            <Upload className="h-3.5 w-3.5" />
            Upload Logo
          </Button>
        </div>

        {/* Save preset */}
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Save Current Settings</Label>
          <div className="flex gap-2">
            <Input
              placeholder={activePreset?.name || 'Preset name'}
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              className="text-sm"
            />
            <Button onClick={handleSave} disabled={saving} size="icon" className="shrink-0">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* List presets */}
        {presets.length > 0 && (
          <div className="space-y-2 border-t border-border pt-3">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Saved Presets</Label>
            {presets.map((preset) => (
              <div
                key={preset.id}
                className={`flex items-center justify-between p-2.5 rounded-lg border transition-colors cursor-pointer ${
                  activePreset?.id === preset.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                }`}
                onClick={() => handleLoad(preset)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {preset.is_default && <Star className="h-3.5 w-3.5 text-primary shrink-0" />}
                  <span className="text-sm font-medium text-foreground truncate">{preset.name}</span>
                  {preset.logo_url && (
                    <img src={preset.logo_url} alt="" className="h-5 w-5 object-contain rounded" />
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={(e) => { e.stopPropagation(); deletePreset(preset.id); }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BrandingPresetsPanel;
