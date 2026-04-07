#!/bin/bash
# Wipes git history and starts fresh.
# Your remote URL stays the same.
# Run from repo root.

set -e

echo "⚠  This permanently deletes all git history."
echo "Directory: $(pwd)"
echo ""
read -p "Type YES to continue: " confirm

if [ "$confirm" != "YES" ]; then
  echo "Aborted."
  exit 0
fi

rm -rf .git
git init
git branch -M main
git add .
git commit -m "init: Corner Gym — clean start"

echo ""
echo "Done. Now connect your remote:"
echo "  git remote add origin <your-repo-url>"
echo "  git push --force origin main"
