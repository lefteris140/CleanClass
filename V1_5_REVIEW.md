# CleanClass V1.5 review

Prepared locally on October 25, 2026. Release publication is authorized; merging and deployment remain pending separate approval. The pre-update recovery branch is `checkpoint/pre-v1.5-20261025`, at commit `391943f8e947f15360d306c61e37ed32d0002508`.

Final release preparation: the section is now named “Test ventilation assumptions,” matching its Overview action. All 37 tests, strict TypeScript checks, and the production build passed again after the rename. The release branch is prepared for a pull request into `main`; merging and deployment require separate approval.

`vercel.json` disables automatic deployment for this release branch only, so publication for review does not create a preview deployment. Other branches retain Vercel's default behavior. After explicit deployment approval, this guard can be removed for a preview, or the approved pull request can be merged into `main`. See [Vercel Git configuration](https://vercel.com/docs/project-configuration/git-configuration#git.deploymentenabled).

## Exact file list

Modified:

- `src/App.tsx`: integrates the compact Overview and sensitivity panel, adds expandable classroom explanations, and clarifies the outdoor-air ventilation limitation.
- `src/styles.css`: responsive hero, summary, sensitivity controls/tables, changed-allocation indicators, and recommendation disclosure styles.
- `src/EquipmentAnimation.css`: compact sizing and centering of the existing animated classroom; removes the old Overview heading layout rules.
- `README.md`: sensitivity calculation details, limitations, judge walkthrough, verification coverage, and new module descriptions.

Added:

- `src/OverviewHero.tsx`: animated classroom selector with actual room figures, prominent results, strategy comparison, spending, and optimization controls.
- `src/sensitivity.ts`: validated immutable perturbations, fixed-allocation evaluation, existing-optimizer reuse, row comparisons, and calculated summary text.
- `src/SensitivityPanel.tsx`: hypothetical ventilation controls, immediate reset, validation/stale guards, result summaries, classroom comparisons, and explanations.
- `src/sensitivity.test.ts`: ten focused sensitivity tests.
- `src/recommendations.ts`: concrete explanations using existing calculated results and room constraints.
- `src/recommendations.test.ts`: two explanation regression tests.
- `V1_5_REVIEW.md`: this review and release checklist.
- `vercel.json`: release-branch deployment guard; no application behavior changes.

The pre-existing untracked `DESIGN_REVIEW.md` is outside this update. No dependency or lockfile changes were made. The model, optimizer, demo data, scenario schema, and export serialization are unchanged.

## Visible changes

The Overview places the compact classroom illustration beside the recommendation on desktop. Seat attainment, before/round-robin/optimized results, purchase cost, and Optimize Allocation are grouped together above the school summary and existing chart. On narrow screens, results come first and the animation follows. The existing green, cream, and neutral design remains.

The classroom selector changes the displayed recommended units and estimated baseline/final eACH using actual current results. The schematic's geometry and visible purifier model do not represent measured room geometry or assigned unit counts. Pause/play and reduced-motion CSS remain. The demo is explicitly identified as fictional when its inputs match.

Every allocation-table row has a keyboard-accessible “Why this recommendation” disclosure with baseline eACH, units, calculated contribution, final eACH, attainment, and seats. Zero-unit explanations distinguish unknown measurements, already-at-target rooms, equipment-limit exclusions, and rooms not selected under the global resource-constrained objective.

## Sensitivity calculations

Scenario comparison now includes “Test ventilation assumptions.” A uniform user-selected adjustment is added to known baseline effective ACH values in a copied scenario. Unknown values remain null. No saved inputs change. A known baseline outside 0–50 rejects the whole hypothetical scenario; values are not clamped.

Equipment, budget, dimensions, occupancy, target, caps, and classroom order remain fixed. The existing `summarize` function evaluates the original unit assignments under changed assumptions. The existing `optimize` function independently produces the changed-assumption recommendation. Their results are clearly separated from the original plan under original assumptions. A main-plan input fingerprint prevents stale analysis after edits.

The demo remains six units costing $1,800, with 133 seats at target including 108 additional seats. At −0.5 eACH, the original plan reaches 108 seats; reoptimization reaches 109, changing Room 104 from one to zero units and Room 106 from zero to one. At +0.5 eACH, the corresponding totals are 133 and 154 seats. These are calculated hypothetical scenarios, not uncertainty estimates, validated measurements, or health effects.

## Verification results

- `npm test`: **37/37 passed**, across four files: optimizer 13, existing release/export tests 12, sensitivity 10, explanations 2. All 25 pre-existing tests still pass.
- `npx tsc -b --pretty false`: passed strict TypeScript checks.
- `npm run build`: passed TypeScript and Vite production bundling.
- `git diff --check`: passed; Git only reports its existing Windows line-ending conversion notices.
- Sensitivity tests include a manually calculated 6,000 ft³ room case, independent fixed-plan/reoptimized expectations, zero/positive/negative adjustments, boundary rejection, unknowns, immutable inputs, unchanged constraints, feasibility, determinism, stale-plan rejection, input updates, empty schools, and invalid plans.

Real-interface checks in the local in-app Chromium browser:

- Original demo figures and selected-classroom readouts; animation pause and computed paused state.
- Lower, higher, zero, invalid-negative, and unknown-baseline scenarios; reset and keyboard slider adjustment.
- Original plan versus reoptimized plan values and changed-room indicators.
- Classroom editing, duplication/deletion, equipment-budget edits, optimization, and restoring the original demo.
- Stale and invalid inputs hide sensitivity results and disable CSV export; invalid inputs disable recalculation.
- Budget comparison at $0 preserves equal-outcome wording; at $900 preserves 46 additional seats versus round robin at the same equipment cost.
- CSV downloaded to `C:/Users/enasd/Downloads/cleanclass-allocation (3).csv`; actual headers, units, calculated eACH, status, and purchase costs checked against the demo. JSON downloaded to `C:/Users/enasd/Downloads/cleanclass-scenario (3).json` and imported back successfully.
- Local persistence checked by changing Room 101 occupancy, reloading, observing recalculated results, and restoring the input.
- CDC and EPA links were clicked and their hrefs checked in the interface. Both official destination pages also loaded successfully through the web tool.
- Desktop 1440 × 1000, tablet 768 × 1024, mobile 390 × 844, and narrow mobile 320 × 900 checked. No page-wide horizontal overflow; wide tables scroll within their regions. Mobile section navigation and equipment inputs work.
- No captured browser console errors. Viewport overrides were reset after testing.

## Screenshots

Saved outside the repository, so they will not be committed accidentally:

- Overview: `C:/Users/enasd/.codex/visualizations/2026/10/25/01a170d0-518f-74f3-99b6-3cd487fc7f96/cleanclass-v15-overview.png`
- Sensitivity summary: `C:/Users/enasd/.codex/visualizations/2026/10/25/01a170d0-518f-74f3-99b6-3cd487fc7f96/cleanclass-v15-sensitivity.png`
- Complete sensitivity page: `C:/Users/enasd/.codex/visualizations/2026/10/25/01a170d0-518f-74f3-99b6-3cd487fc7f96/cleanclass-v15-sensitivity-full.png`
- Narrow mobile Overview: `C:/Users/enasd/.codex/visualizations/2026/10/25/01a170d0-518f-74f3-99b6-3cd487fc7f96/cleanclass-v15-mobile.png`

## Remaining limitations

No blocking regression was found. Sensitivity examines one uniform hypothetical offset at a time; it does not establish reliability across all possible assumptions. Full-precision values determine attainment, while displayed eACH values are rounded. Wide data tables require horizontal scrolling on small screens. Reduced-motion support was verified in the preserved CSS; this browser tool does not offer reduced-motion preference emulation. Tests used browser viewport sizes rather than physical mobile devices, and no formal performance benchmark or cross-browser audit was performed. Download tooling was unusually slow, although both files were ultimately saved and verified.

## Submission updates

Update feature descriptions, technical walkthrough, screenshots, and demonstration video to include ventilation sensitivity and the refreshed Overview. Explain fixed-plan evaluation versus reoptimization, immutable hypothetical inputs, and the existing knapsack objective. Retain the fictional-data and modeled-outcome qualifications. The baseline demo results and optimization formula do not need changing. This is a technical change checklist, not a determination of contest eligibility or submission requirements.

## Review, commit, and deploy after approval

1. Review locally at `http://127.0.0.1:5174/` while the existing dev server is running, or run `npm run dev` and use Vite's printed URL. Reproduce the walkthrough above. Review `git diff` and the six new source/test files as well as this report.
2. After approval, create a release branch and stage only the files in this update:

   ```sh
   git switch -c codex/cleanclass-v1.5
   git add README.md V1_5_REVIEW.md vercel.json src/App.tsx src/styles.css src/EquipmentAnimation.css src/OverviewHero.tsx src/SensitivityPanel.tsx src/sensitivity.ts src/sensitivity.test.ts src/recommendations.ts src/recommendations.test.ts
   git diff --cached --stat
   git diff --cached
   npm test
   npm run build
   git commit -m "Refine Overview and add ventilation sensitivity analysis"
   ```

3. Only when publication is approved, run `git push -u origin codex/cleanclass-v1.5`. Open `https://github.com/lefteris140/CleanClass`, create a pull request from that branch into `main`, and review its diff and checks. The release-branch guard in `vercel.json` prevents an automatic preview deployment.
4. Keep the pull request unmerged until explicit approval. After separate preview approval, remove the branch guard and test the preview; alternatively, after explicit production approval, merge the pull request. If Vercel is already configured to deploy `main`, verify its resulting production deployment succeeds. Otherwise import the existing repository into Vercel using Vite, `npm ci`, `npm run build`, output `dist`, and Node 22.x; no environment variables or routing rewrites are required. Verify `https://clean-class.vercel.app/` corresponds to the new commit before updating submission materials.
5. To inspect the old version after saving this work in a commit, switch to `checkpoint/pre-v1.5-20261025`; switch back to `codex/cleanclass-v1.5` to resume. Do not discard the current uncommitted changes to restore the checkpoint.
