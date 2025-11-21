-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enums
CREATE TYPE fuel_type_enum AS ENUM ('ESSENCE', 'GASOIL');
CREATE TYPE availability_enum AS ENUM ('AVAILABLE', 'LIMITED', 'OUT');
CREATE TYPE source_type_enum AS ENUM ('OFFICIAL', 'TRUSTED', 'PUBLIC');
CREATE TYPE queue_category_enum AS ENUM ('Q_0_10', 'Q_10_30', 'Q_30_60', 'Q_60_PLUS');
CREATE TYPE user_role_enum AS ENUM ('PUBLIC', 'STATION_MANAGER', 'TRUSTED_REPORTER', 'ADMIN');
CREATE TYPE alert_type_enum AS ENUM ('NO_UPDATE', 'HIGH_WAIT', 'CONTRADICTION');
CREATE TYPE alert_status_enum AS ENUM ('OPEN', 'RESOLVED');

-- Station table
CREATE TABLE station (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  brand TEXT,
  city TEXT NOT NULL,
  area TEXT NOT NULL,
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

-- UserProfile table
CREATE TABLE user_profile (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_user_id UUID UNIQUE NOT NULL,
  email_or_phone TEXT NOT NULL,
  role user_role_enum DEFAULT 'PUBLIC',
  station_id UUID REFERENCES station(id) ON DELETE SET NULL,
  is_verified BOOLEAN DEFAULT false,
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

-- Indexes for performance
CREATE INDEX idx_station_status_station_id ON station_status(station_id);
CREATE INDEX idx_station_status_updated_at ON station_status(updated_at);
CREATE INDEX idx_contribution_station_id ON contribution(station_id);
CREATE INDEX idx_contribution_created_at ON contribution(created_at);
CREATE INDEX idx_alert_station_id ON alert(station_id);
CREATE INDEX idx_alert_status ON alert(status);
CREATE INDEX idx_station_city ON station(city);
CREATE INDEX idx_station_is_active ON station(is_active);

-- Enable Realtime for relevant tables
ALTER PUBLICATION supabase_realtime ADD TABLE station_status;
ALTER PUBLICATION supabase_realtime ADD TABLE contribution;
ALTER PUBLICATION supabase_realtime ADD TABLE alert;

-- RLS Policies (basic stubs - adjust based on your security requirements)
ALTER TABLE station ENABLE ROW LEVEL SECURITY;
ALTER TABLE station_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE contribution ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert ENABLE ROW LEVEL SECURITY;

-- Public read access for stations and statuses
CREATE POLICY "Public can read stations" ON station FOR SELECT USING (is_active = true);
CREATE POLICY "Public can read station_status" ON station_status FOR SELECT USING (true);

-- Public can insert contributions (throttling should be handled in application layer)
CREATE POLICY "Public can insert contributions" ON contribution FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can read contributions" ON contribution FOR SELECT USING (true);

-- Users can read their own profile
CREATE POLICY "Users can read own profile" ON user_profile FOR SELECT USING (auth_user_id = auth.uid());

-- Admins can do everything (this is a stub - implement proper admin check)
-- CREATE POLICY "Admins can manage all" ON station FOR ALL USING (
--   EXISTS (SELECT 1 FROM user_profile WHERE auth_user_id = auth.uid() AND role = 'ADMIN')
-- );

