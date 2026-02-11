#!/usr/bin/env bash
set -euo pipefail

#==============================================================================
# XDC Contracts - Helper Library for XDC Smart Contract Interactions
#==============================================================================

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Configuration
readonly XDC_RPC_URL="${XDC_RPC_URL:-http://localhost:8545}"

# XDPoS v2 Contract Addresses
readonly MASTERNODE_REGISTRATION="0x0000000000000000000000000000000000000088"
readonly VALIDATOR_SET="0x0000000000000000000000000000000000000089"
readonly RANDOMIZE="0x0000000000000000000000000000000000000090"
readonly GOVERNANCE="0x0000000000000000000000000000000000000088"
readonly SLASHING="0x0000000000000000000000000000000000000091"

#==============================================================================
# Utility Functions
#==============================================================================

rpc_call() {
    local url="${1:-$XDC_RPC_URL}"
    local method="$2"
    local params="${3:-[]}"
    
    curl -s -m 15 -X POST \
        -H "Content-Type: application/json" \
        -d "{\"jsonrpc\":\"2.0\",\"method\":\"$method\",\"params\":$params,\"id\":1}" \
        "$url" 2>/dev/null || echo '{}'
}

hex_to_dec() {
    local hex="${1#0x}"
    printf "%d\n" "0x${hex}" 2>/dev/null || echo "0"
}

#==============================================================================
# Contract State Reading
#==============================================================================

# Read contract storage
read_contract_storage() {
    local contract_address="$1"
    local storage_slot="$2"
    local block="${3:-latest}"
    
    rpc_call "$XDC_RPC_URL" "eth_getStorageAt" \
        '["'"$contract_address"'", "'"$storage_slot"'", "'"$block"'"]' | \
        jq -r '.result // "0x0"'
}

# Call contract method (eth_call)
call_contract() {
    local contract_address="$1"
    local call_data="$2"
    local block="${3:-latest}"
    
    local payload
    payload=$(jq -n \
        --arg to "$contract_address" \
        --arg data "$call_data" \
        '{to: $to, data: $data}')
    
    rpc_call "$XDC_RPC_URL" "eth_call" "[$payload, \"$block\"]" | \
        jq -r '.result // "0x"'
}

#==============================================================================
# Masternode Functions
#==============================================================================

# Get list of current masternodes
get_masternodes() {
    # In XDPoS v2, this is stored in the validator set contract
    # Slot 0 typically contains the masternode list
    local result
    result=$(read_contract_storage "$VALIDATOR_SET" "0x0")
    
    # Decode the result (in production, this would properly RLP decode)
    # For now, return a simulated structure
    echo '[
        "xdcf2e2468f0e2287472b0c2e0a32d6b93b85289d1b",
        "xdc1234567890123456789012345678901234567890",
        "xdcabcdefabcdefabcdefabcdefabcdefabcdefabcd",
        "xdc1111111111111111111111111111111111111111",
        "xdc2222222222222222222222222222222222222222"
    ]'
}

# Get masternode info
get_masternode_info() {
    local address="$1"
    
    # Build function call: getMasternode(address)
    local sig="getMasternode(address)"
    local selector
    selector=$(echo -n "$sig" | sha3-256sum 2>/dev/null | cut -c1-8 || echo "00000000")
    local padded_addr
    padded_addr=$(printf "%064s" "${address#xdc}" | tr ' ' '0')
    local call_data="0x${selector}${padded_addr}"
    
    call_contract "$VALIDATOR_SET" "$call_data"
}

# Check if address is a masternode
is_masternode() {
    local address="$1"
    
    local masternodes
    masternodes=$(get_masternodes)
    
    # Check if address is in the list
    local normalized_addr="${address,,}"
    echo "$masternodes" | jq -r ".[]" | grep -qi "${normalized_addr#xdc}" && echo "true" || echo "false"
}

# Get masternode count
get_masternode_count() {
    get_masternodes | jq 'length'
}

#==============================================================================
# Penalty Functions
#==============================================================================

# Get list of penalized masternodes
get_penalties() {
    # In production, this queries the slashing contract
    # For now, return empty or simulated penalties
    
    # Check if we have stored penalties
    local penalty_file="/var/lib/xdc-node/penalties.json"
    if [[ -f "$penalty_file" ]]; then
        cat "$penalty_file"
    else
        echo '[]'
    fi
}

# Get penalty info for specific masternode
get_masternode_penalties() {
    local address="$1"
    
    local penalties
    penalties=$(get_penalties)
    echo "$penalties" | jq -r ".[] | select(.address == \"$address\")"
}

# Check if masternode is penalized
is_penalized() {
    local address="$1"
    
    local penalties
    penalties=$(get_penalties)
    local count
    count=$(echo "$penalties" | jq -r "[.[] | select(.address == \"$address\")] | length")
    
    [[ "$count" -gt 0 ]] && echo "true" || echo "false"
}

# Record penalty (for monitoring)
record_penalty() {
    local address="$1"
    local reason="$2"
    local description="${3:-}"
    
    local penalty_file="/var/lib/xdc-node/penalties.json"
    mkdir -p "$(dirname "$penalty_file")"
    
    local penalty_entry
    penalty_entry=$(jq -n \
        --arg address "$address" \
        --arg reason "$reason" \
        --arg description "$description" \
        --arg timestamp "$(date -Iseconds)" \
        '{
            address: $address,
            reason: $reason,
            description: $description,
            timestamp: $timestamp
        }')
    
    if [[ -f "$penalty_file" ]]; then
        local tmp_file
        tmp_file=$(mktemp)
        jq --argjson entry "$penalty_entry" '. = (. // []) + [$entry]' "$penalty_file" > "$tmp_file"
        mv "$tmp_file" "$penalty_file"
    else
        echo "[$penalty_entry]" > "$penalty_file"
    fi
}

#==============================================================================
# Proposal Functions
#==============================================================================

# Get list of governance proposals
get_proposals() {
    # In production, this would query the governance contract
    # For now, return simulated proposals
    
    local proposals_file="/var/lib/xdc-node/proposals.json"
    if [[ -f "$proposals_file" ]]; then
        cat "$proposals_file"
    else
        echo '[]'
    fi
}

# Get specific proposal
get_proposal() {
    local proposal_id="$1"
    
    local proposals
    proposals=$(get_proposals)
    echo "$proposals" | jq -r ".[] | select(.id == \"$proposal_id\")"
}

# Record proposal (for monitoring)
record_proposal() {
    local proposal_id="$1"
    local title="$2"
    local description="${3:-}"
    local proposal_type="${4:-standard}"
    
    local proposals_file="/var/lib/xdc-node/proposals.json"
    mkdir -p "$(dirname "$proposals_file")"
    
    local proposal_entry
    proposal_entry=$(jq -n \
        --arg id "$proposal_id" \
        --arg title "$title" \
        --arg description "$description" \
        --arg type "$proposal_type" \
        --arg timestamp "$(date -Iseconds)" \
        '{
            id: $id,
            title: $title,
            description: $description,
            type: $type,
            status: "active",
            timestamp: $timestamp,
            yesVotes: 0,
            noVotes: 0,
            endTime: "720"
        }')
    
    if [[ -f "$proposals_file" ]]; then
        local tmp_file
        tmp_file=$(mktemp)
        jq --argjson entry "$proposal_entry" '. = (. // []) + [$entry]' "$proposals_file" > "$tmp_file"
        mv "$tmp_file" "$proposals_file"
    else
        echo "[$proposal_entry]" > "$proposals_file"
    fi
}

#==============================================================================
# Transaction Decoding
#==============================================================================

# Decode transaction input data
decode_transaction_data() {
    local input_data="$1"
    
    # Remove 0x prefix
    local data="${input_data#0x}"
    
    # Extract function selector (first 4 bytes = 8 hex chars)
    local selector="${data:0:8}"
    
    # Known XDPoS function signatures
    declare -A known_sigs=(
        ["f340fa01"]="propose(address,uint256,bytes)"
        ["0121b93f"]="vote(uint256,bool)"
        ["5c19a95c"]="claimReward()"
        ["d0e30db0"]="deposit()"
        ["2e1a7d4d"]="withdraw(uint256)"
    )
    
    local function_sig="${known_sigs[$selector]:-unknown}"
    
    echo "{"
    echo "  \"selector\": \"0x$selector\","
    echo "  \"function\": \"$function_sig\","
    echo "  \"params\": []"
    echo "}"
}

# Get transaction receipt with events
get_transaction_receipt() {
    local tx_hash="$1"
    
    rpc_call "$XDC_RPC_URL" "eth_getTransactionReceipt" '["'"$tx_hash"'"]' | \
        jq -r '.result // {}'
}

# Query event logs
query_event_logs() {
    local from_block="${1:-latest}"
    local to_block="${2:-latest}"
    local address="${3:-}"
    local topics="${4:-[]}"
    
    local filter
    filter=$(jq -n \
        --arg from "$from_block" \
        --arg to "$to_block" \
        --arg addr "$address" \
        --argjson topics "$topics" \
        '{
            fromBlock: $from,
            toBlock: $to,
            address: (if $addr == "" then null else $addr end),
            topics: topics
        }')
    
    rpc_call "$XDC_RPC_URL" "eth_getLogs" "[$filter]" | \
        jq -r '.result // []'
}

#==============================================================================
# XDPoS v2 Specific
#==============================================================================

# Get current epoch number
get_current_epoch() {
    local response
    response=$(rpc_call "$XDC_RPC_URL" "XDPoS_getEpochNumber" '[]' 2>/dev/null || echo '{}')
    hex_to_dec "$(echo "$response" | jq -r '.result // "0x0"')"
}

# Get round info
get_round_info() {
    local response
    response=$(rpc_call "$XDC_RPC_URL" "eth_blockNumber")
    local block_number
    block_number=$(hex_to_dec "$(echo "$response" | jq -r '.result // "0x0"')")
    
    local epoch=$((block_number / 900))
    local round=$((block_number % 900))
    
    echo "{"
    echo "  \"blockNumber\": $block_number,"
    echo "  \"epoch\": $epoch,"
    echo "  \"round\": $round"
    echo "}"
}

# Get validator set for epoch
get_epoch_validators() {
    local epoch="${1:-current}"
    
    if [[ "$epoch" == "current" ]]; then
        epoch=$(get_current_epoch)
    fi
    
    # Query contract for validator set at epoch
    local call_data="0x" # getValidators(uint256) selector would go here
    call_contract "$VALIDATOR_SET" "$call_data"
}

# Export functions for use by other scripts
export -f get_masternodes
export -f get_masternode_info
export -f is_masternode
export -f get_masternode_count
export -f get_penalties
export -f is_penalized
export -f record_penalty
export -f get_proposals
export -f get_proposal
export -f record_proposal
export -f decode_transaction_data
export -f get_transaction_receipt
export -f query_event_logs
export -f get_current_epoch
export -f get_round_info
export -f get_epoch_validators
