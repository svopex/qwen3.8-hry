// ====== Herní rozcestník — generování karet her ======
// Přidání nové hry spočívá v doplnění jednoho záznamu do pole HERY níže.
// `href` musí ukazovat na soubor se start stránkou dané hry (podadresář hry).
const HERY = [
  {
    nazev: "Tetris",
    popis: "Klasická skládačka z kostek.",
    ikona: "🧱",
    href: "tetris/index.html",
  },
  {
    nazev: "Miny",
    popis: "Najdi všechny miny ve velkém polí.",
    ikona: "💣",
    href: "miny/index.html",
  },
  {
    nazev: "Had",
    popis: "Klasický had — projíždí zeďmi a vynoří se na opačné straně pole.",
    ikona: "🐍",
    href: "had/index.html",
  },
  {
    nazev: "Arkanoid",
    popis: "Rozbij všechny cihly míčkem odrazujícím od palice.",
    ikona: "🧨",
    href: "arkanoid/index.html",
  },
  // další hry se přidávají sem, např.:
  // { nazev: "Paměť", popis: "Převoj dvojic karet.", ikona: "🃏", href: "pamet/index.html" },
];

// Vykreslí všechny karty do kontejneru menuGrid
function vykreslitMenu() {
  const cil = document.getElementById("menuGrid");
  if (!cil) {
    return;
  }

  cil.innerHTML = ""; // při výměně obsahu nejprve vyčisti staré karty

  HERY.forEach((hra) => {
    const karta = document.createElement("a");
    karta.className = "game-card";
    karta.href = hra.href;

    const ikona = document.createElement("span");
    ikona.className = "game-icon";
    ikona.textContent = hra.ikona;

    const nazev = document.createElement("span");
    nazev.className = "game-name";
    nazev.textContent = hra.nazev;

    const popis = document.createElement("p");
    popis.className = "game-desc";
    popis.textContent = hra.popis;

    karta.append(ikona, nazev, popis);
    cil.appendChild(karta);
  });
}

// Spusť generování po načtení DOM (skript je načtený s defer)
document.addEventListener("DOMContentLoaded", vykreslitMenu);
