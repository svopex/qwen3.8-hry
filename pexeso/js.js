// ====== Karetní pexeso — logika hry ======
// Na poli leží karty rubem dolů; hráč je odvrací po dvou. Pokud se symboly
// shodují, dvojice zůstane odkrytá a hráč pokračuje; jinak se karty po chvíli
// otočí zpět. Vyhrává, kdo najde všechny dvojice co nejméně tahy.
//
// Hráč si může vybrat velikost pole (4×4, 5×5, 6×6). Každou hru se náhodně
// vybere jedna ze čtyř sad symbolů, takže se hra vždy liší. U lichého počtu
// karet (5×5) obsadí pole o jednu buňku méně — zbývá prázdné místo.
//
// Vykreslení karet používá 3D otočení (rotateY) přes CSS přechod; líce i rub
// jsou dvě vrstvy uvnitř karty, které se překrývají a podle otočení se zobrazí.

// ---- Čtyři sady symbolů (každá má 18 různých znaků, stačí i na 6×6) ----
const SADY = [
  // sada 1 — ovoce a zelenina
  ["🍎", "🍌", "🍇", "🍓", "🥕", "🌽", "🍄", "🐞", "🍊", "🍑", "🍒", "🥝", "🍉", "🥑", "🌶️", "🫑", "🍅", "🥦"],
  // sada 2 — zvířata
  ["🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯", "🦁", "🐮", "🐷", "🐸", "🐵", "🦄", "🐔", "🐧"],
  // sada 3 — příroda a počasí
  ["🌞", "🌙", "⭐", "☁️", "🌧️", "❄️", "🌈", "🌊", "🏔️", "🌋", "🌳", "🌲", "🌴", "🌹", "🌷", "🌻", "🍂", "🪨"],
  // sada 4 — sport a volný čas
  ["⚽", "🏀", "🏈", "⚾", "🎾", "🏐", "🎱", "🎯", "🎳", "🥏", "🏓", "🏸", "🛹", "🎿", "⛳", "🎣", "🚴", "🏒"],
];

// ---- Počet karet pro jednotlivé velikosti pole (strana × strana) ----
const VELIKOSTI = { 4: 16, 5: 25, 6: 36 };

// ---- Kód úlohy pro ukládání rekordu do localStorage (odlišný pro každou velikost) ----
function klicRekordu(velikost) {
  return "hra-pexeso-rekord-" + velikost;
}

// Doba, po kterou se nesouhlasná dvojice ukazuje, než se otočí zpět (ms).
const DOBA_NESHOUDA = 700;

// ==== Globální stav hry ====
let aktualniVelikost; // zvolená velikost pole (4 / 5 / 6), výchozí 4
let prveKarta;        // první odkrytá karta aktuálního tahu (DOM element) nebo null
let zamykac;          // zámek — během otáčení nesouhlasné dvojice se ignorují kliky
let nalezeno;         // počet nalezených dvojic
let tahy;             // počet provedených tahů (počet odvrácených párů)
let konecHry;         // hra skončila (všechny dvojice nalezeny)
let rekord;           // dosavadní nejlepší výkon pro aktuální velikost, null = žádný

// ==== Odkazy na DOM prvky ====
const pole = document.getElementById("pole");
const tahyEl = document.getElementById("tahy");
const dvojiceEl = document.getElementById("dvojice");
const rekordEl = document.getElementById("rekord");
const restartBtn = document.getElementById("restartBtn");
const overlay = document.getElementById("overlay");
const overlayText = document.getElementById("overlayText");
const overlayBtn = document.getElementById("overlayBtn");
const sizeButtons = Array.from(document.querySelectorAll(".size-btn"));

// ==== Pomocné funkce pro veličky pole ====

// Spočítá počet dvojic pro danou velikost (polovina karet, u lichého pole dolů).
function pocetDvojic(velikost) {
  return Math.floor(VELIKOSTI[velikost] / 2);
}

// Vybere náhodnou sadu symbolů a z ní první `pocet` různých znaků.
function vyberSymboly(pocet) {
  const sada = SADY[Math.floor(Math.random() * SADY.length)];
  return sada.slice(0, pocet);
}

// ==== Výstava hracího pole ====

// Vytvoří jednu kartu: obal s rubem a licem, symbol uloží do datového atributu.
function vytvorKartu(symbol) {
  const karta = document.createElement("div");
  karta.className = "gpex-karta";
  karta.setAttribute("role", "gridcell");
  karta.dataset.symbol = symbol; // symbol pro porovnání dvojice
  karta.tabIndex = 0;            // přístupné klávesnicí
  karta.setAttribute("aria-label", "Zakrytá karta");

  // vnitřní element nese 3D otočení — tím se přepíná rub / líce
  const otocka = document.createElement("div");
  otocka.className = "gpex-otocka";

  // rub karty (zobrazuje se, když je karta zakrytá)
  const rub = document.createElement("div");
  rub.className = "gpex-rub";
  rub.textContent = "❓";

  // líce karty s symbolem (zobrazuje se po odvrácení)
  const lice = document.createElement("div");
  lice.className = "gpex-lice";
  lice.textContent = symbol;

  otocka.append(rub, lice);
  karta.appendChild(otocka);
  return karta;
}

// Vytvoří prázdnou buňku (zachovává rozměr mřížky u lichého počtu karet).
function vytvorPrazdno() {
  const cela = document.createElement("div");
  cela.className = "gpex-prazdno";
  cela.setAttribute("aria-hidden", "true");
  return cela;
}

// Zamíchá pole (Fisher–Yates), aby pořadí karet nebylo předvídatelné.
function zamichat(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Vygeneruje a vykreslí celé pole podle aktuální velikosti v náhodném pořadí.
function vykresliPole() {
  pole.innerHTML = ""; // při výměně obsahu nejprve vyčisti staré karty

  const dvojic = pocetDvojic(aktualniVelikost);
  const symboly = vyberSymboly(dvojic);

  // každý symbol se objeví dvakrát → vytvoříme `dvojic` dvojic
  const sada = [];
  for (const s of symboly) {
    sada.push(s, s);
  }

  // u lichého počtu karet (5×5) doplníme jednu prázdnou buňku
  if (VELIKOSTI[aktualniVelikost] % 2 !== 0) {
    sada.push(null);
  }
  zamichat(sada);

  for (const s of sada) {
    // null značí prázdné místo, jinak vytvoříme hratelnou kartu
    pole.appendChild(s === null ? vytvorPrazdno() : vytvorKartu(s));
  }
}

// Aktualizuje zobrazení tahů, nalezených dvojic a rekordu.
function aktualizujStat() {
  tahyEl.textContent = String(tahy);
  dvojiceEl.textContent = nalezeno + " / " + pocetDvojic(aktualniVelikost);
  rekordEl.textContent = rekord === null ? "–" : String(rekord);
}

// ==== Průběh tahu ====

// Reaguje na kliknutí na kartu: odvrátí ji a při druhém tahu porovná dvojici.
function klikNaKarte(karta) {
  // ignoruje kliky během otáčení zpět, po konci hry a na už odkryté karty
  if (zamykac || konecHry) return;
  if (karta.classList.contains("gpex-odkrita")) return;

  // karta se odvrátí lícem nahoru
  karta.classList.add("gpex-odkrita");
  karta.setAttribute("aria-label", "Odkrytá karta");

  // první karta tahu — zapamatujeme a čekáme na druhou
  if (!prveKarta) {
    prveKarta = karta;
    return;
  }

  // druhá karta tahu — zvedneme počet tahů a porovnáme symboly
  const druha = karta;
  const prve = prveKarta;
  prveKarta = null;
  tahy++;

  // shoda — dvojice zůstává odkrytá, hráč pokračuje
  if (druha.dataset.symbol === prve.dataset.symbol) {
    [prve, druha].forEach((k) => k.classList.add("gpex-spravna"));
    nalezeno++;
  } else {
    // nesoulad — zamezíme dalším tahům, dokud se karty neotočí zpět
    zamykac = true;
    setTimeout(() => {
      [prve, druha].forEach((k) => {
        k.classList.remove("gpex-odkrita");
        k.setAttribute("aria-label", "Zakrytá karta");
      });
      zamykac = false;
    }, DOBA_NESHOUDA);
  }

  aktualizujStat();
  zkontrolujKonec();
}

// ==== Kontrola stavu hry ====

// Po každém tahu ověří, zda hráč našel všechny dvojice.
function zkontrolujKonec() {
  if (nalezeno === pocetDvojic(aktualniVelikost)) {
    konecHry = true;
    zjistiRekord();
    overlayText.textContent = "Všechny dvojice nalezeny za " + tahy + " tahů!";
    overlay.hidden = false;
  }
}

// Uloží nový rekord (nejmenší počet tahů), pokud aktuální výkon je lepší.
function zjistiRekord() {
  if (rekord === null || tahy < rekord) {
    rekord = tahy;
    // ulož do localStorage, aby rekord přežil zavření stránky
    try {
      localStorage.setItem(klicRekordu(aktualniVelikost), String(rekord));
    } catch (e) {
      // localStorage může být nedostupné (např. soukromý režim) — ignoruje
    }
  }
  aktualizujStat();
}

// ==== Nová hra ====

// Inicializuje stav a zahájí novou hru s promíchaným polem a náhodnou sadou.
function novaHra() {
  prveKarta = null;
  zamykac = false;
  nalezeno = 0;
  tahy = 0;
  konecHry = false;

  // nastaví atribut velikosti pole, podle něj se přepočte počet sloupců v CSS
  pole.dataset.velikost = String(aktualniVelikost);

  vykresliPole();
  aktualizujStat();
  overlay.hidden = true;
}

// Načte uložený rekord pro aktuální velikost z localStorage.
function nacitRekord() {
  rekord = null;
  try {
    const ulozene = localStorage.getItem(klicRekordu(aktualniVelikost));
    if (ulozene) rekord = Number(ulozene) || null;
  } catch (e) {
    // při nedostupném localStorage ponecháme null (žádný rekord)
  }
}

// ==== Ovládání ====

// Delegovaně naslouchá klikům na karty (funguje i pro dynamicky vytvořené).
pole.addEventListener("click", (e) => {
  const karta = e.target.closest(".gpex-karta");
  if (karta) klikNaKarte(karta);
});

// Podpora klávesnice: Enter / mezerník na zaměacené kartě odvrátí kartu.
pole.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" && e.key !== " ") return;
  const karta = e.target.closest(".gpex-karta");
  if (karta) {
    e.preventDefault();
    klikNaKarte(karta);
  }
});

restartBtn.addEventListener("click", novaHra);
overlayBtn.addEventListener("click", novaHra);

// Přepne velikost pole: zapamatuje volbu, označí aktivní tlačítko a spustí novou hru.
function zmenaVelikosti(velikost) {
  aktualniVelikost = velikost;
  // vizuálně zvýrazní zvolené tlačítko (aria-pressed řídí i CSS stav)
  sizeButtons.forEach((b) =>
    b.setAttribute("aria-pressed", String(Number(b.dataset.velikost) === velikost))
  );
  nacitRekord(); // načte rekord pro nově zvolenou velikost
  novaHra();     // zahájí novou hru s novou velikostí a náhodnou sadou
}

sizeButtons.forEach((b) => {
  b.addEventListener("click", () => zmenaVelikosti(Number(b.dataset.velikost)));
});

// ==== Spouštění ====
document.addEventListener("DOMContentLoaded", () => {
  // výchozí velikost je 4×4 — nastavíme aktivní tlačítko
  zmenaVelikosti(4);
});
