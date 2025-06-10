import {
  Resolver,
  Query,
  Mutation,
  Args,
  ID,
} from '@nestjs/graphql';
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

  @Mutation(() => Category)
  @UseGuards(JwtAuthGuard)
  async createCategory(
    @Args('createCategoryInput') createCategoryInput: CreateCategoryInput,
  ): Promise<Category> {
    console.log('Creating category with input:', createCategoryInput);
    return this.categoriesService.create(createCategoryInput);
  }

  @Mutation(() => Category)
  @UseGuards(JwtAuthGuard)
  async updateCategory(
    @Args('updateCategoryInput') updateCategoryInput: UpdateCategoryInput,
  ): Promise<Category> {
    const category = await this.categoriesService.update(
      updateCategoryInput.id,
      updateCategoryInput,
    );
    return category;
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard)
  async removeCategory(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    const result = await this.categoriesService.remove(id);
    return result;
  }
}
