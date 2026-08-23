// ====== Miny — logika hry (velké hrací pole) ======
// Hrám se na velké mřížce 30x20 (600 polí) s 80 minami.
// První klik je vždy bezpečný a buňky se odhalují kaskádově naprázdno.
// Pravo tlačítko staví vlajky; klik na odhalené číslo s kompletním počtem vlajek
// odhalí všechny zbývající sousedy (tzv. chord).

// ---- Pět volitelných velikostí hracího pole (sloupce × řádky, počet min) ----
const VELIKOSTI = [
  { nazev: "Malá", cols: 9, rows: 9, miny: 10 },
  { nazev: "Střední", cols: 12, rows: 12, miny: 20 },
  { nazev: "Velká", cols: 16, rows: 12, miny: 30 },
  { nazev: "Xtra", cols: 20, rows: 14, miny: 45 },
  { nazev: "Max", cols: 24, rows: 16, miny: 60 },
];

// aktivní velikost — index do pole VELIKOSTI (výchozí: Velká)
let velkostIdx = 2;
// rozměry a počet min aktuální velikosti — mění se při přepnutí velikosti
let COLS;
let ROWS;
let POCT_MIN;

// ==== Globální stav hry ====
let mridka;      // 2D pole buněk: {mina, cislo, opened, flag}
let zacataHra;   // zda se hra již začala (pro startování časoměru)
let konecHry;    // zda hra skončila (výhra nebo prohry)
let celkemBunek; // celkový počet buněk — přepočítá se při změně velikosti
let zbujikuOtevreno; // počet odhalených buněk (podmínka výhry)
let secCas;         // běhající čas v sekundách
let casTimer;       // identifikátor intervalu časoměru

// Režim práce — "reveal" (odkrývat) nebo "flag" (vlajky); hlavně pro dotyk
let rezim = "reveal";

// ==== Odkazy na DOM prvky ====
const board = document.getElementById("board");
const minesLeftEl = document.getElementById("minesLeft");
const timerEl = document.getElementById("timer");
const faceBtn = document.getElementById("faceBtn");
const overlay = document.getElementById("overlay");
const overlayText = document.getElementById("overlayText");
const overlayBtn = document.getElementById("overlayBtn");
const revealModeBtn = document.getElementById("revealModeBtn");
const flagModeBtn = document.getElementById("flagModeBtn");
// kontejner s tlačítky výběru velikosti pole
const sizeBar = document.getElementById("sizeBar");

// ==== Pomocné: souřadnice a sousedi ====

// Vrátí pole sousedních (včetně diagonál) buněk uvnitř mřížky.
function sousedi(x, y) {
  const vysledky = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      // přeskakuje samotnou buňku (dx=0 a dy=0)
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < COLS && ny >= 0 && ny < ROWS) {
        vysledky.push(mridka[ny][nx]);
      }
    }
  }
  return vysledky;
}

// ==== Výstava hracího pole ====

// Vytvoří DOM buňky do CSS mřížky. Velikost buněk je pevná a stejná pro všechny úrovně —
// bere se z šířky hlavního sloupce dělené počtem sloupců Max pole, takže menší pole jsou jen
// užší (vycentrovaná), ale jejich buňky mají vždy stejnou velikost jako na Max.
function vykresliPole() {
  board.innerHTML = "";
  // referenční kontejner s plnou dostupnou šířkou (hlavní sloupec)
  const ref = document.querySelector(".miny-main") || board.parentElement;
  const dostupnaSirka = ref ? ref.clientWidth : board.clientWidth;
  // počet sloupců největšího pole určuje rozměr jedné buňky
  const maxCols = Math.max(...VELIKOSTI.map((v) => v.cols));

  // skutečné rozměry ohraničení a mezery pole — aby výpočet seděl i při světlém motivu a na mobilu
  const cs = getComputedStyle(board);
  const padL = parseFloat(cs.paddingLeft) || 0;
  const padR = parseFloat(cs.paddingRight) || 0;
  const borL = parseFloat(cs.borderLeftWidth) || 0;
  const borR = parseFloat(cs.borderRightWidth) || 0;
  const mezera = parseFloat(cs.columnGap) || parseFloat(cs.rowGap) || parseFloat(cs.gap) || 3;
  // celková šířka "ne-buněčného" prostoru: ohraničení + mezery mezi sloupci
  const chrome = padL + padR + borL + borR + (maxCols - 1) * mezera;

  // velikost buňky tak, aby Max pole přesně vešlo do dostupné šířky
  let cellSize = Math.floor((dostupnaSirka - chrome) / maxCols);
  // horní hranice, aby buňky nebyly na velkých obrazovkách přexlované
  cellSize = Math.min(cellSize, 34);
  // dolní hranice jen proti nulové/negativní hodnotě, bez nutného přelévání
  cellSize = Math.max(cellSize, 10);

  // pevná velikost sloupce v px — všechny úrovně mají stejně velké buňky
  board.style.gridTemplateColumns = `repeat(${COLS}, ${cellSize}px)`;
  // uložení do CSS proměnné, aby se dala upravit i velikost písma buňky
  board.style.setProperty("--cell-size", cellSize + "px");

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

// Aktualizuje vzhled jedné buňky podle jejího stavu.
function refreshCell(x, y) {
  const c = mridka[y][x];
  const el = cellElement(x, y);
  // vynuluje stavy buňky a podle stavu obnoví jednotlivé třídy
  el.classList.remove("open", "flagged", "mine", "boom", "wrong");
  for (let i = 1; i <= 8; i++) el.classList.remove("n" + i);
  el.textContent = "";

  // odhalená buňka — podle typu obsahu
  if (c.opened) {
    el.classList.add("open");
    // mina — zobrazená s odleskem; trefená (boom) je zvýrazněná
    if (c.mina) {
      el.classList.add("mine");
      el.textContent = "💣";
      if (c.boom) el.classList.add("boom");
    } else if (c.cislo > 0) {
      // číslo sousedních min a barevná třída n1..n8
      el.textContent = c.cislo;
      el.classList.add("n" + c.cislo);
    }
  }

  // vlajka — na zavřené buňce; chybná vlajka (na prohře) se zobrazí jako křížek
  if (c.flag && !c.opened) {
    el.classList.add("flagged");
    if (c.omyleno) {
      el.classList.add("wrong");
      el.textContent = "❌";
    } else {
      el.textContent = "🚩";
    }
  }
}

// Projde celé pole a obnoví vzhled všechny buněky (po prohře / výhrách).
function refreshVse() {
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      refreshCell(x, y);
    }
  }
}

// Aktualizuje odpočítavač min (zbývá celkem - vlajky).
function aktualizujMiny() {
  let vlajky = 0;
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (mridka[y][x].flag) vlajky++;
    }
  }
  const zbujiky = POCT_MIN - vlajky;
  // odpočítavač dovolí záporné hodnoty, ať se hráč dozví na stav
  minesLeftEl.textContent = zbujiky;
}

// Aktualizuje časoměr v HUD.
function aktualizujCas() {
  timerEl.textContent = secCas;
}

// ==== Časoměr ====

// Spustí časoměr (přesně jednou na hru) — běží do konce hry.
function startujCasomer() {
  if (casTimer) return; // už běží
  casTimer = setInterval(() => {
    secCas++;
    aktualizujCas();
  }, 1000);
}

// Zastaví časoměr a vyčistí identifikátor.
function stopniCasomer() {
  if (casTimer) {
    clearInterval(casTimer);
    casTimer = null;
  }
}

// ==== Generování pole ====

// Přideje miny do mřížky.
// parametry:
//   poleVynechat — pole, které je třeba nechat volné (první klik a jeho okolí)
function generujMiny(poleVynechat) {
  // vytvoří seznam indexů všech polí kromě vynechaných (první klik = safe)
  const kandidati = [];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (poleVynechat.includes(y * COLS + x)) continue;
      kandidati.push(x + "," + y);
    }
  }

  // mícháme seznam (Fisher-Yates) a vezmeme první POCT_MIN jako miny
  for (let i = kandidati.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [kandidati[i], kandidati[j]] = [kandidati[j], kandidati[i]];
  }
  for (let i = 0; i < POCT_MIN; i++) {
    const [xs, ys] = kandidati[i].split(",").map(Number);
    mridka[ys][xs].mina = true;
  }

  // vypočet čísel — počet min v sousedních polích
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (mridka[y][x].mina) continue;
      mridka[y][x].cislo = sousedi(x, y).filter((s) => s.mina).length;
    }
  }
}

// ==== Hrací operace ====

// Zkontroluje, zda je hra ještě aktivní (nejsme v pauze a hra ještě běží).
function aktivni() {
  return !konecHry;
}

// Odhalí buňku a (pokud je naprázdno) rekurezivně všechny sousedy (flood fill).
// Pokud hráč narazí na minu, hra skončí a zobrazí se všechny miny.
function odhalBufky(x, y) {
  const c = mridka[y][x];
  if (c.opened || c.flag) return;

  // pokud hráč na minu narazí — výbuch (konec hry)
  if (c.mina) {
    c.opened = true;
    c.boom = true;
    refreshCell(x, y);
    konecHryProhra();
    return;
  }

  // odhalí buňku
  c.opened = true;
  refreshCell(x, y);
  zbujikuOtevreno++;

  // prázdná buňka (bez min kolem) se rozšíří na sousedy
  if (c.cislo === 0) {
    for (const [sx, sy] of sousediXY(x, y)) {
      if (!mridka[sy][sx].opened) {
        odhalBufky(sx, sy);
      }
    }
  }
}

// Vrátí pole souřadnic sousedů (pouze platné, v rozsahu mřížky).
function sousediXY(x, y) {
  const vysledky = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < COLS && ny >= 0 && ny < ROWS) {
        vysledky.push([nx, ny]);
      }
    }
  }
  return vysledky;
}

// Staví nebo odstraňuje vlajku na buňce (bezpečné na zavřené buňce).
function vlajkuj(x, y) {
  if (!aktivni()) return;
  const c = mridka[y][x];
  if (c.opened) return;
  c.flag = !c.flag;
  refreshCell(x, y);
  aktualizujMiny();
}

// Chord: klik na odhalené číslo — pokud všechny miny v okolí jsou označeny vlajkami,
// odhalí se zbývající sousedé.
function chord(x, y) {
  if (!aktivni()) return;
  const c = mridka[y][x];
  // chord funguje jen u odhalených buněk s číslem
  if (!c.opened || c.cislo === 0) return;

  const s = sousediXY(x, y);
  const vlajky = s.filter(([sx, sy]) => mridka[sy][sx].flag).length;
  // pokud počet vlajek nesedí s číslem — nekončíme
  if (vlajky !== c.cislo) return;

  // odhalíme všechny neoznačené sousedy
  let trefilMinu = false;
  for (const [sx, sy] of s) {
    if (mridka[sy][sx].flag) continue;
    if (mridka[sy][sx].mina) {
      trefilMinu = true;
      mridka[sy][sx].opened = true;
      mridka[sy][sx].boom = true;
      refreshCell(sx, sy);
    } else if (!mridka[sy][sx].opened) {
      odhalBufky(sx, sy);
    }
  }
  if (trefilMinu) {
    konecHryProhra();
  } else {
    zkontrolujVyhrav();
  }
}

// ==== Stav hry ====

// Zkontroluje, zda hráč odkryl všechny ne-minové buňky (výhra).
function zkontrolujVyhrav() {
  if (zbujikuOtevreno === celkemBunek - POCT_MIN) {
    konecHryVyhra();
  }
}

// Přepne hru do stavu prohry a odhalí všechny miny.
function konecHryProhra() {
  konecHry = true;
  stopniCasomer();
  faceBtn.textContent = "😵";

  // odhalí všechny miny; špatně označené buňky označíme jako chybné (❌ zobrazí refreshCell)
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const c = mridka[y][x];
      if (c.mina) {
        c.opened = true; // mina se vždy prozradí, i když nebyla vlajkovaná
      } else if (c.flag) {
        c.omyleno = true; // vlajka na prázdné buňce = chyba
      }
    }
  }
  refreshVse();

  overlayText.textContent = "Trefili jste minu — konec hry";
  pokazHry(true);
}

// Přepne hru do stavu výhry a automaticky označí zbývající miny vlajkami.
function konecHryVyhra() {
  konecHry = true;
  stopniCasomer();
  faceBtn.textContent = "😎";

  // automaticky postaví vlajku na každé minově buňce
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const c = mridka[y][x];
      if (c.mina && !c.flag) {
        c.flag = true;
      }
    }
  }
  refreshVse();
  aktualizujMiny();

  overlayText.textContent = `Výhra za ${secCas}s!`;
  overlayBtn.textContent = "Hrát znovu";
  pokazHry(true);
}

// Zobrazení nebo skrytí překryvu stavu.
function pokazHry(zobrazit) {
  overlay.hidden = !zobrazit;
}

// ==== První klik — bezpečný začátek ====
// První odhalení nikdy netrefí minu a zaručí minimálně 3x3 volnou zónu.
function praviPrvKlik(x, y) {
  // pole, které je třeba nechat bez miny: kliknutá buňka + její sousedi
  const vynechat = [y * COLS + x];
  for (const [sx, sy] of sousediXY(x, y)) {
    vynechat.push(sy * COLS + sx);
  }
  generujMiny(vynechat);
  // poté normálně odhalíme
  zacataHra = true;
  startujCasomer();
  odhalBufky(x, y);
  zkontrolujVyhrav();
}

// ==== Klikací ovládání ====
// Najde buňku, na kterou bylo kliknuto (delegace na board → e.target je buňka).
function clickedCell(e) {
  const el = e.target.closest(".cell");
  if (!el) return null;
  return { x: Number(el.dataset.x), y: Number(el.dataset.y) };
}

function klikBunky(e) {
  if (!aktivni()) return;
  const hit = clickedCell(e);
  if (!hit) return;
  const { x, y } = hit;
  const c = mridka[y][x];

  // pravé tlačítko je zpracovávané v contextmenu (nezavádíme doubleclick sem)
  // dále rozlišující režim (dotyk) a normální levé kliknutí
  if (rezim === "flag") {
    vlajkuj(x, y);
    return;
  }

  // první klik — bezpečné zahájení
  if (!zacataHra) {
    praviPrvKlik(x, y);
    return;
  }

  // buňka s vlajkou — nemůže být odhalena
  if (c.flag) return;

  // už odhalená buňka → pokusíme se chord (rychlé odkrytí sousedů)
  if (c.opened) {
    chord(x, y);
    return;
  }

  // normální odhalení zavřené buňky
  odhalBufky(x, y);
  zkontrolujVyhrav();
}

// Pravé tlačítko myši — staví vlajku.
function pravKlik(e) {
  e.preventDefault();
  if (!aktivni()) return;
  const hit = clickedCell(e);
  if (!hit) return;
  vlajkuj(hit.x, hit.y);
}

// Dvojklik = chord (pokud je buňka již odhalená s číslem).
function dvojklikBunky(e) {
  if (!aktivni()) return;
  const hit = clickedCell(e);
  if (!hit) return;
  chord(hit.x, hit.y);
}

// ==== Přepínač režimu (odkrývat / vlajky) ====
function nastavRezim(novy) {
  rezim = novy;
  // aktivní tlačítko zvýrazní
  revealModeBtn.classList.toggle("active", novy === "reveal");
  flagModeBtn.classList.toggle("active", novy === "flag");
}

revealModeBtn.addEventListener("click", () => nastavRezim("reveal"));
flagModeBtn.addEventListener("click", () => nastavRezim("flag"));

// ==== Výběr velikosti hracího pole ====
// Přepne aktivní velikost: uloží rozměry i počet min a spustí novou hru.
function nastavVelkost(idx) {
  velkostIdx = idx;
  COLS = VELIKOSTI[idx].cols;
  ROWS = VELIKOSTI[idx].rows;
  POCT_MIN = VELIKOSTI[idx].miny;
  celkemBunek = COLS * ROWS;
  // zvýrazní aktivní tlačítko velikosti
  const tlacitka = sizeBar.querySelectorAll(".size-btn");
  tlacitka.forEach((t, i) => t.classList.toggle("active", i === idx));
  // změna velikosti vždy znamená novou hru s čistou mřížkou
  novaHra();
}

// Vytvoří tlačítka velikostí do lišty a napojí jejich kliknutí.
function vygenerujTlacitkaVelkosti() {
  VELIKOSTI.forEach((v, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "size-btn";
    btn.textContent = v.nazev;
    btn.title = `${v.cols} × ${v.rows} (${v.miny} min)`;
    btn.addEventListener("click", () => nastavVelkost(i));
    sizeBar.appendChild(btn);
  });
}

// ==== Nová hra ====
function novaHra() {
  // vyčisti časoměr a stav
  stopniCasomer();
  secCas = 0;
  zbujikuOtevreno = 0;
  zacataHra = false;
  konecHry = false;
  faceBtn.textContent = "🙂";

  // nová mřížka — zatím bez min (miny se vygenerují při prvním kliku)
  mridka = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({
      mina: false,
      cislo: 0,
      opened: false,
      flag: false,
    }))
  );

  vykresliPole();
  // buňky jsou zatím všechny zavřené; při vykreslení je načteme čisté
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      refreshCell(x, y);
    }
  }
  aktualizujMiny();
  aktualizujCas();
  pokazHry(false);
}

faceBtn.addEventListener("click", novaHra);
overlayBtn.addEventListener("click", novaHra);

// ==== Spouštění ====
document.addEventListener("DOMContentLoaded", () => {
  // nastaví rozměry a počet min podle výchozí velikosti (Velká)
  COLS = VELIKOSTI[velkostIdx].cols;
  ROWS = VELIKOSTI[velkostIdx].rows;
  POCT_MIN = VELIKOSTI[velkostIdx].miny;
  celkemBunek = COLS * ROWS;
  // vygeneruje tlačítka velikostí a zvýrazní aktivní
  vygenerujTlacitkaVelkosti();
  const tlacitka = sizeBar.querySelectorAll(".size-btn");
  tlacitka.forEach((t, i) => t.classList.toggle("active", i === velkostIdx));

  novaHra();

  // delegace událostí na board — vydrží i při vyměněných buňkách
  board.addEventListener("click", klikBunky);
  board.addEventListener("contextmenu", pravKlik);
  board.addEventListener("dblclick", dvojklikBunky);
});
