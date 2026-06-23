// ===================================================================
//  ASTRONOMICAL DATA — Top 20 Black Holes + Top 20 Pulsars
//  Curated real values (rounded). Sources: NASA, ESA, ESO, ATNF.
// ===================================================================

export interface SpaceObject {
  name: string; alias: string; type: string;
  [key: string]: any;     // mass/distance/period/category/kind/source… vary by object
}

export const BLACK_HOLES: SpaceObject[] = [
  {
    name: "Sagittarius A*",
    alias: "The Heart of the Milky Way",
    type: "Supermassive",
    mass: "4.15 million M☉",
    distance: "26,700 ly",
    diameter: "23.5 million km (≈ 0.17 AU)",
    constellation: "Sagittarius",
    discovered: "1974",
    spin: "a ≈ 0.90",
    tag: "Imaged by the EHT in 2022 — our galaxy's quiet, dormant giant.",
    fact: "Despite its mass, it accretes so little that if it were a human it would eat one grain of rice every million years."
  },
  {
    name: "M87* (Pōwehi)",
    alias: "The First Photograph",
    type: "Supermassive",
    mass: "6.5 billion M☉",
    distance: "53.5 million ly",
    diameter: "≈ 38 billion km (bigger than our Solar System)",
    constellation: "Virgo",
    discovered: "1781 (host galaxy)",
    spin: "a ≈ 0.94",
    tag: "First black hole ever directly imaged — April 10, 2019.",
    fact: "Its relativistic jet blasts plasma 5,000 light-years into space at 99% the speed of light."
  },
  {
    name: "TON 618",
    alias: "The Titan",
    type: "Ultramassive (Quasar)",
    mass: "40.7 billion M☉",
    distance: "18.2 billion ly",
    diameter: "≈ 240 billion km (≈ 1,300 AU)",
    constellation: "Canes Venatici",
    discovered: "1957",
    spin: "Unknown",
    tag: "One of the most massive black holes known to exist.",
    fact: "Its event horizon could swallow the orbit of every planet in our system 40 times over."
  },
  {
    name: "Cygnus X-1",
    alias: "The Bet Winner",
    type: "Stellar-mass",
    mass: "21.2 M☉",
    distance: "7,200 ly",
    diameter: "≈ 125 km",
    constellation: "Cygnus",
    discovered: "1964",
    spin: "a > 0.95 (near-maximal)",
    tag: "Subject of the famous Hawking–Thorne wager (Hawking conceded in 1990).",
    fact: "First object widely accepted as a black hole; it devours its blue supergiant companion HDE 226868."
  },
  {
    name: "Phoenix A",
    alias: "The Cluster King",
    type: "Ultramassive",
    mass: "≈ 100 billion M☉ (est.)",
    distance: "5.7 billion ly",
    diameter: "≈ 590 billion km",
    constellation: "Phoenix",
    discovered: "2010 (cluster)",
    spin: "Unknown",
    tag: "Candidate for the most massive black hole ever inferred.",
    fact: "Sits at the core of a galaxy cluster forming 740 new stars per year — a cosmic firestorm."
  },
  {
    name: "Holmberg 15A",
    alias: "The Void Maker",
    type: "Ultramassive",
    mass: "40 billion M☉",
    distance: "700 million ly",
    diameter: "≈ 236 billion km",
    constellation: "Cetus",
    discovered: "2019 (mass)",
    spin: "Unknown",
    tag: "Carved out a 'core' larger than the Large Magellanic Cloud.",
    fact: "Direct dynamical mass measurement made it one of the heaviest ever weighed by motion of stars."
  },
  {
    name: "OJ 287",
    alias: "The Binary Heartbeat",
    type: "Supermassive Binary",
    mass: "18.35 billion M☉ (primary)",
    distance: "3.5 billion ly",
    diameter: "≈ 108 billion km",
    constellation: "Cancer",
    discovered: "1888 (photographic)",
    spin: "a ≈ 0.38",
    tag: "A 150-million M☉ black hole orbits the giant every 12 years.",
    fact: "Its companion punches through the accretion disk twice per orbit, causing predictable double-flares."
  },
  {
    name: "3C 273",
    alias: "The First Quasar",
    type: "Supermassive (Quasar)",
    mass: "886 million M☉",
    distance: "2.4 billion ly",
    diameter: "≈ 5.2 billion km",
    constellation: "Virgo",
    discovered: "1959 / 1963",
    spin: "Unknown",
    tag: "The first object ever identified as a quasar.",
    fact: "So luminous that if it sat 33 light-years away it would shine as bright as our Sun."
  },
  {
    name: "NGC 1277",
    alias: "The Overweight Anomaly",
    type: "Supermassive",
    mass: "17 billion M☉",
    distance: "220 million ly",
    diameter: "≈ 100 billion km",
    constellation: "Perseus",
    discovered: "2012 (mass)",
    spin: "Unknown",
    tag: "Holds 14% of its entire galaxy's mass — a record fraction.",
    fact: "A 'relic galaxy' frozen in time, untouched since the early universe."
  },
  {
    name: "Centaurus A",
    alias: "The Jet Cannon",
    type: "Supermassive",
    mass: "55 million M☉",
    distance: "12 million ly",
    diameter: "≈ 325 million km",
    constellation: "Centaurus",
    discovered: "1826 (galaxy)",
    spin: "Unknown",
    tag: "Nearest active galactic nucleus to Earth.",
    fact: "Launches a radio jet over a million light-years long, imaged in stunning detail by the EHT."
  },
  {
    name: "V404 Cygni",
    alias: "The Sleeping Beast",
    type: "Stellar-mass",
    mass: "9 M☉",
    distance: "7,800 ly",
    diameter: "≈ 53 km",
    constellation: "Cygnus",
    discovered: "1989 (outburst)",
    spin: "a ≈ 0.92",
    tag: "Erupts from silence in dramatic X-ray outbursts.",
    fact: "Its 2015 outburst produced 'wobbling' relativistic jets that changed direction in minutes."
  },
  {
    name: "GW150914 Remnant",
    alias: "The First Ripple",
    type: "Stellar-mass (merger)",
    mass: "62 M☉",
    distance: "1.3 billion ly",
    diameter: "≈ 367 km",
    constellation: "Southern sky",
    discovered: "Sept 14, 2015",
    spin: "a ≈ 0.67",
    tag: "Born from the first directly detected gravitational waves.",
    fact: "Two black holes (36 + 29 M☉) merged, radiating 3 suns' worth of energy as spacetime ripples in 0.2 s."
  },
  {
    name: "SDSS J0100+2802",
    alias: "The Dawn Giant",
    type: "Supermassive (Quasar)",
    mass: "12 billion M☉",
    distance: "12.8 billion ly",
    diameter: "≈ 71 billion km",
    constellation: "Andromeda",
    discovered: "2015",
    spin: "Unknown",
    tag: "A monster that grew impossibly fast in the infant universe.",
    fact: "Already 12 billion solar masses when the universe was only 900 million years old — a cosmic puzzle."
  },
  {
    name: "A0620-00",
    alias: "The Closest Neighbor",
    type: "Stellar-mass",
    mass: "6.6 M☉",
    distance: "3,300 ly",
    diameter: "≈ 39 km",
    constellation: "Monoceros",
    discovered: "1975",
    spin: "a < 0.2 (slow)",
    tag: "One of the nearest known black holes to Earth.",
    fact: "Quietly orbited by an orange dwarf star that it slowly siphons away."
  },
  {
    name: "Gaia BH1",
    alias: "The Dark Wanderer",
    type: "Stellar-mass (dormant)",
    mass: "9.6 M☉",
    distance: "1,560 ly",
    diameter: "≈ 57 km",
    constellation: "Ophiuchus",
    discovered: "2022",
    spin: "Unknown",
    tag: "The nearest known black hole to Earth.",
    fact: "Completely dark and non-accreting — found only by the gravitational 'wobble' of its Sun-like companion."
  },
  {
    name: "M82 X-1",
    alias: "The Missing Link",
    type: "Intermediate-mass",
    mass: "≈ 400 M☉",
    distance: "12 million ly",
    diameter: "≈ 2,400 km",
    constellation: "Ursa Major",
    discovered: "2006",
    spin: "Unknown",
    tag: "A rare intermediate-mass black hole bridging stellar and supermassive.",
    fact: "Found via X-ray 'heartbeats' echoing patterns seen in much smaller black holes."
  },
  {
    name: "Markarian 231",
    alias: "The Double Core",
    type: "Supermassive Binary",
    mass: "150 million M☉ (primary)",
    distance: "581 million ly",
    diameter: "≈ 885 million km",
    constellation: "Ursa Major",
    discovered: "1969",
    spin: "Unknown",
    tag: "Nearest quasar to Earth, harboring a binary black hole.",
    fact: "A 4-million M☉ companion orbits the primary every 1.2 years inside a shared accretion disk."
  },
  {
    name: "NGC 4889",
    alias: "The Coma Colossus",
    type: "Ultramassive",
    mass: "21 billion M☉",
    distance: "308 million ly",
    diameter: "≈ 124 billion km",
    constellation: "Coma Berenices",
    discovered: "1785 (galaxy)",
    spin: "Near-maximal (est.)",
    tag: "Now dormant, but once a blazing quasar.",
    fact: "Its event horizon is so vast that light would take over 5 days to cross it."
  },
  {
    name: "Abell 85 BCG",
    alias: "The Quiet Mountain",
    type: "Ultramassive",
    mass: "40 billion M☉",
    distance: "740 million ly",
    diameter: "≈ 236 billion km",
    constellation: "Cetus",
    discovered: "2019",
    spin: "Unknown",
    tag: "Among the largest black holes measured by stellar motion.",
    fact: "Its host galaxy's bright center is suspiciously 'diffuse' — stars flung out by the giant's gravity."
  },
  {
    name: "GRS 1915+105",
    alias: "The Spinning Dervish",
    type: "Stellar-mass (microquasar)",
    mass: "12.4 M☉",
    distance: "36,000 ly",
    diameter: "≈ 73 km",
    constellation: "Aquila",
    discovered: "1992",
    spin: "a ≈ 0.98 (near light-speed)",
    tag: "Spins at over 1,000 times per second at its event horizon.",
    fact: "A 'microquasar' that fires superluminal-appearing jets, mimicking distant quasars in miniature."
  }
];

export const PULSARS: SpaceObject[] = [
  {
    name: "PSR B1919+21",
    alias: "LGM-1 — 'Little Green Men'",
    type: "Normal Pulsar",
    period: "1.337 s",
    distance: "2,283 ly",
    age: "16 million yr",
    field: "1.4 × 10¹² G",
    discovered: "1967 by Jocelyn Bell Burnell",
    tag: "The very first pulsar ever discovered.",
    fact: "Its eerily regular ticks were briefly nicknamed 'Little Green Men' as a possible alien beacon."
  },
  {
    name: "PSR B0531+21",
    alias: "The Crab Pulsar",
    type: "Young Pulsar",
    period: "33.5 ms",
    distance: "6,500 ly",
    age: "≈ 1,000 yr",
    field: "3.8 × 10¹² G",
    discovered: "1968",
    tag: "Born in a supernova witnessed and recorded in 1054 AD.",
    fact: "Powers the entire Crab Nebula, pumping out 100,000× the Sun's energy as it slowly spins down."
  },
  {
    name: "PSR B0833-45",
    alias: "The Vela Pulsar",
    type: "Young Pulsar",
    period: "89 ms",
    distance: "959 ly",
    age: "11,000 yr",
    field: "3.4 × 10¹² G",
    discovered: "1968",
    tag: "The brightest persistent source of gamma rays in our sky.",
    fact: "Famous for sudden 'glitches' — abrupt spin-ups as its superfluid core unpins."
  },
  {
    name: "PSR J0737-3039",
    alias: "The Double Pulsar",
    type: "Binary (two pulsars)",
    period: "22.7 ms / 2.77 s",
    distance: "2,400 ly",
    age: "100 million yr",
    field: "6 × 10⁹ G",
    discovered: "2003",
    tag: "The only known system where BOTH stars are detectable pulsars.",
    fact: "A perfect natural lab — it has confirmed Einstein's General Relativity to 99.99% precision."
  },
  {
    name: "PSR B1937+21",
    alias: "The First Millisecond",
    type: "Millisecond Pulsar",
    period: "1.557 ms",
    distance: "11,700 ly",
    age: "230 million yr",
    field: "4 × 10⁸ G",
    discovered: "1982",
    tag: "The first millisecond pulsar ever found.",
    fact: "Spins 642 times every second — its equator moves at 1/7th the speed of light."
  },
  {
    name: "PSR J1748-2446ad",
    alias: "The Speed Demon",
    type: "Millisecond Pulsar",
    period: "1.396 ms",
    distance: "18,000 ly",
    age: "Unknown",
    field: "Low",
    discovered: "2004",
    tag: "The fastest-spinning pulsar known.",
    fact: "Rotates 716 times per second — its surface whips around at ~24% the speed of light."
  },
  {
    name: "PSR B1257+12",
    alias: "Lich — The Planet Maker",
    type: "Millisecond Pulsar",
    period: "6.22 ms",
    distance: "2,300 ly",
    age: "1 billion yr",
    field: "8.8 × 10⁸ G",
    discovered: "1990",
    tag: "Hosts the first exoplanets ever confirmed.",
    fact: "Three planets orbit this dead star — the first worlds ever found beyond our Sun, in 1992."
  },
  {
    name: "PSR J0740+6620",
    alias: "The Heavyweight",
    type: "Millisecond Pulsar",
    period: "2.89 ms",
    distance: "4,600 ly",
    age: "Old",
    field: "Low",
    discovered: "2019",
    tag: "The most massive neutron star precisely measured.",
    fact: "At 2.08 M☉ packed into ~25 km, one teaspoon of it would weigh as much as Mount Everest."
  },
  {
    name: "PSR J0030+0451",
    alias: "The Mapped Star",
    type: "Millisecond Pulsar",
    period: "4.87 ms",
    distance: "1,100 ly",
    age: "Old",
    field: "Low",
    discovered: "1998",
    tag: "The first neutron star to have its surface map drawn.",
    fact: "NASA's NICER revealed its hot spots aren't at the poles — rewriting magnetic field models."
  },
  {
    name: "PSR J1745-2900",
    alias: "The Galactic-Center Magnetar",
    type: "Magnetar",
    period: "3.76 s",
    distance: "26,000 ly",
    age: "9,000 yr",
    field: "2 × 10¹⁴ G",
    discovered: "2013",
    tag: "Orbits Sagittarius A* — the closest known pulsar to our central black hole.",
    fact: "Its radio pulses helped probe the magnetic environment just light-months from a supermassive black hole."
  },
  {
    name: "SGR 1806-20",
    alias: "The Cosmic Flare",
    type: "Magnetar",
    period: "7.55 s",
    distance: "50,000 ly",
    age: "Young",
    field: "8 × 10¹⁴ G",
    discovered: "1979",
    tag: "Source of the brightest extra-solar event ever recorded.",
    fact: "Its 2004 giant flare released more energy in 0.2 s than the Sun does in 250,000 years — from 50,000 ly away it briefly ionized Earth's atmosphere."
  },
  {
    name: "PSR B1620-26",
    alias: "Methuselah's Planet",
    type: "Binary Millisecond Pulsar",
    period: "11.1 ms",
    distance: "12,400 ly",
    age: "Ancient",
    field: "Low",
    discovered: "1988",
    tag: "Orbited by the oldest known planet in the universe.",
    fact: "Its planet 'Methuselah' is 12.7 billion years old — nearly as old as the cosmos itself."
  },
  {
    name: "PSR J2144-3933",
    alias: "The Sleepwalker",
    type: "Normal Pulsar",
    period: "8.51 s",
    distance: "590 ly",
    age: "270 million yr",
    field: "2 × 10¹² G",
    discovered: "1999",
    tag: "One of the slowest-rotating radio pulsars known.",
    fact: "It 'should' be impossible — its slow spin sits deep inside the pulsar 'death zone', yet it still pulses."
  },
  {
    name: "PSR J0633+1746",
    alias: "Geminga — The Ghost",
    type: "Gamma-ray Pulsar",
    period: "237 ms",
    distance: "815 ly",
    age: "342,000 yr",
    field: "1.6 × 10¹² G",
    discovered: "1972 (γ) / 1992 (pulse)",
    tag: "The first radio-quiet, gamma-ray-only pulsar identified.",
    fact: "Nearly invisible in radio, it was a 20-year mystery solved only when its X-ray pulse was finally caught."
  },
  {
    name: "PSR J1856-3754",
    alias: "One of the Magnificent Seven",
    type: "Isolated Neutron Star",
    period: "7.06 s",
    distance: "400 ly",
    age: "≈ 500,000 yr",
    field: "1.5 × 10¹³ G",
    discovered: "1996",
    tag: "A nearby, naked neutron star with no companion and no nebula.",
    fact: "One of the closest neutron stars to Earth, glowing purely from its own residual heat."
  },
  {
    name: "PSR J0537-6910",
    alias: "The Big Glitcher",
    type: "Young Pulsar",
    period: "16 ms",
    distance: "163,000 ly",
    age: "5,000 yr",
    field: "9 × 10¹¹ G",
    discovered: "1998",
    tag: "Holds the record for the most frequent and largest glitches.",
    fact: "Living in the Large Magellanic Cloud, it 'stutters' its spin more than any other known pulsar."
  },
  {
    name: "PSR J1023+0038",
    alias: "The Shape-Shifter",
    type: "Transitional Millisecond Pulsar",
    period: "1.69 ms",
    distance: "4,400 ly",
    age: "Old",
    field: "Low",
    discovered: "2009",
    tag: "Caught switching between radio pulsar and X-ray binary states.",
    fact: "Living proof of the 'recycling' theory — a dead star reborn as a millisecond pulsar by feeding on a companion."
  },
  {
    name: "PSR B0950+08",
    alias: "The Close Lighthouse",
    type: "Normal Pulsar",
    period: "253 ms",
    distance: "846 ly",
    age: "17 million yr",
    field: "2.4 × 10¹¹ G",
    discovered: "1968",
    tag: "One of the brightest and nearest pulsars in the sky.",
    fact: "Surrounded by a faint gamma-ray halo of antimatter positrons hundreds of times wider than the star itself."
  },
  {
    name: "PSR J0348+0432",
    alias: "The Relativity Tester",
    type: "Binary Millisecond Pulsar",
    period: "39 ms",
    distance: "7,000 ly",
    age: "Old",
    field: "2 × 10⁹ G",
    discovered: "2011",
    tag: "A 2-solar-mass pulsar in a tight orbit with a white dwarf.",
    fact: "Its extreme gravity makes it one of the best stress-tests of Einstein's theory ever found."
  },
  {
    name: "PSR J1614-2230",
    alias: "The Game Changer",
    type: "Millisecond Pulsar",
    period: "3.15 ms",
    distance: "3,900 ly",
    age: "5 billion yr",
    field: "Low",
    discovered: "2006",
    tag: "Its 1.97 M☉ mass overturned theories of neutron star interiors.",
    fact: "By eclipsing its white dwarf companion, it let astronomers 'weigh' it with exquisite precision via the Shapiro delay."
  }
];

// Glossary of black hole features explained in the simulator
// Features Description
export const FEATURES = [
  { id: "singularity", name: "Singularity", icon: "✦",
    text: "The infinitely dense core where mass collapses to a point of zero volume. General relativity breaks down here — physics as we know it ends. Quantum gravity may one day describe it." },
  { id: "horizon", name: "Event Horizon", icon: "◯",
    text: "The point of no return. Cross it and not even light can escape. Its radius is the Schwarzschild radius (Rₛ = 2GM/c²). It is not a surface — just a boundary in spacetime." },
  { id: "photon", name: "Photon Sphere", icon: "◉",
    text: "At 1.5× the Schwarzschild radius, gravity is so intense that light orbits the black hole in unstable circles. This creates the bright, razor-thin 'photon ring' seen in EHT images." },
  { id: "isco", name: "ISCO", icon: "⟳",
    text: "The Innermost Stable Circular Orbit (3 Rₛ for a non-spinning hole). Inside it, no stable orbit exists — matter inevitably spirals inward. It defines the inner edge of the accretion disk." },
  { id: "disk", name: "Accretion Disk", icon: "🜨",
    text: "A swirling disk of superheated plasma spiraling inward. Friction heats it to millions of degrees, making it glow across X-ray to optical light. The inner edge sits at the ISCO." },
  { id: "lensing", name: "Gravitational Lensing", icon: "❂",
    text: "Mass curves spacetime, bending the path of light. A black hole acts as a lens, warping the starfield behind it and letting you see the far side of its own accretion disk above and below." },
  { id: "ergosphere", name: "Ergosphere", icon: "⊚",
    text: "Around a spinning (Kerr) black hole, space itself is dragged along — 'frame dragging.' Inside the ergosphere nothing can stay still. Energy can even be extracted (the Penrose process)." },
  { id: "jets", name: "Relativistic Jets", icon: "↑",
    text: "Twisted magnetic fields can launch plasma from the poles at nearly light-speed, firing beams thousands of light-years into space — the most powerful sustained engines in the universe." },
  { id: "doppler", name: "Relativistic Beaming", icon: "◑",
    text: "The side of the disk rotating toward you is blueshifted and dramatically brightened; the receding side is dimmed and reddened. This is why one side of a black hole's ring looks far brighter." },
  { id: "redshift", name: "Gravitational Redshift", icon: "〰",
    text: "Light climbing out of a deep gravity well loses energy, shifting toward red. Time itself runs slower near the horizon — from a safe distance, an infalling clock appears to freeze forever." }
];

// ===================================================================
//  ENRICHMENT — categories, source links, and a render "kind" used by
//  the procedural portrait generator. Computed once at module load.
// ===================================================================

// Objects powered by a luminous quasar/blazar engine
const QUASAR_NAMES = new Set([
  "TON 618", "OJ 287", "3C 273", "SDSS J0100+2802", "Markarian 231", "Phoenix A"
]);

// Map a free-text type to a portrait "kind" the renderer understands
function portraitKind(o) {
  const t = (o.type || "").toLowerCase();
  if (t.includes("quasar")) return "quasar";
  if (t.includes("ultramassive")) return "ultramassive";
  if (t.includes("supermassive")) return "supermassive";
  if (t.includes("intermediate")) return "intermediate";
  if (t.includes("magnetar")) return "magnetar";
  if (t.includes("millisecond")) return "millisecond";
  if (t.includes("pulsar")) return "pulsar";
  if (t.includes("neutron")) return "neutron";
  if (t.includes("binary")) return "binary";
  if (t.includes("stellar")) return "stellar";
  return "blackhole";
}

// A reliable "learn more" link. Special:Search always resolves (redirects
// to the article on an exact match, otherwise shows results) — no 404s.
function sourceLink(name) {
  return "https://en.wikipedia.org/wiki/Special:Search?search=" +
    encodeURIComponent(name);
}

BLACK_HOLES.forEach((o) => {
  o.category = QUASAR_NAMES.has(o.name) ? "quasar" : "blackhole";
  o.kind = QUASAR_NAMES.has(o.name) ? "quasar" : portraitKind(o);
  o.source = sourceLink(o.name);
});

PULSARS.forEach((o) => {
  o.category = "pulsar";
  o.kind = portraitKind(o);
  o.source = sourceLink(o.name);
});

// Convenience views
export const QUASARS = BLACK_HOLES.filter((o) => o.category === "quasar");
export const ALL_OBJECTS = [...BLACK_HOLES, ...PULSARS];
