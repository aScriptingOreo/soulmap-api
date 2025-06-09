import { Controller, Get, Post, Param, Query, Res, Logger, HttpException, HttpStatus, UseInterceptors, UploadedFile, UseGuards, Body } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { IconsService, IconItem } from './icons.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

// Simplified interface for REST API responses (what IconPicker expects)
interface IconPickerItem {
  name: string;
  path: string;
  type: 'file' | 'directory';
  url?: string;
}

interface IconListResponse {
  success: boolean;
  path: string;
  items: IconPickerItem[];
}

interface IconSearchResponse {
  success: boolean;
  query: string;
  count: number;
  items: IconPickerItem[];
}

interface IconUrlResponse {
  success: boolean;
  iconPath: string;
  url: string;
}

interface S3TestResult {
  url: string;
  status?: number;
  statusText?: string;
  headers?: { [key: string]: string };
  bodyPreview?: string;
  error?: string;
}

interface S3TestResponse {
  success: boolean;
  results: S3TestResult[];
  error?: string;
}

interface UploadResponse {
  success: boolean;
  message: string;
  icon?: {
    name: string;
    path: string;
    url: string;
    category: string;
  };
  error?: string;
}

@Controller('icons')
export class IconsController {
  private readonly logger = new Logger(IconsController.name);

  constructor(private readonly iconsService: IconsService) {}

  @Get('test-s3')
  async testS3Connection(): Promise<S3TestResponse> {
    try {
      this.logger.debug('Testing S3 connection...');
      
      // Test basic bucket access
      const testResult = await this.iconsService.getAllIcons();
      
      return {
        success: true,
        results: [{
          url: 'S3 SDK Connection',
          status: 200,
          statusText: 'OK',
          bodyPreview: `Found ${testResult.length} items in S3 bucket`,
        }]
      };
    } catch (error) {
      this.logger.error('S3 test failed:', error);
      return {
        success: false,
        results: [{
          url: 'S3 SDK Connection',
          error: error.message
        }]
      };
    }
  }

  @Get('list')
  async listIcons(@Query('path') path: string = ''): Promise<IconListResponse> {
    try {
      // Get all icons and filter by category (path)
      const allIcons = await this.iconsService.getAllIcons();
      
      let items: IconPickerItem[];
      
      if (!path || path === '') {
        // Root level - group by categories and show directories + root files
        const categories = await this.iconsService.getCategories();
        const rootFiles = allIcons.filter(icon => icon.category === 'root');
        
        // Create directory items for each category
        const directories: IconPickerItem[] = categories
          .filter(cat => cat !== 'root')
          .map(category => ({
            name: category,
            path: `${category}/`,
            type: 'directory' as const,
            url: ''
          }));
        
        // Convert root files to the expected format
        const files: IconPickerItem[] = rootFiles.map(icon => ({
          name: icon.name,
          path: icon.path,
          type: 'file' as const,
          url: icon.url
        }));
        
        items = [...directories, ...files];
      } else {
        // Category level - show files in that category
        const categoryName = path.replace(/\/$/, '');
        const categoryIcons = await this.iconsService.getIconsByCategory(categoryName);
        
        items = categoryIcons.map(icon => ({
          name: icon.name,
          path: icon.path,
          type: 'file' as const,
          url: icon.url
        }));
      }
      
      return {
        success: true,
        path,
        items
      };
    } catch (error) {
      this.logger.error(`Failed to list icons for path ${path}:`, error);
      throw new HttpException(
        'Failed to list icons',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('search')
  async searchIcons(@Query('q') query: string): Promise<IconSearchResponse> {
    if (!query || query.trim().length < 2) {
      throw new HttpException(
        'Search query must be at least 2 characters',
        HttpStatus.BAD_REQUEST
      );
    }

    try {
      const icons = await this.iconsService.searchIcons(query.trim());
      
      // Convert to the format expected by IconPicker
      const items: IconPickerItem[] = icons.map(icon => ({
        name: icon.name,
        path: icon.path,
        type: 'file' as const,
        url: icon.url
      }));
      
      return {
        success: true,
        query,
        count: items.length,
        items
      };
    } catch (error) {
      this.logger.error(`Failed to search icons for query ${query}:`, error);
      throw new HttpException(
        'Failed to search icons',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('content/*')
  async getIconContent(@Param('0') iconPath: string, @Res() res: Response): Promise<void> {
    try {
      // Decode the path parameter
      const decodedPath = decodeURIComponent(iconPath);
      
      this.logger.debug(`Serving icon content for: ${decodedPath}`);
      
      const { content, contentType } = await this.iconsService.getIconContent(decodedPath);
      
      // Set appropriate headers
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
      res.setHeader('Access-Control-Allow-Origin', '*');
      
      res.send(content);
    } catch (error) {
      this.logger.error(`Failed to serve icon content for ${iconPath}:`, error);
      res.status(404).json({
        success: false,
        message: 'Icon not found'
      });
    }
  }

  @Get('url/:iconPath')
  getIconUrl(@Param('iconPath') iconPath: string): IconUrlResponse {
    const url = `/api/icons/content/${encodeURIComponent(iconPath)}`;
    return {
      success: true,
      iconPath,
      url
    };
  }

  @Get('refresh')
  async refreshIndex() {
    try {
      await this.iconsService.refreshIndex();
      return {
        success: true,
        message: 'Icon index refreshed successfully'
      };
    } catch (error) {
      this.logger.error('Failed to refresh icon index:', error);
      throw new HttpException(
        'Failed to refresh icon index',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('upload')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  async uploadIcon(
    @UploadedFile() file: any, // Use generic type to avoid Multer dependency issues
    @Body('category') category: string = 'user-uploads',
    @Body('name') customName: string,
    @CurrentUser() user: any,
    @Res() res: Response
  ): Promise<void> {
    try {
      if (!file) {
        throw new HttpException('No file uploaded', HttpStatus.BAD_REQUEST);
      }

      // Validate that we have the expected file properties
      if (!file.buffer || !file.originalname || !file.mimetype || typeof file.size !== 'number') {
        throw new HttpException('Invalid file upload', HttpStatus.BAD_REQUEST);
      }

      // Validate file type
      if (file.mimetype !== 'image/svg+xml' && !file.originalname.toLowerCase().endsWith('.svg')) {
        throw new HttpException('Only SVG files are allowed', HttpStatus.BAD_REQUEST);
      }

      // Validate file size (max 1MB)
      if (file.size > 1024 * 1024) {
        throw new HttpException('File size must be less than 1MB', HttpStatus.BAD_REQUEST);
      }

      // Validate SVG content
      const svgContent = file.buffer.toString('utf-8');
      if (!svgContent.includes('<svg') || !svgContent.includes('</svg>')) {
        throw new HttpException('Invalid SVG file', HttpStatus.BAD_REQUEST);
      }

      // Sanitize filename
      const sanitizedName = customName || file.originalname.replace(/[^a-zA-Z0-9-_]/g, '').toLowerCase();
      const fileName = sanitizedName.endsWith('.svg') ? sanitizedName : `${sanitizedName}.svg`;
      
      // Sanitize category
      const sanitizedCategory = category.replace(/[^a-zA-Z0-9-_]/g, '').toLowerCase() || 'user-uploads';

      this.logger.log(`User ${user?.discord?.username || user?.id || 'unknown'} uploading icon: ${fileName} to category: ${sanitizedCategory}`);

      // Upload to S3
      const result = await this.iconsService.uploadIcon(
        fileName,
        sanitizedCategory,
        file.buffer,
        user?.discord?.username || user?.id || 'anonymous'
      );

      res.json({
        success: true,
        message: 'Icon uploaded successfully',
        icon: result
      } as UploadResponse);

    } catch (error) {
      this.logger.error('Failed to upload icon:', error);
      res.status(error.status || 500).json({
        success: false,
        message: 'Failed to upload icon',
        error: error.message
      } as UploadResponse);
    }
  }
}
