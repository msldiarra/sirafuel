-- Allow users to update their own profile
CREATE POLICY "Users can update own profile" 
ON user_profile 
FOR UPDATE 
USING (auth_user_id = auth.uid())
WITH CHECK (auth_user_id = auth.uid());

