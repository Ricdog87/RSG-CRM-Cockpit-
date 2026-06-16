/**
 * Leichtgewichtige Geo-Auflösung für Deutschland (ohne externe API):
 * - PLZ-Leitregion (2-stelliges Präfix) → ungefähre Zentroid-Koordinaten
 * - Stadtname → PLZ-Präfix (für die Job-Seite, die nur `ort` kennt)
 * - Haversine-Distanz in km
 * Für Distanz-Banding (≈ 30/80/150 km) sind Region-Zentroide ausreichend.
 */

type LatLng = { lat: number; lng: number };

/** 2-stelliges PLZ-Präfix → Zentroid der Leitregion. */
const PREFIX_COORDS: Record<string, LatLng> = {
  "01": { lat: 51.05, lng: 13.74 }, "02": { lat: 51.18, lng: 14.42 }, "03": { lat: 51.76, lng: 14.33 },
  "04": { lat: 51.34, lng: 12.37 }, "06": { lat: 51.48, lng: 11.97 }, "07": { lat: 50.93, lng: 11.59 },
  "08": { lat: 50.72, lng: 12.49 }, "09": { lat: 50.83, lng: 12.92 },
  "10": { lat: 52.52, lng: 13.4 }, "12": { lat: 52.45, lng: 13.43 }, "13": { lat: 52.57, lng: 13.35 },
  "14": { lat: 52.4, lng: 13.06 }, "15": { lat: 52.34, lng: 14.55 }, "16": { lat: 52.83, lng: 13.82 },
  "17": { lat: 53.56, lng: 13.26 }, "18": { lat: 54.09, lng: 12.13 }, "19": { lat: 53.63, lng: 11.41 },
  "20": { lat: 53.55, lng: 10.0 }, "21": { lat: 53.46, lng: 9.95 }, "22": { lat: 53.6, lng: 9.95 },
  "23": { lat: 53.87, lng: 10.69 }, "24": { lat: 54.32, lng: 10.14 }, "25": { lat: 53.93, lng: 9.52 },
  "26": { lat: 53.14, lng: 8.21 }, "27": { lat: 53.5, lng: 8.6 }, "28": { lat: 53.08, lng: 8.8 },
  "29": { lat: 52.9, lng: 10.2 },
  "30": { lat: 52.37, lng: 9.74 }, "31": { lat: 52.15, lng: 9.95 }, "32": { lat: 52.2, lng: 8.7 },
  "33": { lat: 52.02, lng: 8.53 }, "34": { lat: 51.31, lng: 9.5 }, "35": { lat: 50.58, lng: 8.68 },
  "36": { lat: 50.55, lng: 9.68 }, "37": { lat: 51.54, lng: 9.93 }, "38": { lat: 52.27, lng: 10.52 },
  "39": { lat: 52.13, lng: 11.63 },
  "40": { lat: 51.23, lng: 6.78 }, "41": { lat: 51.19, lng: 6.44 }, "42": { lat: 51.26, lng: 7.18 },
  "44": { lat: 51.51, lng: 7.47 }, "45": { lat: 51.46, lng: 7.01 }, "46": { lat: 51.66, lng: 6.62 },
  "47": { lat: 51.43, lng: 6.76 }, "48": { lat: 51.96, lng: 7.63 }, "49": { lat: 52.27, lng: 8.05 },
  "50": { lat: 50.94, lng: 6.96 }, "51": { lat: 50.98, lng: 7.13 }, "52": { lat: 50.78, lng: 6.08 },
  "53": { lat: 50.74, lng: 7.1 }, "54": { lat: 49.75, lng: 6.64 }, "55": { lat: 50.0, lng: 8.27 },
  "56": { lat: 50.36, lng: 7.59 }, "57": { lat: 50.88, lng: 8.02 }, "58": { lat: 51.36, lng: 7.47 },
  "59": { lat: 51.68, lng: 7.82 },
  "60": { lat: 50.11, lng: 8.68 }, "61": { lat: 50.23, lng: 8.62 }, "63": { lat: 50.0, lng: 8.77 },
  "64": { lat: 49.87, lng: 8.65 }, "65": { lat: 50.08, lng: 8.24 }, "66": { lat: 49.24, lng: 6.99 },
  "67": { lat: 49.44, lng: 7.77 }, "68": { lat: 49.49, lng: 8.47 }, "69": { lat: 49.4, lng: 8.67 },
  "70": { lat: 48.78, lng: 9.18 }, "71": { lat: 48.8, lng: 9.2 }, "72": { lat: 48.52, lng: 9.06 },
  "73": { lat: 48.71, lng: 9.65 }, "74": { lat: 49.14, lng: 9.22 }, "75": { lat: 48.89, lng: 8.7 },
  "76": { lat: 49.0, lng: 8.4 }, "77": { lat: 48.47, lng: 7.94 }, "78": { lat: 47.92, lng: 8.46 },
  "79": { lat: 47.99, lng: 7.85 },
  "80": { lat: 48.14, lng: 11.58 }, "81": { lat: 48.11, lng: 11.6 }, "82": { lat: 48.0, lng: 11.35 },
  "83": { lat: 47.86, lng: 12.12 }, "84": { lat: 48.54, lng: 12.15 }, "85": { lat: 48.76, lng: 11.42 },
  "86": { lat: 48.37, lng: 10.9 }, "87": { lat: 47.73, lng: 10.31 }, "88": { lat: 47.78, lng: 9.61 },
  "89": { lat: 48.4, lng: 9.99 },
  "90": { lat: 49.45, lng: 11.08 }, "91": { lat: 49.45, lng: 11.0 }, "92": { lat: 49.44, lng: 11.86 },
  "93": { lat: 49.01, lng: 12.1 }, "94": { lat: 48.57, lng: 13.43 }, "95": { lat: 50.32, lng: 11.92 },
  "96": { lat: 49.89, lng: 10.89 }, "97": { lat: 49.79, lng: 9.95 }, "98": { lat: 50.61, lng: 10.69 },
  "99": { lat: 50.98, lng: 11.03 },
};

/** Größere Städte → PLZ-Präfix (für die Job-Seite, die nur den Ort kennt). */
const CITY_PREFIX: Record<string, string> = {
  berlin: "10", hamburg: "20", münchen: "80", muenchen: "80", köln: "50", koeln: "50",
  frankfurt: "60", "frankfurt am main": "60", stuttgart: "70", düsseldorf: "40", duesseldorf: "40",
  leipzig: "04", dortmund: "44", essen: "45", bremen: "28", dresden: "01", hannover: "30",
  nürnberg: "90", nuernberg: "90", duisburg: "47", bochum: "44", wuppertal: "42", bielefeld: "33",
  bonn: "53", münster: "48", muenster: "48", karlsruhe: "76", mannheim: "68", augsburg: "86",
  wiesbaden: "65", mainz: "55", gelsenkirchen: "45", mönchengladbach: "41", moenchengladbach: "41",
  braunschweig: "38", chemnitz: "09", kiel: "24", aachen: "52", halle: "06", magdeburg: "39",
  freiburg: "79", krefeld: "47", lübeck: "23", luebeck: "23", oberhausen: "46", erfurt: "99",
  rostock: "18", kassel: "34", hagen: "58", potsdam: "14", saarbrücken: "66", saarbruecken: "66",
  hamm: "59", ludwigshafen: "67", oldenburg: "26", osnabrück: "49", osnabrueck: "49", leverkusen: "51",
  heidelberg: "69", darmstadt: "64", würzburg: "97", wuerzburg: "97", regensburg: "93", ingolstadt: "85",
  ulm: "89", wolfsburg: "38", offenbach: "63", pforzheim: "75", göttingen: "37", goettingen: "37",
  bottrop: "46", trier: "54", recklinghausen: "45", reutlingen: "72", bremerhaven: "27", koblenz: "56",
  "bergisch gladbach": "51", jena: "07", remscheid: "42", erlangen: "91", moers: "47", siegen: "57",
  hildesheim: "31", salzgitter: "38", cottbus: "03", gera: "07", kaiserslautern: "67",
  witten: "58", gütersloh: "33", guetersloh: "33", iserlohn: "58", schwerin: "19", düren: "52",
  dueren: "52", ratingen: "40", lünen: "44", luenen: "44", marl: "45", velbert: "42", minden: "32",
  villingen: "78", konstanz: "78", worms: "67", dorsten: "46", neuss: "41", fürth: "90", fuerth: "90",
  bamberg: "96", bayreuth: "95", landshut: "84", passau: "94", rosenheim: "83", kempten: "87",
  flensburg: "24", celle: "29", lüneburg: "21", lueneburg: "21", paderborn: "33", herford: "32",
  fulda: "36", gießen: "35", giessen: "35", marburg: "35", hof: "95", aschaffenburg: "63",
  heilbronn: "74", esslingen: "73", ludwigsburg: "71", tübingen: "72", tuebingen: "72",
};

function norm(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}

/** Koordinaten aus einer PLZ (nimmt die ersten beiden Stellen). */
export function zipCoords(zip?: string): LatLng | null {
  if (!zip) return null;
  const m = zip.replace(/\D/g, "").slice(0, 2);
  return PREFIX_COORDS[m] ?? null;
}

/** Koordinaten aus einem Ortsnamen (über die Städte-Tabelle). */
export function cityCoords(city?: string): LatLng | null {
  if (!city) return null;
  const n = norm(city);
  const prefix = CITY_PREFIX[n] ?? CITY_PREFIX[n.split(" ")[0]] ?? CITY_PREFIX[n.split("/")[0]];
  return prefix ? PREFIX_COORDS[prefix] ?? null : null;
}

/** Beste verfügbare Koordinate (PLZ bevorzugt, sonst Ort). */
export function resolveCoords(zip?: string, city?: string): LatLng | null {
  return zipCoords(zip) ?? cityCoords(city);
}

/** Haversine-Distanz in km. */
export function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}
