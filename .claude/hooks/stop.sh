#!/bin/bash
# Session end enforcement. Called by Stop hook in settings.json.
# Exit 2 = block. Exit 0 = allow.

set -e
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo ".")
cd "$REPO_ROOT"

PASS=true
WARNINGS=()

echo ""
echo "╔══════════════════════════════════════╗"
echo "║    CORNER GYM — SESSION END CHECK    ║"
echo "╚══════════════════════════════════════╝"
echo ""

# 1. TypeScript
echo "▶ TypeScript..."
if pnpm typecheck --silent 2>/dev/null; then
  echo "  ✓ clean"
else
  echo "  ✗ errors — run pnpm typecheck"
  PASS=false
fi

# 2. Tests
echo "▶ Tests..."
if pnpm test --silent 2>/dev/null; then
  echo "  ✓ passing"
else
  echo "  ✗ failing — run pnpm test"
  PASS=false
fi

# 3. structure.md in sync
echo "▶ structure.md..."
NEW_FILES=$(git status --short 2>/dev/null | grep "^?" | grep -v node_modules | grep -v .DS_Store || true)
STRUCTURE_TOUCHED=$(git diff --name-only 2>/dev/null | grep "docs/structure.md" || true)
if [ -n "$NEW_FILES" ] && [ -z "$STRUCTURE_TOUCHED" ]; then
  echo "  ⚠ new files detected but structure.md not updated"
  WARNINGS+=("Update docs/structure.md")
else
  echo "  ✓ looks current"
fi

# 4. data-registry.md in sync
echo "▶ data-registry.md..."
DATA_TOUCHED=$(git diff --name-only 2>/dev/null | grep "packages/engine/data" || true)
REGISTRY_TOUCHED=$(git diff --name-only 2>/dev/null | grep "docs/data-registry.md" || true)
if [ -n "$DATA_TOUCHED" ] && [ -z "$REGISTRY_TOUCHED" ]; then
  echo "  ⚠ data files changed but data-registry.md not updated"
  WARNINGS+=("Update docs/data-registry.md")
else
  echo "  ✓ looks current"
fi

# 5. Uncommitted changes
echo "▶ Git status..."
UNCOMMITTED=$(git status --short 2>/dev/null | grep -v "^?" | grep -v node_modules || true)
if [ -n "$UNCOMMITTED" ]; then
  echo "  ⚠ uncommitted changes"
  WARNINGS+=("Commit: git add . && git commit -m 'your message'")
else
  echo "  ✓ clean"
fi

# Summary
echo ""
echo "──────────────────────────────────────"

if [ ${#WARNINGS[@]} -gt 0 ]; then
  echo "⚠  Before you finish:"
  for w in "${WARNINGS[@]}"; do
    echo "   → $w"
  done
  echo ""
fi

if [ "$PASS" = false ]; then
  echo "✗ Cannot close — fix TypeScript or test failures first."
  echo ""
  exit 2
fi

echo "✓ All checks passed."
echo ""
exit 0
