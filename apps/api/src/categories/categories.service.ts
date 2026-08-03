/**
 * Categories Service — Blueprint §9.3
 *
 * System categories with translation_key (immutable).
 * Custom categories per workspace with parent/child hierarchy.
 */
import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';
import { v4 as uuidv4 } from 'uuid';

/** Default system categories seeded per workspace */
const SYSTEM_CATEGORIES = [
  // Expense categories
  { name: 'Food & Dining', type: 'EXPENSE', icon: '🍕', color: '#f59e0b', translation_key: 'cat.food_dining' },
  { name: 'Transport', type: 'EXPENSE', icon: '🚗', color: '#3b82f6', translation_key: 'cat.transport' },
  { name: 'Housing', type: 'EXPENSE', icon: '🏠', color: '#8b5cf6', translation_key: 'cat.housing' },
  { name: 'Utilities', type: 'EXPENSE', icon: '💡', color: '#06b6d4', translation_key: 'cat.utilities' },
  { name: 'Healthcare', type: 'EXPENSE', icon: '🏥', color: '#ef4444', translation_key: 'cat.healthcare' },
  { name: 'Education', type: 'EXPENSE', icon: '📚', color: '#6366f1', translation_key: 'cat.education' },
  { name: 'Entertainment', type: 'EXPENSE', icon: '🎮', color: '#ec4899', translation_key: 'cat.entertainment' },
  { name: 'Shopping', type: 'EXPENSE', icon: '🛍️', color: '#f97316', translation_key: 'cat.shopping' },
  { name: 'Personal Care', type: 'EXPENSE', icon: '💈', color: '#14b8a6', translation_key: 'cat.personal_care' },
  { name: 'Gifts & Donations', type: 'EXPENSE', icon: '🎁', color: '#a855f7', translation_key: 'cat.gifts_donations' },
  { name: 'Other Expense', type: 'EXPENSE', icon: '📦', color: '#64748b', translation_key: 'cat.other_expense' },
  // Income categories
  { name: 'Salary', type: 'INCOME', icon: '💰', color: '#10b981', translation_key: 'cat.salary' },
  { name: 'Business', type: 'INCOME', icon: '💼', color: '#059669', translation_key: 'cat.business' },
  { name: 'Freelance', type: 'INCOME', icon: '💻', color: '#0ea5e9', translation_key: 'cat.freelance' },
  { name: 'Investment', type: 'INCOME', icon: '📈', color: '#22c55e', translation_key: 'cat.investment' },
  { name: 'Other Income', type: 'INCOME', icon: '💵', color: '#84cc16', translation_key: 'cat.other_income' },
];

@Injectable()
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Seed system categories for a workspace (called on first list or workspace creation).
   */
  async seedSystemCategories(
    workspaceId: string,
    accessToken: string,
  ): Promise<void> {
    const client = this.supabaseService.getUserClient(accessToken);

    // Check if system categories already exist
    const { data: existing } = await client
      .from('categories')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('is_system', true)
      .limit(1);

    if (existing && existing.length > 0) return;

    const systemRows = SYSTEM_CATEGORIES.map((cat, idx) => ({
      id: uuidv4(),
      workspace_id: workspaceId,
      name: cat.name,
      type: cat.type,
      icon: cat.icon,
      color: cat.color,
      translation_key: cat.translation_key,
      is_system: true,
      sort_order: idx,
    }));

    const { error } = await client.from('categories').insert(systemRows);

    if (error) {
      this.logger.warn(`Failed to seed system categories: ${error.message}`);
    }
  }

  /**
   * List categories for a workspace. Seeds system categories on first call.
   */
  async listCategories(
    workspaceId: string,
    accessToken: string,
    type?: string,
  ) {
    // Ensure system categories exist
    await this.seedSystemCategories(workspaceId, accessToken);

    const client = this.supabaseService.getUserClient(accessToken);

    let query = client
      .from('categories')
      .select('*')
      .eq('workspace_id', workspaceId)
      .is('archived_at', null)
      .order('is_system', { ascending: false })
      .order('sort_order')
      .order('name');

    if (type) {
      query = query.eq('type', type);
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error(`Failed to list categories: ${error.message}`);
      throw new BadRequestException('Failed to list categories');
    }

    return data || [];
  }

  /**
   * Create a custom category.
   */
  async createCategory(
    workspaceId: string,
    accessToken: string,
    dto: CreateCategoryDto,
  ) {
    const client = this.supabaseService.getUserClient(accessToken);

    // Validate parent exists if specified
    if (dto.parent_id) {
      const { data: parent, error: parentError } = await client
        .from('categories')
        .select('id, type')
        .eq('id', dto.parent_id)
        .eq('workspace_id', workspaceId)
        .single();

      if (parentError || !parent) {
        throw new BadRequestException({
          code: 'INVALID_PARENT',
          message: 'Parent category not found',
        });
      }

      // Parent must match type
      if (parent.type !== dto.type) {
        throw new BadRequestException({
          code: 'TYPE_MISMATCH',
          message: 'Child category must have same type as parent',
        });
      }
    }

    const categoryId = uuidv4();
    const { data, error } = await client
      .from('categories')
      .insert({
        id: categoryId,
        workspace_id: workspaceId,
        name: dto.name,
        type: dto.type,
        icon: dto.icon || '📁',
        color: dto.color || '#64748b',
        parent_id: dto.parent_id || null,
        is_system: false,
        sort_order: dto.sort_order ?? 999,
      })
      .select()
      .single();

    if (error) {
      this.logger.error(`Failed to create category: ${error.message}`);
      throw new BadRequestException('Failed to create category');
    }

    return data;
  }

  /**
   * Update a custom category. System categories cannot be modified.
   */
  async updateCategory(
    categoryId: string,
    accessToken: string,
    dto: UpdateCategoryDto,
  ) {
    const client = this.supabaseService.getUserClient(accessToken);

    // Fetch existing
    const { data: existing, error: fetchError } = await client
      .from('categories')
      .select('*')
      .eq('id', categoryId)
      .single();

    if (fetchError || !existing) {
      throw new NotFoundException({
        code: 'CATEGORY_NOT_FOUND',
        message: 'Category not found',
      });
    }

    if (existing.is_system) {
      throw new ForbiddenException({
        code: 'SYSTEM_CATEGORY',
        message: 'System categories cannot be modified',
      });
    }

    const updatePayload: Record<string, unknown> = {};
    if (dto.name !== undefined) updatePayload.name = dto.name;
    if (dto.icon !== undefined) updatePayload.icon = dto.icon;
    if (dto.color !== undefined) updatePayload.color = dto.color;
    if (dto.parent_id !== undefined) updatePayload.parent_id = dto.parent_id;
    if (dto.sort_order !== undefined) updatePayload.sort_order = dto.sort_order;
    if (dto.archived === true) updatePayload.archived_at = new Date().toISOString();
    if (dto.archived === false) updatePayload.archived_at = null;

    updatePayload.updated_at = new Date().toISOString();

    const { data, error } = await client
      .from('categories')
      .update(updatePayload)
      .eq('id', categoryId)
      .select()
      .single();

    if (error) {
      this.logger.error(`Failed to update category: ${error.message}`);
      throw new BadRequestException('Failed to update category');
    }

    return data;
  }
}
