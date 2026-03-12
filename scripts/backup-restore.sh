#!/bin/bash
# Automated Backup and Recovery System for XDC Nodes
# Issue #691

set -e

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/backup/xdc}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
ENCRYPTION_KEY="${ENCRYPTION_KEY:-}"
S3_BUCKET="${S3_BUCKET:-}"
NODE_DATA_DIR="${NODE_DATA_DIR:-/xdcdata}"

# Timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="xdc_backup_${TIMESTAMP}"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Create backup directory
mkdir -p "${BACKUP_DIR}"

# Function: Create backup
create_backup() {
    log "Starting backup: ${BACKUP_NAME}"
    
    # Check disk space
    AVAILABLE=$(df -BG "${BACKUP_DIR}" | tail -1 | awk '{print $4}' | tr -d 'G')
    REQUIRED=$(du -sG "${NODE_DATA_DIR}" | awk '{print $1}')
    
    if [ "${AVAILABLE}" -lt "${REQUIRED}" ]; then
        log "ERROR: Insufficient disk space. Available: ${AVAILABLE}GB, Required: ${REQUIRED}GB"
        exit 1
    fi
    
    # Create backup archive
    local backup_path="${BACKUP_DIR}/${BACKUP_NAME}.tar.gz"
    
    log "Creating archive..."
    tar -czf "${backup_path}" -C "$(dirname ${NODE_DATA_DIR})" "$(basename ${NODE_DATA_DIR})" 2>/dev/null || {
        log "ERROR: Failed to create backup archive"
        exit 1
    }
    
    # Encrypt if key provided
    if [ -n "${ENCRYPTION_KEY}" ]; then
        log "Encrypting backup..."
        openssl enc -aes-256-cbc -salt -in "${backup_path}" -out "${backup_path}.enc" -k "${ENCRYPTION_KEY}"
        rm "${backup_path}"
        backup_path="${backup_path}.enc"
    fi
    
    # Upload to S3 if configured
    if [ -n "${S3_BUCKET}" ]; then
        log "Uploading to S3..."
        aws s3 cp "${backup_path}" "s3://${S3_BUCKET}/backups/" || {
            log "WARNING: S3 upload failed, keeping local copy"
        }
    fi
    
    # Create metadata
    cat > "${BACKUP_DIR}/${BACKUP_NAME}.meta.json" <> EOF
{
    "backup_name": "${BACKUP_NAME}",
    "timestamp": "$(date -Iseconds)",
    "size_bytes": $(stat -f%z "${backup_path}" 2>/dev/null || stat -c%s "${backup_path}"),
    "encrypted": $([ -n "${ENCRYPTION_KEY}" ] && echo "true" || echo "false"),
    "s3_uploaded": $([ -n "${S3_BUCKET}" ] && echo "true" || echo "false"),
    "node_data_dir": "${NODE_DATA_DIR}",
    "checksum": "$(md5sum ${backup_path} | awk '{print $1}')"
}
EOF
    
    log "Backup completed: ${backup_path}"
    echo "${backup_path}"
}

# Function: List backups
list_backups() {
    log "Available backups:"
    
    for meta in "${BACKUP_DIR}"/*.meta.json; do
        if [ -f "$meta" ]; then
            cat "$meta"
            echo ""
        fi
    done | jq -s 'sort_by(.timestamp) | reverse'
}

# Function: Restore from backup
restore_backup() {
    local backup_name="$1"
    local target_dir="${2:-${NODE_DATA_DIR}}"
    
    log "Starting restore: ${backup_name}"
    
    local backup_file="${BACKUP_DIR}/${backup_name}.tar.gz"
    local encrypted_file="${backup_file}.enc"
    
    # Check if backup exists
    if [ -f "${encrypted_file}" ]; then
        if [ -z "${ENCRYPTION_KEY}" ]; then
            log "ERROR: Backup is encrypted but ENCRYPTION_KEY not set"
            exit 1
        fi
        
        log "Decrypting backup..."
        openssl enc -aes-256-cbc -d -in "${encrypted_file}" -out "${backup_file}" -k "${ENCRYPTION_KEY}"
    elif [ ! -f "${backup_file}" ]; then
        log "ERROR: Backup not found: ${backup_name}"
        exit 1
    fi
    
    # Stop node
    log "Stopping XDC node..."
    docker-compose stop xdc 2>/dev/null || docker stop xdc-node 2>/dev/null || true
    
    # Backup current data
    if [ -d "${target_dir}" ]; then
        log "Backing up current data..."
        mv "${target_dir}" "${target_dir}.backup.$(date +%s)"
    fi
    
    # Extract backup
    log "Restoring from backup..."
    mkdir -p "$(dirname ${target_dir})"
    tar -xzf "${backup_file}" -C "$(dirname ${target_dir})"
    
    # Start node
    log "Starting XDC node..."
    docker-compose start xdc 2>/dev/null || docker start xdc-node 2>/dev/null || true
    
    log "Restore completed"
}

# Function: Verify backup
verify_backup() {
    local backup_name="$1"
    local backup_file="${BACKUP_DIR}/${backup_name}.tar.gz"
    local encrypted_file="${backup_file}.enc"
    
    log "Verifying backup: ${backup_name}"
    
    if [ -f "${encrypted_file}" ]; then
        if [ -z "${ENCRYPTION_KEY}" ]; then
            log "ERROR: Cannot verify - backup encrypted and no key provided"
            exit 1
        fi
        
        log "Decrypting for verification..."
        openssl enc -aes-256-cbc -d -in "${encrypted_file}" | tar -tzf - > /dev/null
    else
        tar -tzf "${backup_file}" > /dev/null
    fi
    
    if [ $? -eq 0 ]; then
        log "✓ Backup verification successful"
    else
        log "✗ Backup verification failed"
        exit 1
    fi
}

# Function: Cleanup old backups
cleanup_backups() {
    log "Cleaning up backups older than ${RETENTION_DAYS} days..."
    
    find "${BACKUP_DIR}" -name "xdc_backup_*.tar.gz*" -mtime +${RETENTION_DAYS} -delete
    find "${BACKUP_DIR}" -name "xdc_backup_*.meta.json" -mtime +${RETENTION_DAYS} -delete
    
    log "Cleanup completed"
}

# Main command handler
case "${1:-}" in
    create)
        create_backup
        ;;
    list)
        list_backups
        ;;
    restore)
        if [ -z "${2:-}" ]; then
            log "Usage: $0 restore <backup_name> [target_dir]"
            exit 1
        fi
        restore_backup "$2" "${3:-}"
        ;;
    verify)
        if [ -z "${2:-}" ]; then
            log "Usage: $0 verify <backup_name>"
            exit 1
        fi
        verify_backup "$2"
        ;;
    cleanup)
        cleanup_backups
        ;;
    *)
        echo "XDC Node Backup and Recovery System"
        echo ""
        echo "Usage: $0 <command> [options]"
        echo ""
        echo "Commands:"
        echo "  create              Create a new backup"
        echo "  list                List all backups"
        echo "  restore <name>     Restore from backup"
        echo "  verify <name>      Verify backup integrity"
        echo "  cleanup             Remove old backups"
        echo ""
        echo "Environment Variables:"
        echo "  BACKUP_DIR         Backup storage directory (default: /backup/xdc)"
        echo "  RETENTION_DAYS     Days to keep backups (default: 7)"
        echo "  ENCRYPTION_KEY     AES encryption key"
        echo "  S3_BUCKET          S3 bucket for remote storage"
        echo "  NODE_DATA_DIR      Node data directory (default: /xdcdata)"
        exit 1
        ;;
esac
