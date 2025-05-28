/**
 * Get locations by category path
 * @param {string} categoryPath - The category path to filter by (e.g., '/Fable/Quests')
 * @returns {Promise<Array>} - Array of locations in the category
 */
export async function getLocationsByCategory(categoryPath) {
    try {
        // Ensure Prisma is initialized
        await initializePrisma();

        // Normalize the category path to ensure it has a leading slash
        const normalizedPath = categoryPath.startsWith('/') ? categoryPath : `/${categoryPath}`;

        // Find locations where:
        // 1. Type exactly matches the category path, OR
        // 2. Type starts with the category path followed by a slash (subcategories)
        const locations = await prisma.location.findMany({
            where: {
                OR: [
                    { type: normalizedPath },
                    { type: { startsWith: `${normalizedPath}/` } }
                ]
            }
        });

        return locations;
    } catch (error) {
        console.error('Error getting locations by category:', error);
        throw error;
    }
}

/**
 * Get category defaults
 * @returns {Promise<Array>} - Array of category defaults
 */
export async function getCategoryDefaults() {
    try {
        // Ensure Prisma is initialized
        await initializePrisma();

        // Get all category defaults
        const defaults = await prisma.categoryDefaults.findMany({
            orderBy: {
                sortOrder: 'asc'
            }
        });

        return defaults;
    } catch (error) {
        console.error('Error getting category defaults:', error);
        return []; // Return empty array on error
    }
}

/**
 * Save or update a category default
 * @param {Object} categoryDefault - The category default to save/update
 * @returns {Promise<Object>} - The saved category default
 */
export async function saveCategoryDefault(categoryDefault) {
    try {
        // Ensure Prisma is initialized
        await initializePrisma();

        // Normalize path to ensure it starts with a slash
        if (categoryDefault.path && !categoryDefault.path.startsWith('/')) {
            categoryDefault.path = `/${categoryDefault.path}`;
        }

        // Upsert the category default
        const result = await prisma.categoryDefaults.upsert({
            where: {
                path: categoryDefault.path
            },
            update: {
                visible: categoryDefault.visible !== undefined ? categoryDefault.visible : true,
                expanded: categoryDefault.expanded !== undefined ? categoryDefault.expanded : true,
                displayName: categoryDefault.displayName,
                iconPath: categoryDefault.iconPath,
                sortOrder: categoryDefault.sortOrder !== undefined ? categoryDefault.sortOrder : 0
            },
            create: {
                path: categoryDefault.path,
                visible: categoryDefault.visible !== undefined ? categoryDefault.visible : true,
                expanded: categoryDefault.expanded !== undefined ? categoryDefault.expanded : true,
                displayName: categoryDefault.displayName,
                iconPath: categoryDefault.iconPath,
                sortOrder: categoryDefault.sortOrder !== undefined ? categoryDefault.sortOrder : 0
            }
        });

        return result;
    } catch (error) {
        console.error('Error saving category default:', error);
        throw error;
    }
}

/**
 * Delete a category default
 * @param {string} path - The path of the category default to delete
 * @returns {Promise<void>}
 */
export async function deleteCategoryDefault(path) {
    try {
        // Ensure Prisma is initialized
        await initializePrisma();

        // Normalize path
        if (path && !path.startsWith('/')) {
            path = `/${path}`;
        }

        // Delete the category default
        await prisma.categoryDefaults.delete({
            where: {
                path
            }
        });
    } catch (error) {
        console.error('Error deleting category default:', error);
        throw error;
    }
}

/**
 * Helper function to normalize coordinates format
 * @param {any} coordinates - The coordinates to normalize
 * @returns {Array} - Normalized coordinates
 */
export function normalizeCoordinates(coordinates) {
    // Log coordinates for debugging
    console.log('Normalizing coordinates:', JSON.stringify(coordinates));

    if (!coordinates) {
        return [0, 0]; // Default if no coordinates provided
    }

    // If it's already a valid format, return it
    if (Array.isArray(coordinates)) {
        // Single coordinate pair [x, y]
        if (coordinates.length === 2 &&
            typeof coordinates[0] === 'number' &&
            typeof coordinates[1] === 'number') {
            console.log('Already normalized - single coordinate pair:', coordinates);
            return coordinates;
        }

        // Multiple coordinates [[x,y], [x,y], ...]
        if (coordinates.length > 0 && Array.isArray(coordinates[0])) {
            console.log('Multiple coordinates array, returning as is');
            return coordinates;
        }
    }

    // Try to convert from string or other format
    try {
        if (typeof coordinates === 'string') {
            const parsed = JSON.parse(coordinates);
            return normalizeCoordinates(parsed); // Recursive call with parsed data
        }
    } catch (e) {
        console.error('Error parsing coordinates string:', e);
    }

    // Fallback default
    console.log('Using fallback default coordinates');
    return [0, 0];
}

/**
 * Save a location
 * @param {Object} locationData - The location data to save
 * @returns {Promise<Object>} - The saved location
 */
export async function saveLocation(locationData) {
    try {
        // Ensure Prisma is initialized
        await initializePrisma();

        // Clean and normalize the data
        const data = { ...locationData };

        // Normalize coordinates if present
        if (data.coordinates) {
            data.coordinates = normalizeCoordinates(data.coordinates);
        } else {
            data.coordinates = [0, 0]; // Default coordinates
        }

        // Other normalization as needed
        // ...

        // Create the location
        const location = await prisma.location.create({
            data
        });

        return location;
    } catch (error) {
        console.error('Error saving location:', error);
        throw error;
    }
}

/**
 * Update a location
 * @param {string} id - The ID of the location to update
 * @param {Object} locationData - The location data to update
 * @returns {Promise<Object>} - The updated location
 */
export async function updateLocation(id, locationData) {
    try {
        // Ensure Prisma is initialized
        await initializePrisma();

        // Clone the data to avoid modifying the input
        const data = { ...locationData };

        // Normalize coordinates if present
        if (data.coordinates) {
            data.coordinates = normalizeCoordinates(data.coordinates);
        }

        // Update the location
        const location = await prisma.location.update({
            where: { id },
            data
        });

        return location;
    } catch (error) {
        console.error('Error updating location:', error);
        throw error;
    }
}

// ... existing code ...
