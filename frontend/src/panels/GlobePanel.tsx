import { useEffect, useRef } from 'react'
import Panel from '../ui/Panel'

// ── Kapitalen-Daten ──────────────────────────────────────────────────────────
// Jeder Eintrag: geografische Koordinaten + CIA-style Metadaten
const CAPITALS = [
  { name: 'MOSCOW',      country: 'RUSSIAN FEDERATION',        lat:  55.76, lon:  37.62, pop: '12.6M', threat: 'HIGH',     intel: 'SIGNAL INTERCEPT ACTIVE'       },
  { name: 'BEIJING',     country: 'PEOPLES REPUBLIC OF CHINA', lat:  39.90, lon: 116.40, pop: '21.9M', threat: 'HIGH',     intel: 'SATELLITE UPLINK MONITORED'    },
  { name: 'WASHINGTON',  country: 'UNITED STATES',             lat:  38.91, lon: -77.04, pop: '0.7M',  threat: 'ELEVATED', intel: 'EMBASSY CHANNEL OPEN'          },
  { name: 'LONDON',      country: 'UNITED KINGDOM',            lat:  51.51, lon:  -0.13, pop: '9.6M',  threat: 'MODERATE', intel: 'GCHQ LIAISON ACTIVE'           },
  { name: 'PARIS',       country: 'FRANCE',                    lat:  48.86, lon:   2.35, pop: '2.1M',  threat: 'MODERATE', intel: 'DGSE CONTACT SCHEDULED'        },
  { name: 'BERLIN',      country: 'GERMANY',                   lat:  52.52, lon:  13.40, pop: '3.7M',  threat: 'LOW',      intel: 'BND HANDSHAKE CONFIRMED'       },
  { name: 'TOKYO',       country: 'JAPAN',                     lat:  35.69, lon: 139.69, pop: '13.9M', threat: 'LOW',      intel: 'INTERCEPT LOG CLEAN'           },
  { name: 'PYONGYANG',   country: 'DPRK',                      lat:  39.01, lon: 125.75, pop: '3.1M',  threat: 'CRITICAL', intel: 'NO SIGNAL — SUSPECTED JAMMING' },
  { name: 'TEHRAN',      country: 'IRAN',                      lat:  35.70, lon:  51.42, pop: '9.3M',  threat: 'HIGH',     intel: 'ASSET BAKER EN ROUTE'          },
  { name: 'CANBERRA',    country: 'AUSTRALIA',                 lat: -35.28, lon: 149.13, pop: '0.5M',  threat: 'LOW',      intel: 'FIVE EYES SYNC COMPLETE'       },
  { name: 'OTTAWA',      country: 'CANADA',                    lat:  45.42, lon: -75.69, pop: '1.0M',  threat: 'LOW',      intel: 'NORAD STATUS: GREEN'           },
  { name: 'BRASILIA',    country: 'BRAZIL',                    lat: -15.78, lon: -47.93, pop: '3.1M',  threat: 'MODERATE', intel: 'NARCO TRAFFIC WATCH ACTIVE'    },
  { name: 'CAIRO',       country: 'EGYPT',                     lat:  30.04, lon:  31.24, pop: '21.3M', threat: 'ELEVATED', intel: 'HUMINT SOURCE VERIFIED'        },
  { name: 'RIYADH',      country: 'SAUDI ARABIA',              lat:  24.69, lon:  46.72, pop: '7.7M',  threat: 'ELEVATED', intel: 'OIL FLOW METRICS NOMINAL'      },
  { name: 'NEW DELHI',   country: 'INDIA',                     lat:  28.61, lon:  77.21, pop: '32.9M', threat: 'MODERATE', intel: 'NUCLEAR STATUS: MONITORING'    },
  { name: 'ISLAMABAD',   country: 'PAKISTAN',                  lat:  33.72, lon:  73.04, pop: '1.1M',  threat: 'HIGH',     intel: 'ISI CHATTER ELEVATED'          },
  { name: 'KABUL',       country: 'AFGHANISTAN',               lat:  34.53, lon:  69.17, pop: '4.6M',  threat: 'CRITICAL', intel: 'ASSETS RECALLED'               },
  { name: 'NAIROBI',     country: 'KENYA',                     lat:  -1.29, lon:  36.82, pop: '4.7M',  threat: 'ELEVATED', intel: 'COMMS RELAY NODE ACTIVE'       },
  { name: 'SEOUL',       country: 'SOUTH KOREA',               lat:  37.57, lon: 126.98, pop: '9.7M',  threat: 'ELEVATED', intel: 'DMZ STATUS: NOMINAL'           },
  { name: 'SINGAPORE',   country: 'SINGAPORE',                 lat:   1.28, lon: 103.85, pop: '5.9M',  threat: 'LOW',      intel: 'FINANCIAL CIRCUIT MONITORED'   },
  { name: 'MEXICO CITY', country: 'MEXICO',                    lat:  19.43, lon: -99.13, pop: '9.2M',  threat: 'ELEVATED', intel: 'CARTEL INTERCEPT RUNNING'      },
  { name: 'BUENOS AIRES',country: 'ARGENTINA',                 lat: -34.60, lon: -58.38, pop: '3.1M',  threat: 'LOW',      intel: 'SOUTH CONE SURVEY ACTIVE'      },
  { name: 'ANKARA',      country: 'TURKEY',                    lat:  39.93, lon:  32.85, pop: '5.6M',  threat: 'MODERATE', intel: 'NATO CHANNEL ENCRYPTED'        },
  { name: 'STOCKHOLM',   country: 'SWEDEN',                    lat:  59.33, lon:  18.07, pop: '1.0M',  threat: 'LOW',      intel: 'NORDPOOL DATA CLEAN'           },
  { name: 'OSLO',        country: 'NORWAY',                    lat:  59.91, lon:  10.75, pop: '1.0M',  threat: 'LOW',      intel: 'DEEP NORTH ARRAY NOMINAL'      },
  { name: 'KYIV',        country: 'UKRAINE',                   lat:  50.45, lon:  30.52, pop: '2.9M',  threat: 'CRITICAL', intel: 'WARTIME SIGINT ACTIVE'         },
  { name: 'BAGHDAD',     country: 'IRAQ',                      lat:  33.31, lon:  44.36, pop: '8.1M',  threat: 'HIGH',     intel: 'GROUND ASSET ACTIVE'           },
  { name: 'JAKARTA',     country: 'INDONESIA',                 lat:  -6.21, lon: 106.85, pop: '10.5M', threat: 'MODERATE', intel: 'MARITIME WATCH ACTIVE'         },
  { name: 'MANILA',      country: 'PHILIPPINES',               lat:  14.60, lon: 120.98, pop: '1.8M',  threat: 'MODERATE', intel: 'SCS PATROL LOGGED'             },
  { name: 'BOGOTA',      country: 'COLOMBIA',                  lat:   4.71, lon: -74.07, pop: '7.4M',  threat: 'ELEVATED', intel: 'NARCO SUPPLY CHAIN TRACKED'    },
  { name: 'LIMA',        country: 'PERU',                      lat: -12.05, lon: -77.04, pop: '9.7M',  threat: 'MODERATE', intel: 'MINING SECTOR SURVEY'          },
  { name: 'ZAGREB',      country: 'CROATIA',                   lat:  45.81, lon:  15.98, pop: '0.8M',  threat: 'LOW',      intel: 'BALKAN ROUTE MONITORED'        },
]

// ── Vereinfachte Kontinental-Umrisse ─────────────────────────────────────────
// Jedes Sub-Array ist ein Polygon aus [lat, lon]-Paaren (Grad).
// Punkte im Uhrzeigersinn, letzter Punkt schließt zurück zum ersten.
// Koordinaten-Reihenfolge: [Breitengrad, Längengrad].
const LAND_POLYGONS: [number, number][][] = [

  // ── Nordamerika ─────────────────────────────────────────────────────────────
  // Umriss von der NW-Ecke Alaskas im Uhrzeigersinn bis zur karibischen Spitze
  [
    [71,-156],[70,-140],[68,-137],[65,-138],  // Alaska Nordküste
    [60,-145],[58,-137],[58,-134],[54,-130],  // Alaska Südküste → BC
    [50,-125],[48,-124],[46,-124],[44,-124],  // Pazifikküste
    [40,-124],[36,-122],[34,-120],[32,-117],  // Westküste USA → Baja
    [28,-110],[24,-110],[22,-106],[18,-103],  // Westmexiko
    [16,-98],[16,-90],[15,-88],[13,-84],      // Mittelamerika
    [10,-83],[8,-77],[8,-76],[10,-75],        // Panama
    [12,-72],[15,-65],[18,-66],[20,-70],      // Karibikküste
    [25,-77],[28,-80],[30,-81],[32,-80],      // Florida Ostküste
    [35,-76],[38,-75],[40,-74],[42,-70],      // Ostküste USA
    [44,-66],[46,-60],[48,-53],[50,-55],      // Neuengland → Neufundland
    [52,-56],[55,-60],[57,-61],[60,-64],      // Labrador
    [62,-68],[64,-68],[65,-70],[67,-75],      // Hudson Strait
    [65,-82],[63,-85],[60,-85],[58,-80],      // Hudson Bay West
    [55,-76],[52,-80],[50,-85],[50,-88],      // Hudson Bay Süd
    [52,-90],[55,-95],[58,-100],[60,-105],    // Manitoba
    [62,-110],[65,-120],[68,-130],[70,-140],  // NW Territories
    [71,-140],[72,-145],[71,-156],            // zurück zu Alaska
  ],

  // ── Grönland ────────────────────────────────────────────────────────────────
  [
    [83,-35],[82,-60],[80,-72],[76,-72],[72,-55],[68,-50],
    [65,-38],[67,-25],[70,-22],[74,-18],[78,-18],[82,-18],[83,-35],
  ],

  // ── Südamerika ──────────────────────────────────────────────────────────────
  // Karibikküste Kolumbiens im Uhrzeigersinn
  [
    [12,-72],[11,-63],[10,-62],[8,-60],[6,-55],  // Nordküste
    [4,-52],[2,-50],[0,-50],                      // NW-Brasilien
    [-3,-42],[-5,-35],[-8,-35],                   // NO-Brasilien
    [-12,-37],[-15,-39],[-18,-39],                // Bahia
    [-23,-43],[-28,-48],[-30,-51],                // Rio → Porto Alegre
    [-33,-53],[-35,-57],[-38,-57],                // Rio Grande do Sul
    [-42,-62],[-46,-66],[-50,-69],                // Patagonien
    [-54,-67],[-56,-68],[-55,-65],[-52,-58],      // Feuerland
    [-48,-53],[-44,-51],[-40,-50],                // Falklands-Küste
    [-35,-52],[-30,-50],[-25,-43],                // Nordwärts
    [-20,-40],[-15,-40],[-10,-36],[-5,-35],       // Ostküste
    [0,-50],[4,-52],[6,-55],[8,-60],              // zurück Nord
    [10,-62],[12,-70],[12,-72],                   // Karibik
  ],

  // ── Europa (kontinental) ────────────────────────────────────────────────────
  // Portugal Südspitze → im Uhrzeigersinn rund um Kontinentaleuropa
  [
    [36,-9],[37,-9],[38,-9],[40,-8],[42,-9],    // Portugal
    [44,-8],[44,-2],[46,-2],[47,2],             // Pyrenäen + Atlantikküste
    [48,2],[51,2],[52,4],[53,8],[55,8],         // Nordseeküste
    [55,10],[55,12],[54,10],[54,8],             // Dänemark
    [56,10],[58,8],[60,5],[62,5],[64,14],       // Norwegen Westküste
    [68,14],[70,20],[71,26],[70,28],[68,20],    // Norwegen Nordküste
    [65,18],[60,18],[58,18],[56,16],[55,12],    // Schweden
    [56,24],[58,24],[60,24],[62,26],[65,28],    // Finnland West
    [68,28],[70,28],[71,28],[70,30],[68,32],    // Finnland Nord → Kola
    [65,33],[60,28],[55,22],[54,20],[54,18],    // Baltikum
    [54,20],[52,22],[52,24],[50,24],[48,22],    // Polen
    [46,20],[45,18],[44,16],[44,14],[42,14],    // Adria
    [40,18],[38,16],[38,15],[40,15],[42,12],    // Apennin-Halbinsel
    [38,16],[38,15],[36,14],[37,10],[38,8],     // Kalabrien → Sizilien Nähe
    [43,5],[44,7],[46,8],[48,8],[50,8],         // Alpen Südseite → Rhein
    [51,4],[51,2],[50,-2],[50,-5],              // Englischer Kanal
    [44,-2],[42,-2],[40,-2],[38,-1],[36,-5],    // Spanien Südküste
    [36,-6],[36,-8],[36,-9],                    // Gibraltar → zurück
  ],

  // ── Großbritannien ──────────────────────────────────────────────────────────
  [
    [58,-3],[57,0],[54,0],[52,2],[51,2],
    [50,0],[50,-5],[51,-5],[52,-4],[54,-3],
    [55,-4],[56,-5],[57,-4],[58,-3],
  ],

  // ── Irland ──────────────────────────────────────────────────────────────────
  [
    [55,-7],[54,-10],[52,-10],[51,-9],
    [52,-6],[54,-6],[55,-7],
  ],

  // ── Island ──────────────────────────────────────────────────────────────────
  [
    [66,-24],[64,-24],[63,-20],[63,-14],
    [64,-13],[66,-13],[67,-18],[66,-24],
  ],

  // ── Afrika ──────────────────────────────────────────────────────────────────
  // Tunesien/Libyen Nordküste im Uhrzeigersinn
  [
    [37,10],[32,12],[30,32],[30,33],[28,34],   // N-Afrika → Rotes Meer Küste
    [22,37],[18,38],[12,44],[10,43],[10,45],   // Horn von Afrika
    [2,42],[0,42],[-5,40],                     // Ost-Afrika
    [-10,40],[-20,35],[-25,33],                // Mosambik Küste
    [-30,30],[-35,20],[-35,18],                // Südafrika Ostküste
    [-35,17],[-35,15],[-34,18],[-34,22],       // Kapstadt Runde
    [-30,17],[-25,15],[-20,12],                // Namibia
    [-15,12],[-10,14],[-5,10],[-5,8],         // Angola
    [0,8],[5,2],[4,2],[5,2],                   // Golf von Guinea
    [5,5],[8,5],[10,14],[10,15],               // Nigeria
    [15,15],[15,12],[20,14],[20,15],           // Sahel
    [22,15],[25,14],[30,15],[30,25],           // Sahara
    [30,32],[32,32],[37,10],                   // Ägypten zurück
  ],

  // ── Madagaskar ──────────────────────────────────────────────────────────────
  [
    [-12,49],[-15,50],[-18,47],[-20,44],
    [-24,44],[-25,47],[-22,50],[-18,50],
    [-14,50],[-12,49],
  ],

  // ── Asien (Großer Block: Arabien, Zentralasien, Sibirien, Fernost) ──────────
  // Türkei Westküste → im Uhrzeigersinn rund um den eurasischen Kontinent
  [
    [42,28],[38,26],[36,28],[36,36],[38,36],   // Türkei Süd + Levante
    [35,37],[35,40],[38,44],[40,44],[42,48],   // Kaukasus Süd
    [38,50],[36,52],[25,57],[22,60],[18,57],   // Arabische Halbinsel Ost
    [12,45],[12,44],[15,42],[22,37],[28,34],   // Arabische Halbinsel Süd → Rotes Meer
    [30,33],[30,32],[32,35],[36,37],[38,36],   // Sinai → zurück
    [38,44],[42,48],[42,52],[45,54],[48,58],   // Kaspisches Meer Ost
    [42,60],[45,60],[48,58],[50,57],[55,60],   // Zentralasien
    [58,65],[60,68],[62,70],[65,72],[68,72],   // Sibirien West
    [68,75],[70,80],[72,80],[72,100],[72,130], // Sibirien Nord
    [72,142],[68,140],[65,140],[60,150],       // Ostsibirien
    [55,140],[50,142],[46,137],[44,134],       // Fernöstliche Küste
    [40,124],[38,122],[35,120],[30,122],       // Chinesische Küste
    [24,118],[20,110],[15,108],[10,104],       // Südchina → Vietnam
    [5,103],[2,104],[0,104],                   // Malaiische Halbinsel
    [5,100],[10,98],[15,100],[20,94],          // Thailand + Myanmar
    [22,92],[24,92],[25,90],[22,88],[20,87],   // Bangladesch + Golf von Bengalen
    [15,80],[10,78],[8,77],                    // Südindien Ostküste
    [8,80],[10,80],[12,80],[15,80],            // Sri Lanka Nähe
    [20,87],[22,90],[24,92],[26,90],[28,97],   // Nordostindien
    [28,88],[28,80],[28,72],[25,68],[22,68],   // Himalaya Südhang
    [15,73],[10,75],[8,77],                    // Westindien → Spitze
    [10,78],[8,77],[8,74],[10,72],[15,73],     // Malabar-Küste
    [20,73],[22,70],[25,68],[28,65],[28,62],   // Pakistan → Arabisches Meer
    [25,60],[22,60],[18,57],[15,55],[12,45],   // Arabisches Meer Nordküste
    [25,57],[30,60],[35,62],[38,58],[42,58],   // Persischer Golf Ost
    [38,50],[36,52],[30,48],[25,50],[22,56],   // Arabien Ostküste
    [18,57],[15,52],[12,44],[10,43],[12,45],   // Jemen → Horn
    [10,52],[12,52],[15,50],[18,55],[22,60],   // Oman
    [25,57],[30,56],[35,60],[38,62],[42,60],   // Iran Südküste
    [42,48],[44,48],[46,50],[48,56],[50,58],   // Kasachstan
    [55,60],[58,60],[60,60],[62,68],[65,72],   // West-Sibirien
    [68,72],[70,75],[72,80],[72,68],[68,68],   // Ob-Mündung
    [65,65],[60,60],[55,55],[50,53],[45,54],   // Ural
    [42,52],[40,52],[38,46],[42,44],[44,42],   // Schwarzes Meer Nord
    [48,38],[52,36],[55,38],[60,40],[65,38],   // Osteuropa Grenze
    [68,36],[70,32],[71,28],[68,28],[65,28],   // Kola Halbinsel
    [62,30],[60,28],[58,28],[55,22],[54,20],   // Finnland → Baltikum
    [52,22],[50,24],[48,22],[46,20],[44,16],   // Osteuropa Süd
    [42,28],                                   // zurück zum Start
  ],

  // ── Indische Halbinsel (separates Polygon für Klarheit) ─────────────────────
  [
    [28,72],[25,68],[22,68],[18,73],[15,73],
    [10,78],[8,77],[8,74],[10,72],[15,73],
    [18,73],[22,70],[25,68],[28,72],
  ],

  // ── Japan: Honshu ───────────────────────────────────────────────────────────
  [
    [36,136],[34,136],[33,130],[34,131],[36,132],
    [38,140],[40,140],[42,140],[44,142],[43,144],
    [40,141],[38,140],[36,136],
  ],

  // ── Japan: Hokkaido ─────────────────────────────────────────────────────────
  [
    [44,142],[44,145],[43,144],[42,143],[44,142],
  ],

  // ── Korea-Halbinsel ─────────────────────────────────────────────────────────
  [
    [40,126],[38,128],[35,129],[34,127],[36,126],[38,124],[40,126],
  ],

  // ── Australien ──────────────────────────────────────────────────────────────
  // Cape York im Uhrzeigersinn
  [
    [-10,142],[-14,145],[-18,146],[-22,149],  // Queensland Ostküste
    [-28,153],[-32,152],[-34,151],            // NSW Küste
    [-38,146],[-38,144],[-38,140],            // Victoria
    [-36,137],[-34,135],[-32,133],            // Eyre Halbinsel
    [-32,128],[-30,115],[-24,113],            // Westaustralien Küste
    [-18,122],[-16,122],[-14,126],            // Kimberley
    [-12,130],[-12,136],[-10,136],            // Arnhem Land
    [-12,135],[-12,132],[-13,130],            // Darwin Bereich
    [-12,130],[-14,128],[-16,124],            // zurück NW
    [-18,122],[-22,114],[-28,114],            // Westaustralien
    [-34,118],[-36,118],[-38,140],            // Südküste
    [-38,144],[-36,146],[-34,150],            // Victoria → NSW
    [-28,153],[-22,149],[-18,146],            // zurück Nord
    [-14,145],[-10,142],                      // Cape York
  ],

  // ── Antarktis ───────────────────────────────────────────────────────────────
  // Als breiter Streifen entlang ~70°S (stark vereinfacht)
  [
    [-68,-180],[-68,-120],[-72,-90],[-68,-60],
    [-72,-30],[-68,0],[-72,30],[-68,60],
    [-72,90],[-68,120],[-72,150],[-68,180],
    [-74,180],[-74,150],[-76,120],[-74,90],
    [-76,60],[-74,30],[-76,0],[-74,-30],
    [-76,-60],[-74,-90],[-76,-120],[-74,-150],
    [-76,-180],[-68,-180],
  ],

  // ── Kuba ────────────────────────────────────────────────────────────────────
  [
    [23,-84],[22,-81],[20,-75],[20,-77],[21,-80],[23,-84],
  ],

  // ── Neuseeland: Nordinsel ───────────────────────────────────────────────────
  [
    [-34,172],[-37,175],[-41,174],[-39,174],[-37,174],[-34,172],
  ],

  // ── Neuseeland: Südinsel ───────────────────────────────────────────────────
  [
    [-41,174],[-46,168],[-46,170],[-44,172],[-41,174],
  ],

  // ── Borneo ──────────────────────────────────────────────────────────────────
  [
    [7,117],[6,116],[4,115],[2,114],[0,110],
    [-2,110],[-4,114],[-2,116],[0,117],
    [2,116],[4,118],[6,118],[7,117],
  ],

  // ── Sumatra ──────────────────────────────────────────────────────────────────
  [
    [5,95],[4,98],[2,100],[0,104],[-2,104],
    [-4,104],[-6,106],[-5,104],[-3,102],
    [0,99],[2,99],[4,98],[5,95],
  ],

  // ── Java ─────────────────────────────────────────────────────────────────────
  [
    [-6,106],[-7,108],[-8,111],[-8,115],
    [-7,112],[-6,108],[-6,106],
  ],

  // ── Philippinen: Luzon ──────────────────────────────────────────────────────
  [
    [18,121],[16,120],[14,120],[12,123],[14,124],[16,122],[18,121],
  ],

  // ── Sri Lanka ────────────────────────────────────────────────────────────────
  [
    [10,80],[8,80],[6,81],[7,82],[9,81],[10,80],
  ],

  // ── Skandinavien: Schweden + Norwegen (separater Pfad für klarere Linien) ──
  // (Der Haupteuropa-Block hat diese Region bereits, aber ein separates
  //  Polygon für die Halbinsel macht die Form deutlicher)
  [
    [56,10],[58,10],[60,5],[62,5],[64,14],
    [68,14],[70,20],[71,26],[70,28],[68,20],
    [65,18],[62,16],[60,18],[58,18],
    [56,16],[55,12],[56,10],
  ],
]

// ── Hilfsfunktionen ──────────────────────────────────────────────────────────

/** Lineares Interpolieren zwischen a und b um Faktor t */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/**
 * Kürzester Winkelweg: gibt die Differenz zurück, die in [-PI, PI] liegt.
 * Wird genutzt, damit die Rotation beim Targeting nicht den langen Weg nimmt.
 */
function angleDiff(from: number, to: number): number {
  const d = ((to - from) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI
  return d
}

/**
 * Projiziert einen Punkt auf der Einheitskugel auf Canvas-Koordinaten.
 * Gibt { sx, sy, z2 } zurück (z2 > 0 = Punkt liegt auf der Vorderseite).
 */
function project(
  lat: number, lon: number,
  rotY: number, rotX: number,
  cx: number, cy: number, R: number
): { sx: number; sy: number; z2: number } {
  const latR = lat * (Math.PI / 180)
  const lonR = lon * (Math.PI / 180)

  // Kartesische Koordinaten auf der Einheitskugel
  const x = Math.cos(latR) * Math.sin(lonR)
  const y = Math.sin(latR)
  const z = Math.cos(latR) * Math.cos(lonR)

  // Rotation um Y-Achse (Längsgrad-Spin)
  const x1 =  x * Math.cos(rotY) - z * Math.sin(rotY)
  const z1 =  x * Math.sin(rotY) + z * Math.cos(rotY)

  // Rotation um X-Achse (Neigung)
  const y2 =  y * Math.cos(rotX) - z1 * Math.sin(rotX)
  const z2 =  y * Math.sin(rotX) + z1 * Math.cos(rotX)

  // Orthografische Projektion entlang Z
  return { sx: cx + x1 * R, sy: cy - y2 * R, z2 }
}

// ── Animations-State-Typ ─────────────────────────────────────────────────────
type Phase = 'scanning' | 'targeting' | 'locked' | 'releasing'

interface AnimState {
  phase: Phase
  phaseStart: number    // DOMHighResTimeStamp des Phasen-Starts
  rotY: number          // aktuelle Y-Rotation in Radiant
  rotX: number          // aktuelle X-Neigung in Radiant
  targetIdx: number     // welche Kapitale ist das Ziel?
  targetRotY: number    // Ziel-rotY für die Targeting-Phase
  targetRotX: number    // Ziel-rotX (leichtes Neigen zur Breitenlage)
  zoom: number          // Zoom-Faktor (1.0 = normal, 2.0 = nah dran)
  dataAlpha: number     // 0–1: Deckkraft des Daten-Overlays
}

// ── Haupt-Komponente ─────────────────────────────────────────────────────────
export default function GlobePanel() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // Alle Animations-Variablen leben in diesem Ref — kein re-render nötig
  const stateRef = useRef<AnimState>({
    phase: 'scanning',
    phaseStart: 0,
    rotY: 0,
    rotX: 0.26,          // ~15° feste Basisneigung
    targetIdx: 0,
    targetRotY: 0,
    targetRotX: 0.26,
    zoom: 1.0,
    dataAlpha: 0,
  })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    if (!ctx) return

    let rafId: number
    let running = true
    // IntersectionObserver: Animation pausieren wenn Panel nicht sichtbar ist
    let isVisible = true
    const io = new IntersectionObserver(
      ([entry]) => { isVisible = entry.isIntersecting },
      { threshold: 0.1 },
    )
    io.observe(canvas)

    // ── ResizeObserver: Canvas-Auflösung == Container-Größe ─────────────────
    const resize = () => {
      if (!canvas) return
      canvas.width  = canvas.clientWidth
      canvas.height = canvas.clientHeight
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    // ── Hilfsfunktion: Hex-Farbe in RGB-String für rgba() umwandeln ─────────
    function hexToRgba(hex: string): string {
      const r = parseInt(hex.slice(1, 3), 16)
      const g = parseInt(hex.slice(3, 5), 16)
      const b = parseInt(hex.slice(5, 7), 16)
      return `${r},${g},${b}`
    }

    // ── Hilfsfunktion: Globus-Gitterlinien zeichnen ──────────────────────────
    // Pro Großkreis werden Punkte alle 5° abgetastet. Wenn ein Punkt von der
    // Vorderseite zur Rückseite wechselt (z2 ≤ 0), wird der Pfad unterbrochen.
    function drawGrid(rotY: number, rotX: number, cx: number, cy: number, R: number) {
      // Breitengrade alle 30°, von -90 bis +90
      for (let lat = -90; lat <= 90; lat += 30) {
        const isEquator = lat === 0
        ctx.strokeStyle = isEquator ? '#2d6030' : '#1a4020'
        ctx.lineWidth = 0.8
        ctx.beginPath()
        let pathOpen = false
        for (let lon = -180; lon <= 180; lon += 5) {
          const { sx, sy, z2 } = project(lat, lon, rotY, rotX, cx, cy, R)
          if (z2 > 0) {
            // Vorderseite sichtbar
            if (!pathOpen) { ctx.moveTo(sx, sy); pathOpen = true }
            else            { ctx.lineTo(sx, sy) }
          } else {
            // Rückseite: Pfad-Segment abschließen
            if (pathOpen) { ctx.stroke(); ctx.beginPath(); pathOpen = false }
          }
        }
        if (pathOpen) ctx.stroke()
      }

      // Längengrade alle 30°, von -180 bis +150
      for (let lon = -180; lon < 180; lon += 30) {
        const isPrimeMeridian = lon === 0
        ctx.strokeStyle = isPrimeMeridian ? '#2d6030' : '#1a4020'
        ctx.lineWidth = 0.8
        ctx.beginPath()
        let pathOpen = false
        for (let lat = -90; lat <= 90; lat += 5) {
          const { sx, sy, z2 } = project(lat, lon, rotY, rotX, cx, cy, R)
          if (z2 > 0) {
            if (!pathOpen) { ctx.moveTo(sx, sy); pathOpen = true }
            else            { ctx.lineTo(sx, sy) }
          } else {
            if (pathOpen) { ctx.stroke(); ctx.beginPath(); pathOpen = false }
          }
        }
        if (pathOpen) ctx.stroke()
      }
    }

    // ── Hilfsfunktion: Kontinental-Umrisse zeichnen ─────────────────────────────
    // Für jedes Polygon werden die lat/lon-Punkte mit derselben project()-Funktion
    // wie das Gitternetz projiziert. Punkte auf der Rückseite (z2 ≤ 0) unterbrechen
    // den Pfad, damit keine Linien quer durch den Globus gezogen werden.
    function drawLandmasses(
      rotY: number, rotX: number,
      cx: number, cy: number, R: number,
      alpha: number,
    ) {
      // Etwas gedämpfteres Grün als das Gitternetz (#1a4020 / #2d6030)
      ctx.strokeStyle = `rgba(0,200,80,${alpha * 0.5})`
      ctx.lineWidth   = 1.0

      for (const polygon of LAND_POLYGONS) {
        ctx.beginPath()
        let pathOpen = false

        for (const [lat, lon] of polygon) {
          const { sx, sy, z2 } = project(lat, lon, rotY, rotX, cx, cy, R)
          if (z2 > 0) {
            // Punkt auf der Vorderseite: Linie oder Pfad beginnen
            if (!pathOpen) {
              ctx.moveTo(sx, sy)
              pathOpen = true
            } else {
              ctx.lineTo(sx, sy)
            }
          } else {
            // Rückseite: Pfad unterbrechen (kein Stroke über den Globus hinweg)
            if (pathOpen) {
              ctx.stroke()
              ctx.beginPath()
              pathOpen = false
            }
          }
        }
        if (pathOpen) ctx.stroke()
      }
    }

    // ── Hilfsfunktion: Scan-Eckmarkierungen um Ziel ────────────────────────────
    // Zeichnet 4 Ecken eines Aiming-Rahmens um (sx, sy).
    function drawTargetBox(sx: number, sy: number, alpha: number, t: number) {
      const pulse = 0.6 + 0.4 * Math.sin(t * 0.006)
      const a     = alpha * pulse
      const half  = 18
      const arm   = 7

      ctx.strokeStyle = `rgba(74,222,128,${a})`
      ctx.lineWidth   = 1.5

      for (const [dx, dy] of [[-1,-1],[1,-1],[-1,1],[1,1]] as [number,number][]) {
        const cx = sx + dx * half
        const cy = sy + dy * half
        ctx.beginPath()
        ctx.moveTo(cx, cy); ctx.lineTo(cx - dx * arm, cy)
        ctx.moveTo(cx, cy); ctx.lineTo(cx, cy - dy * arm)
        ctx.stroke()
      }

      ctx.strokeStyle = `rgba(74,222,128,${a * 0.2})`
      ctx.lineWidth   = 0.5
      ctx.strokeRect(sx - half, sy - half, half * 2, half * 2)
    }

    // ── Hilfsfunktion: Daten-Overlay zeichnen ───────────────────────────────
    // Zeigt CIA-style Metadaten zur Ziel-Kapitale. Verankert am Ziel-Punkt.
    function drawDataOverlay(
      alpha: number,
      cap: typeof CAPITALS[0],
      t: number,
      W: number, H: number,
      sx: number, sy: number,
    ) {
      if (alpha <= 0) return

      const latStr = `${Math.abs(cap.lat).toFixed(2)}\xb0${cap.lat >= 0 ? 'N' : 'S'}`
      const lonStr = `${Math.abs(cap.lon).toFixed(2)}\xb0${cap.lon >= 0 ? 'E' : 'W'}`

      const threatColor: Record<string, string> = {
        LOW: '#22c55e', MODERATE: '#a3e635', ELEVATED: '#facc15',
        HIGH: '#f97316', CRITICAL: '#ef4444',
      }
      const tc = threatColor[cap.threat] ?? '#22c55e'

      // Font-Größe skaliert mit Canvas-Breite
      const fSize = Math.max(9, Math.min(13, W * 0.032))
      const lineH = fSize + 4
      const pad   = 8

      const lines = [
        { text: '▶ TARGET ACQUIRED',         color: `rgba(74,222,128,${alpha})`,         bold: true  },
        { text: cap.name,                          color: `rgba(134,239,172,${alpha})`,        bold: true  },
        { text: cap.country,                       color: `rgba(74,222,128,${alpha * 0.85})`,  bold: false },
        { text: `${latStr}  ${lonStr}`,            color: `rgba(74,222,128,${alpha * 0.75})`,  bold: false },
        { text: `POP: ${cap.pop}`,                 color: `rgba(74,222,128,${alpha * 0.75})`,  bold: false },
        { text: `THREAT: ${cap.threat}`,           color: `rgba(${hexToRgba(tc)},${alpha})`,   bold: false },
        { text: cap.intel,                         color: `rgba(74,222,128,${alpha * 0.8})`,   bold: false },
        { text: 'CLASSIFICATION: TS/SCI',          color: `rgba(74,222,128,${alpha * 0.55})`,  bold: false },
      ]

      const boxW = Math.min(W * 0.45, Math.max(fSize * 22, 190))
      const boxH = lines.length * lineH + pad * 2

      // Box links oder rechts am Ziel verankern
      const anchorRight = sx < W * 0.55
      const boxX = anchorRight
        ? Math.min(sx + 28, W - boxW - 4)
        : Math.max(sx - 28 - boxW, 4)
      const boxY = Math.max(4, Math.min(H - boxH - 4, sy - boxH / 2))

      // Verbindungslinie (gestrichelt)
      const lineEndX = anchorRight ? boxX : boxX + boxW
      ctx.strokeStyle = `rgba(74,222,128,${alpha * 0.4})`
      ctx.lineWidth   = 0.8
      ctx.setLineDash([3, 3])
      ctx.beginPath()
      ctx.moveTo(sx, sy)
      ctx.lineTo(lineEndX, boxY + boxH / 2)
      ctx.stroke()
      ctx.setLineDash([])

      // Hintergrund
      ctx.fillStyle = `rgba(0,15,0,${alpha * 0.90})`
      ctx.fillRect(boxX, boxY, boxW, boxH)

      // Blinke-Rahmen
      const blink = 0.55 + 0.45 * Math.sin(t * 0.006)
      ctx.strokeStyle = `rgba(74,222,128,${alpha * blink})`
      ctx.lineWidth   = 1
      ctx.strokeRect(boxX, boxY, boxW, boxH)

      // Trennlinie nach Kopfzeilen (nach Zeile 1, 0-indiziert)
      const sepY = boxY + pad + 2 * lineH + 1
      ctx.strokeStyle = `rgba(74,222,128,${alpha * 0.3})`
      ctx.lineWidth   = 0.5
      ctx.beginPath()
      ctx.moveTo(boxX + 4, sepY)
      ctx.lineTo(boxX + boxW - 4, sepY)
      ctx.stroke()

      ctx.textBaseline = 'top'
      lines.forEach((line, i) => {
        ctx.font      = `${line.bold ? 'bold ' : ''}${fSize}px monospace`
        ctx.fillStyle = line.color
        ctx.fillText(line.text, boxX + pad, boxY + pad + i * lineH, boxW - pad * 2)
      })
    }

    // ── RAF-Haupt-Loop ───────────────────────────────────────────────────────
    function loop(t: number) {
      if (!running) return
      // Panel nicht sichtbar → Frame überspringen, aber Loop fortsetzen
      if (!isVisible) { rafId = requestAnimationFrame(loop); return }

      // Aktuelle Canvas-Dimensionen dynamisch lesen
      const W = canvas!.width
      const H = canvas!.height

      // Sicherheitscheck: falls Canvas noch keine Größe hat, überspringen
      if (W === 0 || H === 0) {
        rafId = requestAnimationFrame(loop)
        return
      }

      const s = stateRef.current
      const elapsed = t - s.phaseStart  // ms seit Phasen-Start

      // ── Phase-Logik ──────────────────────────────────────────────────────
      if (s.phase === 'scanning') {
        // Gleichmäßige langsame Rotation
        s.rotY += 0.0015
        // Nach 6 Sekunden → Ziel wählen und zu 'targeting' wechseln
        if (elapsed > 6000) {
          s.targetIdx = Math.floor(Math.random() * CAPITALS.length)
          const cap = CAPITALS[s.targetIdx]
          // Ziel-Rotation: der Lon-Grad des Ziels soll nach vorne zeigen.
          const lonR = cap.lon * (Math.PI / 180)
          const rawTarget = -lonR
          const diff = angleDiff(s.rotY, rawTarget)
          s.targetRotY = s.rotY + diff
          // Leichtes Neigen Richtung Breitengrad des Ziels (bis ±25°)
          const latR = cap.lat * (Math.PI / 180)
          s.targetRotX = Math.max(-0.44, Math.min(0.44, latR * 0.4))
          s.phase = 'targeting'
          s.phaseStart = t
        }

      } else if (s.phase === 'targeting') {
        // Sanft zum Ziel rotieren (Lerp, 4% pro Frame ≈ exponentiell)
        s.rotY   = lerp(s.rotY,   s.targetRotY, 0.04)
        s.rotX   = lerp(s.rotX,   s.targetRotX, 0.04)
        // Wenn nahe genug am Ziel → zu 'locked' wechseln
        const dY = Math.abs(s.rotY - s.targetRotY)
        const dX = Math.abs(s.rotX - s.targetRotX)
        if (dY < 0.01 && dX < 0.01) {
          s.rotY = s.targetRotY
          s.rotX = s.targetRotX
          s.phase = 'locked'
          s.phaseStart = t
        }

      } else if (s.phase === 'locked') {
        // Einzoomen und Overlay einblenden
        s.zoom      = lerp(s.zoom,      2.0, 0.03)
        s.dataAlpha = lerp(s.dataAlpha, 1.0, 0.04)
        // Nach 7 Sekunden → zu 'releasing' wechseln
        if (elapsed > 7000) {
          s.phase = 'releasing'
          s.phaseStart = t
        }

      } else if (s.phase === 'releasing') {
        // Auszoomen und Overlay ausblenden
        s.zoom      = lerp(s.zoom,      1.0, 0.06)
        s.dataAlpha = lerp(s.dataAlpha, 0.0, 0.06)
        // Sobald Overlay fast weg ist → zu 'scanning' wechseln
        if (s.dataAlpha < 0.05) {
          s.dataAlpha = 0
          s.zoom      = 1.0
          s.rotX      = 0.26   // Neigung zurück auf Standard
          s.phase = 'scanning'
          s.phaseStart = t
        }
      }

      // ── Rendering ────────────────────────────────────────────────────────
      // Globus-Radius proportional zur kleineren Canvas-Dimension
      const baseR = Math.min(W, H) * 0.38
      const R  = baseR * s.zoom   // Globus-Radius in Pixeln (inkl. Zoom)
      const cx = W / 2
      const cy = H / 2

      // Hintergrund schwarz löschen
      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, W, H)

      // Globus-Füllung (sehr dunkles Grün)
      ctx.fillStyle = '#040c04'
      ctx.beginPath()
      ctx.arc(cx, cy, R, 0, Math.PI * 2)
      ctx.fill()

      // Kontinental-Umrisse zeichnen (vor dem Gitternetz, damit Gitter drüberliegt)
      drawLandmasses(s.rotY, s.rotX, cx, cy, R, 1.0)

      // Gitternetz zeichnen
      drawGrid(s.rotY, s.rotX, cx, cy, R)

      // Globus-Umrisskreis (helles Grün)
      ctx.strokeStyle = '#22c55e'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(cx, cy, R, 0, Math.PI * 2)
      ctx.stroke()

      // ── Kapitalen-Punkte ─────────────────────────────────────────────────
      CAPITALS.forEach((cap, idx) => {
        const { sx, sy, z2 } = project(cap.lat, cap.lon, s.rotY, s.rotX, cx, cy, R)
        if (z2 <= 0.05) return   // Rückseite: nicht zeichnen

        const isTarget = idx === s.targetIdx

        if (isTarget && (s.phase === 'locked' || s.phase === 'releasing')) {
          const crossA = (s.phase === 'locked') ? 1 : s.dataAlpha
          const pulse  = 0.5 + 0.5 * Math.sin(t * 0.008)
          const size   = 5 + 2 * pulse

          // Fadenkreuz
          ctx.strokeStyle = `rgba(74,222,128,${crossA})`
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(sx - size, sy); ctx.lineTo(sx + size, sy)
          ctx.moveTo(sx, sy - size); ctx.lineTo(sx, sy + size)
          ctx.stroke()

          // Pulsierender Kreis
          ctx.strokeStyle = `rgba(74,222,128,${crossA * pulse * 0.5})`
          ctx.beginPath()
          ctx.arc(sx, sy, size * 1.6, 0, Math.PI * 2)
          ctx.stroke()

          // Scan-Eckrahmen um den Zielpunkt
          drawTargetBox(sx, sy, crossA, t)

          // Ziel-Punkt speichern für den Overlay-Aufruf unten
          ;(stateRef.current as AnimState & { _tsx: number; _tsy: number })._tsx = sx
          ;(stateRef.current as AnimState & { _tsx: number; _tsy: number })._tsy = sy

        } else {
          // Normaler Punkt (2px Radius, pulst leicht)
          const pulse = 0.6 + 0.4 * Math.sin(t * 0.003 + idx * 0.7)
          ctx.fillStyle = `rgba(74,222,128,${0.5 * pulse})`
          ctx.beginPath()
          ctx.arc(sx, sy, 2, 0, Math.PI * 2)
          ctx.fill()
        }
      })

      // ── Daten-Overlay (locked + releasing) ──────────────────────────────
      if (s.dataAlpha > 0) {
        const ts = s as AnimState & { _tsx?: number; _tsy?: number }
        const osx = ts._tsx ?? cx
        const osy = ts._tsy ?? cy
        drawDataOverlay(s.dataAlpha, CAPITALS[s.targetIdx], t, W, H, osx, osy)
      }

      // ── Phasen-Status-Indikator (oben links) ────────────────────────────
      ctx.font = '6px monospace'
      ctx.textBaseline = 'top'
      ctx.fillStyle = '#166534'   // gedämpftes Dunkelgrün
      const phaseLabel: Record<Phase, string> = {
        scanning:  'MODE: GLOBAL SCAN',
        targeting: 'MODE: ACQUIRING TARGET',
        locked:    'MODE: TARGET LOCKED',
        releasing: 'MODE: RELEASING',
      }
      ctx.fillText(phaseLabel[s.phase], 4, 4)

      rafId = requestAnimationFrame(loop)
    }

    // Ersten Frame anstoßen; phaseStart auf 0 → wird beim ersten Loop gesetzt
    rafId = requestAnimationFrame((t) => {
      stateRef.current.phaseStart = t
      loop(t)
    })

    return () => {
      running = false
      cancelAnimationFrame(rafId)
      ro.disconnect()
      io.disconnect()
    }
  }, [])

  return (
    <Panel title="GLOBAL SURVEILLANCE // SECTOR 7">
      {/* Canvas füllt den Panel-Body vollständig */}
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    </Panel>
  )
}
