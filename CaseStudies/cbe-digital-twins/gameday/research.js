// Links to Research (Part N update 3): rows come only from the coordinator's verified map TwinKit/research.json,
// byTwin["gameday"] (generated 2026-11-13), one flat list, alphabetical by last name as in the map. Each row: name linked to the official faculty page,
// "Connects to: <where>" exactly as the map words it, the first 3 area tags as listed (an ML/data tag replaces the third if it would otherwise be hidden), and a jump to
// the nearest ChemE spot (spot choice is ours). No publications, summaries or claims of involvement.
export const RESEARCH = [
  {
    "name": "Rose Cersonsky",
    "url": "https://engineering.wisc.edu/directory/profile/rose-cersonsky/",
    "areas": [
      "Molecular modeling and simulation",
      "Applied mathematics and machine learning",
      "Self-assembly of complex building blocks"
    ],
    "whereText": "data-driven materials design",
    "where": {
      "spot": "cleats"
    }
  },
  {
    "name": "Matt Gebbie",
    "url": "https://engineering.wisc.edu/directory/profile/matt-gebbie/",
    "areas": [
      "Electrochemistry",
      "Colloid and interface science",
      "Ionic liquids and electrolytes"
    ],
    "whereText": "dissolved ions (electrolytes) in sports drinks and sweat",
    "where": {
      "spot": "drink"
    }
  },
  {
    "name": "Padma Gopalan",
    "url": "https://engineering.wisc.edu/directory/profile/padma-gopalan/",
    "areas": [
      "Polymer synthesis and characterization",
      "Self-assembly of block copolymers",
      "Liquid crystalline polymers"
    ],
    "whereText": "polymer synthesis for sports materials",
    "where": {
      "spot": "cleats"
    }
  },
  {
    "name": "Michael D Graham",
    "url": "https://engineering.wisc.edu/directory/profile/mike-graham/",
    "areas": [
      "Fluid dynamics",
      "Blood flow at the cellular level",
      "Machine learning in fluid dynamics"
    ],
    "whereText": "air flow around the ball",
    "where": {
      "spot": "pass"
    }
  },
  {
    "name": "George Huber",
    "url": "https://engineering.wisc.edu/directory/profile/george-huber/",
    "areas": [
      "Biofuels and biochemicals",
      "Heterogeneous catalysis",
      "Plastic recycling"
    ],
    "whereText": "recycling the plastics a game day throws away: cups, bottles, packaging and worn-out turf",
    "where": {
      "spot": "drink"
    }
  },
  {
    "name": "Whitney Loo",
    "url": "https://engineering.wisc.edu/directory/profile/whitney-loo/",
    "areas": [
      "Polymers",
      "Soft materials",
      "Sustainability"
    ],
    "whereText": "polymers in turf, helmets and padding",
    "where": {
      "spot": "helmet"
    }
  },
  {
    "name": "David Lynn",
    "url": "https://engineering.wisc.edu/directory/profile/david-lynn/",
    "areas": [
      "Polymers and soft materials",
      "Surfaces and interfaces",
      "Biomaterials and biotechnology"
    ],
    "whereText": "polymer materials and surface coatings",
    "where": {
      "spot": "uniform"
    }
  },
  {
    "name": "Mai Ngo",
    "url": "https://engineering.wisc.edu/directory/profile/mai-ngo/",
    "areas": [
      "Tissue engineering",
      "Cell engineering",
      "Vascularized tissues"
    ],
    "whereText": "muscle and tissue repair after injury",
    "where": {
      "spot": "player"
    }
  },
  {
    "name": "Sean Palecek",
    "url": "https://engineering.wisc.edu/directory/profile/sean-palecek/",
    "areas": [
      "Cellular engineering",
      "Tissue engineering",
      "Stem cells"
    ],
    "whereText": "heart muscle cells under exertion",
    "where": {
      "spot": "player"
    }
  },
  {
    "name": "Eric Shusta",
    "url": "https://engineering.wisc.edu/directory/profile/eric-shusta/",
    "areas": [
      "Brain drug delivery",
      "Blood-brain barrier modeling",
      "Biopharmaceutical design"
    ],
    "whereText": "protecting the brain: the blood-brain barrier",
    "where": {
      "spot": "helmet"
    }
  },
  {
    "name": "Reid Van Lehn",
    "url": "https://engineering.wisc.edu/directory/profile/reid-van-lehn/",
    "areas": [
      "Molecular simulation",
      "Soft materials",
      "Solvent effects"
    ],
    "whereText": "polymers and plastics recycling",
    "where": {
      "spot": "turf"
    }
  }
];
// UW–Madison centers and programs (Part T): only TwinKit/centers.json byTwin["gameday"] (generated 2026-11-16); name, link and "Connects to"
export const CENTERS = [
  {
    "name": "Chemical Upcycling of Waste Plastics (CUWP)",
    "url": "https://cuwp.org/",
    "whereText": "chemical recycling of waste plastics"
  },
  {
    "name": "Polymer Engineering Center",
    "url": "https://pec.engr.wisc.edu/",
    "whereText": "plastics engineering and processing"
  },
  {
    "name": "Badger Athletic Performance",
    "url": "https://bap.ortho.wisc.edu/",
    "whereText": "athlete care and performance science"
  },
  {
    "name": "O.J. Noer Turfgrass Research and Education Facility",
    "url": "https://ojnoer.ars.wisc.edu/",
    "whereText": "turfgrass research"
  }
];
export const RESEARCH_STATUS = "ready";
