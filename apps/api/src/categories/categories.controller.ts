/**
 * Categories Controller — Blueprint §9.3, §11.2
 *
 * GET    /v1/workspaces/:workspaceId/categories  — list (seeds system on first call)
 * POST   /v1/workspaces/:workspaceId/categories  — create custom
 * PATCH  /v1/categories/:id                      — update custom (not system)
 */
import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { Request } from 'express';
import { CategoriesService } from './categories.service';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
  CategoryResponseDto,
} from './dto/category.dto';
import { WorkspaceMemberGuard } from '../auth/guards/workspace-member.guard';

@ApiTags('Categories')
@ApiBearerAuth('supabase-auth')
@Controller()
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get('workspaces/:workspaceId/categories')
  @UseGuards(WorkspaceMemberGuard)
  @ApiOperation({ summary: 'List categories (auto-seeds system categories)' })
  @ApiParam({ name: 'workspaceId', type: 'string' })
  @ApiQuery({ name: 'type', required: false, enum: ['INCOME', 'EXPENSE'] })
  @ApiOkResponse({ type: [CategoryResponseDto] })
  async list(
    @Param('workspaceId') workspaceId: string,
    @Req() req: Request & { accessToken: string },
    @Query('type') type?: string,
  ) {
    return this.categoriesService.listCategories(
      workspaceId,
      req.accessToken,
      type,
    );
  }

  @Post('workspaces/:workspaceId/categories')
  @UseGuards(WorkspaceMemberGuard)
  @ApiOperation({ summary: 'Create a custom category' })
  @ApiParam({ name: 'workspaceId', type: 'string' })
  @ApiCreatedResponse({ type: CategoryResponseDto })
  async create(
    @Param('workspaceId') workspaceId: string,
    @Req() req: Request & { accessToken: string },
    @Body() dto: CreateCategoryDto,
  ) {
    return this.categoriesService.createCategory(
      workspaceId,
      req.accessToken,
      dto,
    );
  }

  @Patch('categories/:id')
  @ApiOperation({ summary: 'Update a custom category (system categories are immutable)' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiOkResponse({ type: CategoryResponseDto })
  async update(
    @Param('id') categoryId: string,
    @Req() req: Request & { accessToken: string },
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categoriesService.updateCategory(
      categoryId,
      req.accessToken,
      dto,
    );
  }
}
