# CleanClass

**Smarter air. Healthier learning spaces.**

A self-contained classroom air-cleaning allocation planner built with React, strict TypeScript, Vite, Tailwind CSS, Lucide, Recharts, and Vitest. No accounts, API keys, databases, or external services are needed. All classroom calculations run in the browser.

## Run locally

Use Node.js 22.12+ and npm. The committed lockfile fixes the dependency versions.

```sh
npm ci
npm run dev
```

Open the Local URL printed by Vite. Other commands:

```sh
npm test
npm run build
npm run preview
```

## Use the app

1. Explore the demonstration: its results are actually computed, not hardcoded.
2. Open **Classroom planner** to enter dimensions, student occupancy, and baseline effective ACH. Leave ACH blank when unknown; the room stays visible but is excluded from numerical optimization. New classrooms begin with unknown ACH.
3. Set one generic purifier's particle CADR, purchase cost, school-wide unit cap, equipment budget, and eACH target under **Equipment settings**. An optional room cap can lower the school-wide cap.
4. Select **Optimize Allocation**. Changing inputs marks the old recommendation out of date and hides it until recalculated.
5. Explore **Scenario comparison**. The comparison budget does not change the main plan until **Use this budget** is selected. The two cards calculate exact results; the chart shows 21 sampled budgets.
6. Export/import versioned JSON for portable scenarios. Valid inputs are optionally saved in localStorage; disable this under Equipment settings on a shared device. Invalid edits do not overwrite the last valid saved plan. Export a copy before resetting to the demonstration.
7. Select **Export allocation CSV** to download the current optimized classroom recommendation. Export is disabled when inputs are invalid or the calculation is stale; optimize again after edits. CSV includes dimensions, occupancy, baseline effective ACH, units, full-precision final eACH, selected target, modeled attainment, and per-room equipment purchase cost in USD. Unknown baselines remain explicitly unknown. Fields are quoted with doubled embedded quotes and CRLF record separators; a UTF-8 BOM supports Unicode names in Excel. Formula-like room names receive a leading apostrophe so spreadsheet software treats them as text. JSON retains the original names.

## Calculation and objective

Room volume is length × width × height in cubic feet. One purifier adds `CADR × 60 / volume` equivalent air changes per hour. After allocation, estimated eACH is baseline effective ACH plus units × added eACH. Units required are the ceiling of the target deficit divided by added eACH, with a 1e-9 floating-point tolerance.

The primary objective maximizes **student occupancy in classrooms estimated to meet the selected target**. Each not-yet-at-target room becomes a 0/1 knapsack item: its value is occupancy and its weight is the whole-unit count required to reach the target. Unreachable rooms and unknown estimates are excluded. Budget capacity uses integer cents and whole equipment units. The dynamic program is exact for this objective. Ties favor more classrooms, then fewer purchased units, then earlier table order. No units are bought solely for partial improvement because those units do not improve the selected objective.

Input limits (100 rooms, 20 units per room) bound the dynamic program to at most 2,000 useful unit slots. Equipment cost and budget accept cents, not fractional cents.

The comparison strategy assigns one unit per eligible classroom per pass in table order until the budget runs out or all rooms meet their targets or caps. It skips unknown baselines and rooms already at target. It can leave partially improved rooms, whereas the optimizer purchases only allocations that reach the target. Both strategies use identical equipment, budget, eligibility, limits, and clean-air formulas.

## Assumptions and limits

This is a planning and educational application, not a sensor, clinical instrument, compliance assessment, or guarantee of protection from disease. The default 5 eACH target is an editable planning assumption. The model assumes well-mixed air and constant, additive clean-air delivery. CADR is a particle metric, not a measurement of gas removal. Baseline effective ACH should avoid double counting new filtration. Placement, noise, actual operating speed, filter condition, maintenance, and mixing affect real performance. Ask qualified facilities professionals to validate assumptions and equipment placement.

Costs cover equipment purchases only; electricity, replacement filters, installation, and maintenance are excluded. Occupancy represents student seats, not unique people across a school day. The demonstration uses fictional rooms and a generic example purifier, not a verified commercial product. Maximizing occupancy may prioritize some rooms over others; school decision makers should review equity and practical constraints.

## Scientific references

- [CDC / NIOSH: How Much Ventilation Is Enough?](https://www.cdc.gov/niosh/ventilation/prevention/aim-for-5.html) supports the editable 5 ACH planning target, combining ventilation ACH and particle-filtration eACH, and calculating ACH as airflow × 60 ÷ room volume. CDC describes 5 ACH as a rough guide, not a guarantee of safe air; needs vary by space and occupancy.
- [EPA: Guide to Air Cleaners in the Home](https://www.epa.gov/indoor-air-quality-iaq/guide-air-cleaners-home) supports particle CADR as a sizing input, accounting for room size/ceiling height, operating speed and filter maintenance, and distinguishing particle filtration from gas removal. This is residential guidance used for general filtration principles, not a classroom design standard.

Both pages were opened and verified during this release review. Neither agency endorses CleanClass, its example equipment, or its optimization strategy. Well-mixed air and constant device performance are simplifying model assumptions, not validations provided by these sources. The app estimates target attainment; it does not calculate infection risk or measured health outcomes.

## Deployment

Run `npm run build` and deploy the generated `dist/` directory to a static host. The app uses no path-based routing, so no rewrite rules or environment variables are required. The site must serve over HTTP(S), not by double-clicking `dist/index.html`.

### Publish the repository to GitHub

The commands below describe publishing a new checkout; preserve existing Git history and remotes if already initialized. Review the scoped LICENSE, AI_ASSISTANCE.md, rights, and staged file list before publishing. Existing ZIP archives are excluded by `.gitignore`; `node_modules`, `dist`, local environment files, and TypeScript build caches are also excluded. Do not upload the old `cleanclassv1.zip` as the final release.

With Git and the GitHub CLI installed, run these from the project root. Replace `YOUR_GITHUB_USERNAME` with the intended account. The create command publishes a **public** repository; use `--private` instead if public access is not intended.

```sh
npm ci
npm test
npm run build
git init -b main
git add .
git diff --cached --stat
git diff --cached
git commit -m "Release CleanClass for Congressional App Challenge"
gh auth login
gh repo create YOUR_GITHUB_USERNAME/CleanClass --public --source . --remote origin --push
git tag -a v1.0.0 -m "CleanClass Congressional App Challenge release"
git push origin v1.0.0
gh release create v1.0.0 --title "CleanClass v1.0.0" --notes "Classroom planning release with modeled clean-air optimization, scientific references, CSV allocation export, and AI-assistance disclosure."
```

If a repository has since been initialized, preserve its history/remotes rather than repeating initialization or creating a duplicate. The command syntax is documented by [GitHub CLI](https://cli.github.com/manual/gh_repo_create). The CleanClass source is available at [lefteris140/CleanClass](https://github.com/lefteris140/CleanClass) as a private repository. This source upload does not deploy the application.

### Deploy to Vercel

1. In Vercel, choose **Add New → Project**, connect GitHub, and import `CleanClass`.
2. Set root directory to the repository root, framework preset **Vite**, install command `npm ci`, build command `npm run build`, output directory `dist`, and Node.js **22.x**. No environment variables are needed.
3. Select **Deploy**. Open the returned production URL in a fresh browser session.
4. Check optimization, CSV download, both scientific links, and `/third-party-notices.txt`. Confirm judges can open the production URL without an account; configure deployment access accordingly. Save that URL for submission.

See [Vercel's Vite documentation](https://vercel.com/docs/frameworks/frontend/vite).

### Netlify alternative

Import the same GitHub repository through Netlify's **Add new project → Import an existing project** flow. Set base directory to the repository root, build command `npm run build`, publish directory `dist`, and Node.js **22.x** in build settings. Netlify installs npm dependencies from the committed lockfile. Deploy, then run the same production-URL checks above. See [Netlify's Vite documentation](https://docs.netlify.com/build/frameworks/framework-setup-guides/vite/). No hosted deployment was performed during this local release preparation.

## Verification

`npm test` covers formulas, target boundaries, budget cents, room caps, unknown baselines, zero budget, empty schools, tie-breaking, imports, and round robin. The optimizer is also compared against exhaustive enumeration for 100 generated schools. Release tests cover CSV values/escaping, stale and invalid export rejection, unknown values, currency, spreadsheet formula-like names, and comparison equality/difference wording. `npm run build` checks strict TypeScript and generates a production bundle.

The user separately reports a successful external check against 500 independently enumerated small scenarios. Its checker and raw results are not included here; this is reported evidence, not a repository test or an independently reproduced release result.

## Technical walkthrough for judges

1. Start on Overview: the fictional demo has 8 classrooms, 214 student seats, and a $1,800 equipment budget. Its calculated recommendation buys 6 units and moves 108 additional seats into rooms estimated to meet 5 eACH. These are modeled results from demo inputs, not real school outcomes.
2. In Classroom planner, explain `length × width × height`. Clear a baseline ACH estimate to demonstrate explicit exclusion; restore it before optimizing. Explain why missing data is different from zero.
3. In Equipment settings, show the CADR-to-eACH equation and integer unit/budget limits. Run **Optimize Allocation** and explain one selected and one unselected room.
4. Open `src/optimizer.ts`: `requiredUnits` supplies each room's minimum unit count; descending dynamic-programming updates consider taking a room once. Explain maximizing student seats, tie-breaking, and why partial improvements do not count toward this objective.
5. In Scenario comparison, set the exact budget to $900: the demo optimizer reaches 46 more seats than round robin at the same purchase cost. Set it to $0 to show equal-outcome wording. The curve is sampled; cards use exact calculations.
6. Export allocation CSV and compare a room's row to the on-screen recommendation. Edit an input to demonstrate that stale CSV export is disabled. Explain JSON scenario portability and optional localStorage.
7. Finish with How it works, its scientific references and limitations, then distinguish the student's documented independent work from AI assistance using `AI_ASSISTANCE.md`. Run `npm test` and `npm run build` if a technical demonstration is requested.

## Licensing, acknowledgments, and assistance

React/React DOM, Tailwind, Recharts, Vite, Vitest, and Prettier are MIT licensed; TypeScript is Apache-2.0; Lucide icons use ISC with Feather-derived MIT portions. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for exact direct-dependency acknowledgments and [public/third-party-notices.txt](public/third-party-notices.txt) for preserved installed production-dependency notices. Libraries, icon shapes, and third-party bundle contents retain their own licenses.

[LICENSE](LICENSE) is an MIT license naming Lefteris Demosthenous, scoped to original project code the named holder has rights to license. It does not assert that the student independently authored all code or relicense third-party work. [AI_ASSISTANCE.md](AI_ASSISTANCE.md) describes the development assistance associated with the currently published source.

## Project structure

- `src/model.ts`: types, demo inputs, calculations, validation, JSON parsing.
- `src/optimizer.ts`: exact allocation, comparison baseline, result summaries.
- `src/App.tsx`: accessible responsive planner, charts, settings, comparison, local persistence.
- `src/optimizer.test.ts`: mathematical and data validation tests.
- `src/release.ts` and `src/release.test.ts`: guarded allocation CSV serialization and comparison wording with focused regression tests.
- `src/styles.css`: responsive visual system and Tailwind entry point.

Review the applicable contest requirements and document the student's actual contributions before submission. This release preparation preserves the existing optimizer and mathematical objective.
