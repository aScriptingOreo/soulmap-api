import { Resolver, Query, Mutation, Args, ID, Int, Context } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { Category } from './category.entity';
import { CreateCategoryInput } from './dto/create-category.input';
import { UpdateCategoryInput } from './dto/update-category.input';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Resolver(() => Category)
export class CategoriesResolver {
  constructor(private categoriesService: CategoriesService) {}

  @Query(() => [Category])
  async categories(): Promise<Category[]> {
    return this.categoriesService.findAll();
  }

  @Query(() => Category)
  async category(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<Category> {
    return this.categoriesService.findOne(id);
  }

  @Query(() => Category, { description: 'Get category with all its locations' })
  async categoryWithLocations(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<Category> {
    return this.categoriesService.findOneWithLocations(id);
  }

  @Query(() => Int, { description: 'Get count of locations in a category' })
  async categoryLocationCount(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<number> {
    return this.categoriesService.getLocationCount(id);
  }

  @Mutation(() => Category)
  @UseGuards(JwtAuthGuard)
  async createCategory(
    @Args('createCategoryInput') createCategoryInput: CreateCategoryInput,
    @Context() context: any,
  ): Promise<Category> {
    console.log('Creating category with input:', createCategoryInput);
    const userId = context.req.user.userId; // Get from JWT payload
    return this.categoriesService.create(createCategoryInput, userId);
  }

  @Mutation(() => Category)
  @UseGuards(JwtAuthGuard)
  async updateCategory(
    @Args('updateCategoryInput') updateCategoryInput: UpdateCategoryInput,
    @Context() context: any,
  ): Promise<Category> {
    const userId = context.req.user.userId; // Get from JWT payload
    const category = await this.categoriesService.update(
      updateCategoryInput.id,
      updateCategoryInput,
      userId,
    );
    return category;
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard)
  async removeCategory(
    @Args('id', { type: () => ID }) id: string,
    @Context() context: any,
  ): Promise<boolean> {
    const userId = context.req.user.userId; // Get from JWT payload
    const result = await this.categoriesService.remove(id, userId);
    return result;
  }
}
