#!/bin/bash
# XDC Rewards Database Library
# SQLite database functions for reward tracking
# Author: anilcinchawale <anil24593@gmail.com>

set -euo pipefail

# Database configuration
REWARD_DB="${REWARD_DB:-/var/lib/xdc-node/rewards.db}"
DB_DIR="$(dirname "$REWARD_DB")"

# Initialize database schema
init_db() {
    log_info "Initializing rewards database at $REWARD_DB..."
    
    # Ensure directory exists
    if [[ ! -d "$DB_DIR" ]]; then
        sudo mkdir -p "$DB_DIR" 2>/dev/null || mkdir -p "$DB_DIR"
    fi
    
    # Check if sqlite3 is available
    if ! command -v sqlite3 &>/dev/null; then
        log_error "sqlite3 is required but not installed"
        return 1
    fi
    
    # Create tables if they don't exist
    sqlite3 "$REWARD_DB" <<'EOF'
-- Rewards table
CREATE TABLE IF NOT EXISTS rewards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    block_number INTEGER NOT NULL,
    tx_hash TEXT,
    amount REAL NOT NULL,
    reward_type TEXT DEFAULT 'block',
    masternode_address TEXT,
    notes TEXT
);

-- Missed blocks table
CREATE TABLE IF NOT EXISTS missed_blocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    block_number INTEGER NOT NULL,
    reason TEXT DEFAULT 'unknown',
    masternode_address TEXT,
    network_status TEXT,
    node_status TEXT
);

-- Slashing events table
CREATE TABLE IF NOT EXISTS slashing_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    block_number INTEGER NOT NULL,
    tx_hash TEXT,
    amount REAL NOT NULL,
    reason TEXT NOT NULL,
    masternode_address TEXT
);

-- APY history table
CREATE TABLE IF NOT EXISTS apy_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    period_days INTEGER NOT NULL,
    total_rewards REAL NOT NULL,
    apy_percent REAL NOT NULL,
    expected_apy REAL DEFAULT 5.5
);

-- Stake delegations table
CREATE TABLE IF NOT EXISTS delegations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    delegator_address TEXT NOT NULL,
    amount REAL NOT NULL,
    status TEXT DEFAULT 'active',
    end_time DATETIME
);

-- Auto-compound settings
CREATE TABLE IF NOT EXISTS compound_settings (
    id INTEGER PRIMARY KEY,
    enabled BOOLEAN DEFAULT 0,
    threshold REAL DEFAULT 1000,
    last_compound DATETIME
);

-- Insert default compound settings
INSERT OR IGNORE INTO compound_settings (id, enabled, threshold) VALUES (1, 0, 1000);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_rewards_timestamp ON rewards(timestamp);
CREATE INDEX IF NOT EXISTS idx_rewards_block ON rewards(block_number);
CREATE INDEX IF NOT EXISTS idx_rewards_masternode ON rewards(masternode_address);
CREATE INDEX IF NOT EXISTS idx_missed_timestamp ON missed_blocks(timestamp);
CREATE INDEX IF NOT EXISTS idx_slashing_timestamp ON slashing_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_apy_calculated ON apy_history(calculated_at);

-- Create views for common queries
CREATE VIEW IF NOT EXISTS daily_rewards AS
SELECT 
    date(timestamp) as date,
    COUNT(*) as reward_count,
    ROUND(SUM(amount), 4) as total_rewards,
    ROUND(AVG(amount), 4) as avg_reward
FROM rewards
GROUP BY date(timestamp)
ORDER BY date DESC;

CREATE VIEW IF NOT EXISTS weekly_summary AS
SELECT 
    strftime('%Y-W%W', timestamp) as week,
    COUNT(*) as reward_count,
    ROUND(SUM(amount), 4) as total_rewards,
    ROUND(AVG(amount), 4) as avg_reward
FROM rewards
WHERE timestamp >= datetime('now', '-90 days')
GROUP BY strftime('%Y-W%W', timestamp)
ORDER BY week DESC;

CREATE VIEW IF NOT EXISTS monthly_summary AS
SELECT 
    strftime('%Y-%m', timestamp) as month,
    COUNT(*) as reward_count,
    ROUND(SUM(amount), 4) as total_rewards,
    ROUND(AVG(amount), 4) as avg_reward
FROM rewards
GROUP BY strftime('%Y-%m', timestamp)
ORDER BY month DESC;
EOF

    log_info "Database initialized successfully"
}

# Record a reward
record_reward() {
    local block_number="$1"
    local amount="$2"
    local tx_hash="${3:-}"
    local reward_type="${4:-block}"
    local masternode_address="${5:-}"
    local notes="${6:-}"
    
    sqlite3 "$REWARD_DB" "INSERT INTO rewards (block_number, tx_hash, amount, reward_type, masternode_address, notes) VALUES ($block_number, '$tx_hash', $amount, '$reward_type', '$masternode_address', '$notes')" 2>/dev/null || {
        log_error "Failed to record reward"
        return 1
    }
}

# Record a missed block
record_missed_block() {
    local block_number="$1"
    local reason="${2:-unknown}"
    local masternode_address="${3:-}"
    local network_status="${4:-}"
    local node_status="${5:-}"
    
    sqlite3 "$REWARD_DB" "INSERT INTO missed_blocks (block_number, reason, masternode_address, network_status, node_status) VALUES ($block_number, '$reason', '$masternode_address', '$network_status', '$node_status')" 2>/dev/null || {
        log_error "Failed to record missed block"
        return 1
    }
}

# Record a slashing event
record_slashing() {
    local block_number="$1"
    local amount="$2"
    local reason="$3"
    local tx_hash="${4:-}"
    local masternode_address="${5:-}"
    
    sqlite3 "$REWARD_DB" "INSERT INTO slashing_events (block_number, amount, reason, tx_hash, masternode_address) VALUES ($block_number, $amount, '$reason', '$tx_hash', '$masternode_address')" 2>/dev/null || {
        log_error "Failed to record slashing event"
        return 1
    }
}

# Get summary statistics
get_summary() {
    local days="${1:-30}"
    
    local total_rewards
    total_rewards=$(sqlite3 "$REWARD_DB" "SELECT COALESCE(SUM(amount), 0) FROM rewards WHERE timestamp >= datetime('now', '-$days days')" 2>/dev/null || echo "0")
    
    local reward_count
    reward_count=$(sqlite3 "$REWARD_DB" "SELECT COUNT(*) FROM rewards WHERE timestamp >= datetime('now', '-$days days')" 2>/dev/null || echo "0")
    
    local avg_reward
    avg_reward=$(sqlite3 "$REWARD_DB" "SELECT COALESCE(AVG(amount), 0) FROM rewards WHERE timestamp >= datetime('now', '-$days days')" 2>/dev/null || echo "0")
    
    local missed_count
    missed_count=$(sqlite3 "$REWARD_DB" "SELECT COUNT(*) FROM missed_blocks WHERE timestamp >= datetime('now', '-$days days')" 2>/dev/null || echo "0")
    
    echo "{\"total_rewards\": $total_rewards, \"reward_count\": $reward_count, \"avg_reward\": $avg_reward, \"missed_count\": $missed_count}"
}

# Get reward history
get_history() {
    local days="${1:-30}"
    local limit="${2:-100}"
    
    sqlite3 "$REWARD_DB" "SELECT json_object('timestamp', timestamp, 'block_number', block_number, 'amount', amount, 'reward_type', reward_type) FROM rewards WHERE timestamp >= datetime('now', '-$days days') ORDER BY timestamp DESC LIMIT $limit" 2>/dev/null | jq -s '.'
}

# Get daily rewards
get_daily_rewards() {
    local days="${1:-30}"
    
    sqlite3 "$REWARD_DB" "SELECT * FROM daily_rewards LIMIT $days" 2>/dev/null
}

# Get APY history
get_apy_history() {
    local limit="${1:-10}"
    
    sqlite3 "$REWARD_DB" "SELECT calculated_at, period_days, total_rewards, apy_percent, expected_apy FROM apy_history ORDER BY calculated_at DESC LIMIT $limit" 2>/dev/null
}

# Enable/disable auto-compound
set_compound() {
    local enabled="$1"
    local threshold="${2:-1000}"
    
    sqlite3 "$REWARD_DB" "UPDATE compound_settings SET enabled = $enabled, threshold = $threshold WHERE id = 1" 2>/dev/null
}

# Get auto-compound settings
get_compound_settings() {
    sqlite3 "$REWARD_DB" "SELECT enabled, threshold, last_compound FROM compound_settings WHERE id = 1" 2>/dev/null
}

# Get missed blocks
get_missed_blocks() {
    local days="${1:-7}"
    
    sqlite3 "$REWARD_DB" "SELECT timestamp, block_number, reason FROM missed_blocks WHERE timestamp >= datetime('now', '-$days days') ORDER BY timestamp DESC" 2>/dev/null
}

# Get slashing events
get_slashing_events() {
    local limit="${1:-50}"
    
    sqlite3 "$REWARD_DB" "SELECT timestamp, block_number, amount, reason FROM slashing_events ORDER BY timestamp DESC LIMIT $limit" 2>/dev/null
}

# Export to JSON
export_to_json() {
    local table="${1:-rewards}"
    local output_file="$2"
    
    case "$table" in
        rewards)
            sqlite3 "$REWARD_DB" "SELECT json_object('id', id, 'timestamp', timestamp, 'block_number', block_number, 'amount', amount, 'reward_type', reward_type) FROM rewards" 2>/dev/null | jq -s '.' > "$output_file"
            ;;
        missed)
            sqlite3 "$REWARD_DB" "SELECT json_object('id', id, 'timestamp', timestamp, 'block_number', block_number, 'reason', reason) FROM missed_blocks" 2>/dev/null | jq -s '.' > "$output_file"
            ;;
        slashing)
            sqlite3 "$REWARD_DB" "SELECT json_object('id', id, 'timestamp', timestamp, 'block_number', block_number, 'amount', amount, 'reason', reason) FROM slashing_events" 2>/dev/null | jq -s '.' > "$output_file"
            ;;
        *)
            log_error "Unknown table: $table"
            return 1
            ;;
    esac
}

# Cleanup old records (keep last 2 years)
cleanup_old_records() {
    log_info "Cleaning up records older than 2 years..."
    
    sqlite3 "$REWARD_DB" "DELETE FROM rewards WHERE timestamp < datetime('now', '-2 years')" 2>/dev/null || true
    sqlite3 "$REWARD_DB" "DELETE FROM missed_blocks WHERE timestamp < datetime('now', '-2 years')" 2>/dev/null || true
    sqlite3 "$REWARD_DB" "DELETE FROM apy_history WHERE calculated_at < datetime('now', '-2 years')" 2>/dev/null || true
    
    # Vacuum to reclaim space
    sqlite3 "$REWARD_DB" "VACUUM" 2>/dev/null || true
    
    log_info "Cleanup completed"
}

# Get database stats
get_db_stats() {
    local total_rewards
    total_rewards=$(sqlite3 "$REWARD_DB" "SELECT COUNT(*) FROM rewards" 2>/dev/null || echo "0")
    
    local total_missed
    total_missed=$(sqlite3 "$REWARD_DB" "SELECT COUNT(*) FROM missed_blocks" 2>/dev/null || echo "0")
    
    local total_slashing
    total_slashing=$(sqlite3 "$REWARD_DB" "SELECT COUNT(*) FROM slashing_events" 2>/dev/null || echo "0")
    
    local db_size
    db_size=$(du -h "$REWARD_DB" 2>/dev/null | cut -f1 || echo "unknown")
    
    echo "{\"total_rewards\": $total_rewards, \"total_missed\": $total_missed, \"total_slashing\": $total_slashing, \"db_size\": \"$db_size\"}"
}
