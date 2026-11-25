# claude-mods

Mods for Claude Code.

## usage-meter

A one-line band above the prompt that shows how much you're using:

```
ctx ███░░░░░ 38%   5h ██░░░░ 31% (2h14m)   wk █░░░░░ 12% (4d6h)   ~$0.842 est
```

- **ctx**: how full the conversation's context window is.
- **5h / wk**: your rate-limit windows, with the time until each resets.
- **~$ est**: estimated session cost (a local list-price estimate, not your bill).

Bars are green, turn yellow at 70% and red at 90%. A rate-limit bar also turns
yellow, with an "out in ~Xh" note, when your average pace so far would use up
the limit before it resets (after the first tenth of the window).

## Install

At the prompt of a terminal session:

```
/plugin install usage-meter --marketplace Pillar-TechnologyAI/claude-mods
```

From a shell:

```bash
claude plugin install usage-meter --marketplace Pillar-TechnologyAI/claude-mods
```

In the desktop app, where `/plugin` does not run: click **+** next to the prompt
box, then **Plugins**, **Add marketplace** with `Pillar-TechnologyAI/claude-mods`,
then **Add plugin**.

This repository is private: installing needs read access to it on GitHub and a
git credential for github.com on that machine (an SSH key, or `gh auth login`
then `gh auth setup-git`).
