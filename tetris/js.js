// ====== Tetris — logika hry ======
// Hraní probíhá na 10x20 mřížce, kús (tetramino) padá a hráč je točí a posouvá.
// Plné řádky mizí, při každých 10 přeskupených řádcích stoupá úroveň a hra se zrychluje.

// ---- Rozměry hrací mřížky (jednotky: buňky) ----
const COLS = 10;
const ROWS = 20;

// ---- Barvy jednotlivých typů tetramin (v pořadí: I, O, T, S, Z, J, L) ----
const BAREVY = ["#4fd1c5", "#f6d745", "#c678dd", "#61d682", "#f66b6b", "#5b8def", "#ef8a3b"];

// ---- Definice tvarů: pro každý typ jsou 4 otáčecí stavy, každý = pole [x, y] buněk ----
// Souřadnice jsou relativní vůči „kotvě" kúsku; záporné hodnoty nejsou v definicích použity.
const TVARY = {
  I: [
    [[0, 1], [1, 1], [2, 1], [3, 1]],
    [[2, 0], [2, 1], [2, 2], [2, 3]],
    [[0, 2], [1, 2], [2, 2], [3, 2]],
    [[1, 0], [1, 1], [1, 2], [1, 3]],
  ],
  O: [
    [[1, 0], [2, 0], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [2, 1]],
  ],
  T: [
    [[1, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [1, 1], [2, 1], [1, 2]],
    [[0, 1], [1, 1], [2, 1], [1, 2]],
    [[1, 0], [0, 1], [1, 1], [1, 2]],
  ],
  S: [
    [[1, 0], [2, 0], [0, 1], [1, 1]],
    [[1, 0], [1, 1], [2, 1], [2, 2]],
    [[1, 1], [2, 1], [0, 2], [1, 2]],
    [[0, 0], [0, 1], [1, 1], [1, 2]],
  ],
  Z: [
    [[0, 0], [1, 0], [1, 1], [2, 1]],
    [[2, 0], [1, 1], [2, 1], [1, 2]],
    [[0, 1], [1, 1], [1, 2], [2, 2]],
    [[1, 0], [0, 1], [1, 1], [0, 2]],
  ],
  J: [
    [[0, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [1, 2]],
    [[0, 1], [1, 1], [2, 1], [2, 2]],
    [[1, 0], [1, 1], [0, 2], [1, 2]],
  ],
  L: [
    [[2, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [1, 1], [1, 2], [2, 2]],
    [[0, 1], [1, 1], [2, 1], [0, 2]],
    [[0, 0], [1, 0], [1, 1], [1, 2]],
  ],
};

// ---- Seznam typů kúsků (pro bag generátor) ----
const TYPI = Object.keys(TVARY); // ["I","O","T","S","Z","J","L"]

// ==== Globální stav hry ====
let mridka;          // 2D pole řádků, buňka = undefined (prázdná) nebo index barvy
let kusk;            // aktuální padající kús: {typ, otoceni, x, y}
let pristi;          // typ příštího kúsku (pro náhled)
let score;           // aktuální skóre
let level;           // aktuální úroveň (1..∞)
let lines;           // celkový počet přeskupených řádků
let bag;             // fronta kúsků z „pytlu" (7-bag náhodná sada)
let paused;          // je hra v pauze
let gameOver;        // skončila hra
let dropInterval;    // aktuální rychlost pádu v ms
let lastTime;        // čas posledního kroku pádu
let rafId;           // identifikátor animace (requestAnimationFrame)

// ==== Odkazy na DOM prvky ====
const board = document.getElementById("board");
const ctx = board.getContext("2d");
const nextCanvas = document.getElementById("next");
const nctx = nextCanvas.getContext("2d");
const scoreEl = document.getElementById("score");
const levelEl = document.getElementById("level");
const linesEl = document.getElementById("lines");
const overlay = document.getElementById("overlay");
const overlayText = document.getElementById("overlayText");
const overlayBtn = document.getElementById("overlayBtn");
const pauseBtn = document.getElementById("pauseBtn");
const restartBtn = document.getElementById("restartBtn");

// Buňka se vykresluje s malým odsazením, aby vznikl přehledný rámeček mezi kostkami.
const GAP = 2;

// Určí velikost jedné buňky tak, aby se celé pole vejdo do canvasu.
function velikostBufku() {
  return board.width / COLS;
}

// Barva pozadí prázdných políček — liší se podle aktivního motivu (tmavý / světlý).
function barvaPozadiPole() {
  // světlý motiv = světlé pozadí, jinak tmavé výchozí
  return window.hrySvetlyMotiv() ? "#eef2f8" : "#0a0f24";
}

// Vykreslí jednu buňku (s hranou a jemným odleskem) v dané pozici mřížky.
function nakresliBufku(c, x, y, barevnyIndex, velikost) {
  const vx = x * velikost;
  const vy = y * velikost;

  // hlavní plocha buňky
  c.fillStyle = BAREVY[barevnyIndex];
  c.fillRect(vx + GAP, vy + GAP, velikost - 2 * GAP, velikost - 2 * GAP);

  // jemný odlesk nahoře, aby kostka vypadala objemně
  c.fillStyle = "rgba(255,255,255,0.22)";
  c.fillRect(vx + GAP, vy + GAP, velikost - 2 * GAP, 3);
}

// Vykreslí celé herní pole: pozadí + všechny pevné (zafixované) buňky.
function vykresliPole() {
  ctx.clearRect(0, 0, board.width, board.height);

  // pozadí prázdných políček — barva dle aktivního motivu
  ctx.fillStyle = barvaPozadiPole();
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      ctx.fillRect(x * velikostBufku(), y * velikostBufku(), velikostBufku(), velikostBufku());
    }
  }

  // buňky s již zafixovaným materiálem
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (mridka[y][x] !== undefined) {
        nakresliBufku(ctx, x, y, mridka[y][x], velikostBufku());
      }
    }
  }
}

// Vykreslí aktuálně padající kús nad pozicí pozadí.
function vykresliKusk() {
  const velikost = velikostBufku();
  const barevnyIndex = TYPI.indexOf(kusk.typ);

  for (const [bx, by] of TVARY[kusk.typ][kusk.otoceni]) {
    // přepočet relativních souřadnic kúsku na souřadnice mřížky
    const x = kusk.x + bx;
    const y = kusk.y + by;
    // vykreslíme jen ty buňky, které jsou uvnitř hracího pole
    if (y >= 0 && y < ROWS && x >= 0 && x < COLS) {
      nakresliBufku(ctx, x, y, barevnyIndex, velikost);
    }
  }
}

// Vykreslí náhled příštího kúsku na malém canvasu (centrováno).
function vykresliNahled() {
  const velikost = nextCanvas.width / 5;
  nctx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);

  const barevnyIndex = TYPI.indexOf(pristi);
  const tvar = TVARY[pristi][0];

  // najdi rozsah tvaru, aby ho umístili do středu náhledového pole
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [bx, by] of tvar) {
    minX = Math.min(minX, bx); maxX = Math.max(maxX, bx);
    minY = Math.min(minY, by); maxY = Math.max(maxY, by);
  }

  const posunX = Math.floor((5 - (maxX - minX + 1)) / 2) - minX;
  const posunY = Math.floor((5 - (maxY - minY + 1)) / 2) - minY;

  for (const [bx, by] of tvar) {
    nakresliBufku(nctx, bx + posunX, by + posunY, barevnyIndex, velikost);
  }
}

// ---- Generátor kúsků (7-bag) ----
// Zaručí, že 7 různých tetramin se vždy objeví v jedné sadě — spravedlivější než čistá náhoda.
function vyrobSada() {
  const sada = TYPI.slice();
  // shuffle přes Fisher-Yates
  for (let i = sada.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [sada[i], sada[j]] = [sada[j], sada[i]];
  }
  return sada;
}

// Vezme další typ kúsku z fronty; pokud je pytl prázdný, doplní novou sadu.
function nextTyp() {
  if (bag.length === 0) {
    bag = vyrobSada();
  }
  return bag.shift();
}

// ---- Pomocné: kontrola kolize ----
// Vrátí true, pokud kús v daném stavu narazí na stěnu, dno nebo jiné buňky.
function kolize(typ, otoceni, x, y) {
  for (const [bx, by] of TVARY[typ][otoceni]) {
    const cx = x + bx;
    const cy = y + by;
    // buňka mimo pole po boku nebo dole = kolize
    if (cx < 0 || cx >= COLS || cy >= ROWS) return true;
    // buňka uvnitř pole — pokud je obsazená a není to součástí aktuálního kúsku, kolize
    if (cy >= 0 && mridka[cy][cx] !== undefined) return true;
  }
  return false;
}

// Zafixuje aktuální kús na mřížce (např. při dopadu).
function prilepiKusk() {
  for (const [bx, by] of TVARY[kusk.typ][kusk.otoceni]) {
    const x = kusk.x + bx;
    const y = kusk.y + by;
    // pokud by kús narazil do stropu, hra je skončená
    if (y < 0) { gameOver = true; return; }
    if (y >= 0 && x >= 0 && x < COLS && y < ROWS) {
      mridka[y][x] = TYPI.indexOf(kusk.typ);
    }
  }
}

// Detekuje a odstraní plné řádky a přepočítá skóre a úroveň.
function zjistiPlneRidky() {
  let odstraneno = 0;

  // projď řádky shora dolů a smaž ty, co jsou plné
  for (let y = ROWS - 1; y >= 0; y--) {
    if (mridka[y].every((b) => b !== undefined)) {
      // posune se shora jeden řádek dolů
      mridka.splice(y, 1);
      mridka.unshift(new Array(COLS).fill(undefined));
      odstraneno++;
      // posuneme index, abychom nepřeskočili řádek po posunu
      y++;
    }
  }

  if (odstraneno > 0) {
    // skóre podle klasické tabulky bodů: 100/300/500/800 násobené úrovní
    const body = [0, 100, 300, 500, 800][odstraneno] * level;
    score += body;
    lines += odstraneno;
    // úroveň stoupne každých 10 řádků (max 15)
    const novaLevel = Math.min(15, Math.floor(lines / 10) + 1);
    if (novaLevel !== level) {
      level = novaLevel;
      // s rostoucí úrovní klesá doba pádu
      dropInterval = Math.max(80, 600 - (level - 1) * 40);
    }
  }
}

// ---- Ovládání kúsku ----
// Posune kús vlevo/vpravo (dx = ±1) nebo dolů (dy = +1), pokud kolizi nedosáhne.
function posun(dx, dy) {
  if (kolize(kusk.typ, kusk.otoceni, kusk.x + dx, kusk.y + dy)) {
    return false;
  }
  kusk.x += dx;
  kusk.y += dy;
  return true;
}

// Otočí kús vправо (cyklicky), pokud nový stav nekoliduje.
function rotuj() {
  const nove = (kusk.otoceni + 1) % 4;
  if (kolize(kusk.typ, nove, kusk.x, kusk.y)) {
    return;
  }
  kusk.otoceni = nove;
}

// Pádem dolů do pozice, kde kús dosedne (hard drop / mezerník).
function prudkyPad() {
  while (posun(0, 1)) {
    // klesá, dokud kolize
  }
  // odměna za hard drop: 2 body za buňku
  score += 2;
  // po dosednutí zafixuje a zkontroluje řádky
  posunKoniec();
}

// Standardní krok dopadu — zafixuje kús, odstraní řádky a vyvolá nový.
function posunKoniec() {
  prilepiKusk();
  zjistiPlneRidky();
  // zafixovaný kús a případně odstraněné řádky ihned obnoví
  vykresliPole();
  if (gameOver) {
    konecHry();
    return;
  }
  // nový kús z fronty — ten se rovná novému aktuálnímu kúsku
  const typ = nextTyp();
  // příštím se stává další kus z fronty (pro náhled)
  pristi = nextTyp();
  nastaviNovyKusk(typ);
  // hra končí, když se nový kús zrodí v kolizi s existujícími kusy (hromada dosáhla střechy)
  if (kolize(kusk.typ, kusk.otoceni, kusk.x, kusk.y)) {
    vykresliKusk();
    konecHry();
    return;
  }
  vykresliNahled();
  aktualizujStat();
  vykresliKusk();
}

// Vytvoří nový kús z daného typu a umístí ho na startovní pozici.
function nastaviNovyKusk(typ) {
  kusk = {
    typ: typ,
    otoceni: 0,
    x: 3,       // startovní pozice uprostřed
    y: 0,
  };
}

// ---- Skóre / statistika ----
function aktualizujStat() {
  scoreEl.textContent = score;
  levelEl.textContent = level;
  linesEl.textContent = lines;
}

// ---- Stavové přepínače ----
function pokazHry(status) {
  if (!status) { overlay.hidden = true; return; }
  overlay.hidden = false;
}

function pauza() {
  if (gameOver) return;
  paused = true;
  overlayText.textContent = "Pauza";
  overlayBtn.textContent = "Pokračovat";
  pokazHry(true);
}

function spustPokrac() {
  // po konci hry hru neobnovuji — restartuje pouze tlačítko "Zkusit znovu"
  if (gameOver) {
    return;
  }
  paused = false;
  lastTime = performance.now();
  pokazHry(false);
  // pokračuje animace, pokud ještě běží
  if (!rafId) {
    rafId = requestAnimationFrame(krok);
  }
}

function konecHry() {
  paused = true;
  gameOver = true;
  overlayText.textContent = "Konec hry";
  overlayBtn.textContent = "Zkusit znovu";
  // při konci hry zobrazí skóre v popisku
  overlayText.textContent = `Konec hry · ${score}`;
  pokazHry(true);
}

// ---- Znovu spustí hru od nuly ----
function restart() {
  // vyčisti mřížku
  mridka = Array.from({ length: ROWS }, () => new Array(COLS).fill(undefined));
  score = 0;
  level = 1;
  lines = 0;
  bag = [];
  paused = false;
  gameOver = false;
  dropInterval = 600;
  lastTime = performance.now();

  // první kús z fronty
  const typ = nextTyp();
  // příště = další z fronty (pro náhled)
  pristi = nextTyp();
  nastaviNovyKusk(typ);

  aktualizujStat();
  vykresliNahled();
  vykresliPole();
  vykresliKusk();
  pokazHry(false);
  // po konci hry byla animace zastavena (rafId = null) — znovu ji spusti
  if (!rafId) {
    rafId = requestAnimationFrame(krok);
  }
}

// ---- Hlavní animace ----
function krok() {
  const ted = performance.now();
  const delta = ted - lastTime;

  // pokud hra běží (ne v pauze a ne končí), zpracuj časový krok
  if (!paused && !gameOver) {
    if (delta >= dropInterval) {
      lastTime = ted;
      // jeden krok pádu
      if (!posun(0, 1)) {
        // kús už nemůže dolů — dopadne
        posunKoniec();
      } else {
        vykresliPole();
        vykresliKusk();
      }
    }
  }

  // pokud hra běží, pokračuje v kreslení
  if (!gameOver) {
    rafId = requestAnimationFrame(krok);
  } else {
    rafId = null;
  }
}

// ---- Klávesové ovládání ----
function naKlavesy(e) {
  // ignoruj klávesy při pauze (pokud nejde o spust/pauzu)
  if (paused && (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === " ")) {
    return;
  }

  switch (e.key) {
    case "ArrowLeft":
      // pohyb doleva
      if (posun(-1, 0)) { vykresliPole(); vykresliKusk(); }
      break;
    case "ArrowRight":
      // pohyb doprava
      if (posun(1, 0)) { vykresliPole(); vykresliKusk(); }
      break;
    case "ArrowDown":
      // posun dolů — drobný bonus pro rychlý spěš
      if (posun(0, 1)) {
        score += 1;
        vykresliPole(); vykresliKusk();
        // přeskok běžného časového kroku
        lastTime = performance.now();
      }
      break;
    case "ArrowUp":
      // rotace
      rotuj();
      vykresliPole(); vykresliKusk();
      break;
    case " ":
      // hard drop
      prudkyPad();
      vykresliPole(); vykresliKusk();
      break;
    case "p":
    case "P":
      // klávesa P pro pauzu / pokračování
      if (paused) spustPokrac(); else pauza();
      break;
  }
}

// ---- Připojení událostí ----
document.addEventListener("keydown", (e) => {
  // zabráni defaultnímu scrollu šířka pole
  if ([" ", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
    e.preventDefault();
  }
  // pokud se hra právě hraje, vyjdi na klávesy
  if (gameOver) {
    return;
  }
  naKlavesy(e);
});

pauseBtn.addEventListener("click", () => {
  if (paused) spustPokrac(); else pauza();
});

overlayBtn.addEventListener("click", () => {
  if (gameOver) {
    restart();
  } else if (paused) {
    spustPokrac();
  }
});

restartBtn.addEventListener("click", restart);

// při přepnutí motivu (tmavý / světlý) si herní pole překreslí novými barvami pozadí
window.addEventListener("hry:motiv", () => {
  vykresliPole();
  vykresliKusk();
});

// ---- Spouštění ----
document.addEventListener("DOMContentLoaded", () => {
  restart();
  // spuštěna animace
  rafId = requestAnimationFrame(krok);
});
