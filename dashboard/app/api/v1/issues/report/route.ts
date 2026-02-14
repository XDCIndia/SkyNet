import { NextRequest, NextResponse } from 'next/server';
import { queryAll, withTransaction } from '@/lib/db';
import { authenticateRequest, unauthorizedResponse } from '@/lib/auth';
import { withErrorHandling } from '@/lib/errors';
import { z } from 'zod';
import { execSync } from 'child_process';
import { logger } from '@/lib/logger';

// Issue report schema
const IssueReportSchema = z.object({
  nodeId: z.string().uuid(),
  nodeName: z.string().optional(),
  type: z.enum(['sync_stall', 'peer_drop', 'disk_critical', 'rpc_error', 'bad_block', 'container_crash', 'other']),
  severity: z.enum(['critical', 'high', 'medium', 'low', 'info']),
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  diagnostics: z.object({
    blockHeight: z.number().optional(),
    peerCount: z.number().optional(),
    cpuPercent: z.number().optional(),
    memoryPercent: z.number().optional(),
    diskPercent: z.number().optional(),
    clientVersion: z.string().optional(),
    clientType: z.string().optional(),
    rpcLatencyMs: z.number().optional(),
    isSyncing: z.boolean().optional(),
    syncPercent: z.number().optional(),
    recentErrors: z.array(z.string()).optional(),
    logs: z.string().optional(),
  }).optional(),
});

// Known issue patterns and solutions
// Issues always created in SkyNet repo; solutionRepo indicates where the PR/fix goes
const ISSUES_REPO = 'AnilChinchawale/XDCNetOwn';

const KNOWN_SOLUTIONS: Record<string, { 
  repo: string;  // repo where the fix/PR should go
  description: string; 
  files: string[];
  solutionCode?: string;
}> = {
  'sync_stall': {
    repo: 'AnilChinchawale/xdc-node-setup',
    description: 'Sync stall detected. Common causes: insufficient peers, disk I/O bottleneck, or corrupted state. Solution: clear bad block cache, add bootstrap peers, check disk health.',
    files: ['docker/mainnet/start-node.sh', 'scripts/troubleshoot.sh'],
    solutionCode: `#!/bin/bash
# Fix sync stall
# 1. Clear bad block cache
rm -rf /xdcdata/xdc/chaindata/bad-blocks

# 2. Restart with bootstrap peers
docker-compose down
docker-compose up -d

# 3. Check sync status after 5 minutes
sleep 300
curl -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_syncing","params":[],"id":1}'`,
  },
  'peer_drop': {
    repo: 'AnilChinchawale/xdc-node-setup',
    description: 'Peer count dropped critically. Check firewall rules (port 30303), NAT configuration, and bootnodes list.',
    files: ['docker/mainnet/start-node.sh', 'configs/bootnodes.toml'],
    solutionCode: `#!/bin/bash
# Fix peer drop
# 1. Check firewall rules
sudo ufw status | grep 30303 || echo "Port 30303 not open!"

# 2. Add bootstrap peers to docker-compose.yml
# Add to XDC_OPTS:
# --bootnodes "enode://..."

# 3. Restart node
docker-compose restart xdc`,
  },
  'disk_critical': {
    repo: 'AnilChinchawale/xdc-node-setup',
    description: 'Disk usage critical. Enable pruning, run log rotation, consider snapshot sync.',
    files: ['scripts/log-rotate.sh', 'docker/docker-compose.yml'],
    solutionCode: `#!/bin/bash
# Fix disk critical
# 1. Run log rotation immediately
./scripts/log-rotate.sh

# 2. Enable pruning in docker-compose.yml
# Add to XDC_OPTS: --gcmode archive

# 3. Clean old chaindata backups
find /xdcdata/backups -name "*.tar.gz" -mtime +7 -delete

# 4. Check disk after cleanup
df -h /xdcdata`,
  },
  'rpc_error': {
    repo: 'AnilChinchawale/xdc-node-setup',
    description: 'RPC endpoint not responding. Check node container status, port bindings, and config.toml HTTP settings.',
    files: ['dashboard/app/api/metrics/route.ts', 'configs/config.toml'],
    solutionCode: `#!/bin/bash
# Fix RPC error
# 1. Check container status
docker ps | grep xdc || echo "Container not running!"

# 2. Check port bindings
netstat -tlnp | grep 8545 || echo "Port 8545 not bound!"

# 3. Restart container if needed
docker-compose restart xdc

# 4. Verify RPC endpoint
curl -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'`,
  },
  'bad_block': {
    repo: 'AnilChinchawale/xdc-node-setup',
    description: 'BAD BLOCK detected. Usually caused by consensus mismatch. Clear datadir and resync, or check client version compatibility.',
    files: ['docker/mainnet/start-node.sh'],
    solutionCode: `#!/bin/bash
# Fix bad block
# WARNING: This will resync the node!

# 1. Stop container
docker-compose down

# 2. Backup and clear datadir
mv /xdcdata/xdc /xdcdata/xdc.backup.$(date +%Y%m%d_%H%M%S)
mkdir -p /xdcdata/xdc/chaindata

# 3. Pull latest image
docker-compose pull

# 4. Start fresh
docker-compose up -d

# 5. Monitor sync progress
watch -n 30 'curl -X POST http://localhost:8545 -H "Content-Type: application/json" -d "{\"jsonrpc\":\"2.0\",\"method\":\"eth_syncing\",\"params\":[],\"id\":1}"'`,
  },
  'container_crash': {
    repo: 'AnilChinchawale/xdc-node-setup',
    description: 'Node container crashed. Check logs for OOM, port conflicts, or config errors.',
    files: ['docker/docker-compose.yml', 'docker/mainnet/start-node.sh'],
    solutionCode: `#!/bin/bash
# Fix container crash
# 1. Check recent logs
docker-compose logs --tail=100 xdc | grep -i "error\|fatal\|oom"

# 2. Check system resources
free -h && df -h

# 3. Increase memory limit in docker-compose.yml if OOM
# mem_limit: 8G

# 4. Check for port conflicts
lsof -i :30303
lsof -i :8545

# 5. Restart with cleanup
docker-compose down
docker-compose up -d`,
  },
};

function createGitHubIssue(
  repo: string, 
  title: string, 
  body: string, 
  labels: string[]
): string | null {
  try {
    const fs = require('fs');
    const tmpBody = `/tmp/gh-issue-${Date.now()}.md`;
    fs.writeFileSync(tmpBody, body);
    
    // Try with labels first, fall back to no labels if they don't exist
    const safeTitle = title.replace(/"/g, '\\"').replace(/`/g, '\\`').slice(0, 200);
    let result: string;
    try {
      const labelFlag = labels.map(l => `-l "${l}"`).join(' ');
      result = execSync(
        `gh issue create --repo ${repo} --title "${safeTitle}" --body-file "${tmpBody}" ${labelFlag}`,
        { timeout: 30000 }
      ).toString().trim();
    } catch {
      // Retry without labels
      result = execSync(
        `gh issue create --repo ${repo} --title "${safeTitle}" --body-file "${tmpBody}"`,
        { timeout: 30000 }
      ).toString().trim();
    }
    
    try { fs.unlinkSync(tmpBody); } catch {}
    return result;
  } catch (e) {
    logger.error('Failed to create GitHub issue:', e);
    return null;
  }
}

function formatGitHubIssueBody(
  issue: z.infer<typeof IssueReportSchema>,
  nodeInfo: any,
  solution: typeof KNOWN_SOLUTIONS[string] | undefined
): string {
  const diagnostics = issue.diagnostics || {};
  
  let body = `## Automated Issue Report

**Node:** ${issue.nodeName || issue.nodeId}  
**IP:** ${nodeInfo?.ipv4 || 'Unknown'}  
**Client Type:** ${diagnostics.clientType || nodeInfo?.client_type || 'Unknown'}  
**Client Version:** ${diagnostics.clientVersion || nodeInfo?.client_version || 'Unknown'}  

---

### Issue Details

| Field | Value |
|-------|-------|
| **Type** | ${issue.type} |
| **Severity** | ${issue.severity} |
| **Reported** | ${new Date().toISOString()} |

### Diagnostics

| Metric | Value |
|--------|-------|
| Block Height | ${diagnostics.blockHeight ?? 'N/A'} |
| Peer Count | ${diagnostics.peerCount ?? 'N/A'} |
| CPU Usage | ${diagnostics.cpuPercent ? `${diagnostics.cpuPercent}%` : 'N/A'} |
| Memory Usage | ${diagnostics.memoryPercent ? `${diagnostics.memoryPercent}%` : 'N/A'} |
| Disk Usage | ${diagnostics.diskPercent ? `${diagnostics.diskPercent}%` : 'N/A'} |
| RPC Latency | ${diagnostics.rpcLatencyMs ? `${diagnostics.rpcLatencyMs}ms` : 'N/A'} |
| Syncing | ${diagnostics.isSyncing ? 'Yes' : 'No'} |
| Sync % | ${diagnostics.syncPercent ? `${diagnostics.syncPercent}%` : 'N/A'} |

### Description

${issue.description || 'No description provided.'}

### Recent Errors

`;

  if (diagnostics.recentErrors && diagnostics.recentErrors.length > 0) {
    diagnostics.recentErrors.forEach(err => {
      body += `- \`\`\`${err}\`\`\`\n`;
    });
  } else {
    body += '_No recent errors captured._\n';
  }

  if (diagnostics.logs) {
    body += `\n### Logs\n\n<details>\n<summary>View Logs</summary>\n\n\`\`\`\n${diagnostics.logs.slice(0, 2000)}${diagnostics.logs.length > 2000 ? '\n... (truncated)' : ''}\n\`\`\`\n\n</details>\n`;
  }

  if (solution) {
    body += `\n---\n\n### Suggested Solution\n\n${solution.description}\n\n### Files to Check\n\n`;
    solution.files.forEach(file => {
      body += `- \`${file}\`\n`;
    });

    if (solution.solutionCode) {
      body += `\n### Solution Script\n\n<details>\n<summary>View Script</summary>\n\n\`\`\`bash\n${solution.solutionCode}\n\`\`\`\n\n</details>\n`;
    }

    body += `\n**PR Target Repo:** \`${solution.repo}\`\n`;
  }

  body += `\n---\n\n_This issue was automatically generated by SkyNet Issue Pipeline._\n_Issues tracked in [XDCNetOwn](https://github.com/${ISSUES_REPO}). Solution PRs target the respective repos._\n`;

  return body;
}

async function postHandler(request: NextRequest) {
  // Authenticate request
  const auth = await authenticateRequest(request);
  if (!auth.valid) {
    return unauthorizedResponse(auth.error);
  }

  // Parse and validate request body
  const body = await request.json();
  const validationResult = IssueReportSchema.safeParse(body);
  
  if (!validationResult.success) {
    return NextResponse.json(
      { error: 'Invalid request body', details: validationResult.error.errors },
      { status: 400 }
    );
  }

  const issue = validationResult.data;

  // Check for duplicates: same node_id + type + status open + last_seen within 24h
  const existingIssues = await queryAll(
    `SELECT id, occurrence_count, status, github_issue_url 
     FROM skynet.issues 
     WHERE node_id = $1 
       AND type = $2 
       AND status = 'open' 
       AND last_seen > NOW() - INTERVAL '24 hours'
     ORDER BY last_seen DESC 
     LIMIT 1`,
    [issue.nodeId, issue.type]
  );

  // If duplicate found, update it
  if (existingIssues.length > 0) {
    const existing = existingIssues[0];
    
    await queryAll(
      `UPDATE skynet.issues 
       SET occurrence_count = occurrence_count + 1,
           last_seen = NOW(),
           diagnostics = COALESCE($1, diagnostics)
       WHERE id = $2`,
      [issue.diagnostics ? JSON.stringify(issue.diagnostics) : null, existing.id]
    );

    logger.info(`Duplicate issue detected and updated: ${existing.id}`);

    return NextResponse.json({
      success: true,
      issue: {
        id: existing.id,
        status: existing.status,
        isDuplicate: true,
        githubIssueUrl: existing.github_issue_url,
      },
    });
  }

  // Get node info for context
  const nodeInfoResult = await queryAll(
    `SELECT name, ipv4, client_type, client_version 
     FROM skynet.nodes 
     WHERE id = $1`,
    [issue.nodeId]
  );
  const nodeInfo = nodeInfoResult[0] || null;

  // Get solution for known issue types
  const solution = KNOWN_SOLUTIONS[issue.type];

  // Insert new issue
  const insertResult = await queryAll(
    `INSERT INTO skynet.issues 
     (node_id, node_name, type, severity, title, description, diagnostics, 
      status, solution_description, solution_code, occurrence_count, first_seen, last_seen)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'open', $8, $9, 1, NOW(), NOW())
     RETURNING id`,
    [
      issue.nodeId,
      issue.nodeName || nodeInfo?.name || null,
      issue.type,
      issue.severity,
      issue.title,
      issue.description || null,
      issue.diagnostics ? JSON.stringify(issue.diagnostics) : null,
      solution?.description || null,
      solution?.solutionCode || null,
    ]
  );

  const issueId = insertResult[0].id;
  let githubIssueUrl: string | null = null;

  // For critical/high severity issues, create GitHub issue (non-blocking)
  if ((issue.severity === 'critical' || issue.severity === 'high') && solution) {
    try {
      const githubTitle = `[${issue.severity.toUpperCase()}] ${issue.title} - ${issue.nodeName || issue.nodeId}`;
      const githubBody = formatGitHubIssueBody(issue, nodeInfo, solution);
      const labels = ['auto-detected', issue.severity, issue.type];

      githubIssueUrl = createGitHubIssue(ISSUES_REPO, githubTitle, githubBody, labels);

      if (githubIssueUrl) {
        await queryAll(
          `UPDATE skynet.issues SET github_issue_url = $1 WHERE id = $2`,
          [githubIssueUrl, issueId]
        );
        logger.info(`GitHub issue created: ${githubIssueUrl}`);
      }
    } catch (e) {
      logger.error('Failed to create GitHub issue:', e);
      // Non-blocking: don't fail the API response
    }
  }

  logger.info(`New issue created: ${issueId} (${issue.type}, ${issue.severity})`);

  return NextResponse.json({
    success: true,
    issue: {
      id: issueId,
      status: 'open',
      isDuplicate: false,
      githubIssueUrl,
    },
  });
}

export const POST = withErrorHandling(postHandler);
