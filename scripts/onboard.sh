#!/usr/bin/env bash
#
# Onboard this project's actors to the swiyu Sandbox.
#
# What this automates: the API-driven parts — claiming DID spaces, generating
# key material and DID logs, uploading them to the Base Registry, building and
# submitting proofs of possession, and publishing the Verification Query Public
# Statements.
#
# What it cannot automate, and does not pretend to:
#   * the ePortal account and business partner registration;
#   * subscribing to the three APIs and minting tokens;
#   * starting the trust onboarding in the swiyu Service Portal, which is what
#     creates the challenge this script then answers.
# Those bind a legal entity to a cryptographic identity and are a person's job.
#
# Private keys are generated on this machine, written under .swiyu/, and never
# sent anywhere. The DID log that *is* uploaded contains public keys only.
#
#   ./scripts/onboard.sh preflight
#   ./scripts/onboard.sh spaces            # read-only: tokens, and which environment
#   ./scripts/onboard.sh did praxis
#   ./scripts/onboard.sh trust-first praxis
#   ./scripts/onboard.sh did travel-clinic
#   ./scripts/onboard.sh trust-add praxis travel-clinic
#   ./scripts/onboard.sh vqps
#   ./scripts/onboard.sh env
#
set -euo pipefail

# Sandbox and production are separate infrastructures with separate hosts, and
# CD-001 forbids mixing them. Defaulting to the Sandbox is the safe default;
# `SWIYU_ENV=prod` switches, and either can be overridden outright.
readonly SWIYU_ENV="${SWIYU_ENV:-sandbox}"
case "$SWIYU_ENV" in
  sandbox) readonly _HOST_SUFFIX="swiyu-int.admin.ch" ;;
  prod)    readonly _HOST_SUFFIX="swiyu.admin.ch" ;;
  *) printf 'SWIYU_ENV must be "sandbox" or "prod", got %s\n' "$SWIYU_ENV" >&2; exit 1 ;;
esac
readonly IDENTIFIER_API="${SWIYU_IDENTIFIER_API:-https://identifier-reg-api.trust-infra.$_HOST_SUFFIX}"
readonly TRUST_API="${SWIYU_TRUST_API:-https://trust-reg-api.trust-infra.$_HOST_SUFFIX}"
readonly STATE_DIR="${SWIYU_STATE_DIR:-.swiyu}"
readonly ENV_FILE="${SWIYU_ENV_FILE:-.env.onboard}"

c_bold=$'\033[1m'; c_red=$'\033[31m'; c_green=$'\033[32m'; c_dim=$'\033[2m'; c_off=$'\033[0m'
say()  { printf '%s\n' "$*"; }
step() { printf '%s\n' "${c_bold}$*${c_off}"; }
ok()   { printf '%s\n' "${c_green}✓${c_off} $*"; }
warn() { printf '%s\n' "${c_red}!${c_off} $*" >&2; }
die()  { printf '%s\n' "${c_red}✗ $*${c_off}" >&2; exit 1; }
dim()  { printf '%s\n' "${c_dim}$*${c_off}"; }

load_env() {
  [[ -f "$ENV_FILE" ]] || die "$ENV_FILE not found. Copy .env.onboard.example and fill it in."
  # shellcheck disable=SC1090
  set -a; source "$ENV_FILE"; set +a
}

require_var() {
  local name="$1"
  [[ -n "${!name:-}" ]] || die "$name is not set in $ENV_FILE"
}

# Fail loudly on an HTTP error instead of writing the error body to a state file.
api() {
  local method="$1" url="$2" token="$3"; shift 3
  local body status
  body="$(curl -sS -w $'\n%{http_code}' -X "$method" "$url" \
            -H "Authorization: Bearer $token" "$@")" || die "curl failed: $method $url"
  status="${body##*$'\n'}"
  body="${body%$'\n'*}"
  if [[ "$status" -lt 200 || "$status" -ge 300 ]]; then
    warn "$method $url → HTTP $status"
    printf '%s\n' "$body" >&2
    exit 1
  fi
  printf '%s' "$body"
}

didtoolbox() {
  java -jar "$DIDTOOLBOX_JAR" "$@"
}

# The DID log's exact JSON shape has changed between did:tdw and did:webvh, so
# read the identifier out of it textually rather than depending on a layout.
did_from_log() {
  grep -o 'did:webvh:[^"#]*' "$1" | head -1
}

# didtoolbox names its generated keys itself; detect rather than assume.
assert_key_path() {
  local dir="$1"
  for candidate in "$dir/.didtoolbox/assert-key-01" "$dir/.didtoolbox/assert-key-1"; do
    [[ -f "$candidate" ]] && { printf '%s' "$candidate"; return; }
  done
  local found
  found="$(find "$dir/.didtoolbox" -maxdepth 1 -type f -name 'assert*' ! -name '*.pub' 2>/dev/null | head -1)"
  [[ -n "$found" ]] || die "no assertion private key found under $dir/.didtoolbox — list it and set ASSERT_KEY_FILE"
  printf '%s' "$found"
}

# Read a JWT's payload without verifying it. We are inspecting our own token
# to give a better error message, not making a trust decision on it.
jwt_payload() {
  local payload="${1#*.}"; payload="${payload%%.*}"
  payload="$(tr '_-' '/+' <<<"$payload")"
  while (( ${#payload} % 4 )); do payload+='='; done
  base64 -d <<<"$payload" 2>/dev/null
}

# An access token carries the APIs its application is subscribed to. Checking
# that here turns a mystifying 401 four steps later into a sentence naming the
# subscription that is missing.
check_token() {
  local label="$1" token="$2" needed_api="$3"
  if [[ -z "$token" ]]; then
    warn "$label: no token set"
    return 1
  fi
  local payload; payload="$(jwt_payload "$token")"
  if [[ -z "$payload" ]]; then
    warn "$label: could not read the token payload — is it a full JWT?"
    return 1
  fi

  local exp now
  exp="$(jq -r '.exp // 0' <<<"$payload")"
  now="$(date +%s)"
  if (( exp <= now )); then
    warn "$label: expired $(( (now - exp) / 3600 ))h ago — mint a new one in the portal"
    return 1
  fi

  local subscribed
  subscribed="$(jq -r '[.subscribedAPIs[]?.name] | join(", ")' <<<"$payload")"
  if ! jq -e --arg api "$needed_api" 'any(.subscribedAPIs[]?; .name == $api)' <<<"$payload" >/dev/null; then
    warn "$label: this application is not subscribed to $needed_api"
    dim "    subscribed to: ${subscribed:-nothing}"
    dim "    Fix: in the API self-service portal, subscribe this application to"
    dim "    $needed_api, then refresh its tokens so the new scope is included."
    return 1
  fi

  local token_partner
  token_partner="$(jq -r '.bproles | keys[0] // empty' <<<"$payload")"
  if [[ -n "$token_partner" && -n "${PARTNER_ID:-}" && "$token_partner" != "$PARTNER_ID" ]]; then
    warn "$label: token is for business partner $token_partner, but PARTNER_ID is $PARTNER_ID"
    return 1
  fi

  ok "$label — $needed_api, valid $(( (exp - now) / 3600 ))h"
  return 0
}

state_file() { printf '%s/%s/state.env' "$STATE_DIR" "$1"; }

load_state() {
  local file; file="$(state_file "$1")"
  [[ -f "$file" ]] || die "no state for actor '$1' — run: $0 did $1"
  # shellcheck disable=SC1090
  set -a; source "$file"; set +a
}

cmd_preflight() {
  step "Preflight"
  local missing=0
  for tool in curl jq java; do
    if command -v "$tool" >/dev/null 2>&1; then ok "$tool"; else warn "$tool is not installed"; missing=1; fi
  done
  if [[ -n "${DIDTOOLBOX_JAR:-}" && -f "${DIDTOOLBOX_JAR}" ]]; then
    ok "didtoolbox at $DIDTOOLBOX_JAR ($(didtoolbox --version 2>&1 | head -1))"
  else
    warn "set DIDTOOLBOX_JAR to didtoolbox.jar 2.1.0 or newer"
    dim "    https://github.com/swiyu-admin-ch/didtoolbox-java/releases/latest"
    missing=1
  fi
  if [[ -f "$ENV_FILE" ]]; then
    load_env
    if [[ -n "${PARTNER_ID:-}" ]]; then ok "PARTNER_ID $PARTNER_ID"; else warn "PARTNER_ID missing"; missing=1; fi
    check_token "identifier token" "${SWIYU_IDENTIFIER_REGISTRY_ACCESS_TOKEN:-}" swiyucorebusiness_identifier || missing=1
    check_token "trust token"      "${SWIYU_TRUST_REGISTRY_ACCESS_TOKEN:-}"      swiyucorebusiness_trust      || missing=1
    if [[ -n "${SWIYU_STATUS_REGISTRY_ACCESS_TOKEN:-}" ]]; then
      check_token "status token"   "${SWIYU_STATUS_REGISTRY_ACCESS_TOKEN}"       swiyucorebusiness_status     || missing=1
    else
      dim "    status token not set — only needed once the issuer runs, not for onboarding"
    fi
  else
    warn "$ENV_FILE not found"
    missing=1
  fi
  [[ "$missing" -eq 0 ]] || die "preflight failed"
  say
  ok "Ready. Next: $0 did praxis"
}

# Read-only reconnaissance. Costs nothing, changes nothing, and answers the two
# questions worth answering before creating a chargeable DID: do the tokens
# work, and which swiyu environment is this business partner provisioned in?
cmd_spaces() {
  load_env; require_var PARTNER_ID; require_var SWIYU_IDENTIFIER_REGISTRY_ACCESS_TOKEN

  step "DID spaces for $PARTNER_ID"
  dim "    via $IDENTIFIER_API (SWIYU_ENV=$SWIYU_ENV)"
  local spaces
  spaces="$(api GET "$IDENTIFIER_API/api/v1/identifier/business-entities/$PARTNER_ID/identifier/" \
              "$SWIYU_IDENTIFIER_REGISTRY_ACCESS_TOKEN")"

  local count
  count="$(jq -r '[.content[]?] | length' <<<"$spaces")"
  if [[ "$count" == "0" ]]; then
    warn "no DID spaces provisioned yet"
    dim "    '$0 did <name>' would request one, and each DID is chargeable."
    return 0
  fi

  jq -r '.content[]? | "  " + (.status // "?") + "  " + .id + "  " + .identifierRegistryUrl' <<<"$spaces"

  # The DID is derived from identifierRegistryUrl, so that host — not the API
  # host we called — decides which environment the DID actually lives in.
  local host
  host="$(jq -r '[.content[]?][0].identifierRegistryUrl // empty' <<<"$spaces" | sed -E 's#https?://([^/]+)/.*#\1#')"
  say
  if [[ -z "$host" ]]; then
    warn "could not read an identifierRegistryUrl to determine the environment"
  elif [[ "$host" == *swiyu-int.admin.ch ]]; then
    ok "these DIDs will live on the SANDBOX ($host)"
    [[ "$SWIYU_ENV" == "sandbox" ]] || warn "but SWIYU_ENV=$SWIYU_ENV — you are calling the wrong API host"
  elif [[ "$host" == *swiyu.admin.ch ]]; then
    warn "these DIDs will live on PRODUCTION ($host)"
    dim "    This project's generated config points at the Sandbox. Either ask for a"
    dim "    Sandbox business partner, or regenerate config against the production"
    dim "    hosts and understand that CD-001 separates the two wallets."
  else
    warn "unrecognised registry host: $host"
  fi

  local free
  free="$(jq -r '[.content[]? | select(.status=="NOT_INITIALIZED")] | length' <<<"$spaces")"
  say
  say "$free space(s) ready to use, $((count - free)) already initialised."
}

# Claim a DID space, generate keys and a DID log locally, upload the log.
cmd_did() {
  local name="${1:?usage: $0 did <actor-name>}"
  load_env; require_var PARTNER_ID; require_var SWIYU_IDENTIFIER_REGISTRY_ACCESS_TOKEN
  [[ -n "${DIDTOOLBOX_JAR:-}" ]] || die "DIDTOOLBOX_JAR is not set"

  local dir="$STATE_DIR/$name"
  [[ -f "$dir/did.jsonl" ]] && die "actor '$name' already has a DID log at $dir/did.jsonl"
  mkdir -p "$dir"

  step "1/3 Finding a DID space for '$name'"
  local spaces entry_id registry_url
  spaces="$(api GET "$IDENTIFIER_API/api/v1/identifier/business-entities/$PARTNER_ID/identifier/" \
              "$SWIYU_IDENTIFIER_REGISTRY_ACCESS_TOKEN")"
  entry_id="$(jq -r '[.content[]? | select(.status=="NOT_INITIALIZED")][0].id // empty' <<<"$spaces")"
  registry_url="$(jq -r '[.content[]? | select(.status=="NOT_INITIALIZED")][0].identifierRegistryUrl // empty' <<<"$spaces")"

  if [[ -z "$entry_id" ]]; then
    # Requesting a space costs money. Make that an explicit decision rather
    # than something that happens because a loop ran one more time.
    if [[ "${CREATE_SPACE:-}" != "yes" ]]; then
      warn "no uninitialised DID space is available for '$name'"
      dim "    Requesting a new one is CHARGEABLE. If that is intended, re-run with:"
      dim "      CREATE_SPACE=yes $0 did $name"
      dim "    Check what you already have first:  $0 spaces"
      exit 1
    fi
    dim "    requesting a new DID space (chargeable, CREATE_SPACE=yes given)"
    local created
    created="$(api POST "$IDENTIFIER_API/api/v1/identifier/business-entities/$PARTNER_ID/identifier-entries/" \
                 "$SWIYU_IDENTIFIER_REGISTRY_ACCESS_TOKEN" -H 'Content-Type: application/json')"
    entry_id="$(jq -r '.id' <<<"$created")"
    registry_url="$(jq -r '.identifierRegistryUrl' <<<"$created")"
  fi
  [[ -n "$entry_id" && "$entry_id" != "null" ]] || die "could not obtain a DID space"
  ok "space $entry_id"

  step "2/3 Generating keys and the DID log"
  # didtoolbox writes .didtoolbox/ relative to the working directory, so run it
  # from the actor's own directory to keep each actor's keys separate.
  ( cd "$dir" && didtoolbox create --identifier-registry-url "$registry_url" > did.jsonl )
  local did; did="$(did_from_log "$dir/did.jsonl")"
  [[ -n "$did" ]] || die "could not read a did:webvh identifier out of $dir/did.jsonl"
  ok "$did"
  dim "    private keys: $dir/.didtoolbox/ — back these up, they are not recoverable"

  step "3/3 Uploading the DID log"
  api PUT "$IDENTIFIER_API/api/v1/identifier/business-entities/$PARTNER_ID/identifier-entries/$entry_id" \
      "$SWIYU_IDENTIFIER_REGISTRY_ACCESS_TOKEN" \
      -H 'Content-Type: application/jsonl+json' --data-binary "@$dir/did.jsonl" >/dev/null
  ok "published and resolvable"

  cat > "$(state_file "$name")" <<STATE
ACTOR_NAME=$name
ENTRY_ID=$entry_id
IDENTIFIER_REGISTRY_URL=$registry_url
DID=$did
STATE
  say
  say "Next: open the swiyu Service Portal and start the trust onboarding for this DID,"
  say "then run:  $0 trust-first $name"
  dim "  https://portal.trust-infra.swiyu-int.admin.ch"
}

# Answer the trust-onboarding challenge for the first DID.
cmd_trust_first() {
  local name="${1:?usage: $0 trust-first <actor-name>}"
  load_env; require_var SWIYU_TRUST_REGISTRY_ACCESS_TOKEN
  load_state "$name"
  local dir="$STATE_DIR/$name"

  step "Fetching the challenge"
  local pending nonce challenge_did
  pending="$(api GET "$TRUST_API/api/v1/trust/trust-onboarding-submission/proof-of-possessions" \
               "$SWIYU_TRUST_REGISTRY_ACCESS_TOKEN")"
  nonce="$(jq -r --arg did "$DID" '[.[]? | select(.did==$did)][0].nonce // empty' <<<"$pending")"
  challenge_did="$(jq -r --arg did "$DID" '[.[]? | select(.did==$did)][0].did // empty' <<<"$pending")"
  if [[ -z "$nonce" ]]; then
    warn "no pending challenge for $DID"
    dim "    Start the trust onboarding in the Service Portal first; the registry issues the"
    dim "    nonce there. Pending challenges right now:"
    jq -r '.[]?.did // "  (none)"' <<<"$pending" >&2
    exit 1
  fi
  ok "challenge for ${challenge_did}"

  step "Signing the proof of possession"
  local key; key="$(assert_key_path "$dir")"
  local pop; pop="$(didtoolbox create-pop -d "$dir/did.jsonl" -k "${DID}#assert-key-01" -s "$key" -n "$nonce")"
  [[ -n "$pop" ]] || die "didtoolbox produced no PoP"
  ok "signed (valid 24 hours)"

  step "Submitting"
  api POST "$TRUST_API/api/v1/trust/trust-onboarding-submission/proof-of-possessions" \
      "$SWIYU_TRUST_REGISTRY_ACCESS_TOKEN" -H 'Content-Type: application/json' \
      --data "$(jq -n --arg p "$pop" '{proofOfPossessions:[$p]}')" >/dev/null
  ok "$name is registered in the trust registry"
  say
  say "Next DID:  $0 did <name>  then  $0 trust-add $name <name>"
}

# Add a further DID, authorised by an already-registered one.
cmd_trust_add() {
  local permission="${1:?usage: $0 trust-add <registered-actor> <new-actor>}"
  local newcomer="${2:?usage: $0 trust-add <registered-actor> <new-actor>}"
  load_env; require_var SWIYU_TRUST_REGISTRY_ACCESS_TOKEN

  local perm_dir="$STATE_DIR/$permission" new_dir="$STATE_DIR/$newcomer"
  load_state "$permission"; local PERMISSION_DID="$DID"
  load_state "$newcomer";   local NEW_DID="$DID"

  step "Opening the submission"
  local submission id nonce
  submission="$(api POST "$TRUST_API/api/v1/trust/trust-add-dids-submissions" \
                  "$SWIYU_TRUST_REGISTRY_ACCESS_TOKEN" -H 'Content-Type: application/json' \
                  --data "$(jq -n --arg p "$PERMISSION_DID" --arg n "$NEW_DID" \
                            '{permissionDid:$p, didsToAdd:[$n]}')")"
  id="$(jq -r '.id' <<<"$submission")"
  nonce="$(jq -r '.nonce' <<<"$submission")"
  ok "submission $id"

  step "Signing with both DIDs"
  # Both the authorising DID and the newcomer sign the same nonce: one proves
  # the right to add, the other proves control of what is being added.
  local pop1 pop2
  pop1="$(didtoolbox create-pop -d "$perm_dir/did.jsonl" -k "${PERMISSION_DID}#assert-key-01" \
            -s "$(assert_key_path "$perm_dir")" -n "$nonce")"
  pop2="$(didtoolbox create-pop -d "$new_dir/did.jsonl" -k "${NEW_DID}#assert-key-01" \
            -s "$(assert_key_path "$new_dir")" -n "$nonce")"
  ok "two proofs"

  step "Submitting"
  api POST "$TRUST_API/api/v1/trust/trust-add-dids-submissions/$id" \
      "$SWIYU_TRUST_REGISTRY_ACCESS_TOKEN" -H 'Content-Type: application/json' \
      --data "$(jq -n --arg a "$pop1" --arg b "$pop2" '{proofOfPossessions:[$a,$b]}')" >/dev/null
  ok "$newcomer added to the trust registry"
}

# Publish what each verifier asks for.
cmd_vqps() {
  load_env
  local args=()
  for name in praxis pharmacy travel-clinic insurer; do
    local file; file="$(state_file "$name")"
    [[ -f "$file" ]] || continue
    local did; did="$(grep '^DID=' "$file" | cut -d= -f2-)"
    case "$name" in
      praxis)        args+=("PRAXIS_DID=$did") ;;
      pharmacy)      args+=("PHARMACY_DID=$did") ;;
      travel-clinic) args+=("TRAVEL_CLINIC_DID=$did") ;;
      insurer)       args+=("INSURER_DID=$did") ;;
    esac
  done
  step "Publishing Verification Query Public Statements"
  env "${args[@]}" SWIYU_TRUST_REGISTRY_ACCESS_TOKEN="${SWIYU_TRUST_REGISTRY_ACCESS_TOKEN:-}" \
    npx tsx scripts/vqps.ts "${@:---submit}"
}

# Emit the DIDs and verification methods for .env / docker-compose.
cmd_env() {
  say "# Generated by scripts/onboard.sh — DIDs and verification methods."
  say "# Private keys stay in $STATE_DIR/<actor>/.didtoolbox/ and are NOT printed here."
  for dir in "$STATE_DIR"/*/; do
    [[ -f "$dir/state.env" ]] || continue
    local name did prefix
    name="$(basename "$dir")"
    did="$(grep '^DID=' "$dir/state.env" | cut -d= -f2-)"
    case "$name" in
      praxis)        prefix=PRAXIS ;;
      pharmacy)      prefix=PHARMACY ;;
      travel-clinic) prefix=TRAVEL_CLINIC ;;
      insurer)       prefix=INSURER ;;
      *)             prefix="$(tr '[:lower:]-' '[:upper:]_' <<<"$name")" ;;
    esac
    say
    say "${prefix}_DID=$did"
    say "${prefix}_SDJWT_VERIFICATION_METHOD=${did}#assert-key-01"
    say "${prefix}_STATUS_LIST_VERIFICATION_METHOD=${did}#assert-key-02"
    say "${prefix}_AUTH_VERIFICATION_METHOD=${did}#auth-key-01"
    say "# ${prefix}_SDJWT_KEY / _STATUS_LIST_KEY / _AUTH_KEY: paste from $dir.didtoolbox/"
  done
}

case "${1:-}" in
  preflight)   shift; cmd_preflight "$@" ;;
  spaces)      shift; cmd_spaces "$@" ;;
  did)         shift; cmd_did "$@" ;;
  trust-first) shift; cmd_trust_first "$@" ;;
  trust-add)   shift; cmd_trust_add "$@" ;;
  vqps)        shift; cmd_vqps "$@" ;;
  env)         shift; cmd_env "$@" ;;
  *)
    sed -n '3,28p' "$0" | sed 's/^# \{0,1\}//'
    exit 1
    ;;
esac
