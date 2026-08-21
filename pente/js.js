// ====== PIŠKVORKY — logika hry (5 do řady na poli 30 × 20) ======
// Hrají se na mřížce 30 × 20 = 600 polí, stejný rozměr jako u min.
// Hráč (X) sahá první, počítač (O) odpovídá.
// Vyhraje, kdo první spojí 5 kuliček v jedné linii (vodorovně, svisle, diagonálně).

// ---- Rozmery mřížky a cílová délka řady pro výhru ----
const COLS = 30;
const ROWS = 20;
const CIL_VYHRY = 5; // 5 kuliček v řadě = výhra
const VLASTNIK_HRA = 1; // hráč (X)
const VLASTNIK_PC = 2;  // počítač (O)

// ==== Globální stav hry ====
let mridka;    // 2D pole: 0 = prázdné, 1 = hráč, 2 = počítač
let konecHry;  // zda hra skončila (výhra / remíza)
let tah;       // v pořadí tah hráče, 2 = tah počítače
let skoreHra = 0; // počet vyhraných her hráčem
let skorePc = 0;  // počet vyhraných her počítačem

// ==== Odkazy na DOM prvky ====
const board = document.getElementById("board");
const moveCountEl = document.getElementById("moveCount");
const scoreXEl = document.getElementById("scoreX");
const scoreOEl = document.getElementById("scoreO");
const faceBtn = document.getElementById("faceBtn");
const turnBar = document.getElementById("turnBar");
const overlay = document.getElementById("overlay");
const overlayText = document.getElementById("overlayText");
const overlayBtn = document.getElementById("overlayBtn");

// ==== Vykreslení hracího pole ====

// Vytvoří DOM buňky do CSS mřížky se 30 sloupců.
function vykresliPole() {
  board.innerHTML = "";
  // minmax(0,1fr) — sloupce se rovnoměrně rozloží do šířky, žádné přelévání
  board.style.gridTemplateColumns = `repeat(${COLS}, minmax(0, 1fr))`;
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
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
  return board.children[y * COLS + x];
}

// Přepíše vzhled одной buňky podle jejího stavu.
function refreshCell(x, y) {
  const c = mridka[y][x];
  const el = cellElement(x, y);
  // odstraní stavy (zbytky z případné zvýrazněné výhry)
  el.classList.remove("x", "o", "win");
  el.textContent = "";

  // prázdná buňka — nic nezobrazeno
  if (c === 0) return;

  // kulička hráče (X)
  if (c === VLASTNIK_HRA) {
    el.textContent = "\u2715"; // ✕
    el.classList.add("x");
  }
  // kulička počítače (O)
  else if (c === VLASTNIK_PC) {
    el.textContent = "\u2299"; // ⊙
    el.classList.add("o");
  }
}

// Projde celou mřížku a obnoví vzhled všech buněk.
function refreshVse() {
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      refreshCell(x, y);
    }
  }
}

// ==== Ovládání HUD ====

// Nastaví text a barvu lišty tahu podle toho, kdo hraje.
function nastaviTah(tahHrade) {
  turnBar.innerHTML = tahHrade
    ? '<span class="dot dot-x"></span> Hrajete vy — postavte ✕'
    : '<span class="dot dot-o"></span> Počítač — sahá ⊙';
}

// Aktualizuje ukazatele v HUD (tah, skóre).
function aktualizujSkore() {
  scoreXEl.textContent = skoreHra;
  scoreOEl.textContent = skorePc;
  moveCountEl.textContent = tah === VLASTNIK_HRA ? "Vy" : "Počítač";
}

// ==== Kontrola výhry ====

// 4 směry řady — vodorovně, svisle, oba diagonály
const SMERY = [[1, 0], [0, 1], [1, 1], [1, -1]];

// Najde, pokud je v mřížce řada CIL_VYHRY kuliček téhož vlastníka.
// Vrátí { vlastnik, pozice:[..] }, jinak null.
function zkontrolujVyhry() {
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const vlastnik = mridka[y][x];
      if (vlastnik === 0) continue;

      // zkusí každý směr
      for (const [dx, dy] of SMERY) {
        let pocet = 1;
        const pozice = [[x, y]];
        // jde do směru, dokud se nezmění vlastník
        for (let i = 1; i < CIL_VYHRY; i++) {
          const nx = x + dx * i;
          const ny = y + dy * i;
          // hranice pole nebo jiný vlastník = konec řady
          if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) break;
          if (mridka[ny][nx] !== vlastnik) break;
          pozice.push([nx, ny]);
          pocet++;
        }
        // výhra, pokud se podařilo dosáhnout CIL_VYHRY
        if (pocet >= CIL_VYHRY) {
          return { vlastnik, pozice };
        }
      }
    }
  }
  return null;
}

// Zkontroluje remízu (všechna pole jsou obsazena).
function zkontrolujRemizu() {
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (mridka[y][x] === 0) return false;
    }
  }
  return true;
}

// ==== Závěr hry ====

// Skončí hru s výhrou — poznamená pětice a zobrazí přehozené obraz.
function konecHryVyhra(vlastnik, pozice) {
  konecHry = true;

  // poznamená buňky, které tvoří výherní pětici
  pozice.forEach(([x, y]) => {
    cellElement(x, y).classList.add("win");
  });

  // přepíše text a obličej
  if (vlastnik === VLASTNIK_HRA) {
    skoreHra++;
    faceBtn.textContent = "\u{1F60E}"; // 😎
    overlayText.textContent = "Vyhráváte!";
  } else {
    skorePc++;
    faceBtn.textContent = "\u{1F615}"; // 😵
    overlayText.textContent = "Počítač vyhrál.";
  }
  aktualizujSkore();
  overlay.hidden = false;
}

// Skončí hru s remízou (pole je plné).
function konecHryRemizu() {
  konecHry = true;
  faceBtn.textContent = "\u{1F610}"; // 😐
  overlayText.textContent = "Remíza — pole je plné.";
  aktualizujSkore();
  overlay.hidden = false;
}

// ==== Klikací ovládání hráče ====

// Vrací {x,y}, pokud klikl na buňku; jinak null.
function clickedCell(e) {
  const el = e.target.closest(".cell");
  if (!el) return null;
  return { x: Number(el.dataset.x), y: Number(el.dataset.y) };
}

// Klik hráče — zkontroluje stav, položí kuličku a předá tah počítači.
function klikHrade(e) {
  // reaguje jen tehdy, pokud hra běží a je na tahu hráč
  if (konecHry || tah !== VLASTNIK_HRA) return;

  const hit = clickedCell(e);
  if (!hit) return;

  // buňka je již obsazená — ignorovat
  if (mridka[hit.y][hit.x] !== 0) return;

  // hráč položí kuličku
  mridka[hit.y][hit.x] = VLASTNIK_HRA;
  refreshCell(hit.x, hit.y);

  // kontrola výhry hráče
  const vyhry = zkontrolujVyhry();
  if (vyhry) {
    konecHryVyhra(vyhry.vlastnik, vyhry.pozice);
    return;
  }
  // kontrola remízy
  if (zkontrolujRemizu()) {
    konecHryRemizu();
    return;
  }

  // předá tah počítači s krátkou pauzou (aby působilo, že si rozmyslí)
  tah = VLASTNIK_PC;
  nastaviTah(false);
  aktualizujSkore();
  setTimeout(tahPC, 350);
}

// ==== Počítač (AI) ====
// Silná heuristika pro piškvorky (5 do řady):
//   1. Kandidáti jsou všechny prázdné buňky ve vzdálenosti 2 od jakékoliv
//      kuličky (na začátku je pole prázdné, takže se vezme střed).
//   2. Každý kandidát se hodnocí po 4 směrech: délka spojitých vlastníků
//      + počet volných konců → otevřená/uzavřená čtyřka, trojka, dvojka apod.
//   3. Celková hodnota tahu = útocná hodnota (co postavi poctac) +
//      obranná hodnota (co by na tom poli postavil hra — tedy co je třeba
//      blokować). Výhodný tah vyhraje (velmi vysoká hodnota), poté se brání
//      proti soupeřově hrozbě a teprve pak se budují slabší útvary.

// Hody patternů — řázené od nejsilnějšího po nejméně důležitý.
const HODN = {
  PETKA: 1e9,             // 5 do řady — okamžitá výhra/prohra
  OTEVRENA_CTYRKA: 1e7,   // 4 s dvama volnými konci — neútočitelné
  UZAVRENA_CTYRKA: 1e6,   // 4 s jedním volným — soupeř musí blokovat
  OTEVRENA_TROJKA: 1e5,   // 3 s dvoma konci — hrozí otevřená čtyřka
  UZAVRENA_TROJKA: 1e4,   // 3 s jedním koncem — slabší hrozba
  OTEVRENA_DVOJKA: 1e3,   // 2 s dvoma konci — základ budoucí hrozby
};

// Hodnotí položení kuličky vlastníka do (x,y) ve všech 4 směrech.
// Pro každý směr spočítá délku spojitého úseku a volné konce a přičte hodnotu.
function hodnoutKrok(x, y, vlastnik) {
  let celkem = 0;
  for (const [dx, dy] of SMERY) {
    let delka = 1;
    let konceVolne = 0;

    // sken do „odstupu" směru — spočitá vlastníky a zkontroluje konec
    for (const poz of [-1, 1]) {
      let i = 1;
      while (true) {
        const nx = x + dx * i * poz;
        const ny = y + dy * i * poz;
        // hranice pole = konec úseku (ne volné konečný)
        if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) break;
        if (mridka[ny][nx] === vlastnik) {
          delka++;
          i++;
          continue;
        }
        // prázdná = volný konec; cizí = uzavřený konec
        if (mridka[ny][nx] === 0) konceVolne++;
        break;
      }
    }

    // přičte hodnotu podle délky a poctu volných konců
    if (delka >= CIL_VYHRY) celkem += HODN.PETKA;
    else if (delka === 4) celkem += konceVolne === 2 ? HODN.OTEVRENA_CTYRKA : HODN.UZAVRENA_CTYRKA;
    else if (delka === 3) celkem += konceVolne === 2 ? HODN.OTEVRENA_TROJKA : HODN.UZAVRENA_TROJKA;
    else if (delka === 2 && konceVolne === 2) celkem += HODN.OTEVRENA_DVOJKA;
  }
  return celkem;
}

// Vrátí všechny prázdné buňky ve vzdálenosti 2 od některé kuličky.
// Pokud je pole úplně prázdné, vrátí jen střed.
function kandidati() {
  const kandidatovi = new Set();
  let maKulik = false;
  const pridat = (x, y) => kandidatovi.add(y * COLS + x);

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (mridka[y][x] === 0) continue;
      maKulik = true;
      // přidá 5×5 oblast kolem kuličky (vzdálenost 2)
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) continue;
          if (mridka[ny][nx] === 0) pridat(nx, ny);
        }
      }
    }
  }

  // prázdné pole — jediné rozumné položení je střed
  if (!maKulik) return [Math.floor(ROWS / 2) * COLS + Math.floor(COLS / 2)];

  return [...kandidatovi];
}

// Vybere nejlepší tah pro daného vlastníka.
// Celková hodnota = útok + 0.9 * obrana, takže vlastní výhra váží největší,
// pak blok soupeřovy výhry a teprve pak budování vlastních útvarů.
function vyberTah(vlastnik) {
  const rival = vlastnik === VLASTNIK_PC ? VLASTNIK_HRA : VLASTNIK_PC;
  let nejLepsi = null;
  let nejLepsiHodnota = -1;

  for (const index of kandidati()) {
    const x = index % COLS;
    const y = Math.floor(index / COLS);
    // útok = co postavi vlastnik; obrana = co by tu postavil rival
    const ukot = hodnoutKrok(x, y, vlastnik);
    const obrana = hodnoutKrok(x, y, rival);
    const hodnota = ukot + 0.9 * obrana;
    if (hodnota > nejLepsiHodnota) {
      nejLepsiHodnota = hodnota;
      nejLepsi = { x, y };
    }
  }
  // fallback (může nastat jen při prázdném poli) — střed
  return nejLepsi || { x: Math.floor(COLS / 2), y: Math.floor(ROWS / 2) };
}

// Tah počítače — vybere nejlepší pozici, položí kuličku a vrátí tok hry.
function tahPC() {
  const pozice = vyberTah(VLASTNIK_PC);
  mridka[pozice.y][pozice.x] = VLASTNIK_PC;
  refreshCell(pozice.x, pozice.y);

  // kontrola výhry / remízy po tahu počítače
  const vyhry = zkontrolujVyhry();
  if (vyhry) {
    konecHryVyhra(vyhry.vlastnik, vyhry.pozice);
    return;
  }
  if (zkontrolujRemizu()) {
    konecHryRemizu();
    return;
  }

  // vrátí tah hráči
  tah = VLASTNIK_HRA;
  nastaviTah(true);
  aktualizujSkore();
}

// ==== Nová hra ====
function novaHra() {
  konecHry = false;
  tah = VLASTNIK_HRA;
  // vynuluje mřížku (všechna pole prázdná)
  mridka = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => 0)
  );

  vykresliPole();
  refreshVse();
  nastaviTah(true);
  aktualizujSkore();
  overlay.hidden = true;
  faceBtn.textContent = "\u{1F642}"; // 🙂
}

faceBtn.addEventListener("click", novaHra);
overlayBtn.addEventListener("click", novaHra);

// ==== Spuštění ====
document.addEventListener("DOMContentLoaded", () => {
  novaHra();
  board.addEventListener("click", klikHrade);
});
