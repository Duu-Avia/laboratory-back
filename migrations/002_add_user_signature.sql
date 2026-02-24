-- Migration: 002_add_user_signature.sql
-- Add signature image storage to users table

IF NOT EXISTS (
  SELECT * FROM sys.columns
  WHERE object_id = OBJECT_ID('users') AND name = 'signature_image'
)
ALTER TABLE users ADD signature_image VARBINARY(MAX) NULL;
GO

IF NOT EXISTS (
  SELECT * FROM sys.columns
  WHERE object_id = OBJECT_ID('users') AND name = 'signature_uploaded_at'
)
ALTER TABLE users ADD signature_uploaded_at DATETIME NULL;
GO
