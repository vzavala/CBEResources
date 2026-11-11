# CBE Resources

Web resources for the Department of Chemical and Biological Engineering, UW–Madison.
Each navigator lives in its own folder under `Navigators/` as a self-contained page (open its `index.html`, or serve the repo with GitHub Pages).

| Page | Folder | Audience |
|---|---|---|
| Generative AI Guidelines for Students | [`Navigators/ai-guidelines/`](Navigators/ai-guidelines/) | CBE undergraduates |

`CaseStudies/` is reserved for upcoming case studies.

## Updating a page

Pages are built elsewhere and copied here as one HTML file.

- **AI guidelines:** source and build scripts live in `CBEDocs/resources/09-reference-sites/AI ML-Workshop/`.
  Run `python3 build/split_versions.py "<that folder>" "<student page URL>"`, then `python3 build/build_standalone.py`,
  and copy `dist/ai-guidelines.html` to `Navigators/ai-guidelines/index.html`.
