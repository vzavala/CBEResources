// Links to Research (TwinKit Part N): one flat list in the order of byTwin["body"] in TwinKit/research.json (alphabetical by last name).
// Name linked to the official UW–Madison page, "Connects to" = the file's `where` text, the first 3 `areas` (a machine-learning or data tag is kept visible),
// and one jump to the nearest spot, lens or view. No publications or summaries.
export const RESEARCH = [
  { name: "Michael D. Graham", url: "https://engineering.wisc.edu/directory/profile/mike-graham/",
    areas: ["Fluid dynamics", "Blood flow at the cellular level", "Machine learning in fluid dynamics"], where: "blood flow in vessels", go: { spot: 2 } },
  { name: "Dan Klingenberg", url: "https://engineering.wisc.edu/directory/profile/dan-klingenberg/",
    areas: ["Colloid science", "Complex fluids", "Suspension rheology"], where: "blood as a suspension of cells", go: { spot: 8 } },
  { name: "David Lynn", url: "https://engineering.wisc.edu/directory/profile/david-lynn/",
    areas: ["Polymers and soft materials", "Surfaces and interfaces", "Biomaterials and biotechnology"], where: "drug delivery and biomaterials", go: { spot: 8 } },
  { name: "Mai Ngo", url: "https://engineering.wisc.edu/directory/profile/mai-ngo/",
    areas: ["Tissue engineering", "Cell engineering", "Vascularized tissues"], where: "blood vessels and tissues", go: { view: "organs" } },
  { name: "Sean Palecek", url: "https://engineering.wisc.edu/directory/profile/sean-palecek/",
    areas: ["Cellular engineering", "Tissue engineering", "Stem cells"], where: "heart muscle cells and tissues", go: { spot: 2 } },
  { name: "Eric Shusta", url: "https://engineering.wisc.edu/directory/profile/eric-shusta/",
    areas: ["Brain drug delivery", "Blood-brain barrier modeling", "Biopharmaceutical design"], where: "blood-brain barrier and transport into the brain", go: { spot: 7 } },
  { name: "Rahul Sujanani", url: "https://engineering.wisc.edu/directory/profile/rahul-sujanani/",
    areas: ["Polymers", "Membranes", "Ion separations"], where: "the kidney as a membrane separator", go: { spot: 4 } },
  { name: "Reid Van Lehn", url: "https://engineering.wisc.edu/directory/profile/reid-van-lehn/",
    areas: ["Molecular simulation", "Soft materials", "Solvent effects"], where: "molecules crossing cell membranes", go: { lens: 3, stop: 1 } },
  { name: "John Yin", url: "https://engineering.wisc.edu/directory/profile/john-yin/",
    areas: ["Systems biology: virus-host interactions", "Systems chemistry: molecular replicators"], where: "virus infection dynamics", go: { lens: 6, stop: 0 } },
];
// UW–Madison centers and programs (TwinKit Part T): from TwinKit/centers.json byTwin["body"]; topical links only
export const CENTERS = [
  ["Stem Cell and Regenerative Medicine Center", "https://stemcells.wisc.edu/", "stem cells and regenerative medicine"],
  ["Forward BIO Institute", "https://forwardbio.wisc.edu/", "biomanufacturing of cells and tissues"],
  ["UW Comprehensive Diabetes Center", "https://diabetescenter.wisc.edu/", "diabetes and metabolism research"],
];
