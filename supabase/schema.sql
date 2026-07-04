-- ============================================================
-- SCHÉMA HÔTEL YAHIA — Supabase PostgreSQL
-- Exécuter dans l'éditeur SQL de Supabase (SQL Editor)
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLE: profiles (extension de auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name  TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'reception' CHECK (role IN ('admin','reception','gouvernante','entretien')),
  avatar_url TEXT,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Trigger: auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), COALESCE(NEW.raw_user_meta_data->>'role', 'reception'));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger: updated_at auto
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- TABLE: rooms
-- ============================================================
CREATE TABLE IF NOT EXISTS public.rooms (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  number       TEXT UNIQUE NOT NULL,
  floor        TEXT NOT NULL,
  room_type    TEXT NOT NULL DEFAULT 'Standard' CHECK (room_type IN ('Standard','Grand','Appartement')),
  status       TEXT NOT NULL DEFAULT 'libre' CHECK (status IN ('libre','occupe','en_preparation','non_nettoyee','bloquee','special')),
  special_flag TEXT CHECK (special_flag IN ('VIP','Late Check-out','Early Check-in','NPC','sb',NULL)),
  notes        TEXT,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER rooms_updated_at BEFORE UPDATE ON public.rooms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- TABLE: tasks
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tasks (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id      UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
  task_type    TEXT NOT NULL CHECK (task_type IN ('menage','reparation','reception')),
  title        TEXT NOT NULL,
  description  TEXT,
  status       TEXT NOT NULL DEFAULT 'en_attente' CHECK (status IN ('en_attente','en_cours','terminee','annulee')),
  priority     TEXT NOT NULL DEFAULT 'normale' CHECK (priority IN ('normale','urgente')),
  assigned_to  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER tasks_updated_at BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- TABLE: logs
-- ============================================================
CREATE TABLE IF NOT EXISTS public.logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('room','task','user')),
  entity_id   UUID,
  old_value   JSONB,
  new_value   JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- FUNCTION: log action (appelée par triggers/app)
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_room_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.logs (user_id, action, entity_type, entity_id, old_value, new_value)
    VALUES (
      NEW.updated_by,
      'status_change',
      'room',
      NEW.id,
      jsonb_build_object('status', OLD.status),
      jsonb_build_object('status', NEW.status, 'number', NEW.number)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER rooms_log_change AFTER UPDATE ON public.rooms
  FOR EACH ROW EXECUTE FUNCTION public.log_room_change();

-- ============================================================
-- RLS POLICIES — profiles
-- ============================================================

-- Tout utilisateur authentifié peut voir les profils (nécessaire pour assigner les tâches)
CREATE POLICY "profiles_select_all" ON public.profiles
  FOR SELECT USING (auth.role() = 'authenticated');

-- Admin peut modifier tous les profils
CREATE POLICY "profiles_update_admin" ON public.profiles
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Admin peut insérer des profils
CREATE POLICY "profiles_insert_admin" ON public.profiles
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Chacun peut modifier son propre profil (nom, avatar)
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- ============================================================
-- RLS POLICIES — rooms
-- ============================================================

-- Tout utilisateur authentifié peut LIRE les chambres
CREATE POLICY "rooms_select_all" ON public.rooms
  FOR SELECT USING (auth.role() = 'authenticated');

-- Admin: accès complet
CREATE POLICY "rooms_update_admin" ON public.rooms
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Réception: peut passer en 'occupe', 'non_nettoyee', 'special', 'libre'
CREATE POLICY "rooms_update_reception" ON public.rooms
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'reception')
    AND status IN ('libre','occupe','non_nettoyee','special')
  )
  WITH CHECK (
    status IN ('occupe','non_nettoyee','special','libre')
  );

-- Gouvernante: peut passer en 'en_preparation' ou 'libre'
CREATE POLICY "rooms_update_gouvernante" ON public.rooms
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'gouvernante')
    AND status IN ('non_nettoyee','en_preparation','libre')
  )
  WITH CHECK (
    status IN ('en_preparation','libre')
  );

-- Entretien: peut passer en 'bloquee' ou 'libre'
CREATE POLICY "rooms_update_entretien" ON public.rooms
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'entretien')
    AND status IN ('libre','bloquee','non_nettoyee','en_preparation')
  )
  WITH CHECK (
    status IN ('bloquee','libre')
  );

-- ============================================================
-- RLS POLICIES — tasks
-- ============================================================

-- Lecture: Admin voit tout, autres voient leurs tâches assignées
CREATE POLICY "tasks_select_admin" ON public.tasks
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "tasks_select_reception" ON public.tasks
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'reception')
    AND (assigned_to = auth.uid() OR created_by = auth.uid() OR task_type = 'reception')
  );

CREATE POLICY "tasks_select_gouvernante" ON public.tasks
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'gouvernante')
    AND (assigned_to = auth.uid() OR created_by = auth.uid() OR task_type = 'menage')
  );

CREATE POLICY "tasks_select_entretien" ON public.tasks
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'entretien')
    AND (assigned_to = auth.uid() OR created_by = auth.uid() OR task_type = 'reparation')
  );

-- Insertion: tout utilisateur authentifié peut créer une tâche
CREATE POLICY "tasks_insert_all" ON public.tasks
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Mise à jour: admin ou assigné
CREATE POLICY "tasks_update_admin" ON public.tasks
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "tasks_update_assigned" ON public.tasks
  FOR UPDATE USING (assigned_to = auth.uid() OR created_by = auth.uid());

-- ============================================================
-- RLS POLICIES — logs
-- ============================================================

-- Seul l'admin peut lire les logs
CREATE POLICY "logs_select_admin" ON public.logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Le système insère les logs (via trigger SECURITY DEFINER)
CREATE POLICY "logs_insert_system" ON public.logs
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ============================================================
-- REALTIME: activer pour les tables dynamiques
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.logs;

-- ============================================================
-- DONNÉES INITIALES: 110 chambres depuis HIVER 2025-26.xlsx
-- ============================================================
INSERT INTO public.rooms (number, floor, room_type, status) VALUES
-- Étage 1
('101G','1','Grand','libre'),
('102G','1','Grand','libre'),
('103','1','Standard','libre'),
('104','1','Standard','libre'),
('105','1','Standard','libre'),
('106','1','Standard','libre'),
('109','1','Standard','libre'),
-- Étage 2
('201G','2','Grand','libre'),
('202G','2','Grand','libre'),
('203','2','Standard','libre'),
('204','2','Standard','libre'),
('205','2','Standard','libre'),
('206','2','Standard','libre'),
('207','2','Standard','libre'),
('208','2','Standard','libre'),
('209','2','Standard','libre'),
('210','2','Standard','libre'),
('211','2','Standard','libre'),
('212','2','Standard','libre'),
('213','2','Standard','libre'),
('214','2','Standard','libre'),
('215','2','Standard','libre'),
('216','2','Standard','libre'),
-- Étage 3
('301G','3','Grand','libre'),
('302','3','Standard','libre'),
('303','3','Standard','libre'),
('304','3','Standard','libre'),
('305','3','Standard','libre'),
('306','3','Standard','libre'),
('307','3','Standard','libre'),
('308','3','Standard','libre'),
('309','3','Standard','libre'),
('310','3','Standard','libre'),
('311','3','Standard','libre'),
('312','3','Standard','libre'),
('313','3','Standard','libre'),
('314','3','Standard','libre'),
('315','3','Standard','libre'),
('316','3','Standard','libre'),
-- Étage 4
('401G','4','Grand','libre'),
('402','4','Standard','libre'),
('403','4','Standard','libre'),
('404','4','Standard','libre'),
('405','4','Standard','libre'),
('406','4','Standard','libre'),
('407','4','Standard','libre'),
('408','4','Standard','libre'),
('409','4','Standard','libre'),
('410','4','Standard','libre'),
('411','4','Standard','libre'),
('412','4','Standard','libre'),
('413','4','Standard','libre'),
('414','4','Standard','libre'),
('415','4','Standard','libre'),
('416','4','Standard','libre'),
-- Étage 5
('501','5','Standard','libre'),
('502','5','Standard','libre'),
('503','5','Standard','libre'),
('504','5','Standard','libre'),
('505','5','Standard','libre'),
('506','5','Standard','libre'),
('507','5','Standard','libre'),
('508','5','Standard','libre'),
('509','5','Standard','libre'),
('510','5','Standard','libre'),
('511','5','Standard','libre'),
('512','5','Standard','libre'),
('513','5','Standard','libre'),
('514','5','Standard','libre'),
('515','5','Standard','libre'),
-- Étage 6
('601','6','Standard','libre'),
('602','6','Standard','libre'),
('603','6','Standard','libre'),
('604','6','Standard','libre'),
('605','6','Standard','libre'),
('606','6','Standard','libre'),
('607','6','Standard','libre'),
('608','6','Standard','libre'),
-- Étage 11
('1101','11','Standard','libre'),
('1102','11','Standard','libre'),
('1103G','11','Grand','libre'),
-- Étage 12
('1202','12','Standard','libre'),
('1203','12','Standard','libre'),
-- Étage 13
('1301','13','Standard','libre'),
('1302','13','Standard','libre'),
('1303','13','Standard','libre'),
('1304','13','Standard','libre'),
('1305','13','Standard','libre'),
('1306G','13','Grand','libre'),
-- Étage 14
('1401G','14','Grand','libre'),
('1402','14','Standard','libre'),
('1403','14','Standard','libre'),
('1404','14','Standard','libre'),
('1405','14','Standard','libre'),
('1406','14','Standard','libre'),
-- Étage 15
('1501','15','Standard','libre'),
('1502','15','Standard','libre'),
('1503','15','Standard','libre'),
('1504','15','Standard','libre'),
('1505','15','Standard','libre'),
('1506','15','Standard','libre'),
-- Étage 16
('1601','16','Standard','libre'),
('1602','16','Standard','libre'),
('1603','16','Standard','libre'),
('1604','16','Standard','libre'),
('1605','16','Standard','libre'),
-- Annexe
('A1','Annexe','Appartement','libre'),
('A2','Annexe','Appartement','libre'),
('A3','Annexe','Appartement','libre'),
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

