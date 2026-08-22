// ====== Tenis — logika hry (Pong) ======
// Klasická arkádová hra: dva hráči ovládají rakety vlevo a vpravo.
// Míč se odráží od horního/dolního okraje a od raket. Prohře hráč,
// u kterého míč minul rakotu — soupeř si připsá bod. Vyhrává první s cílem.

// ---- Rozměry hřiště (px, odpovídá canvasu) ----
const COURT_W = 800;
const COURT_H = 450;

// ---- Rozměry rakety a míče (px) ----
const PADDLE_W = 10;    // šířka rakety
const PADDLE_H = 70;    // výška rakety
const BALL_R = 7;       // poloměr míče

// ---- Odstup raket od stěn ----
const PADDLE_MARGIN = 22;

// ---- Rychlosti (px za sekundu, počítáno z dt) ----
const PADDLE_SPEED = 430;          // rychlost rakety
const BALL_SPEED_MIN = 300;        // počáteční rychlost míče
const BALL_SPEED_MAX = 780;        // strop rychlosti míče
const BALL_ACCEL = 1.05;          // mírné zrychlení po každém úderu raketou

// ---- Cíl hry: první hráč s tolika body vyhrává ----
const WIN_SCORE = 5;

// ==== Režimy hry ====
// "dvouhra" — dva hráči u jednoho klávesnice (původní režim, výchozí)
// "pocitac" — hráč vlevo hraje proti počítači, který ovládá pravou raketu
const REZIM_DVOUHPA = "dvouhra";
const REZIM_POCITAC = "pocitac";

// ==== Parametry chování počítače podle obtížnosti ====
// rychlost   — maximální rychlost rakety počítače (px/s); vyšší = lépe dohání míč
// pravdChyby — pravděpodobnost (0..1), že daný úder počítač záměrně minul.
//              0 = nikdy nechybí (neporazitelný), 1 = vždy chybuje.
// Pět úrovní — od pomalého a chybného po neporazitelného.
const OBTEZNOSTI = {
  lehky: { nazev: "Lehký", rychlost: 300, pravdChyby: 0.5 },
  mirny: { nazev: "Mírný", rychlost: 400, pravdChyby: 0.35 },
  stredni: { nazev: "Střední", rychlost: 520, pravdChyby: 0.2 },
  pokrocily: { nazev: "Pokročilý", rychlost: 700, pravdChyby: 0.08 },
  // nejvyšší obtížnost — počítač nikdy nechybí a je dost rychlý, aby míč vždy stihl
  obtizny: { nazev: "Obtížný", rychlost: 1500, pravdChyby: 0 },
};

// ==== Globální stav hry ====
let left;     // pozice rakety vlevo: {y}
let right;    // pozice rakety vpravo: {y}
let ball;     // pozice a směr míče: {x, y, vx, vy}
let scoreL;   // body hráče vlevo
let scoreR;   // body hráče vpravo
let paused;   // je hra v pauze
let over;     // skončila hra (někdo vyhrál)
let winner;   // "left" | "right" | null
let rafId;    // identifikátor animace (requestAnimationFrame)
let lastTime; // čas posledního kroku

// ==== Stav režimu a chování počítače ====
let rezim = REZIM_DVOUHPA;   // REZIM_DVOUHPA | REZIM_POCITAC
let obtiznost = "stredni";   // klíč do OBTEZNOSTI ("lehky" | "stredni" | "obtizny")
let aiCilovaY;        // cílová poloha rakety počítače pro aktuální let míče
let aiRozhodnuto;     // true = pro aktuální let míče už je rozhodnuto (trefa/chyba)

// ==== Odkazy na DOM prvky ====
const board = document.getElementById("board");
const ctx = board.getContext("2d");
const scoreLeftEl = document.getElementById("scoreLeft");
const scoreRightEl = document.getElementById("scoreRight");
const targetEl = document.getElementById("target");
const overlay = document.getElementById("overlay");
const overlayText = document.getElementById("overlayText");
const overlayBtn = document.getElementById("overlayBtn");
const pauseBtn = document.getElementById("pauseBtn");
const restartBtn = document.getElementById("restartBtn");
// selecty pro volbu režimu (dvouhra / počítač) a obtížnosti počítače
const modeSelect = document.getElementById("modeSelect");
const diffSelect = document.getElementById("diffSelect");
// popisek pravého hráče — v režimu počítač se zobrazí „Počítač"
const scoreRightLabel = document.getElementById("scoreRightLabel");
// obal s možností změny obtížnosti — skrytý, když hraje dvouhra
const diffWrap = document.getElementById("diffWrap");

// ---- Stav kláves (držená tlačítka) — mění event při stisknutí/uvolnění ----
// Držená klávesa = true; krok hry čte jen tento stav, takže se pohledavá i
// při více stisknutých klávesách najednou (např. W + mezerník).
const keys = {
  up1: false,    // hráč 1 — nahoru (W)
  down1: false,  // hráč 1 — dolů (S)
  up2: false,    // hráč 2 — nahoru (↑)
  down2: false,  // hráč 2 — dolů (↓)
};

// ==== Vykreslování ====

// Vykreslí pozadí a bílé přerušované středové čáry.
function vykresliPozadi() {
  // pozadí je nastavené v CSS (průhledné canvas), zde jen středové čáry;
  // barva se liší podle motivu (tmavá na světlém pozadí, světlá na tmavém)
  ctx.strokeStyle = window.hrySvetlyMotiv() ? "rgba(30,41,59,0.28)" : "rgba(230,236,255,0.22)";
  ctx.lineWidth = 3;
  ctx.setLineDash([14, 16]);
  ctx.beginPath();
  ctx.moveTo(COURT_W / 2, 0);
  ctx.lineTo(COURT_W / 2, COURT_H);
  ctx.stroke();
  // obnoví pevný tah pro zbylé objekty
  ctx.setLineDash([]);
}

// Vykreslí jednu raketu jako zakulhlený obdélník v dané x a barvě.
function nakresliRaketu(x, y, fill) {
  ctx.fillStyle = fill;
  const r = 5; // poloměr zakulhlení rohů
  // manuell zakulhlený obdélník (bez roundRect kvůli starším prohlížečům)
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + PADDLE_W, y, x + PADDLE_W, y + PADDLE_H, r);
  ctx.arcTo(x + PADDLE_W, y + PADDLE_H, x, y + PADDLE_H, r);
  ctx.arcTo(x, y + PADDLE_H, x, y, r);
  ctx.arcTo(x, y, x + PADDLE_W, y, r);
  ctx.closePath();
  ctx.fill();
}

// Vykreslí míč jako plnou oranžovou kouli (bez záře) — výrazný kontrast na obou motivech.
function nakresliMic() {
  // plná oranžová koule míče
  ctx.fillStyle = "#ff7a00";
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
  ctx.fill();
}

// Kompletní překreslení scény (pozadí, rakety, míč).
function vykresli() {
  ctx.clearRect(0, 0, COURT_W, COURT_H);
  vykresliPozadi();
  nakresliRaketu(PADDLE_MARGIN, left.y, "#4f8cff");
  nakresliRaketu(COURT_W - PADDLE_MARGIN - PADDLE_W, right.y, "#ff5c7a");
  nakresliMic();
}

// Aktualizuje skóre v bočním panelu.
function aktualizujSkore() {
  scoreLeftEl.textContent = scoreL;
  scoreRightEl.textContent = scoreR;
}

// ==== Pomocné omezení rakety na hranice hřiště ====
function omezY(y) {
  return Math.max(0, Math.min(COURT_H - PADDLE_H, y));
}

// ==== Odraz míče od rakety ====
// Úhel odrazu závisí na tom, v jakém místě rakety míč zasáhl —
// střed rakety = přímý odraz, okraj = ostrý úhel. To hra dělá hratelnou.
// Parametr strany: "left" odráží míč doprava, "right" doleva.
function odraziMictOdRakety(rajcetX, rajcetY, strana) {
  // výška středu rakety
  const streduY = rajcetY + PADDLE_H / 2;
  // výstupek míče přes střed rakety v rozpadu [-1, 1] (0 = střed, ±1 = okraj)
  const vychyleni = (ball.y - streduY) / (PADDLE_H / 2);
  // mezí omezíme na [-1, 1], aby okraj nenačetl extrémní úhel
  const clamped = Math.max(-1, Math.min(1, vychyleni));

  // maximální úhel od svislice (stejně jako u Pingu: ~60°)
  const maxUhel = (60 * Math.PI) / 180;
  const uhel = clamped * maxUhel;

  // zrychlí míč po každém úderu (mezi minimem a maximem)
  const rychlost = Math.min(BALL_SPEED_MAX, Math.hypot(ball.vx, ball.vy) * BALL_ACCEL);

  // směr: "left" → míč doprava (vx > 0), "right" → míč doleva (vx < 0)
  const predpokladVx = strana === "left" ? 1 : -1;

  // rozložíme rychlost přes úhel; x složka podle směru
  const nx = predpokladVx * Math.cos(uhel) * rychlost;
  const ny = Math.sin(uhel) * rychlost;

  ball.vx = nx;
  ball.vy = ny;

  // míč odrazíme ven z kolize, aby okamžitě nevystřídoval
  if (strana === "left") {
    ball.x = rajcetX + PADDLE_W + BALL_R;
  } else {
    ball.x = rajcetX - BALL_R;
  }

  // po každém odrazu míč opustí raketu a začne nový let — příchozí let
  // k počítači bude znovu posouzen (trefa/chyba), proto rozhodnutí znějeme
  aiRozhodnuto = false;
}

// ==== Pomocné: detekce kolize míče s obdélníkem rakety ====
// Vrací true, pokud se kruh (míč) dotkl obdélníku (rakieta).
function kolizeRakety(rx, ry) {
  // nejbližší bod obdélníku k těžišti kruhu
  const cx = Math.max(rx, Math.min(ball.x, rx + PADDLE_W));
  const cy = Math.max(ry, Math.min(ball.y, ry + PADDLE_H));
  const dx = ball.x - cx;
  const dy = ball.y - cy;
  return dx * dx + dy * dy <= BALL_R * BALL_R;
}

// ==== Počítač (AI) — pravá raketa ====

// Předpoví svislou polohu míče ve výšce dané x-ové pozice,
// zohlední odrazy od horního a dolního okraje (rozbijí „zrcadlovou" dráhu).
function predpovedYMic(xCil) {
  // bez vodorovného pohybu se míč nestěhuje — vrátíme aktuální výšku
  if (Math.abs(ball.vx) < 1e-6) return ball.y;

  // čas letu k cílové x pozici (záporný → míč už za ní, vrátíme aktuální výšku)
  const t = (xCil - ball.x) / ball.vx;
  if (t < 0) return ball.y;

  // volný let míče bez stěn
  let y = ball.y + ball.vy * t;

  // odrazy mezi horním a dolním okrajem vyjádříme jako periodickou „trojúhelníkovou" vlnu
  const lo = BALL_R;
  const hi = COURT_H - BALL_R;
  const rozsah = hi - lo;
  const perioda = 2 * rozsah;

  // posuneme y do jednoho periodického intervalu [lo, hi]
  let rel = y - lo;
  rel = ((rel % perioda) + perioda) % perioda;
  if (rel > rozsah) rel = perioda - rel; // odraz od dolního okraje
  return lo + rel;
}

// Jednou za každý let míče směrem k počítači určí cílovou polohu rakety.
// Podle obtížnosti může být úder záměrně chybějící (chyba počítače).
function rozhodniAI() {
  // AI hraje jen v režimu počítač a jen když míč letí k pravé raketě
  if (rezim !== REZIM_POCITAC) return;
  if (ball.vx <= 0) return;
  if (aiRozhodnuto) return; // pro aktuální let míče je cíl už nastaven
  aiRozhodnuto = true;

  const cil = OBTEZNOSTI[obtiznost];
  // výška pravé rakety, ve které se odečítá dopad míče
  const xCil = COURT_W - PADDLE_MARGIN - PADDLE_W / 2;
  let cilovaY = predpovedYMic(xCil);

  // podle pravděpodobnosti chyby může počítač mírít na opačnou stranu hřiště
  if (Math.random() < cil.pravdChyby) {
    cilovaY = cilovaY < COURT_H / 2 ? COURT_H : 0;
  }

  // cílová poloha horního rohu rakety — střed rakety na předpovězené výšce
  aiCilovaY = omezY(cilovaY - PADDLE_H / 2);
}

// Posune pravou raketu k cíli rychlostí danou obtížností.
function pohybPocitace(dt) {
  // míč letí k počítači → drží se cíle, jinak se vrací do středu hřiště
  const cil = ball.vx > 0 ? aiCilovaY : (COURT_H - PADDLE_H) / 2;
  const rozd = cil - right.y;
  const rych = OBTEZNOSTI[obtiznost].rychlost;
  // omezení přesunu na rychlost × čas, aby pohyb nebyl „teleport"
  const presun = Math.max(-rych * dt, Math.min(rych * dt, rozd));
  right.y = omezY(right.y + presun);
}

// ==== Jeden krok simulace (dílčí časový krok v sekundách) ====
function krok(dt) {
  // ---- pohyb raket ----
  // levá raketa vždy hráčem; pravou řídí buď druhý hráč, nebo počítač
  if (keys.up1) left.y = omezY(left.y - PADDLE_SPEED * dt);
  if (keys.down1) left.y = omezY(left.y + PADDLE_SPEED * dt);

  if (rezim === REZIM_DVOUHPA) {
    if (keys.up2) right.y = omezY(right.y - PADDLE_SPEED * dt);
    if (keys.down2) right.y = omezY(right.y + PADDLE_SPEED * dt);
  } else {
    rozhodniAI();   // jednou za let míče určí cílovou polohu
    pohybPocitace(dt);
  }

  // ---- pohyb míče ----
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  // odraz od horního a dolního okraje
  if (ball.y - BALL_R <= 0) {
    ball.y = BALL_R;
    ball.vy = Math.abs(ball.vy);
  } else if (ball.y + BALL_R >= COURT_H) {
    ball.y = COURT_H - BALL_R;
    ball.vy = -Math.abs(ball.vy);
  }

  // ---- detekce bodu: míč minul levý / pravý okraj hřiště ----
  // míč vyšel zleva → levý hráč minul → bod hráči vpravo
  if (ball.x + BALL_R <= 0) {
    zisk("right");
    return;
  }
  // míč vyšel zprava → pravý hráč minul → bod hráči vlevo
  if (ball.x - BALL_R >= COURT_W) {
    zisk("left");
    return;
  }

  // ---- kolize s raketami ----
  // levá rakota: odrazí míč, jen když míč letí doleva (vyhýbáváme se podvojení odrazu)
  if (ball.vx < 0 && kolizeRakety(PADDLE_MARGIN, left.y)) {
    odraziMictOdRakety(PADDLE_MARGIN, left.y, "left");
  }
  // pravá rakota: odrazí míč, jen když míč letí doprava
  if (ball.vx > 0 && kolizeRakety(COURT_W - PADDLE_MARGIN - PADDLE_W, right.y)) {
    odraziMictOdRakety(COURT_W - PADDLE_MARGIN - PADDLE_W, right.y, "right");
  }
}

// ==== Bod a reset míče ====
// Hráč "bodyOwner" ("left" | "right") získal bod; míč se servíruje nově
// směrem ke soupeři (od hráče, který bod inkasoval, odražujeme míč na stranu
// hráče, který minul — klasický servis na soupeře).
function zisk(bodyOwner) {
  if (bodyOwner === "left") scoreL++;
  else scoreR++;
  aktualizujSkore();

  // vyhodnotit konec hry dříve, než servisneme
  if (scoreL >= WIN_SCORE || scoreR >= WIN_SCORE) {
    winner = scoreL >= WIN_SCORE ? "left" : "right";
    konecHry();
    return;
  }

  // míč servírujeme směrem k vyhrávajícímu hráči (bodyOwner)
  // bodyOwner === "left"  → míč letí směrem k levému hráči   → vx < 0
  // bodyOwner === "right" → míč letí směrem k pravému hráči  → vx > 0
  resetSirkaMice(bodyOwner);
}

// ==== Reset míče (servis) po každém bodě ====
// Parametr "kamLeti" říká, směrem k kterou hráči míč letí.
// Míč vždy míří k vyhrávajícímu (tomu, kdo právě získal bod).
function resetSirkaMice(kamLeti) {
  // míč v centru hřiště
  ball.x = COURT_W / 2;
  ball.y = COURT_H / 2;

  // mírně náhodná svislá složka, aby servis nebyl predikovatelný
  const vy = (Math.random() - 0.5) * 0.7 * BALL_SPEED_MIN;

  // směr letu podle "kamLeti"
  const vyraz = kamLeti === "right" ? 1 : -1;
  // x složku přizpůsobíme tak, aby celková rychlost odpovídala BALL_SPEED_MIN
  const vx =
    Math.sqrt(Math.max(0, BALL_SPEED_MIN * BALL_SPEED_MIN - vy * vy)) * vyraz;

  ball.vx = vx;
  ball.vy = vy;
  // nový let míče — příchozí směr k počítači nechceme rozhodovat znovu,
  // dokud míč neodejde od počítače (rozhodování se probíhá v rozhodniAI)
  aiRozhodnuto = false;
  lastTime = performance.now();
}

// ==== Stav hry ====

// Přepne hru do stavu konce (někdo vyhrál).
function konecHry() {
  over = true;
  // pravý hráč je v režimu počítač označen jako „Počítač"
  const nazevPravy = rezim === REZIM_POCITAC ? "Počítač" : "Hráč 2 (vpravo)";
  const nazev = winner === "left" ? "Hráč 1 (vlevo)" : nazevPravy;
  overlayText.textContent = `Vyhrává ${nazev}!`;
  overlayBtn.textContent = "Nová hra";
  pokazHry(true);
}

// Zobrazení nebo skrytí překryvu stavu.
function pokazHry(zobrazit) {
  overlay.hidden = !zobrazit;
}

// Přepne pauzu; text a tlačítko přizpůsobí.
function pauza() {
  if (over) return;
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
  if (!rafId) rafId = requestAnimationFrame(krokAnimace);
}

// ==== Nová hra ====

// Resetuje hru na počáteční stav — rakety a míč v centru, skóre nula.
function restart() {
  // rakety na středu hřiště
  left = { y: (COURT_H - PADDLE_H) / 2 };
  right = { y: (COURT_H - PADDLE_H) / 2 };

  // skóre nula
  scoreL = 0;
  scoreR = 0;

  // míč v centru, směr letu náhodný (vlevo / vpravo)
  ball = { x: COURT_W / 2, y: COURT_H / 2, vx: 0, vy: 0 };
  const vyraz = Math.random() < 0.5 ? 1 : -1;
  const vy = (Math.random() - 0.5) * 0.6 * BALL_SPEED_MIN;
  const vx =
    Math.sqrt(Math.max(0, BALL_SPEED_MIN * BALL_SPEED_MIN - vy * vy)) * vyraz;
  ball.vx = vx;
  ball.vy = vy;

  // stav hry — běží, nikdo nevyhrál
  paused = false;
  over = false;
  winner = null;

  // vyčisti stav kláves, aby se hra hned nehýbala
  keys.up1 = keys.down1 = keys.up2 = keys.down2 = false;

  // počítač — cílová poloha do středu a rozhodnutí pro nový let míče znějeme
  aiCilovaY = (COURT_H - PADDLE_H) / 2;
  aiRozhodnuto = false;

  aktualizujSkore();
  vykresli();
  pokazHry(false);
  lastTime = performance.now();
}

// ==== Hlavní animace ====
// Číselný krok (dt) se počítá jako rozdíl mezi dvěma rády tak,
// aby fyzika běhávala stejně rychle nezávisle na FPS monitoru.
function krokAnimace() {
  const ted = performance.now();
  let dt = (ted - lastTime) / 1000; // převedení na sekundy
  // bezpečný strop pro dt např. po návratu z pauzy nebo ztraceném okně
  if (dt > 0.05) dt = 0.05;
  lastTime = ted;

  if (!paused && !over) {
    krok(dt);
  }

  vykresli();

  if (!over) {
    rafId = requestAnimationFrame(krokAnimace);
  } else {
    rafId = null;
  }
}

// ==== Ovládání ====

// Klávesové ovládání — pro jednoho a druhého hráče.
function naKlavesy(e, poloha) {
  const klice = e.key.toLowerCase();

  // mezerník / P = pauza nebo pokračování (obojí hráči)
  if (e.key === " " || klice === "p") {
    if (over) return;
    if (paused) pokracuj();
    else pauza();
    e.preventDefault();
    return;
  }

  // R = nová hra (kdykoliv)
  if (klice === "r") {
    restart();
    if (!rafId) rafId = requestAnimationFrame(krokAnimace);
    e.preventDefault();
    return;
  }

  // klávesy pohyb — mění jen držený stav, krok animace ho potom počítá
  if (klice === "w") keys.up1 = poloha;
  else if (klice === "s") keys.down1 = poloha;
  else if (e.key === "ArrowUp") keys.up2 = poloha;
  else if (e.key === "ArrowDown") keys.down2 = poloha;

  // šipky / mezerník neměly by scrollovat stránku
  if ([" ", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
    e.preventDefault();
  }
}

// ==== Spojení událostí ====
document.addEventListener("keydown", (e) => naKlavesy(e, true));
document.addEventListener("keyup", (e) => naKlavesy(e, false));

pauseBtn.addEventListener("click", () => {
  if (over) return;
  if (paused) pokracuj();
  else pauza();
});

overlayBtn.addEventListener("click", () => {
  if (over) {
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

// při přepnutí motivu si hřiště překreslí (barva středové čáry se liší dle motivu)
window.addEventListener("hry:motiv", () => {
  vykresli();
});

// ==== Režim hry a obtížnost počítače ====

// Přepne režim hry a podle něj ukáže/ukryje volbu obtížnosti.
// Po změně režimu se hra okamžitě restartuje, aby platil nový nastavený režim.
function zmenaRezimu(novyRezim) {
  rezim = novyRezim;

  // obtížnost má smysl jen proti počítači — jinak je volba skrytá
  diffWrap.hidden = novyRezim !== REZIM_POCITAC;

  // název pravého hráče podle režimu
  scoreRightLabel.textContent =
    novyRezim === REZIM_POCITAC ? "Počítač" : "Hráč 2 (vpravo)";

  // nová hra v novém režimu
  restart();
  if (!rafId) rafId = requestAnimationFrame(krokAnimace);
}

// Přepne obtížnost počítače (platí jen v režimu počítač).
function zmenaObtiznosti(novaObtiznost) {
  obtiznost = novaObtiznost;

  // cílovou polohu rakety nastavíme do středu a rozhodnutí znějeme,
  // aby nový let míče byl posouzen podle nové obtížnosti
  aiCilovaY = (COURT_H - PADDLE_H) / 2;
  aiRozhodnuto = false;
}

// propojení selectů — změna hodnoty okamžitě přepne režim / obtížnost
modeSelect.addEventListener("change", () => zmenaRezimu(modeSelect.value));
diffSelect.addEventListener("change", () => zmenaObtiznosti(diffSelect.value));

// ==== Spouštění ====
document.addEventListener("DOMContentLoaded", () => {
  targetEl.textContent = WIN_SCORE;

  // výchozí režim je dvouhra — volbu obtížnosti skryjeme
  modeSelect.value = rezim;
  diffWrap.hidden = true;

  restart();
  rafId = requestAnimationFrame(krokAnimace);
});
