-- =====================================================
-- SiraFuel Database Recreation Script
-- =====================================================
-- This script recreates the entire database schema from scratch
-- Run this in your Supabase SQL Editor or via psql
-- =====================================================

-- =====================================================
-- STEP 1: DROP EXISTING OBJECTS (if they exist)
-- =====================================================
-- Note: Dropping tables with CASCADE will automatically remove
-- all policies, indexes, and foreign key constraints

-- Drop tables first (CASCADE removes all dependent objects)
DROP TABLE IF EXISTS alert CASCADE;
DROP TABLE IF EXISTS contribution CASCADE;
DROP TABLE IF EXISTS station_status CASCADE;
DROP TABLE IF EXISTS user_profile CASCADE;
DROP TABLE IF EXISTS station CASCADE;

-- Drop enums (CASCADE removes any dependencies)
DROP TYPE IF EXISTS alert_status_enum CASCADE;
DROP TYPE IF EXISTS alert_type_enum CASCADE;
DROP TYPE IF EXISTS user_role_enum CASCADE;
DROP TYPE IF EXISTS queue_category_enum CASCADE;
DROP TYPE IF EXISTS source_type_enum CASCADE;
DROP TYPE IF EXISTS availability_enum CASCADE;
DROP TYPE IF EXISTS fuel_type_enum CASCADE;

-- =====================================================
-- STEP 2: CREATE EXTENSIONS
-- =====================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- STEP 3: CREATE ENUMS
-- =====================================================

CREATE TYPE fuel_type_enum AS ENUM ('ESSENCE', 'GASOIL');
CREATE TYPE availability_enum AS ENUM ('AVAILABLE', 'LIMITED', 'OUT');
CREATE TYPE source_type_enum AS ENUM ('OFFICIAL', 'TRUSTED', 'PUBLIC');
CREATE TYPE queue_category_enum AS ENUM ('Q_0_10', 'Q_10_30', 'Q_30_60', 'Q_60_PLUS');
CREATE TYPE user_role_enum AS ENUM ('PUBLIC', 'STATION_MANAGER', 'TRUSTED_REPORTER', 'ADMIN');
CREATE TYPE alert_type_enum AS ENUM ('NO_UPDATE', 'HIGH_WAIT', 'CONTRADICTION');
CREATE TYPE alert_status_enum AS ENUM ('OPEN', 'RESOLVED');

-- =====================================================
-- STEP 4: CREATE TABLES
-- =====================================================

-- Station table (with renamed columns: municipality, neighborhood)
CREATE TABLE station (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  brand TEXT,
  municipality TEXT NOT NULL,  -- renamed from city
  neighborhood TEXT NOT NULL,   -- renamed from area
  latitude FLOAT8 NOT NULL,
  longitude FLOAT8 NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- StationStatus table
CREATE TABLE station_status (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  station_id UUID NOT NULL REFERENCES station(id) ON DELETE CASCADE,
  fuel_type fuel_type_enum NOT NULL,
  availability availability_enum NOT NULL,
  pumps_active INTEGER,
  waiting_time_min INTEGER,
  waiting_time_max INTEGER,
  reliability_score INTEGER DEFAULT 0,
  last_update_source source_type_enum NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(station_id, fuel_type)
);

-- UserProfile table (with must_change_password field)
CREATE TABLE user_profile (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_user_id UUID UNIQUE NOT NULL,
  email_or_phone TEXT NOT NULL,
  role user_role_enum DEFAULT 'PUBLIC',
  station_id UUID REFERENCES station(id) ON DELETE SET NULL,
  is_verified BOOLEAN DEFAULT false,
  must_change_password BOOLEAN DEFAULT false,  -- added in migration 003
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contribution table
CREATE TABLE contribution (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  station_id UUID NOT NULL REFERENCES station(id) ON DELETE CASCADE,
  user_id UUID REFERENCES user_profile(id) ON DELETE SET NULL,
  source_type source_type_enum NOT NULL,
  queue_category queue_category_enum,
  fuel_status availability_enum,
  photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Alert table
CREATE TABLE alert (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  station_id UUID NOT NULL REFERENCES station(id) ON DELETE CASCADE,
  type alert_type_enum NOT NULL,
  status alert_status_enum DEFAULT 'OPEN',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- =====================================================
-- STEP 5: CREATE INDEXES
-- =====================================================

-- Station indexes
CREATE INDEX idx_station_municipality ON station(municipality);  -- updated column name
CREATE INDEX idx_station_is_active ON station(is_active);

-- StationStatus indexes
CREATE INDEX idx_station_status_station_id ON station_status(station_id);
CREATE INDEX idx_station_status_updated_at ON station_status(updated_at);

-- Contribution indexes
CREATE INDEX idx_contribution_station_id ON contribution(station_id);
CREATE INDEX idx_contribution_created_at ON contribution(created_at);

-- Alert indexes
CREATE INDEX idx_alert_station_id ON alert(station_id);
CREATE INDEX idx_alert_status ON alert(status);

-- UserProfile indexes
CREATE INDEX idx_user_profile_must_change_password ON user_profile(must_change_password) 
WHERE must_change_password = true;

-- =====================================================
-- STEP 6: ENABLE ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE station ENABLE ROW LEVEL SECURITY;
ALTER TABLE station_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE contribution ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- STEP 7: CREATE RLS POLICIES
-- =====================================================

-- Station policies
CREATE POLICY "Public can read stations" 
ON station 
FOR SELECT 
USING (is_active = true);

-- StationStatus policies
CREATE POLICY "Public can read station_status" 
ON station_status 
FOR SELECT 
USING (true);

-- Station managers can update status for their own station
CREATE POLICY "Station managers can update their station status" 
ON station_status 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM user_profile 
    WHERE user_profile.auth_user_id = auth.uid() 
      AND user_profile.role = 'STATION_MANAGER' 
      AND user_profile.station_id = station_status.station_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_profile 
    WHERE user_profile.auth_user_id = auth.uid() 
      AND user_profile.role = 'STATION_MANAGER' 
      AND user_profile.station_id = station_status.station_id
  )
);

-- Station managers can insert status for their own station
CREATE POLICY "Station managers can insert their station status" 
ON station_status 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_profile 
    WHERE user_profile.auth_user_id = auth.uid() 
      AND user_profile.role = 'STATION_MANAGER' 
      AND user_profile.station_id = station_status.station_id
  )
);

-- Trusted reporters and admins can update any station status
CREATE POLICY "Trusted reporters can update station status" 
ON station_status 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM user_profile 
    WHERE user_profile.auth_user_id = auth.uid() 
      AND user_profile.role IN ('TRUSTED_REPORTER', 'ADMIN')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_profile 
    WHERE user_profile.auth_user_id = auth.uid() 
      AND user_profile.role IN ('TRUSTED_REPORTER', 'ADMIN')
  )
);

-- Trusted reporters and admins can insert station status
CREATE POLICY "Trusted reporters can insert station status" 
ON station_status 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_profile 
    WHERE user_profile.auth_user_id = auth.uid() 
      AND user_profile.role IN ('TRUSTED_REPORTER', 'ADMIN')
  )
);

-- Contribution policies
CREATE POLICY "Public can insert contributions" 
ON contribution 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Public can read contributions" 
ON contribution 
FOR SELECT 
USING (true);

-- UserProfile policies
CREATE POLICY "Users can read own profile" 
ON user_profile 
FOR SELECT 
USING (auth_user_id = auth.uid());

CREATE POLICY "Users can update own profile" 
ON user_profile 
FOR UPDATE 
USING (auth_user_id = auth.uid())
WITH CHECK (auth_user_id = auth.uid());

-- =====================================================
-- STEP 8: ENABLE REALTIME (Supabase)
-- =====================================================
-- Note: In Supabase, you may need to enable Realtime replication
-- manually in the Dashboard: Database > Replication
-- This script adds tables to the publication, but Supabase UI
-- configuration is also required.

DO $$
BEGIN
  -- Add tables to Realtime publication
  -- Since tables were just created, they shouldn't be in publication yet
  ALTER PUBLICATION supabase_realtime ADD TABLE station_status;
  ALTER PUBLICATION supabase_realtime ADD TABLE contribution;
  ALTER PUBLICATION supabase_realtime ADD TABLE alert;
  RAISE NOTICE '✓ Tables added to Realtime publication';
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'Tables already in Realtime publication (this is okay)';
  WHEN OTHERS THEN
    RAISE NOTICE 'Note: Realtime may need manual configuration in Supabase Dashboard > Database > Replication';
END $$;

-- =====================================================
-- STEP 9: VERIFICATION
-- =====================================================

-- Verify tables were created
DO $$
DECLARE
  table_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN ('station', 'station_status', 'user_profile', 'contribution', 'alert');
  
  IF table_count = 5 THEN
    RAISE NOTICE '✓ All 5 tables created successfully';
  ELSE
    RAISE WARNING '⚠ Expected 5 tables, but found %', table_count;
  END IF;
END $$;

-- =====================================================
-- SCRIPT COMPLETED
-- =====================================================
-- Next steps:
-- 1. Verify the schema in Supabase Dashboard > Table Editor
-- 2. Enable Realtime for the tables in Database > Replication
-- 3. Import station data using: npm run import-stations
-- =====================================================

