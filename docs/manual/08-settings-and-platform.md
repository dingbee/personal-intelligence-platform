# Chapter 8: Settings & Platform

## Purpose

Settings is where you control how NOVA operates rather than what it knows — which AI providers it uses, how workspaces are managed, and what NOVA remembers about you as a person, not just as an account.

## Feature Overview

- **Provider Control Center** — see every configured AI provider's status, test connectivity, and understand which models are available
- **Default provider resolution + overrides** — set an account-wide default provider, with the ability to override it per-context where needed
- **Workspace management** — the same create/switch/archive controls available from the sidebar, with more detail here
- **Memory management** — review and manage what NOVA has learned or been told about you (explicit facts, learned preferences, conversation-derived context)
- **AI Health** — provider-level observability (latency, success rate, fallback events) — see Chapter 3
- **Mobile nav drawer** — the mobile-responsive navigation shell that makes the whole platform usable on a phone, not just desktop

## Navigation

- **Settings** (sidebar) — the main settings page, with sub-sections for Workspaces, Memory, and AI Health

## Real-World Examples

- You've configured multiple AI providers — the Provider Control Center shows you at a glance which are actually reachable right now, before you try to use one in Chat and hit a failure.
- NOVA has learned you prefer concise answers over long ones from repeated conversation patterns — that's visible and manageable from Memory, not a silent, unaccountable adjustment.
- On your phone, the mobile nav drawer gives you the same navigation the desktop sidebar does, adapted to a small screen rather than a stripped-down subset.

## Typical Workflows

1. **Set up providers once**: configure your AI providers, verify connectivity in the Control Center, and set a sensible default — most day-to-day use shouldn't require touching this again.
2. **Review memory periodically**: check what NOVA has learned about you occasionally, especially if a Chat response's personalization feels off — the "how NOVA uses this" explanation on each memory item shows exactly what it's influencing.
3. **Manage workspaces from Settings when doing bulk changes**: the sidebar switcher is for day-to-day switching; Settings → Workspaces is better for archiving or reorganizing several at once.

## Best Practices

- Don't over-configure provider overrides — the default resolution chain (account default → provider chain fallback) is designed to handle most cases; overrides are for genuine exceptions.
- Periodically check AI Health if something feels slow — provider-level latency issues show up there before they'd otherwise be obvious.
- Archive workspaces you're not actively using rather than deleting them — archived workspaces are excluded from the default view but not destroyed.

## Common Mistakes

- Assuming a provider shown as available in Settings will always succeed — availability reflects configuration/reachability at a point in time, not a live guarantee for every future request (that's what the fallback chain in Chat is for).
- Not realizing memory categories are distinct — explicit facts (things you directly told NOVA), learned preferences (inferred from behavior), and conversation memory (context from past chats) are managed and weighted differently.

## Related Features

- **Chat & AI** (Chapter 3) — provider configuration and memory both directly shape Chat behavior

## AI Capabilities

- Learned preferences are inferred from usage patterns, not manually declared — this is the one genuinely AI-driven part of this chapter
- Provider health scoring and fallback routing are deterministic engineering, not AI-driven

## Limitations

- No per-workspace provider defaults yet — provider configuration is account-wide with per-conversation override, not per-workspace

## Future Roadmap

- Nothing specific is currently scoped for this chapter beyond ongoing refinement alongside the rest of the platform
