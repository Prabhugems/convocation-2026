# Track Page Auto-Submit & Auto-Reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the public "Track Your Certificate" page (`/track`), auto-submit the search 5 seconds after the user stops typing/scanning, and auto-reset the page back to a blank search box 12 seconds after a result is shown — pausing that reset countdown while the visitor is actively interacting with the page.

**Architecture:** Both behaviors live entirely inside `TrackPage` (`src/app/track/page.tsx`), as two additional `useEffect` hooks alongside the existing address-fetch effect. The existing search logic in `handleSearch` is extracted into a `useCallback`-wrapped `performSearch(searchQuery: string)` so both the manual form submit and the new idle-timer effect can call the same code path. `clearSearch` is likewise wrapped in `useCallback` so the new reset effect can safely depend on it. A `lastSearchedQueryRef` prevents the idle timer from re-firing a search that was already run (manually, or by a previous auto-submit) for the same exact value.

**Tech Stack:** Next.js App Router, React 19, TypeScript. No test framework is present in this repo (`package.json` has no test script, no `*.test.*`/`*.spec.*` files exist) — verification is via `npm run lint`, `npm run build` (type-checks), and manual browser testing with the dev server, per the design spec and matching the convention used in `docs/superpowers/plans/2026-07-22-registration-browser-print.md`.

## Global Constraints

- No new npm dependencies — everything is built with React hooks already used elsewhere in this file.
- Scope is `src/app/track/page.tsx` only — no new files, no shared/reusable hook extraction (per the spec's non-goals: this behavior isn't needed anywhere else yet).
- Idle-submit delay: **5000ms**. Minimum auto-submit length: **3 characters** (trimmed). Result auto-reset delay: **12000ms**.
- Interaction events that pause/reset the 12s countdown: `click`, `keydown`, `scroll`, `touchstart`. Deliberately excludes `mousemove` (fires continuously, would effectively disable the timer).
- Auto-submit and auto-reset apply uniformly to every outcome type (found graduate, multiple matches, no results, error) — no kiosk-mode flag, no visible countdown UI.
- Reference design spec: `docs/superpowers/specs/2026-08-12-track-page-auto-submit-reset-design.md`.

---

### Task 1: Extract `performSearch` and add idle auto-submit

**Files:**
- Modify: `src/app/track/page.tsx:92-187` (component state block through `handleSearch`)

**Interfaces:**
- Produces: `performSearch(searchQuery: string): Promise<void>` — stable (`useCallback`, `[]` deps) function that runs the existing search-and-set-state logic. Consumed by `handleSearch` (this task) and by Task 2 is not needed, but future auto-submit logic and `handleSearch` both call it.
- Produces: `lastSearchedQueryRef: React.RefObject<string>` — holds the trimmed value of the most recently executed search (manual or auto), used to prevent duplicate auto-submits of the same value.

- [ ] **Step 1: Confirm current code matches expected line range**

Run: `grep -n "export default function TrackPage" -A 15 src/app/track/page.tsx`

Expected output starts with:
```
92:export default function TrackPage() {
93:  const [query, setQuery] = useState('');
94:  const [loading, setLoading] = useState(false);
95:  const [graduate, setGraduate] = useState<Graduate | null>(null);
96:  const [searchResults, setSearchResults] = useState<Graduate[]>([]);
97:  const [showResults, setShowResults] = useState(false);
98:  const [error, setError] = useState<string | null>(null);
99:  const [suggestions, setSuggestions] = useState<string[]>([]);
100:  const [searched, setSearched] = useState(false);
101:  const [addressData, setAddressData] = useState<AddressData | null>(null);
102:  const [addressLoading, setAddressLoading] = useState(false);
103:  const [showMobileGuide, setShowMobileGuide] = useState(false);
```

If line numbers have drifted, locate the block by content instead — the edits below match on exact code, not line numbers.

- [ ] **Step 2: Add the `useCallback`/`useRef` imports and the new refs**

Replace:
```typescript
import { useState, useEffect } from 'react';
```

With:
```typescript
import { useState, useEffect, useCallback, useRef } from 'react';
```

Replace:
```typescript
  const [showMobileGuide, setShowMobileGuide] = useState(false);

  // Determine current step based on graduate status
```

With:
```typescript
  const [showMobileGuide, setShowMobileGuide] = useState(false);

  const lastSearchedQueryRef = useRef<string>('');
  const idleSubmitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Determine current step based on graduate status
```

- [ ] **Step 3: Replace `handleSearch` with `performSearch` + a thin `handleSearch` wrapper**

Replace:
```typescript
  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setSuggestions([]);
    setSearched(true);
    setShowResults(false);
    setSearchResults([]);
    setGraduate(null);

    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
      const data = await response.json();

      if (data.success && data.data) {
        if (data.data.length === 1) {
          setGraduate(data.data[0]);
        } else if (data.data.length > 1) {
          setSearchResults(data.data);
          setShowResults(true);
        }
      } else {
        setGraduate(null);
        setError(data.error || 'Certificate not found.');
        if (data.suggestions) {
          setSuggestions(data.suggestions);
        }
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }
```

With:
```typescript
  const performSearch = useCallback(async (searchQuery: string) => {
    lastSearchedQueryRef.current = searchQuery;

    setLoading(true);
    setError(null);
    setSuggestions([]);
    setSearched(true);
    setShowResults(false);
    setSearchResults([]);
    setGraduate(null);

    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();

      if (data.success && data.data) {
        if (data.data.length === 1) {
          setGraduate(data.data[0]);
        } else if (data.data.length > 1) {
          setSearchResults(data.data);
          setShowResults(true);
        }
      } else {
        setGraduate(null);
        setError(data.error || 'Certificate not found.');
        if (data.suggestions) {
          setSuggestions(data.suggestions);
        }
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    await performSearch(trimmed);
  }

  // Auto-submit 5s after the user stops typing/scanning into the search box,
  // so an external scanner that doesn't send Enter still triggers a search.
  useEffect(() => {
    const trimmed = query.trim();

    if (idleSubmitTimerRef.current) {
      clearTimeout(idleSubmitTimerRef.current);
      idleSubmitTimerRef.current = null;
    }

    if (trimmed.length < 3) {
      return;
    }

    idleSubmitTimerRef.current = setTimeout(() => {
      if (trimmed !== lastSearchedQueryRef.current) {
        performSearch(trimmed);
      }
    }, 5000);

    return () => {
      if (idleSubmitTimerRef.current) {
        clearTimeout(idleSubmitTimerRef.current);
        idleSubmitTimerRef.current = null;
      }
    };
  }, [query, performSearch]);
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors related to `src/app/track/page.tsx`.

- [ ] **Step 5: Lint**

Run: `npm run lint`
Expected: no new warnings/errors for `src/app/track/page.tsx` (specifically no `react-hooks/exhaustive-deps` warning on the new effect — `performSearch` is a stable `useCallback` and is listed in the deps array).

- [ ] **Step 6: Manual verification — auto-submit fires after idle**

Run: `npm run dev`, open `http://localhost:3000/track` (or whichever port it starts on).

1. Type a known-good search value (e.g. a real convocation number from your data) into the search box, character by character, without pressing Enter or clicking "Track".
2. Stop typing and wait ~5 seconds without touching the page.
3. Expected: the search fires automatically — the "Track" button shows its loading spinner, then a result (or "No Results"/error) appears — with no click or Enter press.

- [ ] **Step 7: Manual verification — typing doesn't get interrupted, and manual submit still works**

1. Type a value character-by-character with small pauses (well under 5s) between characters.
2. Expected: no search fires while you're still actively typing (each keystroke should reset the 5s timer).
3. Clear the box, type a value, and immediately press Enter (or click "Track") before 5 seconds pass.
4. Expected: search fires immediately, same as before this change. Wait an additional 5+ seconds after that — expected: no second/duplicate search request fires (check the Network tab: only one `/api/search` request for that value).

- [ ] **Step 8: Commit**

```bash
git add src/app/track/page.tsx
git commit -m "Auto-submit track page search 5s after input goes idle"
```

---

### Task 2: Add auto-reset after a result is shown, paused while the visitor interacts

**Files:**
- Modify: `src/app/track/page.tsx` (the `clearSearch` function, and the JSX search `<input>`)

**Interfaces:**
- Consumes: `performSearch`, `lastSearchedQueryRef` from Task 1 (no direct call, but `clearSearch` resetting `lastSearchedQueryRef.current` interacts with Task 1's duplicate guard).
- Produces: `clearSearch(): void` — now a stable (`useCallback`, `[]` deps) function; same behavior as before plus resetting `lastSearchedQueryRef.current = ''`. Signature/name unchanged, so the existing "X" clear button JSX needs no changes.
- Produces: `searchInputRef: React.RefObject<HTMLInputElement>` — attached to the search `<input>`, used to refocus it after an auto-reset.

- [ ] **Step 1: Make `clearSearch` a stable `useCallback` and reset the dedupe ref**

Replace:
```typescript
  function clearSearch() {
    setQuery('');
    setGraduate(null);
    setSearchResults([]);
    setShowResults(false);
    setError(null);
    setSuggestions([]);
    setAddressData(null);
    setSearched(false);
  }
```

With:
```typescript
  const clearSearch = useCallback(() => {
    lastSearchedQueryRef.current = '';
    setQuery('');
    setGraduate(null);
    setSearchResults([]);
    setShowResults(false);
    setError(null);
    setSuggestions([]);
    setAddressData(null);
    setSearched(false);
  }, []);
```

- [ ] **Step 2: Add `searchInputRef` and the auto-reset effect**

Replace:
```typescript
  const lastSearchedQueryRef = useRef<string>('');
  const idleSubmitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
```

With:
```typescript
  const lastSearchedQueryRef = useRef<string>('');
  const idleSubmitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resultResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
```

Note: this task's effect goes after Task 1's idle-submit effect, and after `clearSearch` is defined (function declarations aren't hoisted for `const`, so ordering matters — place the effect below the `clearSearch` definition). Locate the end of `clearSearch` (from Step 1 above) and the start of `getStationStatus`, and insert between them:

Replace:
```typescript
    setAddressData(null);
    setSearched(false);
  }, []);

  function getStationStatus(stationId: string): 'completed' | 'pending' {
```

With:
```typescript
    setAddressData(null);
    setSearched(false);
  }, []);

  // Auto-reset back to a blank search box 12s after a result is shown,
  // pausing the countdown while the visitor interacts with the page.
  useEffect(() => {
    if (!searched || loading) {
      return;
    }

    function scheduleReset() {
      if (resultResetTimerRef.current) {
        clearTimeout(resultResetTimerRef.current);
      }
      resultResetTimerRef.current = setTimeout(() => {
        clearSearch();
        searchInputRef.current?.focus();
      }, 12000);
    }

    function handleInteraction() {
      scheduleReset();
    }

    scheduleReset();
    window.addEventListener('click', handleInteraction);
    window.addEventListener('keydown', handleInteraction);
    window.addEventListener('scroll', handleInteraction, { passive: true });
    window.addEventListener('touchstart', handleInteraction, { passive: true });

    return () => {
      if (resultResetTimerRef.current) {
        clearTimeout(resultResetTimerRef.current);
        resultResetTimerRef.current = null;
      }
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
      window.removeEventListener('scroll', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
    };
  }, [searched, loading, clearSearch]);

  function getStationStatus(stationId: string): 'completed' | 'pending' {
```

- [ ] **Step 3: Attach `searchInputRef` to the search input**

Replace:
```typescript
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Enter name, convocation no, email, or mobile..."
                  className="w-full pl-12 pr-12 py-3 bg-slate-700/50 border border-slate-600/50 rounded-xl text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
```

With:
```typescript
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Enter name, convocation no, email, or mobile..."
                  className="w-full pl-12 pr-12 py-3 bg-slate-700/50 border border-slate-600/50 rounded-xl text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors related to `src/app/track/page.tsx`.

- [ ] **Step 5: Lint**

Run: `npm run lint`
Expected: no new warnings/errors (specifically no `react-hooks/exhaustive-deps` warning on the new effect — `clearSearch` is a stable `useCallback` and is listed in the deps array).

- [ ] **Step 6: Manual verification — auto-reset fires when idle after a result**

Run: `npm run dev`, open `http://localhost:3000/track`.

1. Search for a known-good value (manual submit is fine).
2. Once a result (or "No Results"/error) is showing, don't touch the page at all — no click, key press, scroll, or touch.
3. Expected: after ~12 seconds, the page clears itself back to an empty search box, and the search input has focus (a blinking cursor should be visible in the box without clicking it).

- [ ] **Step 7: Manual verification — interaction pauses the reset**

1. Search for a known-good value again.
2. While the result is showing, scroll the page or click somewhere on it (e.g. the "Journey Timeline" card) roughly every 5 seconds, for at least 15 seconds total.
3. Expected: the result stays on screen the whole time — it does not clear itself while you're interacting.
4. Stop interacting and wait ~12 more seconds.
5. Expected: the page now clears itself.

- [ ] **Step 8: Manual verification — clearing manually cancels the pending reset**

1. Search for a known-good value.
2. Immediately click the "X" clear button in the search box.
3. Wait 15+ seconds.
4. Expected: nothing happens (the box was already empty; no stray reset fires later, no console errors).

- [ ] **Step 9: Full build check**

Run: `npm run build`
Expected: build succeeds with no type errors.

- [ ] **Step 10: Commit**

```bash
git add src/app/track/page.tsx
git commit -m "Auto-reset track page 12s after showing a result, pausing on interaction"
```
