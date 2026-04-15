-- Migration: Add section column to candidates table
-- Compatible with MySQL versions that do not support "ADD COLUMN IF NOT EXISTS".

SET @has_section_col := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'candidates'
    AND COLUMN_NAME = 'section'
);

SET @sql := IF(
  @has_section_col = 0,
  'ALTER TABLE candidates ADD COLUMN section VARCHAR(50) COMMENT ''Section/Division (e.g., A, B)'' AFTER department',
  'SELECT ''candidates.section already exists'''
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
