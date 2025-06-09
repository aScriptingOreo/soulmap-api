import { Controller, Get, Post, Param, Res, ParseIntPipe, Body, Query, Logger } from '@nestjs/common';
import { Response } from 'express';
import { S3Service } from '../s3/s3.service';

@Controller('maps')
export class MapsController {
  private readonly logger = new Logger(MapsController.name);

  constructor(private readonly s3Service: S3Service) {}

  @Get('latest')
  async getLatestVersion() {
    const config = await this.s3Service.getMasterConfig();
    const latest = config.latest;
    const latestInfo = config.mapversions[latest];
    
    return { 
      version: latest, 
      latest,
      name: latestInfo?.name,
      path: latestInfo?.path,
      tilecount: latestInfo?.tilecount
    };
  }

  @Get('versions')
  async getAllVersions() {
    const versions = await this.s3Service.getMapVersions();
    const latest = await this.s3Service.getLatestVersion();

    return versions.map(version => ({
      ...version,
      isLatest: version.version === latest,
      maxTileIndex: version.tilecount - 1,
      minTileIndex: 0,
      tileRange: `0-${version.tilecount - 1}`,
    }));
  }

  @Get(':version/info')
  async getVersionInfo(@Param('version') version: string) {
    // Handle "latest" version
    if (version === 'latest') {
      return this.getLatestVersion();
    }

    const config = await this.s3Service.getMasterConfig();
    const versionInfo = config.mapversions[version];
    
    if (!versionInfo) {
      throw new Error(`Version ${version} not found`);
    }

    const cleanPath = versionInfo.path.replace(/^\.\//, '').replace(/\/$/, '');

    return {
      version,
      ...versionInfo,
      cleanPath,
      sampleTileUrl: `${process.env.S3_ENDPOINT}/${process.env.S3_BUCKET}/Soulmap.V3/${cleanPath}/0.webp`
    };
  }

  @Get(':version/tiles')
  async getTileFiles(@Param('version') version: string) {
    // Handle "latest" version
    if (version === 'latest') {
      const latest = await this.s3Service.getLatestVersion();
      version = latest;
    }

    // Skip S3 listing entirely and generate expected URLs
    const versionInfo = await this.s3Service.getVersionInfo(version);
    if (!versionInfo) {
      throw new Error(`Version ${version} not found`);
    }

    const cleanPath = versionInfo.path.replace(/^\.\//, '').replace(/\/$/, '');
    const files: Array<{ url: string; filename: string; index: number }> = [];
    
    for (let i = 0; i < versionInfo.tilecount; i++) {
      files.push({
        url: `${process.env.S3_ENDPOINT}/${process.env.S3_BUCKET}/Soulmap.V3/${cleanPath}/${i}.webp`,
        filename: `${i}.webp`,
        index: i
      });
    }
    
    this.logger.log(`Generated ${files.length} tile URLs for ${version}`);
    return files;
  }

  @Get(':version/tiles/:index')
  async getTile(
    @Param('version') version: string,
    @Param('index', ParseIntPipe) index: number,
    @Res() res: Response,
  ) {
    // Handle "latest" version
    if (version === 'latest') {
      const latest = await this.s3Service.getLatestVersion();
      version = latest;
    }

    try {
      const tileBuffer = await this.s3Service.getTileBuffer(version, index);
      
      res.set({
        'Content-Type': 'image/webp',
        'Cache-Control': 'public, max-age=86400',
        'Content-Length': tileBuffer.length.toString(),
        'X-Tile-Version': version,
        'X-Tile-Index': index.toString(),
      });
      
      res.send(tileBuffer);
    } catch (error) {
      if (error.message.includes('not found')) {
        res.status(404).json({ 
          error: 'Tile not found',
          version,
          index,
          message: error.message
        });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  @Post(':version/bundles')
  async downloadBundle(
    @Param('version') version: string,
    @Body() body: { tileIndices: number[]; format?: 'base64' | 'buffer' }
  ) {
    // Handle "latest" version
    if (version === 'latest') {
      const latest = await this.s3Service.getLatestVersion();
      version = latest;
    }

    this.logger.debug(`Downloading bundle for version ${version}, tiles: ${body.tileIndices.join(',')}`);
    
    const bundle = await this.s3Service.getTileBundle({
      version,
      tileIndices: body.tileIndices,
      format: body.format || 'base64'
    });

    this.logger.debug(`Bundle created: ${bundle.bundleId}, size: ${bundle.totalSize} bytes`);
    return bundle;
  }

  @Get(':version/bundles/optimal')
  async getOptimalBundles(
    @Param('version') version: string,
    @Query('chunkSize') chunkSize?: string
  ) {
    // Handle "latest" version
    if (version === 'latest') {
      const latest = await this.s3Service.getLatestVersion();
      version = latest;
    }

    const bundles = await this.s3Service.getOptimalTileBundles(
      version, 
      chunkSize ? parseInt(chunkSize) : 25
    );

    return bundles;
  }

  @Post(':version/preload')
  async preloadVersion(
    @Param('version') version: string,
    @Body() body: { chunkSize?: number } = {},
  ) {
    // Handle "latest" version
    if (version === 'latest') {
      const latest = await this.s3Service.getLatestVersion();
      version = latest;
    }

    const chunkSize = body.chunkSize || 25;
    
    // Start preloading (fire and forget)
    this.s3Service.preloadVersionTiles(version, chunkSize).catch(error => {
      console.error(`Preload failed for version ${version}:`, error);
    });
    
    return {
      message: `Preload started for version ${version}`,
      chunkSize,
      status: 'started'
    };
  }

  @Get('bundles/:bundleId/info')
  async getBundleInfo(@Param('bundleId') bundleId: string) {
    return this.s3Service.getBundleInfo(bundleId);
  }
}
