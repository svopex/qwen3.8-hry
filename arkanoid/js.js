// ====== Arkanoid (Brick-breaker) — logika hry ======
// Cílem je rozbít všechny cihly na vrchu pole míčkem odrazujícím od palice.
// Míček se ovládá palicí (šipky / myš / dotyk); odraz do stran závisí na místě,
// kde míček trefí palici. Při dopadu pod palici ztratíš život. Za úrovní úroveň,
// míček zrychlujeme a některé cihly jsou tvrdší.

// ---- Rozměry herního plátna a objektů (v pixelích) ----
const W = 480;
const H = 640;

// Palice
const PADDLE_W = 96;
const PADDLE_H = 16;
const PADDLE_Y = H - 46;   // horní hrana palice
const PADDLE_SPEED = 7;    // rychlost palice (px za "snímek") při klávesovém ovládání

// Cihly
const BRICK_COLS = 10;     // počet cihel na řádek
const MARGIN = 22;         // bokové okraje pole
const GAP = 6;             // mezera mezi cihlami
const BRICK_TOP = 64;      // horní okraj prvního řádku
const BRICK_H = 26;        // výška cihly

// Míček
const BALL_R = 8;
const BASE_SPEED = 4.6;    // úvodní rychlost míčku (px za snímek)
const SPEED_PER_LEVEL = 0.35; // o kolik zrychlí míček na každou další úroveň
const MAX_SPEED = 8.5;     // strop rychlosti

// Klíč pro uložení rekordu v localStorage
const BEST_KEY = "arkanoidBest";

// barevná paleta podle tvrdosti cihly (1..4)
const PALETA = {
  1: "#f66b6b", // 1 úder — červená
  2: "#ef8a3b", // 2 úder— oranžová
  3: "#f6d745", // 3 úder— žlutá
  4: "#61d682", // 4 úder— zelená
};

// ==== Globální stav hry ====
let paddle;        // {x} — střed palice (y je PADDLE_Y)
let ball;          // {x, y, vx, vy, r, stuck}
let bricks;        // pole cihel {x, y, w, h, hp, maxHp, points, alive}
let score;         // aktuální skóre
let level;         // aktuální úroveň
let lives;         // zbylé životy
let best;          // nejlepší skóre (localStorage)
let paused;        // je hra v pauze
let gameOver;      // hra skončila (ztráta všech životů)
let currentSpeed;  // aktuální rychlost míčku (dle úrovně)
let rafId;         // identifikátor animace
let lastTime;      // čas posledního snímku

// stisklé klávesy pro klávesové posouvání palice
const keys = { left: false, right: false };

// ==== Odkazy na DOM prvky ====
const board = document.getElementById("board");
const ctx = board.getContext("2d");
const scoreEl = document.getElementById("score");
const levelEl = document.getElementById("level");
const livesEl = document.getElementById("lives");
const bestEl = document.getElementById("best");
const overlay = document.getElementById("overlay");
const overlayText = document.getElementById("overlayText");
const overlayBtn = document.getElementById("overlayBtn");
const launchBtn = document.getElementById("launchBtn");
const pauseBtn = document.getElementById("pauseBtn");
const restartBtn = document.getElementById("restartBtn");

// ==== Statistika ====

// Vyznáčí statistiku v bočním panelu.
function aktualizujStat() {
  scoreEl.textContent = score;
  levelEl.textContent = level;
  bestEl.textContent = best;
  // životy jako srdíčka
  livesEl.textContent = lives > 0 ? "♥".repeat(lives) : "0";
}

// ==== Cihly a úrovně ====

// Výpočet šířky cihly podle šířky pole, okrajů a mezer.
function siritCihla() {
  return (W - 2 * MARGIN - (BRICK_COLS - 1) * GAP) / BRICK_COLS;
}

// Určí tvrdost cihly podle řádku a úrovně (horní řady jsou tvrdší).
function tvrdostCihla(radek, level, pocetRadek) {
  // horní řádky mají vyšší tvrdost; maximálně 4, minimálně 1
  const hp = Math.min(4, Math.max(1, pocetRadek - radek));
  // vyšší úroveň zesilí celé pole
  if (level >= 3) return Math.min(4, hp + 1);
  return hp;
}

// Vytvoří cihly aktuální úrovně a vrátí pole cihel.
function buildBricks(level) {
  const bricks = [];
  // více řádků s úrovní (max 9) — vyšší úroveň znamená plnější tvrději pole
  const pocetRadek = Math.min(4 + level, 9);
  const cisla = siritCihla();

  for (let r = 0; r < pocetRadek; r++) {
    for (let c = 0; c < BRICK_COLS; c++) {
      // od 2. úrovně vynecháme jednotlivé cihly pro vzor a zpestření
      if (level >= 2 && (r + c) % 4 === 0) continue;

      const hp = tvrdostCihla(r, level, pocetRadek);
      bricks.push({
        x: MARGIN + c * (cisla + GAP),
        y: BRICK_TOP + r * (BRICK_H + GAP),
        w: cisla,
        h: BRICK_H,
        hp: hp,
        maxHp: hp,
        points: hp * 10, // více tvrdší cihla = více bodů
        alive: true,
      });
    }
  }
  return bricks;
}

// Zkontroluje, zda jsou všechny cihly rozbite (úspěch úrovně).
function vseRozbito() {
  return bricks.every((b) => !b.alive);
}

// ==== Míček ====

// Umístí míček na palici (připravený na odstřel).
function pripravitMicek() {
  ball.stuck = true;
  ball.x = paddle.x;
  ball.y = PADDLE_Y - ball.r - 1;
  ball.vx = 0;
  ball.vy = 0;
}

// Odpočí míček od palice a nadá ho do pole s lehkým náklonem.
function odstreliMicek() {
  if (!ball.stuck) return;
  ball.stuck = false;
  // odhodí míček téměř svisle nahoru, malý náhodný náklon do strany
  const smer = Math.random() < 0.5 ? -1 : 1;
  const uhel = smer * (0.15 + Math.random() * 0.2); // radiany od svislice
  ball.vx = currentSpeed * Math.sin(uhel);
  ball.vy = -currentSpeed * Math.cos(uhel);
}

// Bezpečnostní zajištění, aby se míček nepadl téměř vodorovně a „ztratil" se na stěnách.
function zajistiVertikalniPohyb() {
  const minVy = 0.28 * currentSpeed; // minimální svislá složka rychlosti
  if (Math.abs(ball.vy) < minVy) {
    ball.vy = (ball.vy < 0 ? -1 : 1) * minVy;
    // doplníme vodorovnou složku tak, aby zůstalo celkové rychlost
    ball.vx = (ball.vx < 0 ? -1 : 1) * Math.sqrt(Math.max(0, currentSpeed * currentSpeed - ball.vy * ball.vy));
  }
}

// ==== Kolize ====

// Kolize kruhu (míček) s obdélníkem (cihla). Vrátí true při kontaktu.
function kruhObdelnik(c, obdelnik) {
  const cx = Math.max(obdelnik.x, Math.min(c.x, obdelnik.x + obdelnik.w));
  const cy = Math.max(obdelnik.y, Math.min(c.y, obdelnik.y + obdelnik.h));
  const dx = c.x - cx;
  const dy = c.y - cy;
  return dx * dx + dy * dy <= c.r * c.r;
}

// Odraží míček od palice — odraz do stran záleží na místě dopadu.
function odrazOdPalice() {
  // míček musí směřovat dolů (vy > 0), aby mohl trefit palici;
  // pokud už letí nahoru (vy < 0), odraz nedává smysl
  if (ball.vy < 0) return;
  // relativní bod dopadu -1 (levý kraj) až 1 (pravý kraj)
  const offset = (ball.x - paddle.x) / (PADDLE_W / 2);
  const oclim = Math.max(-1, Math.min(1, offset));
  // maximální úhel od svislice (65 stupňů) — kraj palice = strmější odraz
  const maxUhel = (65 * Math.PI) / 180;
  const uhel = oclim * maxUhel;
  ball.vx = currentSpeed * Math.sin(uhel);
  ball.vy = -currentSpeed * Math.cos(uhel); // vždy nahoru
}

 // ==== Hladký pohyb míčku (sub-stepping proti prokluznutí) ====

// Pohnutí míč o danou vzdálenost s kontrolou kolizí v malých krocích.
function posunMicek(dist) {
  const krokMax = ball.r; // jeden subkrok neprokrocí poloměr → žádný „tuning"
  let zbytk = dist;
  while (zbytk > 0 && !gameOver && !paused) {
    const krok = Math.min(krokMax, zbytk);
    zbytk -= krok;
    ball.x += (ball.vx / currentSpeed) * krok;
    ball.y += (ball.vy / currentSpeed) * krok;

    // stěny (horní, levá, pravá)
    if (ball.x - ball.r < 0) { ball.x = ball.r; ball.vx = Math.abs(ball.vx); }
    if (ball.x + ball.r > W) { ball.x = W - ball.r; ball.vx = -Math.abs(ball.vx); }
    if (ball.y - ball.r < 0) { ball.y = ball.r; ball.vy = Math.abs(ball.vy); }

    // palice
    if (
      ball.vy > 0 &&
      ball.y + ball.r >= PADDLE_Y &&
      ball.y + ball.r <= PADDLE_Y + PADDLE_H + 6 &&
      ball.x + ball.r >= paddle.x - PADDLE_W / 2 &&
      ball.x - ball.r <= paddle.x + PADDLE_W / 2
    ) {
      odrazOdPalice();
    }

    // cihla — první kolize v tomto subkroku
    for (const c of bricks) {
      if (!c.alive) continue;
      if (kruhObdelnik(ball, c)) {
        // určí dominante osu kolize a míček úplně oddělí od cihly (AABB-kruh)
        const cx = c.x + c.w / 2;
        const cy = c.y + c.h / 2;
        const dxNorm = Math.abs(ball.x - cx) / (c.w / 2 + ball.r);
        const dyNorm = Math.abs(ball.y - cy) / (c.h / 2 + ball.r);
        if (dxNorm > dyNorm) {
          // odraz od svislé hrany — míček postavíme těsně mimo levou/pravou hranu
          ball.vx = (ball.x < cx ? -1 : 1) * Math.abs(ball.vx);
          ball.x = ball.x < cx ? c.x - ball.r : c.x + c.w + ball.r;
        } else {
          // odraz od vodorovné hrany — míček postavíme těsně mimo horní/dolní hranu
          ball.vy = (ball.y < cy ? -1 : 1) * Math.abs(ball.vy);
          ball.y = ball.y < cy ? c.y - ball.r : c.y + c.h + ball.r;
        }

        // poškodit cihlu
        c.hp--;
        if (c.hp <= 0) {
          c.alive = false;
          score += c.points;
          if (score > best) best = score;
          aktualizujStat();
          // úroveň splněna?
          if (vseRozbito()) {
            dalsiUroven();
            return;
          }
        }
        break; // jen jedna cihla za subkrok
      }
    }

    // ztráta míčku (pod dolní hranou)
    if (ball.y - ball.r > H) {
      ztratitZivot();
      return;
    }
  }
}

// ==== Životy a stavy ====

// Ztratí jeden život; pokud žádné nezůstanou, hra skončí.
function ztratitZivot() {
  lives--;
  aktualizujStat();
  if (lives <= 0) {
    konecHry();
  } else {
    pripravitMicek();
  }
}

// Přepne hru do stavu konce a uloží rekord.
function konecHry() {
  gameOver = true;
  ulozRekord();
  overlayText.textContent = `Konec hry · ${score}`;
  overlayBtn.textContent = "Zkusit znovu";
  restartBtn.textContent = "Nová hra";
  launchBtn.hidden = true;
  pokazHry(true);
}

// Postoupí na další úroveň: nová pole, rychlý míček, míček znovu na palici.
function dalsiUroven() {
  level++;
  currentSpeed = Math.min(MAX_SPEED, BASE_SPEED + (level - 1) * SPEED_PER_LEVEL);
  bricks = buildBricks(level);
  pripravitMicek();
  aktualizujStat();
  vykresli();
  // krátká vizuální pauza na přechod (nepoškodí, protože míček je na palici)
  overlayText.textContent = `Úroveň ${level}`;
  overlayBtn.textContent = "Pokračovat";
  restartBtn.textContent = "Nová hra";
  launchBtn.hidden = false;
  paused = true; // po pokračování pokračuje
  overlay.hidden = false;
}

// Uloží nejlepší skóre do localStorage (pokud je dostupný).
function ulozRekord() {
  try {
    localStorage.setItem(BEST_KEY, String(best));
  } catch (err) {
    // localStorage nemusí být dostupný (soukromý režim) — rekord jen neuložíme
  }
}

// Nainitializuje / přepne překryv stavu.
function pokazHry(zobrazit) {
  overlay.hidden = !zobrazit;
}

// Přepne pauzu (míček i palici zastaví).
function prepnPause() {
  if (gameOver) return;
  paused = !paused;
  // text překryvu je při pauze vždy stejný, tlačítko přepne na „Pokračovat"
  overlayText.textContent = "Pozastaveno";
  overlayBtn.textContent = "Pokračovat";
  pauseBtn.textContent = paused ? "Pokračovat" : "Pozastavit";
  pokazHry(paused);
}

// ==== Nová hra ====

// Přečte uložený rekord z localStorage.
function nainicializujRekord() {
  let hodnota = 0;
  try {
    const ulozeno = localStorage.getItem(BEST_KEY);
    if (ulozeno) hodnota = parseInt(ulozeno, 10) || 0;
  } catch (err) {
    // localStorage nedostupné — zůstaneme u nuly
  }
  return hodnota;
}

// Resetuje celou hru na začátek (úroveň 1, 3 životy).
function restart() {
  level = 1;
  lives = 3;
  score = 0;
  currentSpeed = BASE_SPEED;
  gameOver = false;
  paused = false;
  paddle = { x: W / 2 };
  ball = { x: W / 2, y: PADDLE_Y - BALL_R - 1, r: BALL_R, vx: 0, vy: 0, stuck: true };
  bricks = buildBricks(level);
  pripravitMicek();
  launchBtn.hidden = false;
  launchBtn.textContent = "Vystřelit";
  aktualizujStat();
  vykresli();
  pokazHry(false);
  lastTime = performance.now();
  if (!rafId) rafId = requestAnimationFrame(krok);
}

// ==== Vykreslování ====

// Zakulhlený obdélník (bez roundRect, kvůli starším prohlížečům).
function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Vykreslí jednu cihlu podle jejího zbývajícího tvrdosti (barva signalizuje poškození).
function vykresliCihlu(c) {
  const barva = PALETA[c.hp] || PALETA[1];
  ctx.fillStyle = barva;
  roundRect(c.x, c.y, c.w, c.h, 4);
  ctx.fill();
  // odlesk nahoře, aby cihla působila objemně
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.fillRect(c.x + 2, c.y + 2, c.w - 4, 3);
  // hraní
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = 1;
  roundRect(c.x, c.y, c.w, c.h, 4);
  ctx.stroke();
}

// Vykreslí palici.
function vykresliPalici() {
  const x = paddle.x - PADDLE_W / 2;
  ctx.fillStyle = "#6ea8ff";
  roundRect(x, PADDLE_Y, PADDLE_W, PADDLE_H, 7);
  ctx.fill();
  // odlesk
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  roundRect(x + 4, PADDLE_Y + 2, PADDLE_W - 8, 4, 2);
  ctx.fill();
}

// Vykreslí míček se září.
function vykresliMicek() {
  // záře
  ctx.fillStyle = "rgba(246,224,94,0.25)";
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.r + 4, 0, Math.PI * 2);
  ctx.fill();
  // jádro
  ctx.fillStyle = "#f6e05e";
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
  ctx.fill();
  // odlesk
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.beginPath();
  ctx.arc(ball.x - ball.r * 0.3, ball.y - ball.r * 0.3, ball.r * 0.3, 0, Math.PI * 2);
  ctx.fill();
}

// Kompletní překreslení scény (čištění, cihly, palice, míček, nápověda).
function vykresli() {
  ctx.clearRect(0, 0, W, H);

  // cihly
  for (const c of bricks) {
    if (c.alive) vykresliCihlu(c);
  }

  // palice
  vykresliPalici();

  // míček (i když je připravená na palici)
  vykresliMicek();

  // nápověda, když je míček připraven na odstřel
  if (ball.stuck && !gameOver) {
    ctx.fillStyle = "rgba(230,236,255,0.75)";
    ctx.font = "15px 'Segoe UI', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Klikni nebo stiskni mezerník a odpočí míček", W / 2, H / 2);
    ctx.textAlign = "start";
  }
}

// ==== Hlavní smyčka hry ====

// jeden snímek: posuv palice + pohyb míčku ve čase dt (v „snímech", 1 = 1/60 s).
function krok(ts) {
  const dt = Math.min(3, (ts - lastTime) / (1000 / 60)); // omezíme velký skok po přepnutí tabulku
  lastTime = ts;

  if (!paused && !gameOver) {
    // klávesové ovládání palice
    if (keys.left) paddle.x -= PADDLE_SPEED * dt;
    if (keys.right) paddle.x += PADDLE_SPEED * dt;
    // palice musí zůstat v hraních
    paddle.x = Math.max(PADDLE_W / 2, Math.min(W - PADDLE_W / 2, paddle.x));

    // když míček leží na palici, těsně hýbe se s ní
    if (ball.stuck) {
      ball.x = paddle.x;
      ball.y = PADDLE_Y - ball.r - 1;
    } else {
      posunMicek(currentSpeed * dt);
      zajistiVertikalniPohyb();
    }

    vykresli();
  }

  // pokračuje animace, pokud hra ještě běží
  if (!gameOver) {
    rafId = requestAnimationFrame(krok);
  } else {
    rafId = null;
  }
}

// ==== Ovládání ====

// Přepne ovládání palice podle myši / dotyku na plátně.
function naMyS(xClient) {
  const rect = board.getBoundingClientRect();
  const poměr = (xClient - rect.left) / rect.width;
  // přepočíme na logickou souřadnici plátna (nezáleží na CSS škále)
  const x = poměr * W;
  paddle.x = Math.max(PADDLE_W / 2, Math.min(W - PADDLE_W / 2, x));
  if (ball.stuck) {
    ball.x = paddle.x;
    ball.y = PADDLE_Y - ball.r - 1;
  }
  vykresli();
}

board.addEventListener("mousemove", (e) => naMyS(e.clientX));

// dotykové ovládání — táhni palici, tažení spustí míček
board.addEventListener("touchstart", (e) => {
  e.preventDefault();
  const t = e.touches[0];
  naMyS(t.clientX);
  if (ball.stuck && !gameOver) odstreliMicek();
}, { passive: false });

board.addEventListener("touchmove", (e) => {
  e.preventDefault();
  const t = e.touches[0];
  naMyS(t.clientX);
}, { passive: false });

// klik / zatáhnutí na plátně = odpočí míček (když je na palici)
board.addEventListener("mousedown", () => {
  if (!gameOver && !paused && ball.stuck) odstreliMicek();
});

// klávesové ovládání
document.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  if (e.key === "ArrowLeft" || k === "a") { keys.left = true; e.preventDefault(); }
  if (e.key === "ArrowRight" || k === "d") { keys.right = true; e.preventDefault(); }

  // mezerník — míček odpočí / nebo pauza, pokud už letí
  if (e.key === " ") {
    e.preventDefault();
    if (gameOver) return;
    if (ball.stuck) odstreliMicek();
    else prepnPause();
  }

  // P = pauza
  if (k === "p") prepnPause();

  // R = nová hra
  if (k === "r") restart();
});

document.addEventListener("keyup", (e) => {
  const k = e.key.toLowerCase();
  if (e.key === "ArrowLeft" || k === "a") keys.left = false;
  if (e.key === "ArrowRight" || k === "d") keys.right = false;
});

// ==== Spojení tlačítek ====
launchBtn.addEventListener("click", () => {
  if (!gameOver && ball.stuck) {
    odstreliMicek();
    launchBtn.hidden = true;
    // pokud jsme z překryvu úrovně, pokračuj
    paused = false;
    pokazHry(false);
    lastTime = performance.now();
  }
});

pauseBtn.addEventListener("click", () => {
  // prepnPause aktualizuje text tlačítka i překryv
  prepnPause();
});

// tlačítko v překryvu — dává smysl podle kontextu (pauza / konec / úroveň)
overlayBtn.addEventListener("click", () => {
  if (gameOver) {
    restart();
  } else if (paused) {
    paused = false;
    // pokud míček leží na palici, počká na odpočet
    pokazHry(false);
    lastTime = performance.now();
  }
});

restartBtn.addEventListener("click", restart);

// ==== Spouštění ====
document.addEventListener("DOMContentLoaded", () => {
  best = nainicializujRekord();
  restart();
});
