// ====== Herní rozcestník — generování karet her ======
// Přidání nové hry spočívá v doplnění jednoho záznamu do pole HERY níže.
// `href` musí ukazovat na soubor se start stránkou dané hry (podadresář hry).
const HERY = [
  {
    nazev: "Tetris",
    popis: "Otáčejte a posouvejte padající kostky tak, aby zaplnily celé řádky.",
    ikona: "🧱",
    href: "tetris/index.html",
  },
  {
    nazev: "Miny",
    popis: "Podle čísel odhalte ukryté miny a odkryjte všechna bezpečná pole.",
    ikona: "💣",
    href: "miny/index.html",
  },
  {
    nazev: "Had",
    popis: "Sbírejte jídlo a rosťte – okraji pole projedete, jen nenarazte do vlastního těla.",
    ikona: "🐍",
    href: "had/index.html",
  },
  {
    nazev: "Arkanoid",
    popis: "Rozbijte všechny cihly míčkem, který odrážíte plošinou.",
    ikona: "🧨",
    href: "arkanoid/index.html",
  },
  {
    nazev: "Piškvorky",
    popis: "Spojte pět svých značek do řady dřív než počítač.",
    ikona: "⚪",
    href: "pente/index.html",
  },
  {
    nazev: "Tenis",
    popis: "Arkádový tenis ve stylu Pongu proti počítači nebo pro dva hráče.",
    ikona: "🎾",
    href: "tenis/index.html",
  },
  {
    nazev: "Dáma",
    popis: "Klasická dáma proti počítači – berte kameny a proměňujte je v dámy.",
    ikona: "♛",
    href: "dama/index.html",
  },
  {
    nazev: "2048",
    popis: "Posouvejte dlaždice, spojujte stejná čísla a vytvořte dlaždici 2048.",
    ikona: "🔢",
    href: "2048/index.html",
  },
  {
    nazev: "Karetní pexeso",
    popis: "Otáčejte karty po dvou a najděte všechny dvojice na co nejméně tahů.",
    ikona: "🃏",
    href: "pexeso/index.html",
  },
  // další hry se přidávají sem, např.:
  // { nazev: "Rebus", popis: "Uhodněte slovo podle obrázku.", ikona: "🧩", href: "rebus/index.html" },
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
