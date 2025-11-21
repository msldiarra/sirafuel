-- Add must_change_password field to user_profile
ALTER TABLE user_profile 
ADD COLUMN must_change_password BOOLEAN DEFAULT false;

-- Add index for faster lookups
CREATE INDEX idx_user_profile_must_change_password ON user_profile(must_change_password) WHERE must_change_password = true;

