import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';
import * as crypto from 'crypto';

export interface MapVersion {
  version: string;
  name: string;
  path: string;
  tilecount: number;
}

export interface MasterConfig {
  latest: string;
  mapversions: Record<string, Omit<MapVersion, 'version'>>;
}

export interface TileBundle {
  version: string;
  tiles: Array<{
    index: number;
    data: string; // base64 encoded webp data
    size: number;
  }>;
  bundleId: string;
  totalSize: number;
  createdAt: Date;
}

export interface BundleRequest {
  version: string;
  tileIndices: number[];
  format?: string; // Make this optional to match usage
}

export interface TileCoordinate {
  x: number;
  y: number;
  index: number;
  version: string;
}

export interface MapGridInfo {
  version: string;
  gridSize: number; // sqrt(tilecount)
  totalTiles: number;
}

export interface S3TileFile {
  filename: string;
  index: number;
  url: string;
  size: number;
  lastModified: Date;
}

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly accessKey: string;
  private readonly secretKey: string;
  private readonly endpoint: string;
  private readonly bucketName: string;
  private readonly CACHE_TTL = 3600; // 1 hour cache
  private readonly BUNDLE_CACHE_TTL = 1800; // 30 minutes cache for bundles

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {
    this.accessKey = this.configService.get<string>('S3_ACCESS_KEY') || '';
    this.secretKey = this.configService.get<string>('S3_SECRET_KEY') || '';
    this.endpoint = this.configService.get<string>('S3_ENDPOINT', 'https://s3.7thseraph.org');
    this.bucketName = this.configService.get<string>('S3_BUCKET', 'wiki.avakot.org');

    this.logger.debug(`S3 Configuration - Endpoint: ${this.endpoint}, Bucket: ${this.bucketName}`);
  }

  private generateS3Signature(method: string, path: string, date: string, queryString: string = ''): string {
    if (!this.secretKey) {
      throw new Error('S3 secret key not configured');
    }
    
    // For list operations, we need to include the query string in the signature
    const canonicalString = queryString ? `${path}?${queryString}` : path;
    const stringToSign = `${method}\n\n\n${date}\n/${this.bucketName}${canonicalString}`;
    
    this.logger.debug(`String to sign: ${stringToSign}`);
    
    return crypto.createHmac('sha1', this.secretKey).update(stringToSign).digest('base64');
  }

  private async makeS3Request(path: string, params: URLSearchParams = new URLSearchParams()): Promise<Response> {
    if (!this.accessKey || !this.secretKey) {
      throw new Error('S3 credentials not configured');
    }

    const method = 'GET';
    const date = new Date().toUTCString();
    const queryString = params.toString();
    const signature = this.generateS3Signature(method, path, date, queryString);
    
    const url = `${this.endpoint}/${this.bucketName}${path}${queryString ? `?${queryString}` : ''}`;
    
    this.logger.debug(`S3 Request URL: ${url}`);
    this.logger.debug(`S3 Authorization: AWS ${this.accessKey}:${signature}`);
    
    return fetch(url, {
      method,
      headers: {
        'Date': date,
        'Authorization': `AWS ${this.accessKey}:${signature}`,
        'Accept': 'application/xml, text/xml, */*'
      }
    });
  }

  private parseYaml(yamlText: string): MasterConfig {
    // Simple YAML parser for our specific master.yml format
    this.logger.debug('Raw YAML content:', yamlText);
    
    const lines = yamlText.split('\n').filter(line => line && !line.startsWith('#'));
    
    const config: MasterConfig = {
      latest: '',
      mapversions: {}
    };

    let currentVersion: string | null = null;
    let inMapVersions = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      this.logger.debug(`Processing line ${i}: "${line}" (length: ${line.length})`);
      
      // Handle latest field
      if (line.trim().startsWith('latest:')) {
        config.latest = line.split(':')[1].trim();
        this.logger.debug(`Set latest to: ${config.latest}`);
        continue;
      }
      
      // Handle mapversions section start
      if (line.trim() === 'mapversions:') {
        inMapVersions = true;
        this.logger.debug('Entered mapversions section');
        continue;
      }
      
      if (inMapVersions) {
        // Debug the line structure
        this.logger.debug(`Line analysis - starts with 2 spaces: ${line.startsWith('  ')}, ends with colon: ${line.endsWith(':')}, trimmed: "${line.trim()}"`);
        
        // Check if this is a version key (exactly 2 spaces, then word, then colon)
        if (line.startsWith('  ') && line.trim().endsWith(':') && !line.startsWith('    ')) {
          currentVersion = line.trim().replace(':', '');
          config.mapversions[currentVersion] = {
            name: '',
            path: '',
            tilecount: 0
          };
          this.logger.debug(`Created version: ${currentVersion}`);
          continue;
        }
        
        // Handle properties under a version (exactly 4 spaces, then property)
        if (currentVersion && line.startsWith('    ') && line.includes(':')) {
          const trimmedLine = line.trim();
          const colonIndex = trimmedLine.indexOf(':');
          const key = trimmedLine.substring(0, colonIndex).trim();
          const value = trimmedLine.substring(colonIndex + 1).trim();
          
          this.logger.debug(`Property found - key: "${key}", value: "${value}"`);
          
          switch (key) {
            case 'name':
              config.mapversions[currentVersion].name = value;
              this.logger.debug(`Set ${currentVersion}.name = "${value}"`);
              break;
            case 'path':
              config.mapversions[currentVersion].path = value;
              this.logger.debug(`Set ${currentVersion}.path = "${value}"`);
              break;
            case 'tilecount':
              const tilecount = parseInt(value) || 0;
              config.mapversions[currentVersion].tilecount = tilecount;
              this.logger.debug(`Set ${currentVersion}.tilecount = ${tilecount}`);
              break;
            default:
              this.logger.debug(`Unknown property: ${key}`);
          }
        } else if (inMapVersions && line.trim() !== '') {
          this.logger.debug(`Unmatched line in mapversions section: "${line}"`);
        }
      }
    }

    this.logger.debug('Final parsed YAML config:', JSON.stringify(config, null, 2));
    return config;
  }

  async getMasterConfig(): Promise<MasterConfig> {
    const cacheKey = 'maps:master_config';
    
    try {
      // Check cache first
      const cached = await this.redisService.get<MasterConfig>(cacheKey);
      if (cached) {
        this.logger.debug('Using cached master config');
        return cached;
      }

      if (!this.accessKey || !this.secretKey) {
        this.logger.error('S3 credentials not configured - cannot load map data');
        throw new NotFoundException('S3 not configured');
      }

      const response = await this.makeS3Request('/Soulmap.V3/master.yml');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch master.yml: ${response.status} ${response.statusText}`);
      }

      const yamlContent = await response.text();
      const config = this.parseYaml(yamlContent);

      // Validate that we have actual data
      if (!config.latest || Object.keys(config.mapversions).length === 0) {
        throw new Error('Invalid master.yml structure');
      }

      // Cache the config
      await this.redisService.set(cacheKey, config, this.CACHE_TTL);

      this.logger.log(`Loaded master config with ${Object.keys(config.mapversions).length} versions, latest: ${config.latest}`);
      return config;

    } catch (error) {
      this.logger.error('Failed to load master config:', error);
      throw new NotFoundException('Failed to load map configuration from S3');
    }
  }

  async getMapVersions(): Promise<MapVersion[]> {
    const config = await this.getMasterConfig();
    
    return Object.entries(config.mapversions).map(([version, details]) => ({
      version,
      ...details,
    }));
  }

  async getLatestVersion(): Promise<string> {
    const config = await this.getMasterConfig();
    return config.latest;
  }

  async getTileUrl(version: string, tileIndex: number): Promise<string> {
    const config = await this.getMasterConfig();
    const versionInfo = config.mapversions[version];
    
    if (!versionInfo) {
      throw new NotFoundException(`Map version ${version} not found`);
    }

    // Tiles are numbered 0 to (tilecount-1)
    if (tileIndex < 0 || tileIndex >= versionInfo.tilecount) {
      throw new NotFoundException(
        `Tile ${tileIndex} not found for version ${version}. Valid range: 0-${versionInfo.tilecount - 1}`
      );
    }

    // Clean the path - remove ./ prefix and trailing slash
    let cleanPath = versionInfo.path.replace(/^\.\//, '').replace(/\/$/, '');
    
    // Use the cleaned path from master.yml
    const s3Key = `Soulmap.V3/${cleanPath}/${tileIndex}.webp`;
    return `${this.endpoint}/${this.bucketName}/${s3Key}`;
  }

  async getTileBuffer(version: string, tileIndex: number): Promise<Buffer> {
    const config = await this.getMasterConfig();
    const versionInfo = config.mapversions[version];
    
    if (!versionInfo) {
      throw new NotFoundException(`Map version ${version} not found`);
    }

    // Tiles are numbered 0 to (tilecount-1)
    if (tileIndex < 0 || tileIndex >= versionInfo.tilecount) {
      throw new NotFoundException(
        `Tile ${tileIndex} not found for version ${version}. Valid range: 0-${versionInfo.tilecount - 1}`
      );
    }

    // Clean the path - remove ./ prefix and trailing slash
    let cleanPath = versionInfo.path.replace(/^\.\//, '').replace(/\/$/, '');
    
    // Use the cleaned path from master.yml
    const s3Path = `/Soulmap.V3/${cleanPath}/${tileIndex}.webp`;
    
    try {
      const response = await this.makeS3Request(s3Path);
      
      if (!response.ok) {
        throw new Error(`Tile not found: ${response.status} ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      this.logger.error(`Failed to get tile ${tileIndex} for version ${version} (path: ${cleanPath})`, error);
      throw new NotFoundException(`Tile ${tileIndex} not found`);
    }
  }

  async getVersionInfo(version: string): Promise<MapVersion | null> {
    const versions = await this.getMapVersions();
    return versions.find(v => v.version === version) || null;
  }

  async refreshMasterConfig(): Promise<void> {
    this.logger.log('Refreshing master config...');
    await this.redisService.del('maps:master_config');
    await this.getMasterConfig();
  }

  async getTileBundle(bundleRequest: BundleRequest): Promise<TileBundle> {
    const { version, tileIndices, format = 'base64' } = bundleRequest;
    const bundleId = this.generateBundleId(version, tileIndices);
    const cacheKey = `maps:bundle:${bundleId}`;

    try {
      // Check cache first
      const cached = await this.redisService.get<TileBundle>(cacheKey);
      if (cached) {
        this.logger.debug(`Using cached bundle: ${bundleId}`);
        return cached;
      }

      const config = await this.getMasterConfig();
      const versionInfo = config.mapversions[version];
      
      if (!versionInfo) {
        throw new NotFoundException(`Map version ${version} not found`);
      }

      // Validate all tile indices
      for (const index of tileIndices) {
        if (index < 0 || index >= versionInfo.tilecount) {
          throw new NotFoundException(
            `Tile ${index} not found for version ${version}. Valid range: 0-${versionInfo.tilecount - 1}`
          );
        }
      }

      // Fetch all tiles concurrently
      const tilePromises = tileIndices.map(async (index) => {
        try {
          const buffer = await this.getTileBuffer(version, index);
          return {
            index,
            data: format === 'base64' ? buffer.toString('base64') : buffer.toString('hex'),
            size: buffer.length
          };
        } catch (error) {
          this.logger.warn(`Failed to fetch tile ${index} for bundle, skipping`, error);
          return null;
        }
      });

      const tileResults = (await Promise.all(tilePromises)).filter((tile): tile is NonNullable<typeof tile> => tile !== null);
      
      if (tileResults.length === 0) {
        throw new NotFoundException('No tiles could be fetched for bundle');
      }

      const bundle: TileBundle = {
        version,
        tiles: tileResults,
        bundleId,
        totalSize: tileResults.reduce((sum, tile) => sum + tile.size, 0),
        createdAt: new Date()
      };

      // Cache the bundle
      await this.redisService.set(cacheKey, bundle, this.BUNDLE_CACHE_TTL);

      this.logger.log(`Created bundle ${bundleId} with ${tileResults.length} tiles (${bundle.totalSize} bytes)`);
      return bundle;

    } catch (error) {
      this.logger.error(`Failed to create tile bundle: ${bundleId}`, error);
      throw error;
    }
  }

  async getTileBundleBuffer(bundleRequest: BundleRequest): Promise<Buffer> {
    const bundle = await this.getTileBundle({ ...bundleRequest, format: 'buffer' });
    
    // Create a simple binary format for the bundle
    // Format: [header][tile1][tile2]...[tileN]
    // Header: version(32) + tileCount(4) + [tileIndex(4) + tileSize(4)]...
    
    const headerBuffers: Buffer[] = [];
    
    // Version (32 bytes, padded)
    const versionBuffer = Buffer.alloc(32);
    versionBuffer.write(bundle.version, 0, 'utf8');
    headerBuffers.push(versionBuffer);
    
    // Tile count (4 bytes)
    const tileCountBuffer = Buffer.alloc(4);
    tileCountBuffer.writeUInt32BE(bundle.tiles.length, 0);
    headerBuffers.push(tileCountBuffer);
    
    // Tile index and size pairs
    const tileDataBuffers: Buffer[] = [];
    for (const tile of bundle.tiles) {
      // Tile index (4 bytes)
      const indexBuffer = Buffer.alloc(4);
      indexBuffer.writeUInt32BE(tile.index, 0);
      headerBuffers.push(indexBuffer);
      
      // Tile size (4 bytes)
      const sizeBuffer = Buffer.alloc(4);
      sizeBuffer.writeUInt32BE(tile.size, 0);
      headerBuffers.push(sizeBuffer);
      
      // Tile data
      const tileBuffer = Buffer.from(tile.data, 'hex');
      tileDataBuffers.push(tileBuffer);
    }
    
    return Buffer.concat([...headerBuffers, ...tileDataBuffers]);
  }

  /**
   * Get optimal tile bundles with consistent format
   */
  async getOptimalTileBundles(version: string, chunkSize: number = 25): Promise<BundleRequest[]> {
    const config = await this.getMasterConfig();
    const versionInfo = config.mapversions[version];
    
    if (!versionInfo) {
      throw new NotFoundException(`Map version ${version} not found`);
    }

    const bundles: BundleRequest[] = [];
    const totalTiles = versionInfo.tilecount;
    
    for (let i = 0; i < totalTiles; i += chunkSize) {
      const endIndex = Math.min(i + chunkSize, totalTiles);
      const tileIndices = Array.from({ length: endIndex - i }, (_, idx) => i + idx);
      
      bundles.push({
        version,
        tileIndices,
        format: 'base64' // Ensure format is always set
      });
    }
    
    return bundles;
  }

  async preloadVersionTiles(version: string, chunkSize: number = 25): Promise<void> {
    this.logger.log(`Preloading tiles for version ${version}...`);
    
    const bundles = await this.getOptimalTileBundles(version, chunkSize);
    
    // Process bundles in parallel but limit concurrency
    const CONCURRENCY_LIMIT = 3;
    for (let i = 0; i < bundles.length; i += CONCURRENCY_LIMIT) {
      const chunk = bundles.slice(i, i + CONCURRENCY_LIMIT);
      
      await Promise.all(
        chunk.map(async (bundleRequest) => {
          try {
            await this.getTileBundle(bundleRequest);
          } catch (error) {
            this.logger.warn(`Failed to preload bundle for indices ${bundleRequest.tileIndices}`, error);
          }
        })
      );
    }
    
    this.logger.log(`Completed preloading ${bundles.length} bundles for version ${version}`);
  }

  private generateBundleId(version: string, tileIndices: number[]): string {
    const sortedIndices = [...tileIndices].sort((a, b) => a - b);
    const bundleKey = `${version}:${sortedIndices.join(',')}`;
    return crypto.createHash('md5').update(bundleKey).digest('hex');
  }

  async getBundleInfo(bundleId: string): Promise<{ exists: boolean; size?: number; tileCount?: number }> {
    const cacheKey = `maps:bundle:${bundleId}`;
    const bundle = await this.redisService.get<TileBundle>(cacheKey);
    
    if (bundle) {
      return {
        exists: true,
        size: bundle.totalSize,
        tileCount: bundle.tiles.length
      };
    }
    
    return { exists: false };
  }

  async clearBundleCache(version?: string): Promise<void> {
    // This is a simplified approach - in production you might want a more sophisticated cache key pattern
    this.logger.log(`Clearing bundle cache${version ? ` for version ${version}` : ''}`);
    
    if (version) {
      // Clear specific version bundles (this would require a more complex Redis key pattern)
      this.logger.warn('Clearing all bundle cache due to version-specific clearing not implemented');
    }
    
    // For now, we'd need to implement a pattern-based deletion or use Redis SCAN
    // This is a placeholder - implement according to your Redis key patterns
  }

  getTileCoordinates(tileIndex: number, tilecount: number): { x: number; y: number } {
    const gridSize = Math.sqrt(tilecount);
    
    if (!Number.isInteger(gridSize)) {
      throw new Error(`Invalid tilecount ${tilecount} - must be a perfect square`);
    }

    const x = tileIndex % gridSize;
    const y = Math.floor(tileIndex / gridSize);

    return { x, y };
  }

  getTileIndex(x: number, y: number, gridSize: number): number {
    if (x < 0 || x >= gridSize || y < 0 || y >= gridSize) {
      throw new Error(`Coordinates (${x}, ${y}) out of bounds for grid size ${gridSize}`);
    }

    return y * gridSize + x;
  }

  async getMapGridInfo(version: string): Promise<MapGridInfo> {
    const config = await this.getMasterConfig();
    const versionInfo = config.mapversions[version];
    
    if (!versionInfo) {
      throw new NotFoundException(`Map version ${version} not found`);
    }

    const gridSize = Math.sqrt(versionInfo.tilecount);
    
    if (!Number.isInteger(gridSize)) {
      throw new Error(`Invalid tilecount ${versionInfo.tilecount} for version ${version} - must be a perfect square`);
    }

    return {
      version,
      gridSize,
      totalTiles: versionInfo.tilecount,
    };
  }

  async getTileAtCoordinate(version: string, x: number, y: number): Promise<TileCoordinate> {
    const gridInfo = await this.getMapGridInfo(version);
    const index = this.getTileIndex(x, y, gridInfo.gridSize);

    return {
      x,
      y,
      index,
      version,
    };
  }

  async getAllTileCoordinates(version: string): Promise<TileCoordinate[]> {
    const config = await this.getMasterConfig();
    const versionInfo = config.mapversions[version];
    
    if (!versionInfo) {
      throw new NotFoundException(`Map version ${version} not found`);
    }

    const coordinates: TileCoordinate[] = [];
    const gridSize = Math.sqrt(versionInfo.tilecount);

    for (let index = 0; index < versionInfo.tilecount; index++) {
      const { x, y } = this.getTileCoordinates(index, versionInfo.tilecount);
      coordinates.push({ x, y, index, version });
    }

    return coordinates;
  }

  async getTileBundleWithCoordinates(bundleRequest: BundleRequest): Promise<TileBundle & { coordinates: TileCoordinate[] }> {
    const bundle = await this.getTileBundle(bundleRequest);
    const config = await this.getMasterConfig();
    const versionInfo = config.mapversions[bundleRequest.version];
    
    const coordinates = bundleRequest.tileIndices.map(index => {
      const { x, y } = this.getTileCoordinates(index, versionInfo.tilecount);
      return { x, y, index, version: bundleRequest.version };
    });

    return {
      ...bundle,
      coordinates,
    };
  }

  async getOptimalTileBundlesWithGrid(version: string, chunkSize: number = 25): Promise<Array<BundleRequest & { gridRegion: { startX: number; startY: number; endX: number; endY: number } }>> {
    const gridInfo = await this.getMapGridInfo(version);
    const bundles = await this.getOptimalTileBundles(version, chunkSize);

    return bundles.map(bundle => {
      const coordinates = bundle.tileIndices.map(index => 
        this.getTileCoordinates(index, gridInfo.totalTiles)
      );

      const minX = Math.min(...coordinates.map(c => c.x));
      const maxX = Math.max(...coordinates.map(c => c.x));
      const minY = Math.min(...coordinates.map(c => c.y));
      const maxY = Math.max(...coordinates.map(c => c.y));

      return {
        ...bundle,
        format: bundle.format || 'base64' as const,
        gridRegion: {
          startX: minX,
          startY: minY,
          endX: maxX,
          endY: maxY,
        },
      };
    });
  }

  // Enhanced method to get tiles by grid region
  async getTilesByRegion(
    version: string, 
    startX: number, 
    startY: number, 
    endX: number, 
    endY: number
  ): Promise<TileCoordinate[]> {
    const gridInfo = await this.getMapGridInfo(version);
    
    // Validate bounds
    if (startX < 0 || startY < 0 || endX >= gridInfo.gridSize || endY >= gridInfo.gridSize) {
      throw new Error(`Region bounds out of grid range. Grid size: ${gridInfo.gridSize}x${gridInfo.gridSize}`);
    }

    const tiles: TileCoordinate[] = [];
    
    for (let y = startY; y <= endY; y++) {
      for (let x = startX; x <= endX; x++) {
        const index = this.getTileIndex(x, y, gridInfo.gridSize);
        tiles.push({ x, y, index, version });
      }
    }

    return tiles;
  }

  /**
   * List actual tile files from S3 bucket for a specific version
   */
  async listTileFilesFromS3(version: string): Promise<S3TileFile[]> {
    const config = await this.getMasterConfig();
    const versionInfo = config.mapversions[version];
    
    if (!versionInfo) {
      throw new NotFoundException(`Map version ${version} not found`);
    }

    if (!this.accessKey || !this.secretKey) {
      this.logger.error('S3 credentials not configured');
      throw new NotFoundException('S3 not configured');
    }

    try {
      // Clean the path - remove ./ prefix and trailing slash
      let cleanPath = versionInfo.path.replace(/^\.\//, '').replace(/\/$/, '');
      
      // List objects in the version directory
      const prefix = `Soulmap.V3/${cleanPath}/`;
      
      this.logger.debug(`Listing S3 objects with prefix: ${prefix}`);
      
      const params = new URLSearchParams({
        'list-type': '2',
        'prefix': prefix,
        'max-keys': '1000'
      });

      const response = await this.makeS3Request('/', params);
      
      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`S3 list error response: ${errorText}`);
        throw new Error(`Failed to list S3 objects: ${response.status} ${response.statusText}`);
      }

      const xmlText = await response.text();
      this.logger.debug(`S3 list response for ${prefix}:`, xmlText.substring(0, 500));

      // Parse the XML response to extract tile files
      const files: S3TileFile[] = [];
      const contentMatches = xmlText.match(/<Contents>[\s\S]*?<\/Contents>/g) || [];

      for (const contentMatch of contentMatches) {
        const keyMatch = contentMatch.match(/<Key>(.*?)<\/Key>/);
        const sizeMatch = contentMatch.match(/<Size>(.*?)<\/Size>/);
        const lastModifiedMatch = contentMatch.match(/<LastModified>(.*?)<\/LastModified>/);

        if (keyMatch) {
          const key = keyMatch[1];
          
          // Only include .webp files
          if (key.endsWith('.webp') && key.startsWith(prefix)) {
            const filename = key.replace(prefix, '');
            const indexMatch = filename.match(/^(\d+)\.webp$/);
            
            if (indexMatch) {
              const index = parseInt(indexMatch[1]);
              const url = `${this.endpoint}/${this.bucketName}/${key}`;
              const size = sizeMatch ? parseInt(sizeMatch[1]) : 0;
              const lastModified = lastModifiedMatch ? new Date(lastModifiedMatch[1]) : new Date();

              files.push({
                filename,
                index,
                url,
                size,
                lastModified
              });
            }
          }
        }
      }

      // Sort by index
      files.sort((a, b) => a.index - b.index);

      this.logger.log(`Found ${files.length} tile files for version ${version} in path ${cleanPath}`);
      return files;

    } catch (error) {
      this.logger.error(`Failed to list tile files for version ${version}:`, error);
      throw new NotFoundException(`Failed to list tile files for version ${version}`);
    }
  }

  /**
   * Get all tile files for all versions
   */
  async listAllTileFiles(): Promise<Record<string, S3TileFile[]>> {
    const config = await this.getMasterConfig();
    const result: Record<string, S3TileFile[]> = {};

    for (const version of Object.keys(config.mapversions)) {
      try {
        result[version] = await this.listTileFilesFromS3(version);
      } catch (error) {
        this.logger.warn(`Failed to list files for version ${version}:`, error);
        result[version] = [];
      }
    }

    return result;
  }

  /**
   * Simple method to get just filenames and URLs with proper typing
   */
  async getSimpleTileFileList(version: string): Promise<Array<{ filename: string; url: string; size: number }>> {
    const files = await this.listTileFilesFromS3(version);
    return files.map(file => ({
      filename: file.filename,
      url: file.url,
      size: file.size
    }));
  }

  // Basic S3 service implementation
  async getObject(key: string): Promise<any> {
    // Basic implementation
    return null;
  }

  async putObject(key: string, data: Buffer): Promise<void> {
    // Basic implementation
  }

  async listObjects(prefix?: string): Promise<any[]> {
    // Basic implementation
    return [];
  }
}
