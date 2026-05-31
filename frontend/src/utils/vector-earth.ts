export interface GeoPoint {
  lon: number // Longitude in degrees [-180..180]
  lat: number // Latitude in degrees [-90..90]
}

export type GeoPolygon = GeoPoint[]

// Highly optimized, simplified Natural Earth 1:110m land polygons
// Stored as standard longitude and latitude coordinates
export const VECTOR_EARTH: GeoPolygon[] = [
  // Afro-Eurasia (Main massive landmass)
  [
    { lon: -5.2, lat: 36.1 },   // Gibraltar
    { lon: -9.5, lat: 37.0 },   // Portugal (Southwest tip)
    { lon: -9.3, lat: 43.0 },   // Spain (Northwest tip)
    { lon: -1.5, lat: 43.4 },   // France / Spain border
    { lon: -4.5, lat: 48.4 },   // Brittany
    { lon: 0.1, lat: 49.3 },    // Normandy
    { lon: 3.3, lat: 51.3 },    // Belgium / Netherlands
    { lon: 8.5, lat: 53.5 },    // Germany
    { lon: 8.1, lat: 57.0 },    // Denmark (Jutland base)
    { lon: 10.5, lat: 57.7 },   // Skagen (Denmark tip)
    { lon: 10.8, lat: 54.2 },   // Kiel bay
    { lon: 14.2, lat: 53.8 },   // Poland border
    { lon: 19.5, lat: 54.4 },   // Gdansk
    { lon: 21.0, lat: 56.0 },   // Lithuania
    { lon: 22.5, lat: 57.5 },   // Riga gulf
    { lon: 25.5, lat: 59.5 },   // Tallinn
    { lon: 30.2, lat: 60.0 },   // St. Petersburg
    { lon: 27.2, lat: 60.5 },   // Finland South
    { lon: 21.5, lat: 61.5 },   // Gulf of Bothnia (East coast)
    { lon: 25.4, lat: 65.0 },   // Oulu
    { lon: 21.0, lat: 65.6 },   // Lulea
    { lon: 17.5, lat: 62.6 },   // Sweden East
    { lon: 18.0, lat: 59.3 },   // Stockholm
    { lon: 16.0, lat: 56.1 },   // Karlskrona
    { lon: 12.6, lat: 56.2 },   // Helsingborg
    { lon: 12.0, lat: 57.7 },   // Gothenburg
    { lon: 11.0, lat: 59.0 },   // Oslo Fjord
    { lon: 7.2, lat: 58.0 },    // Kristiansand
    { lon: 5.2, lat: 60.0 },    // Bergen
    { lon: 5.0, lat: 62.0 },    // Alesund
    { lon: 10.5, lat: 63.4 },   // Trondheim
    { lon: 13.0, lat: 67.0 },   // Bodø
    { lon: 14.5, lat: 68.3 },   // Lofoten base
    { lon: 19.0, lat: 69.7 },   // Tromsø
    { lon: 25.8, lat: 71.2 },   // North Cape (Norway)
    { lon: 31.0, lat: 70.0 },   // Varanger Fjord
    { lon: 40.0, lat: 67.5 },   // Kola Peninsula (White Sea mouth)
    { lon: 38.0, lat: 64.5 },   // Arkhangelsk
    { lon: 44.0, lat: 68.0 },   // Kanin Peninsula
    { lon: 53.0, lat: 68.5 },   // Pechora Bay
    { lon: 60.0, lat: 70.0 },   // Yugorsky Strait
    { lon: 70.0, lat: 71.0 },   // Yamal Peninsula West
    { lon: 73.0, lat: 73.0 },   // Yamal Peninsula North
    { lon: 78.0, lat: 72.0 },   // Ob Gulf
    { lon: 82.0, lat: 73.0 },   // Gydan Peninsula
    { lon: 100.0, lat: 77.8 },  // Cape Chelyuskin (Taimyr Peninsula)
    { lon: 115.0, lat: 73.5 },  // Khatanga Gulf
    { lon: 130.0, lat: 72.0 },  // Lena Delta
    { lon: 140.0, lat: 72.5 },  // Yana Bay
    { lon: 160.0, lat: 70.5 },  // Kolyma Gulf
    { lon: 170.0, lat: 69.5 },  // Chaun Bay
    { lon: 180.0, lat: 68.8 },  // Pevek coast
    { lon: 190.0, lat: 66.0 },  // East Cape (Bering Strait Russian side - wraps to -170 in projection)
    { lon: 172.5, lat: 64.5 },  // Anadyr Gulf
    { lon: 166.0, lat: 60.5 },  // Kamchatka Isthmus
    { lon: 162.0, lat: 57.0 },  // Kamchatka East Coast
    { lon: 156.5, lat: 50.9 },  // Cape Lopatka (Kamchatka Tip)
    { lon: 156.0, lat: 53.0 },  // Kamchatka West Coast
    { lon: 160.0, lat: 59.0 },  // Shelikhov Gulf
    { lon: 150.0, lat: 59.5 },  // Magadan
    { lon: 140.0, lat: 53.5 },  // Nikolayevsk-on-Amur
    { lon: 132.0, lat: 48.5 },  // Khabarovsk coast
    { lon: 131.9, lat: 43.1 },  // Vladivostok
    { lon: 129.5, lat: 40.5 },  // North Korea East
    { lon: 129.0, lat: 35.5 },  // South Korea East
    { lon: 126.5, lat: 34.3 },  // South Korea South tip
    { lon: 126.0, lat: 37.5 },  // Seoul (Incheon)
    { lon: 124.5, lat: 40.0 },  // Yalu River mouth
    { lon: 121.5, lat: 39.0 },  // Liaodong Peninsula (Dalian)
    { lon: 117.8, lat: 39.0 },  // Tianjin
    { lon: 122.5, lat: 37.0 },  // Shandong Peninsula (Qingdao)
    { lon: 120.0, lat: 32.0 },  // Yangtze Delta (Shanghai)
    { lon: 118.0, lat: 26.0 },  // Fuzhou
    { lon: 114.2, lat: 22.3 },  // Hong Kong
    { lon: 108.5, lat: 19.5 },  // Beibu Gulf
    { lon: 108.0, lat: 16.0 },  // Da Nang (Vietnam)
    { lon: 109.0, lat: 12.0 },  // Nha Trang
    { lon: 106.8, lat: 8.6 },   // Mekong Delta
    { lon: 100.5, lat: 13.5 },  // Bangkok (Gulf of Thailand)
    { lon: 103.5, lat: 1.3 },   // Singapore (Malay Peninsula tip)
    { lon: 100.0, lat: 6.0 },   // Penang
    { lon: 98.0, lat: 10.0 },   // Kra Isthmus
    { lon: 96.0, lat: 16.0 },   // Yangon (Irrawaddy Delta)
    { lon: 92.5, lat: 21.0 },   // Bangladesh / Myanmar border
    { lon: 90.0, lat: 22.5 },   // Ganges Delta
    { lon: 88.0, lat: 22.0 },   // Kolkata
    { lon: 80.0, lat: 16.0 },   // Chennai (Madras)
    { lon: 80.2, lat: 9.8 },    // Jaffna (Sri Lanka connection)
    { lon: 77.0, lat: 8.1 },    // Cape Comorin (India South tip)
    { lon: 73.0, lat: 18.0 },   // Mumbai (Bombay)
    { lon: 68.0, lat: 23.0 },   // Indus Delta (Karachi)
    { lon: 60.0, lat: 25.0 },   // Gwadar
    { lon: 57.0, lat: 26.0 },   // Strait of Hormuz
    { lon: 50.0, lat: 26.5 },   // Persian Gulf West (Qatar/Bahrain)
    { lon: 48.0, lat: 30.0 },   // Shatt al-Arab (Kuwait)
    { lon: 50.5, lat: 26.0 },   // Persian Gulf East
    { lon: 56.5, lat: 25.5 },   // Musandam Peninsula
    { lon: 59.5, lat: 22.5 },   // Ras al Hadd (Oman)
    { lon: 54.0, lat: 16.5 },   // Salalah
    { lon: 44.0, lat: 12.6 },   // Bab-el-Mandeb (Aden tip)
    { lon: 42.5, lat: 15.0 },   // Red Sea East (Al Hodeidah)
    { lon: 39.5, lat: 21.5 },   // Jeddah
    { lon: 35.0, lat: 28.0 },   // Gulf of Aqaba
    { lon: 32.5, lat: 29.9 },   // Suez (Sinai connection)
    // ── Transition to Africa ─────────────────────────────────────────────────
    { lon: 32.2, lat: 31.2 },   // Port Said (Suez Canal)
    { lon: 30.0, lat: 31.3 },   // Alexandria (Nile Delta)
    { lon: 20.0, lat: 32.2 },   // Benghazi
    { lon: 15.0, lat: 31.0 },   // Gulf of Sirte
    { lon: 11.5, lat: 33.0 },   // Gabes
    { lon: 11.0, lat: 37.0 },   // Cape Bon (Tunisia)
    { lon: 8.0, lat: 36.8 },    // Algiers coast
    { lon: -5.3, lat: 35.8 },   // Ceuta (Gibraltar Strait South side)
    { lon: -9.5, lat: 30.5 },   // Agadir
    { lon: -17.0, lat: 21.0 },  // Nouadhibou (Cap Blanc)
    { lon: -17.5, lat: 14.7 },  // Dakar (Cap Vert - Africa West tip)
    { lon: -13.0, lat: 9.0 },   // Conakry
    { lon: -7.5, lat: 4.4 },    // Cape Palmas
    { lon: -3.0, lat: 5.0 },    // Abidjan
    { lon: 2.0, lat: 6.0 },     // Lagos (Bight of Benin)
    { lon: 8.5, lat: 4.0 },     // Mount Cameroon / Douala
    { lon: 9.0, lat: 0.5 },     // Libreville
    { lon: 11.5, lat: -5.0 },   // Cabinda
    { lon: 13.5, lat: -12.5 },  // Lobito
    { lon: 15.0, lat: -23.0 },  // Walvis Bay
    { lon: 18.0, lat: -34.0 },  // Cape of Good Hope
    { lon: 20.0, lat: -34.8 },  // Cape Agulhas (Africa South tip)
    { lon: 26.0, lat: -33.8 },  // Port Elizabeth
    { lon: 31.0, lat: -30.0 },  // Durban
    { lon: 35.5, lat: -20.0 },  // Beira (Mozambique Channel)
    { lon: 40.5, lat: -14.5 },  // Nacala
    { lon: 39.0, lat: -5.0 },   // Mombasa
    { lon: 42.5, lat: 1.0 },    // Mogadishu
    { lon: 51.2, lat: 11.8 },   // Cape Guardafui (Horn of Africa tip)
    { lon: 49.0, lat: 11.5 },   // Gulf of Aden (Bosaso)
    { lon: 43.0, lat: 11.5 },   // Djibouti
    { lon: 39.0, lat: 15.5 },   // Massawa (Eritrea)
    { lon: 37.0, lat: 22.0 },   // Port Sudan
    { lon: 32.5, lat: 29.9 },   // Suez (Africa side)
    // ── Return to Mediterranean & Europe ─────────────────────────────────────
    { lon: 34.0, lat: 31.3 },   // Gaza
    { lon: 35.0, lat: 33.0 },   // Beirut
    { lon: 36.0, lat: 35.8 },   // Latakia
    { lon: 34.0, lat: 36.8 },   // Turkey South (Mersin)
    { lon: 30.5, lat: 36.2 },   // Antalya
    { lon: 27.2, lat: 37.0 },   // Bodrum (Aegean Coast)
    { lon: 26.5, lat: 40.2 },   // Dardanelles
    { lon: 29.0, lat: 41.0 },   // Istanbul (Bosporus)
    { lon: 35.0, lat: 41.5 },   // Sinop (Black Sea North tip)
    { lon: 41.5, lat: 41.5 },   // Batumi (Georgia)
    { lon: 41.8, lat: 44.5 },   // Caucasus
    { lon: 49.0, lat: 40.5 },   // Baku (Caspian Sea)
    { lon: 53.0, lat: 37.0 },   // Bandar-e Anzali
    { lon: 54.0, lat: 41.5 },   // Caspian East coast
    { lon: 47.0, lat: 47.0 },   // Astrakhan (Volga Delta)
    { lon: 38.0, lat: 47.0 },   // Sea of Azov
    { lon: 33.5, lat: 44.5 },   // Sevastopol (Crimea)
    { lon: 30.0, lat: 46.3 },   // Odessa
    { lon: 28.5, lat: 45.0 },   // Danube Delta
    { lon: 27.5, lat: 41.0 },   // Varna / Burgas
    { lon: 23.5, lat: 40.5 },   // Thessaloniki
    { lon: 22.5, lat: 39.0 },   // Athens (Piraeus)
    { lon: 21.7, lat: 38.0 },   // Peloponnese West
    { lon: 20.0, lat: 39.7 },   // Albania coast
    { lon: 19.0, lat: 42.0 },   // Montenegro / Dubrovnik
    { lon: 13.5, lat: 45.7 },   // Trieste (Adriatic North)
    { lon: 12.2, lat: 41.8 },   // Rome
    { lon: 14.2, lat: 40.8 },   // Naples
    { lon: 15.6, lat: 38.2 },   // Reggio Calabria (Strait of Messina)
    { lon: 16.8, lat: 40.5 },   // Taranto
    { lon: 18.5, lat: 40.2 },   // Brindisi
    { lon: 12.5, lat: 44.0 },   // Rimini
    { lon: 12.3, lat: 45.4 },   // Venice
    { lon: 9.0, lat: 43.7 },    // Genoa
    { lon: 5.3, lat: 43.3 },    // Marseille
    { lon: 3.0, lat: 41.9 },    // Costa Brava (Barcelona)
    { lon: -0.5, lat: 38.3 },   // Alicante
    { lon: -4.4, lat: 36.7 },   // Malaga
    { lon: -5.2, lat: 36.1 }    // Back to Gibraltar
  ],

  // North America
  [
    { lon: -78.0, lat: 8.5 },    // Panama / Darien Gap
    { lon: -83.0, lat: 9.5 },    // Costa Rica
    { lon: -87.0, lat: 13.0 },   // Gulf of Fonseca
    { lon: -92.0, lat: 15.0 },   // Chiapas (Mexico)
    { lon: -97.0, lat: 16.0 },   // Acapulco
    { lon: -105.0, lat: 20.0 },  // Puerto Vallarta
    { lon: -110.0, lat: 22.8 },  // Cabo San Lucas (Baja Tip)
    { lon: -114.0, lat: 31.8 },  // Colorado River Delta (Gulf of California)
    { lon: -117.0, lat: 32.5 },  // San Diego
    { lon: -120.5, lat: 34.5 },  // Point Conception (L.A.)
    { lon: -122.5, lat: 37.8 },  // San Francisco
    { lon: -124.5, lat: 40.4 },  // Cape Mendocino
    { lon: -124.0, lat: 44.0 },  // Oregon coast
    { lon: -124.8, lat: 48.4 },  // Cape Flattery (Seattle)
    { lon: -127.5, lat: 50.8 },  // Vancouver Island North
    { lon: -130.0, lat: 54.5 },  // Prince Rupert
    { lon: -136.0, lat: 58.0 },  // Juneau (Inside Passage)
    { lon: -146.0, lat: 60.5 },  // Prince William Sound (Valdez)
    { lon: -151.5, lat: 59.5 },  // Kenai Peninsula (Homer)
    { lon: -154.0, lat: 57.0 },  // Kodiak Island base
    { lon: -163.0, lat: 55.0 },  // Alaska Peninsula
    { lon: -168.0, lat: 65.6 },  // Cape Prince of Wales (Bering Strait US side)
    { lon: -166.0, lat: 68.0 },  // Kotzebue Sound
    { lon: -156.5, lat: 71.4 },  // Point Barrow (Alaska North tip)
    { lon: -141.0, lat: 69.7 },  // Yukon / Alaska border
    { lon: -130.0, lat: 69.0 },  // Mackenzie Delta
    { lon: -115.0, lat: 69.0 },  // Coronation Gulf
    { lon: -95.0, lat: 68.0 },   // Boothia Peninsula
    { lon: -82.0, lat: 66.0 },   // Foxe Basin
    { lon: -94.0, lat: 60.0 },   // Hudson Bay West (Churchill)
    { lon: -82.0, lat: 52.0 },   // James Bay South
    { lon: -78.0, lat: 58.0 },   // Hudson Bay East
    { lon: -70.0, lat: 62.5 },   // Hudson Strait (Hudson Bay exit)
    { lon: -64.0, lat: 58.0 },   // Labrador Coast (Hebron)
    { lon: -55.5, lat: 50.0 },   // Newfoundland North tip
    { lon: -53.0, lat: 47.0 },   // St. John's
    { lon: -59.0, lat: 46.0 },   // Cape Breton Island
    { lon: -64.0, lat: 45.0 },   // Bay of Fundy
    { lon: -70.0, lat: 43.0 },   // Boston
    { lon: -74.0, lat: 40.5 },   // New York
    { lon: -76.0, lat: 37.0 },   // Chesapeake Bay
    { lon: -75.5, lat: 35.2 },   // Cape Hatteras
    { lon: -81.0, lat: 32.0 },   // Savannah
    { lon: -80.0, lat: 25.2 },   // Miami / Florida Keys
    { lon: -82.8, lat: 27.8 },   // Tampa Bay
    { lon: -88.0, lat: 30.3 },   // Mobile Bay (Pensacola)
    { lon: -89.4, lat: 29.1 },   // Mississippi Delta (New Orleans)
    { lon: -97.3, lat: 27.8 },   // Corpus Christi
    { lon: -97.8, lat: 22.3 },   // Tampico
    { lon: -96.2, lat: 19.2 },   // Veracruz
    { lon: -90.5, lat: 21.0 },   // Yucatan Peninsula (Progreso)
    { lon: -87.0, lat: 21.0 },   // Cancun
    { lon: -88.3, lat: 18.5 },   // Belize
    { lon: -88.0, lat: 15.7 },   // Puerto Barrios (Guatemala East)
    { lon: -83.5, lat: 15.0 },   // Gracias a Dios (Honduras East)
    { lon: -83.7, lat: 12.0 },   // Bluefields (Nicaragua)
    { lon: -79.8, lat: 9.3 },    // Colon (Panama Canal)
    { lon: -78.0, lat: 8.5 }     // Back to Panama Gap
  ],

  // South America
  [
    { lon: -77.5, lat: 8.0 },    // Colombia / Panama border
    { lon: -76.0, lat: 9.0 },    // Gulf of Uraba
    { lon: -75.0, lat: 11.0 },   // Cartagena
    { lon: -71.5, lat: 11.8 },   // Guajira Peninsula (South America North tip)
    { lon: -71.5, lat: 10.0 },   // Lake Maracaibo
    { lon: -69.0, lat: 12.0 },   // Falcon Coast
    { lon: -66.8, lat: 10.6 },   // Caracas
    { lon: -61.5, lat: 10.0 },   // Orinoco Delta
    { lon: -57.0, lat: 6.0 },    // Georgetown
    { lon: -54.0, lat: 5.3 },    // Paramaribo
    { lon: -51.0, lat: 0.1 },    // Amazon Delta (Macapa)
    { lon: -48.0, lat: -1.0 },   // Belem
    { lon: -44.0, lat: -2.5 },   // Sao Luis
    { lon: -35.0, lat: -6.0 },   // Natal (South America East bulge tip)
    { lon: -34.8, lat: -8.0 },   // Recife
    { lon: -38.5, lat: -13.0 },  // Salvador
    { lon: -40.3, lat: -20.3 },  // Vitoria
    { lon: -43.2, lat: -22.9 },  // Rio de Janeiro
    { lon: -46.6, lat: -24.0 },  // Santos (Sao Paulo)
    { lon: -48.5, lat: -27.5 },  // Florianopolis
    { lon: -52.0, lat: -32.0 },  // Porto Alegre (Lagoa dos Patos)
    { lon: -56.2, lat: -34.9 },  // Montevideo (Rio de la Plata)
    { lon: -58.4, lat: -34.6 },  // Buenos Aires
    { lon: -57.5, lat: -38.0 },  // Mar del Plata
    { lon: -62.0, lat: -39.0 },  // Bahia Blanca
    { lon: -64.3, lat: -42.8 },  // Valdes Peninsula
    { lon: -66.0, lat: -47.0 },  // Puerto Deseado
    { lon: -68.0, lat: -51.5 },  // Rio Gallegos
    { lon: -68.5, lat: -53.0 },  // Strait of Magellan East entrance
    { lon: -66.5, lat: -55.0 },  // Tierra del Fuego East (Ushuaia)
    { lon: -67.3, lat: -56.0 },  // Cape Horn (South America South tip)
    { lon: -73.0, lat: -54.0 },  // Tierra del Fuego West
    { lon: -75.0, lat: -50.0 },  // Chilean Fjords (Puerto Natales)
    { lon: -74.0, lat: -45.0 },  // Taitao Peninsula
    { lon: -73.0, lat: -40.0 },  // Puerto Montt
    { lon: -73.0, lat: -37.0 },  // Concepcion
    { lon: -71.6, lat: -33.0 },  // Valparaiso
    { lon: -70.5, lat: -27.0 },  // Copiapo
    { lon: -70.2, lat: -20.0 },  // Iquique
    { lon: -71.5, lat: -16.5 },  // Arequipa coast (Peru)
    { lon: -76.0, lat: -14.0 },  // Pisco
    { lon: -77.2, lat: -12.0 },  // Lima
    { lon: -81.2, lat: -4.7 },   // Point Parinas (South America West bulge tip)
    { lon: -80.0, lat: -2.2 },   // Guayaquil
    { lon: -80.8, lat: 1.0 },    // Esmeraldas
    { lon: -77.5, lat: 6.5 },    // Buenaventura
    { lon: -77.5, lat: 8.0 }     // Back to Colombia border
  ],

  // Australia
  [
    { lon: 142.5, lat: -10.8 },  // Cape York (North tip)
    { lon: 143.0, lat: -14.5 },  // Princess Charlotte Bay
    { lon: 145.8, lat: -16.9 },  // Cairns
    { lon: 146.8, lat: -19.2 },  // Townsville
    { lon: 150.5, lat: -22.5 },  // Rockhampton
    { lon: 153.0, lat: -27.5 },  // Brisbane
    { lon: 153.5, lat: -28.2 },  // Byron Bay (Australia East tip)
    { lon: 151.8, lat: -32.8 },  // Newcastle
    { lon: 151.2, lat: -33.8 },  // Sydney
    { lon: 150.0, lat: -36.2 },  // Narooma
    { lon: 150.0, lat: -37.5 },  // Cape Howe
    { lon: 146.5, lat: -38.8 },  // Wilsons Promontory (Australia South tip)
    { lon: 145.0, lat: -38.2 },  // Melbourne (Port Phillip)
    { lon: 141.0, lat: -38.0 },  // Portland
    { lon: 138.5, lat: -35.0 },  // Adelaide (Gulf St Vincent)
    { lon: 136.0, lat: -35.0 },  // Eyre Peninsula
    { lon: 131.0, lat: -31.5 },  // Great Australian Bight (Eucla)
    { lon: 121.9, lat: -33.9 },  // Esperance
    { lon: 118.0, lat: -35.0 },  // Albany
    { lon: 115.0, lat: -34.3 },  // Cape Leeuwin
    { lon: 115.7, lat: -32.0 },  // Perth (Fremantle)
    { lon: 114.0, lat: -28.5 },  // Geraldton
    { lon: 113.1, lat: -26.3 },  // Steep Point (Australia West tip)
    { lon: 114.1, lat: -21.8 },  // North West Cape
    { lon: 117.3, lat: -20.5 },  // Port Hedland
    { lon: 122.2, lat: -18.0 },  // Broome
    { lon: 124.0, lat: -16.0 },  // King Sound
    { lon: 128.0, lat: -15.0 },  // Wyndham (Cambridge Gulf)
    { lon: 130.8, lat: -12.4 },  // Darwin
    { lon: 136.0, lat: -12.0 },  // Arnhem Land (Gove Peninsula)
    { lon: 139.5, lat: -16.0 },  // Gulf of Carpentaria (South Coast)
    { lon: 141.5, lat: -11.5 },  // Gulf of Carpentaria (East Coast)
    { lon: 142.5, lat: -10.8 }   // Back to Cape York
  ],

  // Greenland
  [
    { lon: -40.0, lat: 83.6 },   // Cape Morris Jesup (North tip)
    { lon: -28.0, lat: 81.0 },   // Nord
    { lon: -20.0, lat: 77.0 },   // East Coast North
    { lon: -22.0, lat: 70.0 },   // Scoresbysund (Ittoqqortoormiit)
    { lon: -35.0, lat: 65.0 },   // Tasiilaq
    { lon: -44.0, lat: 60.0 },   // Cape Farewell (South tip)
    { lon: -48.0, lat: 60.8 },   // Qaqortoq
    { lon: -52.0, lat: 64.2 },   // Nuuk (Godthab)
    { lon: -54.0, lat: 67.0 },   // Sisimiut
    { lon: -53.5, lat: 70.0 },   // Disko Island (Qeqertarsuaq)
    { lon: -56.0, lat: 73.0 },   // Upernavik
    { lon: -62.0, lat: 76.5 },   // Qaanaaq (Thule)
    { lon: -69.0, lat: 78.5 },   // Smith Sound
    { lon: -60.0, lat: 81.5 },   // Kennedy Channel
    { lon: -40.0, lat: 83.6 }    // Back to North tip
  ],

  // Antarctica (Simplified polygon representing ice shelf edge)
  [
    { lon: -180.0, lat: -72.0 },
    { lon: -150.0, lat: -73.0 },
    { lon: -120.0, lat: -74.0 },
    { lon: -90.0, lat: -72.0 },
    { lon: -60.0, lat: -65.0 },  // Antarctic Peninsula West
    { lon: -57.0, lat: -63.0 },  // Antarctic Peninsula Tip
    { lon: -60.0, lat: -68.0 },  // Antarctic Peninsula East
    { lon: -40.0, lat: -74.0 },  // Weddell Sea East
    { lon: -10.0, lat: -70.0 },
    { lon: 20.0, lat: -69.0 },
    { lon: 50.0, lat: -67.0 },
    { lon: 80.0, lat: -66.0 },
    { lon: 110.0, lat: -65.0 },
    { lon: 140.0, lat: -66.0 },
    { lon: 160.0, lat: -69.0 },
    { lon: 170.0, lat: -77.0 },  // Ross Sea West (McMurdo)
    { lon: -180.0, lat: -78.0 }, // Ross Sea Shelf Edge
    { lon: -180.0, lat: -72.0 }
  ],

  // Madagascar
  [
    { lon: 49.3, lat: -12.0 },   // Antsiranana (North tip)
    { lon: 50.3, lat: -15.2 },   // Antalaha
    { lon: 49.0, lat: -21.5 },   // Mananjary
    { lon: 47.0, lat: -25.0 },   // Tolagnaro (Fort Dauphin - South tip)
    { lon: 44.0, lat: -25.2 },   // Cap Sainte Marie
    { lon: 43.5, lat: -23.5 },   // Toliara
    { lon: 44.2, lat: -20.2 },   // Morondava
    { lon: 46.3, lat: -15.7 },   // Mahajanga
    { lon: 48.3, lat: -13.5 },   // Nosy Be
    { lon: 49.3, lat: -12.0 }    // Back to North tip
  ],

  // Great Britain
  [
    { lon: -5.0, lat: 56.4 },   // Highlands West
    { lon: -5.0, lat: 58.6 },   // John o' Groats (Scotland North tip)
    { lon: -3.0, lat: 57.7 },   // Inverness (Moray Firth)
    { lon: -2.0, lat: 57.0 },   // Aberdeen
    { lon: -2.6, lat: 56.0 },   // Edinburgh (Firth of Forth)
    { lon: -1.2, lat: 54.5 },   // Middlesbrough
    { lon: 0.3, lat: 53.0 },    // Norfolk (East Anglia)
    { lon: 1.4, lat: 51.3 },    // Dover (Strait of Dover)
    { lon: -1.0, lat: 50.8 },   // Southampton (Isle of Wight)
    { lon: -3.5, lat: 50.2 },   // Plymouth
    { lon: -5.7, lat: 50.0 },   // Land's End (Southwest tip)
    { lon: -4.5, lat: 51.2 },   // Bristol Channel South
    { lon: -3.0, lat: 51.5 },   // Cardiff (Wales)
    { lon: -5.3, lat: 51.8 },   // Pembrokeshire
    { lon: -4.0, lat: 52.5 },   // Cardigan Bay
    { lon: -4.7, lat: 53.4 },   // Anglesey (Holyhead)
    { lon: -3.0, lat: 53.4 },   // Liverpool
    { lon: -3.5, lat: 54.8 },   // Solway Firth
    { lon: -5.0, lat: 55.3 },   // Galloway
    { lon: -4.8, lat: 55.7 },   // Glasgow (Firth of Clyde)
    { lon: -5.6, lat: 56.0 },   // Mull
    { lon: -6.2, lat: 57.2 },   // Skye
    { lon: -5.0, lat: 56.4 }    // Back to Highlands West
  ],

  // Ireland
  [
    { lon: -6.0, lat: 53.3 },   // Dublin
    { lon: -6.2, lat: 51.7 },   // Wexford
    { lon: -8.0, lat: 51.5 },   // Cork
    { lon: -10.5, lat: 52.2 },  // Kerry (Southwest tip)
    { lon: -9.5, lat: 52.7 },   // Limerick (Shannon River)
    { lon: -10.2, lat: 54.3 },  // Belmullet (West tip)
    { lon: -8.2, lat: 55.2 },   // Donegal (Northwest tip)
    { lon: -6.5, lat: 55.2 },   // Giant's Causeway (North tip)
    { lon: -5.6, lat: 54.3 },   // Belfast
    { lon: -6.2, lat: 54.0 },   // Dundalk
    { lon: -6.0, lat: 53.3 }    // Back to Dublin
  ],

  // Japan (Honshu & Hokkaido simplified as one main polygon)
  [
    { lon: 139.8, lat: 35.6 },   // Tokyo Bay
    { lon: 140.8, lat: 35.8 },   // Chiba
    { lon: 141.5, lat: 38.3 },   // Sendai
    { lon: 141.5, lat: 41.5 },   // Aomori (Shimokita Peninsula)
    // Hokkaido Connection
    { lon: 140.7, lat: 41.8 },   // Hakodate
    { lon: 140.0, lat: 42.5 },   // Muroran
    { lon: 143.0, lat: 42.0 },   // Cape Erimo
    { lon: 144.5, lat: 43.0 },   // Kushiro
    { lon: 145.8, lat: 43.3 },   // Nemuro (Hokkaido East tip)
    { lon: 144.0, lat: 44.0 },   // Abashiri
    { lon: 142.0, lat: 45.5 },   // Cape Soya (Hokkaido North tip)
    { lon: 141.5, lat: 43.0 },   // Sapporo / Otaru
    { lon: 140.0, lat: 41.4 },   // Hokkaido Southwest tip
    // Back to Honshu West Coast
    { lon: 140.0, lat: 40.5 },   // Akita
    { lon: 138.0, lat: 37.5 },   // Niigata
    { lon: 136.0, lat: 37.5 },   // Noto Peninsula
    { lon: 133.0, lat: 35.5 },   // Matsue
    { lon: 131.0, lat: 34.0 },   // Shimonoseki (West tip)
    { lon: 130.5, lat: 32.5 },   // Kumamoto (Kyushu connection)
    { lon: 131.5, lat: 31.0 },   // Kagoshima (Kyushu South tip)
    { lon: 132.5, lat: 33.5 },   // Oita
    { lon: 133.5, lat: 33.5 },   // Kochi (Shikoku connection)
    { lon: 134.5, lat: 34.0 },   // Tokushima
    { lon: 135.2, lat: 34.3 },   // Osaka
    { lon: 136.0, lat: 34.0 },   // Kii Peninsula
    { lon: 138.5, lat: 34.5 },   // Shizuoka (Suruga Bay)
    { lon: 139.8, lat: 35.6 }    // Back to Tokyo Bay
  ],

  // Iceland
  [
    { lon: -14.5, lat: 65.0 },   // Seydisfjordur (East Coast)
    { lon: -16.5, lat: 66.5 },   // Husavik (North Coast)
    { lon: -18.0, lat: 66.0 },   // Akureyri
    { lon: -22.5, lat: 66.5 },   // Westfjords North tip
    { lon: -24.5, lat: 65.5 },   // Patreksfjordur (West tip)
    { lon: -22.0, lat: 65.0 },   // Snaefellsnes Peninsula
    { lon: -22.0, lat: 64.1 },   // Reykjavik
    { lon: -19.0, lat: 63.4 },   // Vik (South Coast tip)
    { lon: -14.5, lat: 65.0 }    // Back to East Coast
  ],

  // New Zealand (North Island)
  [
    { lon: 174.8, lat: -41.3 },  // Wellington
    { lon: 177.0, lat: -39.0 },  // Hawke's Bay
    { lon: 178.5, lat: -37.7 },  // East Cape
    { lon: 176.0, lat: -37.5 },  // Tauranga (Bay of Plenty)
    { lon: 173.0, lat: -34.4 },  // Cape Reinga (North tip)
    { lon: 174.5, lat: -36.8 },  // Auckland
    { lon: 174.0, lat: -39.0 },  // Cape Egmont (New Plymouth)
    { lon: 175.2, lat: -40.2 },  // Palmerston North
    { lon: 174.8, lat: -41.3 }   // Back to Wellington
  ],

  // New Zealand (South Island)
  [
    { lon: 174.0, lat: -41.3 },  // Nelson
    { lon: 174.2, lat: -42.5 },  // Kaikoura
    { lon: 172.7, lat: -43.5 },  // Christchurch (Pegasus Bay)
    { lon: 170.5, lat: -45.9 },  // Dunedin
    { lon: 168.3, lat: -46.6 },  // Invercargill
    { lon: 166.5, lat: -46.0 },  // Fiordland (Southwest tip)
    { lon: 168.0, lat: -44.0 },  // Milford Sound / West Coast
    { lon: 171.0, lat: -42.0 },  // Greymouth
    { lon: 172.8, lat: -40.5 },  // Farewell Spit
    { lon: 174.0, lat: -41.3 }   // Back to Nelson
  ]
]
