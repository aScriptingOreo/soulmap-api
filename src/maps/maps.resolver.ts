import { Resolver, Query, Args } from '@nestjs/graphql';
import { Logger } from '@nestjs/common';
import { S3Service } from '../s3/s3.service';
import { MapVersion, S3TileFile, TileBundle } from './map-version.entity';
import { BundleRequestInput } from './map-version.entity';

@Resolver()
export class MapsResolver {
  private readonly logger = new Logger(MapsResolver.name);

  constructor(private readonly s3Service: S3Service) {}

  @Query(() => [MapVersion])
  async mapVersions(): Promise<MapVersion[]> {
    const versions = await this.s3Service.getMapVersions();
    const latest = await this.s3Service.getLatestVersion();

    return versions.map(version => ({
      ...version,
      isLatest: version.version === latest,
      maxTileIndex: version.tilecount - 1,
      minTileIndex: 0,
      gridSize: Math.sqrt(version.tilecount),
    }));
  }

  @Query(() => MapVersion)
  async latestMapVersion(): Promise<MapVersion> {
    const latest = await this.s3Service.getLatestVersion();
    const versions = await this.s3Service.getMapVersions();
    const latestVersion = versions.find(v => v.version === latest);

    if (!latestVersion) {
      throw new Error(`Latest version ${latest} not found`);
    }

    return {
      ...latestVersion,
      isLatest: true,
      maxTileIndex: latestVersion.tilecount - 1,
      minTileIndex: 0,
      gridSize: Math.sqrt(latestVersion.tilecount),
    };
  }

  @Query(() => MapVersion, { nullable: true })
  async mapVersion(@Args('version') version: string): Promise<MapVersion | null> {
    // Handle "latest" version
    if (version === 'latest') {
      return this.latestMapVersion();
    }

    const versionInfo = await this.s3Service.getVersionInfo(version);
    if (!versionInfo) {
      return null;
    }

    const latest = await this.s3Service.getLatestVersion();
    return {
      ...versionInfo,
      isLatest: versionInfo.version === latest,
      maxTileIndex: versionInfo.tilecount - 1,
      minTileIndex: 0,
      gridSize: Math.sqrt(versionInfo.tilecount),
    };
  }

  @Query(() => [S3TileFile])
  async tileFilesFromS3(@Args('version') version: string): Promise<S3TileFile[]> {
    // Handle "latest" version
    if (version === 'latest') {
      const latest = await this.s3Service.getLatestVersion();
      version = latest;
    }

    // Skip S3 listing entirely - just generate expected files
    this.logger.debug(`Generating expected tile files for ${version}`);
    return this.generateExpectedTileFiles(version);
  }

  @Query(() => TileBundle)
  async mapTileBundle(@Args('bundleRequest') bundleRequest: BundleRequestInput): Promise<TileBundle> {
    let version = bundleRequest.version;
    
    // Handle "latest" version
    if (version === 'latest') {
      const latest = await this.s3Service.getLatestVersion();
      version = latest;
    }

    const s3Request = {
      version,
      tileIndices: bundleRequest.tileIndices,
      format: bundleRequest.format || 'base64'
    };

    return this.s3Service.getTileBundle(s3Request);
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
        size: 50000,
        lastModified: new Date()
      });
    }

    return files;
  }
}
