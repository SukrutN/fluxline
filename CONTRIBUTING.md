# Contributing

Small rules that keep the history honest. They read like ceremony; each
one earned its place.

## Workflow

1. Branch from `main`, named for the work: `feature/<area>-<thing>`,
   `fix/<thing>`, `docs/<thing>`, `chore/<thing>`.
2. One unit of work per pull request. A PR carrying two ideas gets
   split.
3. Titles follow Conventional Commit style: `fix(app): …`,
   `feat(line): …`, `docs: …`.
4. The body answers three questions: what, why (for fixes: the root
   cause, not the symptom), and how it was verified.
5. Self-review the diff before the merge. Anything you would flag in a
   stranger's PR, fix here first.

## The gates

```bash
npm run lint    # eslint, zero errors required
npm run build   # next build, TypeScript included
```

CI runs both on every push and PR. Red CI doesn't merge — no
exceptions. (On Windows PowerShell, call `npm.cmd run lint`; execution
policy blocks the `npm.ps1` shim.)

## The voice rule

The copy on the page is operator voice: short sentences, no jargon,
written for the person on the plant floor. Engineering language lives in
issues, PRs, commit messages and this file. The two voices never mix.

## Commits

One change per commit; nothing parks. The message names the root cause —
a message readable a year from now, without the code in front of you, is
the bar.

## Merging

Merge commits preserve the unit of work as a named, discussed blob on
`main`. Branch protection requires the CI checks to pass on every PR.
