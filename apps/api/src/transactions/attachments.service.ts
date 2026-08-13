import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateAttachmentDto } from './dto/transaction.dto';

const BUCKET = 'transaction-receipts';

@Injectable()
export class AttachmentsService {
  constructor(private readonly supabase: SupabaseService) {}

  async create(
    workspaceId: string,
    transactionId: string,
    userId: string,
    accessToken: string,
    dto: CreateAttachmentDto,
  ) {
    const client = this.supabase.getUserClient(accessToken);
    const selectFields =
      'id, original_name, content_type, size_bytes, created_at';
    const { data: existing } = await client
      .from('transaction_attachments')
      .select(selectFields)
      .eq('workspace_id', workspaceId)
      .eq('owner_id', userId)
      .eq('idempotency_key', dto.idempotency_key)
      .maybeSingle();
    if (existing) return existing;

    const { data: entry } = await client
      .from('journal_entries')
      .select('id')
      .eq('id', transactionId)
      .eq('workspace_id', workspaceId)
      .maybeSingle();
    if (!entry)
      throw new NotFoundException({
        code: 'TRANSACTION_NOT_FOUND',
        message: 'Transaction not found',
      });

    const bytes = Buffer.from(dto.data_base64, 'base64');
    if (
      bytes.length === 0 ||
      bytes.length > 5 * 1024 * 1024 ||
      !this.matchesContentType(bytes, dto.content_type)
    ) {
      throw new BadRequestException({
        code: 'INVALID_ATTACHMENT',
        message:
          'Receipt must be a valid JPG, PNG, WebP, or PDF no larger than 5 MB',
      });
    }
    const safeName =
      dto.filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100) || 'receipt';
    const path = `${workspaceId}/${userId}/${randomUUID()}-${safeName}`;
    const { error: uploadError } = await client.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: dto.content_type, upsert: false });
    if (uploadError)
      throw new BadRequestException({
        code: 'ATTACHMENT_UPLOAD_FAILED',
        message: uploadError.message,
      });

    const { data, error } = await client
      .from('transaction_attachments')
      .insert({
        workspace_id: workspaceId,
        journal_entry_id: transactionId,
        owner_id: userId,
        idempotency_key: dto.idempotency_key,
        storage_path: path,
        original_name: dto.filename,
        content_type: dto.content_type,
        size_bytes: bytes.length,
        checksum_sha256: createHash('sha256').update(bytes).digest('hex'),
      })
      .select(selectFields)
      .single();
    if (error?.code === '23505') {
      await client.storage.from(BUCKET).remove([path]);
      const { data: racedAttachment } = await client
        .from('transaction_attachments')
        .select(selectFields)
        .eq('workspace_id', workspaceId)
        .eq('owner_id', userId)
        .eq('idempotency_key', dto.idempotency_key)
        .maybeSingle();
      if (racedAttachment) return racedAttachment;
    }
    if (error) {
      await client.storage.from(BUCKET).remove([path]);
      throw new BadRequestException({
        code: 'ATTACHMENT_UPLOAD_FAILED',
        message: error.message,
      });
    }
    return data;
  }

  async signedUrl(
    workspaceId: string,
    transactionId: string,
    attachmentId: string,
    accessToken: string,
  ) {
    const client = this.supabase.getUserClient(accessToken);
    const { data: attachment } = await client
      .from('transaction_attachments')
      .select('storage_path')
      .eq('id', attachmentId)
      .eq('workspace_id', workspaceId)
      .eq('journal_entry_id', transactionId)
      .maybeSingle();
    if (!attachment)
      throw new NotFoundException({
        code: 'ATTACHMENT_NOT_FOUND',
        message: 'Receipt not found',
      });
    const { data, error } = await client.storage
      .from(BUCKET)
      .createSignedUrl(attachment.storage_path, 60);
    if (error)
      throw new BadRequestException({
        code: 'ATTACHMENT_DOWNLOAD_FAILED',
        message: error.message,
      });
    return { url: data.signedUrl, expires_in: 60 };
  }

  async remove(
    workspaceId: string,
    transactionId: string,
    attachmentId: string,
    userId: string,
    accessToken: string,
  ) {
    const client = this.supabase.getUserClient(accessToken);
    const { data: attachment } = await client
      .from('transaction_attachments')
      .select('storage_path, owner_id')
      .eq('id', attachmentId)
      .eq('workspace_id', workspaceId)
      .eq('journal_entry_id', transactionId)
      .maybeSingle();
    if (!attachment || attachment.owner_id !== userId)
      throw new NotFoundException({
        code: 'ATTACHMENT_NOT_FOUND',
        message: 'Receipt not found',
      });
    const { error: storageError } = await client.storage
      .from(BUCKET)
      .remove([attachment.storage_path]);
    if (storageError)
      throw new BadRequestException({
        code: 'ATTACHMENT_DELETE_FAILED',
        message: storageError.message,
      });
    const { error } = await client
      .from('transaction_attachments')
      .delete()
      .eq('id', attachmentId);
    if (error)
      throw new BadRequestException({
        code: 'ATTACHMENT_DELETE_FAILED',
        message: error.message,
      });
    return { deleted: true };
  }

  private matchesContentType(
    bytes: Buffer,
    contentType: CreateAttachmentDto['content_type'],
  ) {
    if (contentType === 'image/jpeg') {
      return (
        bytes.length >= 3 &&
        bytes[0] === 0xff &&
        bytes[1] === 0xd8 &&
        bytes[2] === 0xff
      );
    }
    if (contentType === 'image/png') {
      return bytes
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    }
    if (contentType === 'image/webp') {
      return (
        bytes.length >= 12 &&
        bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
        bytes.subarray(8, 12).toString('ascii') === 'WEBP'
      );
    }
    return bytes.subarray(0, 5).toString('ascii') === '%PDF-';
  }
}
