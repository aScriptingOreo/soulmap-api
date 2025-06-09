import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';
import * as crypto from 'crypto';

export interface IconItem {
  id: string;
  name: string;
  path: string;
  category: string;
  url: string;
  size?: number;
  type?: 'file' | 'directory'; // Add this for compatibility
  createdAt: Date;
}

@Injectable()
export class IconsService implements OnModuleInit {
  private readonly logger = new Logger(IconsService.name);
  private readonly accessKey: string;
  private readonly secretKey: string;
  private readonly endpoint: string;
  private readonly bucketName: string;
  private readonly iconsPrefix = 'soulmap.avakot.org/Icons';
  private readonly CACHE_TTL = 3600; // 1 hour cache
  private readonly INDEX_CACHE_KEY = 'icons:full_index';

  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {
    this.accessKey = this.configService.get<string>('S3_ACCESS_KEY') || '';
    this.secretKey = this.configService.get<string>('S3_SECRET_KEY') || '';
    this.endpoint = this.configService.get<string>('S3_ENDPOINT', 'https://s3.7thseraph.org');
    this.bucketName = this.configService.get<string>('S3_BUCKET', 'wiki.avakot.org');

    this.logger.debug(`S3 Configuration - Endpoint: ${this.endpoint}, Bucket: ${this.bucketName}`);
    this.logger.debug(`S3 Access Key configured: ${!!this.accessKey}`);
    this.logger.debug(`S3 Secret Key configured: ${!!this.secretKey}`);
  }

  async onModuleInit() {
    // Index all icons on startup
    this.logger.log('Indexing all icons from S3...');
    await this.indexAllIcons();
  }

  private generateS3Signature(method: string, path: string, date: string): string {
    if (!this.secretKey) {
      throw new Error('S3 secret key not configured');
    }
    
    const stringToSign = `${method}\n\n\n${date}\n/${this.bucketName}${path}`;
    return crypto.createHmac('sha1', this.secretKey).update(stringToSign).digest('base64');
  }

  private async makeS3Request(path: string, params: URLSearchParams = new URLSearchParams()): Promise<Response> {
    if (!this.accessKey || !this.secretKey) {
      throw new Error('S3 credentials not configured');
    }

    const method = 'GET';
    const date = new Date().toUTCString();
    const signature = this.generateS3Signature(method, path, date);
    
    const url = `${this.endpoint}/${this.bucketName}${path}?${params.toString()}`;
    
    return fetch(url, {
      method,
      headers: {
        'Date': date,
        'Authorization': `AWS ${this.accessKey}:${signature}`,
        'Accept': 'application/xml, text/xml, */*'
      }
    });
  }

  async indexAllIcons(): Promise<IconItem[]> {
    try {
      // Check cache first
      const cached = await this.redisService.get<IconItem[]>(this.INDEX_CACHE_KEY);
      if (cached) {
        this.logger.debug('Using cached icon index');
        return cached;
      }

      if (!this.accessKey || !this.secretKey) {
        this.logger.warn('S3 not configured, using mock icons');
        return this.getMockIcons();
      }

      const allIcons: IconItem[] = [];
      await this.indexDirectory('', allIcons);

      // Cache the full index
      await this.redisService.set(this.INDEX_CACHE_KEY, allIcons, this.CACHE_TTL * 6); // 6 hours cache

      this.logger.log(`Indexed ${allIcons.length} icons from S3`);
      return allIcons;
    } catch (error) {
      this.logger.error('Failed to index icons:', error);
      return this.getMockIcons();
    }
  }

  private async indexDirectory(relativePath: string, allIcons: IconItem[]): Promise<void> {
    const prefix = relativePath ? `${this.iconsPrefix}/${relativePath}` : `${this.iconsPrefix}/`;
    const params = new URLSearchParams({
      'list-type': '2',
      'prefix': prefix
    });

    this.logger.debug(`Indexing directory: ${prefix}`);

    const response = await this.makeS3Request('/', params);
    if (!response.ok) {
      throw new Error(`S3 request failed: ${response.status} ${response.statusText}`);
    }

    const xmlText = await response.text();
    
    // Extract all Contents (files) - we want ALL SVG files recursively
    const contentMatches = xmlText.match(/<Contents>[\s\S]*?<\/Contents>/g) || [];
    
    for (const contentMatch of contentMatches) {
      const keyContent = contentMatch.match(/<Key>(.*?)<\/Key>/);
      const sizeContent = contentMatch.match(/<Size>(.*?)<\/Size>/);
      const lastModifiedContent = contentMatch.match(/<LastModified>(.*?)<\/LastModified>/);
      
      if (keyContent) {
        const key = keyContent[1];
        
        if (key && key.endsWith('.svg') && key.startsWith(`${this.iconsPrefix}/`)) {
          const relativePath = key.replace(`${this.iconsPrefix}/`, '');
          const fileName = relativePath.split('/').pop()?.replace('.svg', '') || '';
          const category = this.extractCategory(relativePath);
          
          // Generate direct S3 URL instead of API proxy URL
          const directS3Url = `${this.endpoint}/${this.bucketName}/${key}`;
          
          const iconItem: IconItem = {
            id: this.generateIconId(key),
            name: fileName,
            path: relativePath,
            category,
            url: directS3Url, // Direct S3 URL!
            size: sizeContent ? parseInt(sizeContent[1]) : undefined,
            createdAt: lastModifiedContent ? new Date(lastModifiedContent[1]) : new Date()
          };
          
          allIcons.push(iconItem);
        }
      }
    }
  }

  private extractCategory(relativePath: string): string {
    const parts = relativePath.split('/');
    if (parts.length > 1) {
      return parts[0]; // First directory is the category
    }
    return 'root';
  }

  private generateIconId(s3Key: string): string {
    return crypto.createHash('md5').update(s3Key).digest('hex');
  }

  private getMockIcons(): IconItem[] {
    return [
      {
        id: 'mock1',
        name: 'castle',
        path: 'buildings/castle.svg',
        category: 'buildings',
        url: `${this.endpoint}/${this.bucketName}/${this.iconsPrefix}/buildings/castle.svg`, // Direct S3 URL
        createdAt: new Date()
      },
      {
        id: 'mock2',
        name: 'tree',
        path: 'nature/tree.svg',
        category: 'nature',
        url: `${this.endpoint}/${this.bucketName}/${this.iconsPrefix}/nature/tree.svg`, // Direct S3 URL
        createdAt: new Date()
      },
      {
        id: 'mock3',
        name: 'warrior',
        path: 'characters/warrior.svg',
        category: 'characters',
        url: `${this.endpoint}/${this.bucketName}/${this.iconsPrefix}/characters/warrior.svg`, // Direct S3 URL
        createdAt: new Date()
      }
    ];
  }

  // GraphQL API methods
  async getAllIcons(): Promise<IconItem[]> {
    return this.indexAllIcons();
  }

  async getIconsByCategory(category: string): Promise<IconItem[]> {
    const allIcons = await this.getAllIcons();
    return allIcons.filter(icon => icon.category === category);
  }

  async searchIcons(query: string): Promise<IconItem[]> {
    const allIcons = await this.getAllIcons();
    const lowerQuery = query.toLowerCase();
    
    return allIcons.filter(icon => 
      icon.name.toLowerCase().includes(lowerQuery) ||
      icon.category.toLowerCase().includes(lowerQuery) ||
      icon.path.toLowerCase().includes(lowerQuery)
    );
  }

  async getIconById(id: string): Promise<IconItem | null> {
    const allIcons = await this.getAllIcons();
    return allIcons.find(icon => icon.id === id) || null;
  }

  async getCategories(): Promise<string[]> {
    const allIcons = await this.getAllIcons();
    const categories = new Set(allIcons.map(icon => icon.category));
    return Array.from(categories).sort();
  }

  async refreshIndex(): Promise<void> {
    this.logger.log('Refreshing icon index...');
    await this.redisService.del(this.INDEX_CACHE_KEY);
    await this.indexAllIcons();
  }

  // Legacy methods for existing REST API
  async getIconContent(iconPath: string): Promise<{ content: string; contentType: string }> {
    const cacheKey = `icons:content:${iconPath}`;
    
    const cached = await this.redisService.get<{ content: string; contentType: string }>(cacheKey);
    if (cached) {
      return cached;
    }

    if (!this.accessKey || !this.secretKey) {
      return this.getFallbackSvg(iconPath);
    }

    try {
      const s3Path = `/${this.iconsPrefix}/${iconPath}`;
      const response = await this.makeS3Request(s3Path);
      
      if (!response.ok) {
        throw new Error(`Icon not found: ${response.status} ${response.statusText}`);
      }
      
      const content = await response.text();
      const contentType = response.headers.get('content-type') || 'image/svg+xml';
      
      const result = { content, contentType };
      await this.redisService.set(cacheKey, result, this.CACHE_TTL * 24);
      
      return result;
    } catch (error) {
      this.logger.error(`Failed to get icon content for ${iconPath}:`, error);
      return this.getFallbackSvg(iconPath);
    }
  }

  private getFallbackSvg(iconPath: string): { content: string; contentType: string } {
    const fallbackSvg = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
        <path d="M12 6v6l4 2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <text x="12" y="18" text-anchor="middle" font-size="4" fill="currentColor">Icon</text>
      </svg>
    `;
    
    return {
      content: fallbackSvg.trim(),
      contentType: 'image/svg+xml'
    };
  }

  async uploadIcon(
    fileName: string,
    category: string,
    fileBuffer: Buffer,
    uploadedBy: string
  ): Promise<{ name: string; path: string; url: string; category: string }> {
    if (!this.accessKey || !this.secretKey) {
      throw new Error('S3 credentials not configured');
    }

    try {
      // Create the S3 path
      const s3Path = `/${this.iconsPrefix}/${category}/${fileName}`;
      
      this.logger.debug(`Uploading icon to S3: ${s3Path}`);
      
      // Create headers for PUT request
      const method = 'PUT';
      const date = new Date().toUTCString();
      const contentType = 'image/svg+xml';
      
      // Create signature for PUT request with content type
      const stringToSign = `${method}\n\n${contentType}\n${date}\n/${this.bucketName}${s3Path}`;
      const signature = crypto.createHmac('sha1', this.secretKey).update(stringToSign).digest('base64');
      
      const url = `${this.endpoint}/${this.bucketName}${s3Path}`;
      
      // Upload to S3
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Date': date,
          'Authorization': `AWS ${this.accessKey}:${signature}`,
          'Content-Type': contentType,
          'Content-Length': fileBuffer.length.toString(),
          'x-amz-meta-uploaded-by': uploadedBy,
          'x-amz-meta-upload-date': new Date().toISOString()
        },
        body: fileBuffer
      });

      if (!response.ok) {
        throw new Error(`S3 upload failed: ${response.status} ${response.statusText}`);
      }

      // Clear the cache to include the new icon
      await this.redisService.del(this.INDEX_CACHE_KEY);
      
      // Return the new icon info
      const relativePath = `${category}/${fileName}`;
      const directS3Url = `${this.endpoint}/${this.bucketName}/${this.iconsPrefix}/${relativePath}`;
      
      this.logger.log(`Successfully uploaded icon: ${fileName} by ${uploadedBy}`);
      
      return {
        name: fileName.replace('.svg', ''),
        path: relativePath,
        url: directS3Url,
        category
      };

    } catch (error) {
      this.logger.error(`Failed to upload icon ${fileName}:`, error);
      throw error;
    }
  }
}
