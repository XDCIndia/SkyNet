import { NextRequest, NextResponse } from 'next/server';
import { queryAll, queryOne, withTransaction } from '@/lib/db';
import { withErrorHandling } from '@/lib/errors';
import { z } from 'zod';

// Query params schema
const AlertChannelsQuerySchema = z.object({
  channelType: z.enum(['telegram', 'email', 'webhook']).optional(),
  isActive: z.coerce.boolean().optional(),
});

// Telegram config schema
const TelegramConfigSchema = z.object({
  botToken: z.string().min(1),
  chatId: z.string().min(1),
});

// Email config schema
const EmailConfigSchema = z.object({
  smtpHost: z.string().min(1),
  smtpPort: z.number().int().min(1).max(65535),
  username: z.string().min(1),
  password: z.string().min(1),
  fromAddress: z.string().email(),
  toAddresses: z.array(z.string().email()).min(1),
  useTls: z.boolean().default(true),
});

// Webhook config schema
const WebhookConfigSchema = z.object({
  url: z.string().url(),
  method: z.enum(['POST', 'PUT']).default('POST'),
  headers: z.record(z.string()).optional(),
  secret: z.string().optional(),
});

// Alert channel schema
const AlertChannelSchema = z.object({
  name: z.string().min(1).max(100),
  channelType: z.enum(['telegram', 'email', 'webhook']),
  config: z.union([TelegramConfigSchema, EmailConfigSchema, WebhookConfigSchema]),
  isActive: z.boolean().default(true),
});

/**
 * GET /api/v1/alerts/channels
 * List alert notification channels
 */
async function getHandler(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  const params = AlertChannelsQuerySchema.parse({
    channelType: searchParams.get('channelType') || undefined,
    isActive: searchParams.get('isActive') ? searchParams.get('isActive') === 'true' : undefined,
  });

  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (params.channelType) {
    conditions.push(`channel_type = $${paramIndex++}`);
    values.push(params.channelType);
  }

  if (params.isActive !== undefined) {
    conditions.push(`is_active = $${paramIndex++}`);
    values.push(params.isActive);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const channels = await queryAll(`
    SELECT 
      id,
      name,
      channel_type as "channelType",
      config,
      is_active as "isActive",
      created_at as "createdAt",
      updated_at as "updatedAt"
    FROM netown.alert_channels
    ${whereClause}
    ORDER BY created_at DESC
  `, values);

  // Mask sensitive config values
  const sanitizedChannels = channels.map(channel => ({
    ...channel,
    config: maskConfig(channel.config, channel.channelType),
  }));

  return NextResponse.json({
    success: true,
    data: sanitizedChannels,
  });
}

function maskConfig(config: any, channelType: string): any {
  const masked = { ...config };
  switch (channelType) {
    case 'telegram':
      masked.botToken = config.botToken ? '••••' + config.botToken.slice(-4) : '';
      break;
    case 'email':
      masked.password = config.password ? '••••••••' : '';
      break;
    case 'webhook':
      masked.secret = config.secret ? '••••••••' : '';
      break;
  }
  return masked;
}

/**
 * POST /api/v1/alerts/channels
 * Create a new alert notification channel
 */
async function postHandler(request: NextRequest) {
  const body = await request.json();
  const validated = AlertChannelSchema.parse(body);

  const result = await queryOne(
    `INSERT INTO netown.alert_channels 
     (name, channel_type, config, is_active)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, channel_type as "channelType", config, is_active as "isActive", created_at as "createdAt"`,
    [validated.name, validated.channelType, JSON.stringify(validated.config), validated.isActive]
  );

  return NextResponse.json({
    success: true,
    data: {
      ...result,
      config: maskConfig(result.config, result.channelType),
    },
  }, { status: 201 });
}

/**
 * PUT /api/v1/alerts/channels
 * Update an existing alert channel
 */
async function putHandler(request: NextRequest) {
  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json(
      { success: false, error: 'Channel ID is required' },
      { status: 400 }
    );
  }

  const validated = AlertChannelSchema.partial().parse(updates);

  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (validated.name !== undefined) {
    fields.push(`name = $${paramIndex++}`);
    values.push(validated.name);
  }
  if (validated.channelType !== undefined) {
    fields.push(`channel_type = $${paramIndex++}`);
    values.push(validated.channelType);
  }
  if (validated.config !== undefined) {
    fields.push(`config = $${paramIndex++}`);
    values.push(JSON.stringify(validated.config));
  }
  if (validated.isActive !== undefined) {
    fields.push(`is_active = $${paramIndex++}`);
    values.push(validated.isActive);
  }

  fields.push(`updated_at = NOW()`);
  values.push(id);

  const result = await queryOne(
    `UPDATE netown.alert_channels SET ${fields.join(', ')} WHERE id = $${paramIndex} 
     RETURNING id, name, channel_type as "channelType", config, is_active as "isActive", updated_at as "updatedAt"`,
    values
  );

  if (!result) {
    return NextResponse.json(
      { success: false, error: 'Channel not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      ...result,
      config: maskConfig(result.config, result.channelType),
    },
  });
}

/**
 * DELETE /api/v1/alerts/channels
 * Delete an alert channel
 */
async function deleteHandler(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json(
      { success: false, error: 'Channel ID is required' },
      { status: 400 }
    );
  }

  await withTransaction(async (client) => {
    // Remove from junction table first
    await client.query('DELETE FROM netown.alert_rule_channels WHERE channel_id = $1', [id]);
    // Delete channel
    await client.query('DELETE FROM netown.alert_channels WHERE id = $1', [id]);
  });

  return NextResponse.json({
    success: true,
    message: 'Alert channel deleted',
  });
}

export const GET = withErrorHandling(getHandler);
export const POST = withErrorHandling(postHandler);
export const PUT = withErrorHandling(putHandler);
export const DELETE = withErrorHandling(deleteHandler);
