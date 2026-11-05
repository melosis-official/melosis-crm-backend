ALTER TABLE `User`
  ADD COLUMN `role` ENUM('SUPERADMIN', 'USER') NOT NULL DEFAULT 'USER';

UPDATE `User`
SET `role` = 'SUPERADMIN'
WHERE `id` = (
  SELECT `id` FROM (
    SELECT `id` FROM `User` ORDER BY `createdAt` ASC, `id` ASC LIMIT 1
  ) AS `first_user`
);
