# Skill: New Feature

Load this skill when task.md says to.

## Steps
1. Read `task.md` fully — understand what to build and why
2. Check `docs/structure.md` — know where files live
3. Check `docs/data-registry.md` — know what already exists
4. Check `.claude/lessons.md` — know what mistakes to avoid
5. Plan: what files get created, what gets modified, what types are needed
6. Build one file at a time — typecheck after each
7. Write tests for any engine logic
8. Verify: `pnpm typecheck` clean, `pnpm test` passing
9. Update `docs/structure.md` and `docs/data-registry.md`
10. Run `bash .claude/hooks/stop.sh`
11. Commit
