import { Injectable } from '@nestjs/common';
import { S3Service } from '../s3/s3.service';
import { MapVersion } from './map-version.entity'; // Use the GraphQL class

@Injectable()
export class MapsService {
  constructor(private readonly s3Service: S3Service) {}

  async getAllVersions(): Promise<MapVersion[]> {
    const s3Versions = await this.s3Service.getMapVersions();
    // Convert S3Service interface to GraphQL class
    return s3Versions.map(v => Object.assign(new MapVersion(), v));
  }

  async getLatestVersion(): Promise<MapVersion> {
    const latestVersionName = await this.s3Service.getLatestVersion();
    const versions = await this.s3Service.getMapVersions();
    const latestVersion = versions.find(v => v.version === latestVersionName); 
    
    if (!latestVersion) {
      throw new Error(`Latest version ${latestVersionName} not found`);
    }
    
    return Object.assign(new MapVersion(), latestVersion);
  }

  async getVersion(version: string): Promise<MapVersion | null> {
    const versionInfo = await this.s3Service.getVersionInfo(version);
    return versionInfo ? Object.assign(new MapVersion(), versionInfo) : null;
  }
}