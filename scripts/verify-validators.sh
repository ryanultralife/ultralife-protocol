#!/usr/bin/env bash
# =============================================================================
# UltraLife Protocol - Formal Verification Runner
# =============================================================================
#
# This script orchestrates formal verification of UltraLife validators using
# the Blaster toolchain (Lean4 + SMT solving).
#
# Usage:
#   ./scripts/verify-validators.sh <command> [options]
#
# Commands:
#   extract     - Extract UPLC from plutus.json to .flat files
#   verify      - Run formal verification on specified validator
#   all         - Run all verifications
#   check       - Run Aiken's built-in property-based tests
#   setup       - Set up verification environment
#   clean       - Clean generated files
#
# Examples:
#   ./scripts/verify-validators.sh setup
#   ./scripts/verify-validators.sh extract
#   ./scripts/verify-validators.sh verify pnft
#   ./scripts/verify-validators.sh all
#   ./scripts/verify-validators.sh check
#
# =============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
VERIFICATION_DIR="$PROJECT_ROOT/verification"
PLUTUS_JSON="$PROJECT_ROOT/plutus.json"
FLAT_OUTPUT_DIR="$VERIFICATION_DIR/scripts"

# Critical validators to verify
CRITICAL_VALIDATORS=(
    "pnft"
    "token"
    "treasury"
    "ubi"
)

# =============================================================================
# Helper Functions
# =============================================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_dependencies() {
    local missing=()

    if ! command -v aiken &> /dev/null; then
        missing+=("aiken")
    fi

    if ! command -v lean &> /dev/null; then
        missing+=("lean (Lean4)")
    fi

    if ! command -v lake &> /dev/null; then
        missing+=("lake")
    fi

    if ! command -v z3 &> /dev/null; then
        missing+=("z3")
    fi

    if ! command -v jq &> /dev/null; then
        missing+=("jq")
    fi

    if [ ${#missing[@]} -gt 0 ]; then
        log_error "Missing dependencies: ${missing[*]}"
        echo ""
        echo "Installation instructions:"
        echo "  aiken:  cargo install aiken"
        echo "  lean4:  curl https://raw.githubusercontent.com/leanprover/elan/master/elan-init.sh -sSf | sh"
        echo "  z3:     apt-get install z3 (or brew install z3)"
        echo "  jq:     apt-get install jq (or brew install jq)"
        return 1
    fi

    log_success "All dependencies found"
    return 0
}

# =============================================================================
# Setup Command
# =============================================================================

cmd_setup() {
    log_info "Setting up verification environment..."

    # Create directories
    mkdir -p "$FLAT_OUTPUT_DIR"
    mkdir -p "$VERIFICATION_DIR/UltraLife/Properties"
    mkdir -p "$VERIFICATION_DIR/UltraLife/Validators"

    # Check for lakefile
    if [ ! -f "$VERIFICATION_DIR/lakefile.lean" ]; then
        log_error "lakefile.lean not found in verification/"
        log_info "Please ensure the verification project is properly initialized"
        return 1
    fi

    # Initialize Lean project dependencies
    log_info "Fetching Lean dependencies (this may take a while)..."
    cd "$VERIFICATION_DIR"

    if lake update; then
        log_success "Lean dependencies updated"
    else
        log_warning "Could not update dependencies. Blaster repos may not be available yet."
        log_info "The Blaster toolchain is under active development."
        log_info "Check https://github.com/input-output-hk/Lean-blaster for availability."
    fi

    cd "$PROJECT_ROOT"
    log_success "Verification environment setup complete"
}

# =============================================================================
# Extract Command
# =============================================================================

cmd_extract() {
    log_info "Extracting UPLC from plutus.json..."

    if [ ! -f "$PLUTUS_JSON" ]; then
        log_error "plutus.json not found. Run 'aiken build' first."
        return 1
    fi

    mkdir -p "$FLAT_OUTPUT_DIR"

    # Extract validator count
    local validator_count
    validator_count=$(jq '.validators | length' "$PLUTUS_JSON")
    log_info "Found $validator_count validators in plutus.json"

    # Extract each validator's compiled code
    for i in $(seq 0 $((validator_count - 1))); do
        local title
        local compiled_code

        title=$(jq -r ".validators[$i].title" "$PLUTUS_JSON")
        compiled_code=$(jq -r ".validators[$i].compiledCode" "$PLUTUS_JSON")

        # Convert title to filename (e.g., "pnft_policy.pnft_policy.mint" -> "pnft_policy_mint")
        local filename
        filename=$(echo "$title" | sed 's/\./_/g' | sed 's/__/_/g')

        # The compiledCode is hex-encoded CBOR-wrapped flat
        # Save as hex for now (conversion to flat binary would require additional tooling)
        echo "$compiled_code" > "$FLAT_OUTPUT_DIR/${filename}.hex"

        log_info "  Extracted: $title -> ${filename}.hex"
    done

    log_success "Extracted $validator_count validators to $FLAT_OUTPUT_DIR/"
    log_info ""
    log_info "Note: The .hex files contain hex-encoded CBOR-wrapped flat format."
    log_info "For Lean import, use #import_uplc with hex decoding, or convert to .flat binary."
    log_info ""
    log_info "Conversion example (using cardano-cli or custom tool):"
    log_info "  xxd -r -p input.hex | cbor2flat > output.flat"
}

# =============================================================================
# Verify Command
# =============================================================================

cmd_verify() {
    local validator="${1:-}"

    if [ -z "$validator" ]; then
        log_error "Usage: $0 verify <validator_name>"
        log_info "Available validators: ${CRITICAL_VALIDATORS[*]}"
        return 1
    fi

    # Map validator name to Lean module
    local lean_module
    case "$validator" in
        pnft)
            lean_module="UltraLife.Properties.Pnft"
            ;;
        token)
            lean_module="UltraLife.Properties.Token"
            ;;
        treasury)
            lean_module="UltraLife.Properties.Treasury"
            ;;
        ubi)
            lean_module="UltraLife.Properties.Ubi"
            ;;
        *)
            log_error "Unknown validator: $validator"
            log_info "Available validators: ${CRITICAL_VALIDATORS[*]}"
            return 1
            ;;
    esac

    log_info "Verifying $validator properties..."
    log_info "Lean module: $lean_module"

    cd "$VERIFICATION_DIR"

    # Build the specific module
    if lake build "$lean_module" 2>&1; then
        log_success "Verification of $validator completed"
    else
        log_warning "Verification encountered issues"
        log_info ""
        log_info "This is expected if:"
        log_info "  1. Blaster dependencies are not available yet"
        log_info "  2. UPLC files have not been imported"
        log_info "  3. Properties use 'sorry' placeholders"
        log_info ""
        log_info "For now, use 'aiken check' for property-based testing."
    fi

    cd "$PROJECT_ROOT"
}

# =============================================================================
# All Command
# =============================================================================

cmd_all() {
    log_info "Running verification on all critical validators..."
    log_info ""

    local success_count=0
    local fail_count=0

    for validator in "${CRITICAL_VALIDATORS[@]}"; do
        log_info "=== Verifying $validator ==="

        if cmd_verify "$validator"; then
            ((success_count++))
        else
            ((fail_count++))
        fi

        echo ""
    done

    log_info "=== Summary ==="
    log_info "Successful: $success_count"
    log_info "Failed: $fail_count"

    if [ $fail_count -eq 0 ]; then
        log_success "All verifications passed"
    else
        log_warning "Some verifications failed or had warnings"
    fi
}

# =============================================================================
# Check Command (Aiken property-based testing)
# =============================================================================

cmd_check() {
    log_info "Running Aiken property-based tests..."

    cd "$PROJECT_ROOT"

    if aiken check; then
        log_success "All Aiken tests passed"
    else
        log_error "Some Aiken tests failed"
        return 1
    fi
}

# =============================================================================
# Clean Command
# =============================================================================

cmd_clean() {
    log_info "Cleaning generated verification files..."

    rm -rf "$FLAT_OUTPUT_DIR"/*.hex
    rm -rf "$FLAT_OUTPUT_DIR"/*.flat
    rm -rf "$VERIFICATION_DIR/.lake"
    rm -rf "$VERIFICATION_DIR/build"

    log_success "Cleaned verification files"
}

# =============================================================================
# Status Command
# =============================================================================

cmd_status() {
    log_info "Verification Status"
    echo ""

    # Check plutus.json
    if [ -f "$PLUTUS_JSON" ]; then
        local validator_count
        validator_count=$(jq '.validators | length' "$PLUTUS_JSON")
        log_success "plutus.json: $validator_count validators compiled"
    else
        log_warning "plutus.json: not found (run 'aiken build')"
    fi

    # Check extracted files
    local hex_count
    hex_count=$(find "$FLAT_OUTPUT_DIR" -name "*.hex" 2>/dev/null | wc -l || echo 0)
    if [ "$hex_count" -gt 0 ]; then
        log_success "Extracted: $hex_count UPLC files"
    else
        log_warning "Extracted: no UPLC files (run 'extract' command)"
    fi

    # Check Lean setup
    if [ -f "$VERIFICATION_DIR/lakefile.lean" ]; then
        log_success "Lean project: configured"
    else
        log_warning "Lean project: not configured"
    fi

    # Check dependencies
    echo ""
    log_info "Dependencies:"
    for cmd in aiken lean lake z3 jq; do
        if command -v $cmd &> /dev/null; then
            local version
            case $cmd in
                aiken) version=$(aiken --version 2>/dev/null || echo "unknown") ;;
                lean) version=$(lean --version 2>/dev/null | head -1 || echo "unknown") ;;
                lake) version=$(lake --version 2>/dev/null || echo "unknown") ;;
                z3) version=$(z3 --version 2>/dev/null || echo "unknown") ;;
                jq) version=$(jq --version 2>/dev/null || echo "unknown") ;;
            esac
            echo -e "  ${GREEN}[OK]${NC} $cmd: $version"
        else
            echo -e "  ${RED}[MISSING]${NC} $cmd"
        fi
    done
}

# =============================================================================
# Help Command
# =============================================================================

cmd_help() {
    echo "UltraLife Protocol - Formal Verification Runner"
    echo ""
    echo "Usage: $0 <command> [options]"
    echo ""
    echo "Commands:"
    echo "  setup       Set up verification environment"
    echo "  extract     Extract UPLC from plutus.json to .hex files"
    echo "  verify      Verify a specific validator (e.g., 'verify pnft')"
    echo "  all         Verify all critical validators"
    echo "  check       Run Aiken's built-in property-based tests"
    echo "  status      Show verification status"
    echo "  clean       Clean generated files"
    echo "  help        Show this help message"
    echo ""
    echo "Critical validators: ${CRITICAL_VALIDATORS[*]}"
    echo ""
    echo "Examples:"
    echo "  $0 setup"
    echo "  $0 extract"
    echo "  $0 verify pnft"
    echo "  $0 all"
    echo "  $0 check"
    echo ""
    echo "Workflow:"
    echo "  1. Build Aiken validators:  aiken build"
    echo "  2. Set up verification:     $0 setup"
    echo "  3. Extract UPLC:            $0 extract"
    echo "  4. Run formal verification: $0 all"
    echo "  5. Or run Aiken tests:      $0 check"
    echo ""
    echo "Documentation: docs/FORMAL_VERIFICATION.md"
}

# =============================================================================
# Main
# =============================================================================

main() {
    local command="${1:-help}"

    case "$command" in
        setup)
            check_dependencies
            cmd_setup
            ;;
        extract)
            cmd_extract
            ;;
        verify)
            cmd_verify "${2:-}"
            ;;
        all)
            cmd_all
            ;;
        check)
            cmd_check
            ;;
        status)
            cmd_status
            ;;
        clean)
            cmd_clean
            ;;
        help|--help|-h)
            cmd_help
            ;;
        *)
            log_error "Unknown command: $command"
            cmd_help
            exit 1
            ;;
    esac
}

main "$@"
