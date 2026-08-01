# FireTVHome — Backlog / someday ideas

A running list of ideas we've talked through but haven't built yet, so they
don't just live in chat. Newest at the top. Nothing here is committed work —
it's a memory aid.

---

## Let him report that something's wrong

**Idea:** give Dad a way to flag that something isn't working or feels off —
kept general on purpose, and AI-assisted so he can *describe* it despite not
being able to type.

**Decisions so far:**
- **Where:** on the **"What's on my mind"** tree (a single leaf), **not** in the
  Care tree.
- **Look:** give it a **distinct color** so it reads as special/different from
  the normal options.
- **How it works:** reuse the **existing AI composer** — no new canned decision
  tree needed. The one leaf hands straight to the narrowing AI, seeded with
  something like *"help him describe what isn't working"*, and the AI does the
  drilling-down (the screen? a button? a message didn't send? confusing? just
  frustrated?), the same way it helps him build a message.
- **Where it goes:** route the result to **Dan specifically** — a flagged
  problem-report email + a distinct log event type — **not** the family page.

**Worth remembering when we build it:**
- Helps most with **soft problems** (confusing, wrong info, a message didn't
  send) because the UI still has to work for him to reach it. A hard failure
  (frozen screen) can't be self-reported — that still needs someone in the room.
- There's a **quiet emotional value**: it gives him *agency* — a way to say
  "this isn't right" and be heard directly, instead of waiting for it to show up
  in the logs.

---
