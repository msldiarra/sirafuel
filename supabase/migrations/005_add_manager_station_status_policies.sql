-- Add policies for STATION_MANAGER to update and insert station_status

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

