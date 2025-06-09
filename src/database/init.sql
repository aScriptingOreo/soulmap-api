CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create categories table first (if using synchronize=false)
-- CREATE TABLE IF NOT EXISTS categories (
--   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   "categoryName" TEXT UNIQUE NOT NULL,
--   "hiddenByDefault" BOOLEAN DEFAULT false
-- );

-- Ensure we have the default category for locations
INSERT INTO categories (id, "categoryName", "hiddenByDefault") 
VALUES (gen_random_uuid(), '!NOCAT', true)
ON CONFLICT ("categoryName") DO NOTHING;
