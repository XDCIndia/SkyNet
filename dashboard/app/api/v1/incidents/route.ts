import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { authenticateRequest, unauthorizedResponse } from '@/lib/auth';

const pool = new Pool({
  connectionString: 'postgresql://gateway:gateway_secret_2026@localhost:5433/xdc_gateway',
});

interface IncidentPayload {
  nodeId: string;
  type: string;
  severity: 'critical' | 'warning' | 'info';
  fingerprint: string;
  message: string;
  context?: any;
  healAction?: string;
  healSuccess?: boolean;
}

// GET /api/v1/incidents — list all incidents with filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const nodeId = searchParams.get('nodeId');
    const status = searchParams.get('status') || 'open';
    const severity = searchParams.get('severity');
    const limit = parseInt(searchParams.get('limit') || '100');

    let query = `
      SELECT 
        i.*,
        n.name as node_name,
        n.client_type,
        n.network
      FROM skynet.incidents i
      LEFT JOIN skynet.nodes n ON i.node_id = n.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramCount = 1;

    if (nodeId) {
      query += ` AND i.node_id = $${paramCount}`;
      params.push(nodeId);
      paramCount++;
    }

    if (status) {
      query += ` AND i.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    if (severity) {
      query += ` AND i.severity = $${paramCount}`;
      params.push(severity);
      paramCount++;
    }

    query += ` ORDER BY i.last_seen DESC LIMIT $${paramCount}`;
    params.push(limit);

    const result = await pool.query(query, params);

    return NextResponse.json({
      success: true,
      incidents: result.rows,
      count: result.rows.length,
    });
  } catch (error: any) {
    console.error('Error fetching incidents:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// POST /api/v1/incidents — create/update incident (dedup by fingerprint) (protected)
export async function POST(request: NextRequest) {
  // Authenticate request
  const auth = await authenticateRequest(request);
  if (!auth.valid) {
    return unauthorizedResponse(auth.error);
  }

  const client = await pool.connect();
  
  try {
    const payload: IncidentPayload = await request.json();

    // Validate required fields
    if (!payload.nodeId || !payload.type || !payload.severity || !payload.fingerprint || !payload.message) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: nodeId, type, severity, fingerprint, message' },
        { status: 400 }
      );
    }

    await client.query('BEGIN');

    // Check for existing open incident with same fingerprint
    const existingResult = await client.query(
      `SELECT * FROM skynet.incidents 
       WHERE fingerprint = $1 AND status IN ('open', 'active') AND node_id = $2
       ORDER BY first_seen DESC LIMIT 1`,
      [payload.fingerprint, payload.nodeId]
    );

    let incident;

    if (existingResult.rows.length > 0) {
      // Update existing incident
      const existing = existingResult.rows[0];
      const newOccurrenceCount = existing.occurrence_count + 1;
      
      // Append to context_history
      const contextHistory = existing.context_history || [];
      contextHistory.push({
        timestamp: new Date().toISOString(),
        context: payload.context,
        healAction: payload.healAction,
        healSuccess: payload.healSuccess,
      });

      const updateResult = await client.query(
        `UPDATE skynet.incidents 
         SET occurrence_count = $1,
             last_seen = NOW(),
             context = $2,
             context_history = $3,
             heal_action = $4,
             heal_success = $5,
             heal_attempts = heal_attempts + 1,
             message = $6
         WHERE id = $7
         RETURNING *`,
        [
          newOccurrenceCount,
          JSON.stringify(payload.context),
          JSON.stringify(contextHistory),
          payload.healAction,
          payload.healSuccess,
          payload.message,
          existing.id,
        ]
      );

      incident = updateResult.rows[0];

      console.log(`Incident ${incident.id} updated: occurrence_count=${newOccurrenceCount}`);
    } else {
      // Create new incident
      const insertResult = await client.query(
        `INSERT INTO skynet.incidents (
          node_id, type, severity, fingerprint, message, context,
          occurrence_count, first_seen, last_seen, status,
          heal_action, heal_success, heal_attempts, context_history,
          title, description
         )
         VALUES ($1, $2, $3, $4, $5, $6, 1, NOW(), NOW(), 'open', $7, $8, 0, '[]'::jsonb, $9, $10)
         RETURNING *`,
        [
          payload.nodeId,
          payload.type,
          payload.severity,
          payload.fingerprint,
          payload.message,
          JSON.stringify(payload.context),
          payload.healAction || 'none',
          payload.healSuccess || false,
          payload.message.substring(0, 200), // title
          payload.message, // description
        ]
      );

      incident = insertResult.rows[0];

      console.log(`New incident created: ${incident.id} (${payload.type})`);
    }

    // Check if escalation threshold reached
    const escalationNeeded = await checkEscalation(incident);
    
    if (escalationNeeded) {
      console.log(`Incident ${incident.id} needs escalation to GitHub`);
      // Trigger GitHub escalation (will be handled by separate endpoint or async process)
      // For now, just mark it
      await client.query(
        `UPDATE skynet.incidents SET status = 'escalated' WHERE id = $1`,
        [incident.id]
      );
      incident.status = 'escalated';
    }

    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      incident,
      action: existingResult.rows.length > 0 ? 'updated' : 'created',
      escalationNeeded,
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error processing incident:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

// Check if incident needs escalation based on playbook rules
async function checkEscalation(incident: any): Promise<boolean> {
  // Load playbook (in production, cache this)
  const fs = require('fs');
  const path = require('path');
  
  try {
    const playbookPath = path.join(process.cwd(), '../../../../XDC-Node-Setup/configs/healing-playbook.json');
    let playbook;
    
    try {
      const playbookContent = fs.readFileSync(playbookPath, 'utf8');
      playbook = JSON.parse(playbookContent);
    } catch (e) {
      console.warn('Could not load playbook from relative path, trying absolute');
      const absolutePath = '/root/.openclaw/workspace/XDC-Node-Setup/configs/healing-playbook.json';
      const playbookContent = fs.readFileSync(absolutePath, 'utf8');
      playbook = JSON.parse(playbookContent);
    }

    // Find matching playbook entry
    const playbookEntry = playbook.playbook.find((entry: any) => 
      incident.type === entry.id || 
      (entry.pattern && incident.message.toLowerCase().includes(entry.pattern.toLowerCase()))
    );

    if (!playbookEntry || !playbookEntry.escalate) {
      return false;
    }

    const escalate = playbookEntry.escalate;

    // Check immediate escalation
    if (escalate.immediately) {
      return true;
    }

    // Check after_failures threshold
    if (escalate.after_failures && incident.heal_attempts >= escalate.after_failures) {
      return true;
    }

    // Check after_occurrences threshold
    if (escalate.after_occurrences && incident.occurrence_count >= escalate.after_occurrences) {
      return true;
    }

    return false;
  } catch (error) {
    console.error('Error checking escalation:', error);
    return false;
  }
}
