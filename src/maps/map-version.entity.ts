import { ObjectType, Field, Int, InputType } from '@nestjs/graphql';

@ObjectType()
export class MapGridInfo {
  @Field()
  version: string;

  @Field(() => Int, { description: 'Grid dimension (sqrt of tilecount)' })
  gridSize: number;

  @Field(() => Int)
  totalTiles: number;
}

@ObjectType()
export class MapVersion {
  @Field()
  version: string;

  @Field()
  name: string;

  @Field()
  path: string;

  @Field(() => Int)
  tilecount: number;

  @Field()
  isLatest: boolean;

  @Field(() => Int, { description: 'Maximum tile index (tilecount - 1)' })
  maxTileIndex: number;

  @Field(() => Int, { description: 'Minimum tile index (always 0)' })
  minTileIndex: number;

  @Field(() => Int, { description: 'Grid size (sqrt of tilecount)' })
  gridSize: number;
}

@ObjectType()
export class TileInfo {
  @Field()
  url: string;

  @Field()
  version: string;

  @Field()
  versionName: string;

  @Field(() => Int)
  index: number;

  @Field(() => Int)
  maxIndex: number;
}

@ObjectType()
export class MapTileRange {
  @Field()
  version: string;

  @Field()
  versionName: string;

  @Field(() => Int)
  minIndex: number;

  @Field(() => Int)
  maxIndex: number;

  @Field(() => Int)
  totalTiles: number;
}

@ObjectType()
export class TileBundleItem {
  @Field(() => Int)
  index: number;

  @Field()
  data: string; // base64 encoded

  @Field(() => Int)
  size: number;
}

@ObjectType()
export class TileBundle {
  @Field()
  version: string;

  @Field(() => [TileBundleItem])
  tiles: TileBundleItem[];

  @Field()
  bundleId: string;

  @Field(() => Int)
  totalSize: number;

  @Field()
  createdAt: Date;
}

@ObjectType()
export class BundleInfo {
  @Field()
  bundleId: string;

  @Field()
  exists: boolean;

  @Field(() => Int, { nullable: true })
  size?: number;

  @Field(() => Int, { nullable: true })
  tileCount?: number;
}

@InputType()
export class BundleRequestInput {
  @Field()
  version: string;

  @Field(() => [Int])
  tileIndices: number[];

  @Field({ defaultValue: 'base64' })
  format: 'base64' | 'buffer';
}

@ObjectType()
export class TileCoordinate {
  @Field(() => Int)
  x: number;

  @Field(() => Int)
  y: number;

  @Field(() => Int)
  index: number;

  @Field()
  version: string;
}

@ObjectType()
export class TileBundleWithCoordinates {
  @Field()
  version: string;

  @Field(() => [TileBundleItem])
  tiles: TileBundleItem[];

  @Field(() => [TileCoordinate])
  coordinates: TileCoordinate[];

  @Field()
  bundleId: string;

  @Field(() => Int)
  totalSize: number;

  @Field()
  createdAt: Date;
}

@ObjectType()
export class GridRegion {
  @Field(() => Int)
  startX: number;

  @Field(() => Int)
  startY: number;

  @Field(() => Int)
  endX: number;

  @Field(() => Int)
  endY: number;
}

@ObjectType()
export class BundleWithGrid {
  @Field()
  version: string;

  @Field(() => [Int])
  tileIndices: number[];

  @Field()
  format: string;

  @Field(() => GridRegion)
  gridRegion: GridRegion;
}

@ObjectType()
export class BundleRequest {
  @Field()
  version: string;

  @Field(() => [Int])
  tileIndices: number[];

  @Field()
  format: string;
}

@ObjectType()
export class S3TileFile {
  @Field()
  filename: string;

  @Field(() => Int)
  index: number;

  @Field()
  url: string;

  @Field(() => Int)
  size: number;

  @Field()
  lastModified: Date;
}
