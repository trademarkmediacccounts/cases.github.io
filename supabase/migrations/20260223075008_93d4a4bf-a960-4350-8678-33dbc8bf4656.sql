
-- Table for saving user label/branding presets
CREATE TABLE public.label_presets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT 'Default',
  settings JSONB NOT NULL DEFAULT '{}',
  logo_url TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.label_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own presets" ON public.label_presets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own presets" ON public.label_presets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own presets" ON public.label_presets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own presets" ON public.label_presets FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_label_presets_updated_at
  BEFORE UPDATE ON public.label_presets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Unique constraint: only one default per user
CREATE UNIQUE INDEX idx_label_presets_user_default ON public.label_presets (user_id) WHERE is_default = true;

-- Storage bucket for logos
INSERT INTO storage.buckets (id, name, public) VALUES ('logos', 'logos', true);

CREATE POLICY "Users can upload their own logo" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'logos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can update their own logo" ON storage.objects FOR UPDATE USING (bucket_id = 'logos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete their own logo" ON storage.objects FOR DELETE USING (bucket_id = 'logos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Logos are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'logos');

-- Table for manual case assignments (overrides auto-detection)
CREATE TABLE public.case_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  order_id TEXT NOT NULL,
  case_item_name TEXT NOT NULL,
  assigned_items JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.case_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own assignments" ON public.case_assignments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own assignments" ON public.case_assignments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own assignments" ON public.case_assignments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own assignments" ON public.case_assignments FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_case_assignments_updated_at
  BEFORE UPDATE ON public.case_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
