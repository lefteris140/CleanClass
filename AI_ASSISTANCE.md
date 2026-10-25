# AI-assistance disclosure

Student developer: **Lefteris Demosthenous**

## Version published in this repository

This repository contains the AI-assisted CleanClass prototype and its subsequent release changes. Lefteris Demosthenous explicitly chose to publish this prototype for now. The independent rewrite reported below is a separate version and is not included in this repository. The prototype's generated code is not presented as independently written by the student.

## Known workflow

CleanClass was developed with substantial assistance from OpenAI Codex. In the recorded development session, the user supplied the product brief and asked the assistant to implement it in the workspace. The assistant generated the initial React/TypeScript application, mathematical optimizer, interface, demonstration inputs, tests, styling, and README; installed dependencies; and ran builds, tests, and browser checks. It also corrected issues found during verification, including persistence behavior and mobile chart sizing.

For this release, the user provided a narrowly scoped review request. Codex inspected the existing source and the specified CDC/EPA pages, added the scientific references, CSV export and relevant tests, corrected comparison wording, prepared licensing/attribution and release documentation, and ran verification. The optimizer's implementation and objective were preserved.

The user reports that the existing optimizer passed an external check against 500 independently enumerated small scenarios. The external checker and its raw output were not supplied in this recorded workflow, so this document does not claim Codex independently ran or audited that check. The repository's own generated-scenario tests are separate.

This disclosure does not establish eligibility under contest rules, student authorship, or copyright ownership. The student should review it for accuracy and disclose tools and assistance as required by the applicable submission form.

## Student contributions and subsequent rewrite

The student reports independently rewriting the prototype's code using a substantially different implementation while reproducing the same observed outputs. The student also reports using Codex to develop the idea, narrow it to a specific problem, and help with broad visual-design decisions.

This account distinguishes the AI-generated prototype from the student's reported rewrite. The rewrite's source files and development history have not been provided for this repository review. Matching observed outputs does not by itself verify that two implementations are identical in every case.

Independent mathematical derivations, specific testing performed personally, and additional assistance have not been specified by the student. This disclosure makes no claims about those activities beyond the separately reported external check described above.

The known AI involvement therefore includes idea development, problem scoping, broad visual design, generation of the initial prototype, and the subsequent release changes and documentation described in this document. A later independent rewrite does not remove that earlier assistance from the development history.

The student should retain the rewrite and relevant development history, review this disclosure against the version actually submitted, and be able to explain the equations, objective, constraints, exclusions, comparison strategy, and CSV safeguards in their own words.
