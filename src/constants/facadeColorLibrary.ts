/** Fassadenfarbpalette (Naturstein, Backstein, …) — Bibliothek-Reiter Farbe. */
export type FacadeColorCategoryId =
  | 'naturstein'
  | 'anstrich_steinfarben'
  | 'backstein'
  | 'fuge'
  | 'stuck'
  | 'fenster_tuer'
  | 'laeden'
  | 'markise'
  | 'dach'
  | 'metall'
  | 'holz'

export interface FacadeColorLibraryEntry {
  id: string
  kategorie: FacadeColorCategoryId
  unterkategorie: string
  farbname: string
  hex: string
}

export interface FacadeColorCategory {
  id: FacadeColorCategoryId
  name: string
}

export const FACADE_COLOR_CATEGORIES: FacadeColorCategory[] = [
  {
    "id": "naturstein",
    "name": "Naturstein"
  },
  {
    "id": "anstrich_steinfarben",
    "name": "Anstrich"
  },
  {
    "id": "backstein",
    "name": "Backstein"
  },
  {
    "id": "fuge",
    "name": "Fuge"
  },
  {
    "id": "stuck",
    "name": "Stuck"
  },
  {
    "id": "fenster_tuer",
    "name": "Rahmen"
  },
  {
    "id": "laeden",
    "name": "Fensterläden"
  },
  {
    "id": "markise",
    "name": "Markise"
  },
  {
    "id": "dach",
    "name": "Dach"
  },
  {
    "id": "metall",
    "name": "Metall"
  },
  {
    "id": "holz",
    "name": "Holz"
  }
]

export const FACADE_COLOR_LIBRARY: FacadeColorLibraryEntry[] = [
  {
    "id": "ss-elbsandstein-hell",
    "kategorie": "naturstein",
    "unterkategorie": "sandstein",
    "farbname": "Elbsandstein hell",
    "hex": "#D8C9A8"
  },
  {
    "id": "ss-elbsandstein-ocker",
    "kategorie": "naturstein",
    "unterkategorie": "sandstein",
    "farbname": "Elbsandstein ocker",
    "hex": "#C4A46A"
  },
  {
    "id": "ss-obernkirchen",
    "kategorie": "naturstein",
    "unterkategorie": "sandstein",
    "farbname": "Obernkirchener Sandstein",
    "hex": "#D5CFC0"
  },
  {
    "id": "ss-mainsandstein-rot",
    "kategorie": "naturstein",
    "unterkategorie": "sandstein",
    "farbname": "Mainsandstein rot",
    "hex": "#B86A58"
  },
  {
    "id": "ss-buntsandstein",
    "kategorie": "naturstein",
    "unterkategorie": "sandstein",
    "farbname": "Buntsandstein",
    "hex": "#A85A4A"
  },
  {
    "id": "ss-sandstein-braun",
    "kategorie": "naturstein",
    "unterkategorie": "sandstein",
    "farbname": "Sandstein braun",
    "hex": "#8B6B4A"
  },
  {
    "id": "ss-sandstein-gruenlich",
    "kategorie": "naturstein",
    "unterkategorie": "sandstein",
    "farbname": "Sandstein grünlich",
    "hex": "#A8B09A"
  },
  {
    "id": "ss-sandstein-grau",
    "kategorie": "naturstein",
    "unterkategorie": "sandstein",
    "farbname": "Sandstein grau",
    "hex": "#9A968C"
  },
  {
    "id": "ks-jura-gelb",
    "kategorie": "naturstein",
    "unterkategorie": "kalkstein",
    "farbname": "Jura gelb",
    "hex": "#D2C09A"
  },
  {
    "id": "ks-jura-grau",
    "kategorie": "naturstein",
    "unterkategorie": "kalkstein",
    "farbname": "Jura grau",
    "hex": "#B8B4A8"
  },
  {
    "id": "ks-muschelkalk",
    "kategorie": "naturstein",
    "unterkategorie": "kalkstein",
    "farbname": "Muschelkalk",
    "hex": "#C8C0B0"
  },
  {
    "id": "ks-perlato",
    "kategorie": "naturstein",
    "unterkategorie": "kalkstein",
    "farbname": "Perlato / Perlino",
    "hex": "#E4D8C4"
  },
  {
    "id": "ks-belgisch-granit",
    "kategorie": "naturstein",
    "unterkategorie": "kalkstein",
    "farbname": "Belgisch Granit",
    "hex": "#3A3E42"
  },
  {
    "id": "ks-anroechter",
    "kategorie": "naturstein",
    "unterkategorie": "kalkstein",
    "farbname": "Anröchter Grünstein",
    "hex": "#6E7A6A"
  },
  {
    "id": "tv-navona",
    "kategorie": "naturstein",
    "unterkategorie": "travertin",
    "farbname": "Travertin Navona",
    "hex": "#E8DCC8"
  },
  {
    "id": "tv-classico",
    "kategorie": "naturstein",
    "unterkategorie": "travertin",
    "farbname": "Travertin Classico",
    "hex": "#D4C09A"
  },
  {
    "id": "tv-noce",
    "kategorie": "naturstein",
    "unterkategorie": "travertin",
    "farbname": "Travertin Noce",
    "hex": "#8B6B4A"
  },
  {
    "id": "tv-silber",
    "kategorie": "naturstein",
    "unterkategorie": "travertin",
    "farbname": "Travertin silbergrau",
    "hex": "#C0B8AC"
  },
  {
    "id": "gr-hellgrau",
    "kategorie": "naturstein",
    "unterkategorie": "granit",
    "farbname": "Granit hellgrau",
    "hex": "#C4C0B8"
  },
  {
    "id": "gr-rosa",
    "kategorie": "naturstein",
    "unterkategorie": "granit",
    "farbname": "Granit rosa",
    "hex": "#C8A090"
  },
  {
    "id": "gr-anthrazit",
    "kategorie": "naturstein",
    "unterkategorie": "granit",
    "farbname": "Granit anthrazit",
    "hex": "#4A4E52"
  },
  {
    "id": "gr-nero",
    "kategorie": "naturstein",
    "unterkategorie": "granit",
    "farbname": "Nero Assoluto",
    "hex": "#1A1C1E"
  },
  {
    "id": "gr-verde",
    "kategorie": "naturstein",
    "unterkategorie": "granit",
    "farbname": "Granit / Gneis grün",
    "hex": "#5A6E5C"
  },
  {
    "id": "sb-schiefer",
    "kategorie": "naturstein",
    "unterkategorie": "schiefer_basalt",
    "farbname": "Schiefer anthrazit",
    "hex": "#4A4C50"
  },
  {
    "id": "sb-basalt",
    "kategorie": "naturstein",
    "unterkategorie": "schiefer_basalt",
    "farbname": "Basaltlava",
    "hex": "#2C2C2E"
  },
  {
    "id": "ma-carrara",
    "kategorie": "naturstein",
    "unterkategorie": "marmor",
    "farbname": "Carrara weiß",
    "hex": "#E8E6E2"
  },
  {
    "id": "ma-rosso-verona",
    "kategorie": "naturstein",
    "unterkategorie": "marmor",
    "farbname": "Rosso Verona",
    "hex": "#A85A52"
  },
  {
    "id": "an-cremeweiss",
    "kategorie": "anstrich_steinfarben",
    "unterkategorie": "kalk_silikat",
    "farbname": "Cremeweiß",
    "hex": "#F1E6D2"
  },
  {
    "id": "an-hellelfenbein",
    "kategorie": "anstrich_steinfarben",
    "unterkategorie": "kalk_silikat",
    "farbname": "Hellelfenbein",
    "hex": "#E6D2B5"
  },
  {
    "id": "an-perlweiss",
    "kategorie": "anstrich_steinfarben",
    "unterkategorie": "kalk_silikat",
    "farbname": "Perlweiß",
    "hex": "#E3D9C6"
  },
  {
    "id": "an-elfenbein",
    "kategorie": "anstrich_steinfarben",
    "unterkategorie": "kalk_silikat",
    "farbname": "Elfenbein",
    "hex": "#DDC49A"
  },
  {
    "id": "an-ockergelb",
    "kategorie": "anstrich_steinfarben",
    "unterkategorie": "kalk_silikat",
    "farbname": "Ockergelb",
    "hex": "#B89C50"
  },
  {
    "id": "an-graubeige",
    "kategorie": "anstrich_steinfarben",
    "unterkategorie": "kalk_silikat",
    "farbname": "Graubeige",
    "hex": "#A48F7A"
  },
  {
    "id": "an-kieselgrau",
    "kategorie": "anstrich_steinfarben",
    "unterkategorie": "kalk_silikat",
    "farbname": "Kieselgrau",
    "hex": "#B8B799"
  },
  {
    "id": "an-steingrau",
    "kategorie": "anstrich_steinfarben",
    "unterkategorie": "kalk_silikat",
    "farbname": "Steingrau",
    "hex": "#8B8C7A"
  },
  {
    "id": "an-gelblichgrau",
    "kategorie": "anstrich_steinfarben",
    "unterkategorie": "kalk_silikat",
    "farbname": "Gelblichgrau",
    "hex": "#C4B898"
  },
  {
    "id": "an-gruenlichgrau",
    "kategorie": "anstrich_steinfarben",
    "unterkategorie": "kalk_silikat",
    "farbname": "Grünlichgrau",
    "hex": "#B0B4A4"
  },
  {
    "id": "an-roetlichgrau",
    "kategorie": "anstrich_steinfarben",
    "unterkategorie": "kalk_silikat",
    "farbname": "Rötlichgrau",
    "hex": "#B8A8A0"
  },
  {
    "id": "bk-hellrot",
    "kategorie": "backstein",
    "unterkategorie": "rot",
    "farbname": "Backstein hellrot",
    "hex": "#C45A3C"
  },
  {
    "id": "bk-ziegelrot",
    "kategorie": "backstein",
    "unterkategorie": "rot",
    "farbname": "Ziegelrot",
    "hex": "#B33C2D"
  },
  {
    "id": "bk-dunkelrot",
    "kategorie": "backstein",
    "unterkategorie": "rot",
    "farbname": "Backstein dunkelrot",
    "hex": "#8D2A19"
  },
  {
    "id": "bk-rotbraun",
    "kategorie": "backstein",
    "unterkategorie": "rot",
    "farbname": "Rotbraun",
    "hex": "#8B4B3A"
  },
  {
    "id": "bk-sandgelb",
    "kategorie": "backstein",
    "unterkategorie": "gelb_creme",
    "farbname": "Klinker sandgelb",
    "hex": "#D2A161"
  },
  {
    "id": "bk-creme",
    "kategorie": "backstein",
    "unterkategorie": "gelb_creme",
    "farbname": "Klinker creme",
    "hex": "#E6D2B4"
  },
  {
    "id": "bk-weissbunt",
    "kategorie": "backstein",
    "unterkategorie": "gelb_creme",
    "farbname": "Klinker weißbunt",
    "hex": "#D8D0C4"
  },
  {
    "id": "bk-sandbraun",
    "kategorie": "backstein",
    "unterkategorie": "braun",
    "farbname": "Klinker sandbraun",
    "hex": "#A8845C"
  },
  {
    "id": "bk-erdbraun",
    "kategorie": "backstein",
    "unterkategorie": "braun",
    "farbname": "Klinker erdbraun",
    "hex": "#6E4A32"
  },
  {
    "id": "bk-blaubraun",
    "kategorie": "backstein",
    "unterkategorie": "braun",
    "farbname": "Klinker blaubraun",
    "hex": "#5A4A44"
  },
  {
    "id": "bk-hellgrau",
    "kategorie": "backstein",
    "unterkategorie": "grau_anthrazit",
    "farbname": "Klinker hellgrau",
    "hex": "#C0B8B0"
  },
  {
    "id": "bk-mittelgrau",
    "kategorie": "backstein",
    "unterkategorie": "grau_anthrazit",
    "farbname": "Klinker mittelgrau",
    "hex": "#8A8680"
  },
  {
    "id": "bk-anthrazit",
    "kategorie": "backstein",
    "unterkategorie": "grau_anthrazit",
    "farbname": "Klinker anthrazit",
    "hex": "#3A3E42"
  },
  {
    "id": "bk-schwarz",
    "kategorie": "backstein",
    "unterkategorie": "grau_anthrazit",
    "farbname": "Klinker schwarz",
    "hex": "#1E1E20"
  },
  {
    "id": "bk-rotbunt",
    "kategorie": "backstein",
    "unterkategorie": "bunt_kohlebrand",
    "farbname": "Klinker rotbunt",
    "hex": "#A84838"
  },
  {
    "id": "bk-rotblaubunt",
    "kategorie": "backstein",
    "unterkategorie": "bunt_kohlebrand",
    "farbname": "Klinker rot-blau-bunt",
    "hex": "#8A3A3A"
  },
  {
    "id": "bk-buntgeflammt",
    "kategorie": "backstein",
    "unterkategorie": "bunt_kohlebrand",
    "farbname": "Klinker buntgeflammt",
    "hex": "#9A5A3A"
  },
  {
    "id": "bk-aubergine",
    "kategorie": "backstein",
    "unterkategorie": "bunt_kohlebrand",
    "farbname": "Klinker aubergine",
    "hex": "#6A3A42"
  },
  {
    "id": "fg-weiss",
    "kategorie": "fuge",
    "unterkategorie": "moertel",
    "farbname": "Fuge weiß",
    "hex": "#F2F0EA"
  },
  {
    "id": "fg-altweiss",
    "kategorie": "fuge",
    "unterkategorie": "moertel",
    "farbname": "Fuge altweiß",
    "hex": "#E8E0D2"
  },
  {
    "id": "fg-creme",
    "kategorie": "fuge",
    "unterkategorie": "moertel",
    "farbname": "Fuge cremebeige",
    "hex": "#DCCCB4"
  },
  {
    "id": "fg-hellgrau",
    "kategorie": "fuge",
    "unterkategorie": "moertel",
    "farbname": "Fuge hellgrau",
    "hex": "#C8C8C4"
  },
  {
    "id": "fg-zementgrau",
    "kategorie": "fuge",
    "unterkategorie": "moertel",
    "farbname": "Fuge zementgrau",
    "hex": "#8A8C88"
  },
  {
    "id": "fg-dunkelgrau",
    "kategorie": "fuge",
    "unterkategorie": "moertel",
    "farbname": "Fuge dunkelgrau",
    "hex": "#5A5C5A"
  },
  {
    "id": "fg-anthrazit",
    "kategorie": "fuge",
    "unterkategorie": "moertel",
    "farbname": "Fuge anthrazit",
    "hex": "#3A3E42"
  },
  {
    "id": "st-stuckweiss",
    "kategorie": "stuck",
    "unterkategorie": "stuck_anstrich",
    "farbname": "Stuckweiß",
    "hex": "#F4EFE4"
  },
  {
    "id": "st-stuckcreme",
    "kategorie": "stuck",
    "unterkategorie": "stuck_anstrich",
    "farbname": "Stuckcreme",
    "hex": "#EFE4D0"
  },
  {
    "id": "st-stuckelfenbein",
    "kategorie": "stuck",
    "unterkategorie": "stuck_anstrich",
    "farbname": "Stuckelfenbein",
    "hex": "#E6D2B5"
  },
  {
    "id": "st-stuckstein",
    "kategorie": "stuck",
    "unterkategorie": "stuck_anstrich",
    "farbname": "Stuck steinfarben",
    "hex": "#D8CCB4"
  },
  {
    "id": "st-stuckgrau",
    "kategorie": "stuck",
    "unterkategorie": "stuck_anstrich",
    "farbname": "Stuck hellgrau",
    "hex": "#D6D2C8"
  },
  {
    "id": "st-stuckgoldbeige",
    "kategorie": "stuck",
    "unterkategorie": "stuck_anstrich",
    "farbname": "Stuck goldbeige",
    "hex": "#D4C09A"
  },
  {
    "id": "ft-reinweiss",
    "kategorie": "fenster_tuer",
    "unterkategorie": "lack",
    "farbname": "Rahmen Reinweiß",
    "hex": "#F7F3E3"
  },
  {
    "id": "ft-verkehrsweiss",
    "kategorie": "fenster_tuer",
    "unterkategorie": "lack",
    "farbname": "Rahmen Verkehrsweiß",
    "hex": "#F1F0EA"
  },
  {
    "id": "ft-cremeweiss",
    "kategorie": "fenster_tuer",
    "unterkategorie": "lack",
    "farbname": "Rahmen Cremeweiß",
    "hex": "#F1E6D2"
  },
  {
    "id": "ft-anthrazit",
    "kategorie": "fenster_tuer",
    "unterkategorie": "lack",
    "farbname": "Rahmen Anthrazitgrau",
    "hex": "#293133"
  },
  {
    "id": "ft-schwarzgrau",
    "kategorie": "fenster_tuer",
    "unterkategorie": "lack",
    "farbname": "Rahmen Schwarzgrau",
    "hex": "#23282B"
  },
  {
    "id": "ft-tannengruen",
    "kategorie": "fenster_tuer",
    "unterkategorie": "lack",
    "farbname": "Rahmen Tannengrün",
    "hex": "#27352A"
  },
  {
    "id": "ft-moosgruen",
    "kategorie": "fenster_tuer",
    "unterkategorie": "lack",
    "farbname": "Rahmen Moosgrün",
    "hex": "#2F4538"
  },
  {
    "id": "ft-olivgruen",
    "kategorie": "fenster_tuer",
    "unterkategorie": "lack",
    "farbname": "Rahmen Olivgrün",
    "hex": "#4B4F3B"
  },
  {
    "id": "ft-schokobraun",
    "kategorie": "fenster_tuer",
    "unterkategorie": "lack",
    "farbname": "Rahmen Schokoladenbraun",
    "hex": "#45322E"
  },
  {
    "id": "ft-nussbraun",
    "kategorie": "fenster_tuer",
    "unterkategorie": "lack",
    "farbname": "Rahmen Nussbraun",
    "hex": "#5B3A29"
  },
  {
    "id": "ft-graubraun",
    "kategorie": "fenster_tuer",
    "unterkategorie": "lack",
    "farbname": "Rahmen Graubraun",
    "hex": "#3D3635"
  },
  {
    "id": "ft-lichtgrau",
    "kategorie": "fenster_tuer",
    "unterkategorie": "lack",
    "farbname": "Rahmen Lichtgrau",
    "hex": "#D7D7D7"
  },
  {
    "id": "ft-nachtblau",
    "kategorie": "fenster_tuer",
    "unterkategorie": "lack",
    "farbname": "Rahmen Nachtblau",
    "hex": "#2A2F4A"
  },
  {
    "id": "ft-englischrot",
    "kategorie": "fenster_tuer",
    "unterkategorie": "lack",
    "farbname": "Haustür Englischrot",
    "hex": "#7A2E2A"
  },
  {
    "id": "ft-eiche-natur",
    "kategorie": "fenster_tuer",
    "unterkategorie": "holzlasur",
    "farbname": "Eiche natur",
    "hex": "#C4A06A"
  },
  {
    "id": "ft-eiche-dunkel",
    "kategorie": "fenster_tuer",
    "unterkategorie": "holzlasur",
    "farbname": "Eiche dunkel",
    "hex": "#6E4A2E"
  },
  {
    "id": "ld-moosgruen",
    "kategorie": "laeden",
    "unterkategorie": "lack",
    "farbname": "Laden Moosgrün",
    "hex": "#2F4538"
  },
  {
    "id": "ld-tannengruen",
    "kategorie": "laeden",
    "unterkategorie": "lack",
    "farbname": "Laden Tannengrün",
    "hex": "#27352A"
  },
  {
    "id": "ld-creme",
    "kategorie": "laeden",
    "unterkategorie": "lack",
    "farbname": "Laden Cremeweiß",
    "hex": "#F1E6D2"
  },
  {
    "id": "ld-graublau",
    "kategorie": "laeden",
    "unterkategorie": "lack",
    "farbname": "Laden Graublau",
    "hex": "#4A5A68"
  },
  {
    "id": "ld-rotbraun",
    "kategorie": "laeden",
    "unterkategorie": "lack",
    "farbname": "Laden Rotbraun",
    "hex": "#6B2E24"
  },
  {
    "id": "mk-ecru",
    "kategorie": "markise",
    "unterkategorie": "uni",
    "farbname": "Markise Ecru",
    "hex": "#E8DCC8"
  },
  {
    "id": "mk-sand",
    "kategorie": "markise",
    "unterkategorie": "uni",
    "farbname": "Markise Sand",
    "hex": "#D4C4A4"
  },
  {
    "id": "mk-terracotta",
    "kategorie": "markise",
    "unterkategorie": "uni",
    "farbname": "Markise Terrakotta",
    "hex": "#C46A48"
  },
  {
    "id": "mk-waldgruen",
    "kategorie": "markise",
    "unterkategorie": "uni",
    "farbname": "Markise Waldgrün",
    "hex": "#3E5A40"
  },
  {
    "id": "mk-marine",
    "kategorie": "markise",
    "unterkategorie": "uni",
    "farbname": "Markise Marineblau",
    "hex": "#2A3A58"
  },
  {
    "id": "mk-bordeaux",
    "kategorie": "markise",
    "unterkategorie": "uni",
    "farbname": "Markise Bordeaux",
    "hex": "#7A2A32"
  },
  {
    "id": "mk-grau",
    "kategorie": "markise",
    "unterkategorie": "uni",
    "farbname": "Markise Mittelgrau",
    "hex": "#8A8884"
  },
  {
    "id": "mk-streifen-gruenweiss",
    "kategorie": "markise",
    "unterkategorie": "streifen",
    "farbname": "Streifen Grün-Weiß",
    "hex": "#3E5A40"
  },
  {
    "id": "mk-streifen-blauweiss",
    "kategorie": "markise",
    "unterkategorie": "streifen",
    "farbname": "Streifen Blau-Weiß",
    "hex": "#2A3A58"
  },
  {
    "id": "mk-streifen-rotcreme",
    "kategorie": "markise",
    "unterkategorie": "streifen",
    "farbname": "Streifen Rot-Creme",
    "hex": "#A84838"
  },
  {
    "id": "mk-streifen-beigeecru",
    "kategorie": "markise",
    "unterkategorie": "streifen",
    "farbname": "Streifen Beige-Ecru",
    "hex": "#C4B494"
  },
  {
    "id": "da-naturrot",
    "kategorie": "dach",
    "unterkategorie": "tonziegel",
    "farbname": "Dachziegel naturrot",
    "hex": "#B44A32"
  },
  {
    "id": "da-kupferbraun",
    "kategorie": "dach",
    "unterkategorie": "tonziegel",
    "farbname": "Dachziegel kupferbraun",
    "hex": "#8A4A32"
  },
  {
    "id": "da-kastanie",
    "kategorie": "dach",
    "unterkategorie": "tonziegel",
    "farbname": "Dachziegel kastanienbraun",
    "hex": "#5A3228"
  },
  {
    "id": "da-anthrazit",
    "kategorie": "dach",
    "unterkategorie": "tonziegel",
    "farbname": "Dachziegel anthrazit",
    "hex": "#3A3E42"
  },
  {
    "id": "da-schwarz",
    "kategorie": "dach",
    "unterkategorie": "tonziegel",
    "farbname": "Dachziegel schwarz",
    "hex": "#1E1E20"
  },
  {
    "id": "da-altfarben",
    "kategorie": "dach",
    "unterkategorie": "tonziegel",
    "farbname": "Dachziegel altfarben",
    "hex": "#8A5A40"
  },
  {
    "id": "da-schiefer",
    "kategorie": "dach",
    "unterkategorie": "schiefer",
    "farbname": "Dachschiefer",
    "hex": "#4A4C50"
  },
  {
    "id": "da-zink",
    "kategorie": "dach",
    "unterkategorie": "metalldach",
    "farbname": "Zinkdach",
    "hex": "#A8B0B0"
  },
  {
    "id": "da-kupfer",
    "kategorie": "dach",
    "unterkategorie": "metalldach",
    "farbname": "Kupferdach",
    "hex": "#B87333"
  },
  {
    "id": "mt-zink-rinne",
    "kategorie": "metall",
    "unterkategorie": "rinne_fallrohr",
    "farbname": "Rinne Zink",
    "hex": "#A8B0B0"
  },
  {
    "id": "mt-kupfer-rinne",
    "kategorie": "metall",
    "unterkategorie": "rinne_fallrohr",
    "farbname": "Rinne Kupfer",
    "hex": "#B87333"
  },
  {
    "id": "mt-anthrazit-rinne",
    "kategorie": "metall",
    "unterkategorie": "rinne_fallrohr",
    "farbname": "Rinne Anthrazit",
    "hex": "#293133"
  },
  {
    "id": "mt-weiss-rinne",
    "kategorie": "metall",
    "unterkategorie": "rinne_fallrohr",
    "farbname": "Rinne Weiß",
    "hex": "#F1F0EA"
  },
  {
    "id": "mt-eisen-schwarz",
    "kategorie": "metall",
    "unterkategorie": "beschlag",
    "farbname": "Beschlag Eisenschwarz",
    "hex": "#1A1A1C"
  },
  {
    "id": "mt-messing",
    "kategorie": "metall",
    "unterkategorie": "beschlag",
    "farbname": "Beschlag Messing",
    "hex": "#C4A35A"
  },
  {
    "id": "mt-bronze",
    "kategorie": "metall",
    "unterkategorie": "beschlag",
    "farbname": "Beschlag Bronze",
    "hex": "#6B4E32"
  },
  {
    "id": "hz-eiche",
    "kategorie": "holz",
    "unterkategorie": "natur",
    "farbname": "Holztür Eiche",
    "hex": "#C4A06A"
  },
  {
    "id": "hz-nuss",
    "kategorie": "holz",
    "unterkategorie": "natur",
    "farbname": "Holztür Nuss",
    "hex": "#5A3A28"
  },
  {
    "id": "hz-vergraut",
    "kategorie": "holz",
    "unterkategorie": "natur",
    "farbname": "Holz silbergrau",
    "hex": "#A8A090"
  }
]

