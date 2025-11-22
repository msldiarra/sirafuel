-- Add notifications_enabled field to user_profile (if it doesn't exist)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profile' 
    AND column_name = 'notifications_enabled'
  ) THEN
    ALTER TABLE user_profile 
    ADD COLUMN notifications_enabled BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Create station_update_notification table (if it doesn't exist)
CREATE TABLE IF NOT EXISTS station_update_notification (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_profile(id) ON DELETE CASCADE,
  station_id UUID NOT NULL REFERENCES station(id) ON DELETE CASCADE,
  station_status_id UUID NOT NULL REFERENCES station_status(id) ON DELETE CASCADE,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance (if they don't exist)
CREATE INDEX IF NOT EXISTS idx_notification_user_id ON station_update_notification(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_station_id ON station_update_notification(station_id);
CREATE INDEX IF NOT EXISTS idx_notification_is_read ON station_update_notification(is_read);
CREATE INDEX IF NOT EXISTS idx_notification_created_at ON station_update_notification(created_at);

-- Enable Realtime for notifications (if not already enabled)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'station_update_notification'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE station_update_notification;
  END IF;
END $$;

-- RLS Policies
ALTER TABLE station_update_notification ENABLE ROW LEVEL SECURITY;

-- Users can read their own notifications (drop and recreate if exists)
DROP POLICY IF EXISTS "Users can read own notifications" ON station_update_notification;
CREATE POLICY "Users can read own notifications" ON station_update_notification 
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profile 
      WHERE user_profile.id = station_update_notification.user_id 
      AND user_profile.auth_user_id = auth.uid()
    )
  );

-- Users can update their own notifications (mark as read)
DROP POLICY IF EXISTS "Users can update own notifications" ON station_update_notification;
CREATE POLICY "Users can update own notifications" ON station_update_notification 
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_profile 
      WHERE user_profile.id = station_update_notification.user_id 
      AND user_profile.auth_user_id = auth.uid()
    )
  );

-- Users can delete their own notifications
DROP POLICY IF EXISTS "Users can delete own notifications" ON station_update_notification;
CREATE POLICY "Users can delete own notifications" ON station_update_notification 
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM user_profile 
      WHERE user_profile.id = station_update_notification.user_id 
      AND user_profile.auth_user_id = auth.uid()
    )
  );

-- Remove the broad insert policy if it exists (we use SECURITY DEFINER instead)
DROP POLICY IF EXISTS "Service role can insert notifications" ON station_update_notification;

-- Function to create notifications when station_status is updated
CREATE OR REPLACE FUNCTION create_station_update_notifications()
RETURNS TRIGGER AS $$
BEGIN
  -- Create notifications for TRUSTED_REPORTER and ADMIN users who have notifications enabled
  -- Only create if no notification exists for this user+station in the last 2 minutes (deduplication)
  INSERT INTO station_update_notification (user_id, station_id, station_status_id)
  SELECT 
    up.id,
    NEW.station_id,
    NEW.id
  FROM user_profile up
  WHERE up.role IN ('TRUSTED_REPORTER', 'ADMIN')
    AND up.notifications_enabled = true
    AND NOT EXISTS (
      SELECT 1 FROM station_update_notification sun
      WHERE sun.user_id = up.id
        AND sun.station_id = NEW.station_id
        AND sun.created_at > NOW() - INTERVAL '2 minutes'
    );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on station_status updates (drop and recreate if exists)
DROP TRIGGER IF EXISTS station_status_update_notification_trigger ON station_status;
CREATE TRIGGER station_status_update_notification_trigger
  AFTER INSERT OR UPDATE ON station_status
  FOR EACH ROW
  EXECUTE FUNCTION create_station_update_notifications();

