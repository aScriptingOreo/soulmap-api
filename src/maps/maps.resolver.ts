import { Resolver, Query, Args, Int } from '@nestjs/graphql';
import { Logger } from '@nestjs/common';
import { S3Service } from '../s3/s3.service';
import { 
  MapVersion, 
  MapGridInfo, 
  TileInfo, 
  MapTileRange, 
  TileBundle, 
  BundleInfo, 
  TileCoordinate, 
  TileBundleWithCoordinates, 
  BundleWithGrid,
  BundleRequest,
  S3TileFile
} from './map-version.entity';
import { BundleRequestInput } from './map-version.entity';

@Resolver()
export class MapsResolver {
  private readonly logger = new Logger(MapsResolver.name);

  constructor(private readonly s3Service: S3Service) {}

  @Query(() => [MapVersion])
  async mapVersions(): Promise<MapVersion[]> {
    const versions = await this.s3Service.getMapVersions();
    const latest = await this.s3Service.getLatestVersion();

    return versions.map(version => {
      const gridSize = Math.sqrt(version.tilecount);
      return {
        ...version,
        isLatest: version.version === latest,
        maxTileIndex: version.tilecount - 1,
        minTileIndex: 0,
        gridSize,
      };
    });
  }

  @Query(() => MapVersion)
  async latestMapVersion(): Promise<MapVersion> {
    const latest = await this.s3Service.getLatestVersion();
    const versions = await this.s3Service.getMapVersions();
    const latestVersion = versions.find(v => v.version === latest);

    if (!latestVersion) {
      throw new Error(`Latest version ${latest} not found`);
    }

    const gridSize = Math.sqrt(latestVersion.tilecount);
    return {
      ...latestVersion,
      isLatest: true,
      maxTileIndex: latestVersion.tilecount - 1,
      minTileIndex: 0,
      gridSize,
    };
  }

  @Query(() => MapVersion, { nullable: true })
  async mapVersion(@Args('version') version: string): Promise<MapVersion | null> {
    const versionInfo = await this.s3Service.getVersionInfo(version);
    if (!versionInfo) {
      return null;
    }

    const latest = await this.s3Service.getLatestVersion();
    const gridSize = Math.sqrt(versionInfo.tilecount);
    
    return {
      ...versionInfo,
      isLatest: versionInfo.version === latest,
      maxTileIndex: versionInfo.tilecount - 1,
      minTileIndex: 0,
      gridSize,
    };
  }

  @Query(() => MapGridInfo)
  async mapGridInfo(@Args('version') version: string): Promise<MapGridInfo> {
    return this.s3Service.getMapGridInfo(version);
  }

  @Query(() => TileCoordinate)
  async tileCoordinate(
    @Args('version') version: string,
    @Args('index', { type: () => Int }) index: number,
  ): Promise<TileCoordinate> {
    const versionInfo = await this.s3Service.getVersionInfo(version);
    if (!versionInfo) {
      throw new Error(`Version ${version} not found`);
    }

    const { x, y } = this.s3Service.getTileCoordinates(index, versionInfo.tilecount);
    return { x, y, index, version };
  }

  @Query(() => TileCoordinate)
  async tileAtCoordinate(
    @Args('version') version: string,
    @Args('x', { type: () => Int }) x: number,
    @Args('y', { type: () => Int }) y: number,
  ): Promise<TileCoordinate> {
    return this.s3Service.getTileAtCoordinate(version, x, y);
  }

  @Query(() => [TileCoordinate])
  async allTileCoordinates(@Args('version') version: string): Promise<TileCoordinate[]> {
    return this.s3Service.getAllTileCoordinates(version);
  }

  @Query(() => [TileCoordinate])
  async tilesByRegion(
    @Args('version') version: string,
    @Args('startX', { type: () => Int }) startX: number,
    @Args('startY', { type: () => Int }) startY: number,
    @Args('endX', { type: () => Int }) endX: number,
    @Args('endY', { type: () => Int }) endY: number,
  ): Promise<TileCoordinate[]> {
    return this.s3Service.getTilesByRegion(version, startX, startY, endX, endY);
  }

  // @Query(() => TileBundleWithCoordinates)
  // async mapTileBundleWithCoordinates(@Args('bundleRequest') bundleRequest: BundleRequestInput): Promise<TileBundleWithCoordinates> {
  //   const typedRequest: S3BundleRequest = {
  //     version: bundleRequest.version,
  //     tileIndices: bundleRequest.tileIndices,
  //     format: bundleRequest.format as 'base64' | 'buffer'
  //   };
  //   return this.s3Service.getTileBundleWithCoordinates(typedRequest);
  // }

  @Query(() => TileBundle)
  async mapTileBundle(
    @Args('bundleRequest') bundleRequest: BundleRequestInput,
  ): Promise<TileBundle> {
    // Convert the GraphQL input to S3Service format
    const s3Request = {
      version: bundleRequest.version,
      tileIndices: bundleRequest.tileIndices,
      format: bundleRequest.format || 'base64'
    };

    return this.s3Service.getTileBundle(s3Request);
  }

  @Query(() => [BundleWithGrid])
  async optimalTileBundlesWithGrid(
    @Args('version') version: string,
    @Args('chunkSize', { type: () => Int, defaultValue: 25 }) chunkSize: number,
  ): Promise<BundleWithGrid[]> {
    const bundles = await this.s3Service.getOptimalTileBundlesWithGrid(version, chunkSize);
    return bundles.map(bundle => ({
      version: bundle.version,
      tileIndices: bundle.tileIndices,
      format: bundle.format || 'base64',
      gridRegion: bundle.gridRegion
    }));
  }

  @Query(() => [BundleRequest])
  async optimalTileBundles(
    @Args('version') version: string,
    @Args('chunkSize', { type: () => Int, nullable: true }) chunkSize?: number,
  ): Promise<BundleRequest[]> {
    const s3Bundles = await this.s3Service.getOptimalTileBundles(version, chunkSize || 25);
    
    // Convert S3Service format to GraphQL format
    return s3Bundles.map(bundle => ({
      version: bundle.version,
      tileIndices: bundle.tileIndices,
      format: bundle.format || 'base64'
    }));
  }

  @Query(() => BundleInfo)
  async bundleInfo(@Args('bundleId') bundleId: string): Promise<BundleInfo> {
    const info = await this.s3Service.getBundleInfo(bundleId);
    return {
      bundleId,
      ...info
    };
  }

  @Query(() => String)
  async preloadMapVersion(
    @Args('version') version: string,
    @Args('chunkSize', { type: () => Int, defaultValue: 25 }) chunkSize: number,
  ): Promise<string> {
    // Fire and forget - don't wait for completion
    this.s3Service.preloadVersionTiles(version, chunkSize).catch(error => {
      // Log error but don't throw
      console.error(`Preload failed for version ${version}:`, error);
    });
    
    return `Preload started for version ${version} with chunk size ${chunkSize}`;
  }

  @Query(() => [S3TileFile])
  async tileFilesFromS3(@Args('version') version: string): Promise<S3TileFile[]> {
    try {
      return await this.s3Service.listTileFilesFromS3(version);
    } catch (error) {
      // Fallback: generate expected tile files based on version info
      this.logger.warn(`S3 list failed for ${version}, generating expected files`, error);
      return this.generateExpectedTileFiles(version);
    }
  }

  @Query(() => [S3TileFile])
  async listS3TileFiles(@Args('version') version: string): Promise<S3TileFile[]> {
    try {
      const simpleList = await this.s3Service.getSimpleTileFileList(version);
      
      // Convert simple list to S3TileFile format
      return simpleList.map((file, index) => ({
        filename: file.filename,
        index: parseInt(file.filename.replace('.webp', '')) || index,
        url: file.url,
        size: file.size,
        lastModified: new Date()
      }));
    } catch (error) {
      // Fallback: generate expected tile files
      this.logger.warn(`S3 simple list failed for ${version}, generating expected files`, error);
      return this.generateExpectedTileFiles(version);
    }
  }

  private async generateExpectedTileFiles(version: string): Promise<S3TileFile[]> {
    const versionInfo = await this.s3Service.getVersionInfo(version);
    if (!versionInfo) {
      throw new Error(`Version ${version} not found`);
    }

    const files: S3TileFile[] = [];
    const cleanPath = versionInfo.path.replace(/^\.\//, '').replace(/\/$/, '');

    for (let i = 0; i < versionInfo.tilecount; i++) {
      const filename = `${i}.webp`;
      const url = `${process.env.S3_ENDPOINT}/${process.env.S3_BUCKET}/Soulmap.V3/${cleanPath}/${filename}`;
      
      files.push({
        filename,
        index: i,
        url,
        size: 50000, // Estimated size
        lastModified: new Date()
      });
    }

    this.logger.log(`Generated ${files.length} expected tile files for ${version}`);
    return files;
  }

  @Query(() => String)
  async getAllTileFilesJson(): Promise<string> {
    const allFiles = await this.s3Service.listAllTileFiles();
    return JSON.stringify(allFiles, null, 2);
  }
}
