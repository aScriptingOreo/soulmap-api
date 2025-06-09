-- This file only handles initial data seeding
-- TypeORM synchronize will handle schema creation automatically

-- Insert default categories with paths (will only insert if not exists)
INSERT INTO categories (id, "categoryName", "hiddenByDefault", path) VALUES 
('550e8400-e29b-41d4-a716-446655440000', 'Buildings', false, 'structures/buildings'),
('550e8400-e29b-41d4-a716-446655440001', 'Nature', false, 'environment/nature'),
('550e8400-e29b-41d4-a716-446655440002', 'NPCs', false, 'characters/npcs'),
('550e8400-e29b-41d4-a716-446655440003', 'Hidden Locations', true, 'secrets/hidden'),
('550e8400-e29b-41d4-a716-446655440004', 'Shops', false, 'structures/commercial'),
('550e8400-e29b-41d4-a716-446655440005', 'Dungeons', false, 'locations/dungeons'),
('550e8400-e29b-41d4-a716-446655440006', 'Quests', false, 'gameplay/quests')
ON CONFLICT (id) DO NOTHING;

-- Insert sample locations with versions
INSERT INTO locations (
    id,
    "locationName", 
    description, 
    coordinates, 
    "categoryId", 
    icon, 
    versions,
    "createdBy"
) VALUES 
(
    '660e8400-e29b-41d4-a716-446655440000',
    'Central Plaza', 
    'Main gathering area', 
    '[{"x": 100, "y": 150}, {"x": 105, "y": 155}]'::jsonb,
    '550e8400-e29b-41d4-a716-446655440000',
    '🏛️',
    '["P10", "P7", "latest"]'::jsonb,
    'system'
),
(
    '660e8400-e29b-41d4-a716-446655440001',
    'Secret Cave', 
    'Hidden entrance to underground network', 
    '[{"x": 250, "y": 75}]'::jsonb,
    '550e8400-e29b-41d4-a716-446655440003',
    '🕳️',
    '["P10", "latest"]'::jsonb,
    'system'
),
(
    '660e8400-e29b-41d4-a716-446655440002',
    'Old Marketplace', 
    'Abandoned trading post', 
    '[{"x": 180, "y": 200}]'::jsonb,
    '550e8400-e29b-41d4-a716-446655440000',
    '🏪',
    '["P7"]'::jsonb,
    'system'
)
ON CONFLICT (id) DO NOTHING;
