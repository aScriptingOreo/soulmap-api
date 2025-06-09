import { Resolver, Query, Args } from '@nestjs/graphql';
import { MapsService } from './maps.service';
import { MapVersion, S3TileFile, TileBundle, BundleRequestInput } from './map-version.entity';
import { S3Service } from '../s3/s3.service';

@Resolver(() => MapVersion)
export class MapsResolver {
  constructor(
    private readonly mapsService: MapsService,
    private readonly s3Service: S3Service
  ) {}

  @Query(() => [MapVersion])
  async mapVersions(): Promise<MapVersion[]> {
    return this.mapsService.getAllVersions();
  }

  @Query(() => MapVersion)
  async latestMapVersion(): Promise<MapVersion> {
    return this.mapsService.getLatestVersion();
  }

  @Query(() => MapVersion, { nullable: true })
  async mapVersion(@Args('version') version: string): Promise<MapVersion | null> {
    return this.mapsService.getVersion(version);
  }

  @Query(() => [S3TileFile], { name: 'tileFilesFromS3' })
  async getTileFiles(@Args('version') version: string) {
    return this.s3Service.getSimpleTileFileList(version);
  }

  @Query(() => TileBundle, { name: 'mapTileBundle' })
  async getTileBundle(
    @Args('bundleRequest', { type: () => BundleRequestInput }) bundleRequest: BundleRequestInput
  ) {
    return this.s3Service.getTileBundle(bundleRequest);
  }
}
