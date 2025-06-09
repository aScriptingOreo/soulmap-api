import { Resolver, Query, Args, Mutation } from '@nestjs/graphql';
import { IconsService } from './icons.service';
import { Icon } from './icon.entity';

@Resolver(() => Icon)
export class IconsResolver {
  constructor(private readonly iconsService: IconsService) {}

  @Query(() => [Icon], { description: 'Get all icons from the S3 bucket' })
  async icons(): Promise<Icon[]> {
    return this.iconsService.getAllIcons();
  }

  @Query(() => [Icon], { description: 'Get icons by category' })
  async iconsByCategory(
    @Args('category') category: string,
  ): Promise<Icon[]> {
    return this.iconsService.getIconsByCategory(category);
  }

  @Query(() => [Icon], { description: 'Search icons by name, category, or path' })
  async searchIcons(
    @Args('query') query: string,
  ): Promise<Icon[]> {
    return this.iconsService.searchIcons(query);
  }

  @Query(() => Icon, { nullable: true, description: 'Get icon by ID' })
  async icon(
    @Args('id') id: string,
  ): Promise<Icon | null> {
    return this.iconsService.getIconById(id);
  }

  @Query(() => [String], { description: 'Get all icon categories' })
  async iconCategories(): Promise<string[]> {
    return this.iconsService.getCategories();
  }

  @Mutation(() => Boolean, { description: 'Refresh the icon index from S3' })
  async refreshIconIndex(): Promise<boolean> {
    await this.iconsService.refreshIndex();
    return true;
  }
}
