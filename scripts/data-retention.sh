#!/bin/bash
#===============================================================================
# XDC SkyNet - Data Retention Policy Implementation
#===============================================================================
# Implements automated data retention for time-series metrics tables
# to prevent unbounded database growth.
#
# Usage: ./scripts/data-retention.sh [apply|dry-run|status]
#===============================================================================

set -euo pipefail

# Configuration
RETENTION_DAYS_RAW="${RETENTION_DAYS_RAW:-7}"
RETENTION_DAYS_AGGREGATED="${RETENTION_DAYS_AGGREGATED:-90}"
RETENTION_DAYS_INCIDENTS="${RETENTION_DAYS_INCIDENTS:-365}"
BATCH_SIZE="${BATCH_SIZE:-10000}"
DRY_RUN="${DRY_RUN:-false}"

# Database connection
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5443}"
DB_NAME="${DB_NAME:-xdc_gateway}"
DB_USER="${DB_USER:-postgres}"
DB_SCHEMA="${DB_SCHEMA:-skynet}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

#===============================================================================
# Helper Functions
#===============================================================================

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

log_info() {
    log "${GREEN}INFO${NC}: $*"
}

log_warn() {
    log "${YELLOW}WARN${NC}: $*"
}

log_error() {
    log "${RED}ERROR${NC}: $*" >&2
}

# Execute SQL query
query() {
    local sql="$1"
    PGPASSWORD="${DB_PASSWORD:-}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "$sql" 2>/dev/null
}

# Execute SQL with dry-run check
execute_sql() {
    local sql="$1"
    local description="$2"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_warn "[DRY-RUN] Would execute: $description"
        echo "  SQL: $sql"
        return 0
    fi
    
    log_info "Executing: $description"
    query "$sql"
}

#===============================================================================
# Retention Functions
#===============================================================================

get_table_count() {
    local table="$1"
    local condition="${2:-}"
    
    local sql="SELECT COUNT(*) FROM ${DB_SCHEMA}.${table}"
    [[ -n "$condition" ]] && sql="$sql WHERE $condition"
    
    query "$sql" | xargs
}

get_table_size() {
    local table="$1"
    
    query "SELECT pg_size_pretty(pg_total_relation_size('${DB_SCHEMA}.${table}'))" | xargs
}

# Clean old node_metrics
retain_node_metrics() {
    log_info "Processing node_metrics retention..."
    
    local count_before
    count_before=$(get_table_count "node_metrics")
    log_info "Current node_metrics rows: $count_before"
    log_info "Current node_metrics size: $(get_table_size "node_metrics")"
    
    # Delete in batches to avoid long locks
    local deleted=0
    local batch_deleted=1
    
    while [[ "$batch_deleted" -gt 0 ]]; do
        if [[ "$DRY_RUN" == "false" ]]; then
            batch_deleted=$(query "
                WITH deleted AS (
                    DELETE FROM ${DB_SCHEMA}.node_metrics
                    WHERE id IN (
                        SELECT id FROM ${DB_SCHEMA}.node_metrics
                        WHERE collected_at < NOW() - INTERVAL '${RETENTION_DAYS_RAW} days'
                        ORDER BY collected_at
                        LIMIT ${BATCH_SIZE}
                    )
                    RETURNING id
                )
                SELECT COUNT(*) FROM deleted;
            " | xargs)
            deleted=$((deleted + batch_deleted))
            log_info "  Deleted batch: $batch_deleted rows"
        else
            batch_deleted=0
        fi
    done
    
    if [[ "$DRY_RUN" == "true" ]]; then
        local would_delete
        would_delete=$(get_table_count "node_metrics" "collected_at < NOW() - INTERVAL '${RETENTION_DAYS_RAW} days'")
        log_warn "[DRY-RUN] Would delete $would_delete rows older than $RETENTION_DAYS_RAW days"
    else
        log_info "Total deleted: $deleted rows"
        log_info "Remaining node_metrics rows: $(get_table_count "node_metrics")"
    fi
}

# Clean old peer_snapshots
retain_peer_snapshots() {
    log_info "Processing peer_snapshots retention..."
    
    local count_before
    count_before=$(get_table_count "peer_snapshots")
    log_info "Current peer_snapshots rows: $count_before"
    
    execute_sql "
        DELETE FROM ${DB_SCHEMA}.peer_snapshots
        WHERE collected_at < NOW() - INTERVAL '${RETENTION_DAYS_RAW} days'
    " "Delete peer_snapshots older than $RETENTION_DAYS_RAW days"
    
    if [[ "$DRY_RUN" == "false" ]]; then
        log_info "Remaining peer_snapshots rows: $(get_table_count "peer_snapshots")"
    fi
}

# Clean old incidents (keep longer)
retain_incidents() {
    log_info "Processing incidents retention..."
    
    local count_before
    count_before=$(get_table_count "incidents")
    log_info "Current incidents rows: $count_before"
    
    execute_sql "
        DELETE FROM ${DB_SCHEMA}.incidents
        WHERE detected_at < NOW() - INTERVAL '${RETENTION_DAYS_INCIDENTS} days'
        AND status != 'active'
    " "Delete resolved incidents older than $RETENTION_DAYS_INCIDENTS days"
    
    if [[ "$DRY_RUN" == "false" ]]; then
        log_info "Remaining incidents rows: $(get_table_count "incidents")"
    fi
}

# Clean old audit logs
retain_audit_logs() {
    log_info "Processing audit_logs retention..."
    
    local table_exists
    table_exists=$(query "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = '${DB_SCHEMA}' AND table_name = 'audit_log')" | xargs)
    
    if [[ "$table_exists" != "t" ]]; then
        log_warn "audit_log table does not exist, skipping"
        return 0
    fi
    
    execute_sql "
        DELETE FROM ${DB_SCHEMA}.audit_log
        WHERE created_at < NOW() - INTERVAL '${RETENTION_DAYS_INCIDENTS} days'
    " "Delete audit logs older than $RETENTION_DAYS_INCIDENTS days"
}

# Vacuum and analyze tables after cleanup
optimize_tables() {
    if [[ "$DRY_RUN" == "true" ]]; then
        log_warn "[DRY-RUN] Would VACUUM ANALYZE tables"
        return 0
    fi
    
    log_info "Running VACUUM ANALYZE on affected tables..."
    
    PGPASSWORD="${DB_PASSWORD:-}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
        VACUUM ANALYZE ${DB_SCHEMA}.node_metrics;
        VACUUM ANALYZE ${DB_SCHEMA}.peer_snapshots;
        VACUUM ANALYZE ${DB_SCHEMA}.incidents;
    " 2>/dev/null || log_warn "VACUUM may require higher privileges"
}

#===============================================================================
# Status Reporting
#===============================================================================

show_status() {
    log_info "=== Data Retention Status ==="
    log_info "Retention Configuration:"
    log_info "  Raw metrics: $RETENTION_DAYS_RAW days"
    log_info "  Aggregated metrics: $RETENTION_DAYS_AGGREGATED days"
    log_info "  Incidents: $RETENTION_DAYS_INCIDENTS days"
    echo
    
    log_info "Table Status:"
    
    local tables=("node_metrics" "peer_snapshots" "incidents")
    for table in "${tables[@]}"; do
        local count
        local size
        count=$(get_table_count "$table")
        size=$(get_table_size "$table")
        log_info "  $table: $count rows, $size"
    done
    
    echo
    log_info "Old Data Estimates:"
    
    local old_metrics
    old_metrics=$(get_table_count "node_metrics" "collected_at < NOW() - INTERVAL '${RETENTION_DAYS_RAW} days'")
    log_info "  node_metrics > ${RETENTION_DAYS_RAW} days: ~$old_metrics rows"
    
    local old_peers
    old_peers=$(get_table_count "peer_snapshots" "collected_at < NOW() - INTERVAL '${RETENTION_DAYS_RAW} days'")
    log_info "  peer_snapshots > ${RETENTION_DAYS_RAW} days: ~$old_peers rows"
}

#===============================================================================
# Partition Management (for TimescaleDB)
#===============================================================================

setup_partitioning() {
    log_info "Setting up time-based partitioning..."
    
    # Check if TimescaleDB is available
    local has_timescale
    has_timescale=$(query "SELECT EXISTS (SELECT FROM pg_extension WHERE extname = 'timescaledb')" | xargs)
    
    if [[ "$has_timescale" != "t" ]]; then
        log_warn "TimescaleDB not available, using standard PostgreSQL"
        return 0
    fi
    
    log_info "TimescaleDB detected, setting up hypertables..."
    
    # Convert node_metrics to hypertable if not already
    local is_hypertable
    is_hypertable=$(query "SELECT EXISTS (SELECT FROM timescaledb_information.hypertables WHERE hypertable_name = 'node_metrics')" | xargs)
    
    if [[ "$is_hypertable" != "t" ]]; then
        execute_sql "
            SELECT create_hypertable('${DB_SCHEMA}.node_metrics', 'collected_at', 
                chunk_time_interval => INTERVAL '1 day',
                if_not_exists => TRUE
            );
        " "Convert node_metrics to hypertable"
    else
        log_info "node_metrics is already a hypertable"
    fi
    
    # Set up retention policy
    execute_sql "
        SELECT add_retention_policy('${DB_SCHEMA}.node_metrics', 
            INTERVAL '${RETENTION_DAYS_RAW} days',
            if_not_exists => TRUE
        );
    " "Add retention policy for node_metrics"
}

#===============================================================================
# Main
#===============================================================================

show_help() {
    cat <<EOF
XDC SkyNet Data Retention Policy Tool

Usage: $0 [command] [options]

Commands:
    apply       Apply retention policy (delete old data)
    dry-run     Show what would be deleted without deleting
    status      Show current retention status
    setup       Set up TimescaleDB partitioning
    help        Show this help message

Environment Variables:
    DB_HOST          Database host (default: localhost)
    DB_PORT          Database port (default: 5443)
    DB_NAME          Database name (default: xdc_gateway)
    DB_USER          Database user (default: postgres)
    DB_PASSWORD      Database password
    DB_SCHEMA        Schema name (default: skynet)
    RETENTION_DAYS_RAW          Raw data retention in days (default: 7)
    RETENTION_DAYS_AGGREGATED   Aggregated data retention in days (default: 90)
    RETENTION_DAYS_INCIDENTS    Incident retention in days (default: 365)
    BATCH_SIZE       Delete batch size (default: 10000)

Examples:
    $0 status                    # Show current status
    $0 dry-run                   # Preview what would be deleted
    $0 apply                     # Apply retention policy
    $0 setup                     # Set up TimescaleDB partitioning
EOF
}

case "${1:-}" in
    apply)
        DRY_RUN=false
        log_info "Applying data retention policy..."
        retain_node_metrics
        retain_peer_snapshots
        retain_incidents
        retain_audit_logs
        optimize_tables
        log_info "Retention policy applied successfully"
        ;;
    dry-run)
        DRY_RUN=true
        log_info "Running in dry-run mode..."
        retain_node_metrics
        retain_peer_snapshots
        retain_incidents
        retain_audit_logs
        ;;
    status)
        show_status
        ;;
    setup)
        setup_partitioning
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        log_error "Unknown command: ${1:-}"
        show_help
        exit 1
        ;;
esac
