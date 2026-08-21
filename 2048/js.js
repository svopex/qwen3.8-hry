// ====== 2048 — logika hry ======
// Hráč posouvá dlaždice s mocninami dvou po mřížce 4x4 šipkami (nebo tažením).
// Stejné číselné dlaždice se při srážce spojí na dvojnásobek a přidají body.
// Cílem je vytvořit dlaždice 2048; hra skončí, když už není možné žádný tah udělat.

// ---- Rozměry hrací mřížky (jednotky: buňky) ----
const VELKOST = 4;

// ---- Kód úlohy pro ukládání rekordu do localStorage ----
const KUCI_REKORD = "hra-2048-rekord";

// ==== Globální stav hry ====
let mridka;      // 2D pole 4x4 čísel; 0 = prázdné místo, jinak hodnota dlaždice
let score;       // aktuální skóre
let best;        // dosavadní nejlepší skóre (rekord)
let vyhra;       // hráč již dosáhl dlaždice 2048
let konecHry;    // hra skončila (již není žádný možný tah)

// ==== Odkazy na DOM prvky ====
const board = document.getElementById("board");
const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const restartBtn = document.getElementById("restartBtn");
const overlay = document.getElementById("overlay");
const overlayText = document.getElementById("overlayText");
const overlayBtn = document.getElementById("overlayBtn");

// ==== Výstava hracího pole ====

// Vytvoří DOM buňky do CSS mřížky (jednou při spuštění).
function vykresliPole() {
  board.innerHTML = ""; // při výměně obsahu nejprve vyčisti staré buňky
  for (let y = 0; y < VELKOST; y++) {
    for (let x = 0; x < VELKOST; x++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.dataset.x = x;
      cell.dataset.y = y;
      board.appendChild(cell);
    }
  }
}

// Vyhledá DOM buňku podle souřadnic mřížky.
function cellElement(x, y) {
  return board.children[y * VELKOST + x];
}

// Aktualizuje vzhled jedné dlaždice podle její hodnoty.
function refreshCell(x, y) {
  const hodnota = mridka[y][x];
  const el = cellElement(x, y);
  // vymaže všechny třídy hodnot a vrátí buňku do základního stavu
  el.className = "cell";
  el.textContent = "";
  if (hodnota > 0) {
    // třída podle hodnoty určuje barvu; 2048 a výše sdílí jednu třídu
    const trida = hodnota >= 2048 ? "v-max" : "v-" + hodnota;
    el.classList.add(trida);
    el.textContent = hodnota;
  }
}

// Projde celé pole a obnoví vzhled všech dlaždic.
function refreshVse() {
  for (let y = 0; y < VELKOST; y++) {
    for (let x = 0; x < VELKOST; x++) {
      refreshCell(x, y);
    }
  }
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
  // hodnota podle pravděpodobnosti (převaha dvojek)
  mridka[y][x] = Math.random() < 0.9 ? 2 : 4;
  refreshCell(x, y);
}

// ==== Posun a slučování ====

// Převede mřížku na pole řádků ve směru pohybu (pro uspořádání).
// Každý řádek je pole hodnot v pořadí, ve kterém se posouvají.
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
      radek.push({ x: x, y: y, hodnota: mridka[y][x] });
    }
    vysledky.push(radek);
  }
  return vysledky;
}

// Zpracuje jeden řádek: posune dlaždice k nule a spojí stejné sousedy.
// Vrátí nový pole hodnot a počet získaných bodů.
function posunRidku(radek) {
  // vynechává prázdné místa, aby se dlaždice přitáhly k začátku řádku
  const hodnoty = radek.filter((b) => b.hodnota !== 0).map((b) => b.hodnota);
  const novy = [];
  let body = 0;
  let i = 0;
  while (i < hodnoty.length) {
    // pokud jsou vedle sebe dvě stejné hodnoty, spojí je na dvojnásobek
    if (i + 1 < hodnoty.length && hodnoty[i] === hodnoty[i + 1]) {
      const slouceno = hodnoty[i] * 2;
      novy.push(slouceno);
      body += slouceno;
      i += 2; // obě původní dlaždice se spotřebovaly
    } else {
      novy.push(hodnoty[i]);
      i += 1;
    }
  }
  // doplní prázdná místa na konec řádku
  while (novy.length < VELKOST) novy.push(0);
  return { novy: novy, body: body };
}

// Prove tah daným směrem; vrátí true, pokud se pole změnilo.
function posun(směr) {
  const radky = radkyVSmiru(směr);
  let zmena = false;
  let ziskaneBody = 0;

  for (const radek of radky) {
    const { novy, body } = posunRidku(radek);
    ziskaneBody += body;
    // zapíše nové hodnoty zpět do mřížky na původních pozicích řádku
    for (let j = 0; j < VELKOST; j++) {
      const { x, y } = radek[j];
      if (mridka[y][x] !== novy[j]) zmena = true;
      mridka[y][x] = novy[j];
    }
  }

  if (zmena) {
    score += ziskaneBody;
    // po úspěšném tahu přidá novou dlaždice a obnoví vzhled
    pridajDlazdice();
    refreshVse();
    aktualizujStat();
    zjistiRekord();
    zkontrolujKonec();
  }
  return zmena;
}

// ==== Kontrola stavu hry ====

// Zkontroluje, zda je pole plné a nejsou žádné možné slučovací tahy.
function jsouMožneTahy() {
  // volná buňka → vždy lze hrát
  for (let y = 0; y < VELKOST; y++) {
    for (let x = 0; x < VELKOST; x++) {
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

// Inicializuje mřížku a zahájí novou hru.
function novaHra() {
  // vymaže mřížku na nulové hodnoty
  mridka = Array.from({ length: VELKOST }, () => new Array(VELKOST).fill(0));
  score = 0;
  vyhra = false;
  konecHry = false;
  // začne dvěmi dlaždicemi, aby byla hra okamžitě hratelná
  pridajDlazdice();
  pridajDlazdice();
  refreshVse();
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
  // ignoruje stisky, pokud hra skončila
  if (konecHry) return;
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
  if (touchStartX === null || konecHry) return;
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
  vykresliPole();   // vytvoří DOM buňky pole
  nacitRekord();     // načte uložený rekord
  novaHra();         // zahájí první hru
});
