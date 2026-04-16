-- Add the explicit role column required by the role-aware platform.
ALTER TABLE `users`
ADD COLUMN `role` ENUM('admin', 'operator', 'customer') NOT NULL DEFAULT 'customer'
AFTER `title`;

-- Backfill from the legacy title field so existing users retain intent.
UPDATE `users`
SET `role` = CASE
  WHEN LOWER(COALESCE(`title`, '')) LIKE '%admin%' THEN 'admin'
  WHEN LOWER(COALESCE(`title`, '')) LIKE '%operator%' THEN 'operator'
  WHEN LOWER(COALESCE(`title`, '')) LIKE '%manager%' THEN 'operator'
  WHEN LOWER(COALESCE(`title`, '')) LIKE '%staff%' THEN 'operator'
  ELSE 'customer'
END;
