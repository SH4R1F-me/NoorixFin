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
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';

@ApiTags('Categories')
@ApiBearerAuth('supabase-auth')
@Controller()
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get('workspaces/:workspaceId/categories')
  @UseGuards(WorkspaceMemberGuard)
  @ApiOperation({ summary: 'List categories (auto-seeds system categories)' })
  @ApiParam({ name: 'workspaceId', type: 'string' })
  @ApiQuery({ name: 'kind', required: false, enum: ['INCOME', 'EXPENSE'] })
  @ApiOkResponse({ type: [CategoryResponseDto] })
  async list(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request & { accessToken: string },
    @Query('kind') kind?: string,
  ) {
    return this.categoriesService.listCategories(
      workspaceId,
      user.id,
      req.accessToken,
      kind,
    );
  }

  @Post('workspaces/:workspaceId/categories')
  @UseGuards(WorkspaceMemberGuard)
  @ApiOperation({ summary: 'Create a custom category' })
  @ApiParam({ name: 'workspaceId', type: 'string' })
  @ApiCreatedResponse({ type: CategoryResponseDto })
  async create(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request & { accessToken: string },
    @Body() dto: CreateCategoryDto,
  ) {
    return this.categoriesService.createCategory(
      workspaceId,
      user.id,
      req.accessToken,
      dto,
    );
  }

  // Workspace-scoped on purpose. The previous route was `PATCH /categories/:id`
  // with no WorkspaceMemberGuard, so cross-workspace writes were blocked by RLS
  // alone — DEC-005 makes NestJS the primary authorization layer, with RLS as
  // defence-in-depth, not the only depth.
  @Patch('workspaces/:workspaceId/categories/:id')
  @UseGuards(WorkspaceMemberGuard)
  @ApiOperation({
    summary: 'Update a category (renaming a system category sets custom_name)',
  })
  @ApiParam({ name: 'workspaceId', type: 'string' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiOkResponse({ type: CategoryResponseDto })
  async update(
    @Param('workspaceId') workspaceId: string,
    @Param('id') categoryId: string,
    @Req() req: Request & { accessToken: string },
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categoriesService.updateCategory(
      categoryId,
      workspaceId,
      req.accessToken,
      dto,
    );
  }
}
