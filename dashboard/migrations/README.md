# Database Migrations

## Running Migrations

Migrations should be run manually via psql for now:

```bash
# Connect to database
psql -h localhost -p 5443 -U postgres -d xdc_gateway

# Run migration
\i migrations/001_add_data_retention.sql
```

## Future: Automated Migrations

Consider adding a migration tool like:
- `node-pg-migrate`
- `db-migrate`
- `Flyway`

## Current Migrations

1. **001_add_data_retention.sql** - Data retention policy (Issue #281)
   - Adds `skynet.cleanup_old_metrics()` function
   - Adds `skynet.maintenance_log` table
   - Retention: Metrics 90d, Peers 30d, Incidents 180d (archived)

## Scheduled Cleanup

Set up a daily cron job or Vercel Cron:

```bash
# Vercel cron (vercel.json)
{
  "crons": [{
    "path": "/api/cron/cleanup",
    "schedule": "0 3 * * *"
  }]
}

# Or external cron (daily at 3 AM)
0 3 * * * curl -X POST https://xdc.openscan.ai/api/cron/cleanup \
  -H "Authorization: Bearer $CRON_SECRET"
```

Set `CRON_SECRET` in environment variables.
