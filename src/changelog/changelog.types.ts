import { registerEnumType } from '@nestjs/graphql';

export enum ChangeAction {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  TOGGLE = 'toggle',
  BATCH_UPDATE = 'batch_update',
}

export enum EntityType {
  LOCATION = 'location',
  CATEGORY = 'category',
}

registerEnumType(ChangeAction, {
  name: 'ChangeAction',
});

registerEnumType(EntityType, {
  name: 'EntityType',
});

export interface ChangelogData {
  action: ChangeAction;
  entityType: EntityType;
  entityId?: string;
  entityName?: string;
  changes?: Record<string, { from: any; to: any }>;
  metadata?: Record<string, any>;
  fullDataBefore?: any;
  fullDataAfter?: any;
  isRevertible?: boolean;
  revertedFromId?: number;
}

export interface LocationChangeData {
  id?: string;
  locationName?: string;
  category?: string;
  categoryId?: string;
  coordinates?: any;
  description?: string;
  icon?: string;
  iconColor?: string;
  iconSize?: number;
  mediaUrl?: string;
  noCluster?: boolean;
  radius?: number;
  versions?: string[];
}

export interface CategoryChangeData {
  id?: string;
  categoryName?: string;
  hiddenByDefault?: boolean;
  isDisabled?: boolean;
  path?: string;
}
