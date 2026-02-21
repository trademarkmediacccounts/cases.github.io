import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Loader2, Save, Trash2, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CredentialForm {
  api_url: string;
  api_key: string;
  database_name: string;
  username: string;
  subdomain: string;
}

const emptyForm: CredentialForm = {
  api_url: '',
  api_key: '',
  database_name: '',
  username: '',
  subdomain: '',
};

const Settings = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [odoo, setOdoo] = useState<CredentialForm>(emptyForm);
  const [currentrms, setCurrentrms] = useState<CredentialForm>(emptyForm);
  const [odooSaved, setOdooSaved] = useState(false);
  const [crmsSaved, setCrmsSaved] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    loadCredentials();
  }, [user]);

  const loadCredentials = async () => {
    const { data } = await supabase
      .from('api_credentials')
      .select('*')
      .eq('user_id', user!.id);

    data?.forEach((cred: any) => {
      const form: CredentialForm = {
        api_url: cred.api_url || '',
        api_key: cred.api_key || '',
        database_name: cred.database_name || '',
        username: cred.username || '',
        subdomain: cred.subdomain || '',
      };
      if (cred.platform === 'odoo') {
        setOdoo(form);
        setOdooSaved(true);
      } else if (cred.platform === 'currentrms') {
        setCurrentrms(form);
        setCrmsSaved(true);
      }
    });
  };

  const saveCredentials = async (platform: 'odoo' | 'currentrms') => {
    if (!user) return;
    setSaving(platform);
    const form = platform === 'odoo' ? odoo : currentrms;

    try {
      const { error } = await supabase
        .from('api_credentials')
        .upsert(
          {
            user_id: user.id,
            platform,
            api_url: form.api_url,
            api_key: form.api_key,
            database_name: form.database_name || null,
            username: form.username || null,
            subdomain: form.subdomain || null,
          },
          { onConflict: 'user_id,platform' }
        );

      if (error) throw error;

      if (platform === 'odoo') setOdooSaved(true);
      else setCrmsSaved(true);

      toast({ title: 'Saved', description: `${platform === 'odoo' ? 'Odoo' : 'currentRMS'} credentials saved.` });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(null);
    }
  };

  const deleteCredentials = async (platform: 'odoo' | 'currentrms') => {
    if (!user) return;
    setSaving(platform);

    try {
      const { error } = await supabase
        .from('api_credentials')
        .delete()
        .eq('user_id', user.id)
        .eq('platform', platform);

      if (error) throw error;

      if (platform === 'odoo') { setOdoo(emptyForm); setOdooSaved(false); }
      else { setCurrentrms(emptyForm); setCrmsSaved(false); }

      toast({ title: 'Deleted', description: `${platform === 'odoo' ? 'Odoo' : 'currentRMS'} credentials removed.` });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="container max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-lg font-bold text-foreground tracking-tight">API Settings</h1>
            <p className="text-xs text-muted-foreground">Connect your rental management system</p>
          </div>
        </div>
      </header>

      <div className="container max-w-3xl mx-auto px-4 py-6">
        <Tabs defaultValue="odoo">
          <TabsList className="w-full">
            <TabsTrigger value="odoo" className="flex-1 gap-2">
              {odooSaved && <CheckCircle2 className="h-3.5 w-3.5 text-[hsl(var(--badge-success))]" />}
              Odoo
            </TabsTrigger>
            <TabsTrigger value="currentrms" className="flex-1 gap-2">
              {crmsSaved && <CheckCircle2 className="h-3.5 w-3.5 text-[hsl(var(--badge-success))]" />}
              currentRMS
            </TabsTrigger>
          </TabsList>

          <TabsContent value="odoo">
            <Card>
              <CardHeader>
                <CardTitle>Odoo Rental API</CardTitle>
                <CardDescription>
                  Enter your Odoo instance URL, database name, username, and API key to fetch rental orders.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Instance URL</Label>
                  <Input placeholder="https://mycompany.odoo.com" value={odoo.api_url} onChange={(e) => setOdoo({ ...odoo, api_url: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Database Name</Label>
                  <Input placeholder="mycompany" value={odoo.database_name} onChange={(e) => setOdoo({ ...odoo, database_name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Username / Email</Label>
                  <Input placeholder="admin@mycompany.com" value={odoo.username} onChange={(e) => setOdoo({ ...odoo, username: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>API Key</Label>
                  <Input type="password" placeholder="Your Odoo API key" value={odoo.api_key} onChange={(e) => setOdoo({ ...odoo, api_key: e.target.value })} />
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => saveCredentials('odoo')} disabled={saving === 'odoo'} className="gap-2">
                    {saving === 'odoo' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save
                  </Button>
                  {odooSaved && (
                    <Button variant="destructive" onClick={() => deleteCredentials('odoo')} disabled={saving === 'odoo'} className="gap-2">
                      <Trash2 className="h-4 w-4" /> Remove
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="currentrms">
            <Card>
              <CardHeader>
                <CardTitle>currentRMS API</CardTitle>
                <CardDescription>
                  Enter your currentRMS subdomain and API key to fetch rental opportunities.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Subdomain</Label>
                  <Input placeholder="mycompany" value={currentrms.subdomain} onChange={(e) => setCurrentrms({ ...currentrms, subdomain: e.target.value })} />
                  <p className="text-xs text-muted-foreground">Your currentRMS URL: https://[subdomain].current-rms.com</p>
                </div>
                <div className="space-y-2">
                  <Label>API URL</Label>
                  <Input placeholder="https://api.current-rms.com/api/v1" value={currentrms.api_url} onChange={(e) => setCurrentrms({ ...currentrms, api_url: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>API Key</Label>
                  <Input type="password" placeholder="Your currentRMS API key" value={currentrms.api_key} onChange={(e) => setCurrentrms({ ...currentrms, api_key: e.target.value })} />
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => saveCredentials('currentrms')} disabled={saving === 'currentrms'} className="gap-2">
                    {saving === 'currentrms' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save
                  </Button>
                  {crmsSaved && (
                    <Button variant="destructive" onClick={() => deleteCredentials('currentrms')} disabled={saving === 'currentrms'} className="gap-2">
                      <Trash2 className="h-4 w-4" /> Remove
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Settings;
