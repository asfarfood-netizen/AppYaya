-- ============================================================
-- SCHÉMA HÔTEL YAHIA — Supabase PostgreSQL
-- Exécuter dans l'éditeur SQL de Supabase (SQL Editor)
('A4','Annexe','Appartement','libre')
ON CONFLICT (number) DO NOTHING;
-- ============================================================
-- TABLE: daily_stats (Historique quotidien)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.daily_stats (
  date DATE PRIMARY KEY,
  libre INT DEFAULT 0,
  occupee INT DEFAULT 0,
  en_preparation INT DEFAULT 0,
  maintenance INT DEFAULT 0
);
ALTER TABLE public.daily_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "daily_stats_select_all" ON public.daily_stats
  FOR SELECT USING (auth.role() = 'authenticated');
-- Fonction pour mettre à jour daily_stats automatiquement
CREATE OR REPLACE FUNCTION update_daily_stats()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Insert today's row if it doesn't exist
  INSERT INTO public.daily_stats (date)
  VALUES (CURRENT_DATE)
  ON CONFLICT (date) DO NOTHING;
  -- Remove count from old status if it's an update
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF OLD.status = 'libre' THEN UPDATE public.daily_stats SET libre = libre - 1 WHERE date = CURRENT_DATE;
    ELSIF OLD.status = 'occupee' THEN UPDATE public.daily_stats SET occupee = occupee - 1 WHERE date = CURRENT_DATE;
    ELSIF OLD.status = 'en_preparation' THEN UPDATE public.daily_stats SET en_preparation = en_preparation - 1 WHERE date = CURRENT_DATE;
    ELSIF OLD.status = 'maintenance' THEN UPDATE public.daily_stats SET maintenance = maintenance - 1 WHERE date = CURRENT_DATE;
    END IF;
  END IF;
  -- Add count to new status
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
    IF NEW.status = 'libre' THEN UPDATE public.daily_stats SET libre = libre + 1 WHERE date = CURRENT_DATE;
    ELSIF NEW.status = 'occupee' THEN UPDATE public.daily_stats SET occupee = occupee + 1 WHERE date = CURRENT_DATE;
    ELSIF NEW.status = 'en_preparation' THEN UPDATE public.daily_stats SET en_preparation = en_preparation + 1 WHERE date = CURRENT_DATE;
    ELSIF NEW.status = 'maintenance' THEN UPDATE public.daily_stats SET maintenance = maintenance + 1 WHERE date = CURRENT_DATE;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_room_status_change_stats ON public.rooms;
CREATE TRIGGER on_room_status_change_stats
  AFTER INSERT OR UPDATE OF status ON public.rooms
  FOR EACH ROW EXECUTE FUNCTION update_daily_stats();
-- Initialisation/backfill pour aujourd'hui
INSERT INTO public.daily_stats (date, libre, occupee, en_preparation, maintenance)
SELECT 
  CURRENT_DATE,
  COUNT(*) FILTER (WHERE status = 'libre'),
  COUNT(*) FILTER (WHERE status = 'occupee'),
  COUNT(*) FILTER (WHERE status = 'en_preparation'),
  COUNT(*) FILTER (WHERE status = 'maintenance')
FROM public.rooms
ON CONFLICT (date) DO UPDATE SET
  libre = EXCLUDED.libre,
  occupee = EXCLUDED.occupee,
  en_preparation = EXCLUDED.en_preparation,
  maintenance = EXCLUDED.maintenance;
