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

-- Categories table
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "categoryName" VARCHAR(255) NOT NULL UNIQUE,
    "hiddenByDefault" BOOLEAN DEFAULT false,
    path VARCHAR(500), -- Add the path field for category organization
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Locations table with version support
CREATE TABLE locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "locationName" VARCHAR(255) NOT NULL,
    description TEXT,
    coordinates JSONB, -- Array of {x, y} coordinate objects
    "categoryId" UUID REFERENCES categories(id) ON DELETE SET NULL,
    icon VARCHAR(500),
    "iconSize" DECIMAL(3,2) DEFAULT 1.0,
    "mediaUrl" VARCHAR(1000),
    "iconColor" VARCHAR(7) DEFAULT '#000000',
    radius DECIMAL(10,2) DEFAULT 0,
    "noCluster" BOOLEAN DEFAULT false,
    versions JSONB DEFAULT '[]'::jsonb, -- New: Array of version strings ['P10', 'P7', 'latest']
    "createdBy" VARCHAR(255),
    "lastUpdateBy" VARCHAR(255),
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for version queries
CREATE INDEX idx_locations_versions ON locations USING GIN (versions);
CREATE INDEX idx_categories_path ON categories(path);

-- Changelog table for tracking changes
CREATE TABLE changelog (
    id SERIAL PRIMARY KEY,
    "changeType" VARCHAR(255) NOT NULL,
    action VARCHAR(50) NOT NULL,
    "entityType" VARCHAR(50) NOT NULL,
    "entityId" VARCHAR(255),
    "entityName" VARCHAR(255),
    "changeData" JSONB,
    "userId" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for changelog queries
CREATE INDEX idx_changelog_entity ON changelog("entityType", "entityId");
CREATE INDEX idx_changelog_user ON changelog("userId");
CREATE INDEX idx_changelog_created_at ON changelog("createdAt");

-- Sample data with paths
INSERT INTO categories (id, "categoryName", "hiddenByDefault", path) VALUES 
('550e8400-e29b-41d4-a716-446655440000', 'Buildings', false, 'structures/buildings'),
('550e8400-e29b-41d4-a716-446655440001', 'Nature', false, 'environment/nature'),
('550e8400-e29b-41d4-a716-446655440002', 'NPCs', false, 'characters/npcs'),
('550e8400-e29b-41d4-a716-446655440003', 'Hidden Locations', true, 'secrets/hidden');

INSERT INTO locations (
    "locationName", 
    description, 
    coordinates, 
    "categoryId", 
    icon, 
    versions,
    "createdBy"
) VALUES 
(
    'Central Plaza', 
    'Main gathering area', 
    '[{"x": 100, "y": 150}, {"x": 105, "y": 155}]'::jsonb,
    '550e8400-e29b-41d4-a716-446655440000',
    '🏛️',
    '["P10", "P7", "latest"]'::jsonb,
    'system'
),
(
    'Secret Cave', 
    'Hidden entrance to underground network', 
    '[{"x": 250, "y": 75}]'::jsonb,
    '550e8400-e29b-41d4-a716-446655440003',
    '🕳️',
    '["P10", "latest"]'::jsonb,
    'system'
),
(
    'Old Marketplace', 
    'Abandoned trading post', 
    '[{"x": 180, "y": 200}]'::jsonb,
    '550e8400-e29b-41d4-a716-446655440000',
    '🏪',
    '["P7"]'::jsonb,
    'system'
);
