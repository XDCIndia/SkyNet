import { NextRequest, NextResponse } from 'next/server';
import { queryAll, withTransaction } from '@/lib/db';
import { withErrorHandling } from '@/lib/errors';
import { z } from 'zod';

// Query params schema
const AlertRulesQuerySchema = z.object({
  nodeId: z.string().uuid().optional(),
  isActive: z.coerce.boolean().optional(),
  severity: z.enum(['critical', 'warning', 'info']).optional(),
});

// Alert rule schema
const AlertRuleSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  nodeId: z.string().uuid().optional(),
  conditionType: z.enum(['node_offline', 'sync_behind', 'disk_usage', 'peer_count', 'cpu_usage', 'memory_usage']),
  thresholdValue: z.number().positive(),
  durationMinutes: z.number().int().min(1).max(1440).default(5),
  severity: z.enum(['critical', 'warning', 'info']).default('warning'),
  isActive: z.boolean().default(true),
  channelIds: z.array(z.string().uuid()).optional(),
});

/**
 * GET /api/v1/alerts
 * List alert rules with optional filters
 */
async function getHandler(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  const params = AlertRulesQuerySchema.parse({
    nodeId: searchParams.get('nodeId'),
    isActive: searchParams.get('isActive') ? searchParams.get('isActive') === 'true' : undefined,
    severity: searchParams.get('severity'),
  });

  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (params.nodeId) {
    conditions.push(`ar.node_id = $${paramIndex++}`);
    values.push(params.nodeId);
  }

  if (params.isActive !== undefined) {
    conditions.push(`ar.is_active = $${paramIndex++}`);
    values.push(params.isActive);
  }

  if (params.severity) {
    conditions.push(`ar.severity = $${paramIndex++}`);
    values.push(params.severity);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const rules = await queryAll(`
    SELECT 
      ar.*,
      n.name as node_name,
      COALESCE(
        json_agg(
          json_build_object(
            'id', ac.id,
            'name', ac.name,
            'channelType', ac.channel_type
          )
        ) FILTER (WHERE ac.id IS NOT NULL),
        '[]'
      ) as channels
    FROM skynet.alert_rules ar
    LEFT JOIN skynet.nodes n ON ar.node_id = n.id
    LEFT JOIN skynet.alert_rule_channels arc ON ar.id = arc.rule_id
    LEFT JOIN skynet.alert_channels ac ON arc.channel_id = ac.id
    ${whereClause}
    GROUP BY ar.id, n.name
    ORDER BY ar.created_at DESC
  `, values);

  return NextResponse.json({
    success: true,
    data: rules,
  });
}

/**
 * POST /api/v1/alerts
 * Create a new alert rule
 */
async function postHandler(request: NextRequest) {
  const body = await request.json();
  const validated = AlertRuleSchema.parse(body);

  const result = await withTransaction(async (client) => {
    // Insert rule
    const ruleResult = await client.query(
      `INSERT INTO skynet.alert_rules 
       (name, description, node_id, condition_type, threshold_value, duration_minutes, severity, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        validated.name,
        validated.description || null,
        validated.nodeId || null,
        validated.conditionType,
        validated.thresholdValue,
        validated.durationMinutes,
        validated.severity,
        validated.isActive,
      ]
    );

    const rule = ruleResult.rows[0];

    // Link channels if provided
    if (validated.channelIds && validated.channelIds.length > 0) {
      const channelValues = validated.channelIds
        .map((_, i) => `($1, $${i + 2})`)
        .join(', ');
      await client.query(
        `INSERT INTO skynet.alert_rule_channels (rule_id, channel_id) VALUES ${channelValues}`,
        [rule.id, ...validated.channelIds]
      );
    }

    return rule;
  });

  return NextResponse.json({
    success: true,
    data: result,
  }, { status: 201 });
}

/**
 * PUT /api/v1/alerts
 * Update an existing alert rule
 */
async function putHandler(request: NextRequest) {
  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json(
      { success: false, error: 'Rule ID is required' },
      { status: 400 }
    );
  }

  const validated = AlertRuleSchema.partial().parse(updates);

  const result = await withTransaction(async (client) => {
    // Update rule
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (validated.name !== undefined) {
      fields.push(`name = $${paramIndex++}`);
      values.push(validated.name);
    }
    if (validated.description !== undefined) {
      fields.push(`description = $${paramIndex++}`);
      values.push(validated.description);
    }
    if (validated.nodeId !== undefined) {
      fields.push(`node_id = $${paramIndex++}`);
      values.push(validated.nodeId);
    }
    if (validated.conditionType !== undefined) {
      fields.push(`condition_type = $${paramIndex++}`);
      values.push(validated.conditionType);
    }
    if (validated.thresholdValue !== undefined) {
      fields.push(`threshold_value = $${paramIndex++}`);
      values.push(validated.thresholdValue);
    }
    if (validated.durationMinutes !== undefined) {
      fields.push(`duration_minutes = $${paramIndex++}`);
      values.push(validated.durationMinutes);
    }
    if (validated.severity !== undefined) {
      fields.push(`severity = $${paramIndex++}`);
      values.push(validated.severity);
    }
    if (validated.isActive !== undefined) {
      fields.push(`is_active = $${paramIndex++}`);
      values.push(validated.isActive);
    }

    fields.push(`updated_at = NOW()`);

    values.push(id);

    const ruleResult = await client.query(
      `UPDATE skynet.alert_rules SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    if (ruleResult.rows.length === 0) {
      throw new Error('Rule not found');
    }

    // Update channel links if provided
    if (validated.channelIds !== undefined) {
      await client.query(
        'DELETE FROM skynet.alert_rule_channels WHERE rule_id = $1',
        [id]
      );

      if (validated.channelIds.length > 0) {
        const channelValues = validated.channelIds
          .map((_, i) => `($1, $${i + 2})`)
          .join(', ');
        await client.query(
          `INSERT INTO skynet.alert_rule_channels (rule_id, channel_id) VALUES ${channelValues}`,
          [id, ...validated.channelIds]
        );
      }
    }

    return ruleResult.rows[0];
  });

  return NextResponse.json({
    success: true,
    data: result,
  });
}

/**
 * DELETE /api/v1/alerts
 * Delete an alert rule
 */
async function deleteHandler(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json(
      { success: false, error: 'Rule ID is required' },
      { status: 400 }
    );
  }

  await withTransaction(async (client) => {
    await client.query('DELETE FROM skynet.alert_rule_channels WHERE rule_id = $1', [id]);
    await client.query('DELETE FROM skynet.alert_rules WHERE id = $1', [id]);
  });

  return NextResponse.json({
    success: true,
    message: 'Alert rule deleted',
  });
}

export const GET = withErrorHandling(getHandler);
export const POST = withErrorHandling(postHandler);
export const PUT = withErrorHandling(putHandler);
export const DELETE = withErrorHandling(deleteHandler);
