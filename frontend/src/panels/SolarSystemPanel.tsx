import { memo, useEffect, useRef } from 'react'
import Panel from '../ui/Panel'
import { subscribe } from '../utils/raf-coordinator'

interface PlanetData {
  name: string
  au: number
  period: number
  mass: number
  moons: number
  type: string
  color: string
  radius: number
}

// Die Planeten-Stammdaten. Wichtig fuer die optische Korrektheit:
//   `radius` ist KEIN Pixelwert, sondern ein relativer Groessen-Index, der bewusst
//   an die echten Planetendurchmesser angelehnt ist (Erde als Referenz mit Index 5).
//   Um die realen Verhaeltnisse darzustellen, ohne dass Jupiter das ganze Panel
//   sprengt, sind die Werte mit einer Wurzel-Kompression (Exponent 0.5) berechnet:
//     index = sqrt(durchmesser_planet / durchmesser_erde) * 5
//   Dadurch bleiben die echten Groessen-VERHAELTNISSE sichtbar (Gasriesen klar
//   groesser als Gesteinsplaneten, Merkur kleiner als Erde), die absolute Spanne
//   wird aber so gestaucht, dass alles ins Panel passt. Eine Mindest-Pixelgroesse
//   beim Zeichnen sorgt zusaetzlich dafuer, dass winzige Koerper (Ceres, Pluto)
//   nicht verschwinden.
const PLANET_DATA: PlanetData[] = [
  // Merkur: realer Durchmesser 4.879 km -> deutlich kleiner als die Erde.
  { name: 'Mercury', au: 0.387, period: 87.97, mass: 0.055, moons: 0, type: 'Rocky Planet', color: '#b5b5b5', radius: 3.1 },
  // Venus: 12.104 km -> fast erdgross.
  { name: 'Venus', au: 0.723, period: 224.70, mass: 0.815, moons: 0, type: 'Terrestrial Planet', color: '#e8cda0', radius: 4.9 },
  // Erde: 12.742 km -> Referenzkoerper mit Index 5.
  { name: 'Earth', au: 1.000, period: 365.25, mass: 1.000, moons: 1, type: 'Habitable Planet', color: '#4b9cd3', radius: 5.0 },
  // Mars: 6.779 km -> etwa halb so gross wie die Erde.
  { name: 'Mars', au: 1.524, period: 686.97, mass: 0.107, moons: 2, type: 'Rocky Planet', color: '#c1440e', radius: 3.6 },
  // Ceres (Zwergplanet): nur 940 km -> sehr klein, faengt die Mindestgroesse ab.
  { name: 'Ceres', au: 2.767, period: 1681.63, mass: 0.00015, moons: 0, type: 'Dwarf Planet', color: '#8d99ae', radius: 1.4 },
  // Jupiter: 139.820 km -> mit Abstand groesster Planet, hier ~3,3x Erddurchmesser.
  { name: 'Jupiter', au: 5.203, period: 4332.59, mass: 317.8, moons: 95, type: 'Gas Giant', color: '#c88b3a', radius: 16.6 },
  // Saturn: 116.460 km -> knapp kleiner als Jupiter.
  { name: 'Saturn', au: 9.537, period: 10759.22, mass: 95.2, moons: 146, type: 'Gas Giant', color: '#e4d191', radius: 15.1 },
  // Uranus: 50.724 km -> Eisriese, rund halb so gross wie Jupiter.
  { name: 'Uranus', au: 19.190, period: 30688.50, mass: 14.5, moons: 28, type: 'Ice Giant', color: '#7de8e8', radius: 10.0 },
  // Neptun: 49.244 km -> nahezu gleich gross wie Uranus.
  { name: 'Neptune', au: 30.070, period: 60195.00, mass: 17.1, moons: 16, type: 'Ice Giant', color: '#3f54ba', radius: 9.8 },
  // Pluto (Zwergplanet): 2.376 km -> sehr klein, dicht an der Mindestgroesse.
  { name: 'Pluto', au: 39.482, period: 90560.00, mass: 0.0022, moons: 5, type: 'Dwarf Planet', color: '#cfa68b', radius: 2.2 }
]

interface ZoomTarget {
  name: string
  type: string
  parentName: string | null
  color: string
  radius: number
  isMoon: boolean
  parentIdx?: number
  moonOrbitRadius?: number
  moonOrbitSpeed?: number
  moonOffsetAngle?: number
  isSpecial?: boolean // For Halley and Voyager
  stats: {
    diameter: string
    distanceOrOrbit: string
    mass: string
    atmosphere: string
    temp: string
    tempRange: [number, number] // For rendering the temperature bar [min, max] in Celsius
    sizeScale: number // Size relative to Earth for the size comparison bubble
    moonsCount?: string
    features: string
    composition: { label: string; pct: number }[]
  }
}

const ZOOM_TARGETS: ZoomTarget[] = [
  {
    name: 'Mercury',
    type: 'Rocky Planet',
    parentName: null,
    color: '#b5b5b5',
    radius: 3,
    isMoon: false,
    stats: {
      diameter: '4,879 km',
      distanceOrOrbit: '0.387 AU from Sun',
      mass: '0.055 Earths',
      atmosphere: 'Exosphere (He/Na)',
      temp: '-173°C to 427°C',
      tempRange: [-173, 427],
      sizeScale: 0.38,
      moonsCount: '0',
      features: 'Extreme solar heating, zero planetary shielding, heavily cratered metal-rich crust.',
      composition: [{ label: 'Iron (Core)', pct: 70 }, { label: 'Silicates', pct: 30 }]
    }
  },
  {
    name: 'Venus',
    type: 'Terrestrial Planet',
    parentName: null,
    color: '#e8cda0',
    radius: 5,
    isMoon: false,
    stats: {
      diameter: '12,104 km',
      distanceOrOrbit: '0.723 AU from Sun',
      mass: '0.815 Earths',
      atmosphere: 'Dense CO2 (92 bar)',
      temp: '464°C',
      tempRange: [450, 480],
      sizeScale: 0.95,
      moonsCount: '0',
      features: 'Runaway greenhouse effect, crushing atmospheric pressure, sulfuric acid rain.',
      composition: [{ label: 'CO2', pct: 96 }, { label: 'Nitrogen', pct: 3.5 }]
    }
  },
  {
    name: 'Earth',
    type: 'Habitable Planet',
    parentName: null,
    color: '#4b9cd3',
    radius: 5,
    isMoon: false,
    stats: {
      diameter: '12,742 km',
      distanceOrOrbit: '1.000 AU from Sun',
      mass: '1.000 Earths',
      atmosphere: 'Nitrogen/Oxygen (1 bar)',
      temp: '15°C (Average)',
      tempRange: [-89, 58],
      sizeScale: 1.0,
      moonsCount: '1',
      features: 'Liquid water oceans, active plate tectonics, strong magnetosphere, diverse biosphere.',
      composition: [{ label: 'Nitrogen', pct: 78 }, { label: 'Oxygen', pct: 21 }, { label: 'Argon', pct: 1 }]
    }
  },
  {
    name: 'Moon',
    type: 'Rocky Moon',
    parentName: 'Earth',
    color: '#9ca3af',
    radius: 1.5,
    isMoon: true,
    parentIdx: 2,
    moonOrbitRadius: 13,
    moonOrbitSpeed: 3.5,
    moonOffsetAngle: 0,
    stats: {
      diameter: '3,474 km',
      distanceOrOrbit: '27.3 Days around Earth',
      mass: '0.012 Earths',
      atmosphere: 'None (Exosphere)',
      temp: '-130°C to 120°C',
      tempRange: [-130, 120],
      sizeScale: 0.27,
      features: 'Tidally locked, ancient basaltic maria plains, highly cratered highlands.',
      composition: [{ label: 'Oxygen', pct: 43 }, { label: 'Silicon', pct: 21 }, { label: 'Iron', pct: 10 }]
    }
  },
  {
    name: 'Mars',
    type: 'Rocky Planet',
    parentName: null,
    color: '#c1440e',
    radius: 4,
    isMoon: false,
    stats: {
      diameter: '6,779 km',
      distanceOrOrbit: '1.524 AU from Sun',
      mass: '0.107 Earths',
      atmosphere: 'Thin CO2 (0.006 bar)',
      temp: '-63°C',
      tempRange: [-143, 35],
      sizeScale: 0.53,
      moonsCount: '2',
      features: 'Iron oxide surface, Olympus Mons volcano, massive Valles Marineris canyon.',
      composition: [{ label: 'CO2', pct: 95 }, { label: 'Nitrogen', pct: 2.8 }, { label: 'Argon', pct: 2 }]
    }
  },
  {
    name: 'Phobos',
    type: 'Rocky Moon',
    parentName: 'Mars',
    color: '#8b7e74',
    radius: 0.9,
    isMoon: true,
    parentIdx: 3,
    moonOrbitRadius: 9,
    moonOrbitSpeed: 6.0,
    moonOffsetAngle: 1.0,
    stats: {
      diameter: '22.2 km (Irregular)',
      distanceOrOrbit: '7.6 Hours around Mars',
      mass: '1.8e-8 Earths',
      atmosphere: 'None',
      temp: '-40°C',
      tempRange: [-110, 0],
      sizeScale: 0.05,
      features: 'Captured asteroid origin, orbital decay: will collide with Mars in 50M years.',
      composition: [{ label: 'Carbonaceous Chondrite', pct: 100 }]
    }
  },
  {
    name: 'Deimos',
    type: 'Rocky Moon',
    parentName: 'Mars',
    color: '#bda89b',
    radius: 0.7,
    isMoon: true,
    parentIdx: 3,
    moonOrbitRadius: 13,
    moonOrbitSpeed: 3.8,
    moonOffsetAngle: 4.5,
    stats: {
      diameter: '12.6 km (Irregular)',
      distanceOrOrbit: '30.3 Hours around Mars',
      mass: '2.4e-9 Earths',
      atmosphere: 'None',
      temp: '-40°C',
      tempRange: [-110, 0],
      sizeScale: 0.04,
      features: 'Outermost Martian satellite, escape velocity is only 5.6 m/s.',
      composition: [{ label: 'Carbonaceous Material', pct: 100 }]
    }
  },
  {
    name: 'Ceres',
    type: 'Dwarf Planet',
    parentName: null,
    color: '#8d99ae',
    radius: 1.8,
    isMoon: false,
    stats: {
      diameter: '940 km',
      distanceOrOrbit: '2.767 AU from Sun',
      mass: '0.00015 Earths',
      atmosphere: 'Subtle water vapor',
      temp: '-105°C',
      tempRange: [-140, -38],
      sizeScale: 0.07,
      moonsCount: '0',
      features: 'Largest body in Asteroid Belt, water-ice mantle, active cryovolcanic brines.',
      composition: [{ label: 'Water Ice', pct: 40 }, { label: 'Rocky Core', pct: 60 }]
    }
  },
  {
    name: 'Jupiter',
    type: 'Gas Giant',
    parentName: null,
    color: '#c88b3a',
    radius: 11,
    isMoon: false,
    stats: {
      diameter: '139,820 km',
      distanceOrOrbit: '5.203 AU from Sun',
      mass: '317.8 Earths',
      atmosphere: 'Hydrogen/Helium',
      temp: '-110°C',
      tempRange: [-150, -100],
      sizeScale: 11.2,
      moonsCount: '95',
      features: 'Great Red Spot storm, massive magnetic field, metallic hydrogen ocean core.',
      composition: [{ label: 'Hydrogen', pct: 89.8 }, { label: 'Helium', pct: 10.2 }]
    }
  },
  {
    name: 'Io',
    type: 'Volcanic Moon',
    parentName: 'Jupiter',
    color: '#e3e33b',
    radius: 1.6,
    isMoon: true,
    parentIdx: 5,
    moonOrbitRadius: 18,
    moonOrbitSpeed: 4.8,
    moonOffsetAngle: 0.5,
    stats: {
      diameter: '3,643 km',
      distanceOrOrbit: '1.77 Days around Jupiter',
      mass: '0.015 Earths',
      atmosphere: 'Thin SO2 (Sulfur)',
      temp: '-130°C',
      tempRange: [-160, -110],
      sizeScale: 0.29,
      features: 'Extreme tidal flexing by Jupiter and Europa, hosting over 400 active volcanoes.',
      composition: [{ label: 'Silicates (Crust)', pct: 80 }, { label: 'Iron (Core)', pct: 20 }]
    }
  },
  {
    name: 'Europa',
    type: 'Icy Moon',
    parentName: 'Jupiter',
    color: '#a6d6f5',
    radius: 1.5,
    isMoon: true,
    parentIdx: 5,
    moonOrbitRadius: 22,
    moonOrbitSpeed: 3.2,
    moonOffsetAngle: 2.1,
    stats: {
      diameter: '3,121 km',
      distanceOrOrbit: '3.55 Days around Jupiter',
      mass: '0.008 Earths',
      atmosphere: 'Extremely thin O2',
      temp: '-160°C',
      tempRange: [-220, -140],
      sizeScale: 0.24,
      features: 'Subsurface liquid water ocean under a 15-25 km thick water-ice shell.',
      composition: [{ label: 'Water Ice', pct: 15 }, { label: 'Silicate Rock', pct: 85 }]
    }
  },
  {
    name: 'Ganymede',
    type: 'Icy Moon',
    parentName: 'Jupiter',
    color: '#b09f8a',
    radius: 2.0,
    isMoon: true,
    parentIdx: 5,
    moonOrbitRadius: 26,
    moonOrbitSpeed: 2.2,
    moonOffsetAngle: 3.8,
    stats: {
      diameter: '5,268 km',
      distanceOrOrbit: '7.15 Days around Jupiter',
      mass: '0.025 Earths',
      atmosphere: 'Oxygen trace',
      temp: '-163°C',
      tempRange: [-200, -120],
      sizeScale: 0.41,
      features: 'Largest satellite in the Solar System, possessing its own active magnetic field.',
      composition: [{ label: 'Water Ice', pct: 50 }, { label: 'Silicate Rock', pct: 50 }]
    }
  },
  {
    name: 'Callisto',
    type: 'Icy Moon',
    parentName: 'Jupiter',
    color: '#7a776c',
    radius: 1.8,
    isMoon: true,
    parentIdx: 5,
    moonOrbitRadius: 31,
    moonOrbitSpeed: 1.5,
    moonOffsetAngle: 5.2,
    stats: {
      diameter: '4,821 km',
      distanceOrOrbit: '16.7 Days around Jupiter',
      mass: '0.018 Earths',
      atmosphere: 'Carbon dioxide trace',
      temp: '-139°C',
      tempRange: [-180, -100],
      sizeScale: 0.38,
      features: 'Most heavily cratered object, ancient geologically dead ice-rock surface.',
      composition: [{ label: 'Water Ice', pct: 45 }, { label: 'Silicates', pct: 55 }]
    }
  },
  {
    name: 'Saturn',
    type: 'Gas Giant',
    parentName: null,
    color: '#e4d191',
    radius: 9,
    isMoon: false,
    stats: {
      diameter: '116,460 km',
      distanceOrOrbit: '9.537 AU from Sun',
      mass: '95.2 Earths',
      atmosphere: 'Hydrogen/Helium',
      temp: '-140°C',
      tempRange: [-180, -130],
      sizeScale: 9.1,
      moonsCount: '146',
      features: 'Stunning rings made of ice, water-ice crust, lowest density of all planets.',
      composition: [{ label: 'Hydrogen', pct: 96.3 }, { label: 'Helium', pct: 3.2 }]
    }
  },
  {
    name: 'Mimas',
    type: 'Icy Moon',
    parentName: 'Saturn',
    color: '#9c9c9c',
    radius: 1.0,
    isMoon: true,
    parentIdx: 6,
    moonOrbitRadius: 16,
    moonOrbitSpeed: 5.0,
    moonOffsetAngle: 1.2,
    stats: {
      diameter: '396 km',
      distanceOrOrbit: '22.6 Hours around Saturn',
      mass: '6.3e-6 Earths',
      atmosphere: 'None',
      temp: '-180°C',
      tempRange: [-210, -150],
      sizeScale: 0.03,
      features: 'Dominated by the giant Herschel impact crater, giving a Death Star profile.',
      composition: [{ label: 'Water Ice', pct: 98 }, { label: 'Rock', pct: 2 }]
    }
  },
  {
    name: 'Enceladus',
    type: 'Icy Moon',
    parentName: 'Saturn',
    color: '#eef8ff',
    radius: 1.1,
    isMoon: true,
    parentIdx: 6,
    moonOrbitRadius: 19,
    moonOrbitSpeed: 3.8,
    moonOffsetAngle: 2.9,
    stats: {
      diameter: '504 km',
      distanceOrOrbit: '32.9 Hours around Saturn',
      mass: '1.8e-5 Earths',
      atmosphere: 'Water vapor trace',
      temp: '-201°C',
      tempRange: [-220, -180],
      sizeScale: 0.04,
      features: 'Active hydro-thermal cryovolcanic geysers venting water vapor/salts into space.',
      composition: [{ label: 'Water Ice', pct: 60 }, { label: 'Silicate Core', pct: 40 }]
    }
  },
  {
    name: 'Tethys',
    type: 'Icy Moon',
    parentName: 'Saturn',
    color: '#c1c1c1',
    radius: 1.2,
    isMoon: true,
    parentIdx: 6,
    moonOrbitRadius: 22,
    moonOrbitSpeed: 3.0,
    moonOffsetAngle: 2.0,
    stats: {
      diameter: '1,062 km',
      distanceOrOrbit: '1.89 Days around Saturn',
      mass: '0.0001 Earths',
      atmosphere: 'None',
      temp: '-187°C',
      tempRange: [-200, -180],
      sizeScale: 0.08,
      features: 'Features the massive Odysseus crater (400 km across) and the Ithaca Chasma canyon system.',
      composition: [{ label: 'Water Ice', pct: 99 }, { label: 'Silicate Rock', pct: 1 }]
    }
  },
  {
    name: 'Dione',
    type: 'Icy Moon',
    parentName: 'Saturn',
    color: '#d2d2d2',
    radius: 1.3,
    isMoon: true,
    parentIdx: 6,
    moonOrbitRadius: 25,
    moonOrbitSpeed: 2.4,
    moonOffsetAngle: 3.2,
    stats: {
      diameter: '1,122 km',
      distanceOrOrbit: '2.73 Days around Saturn',
      mass: '0.00018 Earths',
      atmosphere: 'Trace Ozone/Oxygen',
      temp: '-186°C',
      tempRange: [-195, -180],
      sizeScale: 0.09,
      features: 'Has bright ice cliffs formed by tectonic fractures. Co-orbital with Helene and Polydeuces.',
      composition: [{ label: 'Water Ice', pct: 54 }, { label: 'Silicate Core', pct: 46 }]
    }
  },
  {
    name: 'Rhea',
    type: 'Icy Moon',
    parentName: 'Saturn',
    color: '#a0a0a0',
    radius: 1.4,
    isMoon: true,
    parentIdx: 6,
    moonOrbitRadius: 28,
    moonOrbitSpeed: 1.9,
    moonOffsetAngle: 0.8,
    stats: {
      diameter: '1,527 km',
      distanceOrOrbit: '4.52 Days around Saturn',
      mass: '0.00038 Earths',
      atmosphere: 'Thin Oxygen/CO2',
      temp: '-174°C',
      tempRange: [-220, -170],
      sizeScale: 0.12,
      features: 'Saturn\'s second-largest moon. Possesses a highly cratered surface and a tenuous exosphere.',
      composition: [{ label: 'Water Ice', pct: 75 }, { label: 'Rocky Core', pct: 25 }]
    }
  },
  {
    name: 'Titan',
    type: 'Aerosol Moon',
    parentName: 'Saturn',
    color: '#e3a830',
    radius: 1.9,
    isMoon: true,
    parentIdx: 6,
    moonOrbitRadius: 32,
    moonOrbitSpeed: 1.4,
    moonOffsetAngle: 4.1,
    stats: {
      diameter: '5,149 km',
      distanceOrOrbit: '15.9 Days around Saturn',
      mass: '0.022 Earths',
      atmosphere: 'Dense Nitrogen (1.5 bar)',
      temp: '-179°C',
      tempRange: [-182, -176],
      sizeScale: 0.40,
      features: 'Dense haze atmosphere, hydrologic cycle of liquid methane/ethane lakes.',
      composition: [{ label: 'Nitrogen', pct: 95 }, { label: 'Methane', pct: 4.9 }]
    }
  },
  {
    name: 'Iapetus',
    type: 'Icy Moon',
    parentName: 'Saturn',
    color: '#54463d',
    radius: 1.3,
    isMoon: true,
    parentIdx: 6,
    moonOrbitRadius: 37,
    moonOrbitSpeed: 0.8,
    moonOffsetAngle: 5.6,
    stats: {
      diameter: '1,469 km',
      distanceOrOrbit: '79.3 Days around Saturn',
      mass: '0.0003 Earths',
      atmosphere: 'None',
      temp: '-143°C',
      tempRange: [-180, -110],
      sizeScale: 0.12,
      features: 'Stark two-toned dark/light albedo split, massive equatorial ridge.',
      composition: [{ label: 'Water Ice', pct: 80 }, { label: 'Rocky Silicates', pct: 20 }]
    }
  },
  {
    name: 'Uranus',
    type: 'Ice Giant',
    parentName: null,
    color: '#7de8e8',
    radius: 7,
    isMoon: false,
    stats: {
      diameter: '50,724 km',
      distanceOrOrbit: '19.190 AU from Sun',
      mass: '14.5 Earths',
      atmosphere: 'H2/He/CH4',
      temp: '-195°C',
      tempRange: [-224, -180],
      sizeScale: 4.0,
      moonsCount: '28',
      features: 'Tilted 98 degrees on axis (eccentric rolling orbit), vertical rings.',
      composition: [{ label: 'Hydrogen', pct: 82.5 }, { label: 'Helium', pct: 15.2 }, { label: 'Methane', pct: 2.3 }]
    }
  },
  {
    name: 'Miranda',
    type: 'Fractured Moon',
    parentName: 'Uranus',
    color: '#8fa0a8',
    radius: 0.9,
    isMoon: true,
    parentIdx: 7,
    moonOrbitRadius: 13,
    moonOrbitSpeed: 4.8,
    moonOffsetAngle: 1.5,
    stats: {
      diameter: '472 km',
      distanceOrOrbit: '1.41 Days around Uranus',
      mass: '1.1e-5 Earths',
      atmosphere: 'None',
      temp: '-187°C',
      tempRange: [-213, -180],
      sizeScale: 0.04,
      features: 'Hosts Verona Rupes, the tallest cliff in the solar system (20 km deep). Extreme fractured geological patchwork.',
      composition: [{ label: 'Water Ice', pct: 60 }, { label: 'Silicates', pct: 40 }]
    }
  },
  {
    name: 'Ariel',
    type: 'Icy Moon',
    parentName: 'Uranus',
    color: '#b8c9d0',
    radius: 1.3,
    isMoon: true,
    parentIdx: 7,
    moonOrbitRadius: 16,
    moonOrbitSpeed: 3.6,
    moonOffsetAngle: 2.7,
    stats: {
      diameter: '1,158 km',
      distanceOrOrbit: '2.52 Days around Uranus',
      mass: '0.0002 Earths',
      atmosphere: 'None',
      temp: '-190°C',
      tempRange: [-210, -180],
      sizeScale: 0.09,
      features: 'Brightest moon of Uranus. Marked by deep grabens, extensive fault valleys, and cryovolcanic flows.',
      composition: [{ label: 'Water Ice', pct: 50 }, { label: 'Rocky Material', pct: 50 }]
    }
  },
  {
    name: 'Umbriel',
    type: 'Dark Moon',
    parentName: 'Uranus',
    color: '#4a5255',
    radius: 1.3,
    isMoon: true,
    parentIdx: 7,
    moonOrbitRadius: 19,
    moonOrbitSpeed: 2.7,
    moonOffsetAngle: 4.1,
    stats: {
      diameter: '1,169 km',
      distanceOrOrbit: '4.14 Days around Uranus',
      mass: '0.0002 Earths',
      atmosphere: 'None',
      temp: '-193°C',
      tempRange: [-210, -180],
      sizeScale: 0.09,
      features: 'The darkest of Uranus\'s large moons. Heavily cratered with a prominent bright ring crater (Wunda).',
      composition: [{ label: 'Water Ice', pct: 40 }, { label: 'Rocky Core', pct: 60 }]
    }
  },
  {
    name: 'Titania',
    type: 'Icy Moon',
    parentName: 'Uranus',
    color: '#c0cbd0',
    radius: 1.5,
    isMoon: true,
    parentIdx: 7,
    moonOrbitRadius: 23,
    moonOrbitSpeed: 1.9,
    moonOffsetAngle: 0.5,
    stats: {
      diameter: '1,578 km',
      distanceOrOrbit: '8.71 Days around Uranus',
      mass: '0.00057 Earths',
      atmosphere: 'None',
      temp: '-189°C',
      tempRange: [-213, -180],
      sizeScale: 0.12,
      features: 'Uranus\'s largest moon. Traversed by massive fault scarps, grabens, and the huge canyon Messina Chasma.',
      composition: [{ label: 'Water Ice', pct: 46 }, { label: 'Rocky Core', pct: 54 }]
    }
  },
  {
    name: 'Oberon',
    type: 'Cratered Moon',
    parentName: 'Uranus',
    color: '#90989c',
    radius: 1.4,
    isMoon: true,
    parentIdx: 7,
    moonOrbitRadius: 27,
    moonOrbitSpeed: 1.3,
    moonOffsetAngle: 3.5,
    stats: {
      diameter: '1,523 km',
      distanceOrOrbit: '13.46 Days around Uranus',
      mass: '0.0005 Earths',
      atmosphere: 'None',
      temp: '-191°C',
      tempRange: [-213, -180],
      sizeScale: 0.12,
      features: 'The outermost of Uranus\'s major moons. Heavily cratered with dark material covering crater floors.',
      composition: [{ label: 'Water Ice', pct: 46 }, { label: 'Rocky Core', pct: 54 }]
    }
  },
  {
    name: 'Neptune',
    type: 'Ice Giant',
    parentName: null,
    color: '#3f54ba',
    radius: 7,
    isMoon: false,
    stats: {
      diameter: '49,244 km',
      distanceOrOrbit: '30.070 AU from Sun',
      mass: '17.1 Earths',
      atmosphere: 'H2/He/CH4',
      temp: '-200°C',
      tempRange: [-218, -190],
      sizeScale: 3.9,
      moonsCount: '16',
      features: 'Extreme blue methane sky, home to supersonic winds up to 2,100 km/h.',
      composition: [{ label: 'Hydrogen', pct: 80 }, { label: 'Helium', pct: 19 }, { label: 'Methane', pct: 1.5 }]
    }
  },
  {
    name: 'Triton',
    type: 'Cryovolcanic Moon',
    parentName: 'Neptune',
    color: '#9ec9cf',
    radius: 1.4,
    isMoon: true,
    parentIdx: 8,
    moonOrbitRadius: 20,
    moonOrbitSpeed: -2.5,
    moonOffsetAngle: 1.8,
    stats: {
      diameter: '2,706 km',
      distanceOrOrbit: '5.87 Days around Neptune',
      mass: '0.0037 Earths',
      atmosphere: 'Thin Nitrogen',
      temp: '-235°C',
      tempRange: [-240, -230],
      sizeScale: 0.21,
      features: 'Unique retrograde orbit, active liquid nitrogen cryovolcanic geysers.',
      composition: [{ label: 'Nitrogen Ice', pct: 55 }, { label: 'Rock/Metal Core', pct: 45 }]
    }
  },
  {
    name: 'Pluto',
    type: 'Dwarf Planet',
    parentName: null,
    color: '#cfa68b',
    radius: 1.5,
    isMoon: false,
    stats: {
      diameter: '2,376 km',
      distanceOrOrbit: '39.482 AU from Sun',
      mass: '0.0022 Earths',
      atmosphere: 'Nitrogen/Methane',
      temp: '-229°C',
      tempRange: [-240, -218],
      sizeScale: 0.19,
      moonsCount: '5',
      features: 'Glacial nitrogen ice plains (Sputnik Planitia), Charon binary barycenter.',
      composition: [{ label: 'Nitrogen Ice', pct: 70 }, { label: 'Rocky Core', pct: 30 }]
    }
  },
  {
    name: "Halley's Comet",
    type: 'Cometary Nucleus',
    parentName: null,
    color: '#a1a8b8',
    radius: 1.2,
    isMoon: false,
    isSpecial: true,
    stats: {
      diameter: '11 km (Irregular)',
      distanceOrOrbit: '0.586 to 35.1 AU (Elliptical)',
      mass: '3.6e-11 Earths',
      atmosphere: 'Transient Coma (H2O/CO)',
      temp: '-180°C to 80°C',
      tempRange: [-200, 100],
      sizeScale: 0.02,
      features: 'Famous periodic comet with highly eccentric retrograde orbit (75.3-year period). Outgasses dust and gas tails when close to perihelion.',
      composition: [{ label: 'Water Ice', pct: 80 }, { label: 'Carbon Soot', pct: 20 }]
    }
  },
  {
    name: 'Voyager 1',
    type: 'Interstellar Probe',
    parentName: null,
    color: '#f8fafc',
    radius: 1.0,
    isMoon: false,
    isSpecial: true,
    stats: {
      diameter: '3.7 m (High-Gain Dish)',
      distanceOrOrbit: 'Hyperbolic Trajectory (drifting)',
      mass: '825 kg (Launch Weight)',
      atmosphere: 'None',
      temp: '-253°C',
      tempRange: [-255, -245],
      sizeScale: 0.001,
      features: 'Humanity\'s furthest spacecraft, crossed Heliopause into interstellar space (Aug 2012). Transmits telemetry via 22W RTG.',
      composition: [{ label: 'Instruments', pct: 50 }, { label: 'RTG Fuel (Pu-238)', pct: 50 }]
    }
  }
]

const DAYS_PER_MS = 365.25 / (14 * 1000) // Slightly slower simulation
const MAX_AU = 39.482 // groesste Bahn im Datensatz (Pluto) als Skalierungs-Obergrenze
const MIN_AU = 0.387 // kleinste Bahn im Datensatz (Merkur) als Skalierungs-Untergrenze

// Wandelt den Bahnradius eines Planeten (in Astronomischen Einheiten, AU) in einen
// Pixel-Radius um. Die echten AU-Abstaende sind extrem gespreizt (Merkur 0,387 AU,
// Pluto 39,5 AU -> Faktor ~100). Eine 1:1-Darstellung wuerde die inneren Planeten
// alle an der Sonne zusammendraengen. Deshalb wird mit einer Potenz-Kompression
// (Exponent 0.55) gestaucht: nahe an linear genug, dass die ECHTEN Verhaeltnisse
// und die Reihenfolge erhalten bleiben, aber gestaucht genug, dass alle zehn Bahnen
// gut sichtbar zwischen `minOrbit` und `maxOrbit` Platz finden.
//
// Damit Merkur (kleinster Wert) genau auf `minOrbit` und Pluto (groesster Wert)
// genau auf `maxOrbit` landet, wird der komprimierte Wert auf das Intervall
// [MIN_AU..MAX_AU] normiert (0 = Merkur-Bahn, 1 = Pluto-Bahn).
const ORBIT_COMPRESSION = 0.55
function orbitRadius(au: number, minOrbit: number, maxOrbit: number): number {
  const minC = Math.pow(MIN_AU, ORBIT_COMPRESSION)
  const maxC = Math.pow(MAX_AU, ORBIT_COMPRESSION)
  // normierter Wert 0..1 entlang der komprimierten Skala
  const t = (Math.pow(au, ORBIT_COMPRESSION) - minC) / (maxC - minC)
  return minOrbit + (maxOrbit - minOrbit) * t
}

const STARS: { x: number; y: number }[] = Array.from({ length: 200 }, () => ({
  x: Math.random(),
  y: Math.random()
}))

type ZoomPhase = 'idle' | 'zooming_in' | 'watching' | 'zooming_out'

interface ZoomState {
  phase: ZoomPhase
  targetIdx: number
  progress: number
  watchTimer: number
  idleTimer: number
}

const ZOOM_IDLE_MS = 6000
const ZOOM_IN_MS = 1500
const ZOOM_WATCH_MS = 7500 // slightly longer watch time
const ZOOM_OUT_MS = 1500
const ZOOM_TARGET = 8.5
const ZOOM_OVERVIEW = 0.95

function easeInOut(t: number): number {
  return 0.5 - 0.5 * Math.cos(t * Math.PI)
}

// Canvas-Textumbruch fuer enge Info-Overlays. Canvas kennt keine CSS-Zeilenumbrueche,
// darum muessen wir die Wortzeilen selbst bauen.
function wrapCanvasLines(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const test = current ? `${current} ${word}` : word
    if (ctx.measureText(test).width > maxW && current) {
      lines.push(current)
      current = word
    } else {
      current = test
    }
  }

  if (current) lines.push(current)
  return lines
}

function drawWrappedCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxW: number,
  lineH: number
): number {
  for (const line of wrapCanvasLines(ctx, text, maxW)) {
    ctx.fillText(line, x, y)
    y += lineH
  }
  return y
}

function drawCompactInfoBox(
  ctx: CanvasRenderingContext2D,
  target: ZoomTarget,
  W: number,
  H: number,
  alpha: number
) {
  const minDim = Math.min(W, H)
  const pad = Math.max(4, Math.min(8, Math.round(minDim * 0.04)))
  const boxX = pad
  const boxY = pad
  const boxW = Math.max(1, W - pad * 2)
  const boxH = Math.max(1, H - pad * 2)
  const contentW = boxW - pad * 2

  const baseLines = [
    `${target.name}${target.isMoon ? ` (${target.parentName} Satellite)` : ''}`,
    `Classification: ${target.type}`,
    `Dimension: ${target.stats.diameter}`,
    `Orbital Range: ${target.stats.distanceOrOrbit}`,
    `Mass Scale: ${target.stats.mass}`,
    `Atmospheric Profile: ${target.stats.atmosphere}`,
    ...(!target.isMoon && target.stats.moonsCount && !target.isSpecial ? [`Confirmed Satellites: ${target.stats.moonsCount}`] : []),
    `Thermal Profile: ${target.stats.temp} (${target.stats.tempRange[0]}°C..${target.stats.tempRange[1]}°C)`,
    `Core Composition: ${target.stats.composition.map(item => `${item.label} ${item.pct}%`).join(' / ')}`,
    `Earth Scale: ${target.stats.sizeScale.toFixed(2)}x`,
    target.stats.features
  ]

  // Schrift iterativ verkleinern, bis alle umgebrochenen Zeilen in die Kachel
  // passen. Minimum 4 px: winzig, aber noch sinnvoller als abgeschnittene Box.
  let fontSize = Math.max(4, Math.min(9, minDim * 0.045))
  let titleSize = fontSize + 1.5
  let lineH = fontSize * 1.35
  for (let i = 0; i < 8; i++) {
    let needed = pad
    baseLines.forEach((line, idx) => {
      ctx.font = `${idx === 0 ? 'bold ' : ''}${idx === 0 ? titleSize : fontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
      needed += wrapCanvasLines(ctx, line, contentW).length * lineH
      if (idx === 0 || idx === baseLines.length - 2) needed += lineH * 0.25
    })
    if (needed + pad <= boxH || fontSize <= 4.05) break
    fontSize -= 0.55
    titleSize = fontSize + 1.2
    lineH = fontSize * 1.32
  }

  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = '#020617'
  ctx.fillRect(boxX, boxY, boxW, boxH)
  ctx.strokeStyle = target.isMoon ? 'rgba(217, 119, 6, 0.85)' : 'rgba(37, 99, 235, 0.85)'
  ctx.lineWidth = 1
  ctx.strokeRect(boxX + 0.5, boxY + 0.5, boxW - 1, boxH - 1)

  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  let y = boxY + pad

  baseLines.forEach((line, idx) => {
    const isTitle = idx === 0
    const isFeature = idx === baseLines.length - 1
    ctx.font = `${isTitle ? 'bold ' : isFeature ? 'italic ' : ''}${isTitle ? titleSize : fontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
    ctx.fillStyle = isTitle ? '#ffffff' : isFeature ? (target.isMoon ? '#fde047' : '#93c5fd') : '#cbd5e1'
    y = drawWrappedCanvasText(ctx, line, boxX + pad, y, contentW, lineH)
    if (idx === 0 || idx === baseLines.length - 2) y += lineH * 0.25
  })

  ctx.restore()
}

function usesCompactInfoBox(W: number, H: number): boolean {
  return W < 560 || H < 260
}

function drawInfoBox(
  ctx: CanvasRenderingContext2D,
  target: ZoomTarget,
  W: number,
  H: number,
  alpha: number
) {
  // In Mobile-Proxima koennen Solar-System-Kacheln sehr flach werden. Dann darf
  // die Infobox die Szene komplett ersetzen, muss aber vollstaendig im Bild liegen.
  if (usesCompactInfoBox(W, H)) {
    drawCompactInfoBox(ctx, target, W, H, alpha)
    return
  }

  const minDim = Math.min(W, H)
  const fontSize = Math.max(9.5, Math.min(12, Math.round(minDim * 0.024)))
  const titleSize = fontSize + 4
  const lineH = fontSize + 5
  const padX = 14
  const padY = 12

  const lines = [
    `Classification: ${target.type}`,
    `Dimension: ${target.stats.diameter}`,
    `Orbital Range: ${target.stats.distanceOrOrbit}`,
    `Mass Scale: ${target.stats.mass}`,
    `Atmospheric Profile: ${target.stats.atmosphere}`
  ]

  if (!target.isMoon && target.stats.moonsCount && !target.isSpecial) {
    lines.push(`Confirmed Satellites: ${target.stats.moonsCount}`)
  }

  // Width calculations (proportional clean typography)
  ctx.font = `bold ${titleSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
  let maxW = ctx.measureText(`${target.name} ${target.isMoon ? `(Satellite of ${target.parentName})` : ''}`).width
  
  ctx.font = `${fontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
  for (const line of lines) {
    maxW = Math.max(maxW, ctx.measureText(line).width)
  }
  
  // Set tactical info box width & height
  const featMaxW = Math.min(330, W * 0.42)
  const boxW = Math.min(W - 16, Math.max(maxW, featMaxW) + padX * 2 + 10)
  
  // Dynamic height including stats, visual comparisons, and wrapped features block
  let boxH = 40 + lines.length * lineH + padY * 2 + 120

  // Placed centered horizontally on the right half
  const bx = Math.max(8, Math.min(W - boxW - 8, W * 0.73 - boxW / 2))
  const by = Math.max(8, Math.min(H - boxH - 8, (H - boxH) / 2))

  // Background Glassmorphism layout (sleek slate/black)
  ctx.globalAlpha = alpha * 0.84
  ctx.fillStyle = '#060813'
  ctx.fillRect(bx, by, boxW, boxH)

  // Glowing Deep Blue / Amber border
  ctx.globalAlpha = alpha * 0.95
  ctx.strokeStyle = target.isMoon ? 'rgba(217, 119, 6, 0.75)' : 'rgba(37, 99, 235, 0.75)'
  ctx.lineWidth = 1.2
  ctx.strokeRect(bx, by, boxW, boxH)

  // Title
  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'
  ctx.fillStyle = '#ffffff'
  ctx.font = `bold ${titleSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
  ctx.fillText(
    `${target.name}${target.isMoon ? ` (${target.parentName} Satellite)` : ''}`,
    bx + padX,
    by + padY
  )

  // Divider
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)'
  ctx.lineWidth = 0.8
  ctx.beginPath()
  ctx.moveTo(bx + padX, by + padY + titleSize + 5)
  ctx.lineTo(bx + boxW - padX, by + padY + titleSize + 5)
  ctx.stroke()

  // Stats Text
  let cy = by + padY + titleSize + 14
  ctx.font = `${fontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
  
  lines.forEach((line) => {
    const parts = line.split(':')
    const key = parts[0] + ':'
    const val = parts.slice(1).join(':')
    
    ctx.fillStyle = '#94a3b8' // Slate label
    ctx.font = `bold ${fontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
    ctx.fillText(key, bx + padX, cy)
    
    const keyW = ctx.measureText(key).width
    ctx.fillStyle = '#f8fafc' // light value
    ctx.font = `${fontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
    ctx.fillText(val, bx + padX + keyW, cy)
    
    cy += lineH
  })

  // ── GRAPHIC 1: Chromatic Thermal Index Bar ───────────────────────────────
  cy += 8
  ctx.fillStyle = '#94a3b8'
  ctx.font = `bold ${fontSize - 1}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
  ctx.fillText('THERMAL PROFILE:', bx + padX, cy)
  
  cy += fontSize + 3
  // Draw chromatic temperature gradient bar (-250C to 500C)
  const barX = bx + padX
  const barW = boxW - padX * 2
  const barH = 5
  
  const tempGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0)
  tempGrad.addColorStop(0, '#38bdf8')   // Extreme Cold (-250C)
  tempGrad.addColorStop(0.35, '#94a3b8') // Cool (0C)
  tempGrad.addColorStop(0.65, '#f59e0b') // Warm (100C)
  tempGrad.addColorStop(1, '#ef4444')    // Extreme Hot (500C)
  
  ctx.fillStyle = tempGrad
  ctx.fillRect(barX, cy, barW, barH)
  
  // Calculate marker position based on temperature range
  const minTemp = target.stats.tempRange[0]
  const maxTemp = target.stats.tempRange[1]
  const avgTemp = (minTemp + maxTemp) / 2
  
  // map avgTemp (-250C..500C) to 0..1 ratio
  const tempRatio = Math.max(0.0, Math.min(1.0, (avgTemp + 250) / 750))
  const markerX = barX + tempRatio * barW
  
  // Draw glowing tick
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(markerX, cy - 2)
  ctx.lineTo(markerX, cy + barH + 2)
  ctx.stroke()
  
  // Temp labels
  ctx.fillStyle = '#64748b'
  ctx.font = `${fontSize - 2}px system-ui, -apple-system, sans-serif`
  ctx.textAlign = 'left'
  ctx.fillText('-250°C', barX, cy + barH + 3)
  ctx.textAlign = 'right'
  ctx.fillText('500°C', barX + barW, cy + barH + 3)
  ctx.textAlign = 'center'
  ctx.fillStyle = '#ffffff'
  ctx.fillText(target.stats.temp, markerX, cy - 8)

  // ── GRAPHIC 2: Interactive Composition Chart ───────────────────────────
  cy += 20
  ctx.textAlign = 'left'
  ctx.fillStyle = '#94a3b8'
  ctx.font = `bold ${fontSize - 1}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
  ctx.fillText('CORE COMPOSITION:', bx + padX, cy)
  
  cy += fontSize + 3
  const comp = target.stats.composition
  const colW = (boxW - padX * 2) / comp.length
  
  comp.forEach((item, idx) => {
    const ix = bx + padX + idx * colW
    const bW = colW - 8
    const bH = 4
    
    // Draw empty track
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)'
    ctx.fillRect(ix, cy, bW, bH)
    
    // Draw filled bar
    ctx.fillStyle = target.isMoon ? '#f59e0b' : '#3b82f6'
    ctx.fillRect(ix, cy, bW * (item.pct / 100), bH)
    
    // Draw label
    ctx.fillStyle = '#e2e8f0'
    ctx.font = `${fontSize - 2}px system-ui, sans-serif`
    ctx.fillText(`${item.label} (${item.pct}%)`, ix, cy + bH + 4)
  })

  // ── GRAPHIC 3: Size comparison vs Earth ──────────────────────────────────
  cy += 24
  ctx.fillStyle = '#94a3b8'
  ctx.font = `bold ${fontSize - 1}px system-ui, -apple-system, sans-serif`
  ctx.fillText('DIMENSIONAL PROPORTIONS (VS EARTH):', bx + padX, cy)
  
  cy += 14
  const compCenterY = cy + 12
  
  // Reference Earth (draw grey ghost bubble)
  const earthRadius = 14
  const earthX = bx + padX + 25
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)'
  ctx.lineWidth = 1.0
  ctx.beginPath()
  ctx.arc(earthX, compCenterY, earthRadius, 0, Math.PI * 2)
  ctx.stroke()
  
  ctx.fillStyle = 'rgba(148, 163, 184, 0.15)'
  ctx.beginPath()
  ctx.arc(earthX, compCenterY, earthRadius, 0, Math.PI * 2)
  ctx.fill()
  
  ctx.fillStyle = '#94a3b8'
  ctx.font = '7px monospace'
  ctx.textAlign = 'center'
  ctx.fillText('EARTH', earthX, compCenterY + 22)
  
  // Focused body comparison
  const targetR = Math.max(2.0, Math.min(22.0, earthRadius * target.stats.sizeScale))
  const targetX = bx + padX + 110
  
  ctx.strokeStyle = target.color
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.arc(targetX, compCenterY, targetR, 0, Math.PI * 2)
  ctx.stroke()
  
  ctx.fillStyle = target.color + '22' // Subtle transparent body fill
  ctx.beginPath()
  ctx.arc(targetX, compCenterY, targetR, 0, Math.PI * 2)
  ctx.fill()
  
  ctx.fillStyle = '#f8fafc'
  ctx.fillText(target.name.toUpperCase(), targetX, compCenterY + 22)
  
  // scale multiplier label in between
  ctx.fillStyle = '#64748b'
  ctx.font = 'bold 8px monospace'
  ctx.fillText(`[ ${target.stats.sizeScale.toFixed(2)}x ]`, (earthX + targetX) / 2, compCenterY)

  // ── Features description text wrap ───────────────────────────────────────
  cy += 35
  ctx.textAlign = 'left'
  ctx.fillStyle = target.isMoon ? '#fde047' : '#93c5fd' // Golden for moons, light blue for planets
  ctx.font = `italic ${fontSize - 0.5}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
  
  const words = target.stats.features.split(' ')
  let currentLine = ''
  for (const word of words) {
    const test = currentLine + word + ' '
    if (ctx.measureText(test).width > boxW - padX * 2) {
      ctx.fillText(currentLine, bx + padX, cy)
      currentLine = word + ' '
      cy += fontSize + 2
    } else {
      currentLine = test
    }
  }
  ctx.fillText(currentLine, bx + padX, cy)

  ctx.globalAlpha = 1
}

function SolarSystemPanel() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!

    let unsubscribe: (() => void) | null = null
    let running = true

    const resize = () => {
      canvas.width = canvas.clientWidth
      canvas.height = canvas.clientHeight
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const startTime = performance.now()
    let prevTime = startTime

    const zoom: ZoomState = {
      phase: 'idle',
      targetIdx: 0,
      progress: 0,
      watchTimer: 0,
      idleTimer: 0
    }

    let viewZoom = ZOOM_OVERVIEW
    let viewCenterX = 0
    let viewCenterY = 0

    let overviewCenterX = 0
    let overviewCenterY = 0

    function loop(now: number) {
      if (!running) return

      const W = canvas!.width
      const H = canvas!.height
      if (W === 0 || H === 0) return

      const dt = now - prevTime
      prevTime = now

      const elapsedMs = now - startTime
      const simDays = elapsedMs * DAYS_PER_MS

      const cx = W / 2
      const cy = H / 2
      const minDim = Math.min(W, H)
      const sunR = minDim * 0.05
      const minOrbit = sunR + 14
      const maxOrbit = minDim * 0.44

      // ── Calculate Planets coordinates ──────────────────────────────────────
      const START_ANGLES = [4.4, 2.1, 0.0, 5.5, 3.2, 0.8, 2.3, 4.0, 5.0, 1.2]
      const planetPositions = PLANET_DATA.map((p, i) => {
        const orbitR = orbitRadius(p.au, minOrbit, maxOrbit)
        const angle = START_ANGLES[i] + (simDays / p.period) * Math.PI * 2
        return {
          wx: Math.cos(angle) * orbitR,
          wy: Math.sin(angle) * orbitR,
          orbitR
        }
      })

      // ── Calculate Zoom Target coordinates ──────────────────────────────────
      const activeTarget = ZOOM_TARGETS[zoom.targetIdx]
      let targetWx = 0
      let targetWy = 0

      if (activeTarget.name === "Halley's Comet") {
        // Highly eccentric ellipse simulation for Halley
        const angle = (simDays / 1200) * Math.PI * 2 // orbit speed
        const a = maxOrbit * 0.88                  // semi-major axis
        const b = minOrbit * 1.5                   // semi-minor axis (eccentric)
        // Orbit center shifted to simulate Sun at one focus
        const focusOffset = Math.sqrt(a * a - b * b) * 0.82
        targetWx = Math.cos(angle) * a + focusOffset
        targetWy = Math.sin(angle) * b
      } else if (activeTarget.name === 'Voyager 1') {
        // Hyperbolic escape trajectory simulation (drifts straight outward)
        const travelRatio = Math.min(1.0, simDays / 120000)
        const driftDist = minOrbit + (maxOrbit * 1.5 - minOrbit) * travelRatio
        const angle = 2.85 // escape vector angle
        targetWx = Math.cos(angle) * driftDist
        targetWy = Math.sin(angle) * driftDist
      } else if (activeTarget.isMoon && activeTarget.parentIdx !== undefined) {
        const parentPos = planetPositions[activeTarget.parentIdx]
        const moonAngle = (activeTarget.moonOffsetAngle || 0) + (simDays / (activeTarget.moonOrbitSpeed || 1)) * 0.08
        targetWx = parentPos.wx + Math.cos(moonAngle) * (activeTarget.moonOrbitRadius || 12)
        targetWy = parentPos.wy + Math.sin(moonAngle) * (activeTarget.moonOrbitRadius || 12)
      } else {
        const idx = PLANET_DATA.findIndex(p => p.name === activeTarget.name)
        if (idx !== -1) {
          targetWx = planetPositions[idx].wx
          targetWy = planetPositions[idx].wy
        }
      }

      // ── Zoom State Machine ────────────────────────────────────────────────
      if (zoom.phase === 'idle') {
        zoom.idleTimer += dt
        if (zoom.idleTimer >= ZOOM_IDLE_MS) {
          zoom.targetIdx = (zoom.targetIdx + 1) % ZOOM_TARGETS.length
          zoom.idleTimer = 0
          zoom.progress = 0
          zoom.phase = 'zooming_in'
          overviewCenterX = viewCenterX
          overviewCenterY = viewCenterY
        }
      } else if (zoom.phase === 'zooming_in') {
        zoom.progress += dt / ZOOM_IN_MS
        if (zoom.progress >= 1) {
          zoom.progress = 1
          zoom.watchTimer = 0
          zoom.phase = 'watching'
        }
        // Offset camera slightly to place the zoomed body in the left half
        const shiftX = (W * 0.18) / ZOOM_TARGET
        const t = easeInOut(zoom.progress)
        viewZoom = ZOOM_OVERVIEW + (ZOOM_TARGET - ZOOM_OVERVIEW) * t
        viewCenterX = overviewCenterX + (targetWx + shiftX - overviewCenterX) * t
        viewCenterY = overviewCenterY + (targetWy - overviewCenterY) * t
      } else if (zoom.phase === 'watching') {
        zoom.watchTimer += dt
        const shiftX = (W * 0.18) / ZOOM_TARGET
        viewZoom = ZOOM_TARGET
        viewCenterX = targetWx + shiftX
        viewCenterY = targetWy
        if (zoom.watchTimer >= ZOOM_WATCH_MS) {
          zoom.progress = 0
          zoom.phase = 'zooming_out'
          overviewCenterX = viewCenterX
          overviewCenterY = viewCenterY
        }
      } else if (zoom.phase === 'zooming_out') {
        zoom.progress += dt / ZOOM_OUT_MS
        if (zoom.progress >= 1) {
          zoom.progress = 1
          zoom.idleTimer = 0
          zoom.phase = 'idle'
        }
        const t = easeInOut(zoom.progress)
        viewZoom = ZOOM_TARGET + (ZOOM_OVERVIEW - ZOOM_TARGET) * t
        viewCenterX = overviewCenterX + (0 - overviewCenterX) * t
        viewCenterY = overviewCenterY + (0 - overviewCenterY) * t
      }

      // Projection mapping Helper
      const toScreen = (wx: number, wy: number): [number, number] => [
        cx + (wx - viewCenterX) * viewZoom,
        cy + (wy - viewCenterY) * viewZoom
      ]

      // Background
      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, W, H)

      // Starfield Parallax stars
      ctx.fillStyle = 'rgba(255,255,255,0.48)'
      for (const star of STARS) {
        const sx = star.x * W - viewCenterX * viewZoom * 0.08
        const sy = star.y * H - viewCenterY * viewZoom * 0.08
        const swx = ((sx % W) + W) % W
        const swy = ((sy % H) + H) % H
        ctx.beginPath()
        ctx.arc(swx, swy, 0.7, 0, Math.PI * 2)
        ctx.fill()
      }

      // Sun
      const [sunSx, sunSy] = toScreen(0, 0)
      const scaledSunR = sunR * viewZoom
      
      const glow = ctx.createRadialGradient(sunSx, sunSy, scaledSunR * 0.6, sunSx, sunSy, scaledSunR * 1.5)
      glow.addColorStop(0, 'rgba(255,180,60,0.35)')
      glow.addColorStop(0.5, 'rgba(255,100,0,0.12)')
      glow.addColorStop(1, 'rgba(255,50,0,0)')
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(sunSx, sunSy, scaledSunR * 1.5, 0, Math.PI * 2)
      ctx.fill()

      ctx.fillStyle = '#ff7b00'
      ctx.beginPath()
      ctx.arc(sunSx, sunSy, scaledSunR, 0, Math.PI * 2)
      ctx.fill()

      // ── Render Planetary Orbits ───────────────────────────────────────────
      PLANET_DATA.forEach((_, i) => {
        const { orbitR } = planetPositions[i]
        const scaledOrbitR = orbitR * viewZoom
        ctx.strokeStyle = 'rgba(30, 41, 59, 0.35)'
        ctx.lineWidth = 1.0
        ctx.beginPath()
        ctx.arc(sunSx, sunSy, scaledOrbitR, 0, Math.PI * 2)
        ctx.stroke()
      })

      // ── Render Halley's Comet Orbit ────────────────────────────────────────
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.18)' // Subtle indigo ellipse
      ctx.lineWidth = 0.8
      ctx.save()
      const ha = maxOrbit * 0.88
      const hb = minOrbit * 1.5
      const hFocus = Math.sqrt(ha * ha - hb * hb) * 0.82
      const [hCenterX, hCenterY] = toScreen(hFocus, 0)
      ctx.translate(hCenterX, hCenterY)
      ctx.beginPath()
      ctx.ellipse(0, 0, ha * viewZoom, hb * viewZoom, 0, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()

      // ── Render Voyager 1 Trajectory ────────────────────────────────────────
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.15)' // Subtle slate straight vector
      ctx.lineWidth = 0.6
      const [vStartX, vStartY] = toScreen(Math.cos(2.85) * minOrbit, Math.sin(2.85) * minOrbit)
      const [vEndX, vEndY] = toScreen(Math.cos(2.85) * maxOrbit * 1.6, Math.sin(2.85) * maxOrbit * 1.6)
      ctx.beginPath()
      ctx.moveTo(vStartX, vStartY)
      ctx.lineTo(vEndX, vEndY)
      ctx.stroke()

      // ── Render Planets and Moons ──────────────────────────────────────────
      PLANET_DATA.forEach((planet, i) => {
        const { wx, wy } = planetPositions[i]
        const [px, py] = toScreen(wx, wy)
        // Pixelradius des Planeten: relativer Groessen-Index mal Zoom-Faktor.
        // `Math.sqrt(viewZoom)` daempft das Mitwachsen beim Hineinzoomen, damit ein
        // fokussierter Planet nicht das ganze Bild ausfuellt. Das `Math.max(1.5, ...)`
        // erzwingt eine Mindestgroesse von 1,5 px, sodass winzige Koerper wie Ceres
        // oder Pluto trotz der realistischen Groessenverhaeltnisse sichtbar bleiben.
        const scaledRadius = Math.max(1.5, planet.radius * Math.sqrt(viewZoom) * 0.7)

        // Draw Saturn Rings
        if (planet.name === 'Saturn') {
          ctx.save()
          ctx.translate(px, py)
          ctx.strokeStyle = 'rgba(228, 209, 145, 0.45)'
          ctx.lineWidth = 1.6
          ctx.beginPath()
          ctx.ellipse(0, 0, scaledRadius * 2.1, scaledRadius * 0.45, -0.15, 0, Math.PI * 2)
          ctx.stroke()
          ctx.restore()
        }

        // Draw Planet Body
        ctx.fillStyle = planet.color
        ctx.beginPath()
        ctx.arc(px, py, scaledRadius, 0, Math.PI * 2)
        ctx.fill()

        // Planet Label overlay (focused or somewhat zoomed)
        const isFocused = zoom.phase === 'watching' && ZOOM_TARGETS[zoom.targetIdx].name === planet.name
        if (viewZoom > 1.2 || isFocused) {
          ctx.font = '10px system-ui, sans-serif'
          ctx.fillStyle = '#94a3b8'
          ctx.textAlign = 'center'
          ctx.fillText(planet.name, px, py - scaledRadius - 5)
        }

        // ── Render Moons for this Planet ────────────────────────────────────
        ZOOM_TARGETS.forEach((target) => {
          if (target.isMoon && target.parentIdx === i) {
            const moonAngle = (target.moonOffsetAngle || 0) + (simDays / (target.moonOrbitSpeed || 1)) * 0.08
            const mwx = wx + Math.cos(moonAngle) * (target.moonOrbitRadius || 12)
            const mwy = wy + Math.sin(moonAngle) * (target.moonOrbitRadius || 12)
            const [mx, my] = toScreen(mwx, mwy)

            // Hinweis: Fuer Monde werden bewusst KEINE Umlaufbahn-Kreise gezeichnet.
            // Orbit-Ringe gibt es ausschliesslich fuer die Planeten (siehe weiter oben
            // in der "Render Planetary Orbits"-Schleife). Der Mond selbst kreist
            // weiterhin um seinen Planeten, nur seine Bahnlinie wird nicht dargestellt.

            // Draw Moon body
            ctx.fillStyle = target.color
            ctx.beginPath()
            ctx.arc(mx, my, Math.max(1.0, target.radius * Math.sqrt(viewZoom) * 0.6), 0, Math.PI * 2)
            ctx.fill()

            // Moon Label when focused
            const isMoonFocused = zoom.phase === 'watching' && ZOOM_TARGETS[zoom.targetIdx].name === target.name
            if (isMoonFocused) {
              ctx.font = 'bold 9px system-ui, sans-serif'
              ctx.fillStyle = '#f59e0b'
              ctx.textAlign = 'center'
              ctx.fillText(target.name, mx, my - 6)
            }
          }
        })
      })

      // ── Render Halley's Comet Body & Dynamic Outgassing Tail ───────────────
      const halleyAngle = (simDays / 1200) * Math.PI * 2
      const hx = Math.cos(halleyAngle) * (maxOrbit * 0.88) + (Math.sqrt(ha * ha - hb * hb) * 0.82)
      const hy = Math.sin(halleyAngle) * (minOrbit * 1.5)
      const [cometSx, cometSy] = toScreen(hx, hy)
      
      // Calculate distance to Sun for tail outgassing strength
      const distToSun = Math.hypot(hx, hy)
      const maxOutgassingDist = maxOrbit * 0.6
      
      if (distToSun < maxOutgassingDist) {
        // Outgassing active! Vector points directly away from the Sun (0, 0)
        const toSunX = 0 - hx
        const toSunY = 0 - hy
        const lenSun = Math.hypot(toSunX, toSunY)
        const tailDirX = -(toSunX / lenSun)
        const tailDirY = -(toSunY / lenSun)
        
        // Tail size increases as it gets closer to the Sun
        const proximity = 1.0 - distToSun / maxOutgassingDist
        const tailLen = proximity * 48 * viewZoom
        const tailWidth = proximity * 15 * viewZoom
        
        // Draw double tail (dust and gas)
        ctx.save()
        ctx.translate(cometSx, cometSy)
        // Rotate to point away from Sun
        const rotAngle = Math.atan2(tailDirY, tailDirX)
        ctx.rotate(rotAngle)
        
        // Dust tail (spread out, slightly curved)
        const dustGrad = ctx.createLinearGradient(0, 0, tailLen, tailWidth * 0.4)
        dustGrad.addColorStop(0, 'rgba(226, 232, 240, 0.42)')
        dustGrad.addColorStop(0.3, 'rgba(226, 232, 240, 0.20)')
        dustGrad.addColorStop(1, 'rgba(226, 232, 240, 0)')
        
        ctx.fillStyle = dustGrad
        ctx.beginPath()
        ctx.moveTo(0, 0)
        ctx.lineTo(tailLen, -tailWidth * 0.5)
        ctx.lineTo(tailLen * 0.8, 0)
        ctx.lineTo(tailLen, tailWidth * 0.5)
        ctx.closePath()
        ctx.fill()
        
        // Ion gas tail (thin, straight, glowing cyan)
        const gasGrad = ctx.createLinearGradient(0, 0, tailLen * 1.25, 0)
        gasGrad.addColorStop(0, 'rgba(56, 189, 248, 0.55)')
        gasGrad.addColorStop(0.2, 'rgba(56, 189, 248, 0.25)')
        gasGrad.addColorStop(1, 'rgba(56, 189, 248, 0)')
        
        ctx.strokeStyle = gasGrad
        ctx.lineWidth = 2.0
        ctx.beginPath()
        ctx.moveTo(0, 0)
        ctx.lineTo(tailLen * 1.25, 0)
        ctx.stroke()
        ctx.restore()
      }
      
      // Draw Halley Nucleus
      ctx.fillStyle = '#a1a8b8'
      ctx.beginPath()
      ctx.arc(cometSx, cometSy, Math.max(1.0, 1.2 * Math.sqrt(viewZoom) * 0.7), 0, Math.PI * 2)
      ctx.fill()
      
      if (zoom.phase === 'watching' && activeTarget.name === "Halley's Comet") {
        ctx.font = 'bold 9px system-ui, sans-serif'
        ctx.fillStyle = '#f59e0b'
        ctx.textAlign = 'center'
        ctx.fillText("Halley's Comet", cometSx, cometSy - 8)
      }

      // ── Render Voyager 1 Satellite Probe ──────────────────────────────────
      const voyagerRatio = Math.min(1.0, simDays / 120000)
      const vDist = minOrbit + (maxOrbit * 1.5 - minOrbit) * voyagerRatio
      const vx = Math.cos(2.85) * vDist
      const vy = Math.sin(2.85) * vDist
      const [voySx, voySy] = toScreen(vx, vy)
      
      // Draw voyager high-gain dish outline
      ctx.fillStyle = '#f8fafc'
      ctx.beginPath()
      ctx.arc(voySx, voySy, Math.max(1.0, 0.8 * Math.sqrt(viewZoom)), 0, Math.PI * 2)
      ctx.fill()
      
      // Blinking communications beacon (transmits telemetry)
      const beaconBlink = Math.floor(now / 500) % 2 === 0
      if (beaconBlink) {
        ctx.strokeStyle = '#38bdf8'
        ctx.lineWidth = 0.5
        ctx.beginPath()
        ctx.arc(voySx, voySy, Math.max(3.0, 5.0 * Math.sqrt(viewZoom)), 0, Math.PI * 2)
        ctx.stroke()
      }
      
      if (zoom.phase === 'watching' && activeTarget.name === 'Voyager 1') {
        ctx.font = 'bold 9px system-ui, sans-serif'
        ctx.fillStyle = '#f8fafc'
        ctx.textAlign = 'center'
        ctx.fillText('Voyager 1', voySx, voySy - 8)
      }

      // ── Reticle Over Target ────────────────────────────────────────────────
      if (zoom.phase === 'watching' || zoom.phase === 'zooming_in' || zoom.phase === 'zooming_out') {
        const [tx, ty] = toScreen(targetWx, targetWy)
        const reticleR = Math.max(12, 14 * viewZoom)
        
        ctx.strokeStyle = activeTarget.isMoon ? '#d97706' : (activeTarget.isSpecial ? '#f8fafc' : '#2563eb')
        ctx.lineWidth = 0.8
        
        // Target corner brackets
        ctx.beginPath()
        ctx.moveTo(tx - reticleR, ty - reticleR + 4); ctx.lineTo(tx - reticleR, ty - reticleR); ctx.lineTo(tx - reticleR + 4, ty - reticleR)
        ctx.moveTo(tx + reticleR, ty - reticleR + 4); ctx.lineTo(tx + reticleR, ty - reticleR); ctx.lineTo(tx + reticleR - 4, ty - reticleR)
        ctx.moveTo(tx - reticleR, ty + reticleR - 4); ctx.lineTo(tx - reticleR, ty + reticleR); ctx.lineTo(tx - reticleR + 4, ty + reticleR)
        ctx.moveTo(tx + reticleR, ty + reticleR - 4); ctx.lineTo(tx + reticleR, ty + reticleR); ctx.lineTo(tx + reticleR - 4, ty + reticleR)
        ctx.stroke()

        // Core tracking dot
        ctx.fillStyle = activeTarget.isMoon ? '#d97706' : (activeTarget.isSpecial ? '#f8fafc' : '#2563eb')
        ctx.beginPath()
        ctx.arc(tx, ty, 1.5, 0, Math.PI * 2)
        ctx.fill()
      }

      // ── Info Overlay Box ──────────────────────────────────────────────────
      let infoAlpha = 0
      if (zoom.phase === 'watching') {
        infoAlpha = Math.min(1, zoom.watchTimer / 300)
      } else if (zoom.phase === 'zooming_out') {
        infoAlpha = Math.max(0, 1 - zoom.progress * (ZOOM_OUT_MS / 400))
      }

      if (infoAlpha > 0.01) {
        drawInfoBox(ctx, activeTarget, W, H, infoAlpha)
      }

      // ── Solar System Telemetry HUD ─────────────────────────────────────────
      // Compact-Infoboxen ersetzen die Szene komplett; das globale HUD wuerde
      // sonst unten in die Box hineinmalen.
      if (!(infoAlpha > 0.01 && usesCompactInfoBox(W, H))) {
        ctx.fillStyle = 'rgba(74,222,128,0.55)'
        ctx.font = '10px monospace'
        ctx.textAlign = 'left'
        ctx.textBaseline = 'bottom'
        ctx.fillText('SOLAR SYSTEM // HELIOCENTRIC ORBITAL SURVEY', 10, H - 10)

        ctx.textAlign = 'right'
        ctx.fillText(
          `TOTAL CLASSIFIED: 8 PLANETS // 2 DWARF PLANETS // 32 featured bodies`,
          W - 10,
          H - 10
        )
      }
    }

    unsubscribe = subscribe(loop)

    return () => {
      running = false
      if (unsubscribe) unsubscribe()
      ro.disconnect()
    }
  }, [])

  return (
    <Panel title="HELIOCENTRIC ORBIT MODEL // LIVE TELEMETRY SURVEY">
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    </Panel>
  )
}

export default memo(SolarSystemPanel)
