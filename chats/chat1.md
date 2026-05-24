# NextGen Scholars website

_Started 2026-05-24 03:37 UTC_

---

## User

Create a high-fidelity, mobile-first website for NextGen Scholars (NGS) — a privately funded mentorship program based in the Philippines with the tagline "One generation lifts another."
Two tracks:

NextGen Nurses (NGN) — supports Filipino nursing students through university and into international licensure (NCLEX-USA, with Australia as secondary). Icon: airplane or nurse silhouette.
NextGen Hospitality (NGH) — vocational track: English bootcamp → TESDA NC II → luxury hotel → international cruise placement. Icon: cruise ship.

Sections (in order):

Hero — full-width, tagline prominent, dark navy background, gold accent, subtle Philippine flag colors
About — what NGS is, who funds it, the mission
Our Tracks — two cards side by side: NGN and NGH with icons, descriptions, and pathway steps
Scholar Milestones — timeline or progress bar showing the journey from high school → university → licensure → international placement
Meet the Scholars — placeholder cards for Claire (NGN, Year 2), April (NGN, Grade 11 trial), Aljane (NGH, paused)
Apply / Contact — simple CTA section

Design direction:

Color palette: deep navy (#1B2A4A) + gold (#C9A84C) + white, clean sans-serif typography
Warm but serious tone — this changes lives, not a charity site
Modern, professional, aspirational
Export-ready as HTML

## Assistant

_[tool: update_todos]_

I'll build this as a polished mobile-first site for NextGen Scholars. Given the mission and tone, I'm committing to an editorial aesthetic: warm serif headings (Newsreader) paired with a clean sans (Manrope), deep navy field with gold accents, and Philippine flag colors as subtle texture (a small red triangle accent, sun-ray detail in the hero). I'll frame it in an iOS device on a canvas so you can see it mobile-first, with tweaks to compare palettes and a desktop view.

Let me plan and build.

_[tool: copy_starter_component]_

_[tool: copy_starter_component]_

_[tool: copy_starter_component]_

_[tool: read_file]_

_[tool: write_file]_

_[tool: write_file]_

I have what I need. I'll keep this in a single deliverable HTML site and present it inside an iOS frame, with a Tweaks panel for palette/font/viewport variations. Let me build.

_[tool: write_file]_

_[tool: write_file]_

Now the host shell with the iOS frame and Tweaks.

_[tool: grep]_

_[tool: read_file]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

Now let me verify it loads cleanly.

_[tool: show_html]_

_[tool: done]_

_[tool: update_todos]_

_[tool: fork_verifier_agent]_

Built — NextGen Scholars site mounted in an iPhone frame on a navy stage.

**Design decisions**
- **Type**: Newsreader (warm editorial serif) for display + italics, Manrope for UI/body, IBM Plex Mono for tags/eyebrows.
- **Color**: Deep navy `#1B2A4A` field, gold `#C9A84C` accent, warm paper `#FAF7F0` for light sections. PH flag colors used subtly — a fading red triangle + three gold sun rays in the hero, red border on a paused scholar badge.
- **Tone**: editorial gravity rather than charity-site warmth — pull-quote serif italics, mono micro-labels, dotted underlines for pathway steps.

**Sections**: sticky nav → hero (full-bleed, animated dot, scroll cue, stat trio) → About with three numbered pillars → Tracks with NGN (plane icon) and NGH (ship icon) cards showing primary/secondary licensure targets + numbered pathway → tappable 5-stage journey timeline with done/now/next states → three scholar cards (Claire/April/Aljane) with portrait placeholders, status badges, pull-quotes, progress bars → Apply form with validated nomination flow → footer.

**Tweaks** (toolbar toggle): swap viewport (Mobile iPhone ↔ Desktop browser chrome), three palette options (Navy + Gold / Midnight + Copper / Ink + Champagne), three type pairings.

**Caveats / next steps**
- Scholar portraits are intentional placeholders — drop real photos in `.ngs-scholar-photo` when ready.
- Form is client-only validated; wire up `hello@nextgenscholars.ph` or a real backend when you have one.
- Want me to add a private donors page, FAQ, or a track-comparison view?

## User

Verifier agent check completed

## Assistant

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

The padding fix shows the nav initially, but when scrolled the sticky nav will still slide under the dynamic island. Better fix: extend the nav itself to start at y=0 so its sticky background covers the status bar area when scrolled — the island (z:50) stays painted on top of the nav (z:30).

_[tool: done]_

_[tool: fork_verifier_agent]_

Fixed — extended the sticky nav's top padding to 64px in mobile context so its blurred background covers the status-bar area when scrolled. The dynamic island stays painted on top (z:50 > nav z:30).

## User

Verifier agent check completed

## Assistant

_[tool: str_replace_edit]_

_[tool: done]_

_[tool: fork_verifier_agent]_

Fixed — removed `overflow-x: hidden` on `.ngs-site` so the inner iOS-frame scroller is once again the nearest scrolling ancestor and sticky binds correctly.

## User

Verifier agent check completed

## Assistant

All clear — sticky nav works correctly, no horizontal overflow, brand text fully visible past the dynamic island. The NextGen Scholars site is ready to review.

## User

Please correct the following data errors throughout the design:
Hero stats:

Change "3 Scholars in 2026" to "2 Active · 1 Paused"

About section:

Replace "Funded by a small circle of family donors" with "Funded by a single private donor"

"Held the whole way" section:

Replace "From high school through licensure and placement" with: "Support begins two years before university — partially during the final two years of high school (select expenses only), then fully from university onward through licensure and international placement."

NextGen Nurses track card:

Primary and Secondary labels are misleading. Replace with: "Target: NCLEX-USA + Australia AHPRA. NCLEX-USA is completed first — it qualifies for both USA and Australia pathways. AHPRA registration follows."
Add OET (English proficiency exam) as a pathway step between PRC board licensure and NCLEX-USA prep
Change "Hospital placement (USA)" to "Hospital placement (USA / Australia / Singapore)"

Scholar Journey timeline — Stage 05:

Change "USA hospital or international cruise contract" to "USA hospital, Australian hospital, or international cruise contract"

Scholar cards — replace all fabricated quotes:

Claire: "I want to be a nurse abroad. This program is making that real."
April: "I'm still in high school, but I already know where I'm going."
Aljane: "My path is on pause, but not forgotten."

Aljane card:

Change reason to: "On hold — received an external scholarship covering university. NGH remains an option post-graduation."

## Assistant

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: done]_

Now CSS for the new target-note block, scholar note, and the hero stat separator.All corrections applied:

- **Hero stats**: "2 · 1" with "active · paused" label
- **About**: "single private donor"
- **Pillar 02**: full two-years-before-university support description
- **NGN target**: combined target paragraph replacing primary/secondary
- **NGN pathway**: added "OET (English for healthcare)" step between PRC board and NCLEX prep; placement now reads "USA / Australia / Singapore"
- **Journey Stage 05**: "USA hospital, Australian hospital, or international cruise contract"
- **Scholar quotes**: all three replaced
- **Aljane**: status reason updated + added a note callout explaining the external scholarship

## User

Replace "a private mentorship program based in the Philippines" with "a privately funded mentorship program supporting Filipino students — run by a single donor based in the United States"

## Assistant

_[tool: str_replace_edit]_

_[tool: done]_

Updated.

## User

Please correct the cohort years on the scholar cards:

Claire: change "2024 cohort" to "2028 cohort"
April: change "2026 cohort" to "2032 cohort"
Aljane: change "2023 cohort" to "2028 cohort"

## Assistant

_[tool: str_replace_edit]_

_[tool: done]_

Updated — Claire 2028, April 2032, Aljane 2028.

## User

Save as standalone HTML: index.html

## Assistant

_[tool: grep]_

_[tool: str_replace_edit]_

No code-referenced resources to lift. Adding the thumbnail and bundling.

_[tool: super_inline_html]_

_[tool: show_html]_

_[tool: get_webview_logs]_

Clean. Delivering the file.

_[tool: present_fs_item_for_download]_

Single self-contained file — works offline, no external dependencies.

## User

Save as standalone HTML: index.html

## Assistant

_[tool: super_inline_html]_

The source hasn't changed since the last bundle, but I'll re-run it to make sure the file is fresh.

_[tool: show_html]_

_[tool: get_webview_logs]_

_[tool: present_fs_item_for_download]_

Ready — single-file, fully offline.

## User

Change the footer text from "Quezon City, Philippines" to simply "Philippines · United States"

## Assistant

_[tool: str_replace_edit]_

_[tool: done]_

Updated.

