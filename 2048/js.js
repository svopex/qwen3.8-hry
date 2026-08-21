// ====== 2048 — logika hry s animacemi ======
// Hráč posouvá dlaždice s mocninami dvou po mřížce 4x4 šipkami (nebo tažením).
// Stejné číselné dlaždice se při srážce spojí na dvojnásobek a přidají body.
// Cílem je vytvořit dlaždice 2048; hra skončí, když už není možné žádný tah udělat.
//
// Vykreslování pracuje se samostatnými dlaždicemi (DOM prvky), které se
// plynule posouvají přes CSS přechod (left/top); při sloučení nová dlaždice
// jemně „vyfoukne" a nové dlaždice se objeví zvětšením od nuly.

// ---- Rozměry hrací mřížky (jednotky: buňky) ----
const VELKOST = 4;

// ---- Kód úlohy pro ukládání rekordu do localStorage ----
const KUCI_REKORD = "hra-2048-rekord";

// Doba posunu dlaždice v ms; musí odpovídat CSS přechodu .tile (left/top).
const DOBA_POSUNU = 130;

// ==== Globální stav hry ====
let mridka;      // 2D pole 4x4 čísel — slouží pro logiku (možné tahy, výhra)
let tiles = [];  // seznam aktivních dlaždic {id, value, x, y, el}
let nextId = 1;  // počítadlo unikátních ID dlaždic
let score;       // aktuální skóre
let best;        // dosavadní nejlepší skóre (rekord)
let vyhra;       // hráč již dosáhl dlaždice 2048
let konecHry;    // hra skončila (již není žádný možný tah)
let animace;     // zámek — během animace tahu se ignorují další stisky

// ==== Odkazy na DOM prvky ====
const board = document.getElementById("board");
const gridBg = document.getElementById("gridBg");
const tilesLayer = document.getElementById("tiles");
const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const restartBtn = document.getElementById("restartBtn");
const overlay = document.getElementById("overlay");
const overlayText = document.getElementById("overlayText");
const overlayBtn = document.getElementById("overlayBtn");

// ==== Výstava hracího pole ====

// Vytvoří statické pozadí políček 4x4 (jednou při spuštění).
function vykresliPole() {
  gridBg.innerHTML = ""; // při výměně obsahu nejprve vyčisti staré buňky
  for (let y = 0; y < VELKOST; y++) {
    for (let x = 0; x < VELKOST; x++) {
      const c = document.createElement("div");
      c.className = "bg-cell";
      gridBg.appendChild(c);
    }
  }
}

// Spočítá pixelovou pozici a velikost buňky podle skutečné geometrie pozadí.
// Odměří se vůči vrstvě dlaždic, aby byl výsledek nezávislý na border/padding.
function pozice(x, y) {
  const t = tilesLayer.getBoundingClientRect();
  const c = gridBg.children[y * VELKOST + x].getBoundingClientRect();
  return { left: c.left - t.left, top: c.top - t.top, size: c.width };
}

// Umístí element dlaždice na souřadnice mřížky (spouští CSS přechod).
function umisti(el, x, y) {
  const p = pozice(x, y);
  el.style.left = p.left + "px";
  el.style.top = p.top + "px";
  el.style.width = p.size + "px";
  el.style.height = p.size + "px";
}

// Vrátí barevnou třídu podle hodnoty dlaždice (2048 a výše sdílí jednu třídu).
function tridaHodnoty(v) {
  return v >= 2048 ? "v-max" : "v-" + v;
}

// Vytvoří DOM dlaždice, vloží do vrstvy a zapamatuje do seznamu.
//   tridaAnim — volitelná třída animace ("new" / "merged"), jinak bez animace
function vytvorDlazdice(x, y, value, tridaAnim) {
  const el = document.createElement("div");
  el.className = "tile " + tridaHodnoty(value) + (tridaAnim ? " " + tridaAnim : "");
  el.textContent = value;
  tilesLayer.appendChild(el);
  umisti(el, x, y);
  const tile = { id: nextId++, value: value, x: x, y: y, el: el };
  tiles.push(tile);
  return tile;
}

// Vyhledá dlaždice na dané pozici mřížky (vrací null, pokud tam žádná není).
function tileAt(x, y) {
  for (const t of tiles) {
    if (t.x === x && t.y === y) return t;
  }
  return null;
}

// Přepočítá logickou mřížku (čísla) z aktuálních dlaždic.
function obnovMridku() {
  mridka = Array.from({ length: VELKOST }, () => new Array(VELKOST).fill(0));
  for (const t of tiles) mridka[t.y][t.x] = t.value;
}

// Aktualizuje zobrazení skóre a rekordu.
function aktualizujStat() {
  scoreEl.textContent = score;
  bestEl.textContent = best;
}

// ==== Generování nové dlaždice ====

// Vloží novou dlaždice (90 % → 2, 10 % → 4) do náhodného prázdného místa.
function pridajDlazdice() {
  // sebere všechny prázdné pozice, aby výběr byl rovnoměrný
  const volne = [];
  for (let y = 0; y < VELKOST; y++) {
    for (let x = 0; x < VELKOST; x++) {
      if (mridka[y][x] === 0) volne.push([x, y]);
    }
  }
  if (volne.length === 0) return;

  // náhodná pozice ze seznamu volných míst
  const [x, y] = volne[Math.floor(Math.random() * volne.length)];
  const value = Math.random() < 0.9 ? 2 : 4;
  // zaregistruj hodnotu v mřížce, aby další spawn nevybral stejné místo
  mridka[y][x] = value;
  vytvorDlazdice(x, y, value, "new"); // nová dlaždice se objeví zvětšením
}

// ==== Posun a slučování ====

// Převede mřížku na pole řádků ve směru pohybu; každý řádek je pole souřadnic
// v pořadí od čela (kam dlaždice sjíždějí) k zadku.
function radkyVSmiru(směr) {
  const vysledky = [];
  for (let i = 0; i < VELKOST; i++) {
    const radek = [];
    for (let j = 0; j < VELKOST; j++) {
      // podle směru určí souřadnice buňky v pořadí posunu
      //   left/right → řádky: y pevné (i), x se mění s j
      //   up/down    → sloupce: x pevné (i), y se mění s j
      let x;
      let y;
      if (směr === "left" || směr === "right") {
        y = i;
        x = směr === "left" ? j : VELKOST - 1 - j;
      } else {
        x = i;
        y = směr === "up" ? j : VELKOST - 1 - j;
      }
      radek.push({ x: x, y: y });
    }
    vysledky.push(radek);
  }
  return vysledky;
}

// Naplánuje tah: pro každou dlaždice určí cílové místo a které dvojice se spojí.
//   pohyby   — [{tile, nx, ny}] — kam se každá dlaždice posune
//   slouceni — [{nx, ny, value, zdroj:[t1,t2]}] — nové dlaždice vzniklé sloučením
function planujTah(směr) {
  const radky = radkyVSmiru(směr);
  const pohyby = [];
  const slouceni = [];

  for (const radek of radky) {
    // dlaždice v řádku sebereme od čela k zadku (v pořadí sjíždění)
    const front = [];
    for (const { x, y } of radek) {
      const t = tileAt(x, y);
      if (t) front.push(t);
    }

    let slot = 0; // cílové místo, kam ukládáme (od čela)
    let i = 0;
    while (i < front.length) {
      const cil = radek[slot];
      // dvě stejné sousední dlaždice se spojí na jedno cílové místo
      if (i + 1 < front.length && front[i].value === front[i + 1].value) {
        pohyby.push({ tile: front[i], nx: cil.x, ny: cil.y });
        pohyby.push({ tile: front[i + 1], nx: cil.x, ny: cil.y });
        slouceni.push({
          nx: cil.x,
          ny: cil.y,
          value: front[i].value * 2,
          zdroj: [front[i], front[i + 1]],
        });
        i += 2; // obě původní dlaždice se spotřebovaly
      } else {
        pohyby.push({ tile: front[i], nx: cil.x, ny: cil.y });
        i += 1;
      }
      slot++;
    }
  }

  return { pohyby: pohyby, slouceni: slouceni };
}

// Prove tah daným směrem s animací: posun → sloučení → spawn → kontrola stavu.
function posun(směr) {
  // během animace nebo po konci hry další tahy ignorujeme
  if (animace || konecHry) return;

  const { pohyby, slouceni } = planujTah(směr);

  // tah je platný jen tehdy, když se něco posune nebo něco spojí
  const bylPohyb = pohyby.some(
    (p) => p.tile.x !== p.nx || p.tile.y !== p.ny
  );
  if (!bylPohyb && slouceni.length === 0) return;

  // zamezíme dalším stiskům, dokud animace nedoběhne
  animace = true;

  // 1) posuň všechny dlaždice na cílová místa (CSS přechod left/top)
  for (const p of pohyby) {
    umisti(p.tile.el, p.nx, p.ny);
    p.tile.x = p.nx;
    p.tile.y = p.ny;
  }

  // 2) po doznění posunu dokonči sloučení, spawn a kontrolu stavu
  setTimeout(() => {
    let ziskane = 0;
    for (const s of slouceni) {
      // zdrojové dlaždice (které se překryly) odstraníme
      for (const t of s.zdroj) {
        t.el.remove();
        tiles = tiles.filter((o) => o !== t);
      }
      // nová dlaždice vzniklá sloučením — s animací „pop"
      vytvorDlazdice(s.nx, s.ny, s.value, "merged");
      ziskane += s.value;
    }

    // obnov logickou mřížku a přidá novou dlaždice
    obnovMridku();
    pridajDlazdice();

    score += ziskane;
    aktualizujStat();
    zjistiRekord();
    zkontrolujKonec();
    animace = false;
  }, DOBA_POSUNU);
}

// ==== Kontrola stavu hry ====

// Zkontroluje, zda je pole plné a nejsou žádné možné slučovací tahy.
function jsouMožneTahy() {
  for (let y = 0; y < VELKOST; y++) {
    for (let x = 0; x < VELKOST; x++) {
      // volná buňka → vždy lze hrát
      if (mridka[y][x] === 0) return true;
      // dva stejné sousedé vodorovně nebo svisle umožní sloučení
      if (x + 1 < VELKOST && mridka[y][x] === mridka[y][x + 1]) return true;
      if (y + 1 < VELKOST && mridka[y][x] === mridka[y + 1][x]) return true;
    }
  }
  return false;
}

// Po každém tahu ověří výhru a konec hry.
function zkontrolujKonec() {
  // výhra — hráč dosáhl dlaždice 2048 (zobrazí se jen jednou)
  if (!vyhra) {
    for (let y = 0; y < VELKOST; y++) {
      for (let x = 0; x < VELKOST; x++) {
        if (mridka[y][x] >= 2048) {
          vyhra = true;
          pokazHry("Výhra! Dosáhli jste 2048.");
          return;
        }
      }
    }
  }

  // konec — žádné možné tahy
  if (!jsouMožneTahy()) {
    konecHry = true;
    pokazHry(`Konec hry · ${score}`);
  }
}

// Uloží nový rekord, pokud aktuální skóre překonalo dosavadní maximum.
function zjistiRekord() {
  if (score > best) {
    best = score;
    // ulož do localStorage, aby rekord přežil zavření stránky
    try {
      localStorage.setItem(KUCI_REKORD, String(best));
    } catch (e) {
      // localStorage může být nedostupné (např. soukromý režim) — ignoruje
    }
  }
}

// Zobrazení nebo skrytí překryvu stavu s daným textem.
function pokazHry(text) {
  overlayText.textContent = text;
  overlay.hidden = false;
}

// ==== Nová hra ====

// Inicializuje pole a zahájí novou hru.
function novaHra() {
  // smaž všechny stávající dlaždice
  for (const t of tiles) t.el.remove();
  tiles = [];

  mridka = Array.from({ length: VELKOST }, () => new Array(VELKOST).fill(0));
  score = 0;
  vyhra = false;
  konecHry = false;
  animace = false;

  // začne dvěmi dlaždicemi, aby byla hra okamžitě hratelná
  pridajDlazdice();
  pridajDlazdice();
  obnovMridku();
  aktualizujStat();
  overlay.hidden = true;
}

// Načte uložený rekord z localStorage a nastaví počáteční hodnotu.
function nacitRekord() {
  best = 0;
  try {
    const ulozene = localStorage.getItem(KUCI_REKORD);
    if (ulozene) best = Number(ulozene) || 0;
  } catch (e) {
    // při nedostupném localStorage ponecháme nulu
  }
}

// ==== Ovládání klávesnicí ====

// Přepíše klávesu šipky na směr pohybu pole.
function smerZKlavesy(e) {
  switch (e.key) {
    case "ArrowLeft": return "left";
    case "ArrowRight": return "right";
    case "ArrowUp": return "up";
    case "ArrowDown": return "down";
    default: return null;
  }
}

document.addEventListener("keydown", (e) => {
  // ignoruje stisky, pokud hra skončila nebo běží animace
  if (konecHry || animace) return;
  const smer = smerZKlavesy(e);
  if (!smer) return;
  // zabráni defaultnímu scrollu stránky šipkami
  e.preventDefault();
  posun(smer);
});

// ==== Ovládání tažením (dotyk / myš) ====
let touchStartX = null;
let touchStartY = null;

board.addEventListener("touchstart", (e) => {
  // zapamatuje počáteční pozici prstu
  const t = e.touches[0];
  touchStartX = t.clientX;
  touchStartY = t.clientY;
}, { passive: true });

board.addEventListener("touchend", (e) => {
  if (touchStartX === null || konecHry || animace) return;
  const t = e.changedTouches[0];
  const dx = t.clientX - touchStartX;
  const dy = t.clientY - touchStartY;
  touchStartX = null;
  touchStartY = null;

  // zanedbá příliš krátké pohyby (klik), aby se nespustil omylem
  if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;

  // převažná osa určí směr tahů
  if (Math.abs(dx) > Math.abs(dy)) {
    posun(dx > 0 ? "right" : "left");
  } else {
    posun(dy > 0 ? "down" : "up");
  }
});

// ==== Připojení tlačítek ====
restartBtn.addEventListener("click", novaHra);
overlayBtn.addEventListener("click", novaHra);

// ==== Spouštění ====
document.addEventListener("DOMContentLoaded", () => {
  vykresliPole();   // vytvoří statické pozadí políček
  nacitRekord();     // načte uložený rekord
  novaHra();         // zahájí první hru
});
