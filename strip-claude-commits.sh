#!/bin/bash
# strip-claude-commits.sh
#
# Strips Claude co-author signatures from recent commit messages.
# Rewrites history in place and force pushes to origin/main.
#
# Run from repo root.

set -e

echo "This will rewrite git history and force push to origin/main."
echo ""
read -p "Type YES to continue: " confirm
if [ "$confirm" != "YES" ]; then
  echo "Aborted."
  exit 0
fi

echo ""
echo "Rewriting commits..."

# Rewrite all commits — strip any line matching Claude signatures
git filter-branch --force --msg-filter '
  grep -v "Co-Authored-By: Claude" |
  grep -v "co-authored-by: claude" |
  grep -v "Generated with Claude" |
  grep -v "noreply@anthropic.com" |
  sed "/^[[:space:]]*$/{ N; /^\n$/d; }"
' -- --all

echo ""
echo "Force pushing to origin/main..."
git push --force origin main

echo ""
echo "Done. Claude signatures removed from all commits."
