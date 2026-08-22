// ====== DÁMA — logika hry (mezinárodní dámy na poli 8 × 8) ======
// Hraje se na šachovnici 8 × 8, kameny stojí jen na tmavých polích.
// Hráč (černé kameny) je dole, počítač (bílé kameny) nahoře.
// Pravidla:
//   - obyčejný kámen chodí diagonálně dopředu;
//   - skok přes soupeřův kámen je POVINNÝ;
//   - po skoku stejný kámen musí pokračovat, dokud už dál skočit nemůže;
//   - na poslední řadě se kámen promění v dámu;
//   - dáma kluzem letí libovolně daleko diagonálně (všemi směry);
//   - vyhrává, kdo zničí všechny soupeřovy kameny nebo mu znemožní tah.

// ---- rozměr pole a vlastníci ----
const VELKOST = 8;
const VLASTNIK_HRA = 1; // hráč (černé kameny, dole, sahá nahoru)
const VLASTNIK_PC = 2;  // počítač (bílé kameny, nahoře, sahá dolů)

// ---- hloubka vyhledávání AI (minimax + alfa/beta) ----
const HLOUBKA_AI = 8;

// ==== Globální stav hry ====
let board;        // ploché pole délky 64: null | { o: vlastnik, k: zda dáma }
let tah;          // komu je na tahu (VLASTNIK_HRA / VLASTNIK_PC)
let konecHry;     // zda hra skončila
let tahCislo;     // pořadové číslo tahu (pro HUD)
let skoreHra = 0; // počet vyhraných her hráčem
let skorePc = 0;  // počet vyhraných her počítačem

// ==== Stav interakce s hráčem ====
let vybrany = null;   // [r, c] vybraného kamene hráče, jinak null
let legalniTahy = []; // tahy vybraného kamene (pole objektů move)

// ==== Odkazy na DOM prvky ====
const boardEl = document.getElementById("board");
const moveCountEl = document.getElementById("moveCount");
const scoreHraEl = document.getElementById("scoreHra");
const scorePcEl = document.getElementById("scorePc");
const faceBtn = document.getElementById("faceBtn");
const turnBar = document.getElementById("turnBar");
const overlay = document.getElementById("overlay");
const overlayText = document.getElementById("overlayText");
const overlayBtn = document.getElementById("overlayBtn");

// ==== Pomocné funkce na souřadnice ====

// Zkontroluje, zda je (r,c) uvnitř šachovnice.
function vPoli(r, c) {
  return r >= 0 && r < VELKOST && c >= 0 && c < VELKOST;
}

// Převod 2D souřadnic na index do plochého pole.
function idx(r, c) {
  return r * VELKOST + c;
}

// Vrací true, pokud je políčko tmavé (na tmavých polích se hraje).
function tmavePolicko(r, c) {
  return (r + c) % 2 === 1;
}

// Vrátí kopii boardu (pro minimax — levnější než undo).
function klonBoardu() {
  return board.map((bu) => (bu ? { o: bu.o, k: bu.k } : null));
}

// ==== Generování tahů ====
// Krok: generujeme "celé" tahy (včetně řetězců skoků) jako atomární akce.
// Každý move = { from:[r,c], to:[r,c], captures:[[r,c],...], path:[[r,c],...] }.

// 4 diagonální směry pro dámu (kluz libovolně daleko).
const SMERY_DAMY = [
  [-1, -1], [-1, 1], [1, -1], [1, 1],
];

// Najde okamžité možnosti skoku kamene na (r,c).
// Dáma přeskakuje první soupeřův kámen a může dopadnout na libovolné volné pole za ním.
// Obyčejný kámen skočí přes sousedního soupeře na volné pole hned za ním.
function okamziteSkoky(bd, r, c, jeDama, vlastnik) {
  const vysledky = [];

  if (jeDama) {
    // dáma — kluzem ve všech 4 směrech
    for (const [dr, dc] of SMERY_DAMY) {
      let ir = r + dr, ic = c + dc;
      // projde pole dokud nenarazí na první obsazené pole
      while (vPoli(ir, ic)) {
        const i = idx(ir, ic);
        if (bd[i] !== null) {
          // narazili jsme na první kámen v tomto směru
          // (kámen sebraný dříve v témže tahu se přeskočit nesmí — jen překáží)
          if (bd[i].o !== vlastnik && !bd[i].sebrany) {
            // cizí kámen → můžeme ho přeskakovat a dopadnout na libovolné volné pole za ním
            let jr = ir + dr, jc = ic + dc;
            while (vPoli(jr, jc) && bd[idx(jr, jc)] === null) {
              vysledky.push({ to: [jr, jc], cap: [ir, ic] });
              jr += dr;
              jc += dc;
            }
          }
          break; // další scan tohoto směru nemá smysl (první kámen blokuje)
        }
        ir += dr;
        ic += dc;
      }
    }
  } else {
    // obyčejný kámen — jen dopředu (hráč nahoru = -1, počítač dolů = +1)
    const dr = vlastnik === VLASTNIK_HRA ? -1 : 1;
    for (const dc of [-1, 1]) {
      const cr = r + dr, cc = c + dc;
      if (!vPoli(cr, cc)) continue;
      const ci = idx(cr, cc);
      // skok jen přes cizího souseda (a ne přes dříve sebraný kámen) na volné pole za ním
      if (bd[ci] !== null && bd[ci].o !== vlastnik && !bd[ci].sebrany) {
        const lr = cr + dr, lc = cc + dc;
        if (vPoli(lr, lc) && bd[idx(lr, lc)] === null) {
          vysledky.push({ to: [lr, lc], cap: [cr, cc] });
        }
      }
    }
  }

  return vysledky;
}

// Rekurzivně vybírá všechny řetězce skoků kamene (povinné pokračování).
// Mutuje board (odstraní zničené kameny) a po návratu ho obnoví.
function sbirSkoky(bd, r, c, jeDama, vlastnik, cesta, znicene, vysledky) {
  const moznosti = okamziteSkoky(bd, r, c, jeDama, vlastnik);

  // žádný další skok → tento řetězec je hotový tah
  if (moznosti.length === 0) {
    vysledky.push({
      from: cesta[0],
      to: [r, c],
      captures: znicene.slice(),
      path: cesta.slice(),
    });
    return;
  }

  for (const m of moznosti) {
    const capIdx = idx(m.cap[0], m.cap[1]);
    const zachovanyKamen = bd[capIdx]; // uložíme pro obnovení
    // sebraný kámen z desky nemizí hned — leží dál až do konce tahu a překáží
    // dalším skokům (jinak by dáma mohla přeletět přes vlastní kořist)
    bd[capIdx] = { o: zachovanyKamen.o, k: zachovanyKamen.k, sebrany: true };

    const [nr, nc] = m.to;
    // kámen skutečně dosedne na nové pole, aby v dalších skocích sám sobě překážel
    const cilIdx = idx(nr, nc);
    bd[cilIdx] = { o: vlastnik, k: jeDama };
    // kontrola proměny v dámu — po ní tah končí (mezinárodní pravidlo)
    const promena = !jeDama &&
      ((vlastnik === VLASTNIK_HRA && nr === 0) ||
       (vlastnik === VLASTNIK_PC && nr === VELKOST - 1));

    cesta.push([nr, nc]);
    znicene.push(m.cap);

    if (promena) {
      // kámen se stal dáma — řetězec skoků se ukončuje
      vysledky.push({
        from: cesta[0],
        to: [nr, nc],
        captures: znicene.slice(),
        path: cesta.slice(),
      });
    } else {
      sbirSkoky(bd, nr, nc, jeDama, vlastnik, cesta, znicene, vysledky);
    }

    // obnovení stavu pro další možnost
    cesta.pop();
    znicene.pop();
    bd[cilIdx] = null;
    bd[capIdx] = zachovanyKamen;
  }
}

// Vrátí všechny legální tahy daného vlastníka.
// Pokud existuje jakýkoliv skok, vracejí se POUZE skoky (povinný skok).
function generujTahy(vlastnik) {
  // nejprve zkoušíme najít všechny řetězce skoků
  // sbirSkoky voláme jen u kamene, který má aspoň jeden okamžitý skok,
  // jinak by generoval falešný "tah" na stejné políčko
  const skoky = [];
  for (let r = 0; r < VELKOST; r++) {
    for (let c = 0; c < VELKOST; c++) {
      const bu = board[idx(r, c)];
      if (!bu || bu.o !== vlastnik) continue;
      if (okamziteSkoky(board, r, c, bu.k, vlastnik).length === 0) continue;
      // kámen na dobu hledání řetězce opustí výchozí pole (jinak by si sám blokoval diagonálu)
      board[idx(r, c)] = null;
      sbirSkoky(board, r, c, bu.k, vlastnik, [[r, c]], [], skoky);
      board[idx(r, c)] = bu;
    }
  }

  // pokud existuje povinný skok — jen ty
  if (skoky.length > 0) return skoky;

  // jinak obyčejné tahy (bez skoku)
  const obycejne = [];
  for (let r = 0; r < VELKOST; r++) {
    for (let c = 0; c < VELKOST; c++) {
      const bu = board[idx(r, c)];
      if (!bu || bu.o !== vlastnik) continue;

      if (bu.k) {
        // dáma — kluz na libovolné volné pole podél diagonály
        for (const [dr, dc] of SMERY_DAMY) {
          let ir = r + dr, ic = c + dc;
          while (vPoli(ir, ic) && board[idx(ir, ic)] === null) {
            obycejne.push({ from: [r, c], to: [ir, ic], captures: [], path: [[ir, ic]] });
            ir += dr;
            ic += dc;
          }
        }
      } else {
        // obyčejný kámen — jedno pole dopředu doleva/prava
        const dr = vlastnik === VLASTNIK_HRA ? -1 : 1;
        for (const dc of [-1, 1]) {
          const cr = r + dr, cc = c + dc;
          if (vPoli(cr, cc) && board[idx(cr, cc)] === null) {
            obycejne.push({ from: [r, c], to: [cr, cc], captures: [], path: [[cr, cc]] });
          }
        }
      }
    }
  }

  return obycejne;
}

// ==== Aplikování a vyhodnocení tahů ====

// Převede kámen do cíle a zničí všechny kameny ze seznamu captures.
// Pokud kámen dosáhne poslední řady, promění se v dámu.
function aplikujTah(bd, move, vlastnik) {
  // zničí zničené kameny
  for (const [cr, cc] of move.captures) bd[idx(cr, cc)] = null;

  // odebereme kámen ze startu
  const kamen = bd[idx(move.from[0], move.from[1])];
  bd[idx(move.from[0], move.from[1])] = null;

  // kontrola proměny v dámu podle cílového pole
  let jeDama = kamen.k;
  const [tr, tc] = move.to;
  if (!jeDama &&
     ((vlastnik === VLASTNIK_HRA && tr === 0) ||
      (vlastnik === VLASTNIK_PC && tr === VELKOST - 1))) {
    jeDama = true;
  }

  bd[idx(tr, tc)] = { o: vlastnik, k: jeDama };
}

// Zkontroluje, zda daný vlastník má aspoň jeden legální tah.
function maTahy(vlastnik) {
  return generujTahy(vlastnik).length > 0;
}

// ==== AI — minimax s alfa/beta ořezem ====
// Vyhodnocení pozice z pohledu počítače (kladné = dobré pro PC).
function vyhodnot(bd) {
  let skore = 0;
  for (let i = 0; i < bd.length; i++) {
    const bu = bd[i];
    if (!bu) continue;
    // dáma váží výrazně víc než obyčejný kámen
    const hodnota = bu.k ? 7 : 3;
    skore += bu.o === VLASTNIK_PC ? hodnota : -hodnota;
  }
  return skore;
}

// Minimax s alfa/beta ořezem. `vlastnik` = kdo je na tahu.
function minimax(bd, hloubka, alpha, beta, vlastnik) {
  const tahy = generujTahyPro(bd, vlastnik);

  // tahající nemá žádný tah → prohrává
  if (tahy.length === 0) {
    return vlastnik === VLASTNIK_PC ? -Infinity : Infinity;
  }

  // dosáhli jsme konce vyhledávání — hodnotíme pozici
  if (hloubka === 0) {
    return vyhodnot(bd);
  }

  const maxImuji = vlastnik === VLASTNIK_PC;
  let nejLepsi = maxImuji ? -Infinity : Infinity;

  for (const move of tahy) {
    const kopie = bd.map((bu) => (bu ? { o: bu.o, k: bu.k } : null));
    aplikujTah(kopie, move, vlastnik);
    const rival = vlastnik === VLASTNIK_HRA ? VLASTNIK_PC : VLASTNIK_HRA;
    const hodnota = minimax(kopie, hloubka - 1, alpha, beta, rival);

    if (maxImuji) {
      nejLepsi = Math.max(nejLepsi, hodnota);
      alpha = Math.max(alpha, hodnota);
    } else {
      nejLepsi = Math.min(nejLepsi, hodnota);
      beta = Math.min(beta, hodnota);
    }
    // alfa/beta ořez
    if (beta <= alpha) break;
  }

  return nejLepsi;
}

// Verze generujTahy, která pracuje s libovolným boardem (pro AI).
function generujTahyPro(bd, vlastnik) {
  const puvodniBoard = board;
  board = bd; // dočasně přepíšeme globální board, aby sbirSkoky fungoval
  const vysledek = generujTahy(vlastnik);
  board = puvodniBoard;
  return vysledek;
}

// Vybere nejlepší tah počítače.
function vyberTahPC() {
  let nejLepsi = null;
  let nejLepsiHodnota = -Infinity;

  for (const move of generujTahy(VLASTNIK_PC)) {
    const kopie = klonBoardu();
    aplikujTah(kopie, move, VLASTNIK_PC);
    const hodnota = minimax(kopie, HLOUBKA_AI - 1, -Infinity, Infinity, VLASTNIK_HRA);
    // podmínka na null zajistí výběr i v prohrané pozici, kde jsou všechny tahy -Infinity
    if (nejLepsi === null || hodnota > nejLepsiHodnota) {
      nejLepsiHodnota = hodnota;
      nejLepsi = move;
    }
  }

  return nejLepsi;
}

// ==== Vykreslení šachovnice ====

// Vytvoří DOM buňky do CSS mřížky 8×8.
function vykresliPole() {
  boardEl.innerHTML = "";
  boardEl.style.gridTemplateColumns = `repeat(${VELKOST}, minmax(0, 1fr))`;
  for (let r = 0; r < VELKOST; r++) {
    for (let c = 0; c < VELKOST; c++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.dataset.r = r;
      cell.dataset.c = c;
      // tmavá pole jsou hrací, světlá jen dekorativní
      if (tmavePolicko(r, c)) cell.classList.add("dark");
      boardEl.appendChild(cell);
    }
  }
}

// Vyhledá DOM buňku podle souřadnic.
function cellElement(r, c) {
  return boardEl.children[idx(r, c)];
}

// Přepíše vzhled jedné buňky podle stavu boardu a výběru.
function obnovBuunku(r, c) {
  const el = cellElement(r, c);
  const bu = board[idx(r, c)];

  // zbytky předchozích stavů
  el.classList.remove("piece", "hra", "pc", "king", "vybrany", "cil");
  el.textContent = "";

  // kámen na poli
  if (bu) {
    el.classList.add("piece");
    el.classList.add(bu.o === VLASTNIK_HRA ? "hra" : "pc");
    if (bu.k) {
      el.classList.add("king");
      el.textContent = "♛"; // koruna pro dámu
    }
  }

  // zvýraznění vybraného kamene hráče
  if (vybrany && vybrany[0] === r && vybrany[1] === c) {
    el.classList.add("vybrany");
  }
  // zvýraznění legálních cílů
  if (legalniTahy.some((m) => m.to[0] === r && m.to[1] === c)) {
    el.classList.add("cil");
  }
}

// Obnoví vzhled všech buněk a zvýraznění.
function obnovVse() {
  for (let r = 0; r < VELKOST; r++) {
    for (let c = 0; c < VELKOST; c++) {
      obnovBuunku(r, c);
    }
  }
}

// ==== Ovládání HUD ====

// Nastaví text lišty tahu podle toho, kdo hraje.
function nastaviTah(tahHrade) {
  turnBar.innerHTML = tahHrade
    ? '<span class="dot dot-hra"></span> Hrajete vy — klikněte na svůj kámen'
    : '<span class="dot dot-pc"></span> Počítač sahá…';
}

// Aktualizuje ukazatele v HUD (pořadí tahu, skóre).
function aktualizujSkore() {
  scoreHraEl.textContent = skoreHra;
  scorePcEl.textContent = skorePc;
  moveCountEl.textContent = tahCislo;
}

// ==== Závěr hry ====

// Skončí hru — vyhodnotí výherce a zobrazí překryv.
function konecHryVyhra(vlastnik) {
  konecHry = true;

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

// ==== Klikací ovládání hráče ====

// Vrací [r,c] z kliknuté buňky, jinak null.
function kliknutaBuunka(e) {
  const el = e.target.closest(".cell");
  if (!el) return null;
  return [Number(el.dataset.r), Number(el.dataset.c)];
}

// Vybere kámen a spočítá jeho legální tahy (s ohledem na povinný skok).
function vyberKamen(r, c) {
  vybrany = [r, c];
  legalniTahy = generujTahy(VLASTNIK_HRA).filter(
    (m) => m.from[0] === r && m.from[1] === c
  );
  obnovVse();
}

// Klik hráče — buď provede tah, nebo vybere/zruší výběr kamene.
function klikHrade(e) {
  if (konecHry || tah !== VLASTNIK_HRA) return;

  const hit = kliknutaBuunka(e);
  if (!hit) return;
  const [r, c] = hit;

  // 1) pokud je vybraný kámen a klikli jsme na legální cíl → provedeme tah
  if (vybrany) {
    const move = legalniTahy.find((m) => m.to[0] === r && m.to[1] === c);
    if (move) {
      provediTah(move, VLASTNIK_HRA);
      return;
    }
  }

  // 2) klik na vlastní kámen → vybereme ho (jen pokud smí, s ohledem na povinný skok)
  const bu = board[idx(r, c)];
  if (bu && bu.o === VLASTNIK_HRA) {
    vyberKamen(r, c);
    return;
  }

  // 3) jinak zrušíme výběr
  vybrany = null;
  legalniTahy = [];
  obnovVse();
}

// Provede kompletní tah (včetně řetězce skoků) a přepne tok hry.
function provediTah(move, vlastnik) {
  aplikujTah(board, move, vlastnik);
  vybrany = null;
  legalniTahy = [];
  obnovVse();

  // kontrola, zda soupeř už nemá tah → konec hry
  const rival = vlastnik === VLASTNIK_HRA ? VLASTNIK_PC : VLASTNIK_HRA;
  if (!maTahy(rival)) {
    konecHryVyhra(vlastnik);
    return;
  }

  // přepneme tah na soupeře
  tah = rival;
  tahCislo++;
  nastaviTah(tah === VLASTNIK_HRA);
  aktualizujSkore();

  // pokud je na tahu počítač, necháme si "rozmyslet" a zahraje
  if (tah === VLASTNIK_PC) {
    setTimeout(tahPC, 400);
  }
}

// Tah počítače — vybere nejlepší tah přes minimax a provede ho.
function tahPC() {
  if (konecHry || tah !== VLASTNIK_PC) return;

  const move = vyberTahPC();
  if (!move) {
    // počítač nemá tah — hráč vyhrál
    konecHryVyhra(VLASTNIK_HRA);
    return;
  }

  provediTah(move, VLASTNIK_PC);
}

// ==== Nová hra ====

// Inicializuje startovní pozici — 12 kamenů na straně na tmavých polích.
function novaHra() {
  konecHry = false;
  tah = VLASTNIK_HRA;
  tahCislo = 1;
  vybrany = null;
  legalniTahy = [];

  // prázdné pole
  board = new Array(VELKOST * VELKOST).fill(null);

  // hráč (černé) — spodní 3 řady
  for (let r = VELKOST - 3; r < VELKOST; r++) {
    for (let c = 0; c < VELKOST; c++) {
      if (tmavePolicko(r, c)) board[idx(r, c)] = { o: VLASTNIK_HRA, k: false };
    }
  }
  // počítač (bílé) — horní 3 řady
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < VELKOST; c++) {
      if (tmavePolicko(r, c)) board[idx(r, c)] = { o: VLASTNIK_PC, k: false };
    }
  }

  vykresliPole();
  obnovVse();
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
  boardEl.addEventListener("click", klikHrade);
});
