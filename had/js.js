// ====== Had — logika hry ======
// Had se pohybuje po mřížce, požíjí zrno a roste.
// Hlavní zvláštnost: hranice pole jsou „průchozí" — když had narazí do stěny,
// nevznikne konec hry, ale vynoří se na opačné straně (obálka přes mod).
// Jediný způsob, jak prohry, je srážka s vlastním tělem.

// ---- Rozměry hrací mřížky (jednotky: buňky) ----
const COLS = 20;
const ROWS = 20;

// ---- Rychlost (interval mezi kroky v ms) ----
const BASE_INTERVAL = 150; // úvodní rychlost
const MIN_INTERVAL = 60;   // nejrychlejší možný krok
const SPEED_STEP = 4;      // o kolik ms zrychlí se hra po každém zrně

// ==== Globální stav hry ====
let snake;       // pole buněk hada, hlavička jako první prvek: {x, y}
let dir;         // aktuální směr pohybu: {x, y}
let queue;       // fronta požadovaných změně směru (abychom neztratili rychlé 2x otočení)
let food;        // pozice zrna: {x, y}
let score;       // počet sežraných zrn (skóre)
let level;       // aktuální rychlost (úroveň) — zobrazujeme ji
let intervalMs;  // aktuální interval mezi kroky
let paused;      // je hra v pauze
let gameOver;    // skončila hra (srážka s tělem)
let best;        // nejlepší skóre (uloženo v localStorage)
let rafId;       // identifikátor animace (requestAnimationFrame)
let lastTime;    // čas posledního kroku

// klíč pro uložení rekordu v localStorage
const BEST_KEY = "hadBest";

// ==== Odkazy na DOM prvky ====
const board = document.getElementById("board");
const ctx = board.getContext("2d");
const scoreEl = document.getElementById("score");
const speedEl = document.getElementById("speed");
const lengthEl = document.getElementById("length");
const bestEl = document.getElementById("best");
const overlay = document.getElementById("overlay");
const overlayText = document.getElementById("overlayText");
const overlayBtn = document.getElementById("overlayBtn");
const pauseBtn = document.getElementById("pauseBtn");
const restartBtn = document.getElementById("restartBtn");

// Buňka se vykresluje s malým odsazením, aby vznikl přehledný rámeček mezi segmenty.
const GAP = 2;

// Velikost jedné buňky — vezme se z rozměru canvasu a počtu sloupců.
function velikostBufky() {
  return board.width / COLS;
}

// ==== Vykreslování ====

// Vykreslí pozadí a jemnou mřížku.
function vykresliPozadi() {
  const velikost = velikostBufky();
  // pozadí je v CSS, zde jen jemné mřížkové linky na hranách buněk
  ctx.strokeStyle = "rgba(255,255,255,0.04)";
  ctx.lineWidth = 1;
  for (let i = 1; i < COLS; i++) {
    ctx.beginPath();
    ctx.moveTo(i * velikost, 0);
    ctx.lineTo(i * velikost, board.height);
    ctx.stroke();
  }
  for (let i = 1; i < ROWS; i++) {
    ctx.beginPath();
    ctx.moveTo(0, i * velikost);
    ctx.lineTo(board.width, i * velikost);
    ctx.stroke();
  }
}

// Vykreslí jednu buňku (zakulhlený obdélník) ve zadané pozici a barvě.
function nakresliBufku(x, y, velikost, fill) {
  const vx = x * velikost;
  const vy = y * velikost;
  ctx.fillStyle = fill;
  const r = 5; // poloměr zakulhlení rohů
  const s = velikost - 2 * GAP;
  const bx = vx + GAP;
  const by = vy + GAP;
  // zakulhlený obdélník ručně (bez roundRect, kvůli starším prohlížečům)
  ctx.beginPath();
  ctx.moveTo(bx + r, by);
  ctx.arcTo(bx + s, by, bx + s, by + s, r);
  ctx.arcTo(bx + s, by + s, bx, by + s, r);
  ctx.arcTo(bx, by + s, bx, by, r);
  ctx.arcTo(bx, by, bx + s, by, r);
  ctx.closePath();
  ctx.fill();
}

// Vykreslí zrno jako pulzující kroužek.
function vykresliZrno() {
  const velikost = velikostBufky();
  const vx = food.x * velikost + velikost / 2;
  const vy = food.y * velikost + velikost / 2;
  // vnější záře
  ctx.fillStyle = "rgba(255,107,107,0.25)";
  ctx.beginPath();
  ctx.arc(vx, vy, velikost * 0.42, 0, Math.PI * 2);
  ctx.fill();
  // vnější jádro
  ctx.fillStyle = "#ff6b6b";
  ctx.beginPath();
  ctx.arc(vx, vy, velikost * 0.3, 0, Math.PI * 2);
  ctx.fill();
}

// Vykreslí celého hada — hlavička jasnější, tělo přechází do tmavší.
function vykresliHada() {
  const velikost = velikostBufky();
  const n = snake.length;
  // od konce (ocas) k hlavičce, aby se hlava nakreslila naposledy
  for (let i = n - 1; i >= 0; i--) {
    const seg = snake[i];
    // barva se postupně tmavší k ocasu; hlavička je zelenavá
    let fill;
    if (i === 0) {
      fill = "#6ee6a5";
    } else {
      // plynulý přechod od jasně modré k tmavší podle vzdálenosti od hlavy
      const t = i / Math.max(1, n - 1);
      const r = Math.round(79 + t * (30 - 79));
      const g = Math.round(140 + t * (60 - 140));
      const b = Math.round(255 + t * (140 - 255));
      fill = `rgb(${r},${g},${b})`;
    }
    nakresliBufku(seg.x, seg.y, velikost, fill);
  }

  // očka na hlavičce — orientace podle směru pohybu
  const head = snake[0];
  const cx = head.x * velikost + velikost / 2;
  const cy = head.y * velikost + velikost / 2;
  const ok = velikost * 0.12;
  ctx.fillStyle = "#04121b";
  // očka se otáčejí podle směru (jednoduše: dvě tečky po ose pohybu)
  const ox = dir.x * velikost * 0.12;
  const oy = dir.y * velikost * 0.12;
  // kolmá osa na směr pro rozložení očí
  const px = -dir.y * velikost * 0.14;
  const py = dir.x * velikost * 0.14;
  ctx.beginPath();
  ctx.arc(cx + ox + px, cy + oy + py, ok, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + ox - px, cy + oy - py, ok, 0, Math.PI * 2);
  ctx.fill();
}

// Kompletní překreslení scény (pozadí, zrno, had).
function vykresli() {
  ctx.clearRect(0, 0, board.width, board.height);
  vykresliPozadi();
  vykresliZrno();
  vykresliHada();
}

// ==== Rychlost a skóre ====

// Aktualizuje statistiku v bočním panelu.
function aktualizujStat() {
  scoreEl.textContent = score;
  speedEl.textContent = level;
  lengthEl.textContent = snake.length;
  bestEl.textContent = best;
}

// Zrychlí hru o jeden krok (pokud ještě lze) a zvýší úroveň rychlosti.
function zrychli() {
  if (intervalMs > MIN_INTERVAL) {
    intervalMs = Math.max(MIN_INTERVAL, intervalMs - SPEED_STEP);
    level++;
  }
}

// ==== Zrno ====

// Vytáhne náhodnou buňku, na které není had. Pokud by had vyplo pole, vrátí {x:0,y:0}.
function vygenerujZrno() {
  // seznam volných buněk (všechny kromě tělesných buněk hada)
  const obsazene = new Set(snake.map((s) => s.y * COLS + s.x));
  const volne = [];
  for (let i = 0; i < COLS * ROWS; i++) {
    if (!obsazene.has(i)) volne.push(i);
  }
  // pole je celé obsazené (had vyplnil celé pole) — nemáme kde umístit zrno
  if (volne.length === 0) {
    return { x: 0, y: 0 };
  }
  const index = volne[Math.floor(Math.random() * volne.length)];
  return { x: index % COLS, y: Math.floor(index / COLS) };
}

// ==== Hrací krok ====

// Ověří, je-li navrhovaný směr platný (není to 180° zpět vůči odkaznému směru).
function validniSměr(novy, odkaz) {
  // opačný vektor = 180° obrat, ten zakazujeme
  return !(novy.x === -odkaz.x && novy.y === -odkaz.y);
}

// Zapamatuj požadovanou změnu směru do fronty (pokud je směr platný).
function zadamSměr(novy) {
  // odkazový směr = poslední frontový, jinak aktuální
  const odkaz = queue.length ? queue[queue.length - 1] : dir;
  if (novy.x === odkaz.x && novy.y === odkaz.y) return; // stejný směr, zbytečné
  if (!validniSměr(novy, odkaz)) return; // 180° obrat, nedovolíme
  // omezíme délku fronty, abychom nenasazovali nepatrně dlouhé posloupnosti
  if (queue.length < 3) queue.push(novy);
}

// Jeden krok hada: posun hlavičky (obálka přes stěny), kontrola srážky, zrno, růst.
function krok() {
  // bereme další požadovaný směr z fronty
  if (queue.length) {
    dir = queue.shift();
  }

  // nová pozice hlavičky; modulo zanechá hranice průchozí (projde zeď)
  const novaHlava = {
    x: (snake[0].x + dir.x + COLS) % COLS,
    y: (snake[0].y + dir.y + ROWS) % ROWS,
  };

  // rozhodneme, zda se had nají (dosáhne na zrno)
  const naje = novaHlava.x === food.x && novaHlava.y === food.y;

  // tělo, které je pro kolizi relevantní: pokud se nenají, ocas se posune (místo je volné)
  const teloKeKolideni = naje ? snake : snake.slice(0, -1);

  // srážka s vlastním tělem = konec hry (do stěn už naráží, proto jen tělo)
  if (teloKeKolideni.some((s) => s.x === novaHlava.x && s.y === novaHlava.y)) {
    konecHry();
    return;
  }

  // posune hlavičku na frontu hada
  snake.unshift(novaHlava);

  // najíme: zrůst + výměna zrna + zrychlení; jinak: zkrátíme o ocas
  if (naje) {
    score++;
    zrychli();
    food = vygenerujZrno();
  } else {
    snake.pop();
  }

  aktualizujStat();
  vykresli();
}

// ==== Stav hry ====

// Přepne hru do stavu konce (srážka s tělem).
function konecHry() {
  gameOver = true;
  // aktualizovat rekord, je-li skóre vyšší
  if (score > best) {
    best = score;
    try {
      localStorage.setItem(BEST_KEY, String(best));
    } catch (err) {
      // localStorage nemusí být dostupný (např. soukromý režim) — rekord jen neuložíme
    }
  }
  overlayText.textContent = `Konec hry · ${score} zrn`;
  overlayBtn.textContent = "Zkusit znovu";
  pokazHry(true);
}

// Zobrazení nebo skrytí překryvu stavu.
function pokazHry(zobrazit) {
  overlay.hidden = !zobrazit;
}

// Přepne pauzu; text a tlačítko přizpůsobí.
function pauza() {
  if (gameOver) return;
  paused = true;
  overlayText.textContent = "Pauza";
  overlayBtn.textContent = "Pokračovat";
  pokazHry(true);
}

// Opustí pauzu a pokračuje.
function pokracuj() {
  paused = false;
  lastTime = performance.now();
  pokazHry(false);
  if (!rafId) {
    rafId = requestAnimationFrame(krokAnimace);
  }
}

// ==== Nová hra ====

// Přečte uložený rekord z localStorage (pokud je dostupný).
function nactiRekord() {
  let hodnoty = 0;
  try {
    const ulozeny = localStorage.getItem(BEST_KEY);
    if (ulozeny) hodnoty = parseInt(ulozeny, 10) || 0;
  } catch (err) {
    // localStorage nedostupné — zůstaneme u nuly
  }
  return hodnoty;
}

// Resetuje hru na počáteční stav — had uprostřed pole, pohyb doprava.
function restart() {
  // výchozí pozice: 3 segmenty uprostřed, pohyb doprava
  const cx = Math.floor(COLS / 2);
  const cy = Math.floor(ROWS / 2);
  snake = [
    { x: cx, y: cy }, // hlavička
    { x: cx - 1, y: cy },
    { x: cx - 2, y: cy },
  ];
  dir = { x: 1, y: 0 };
  queue = [];
  score = 0;
  level = 1;
  intervalMs = BASE_INTERVAL;
  paused = false;
  gameOver = false;
  // zrno vygeneruj tak, aby nepřeklopilo na startovní pozici hada
  food = vygenerujZrno();
  // pokud by (zřídka) padlo na tělo hada, generuj znovu
  let pokus = 0;
  while (snake.some((s) => s.x === food.x && s.y === food.y) && pokus < 10) {
    food = vygenerujZrno();
    pokus++;
  }

  aktualizujStat();
  vykresli();
  pokazHry(false);
  lastTime = performance.now();
}

// ==== Hlavní animace ====

// Řídí tempo kroků podle intervalMs přes requestAnimationFrame.
function krokAnimace() {
  const ted = performance.now();
  if (!paused && !gameOver && ted - lastTime >= intervalMs) {
    lastTime = ted;
    krok();
  }
  if (!gameOver) {
    rafId = requestAnimationFrame(krokAnimace);
  } else {
    rafId = null;
  }
}

// ==== Ovládání ====

// Mapuje názvy směrů na vektory.
const SMERY = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

// Klávesové ovládání — šipky i WASD.
function naKlavesy(e) {
  const klice = e.key.toLowerCase();
  let smér = null;

  // šipky
  if (e.key === "ArrowUp") smér = "up";
  else if (e.key === "ArrowDown") smér = "down";
  else if (e.key === "ArrowLeft") smér = "left";
  else if (e.key === "ArrowRight") smér = "right";
  // WASD
  else if (klice === "w") smér = "up";
  else if (klice === "s") smér = "down";
  else if (klice === "a") smér = "left";
  else if (klice === "d") smér = "right";

  // mezerník / P = pauza nebo pokračování
  if (e.key === " " || klice === "p") {
    if (gameOver) return;
    if (paused) pokracuj();
    else pauza();
    e.preventDefault();
    return;
  }

  // R = nová hra (kdykoliv kromě běžícího běhu — po restartu se hra rozběhne)
  if (klice === "r") {
    restart();
    // restart přepne gameOver=false; zajistí se animace, pokud neběží
    if (!rafId) rafId = requestAnimationFrame(krokAnimace);
    return;
  }

  if (smér) {
    if (gameOver) return;
    if (paused) return;
    zadamSměr(SMERY[smér]);
    e.preventDefault();
  }
}

function prerazRejst(jmeno) {
  // volání z tlačítek a D-padu
  if (gameOver) return;
  if (paused) return;
  zadamSměr(SMERY[jmeno]);
}

// ==== Spojení událostí ====
document.addEventListener("keydown", (e) => {
  // zabráni scrollu šipkami / mezerou
  if ([" ", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
    e.preventDefault();
  }
  naKlavesy(e);
});

pauseBtn.addEventListener("click", () => {
  if (gameOver) return;
  if (paused) pokracuj();
  else pauza();
});

overlayBtn.addEventListener("click", () => {
  if (gameOver) {
    restart();
    rafId = requestAnimationFrame(krokAnimace);
  } else if (paused) {
    pokracuj();
  }
});

restartBtn.addEventListener("click", () => {
  restart();
  if (!rafId) rafId = requestAnimationFrame(krokAnimace);
});

// D-pad (směrová tlačítka)
document.querySelectorAll(".dpad").forEach((btn) => {
  btn.addEventListener("click", () => prerazRejst(btn.dataset.dir));
});

// ==== Spouštění ====
document.addEventListener("DOMContentLoaded", () => {
  best = nactiRekord();
  restart();
  rafId = requestAnimationFrame(krokAnimace);
});
