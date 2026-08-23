// ====== Přepínač motivu (tmavý / světlý) — společný pro menu i všechny hry ======
// Skript běží synchronně v <head>, takže motiv je aplikován na <html> ještě před
// vykreslením těla stránky a tím se vyhneme "bliknutí" jiného motivu při načtení.
(function () {
  // Klíč pro uložení volby motivu v localStorage (sdílený napřícel všemi stránkami).
  const KLIC = "hryMotiv";

  // Čte uložený motiv; při chybě (např. soukromý režim) vrátí null.
  function cteniUlozeny() {
    try {
      return localStorage.getItem(KLIC);
    } catch (err) {
      return null;
    }
  }

  // Aplikuje motiv jako atribut data-motiv na <html>; CSS si podle něj přepíše barvy.
  function aplikuj(motiv) {
    document.documentElement.dataset.motiv = motiv === "svetly" ? "svetly" : "tmavy";
  }

  // Inicializace — běží hned při načtení skriptu, výchozí motiv je tmavý.
  let aktualni = cteniUlozeny();
  if (aktualni !== "svetly" && aktualni !== "tmavy") {
    aktualni = "svetly";
  }
  aplikuj(aktualni);

  // Globální dotaz na aktivní motiv — canvas hry jím volí barvy pozadí a čar.
  window.hrySvetlyMotiv = function () {
    return document.documentElement.dataset.motiv === "svetly";
  };

  // Přepne motiv, uloží volbu a oznámí změnu (canvas hry si pak překreslí pole).
  function prepnout() {
    const nove =
      document.documentElement.dataset.motiv === "svetly" ? "tmavy" : "svetly";
    aplikuj(nove);
    try {
      localStorage.setItem(KLIC, nove);
    } catch (err) {
      // localStorage nemusí být dostupný — motiv se přepne jen pro aktuální pohled
    }
    aktualizujTlacitko();
    // canvas hry naslouchají této události a překreslí herní pole novými barvami
    window.dispatchEvent(new CustomEvent("hry:motiv", { detail: { motiv: nove } }));
  }

  // Nastaví ikonu a popis tlačítka dle aktuálního motivu (ikonou se motiv přepíná).
  function aktualizujTlacitko() {
    const svetly = document.documentElement.dataset.motiv === "svetly";
    const tlacitko = document.querySelector(".theme-toggle");
    if (!tlacitko) {
      return;
    }
    tlacitko.textContent = svetly ? "🌙" : "☀️";
    tlacitko.title = svetly ? "Přepnout na tmavý motiv" : "Přepnout na světlý motiv";
    tlacitko.setAttribute("aria-pressed", String(svetly));
  }

  // Vytvoří a vloží ikonové tlačítko nahoře vpravo (společné pro všechny stránky).
  function vytvoritTlacitko() {
    // pokud by tlačítko už existovalo, nevytváříme duplicitu
    if (document.querySelector(".theme-toggle")) {
      return;
    }
    const tlacitko = document.createElement("button");
    tlacitko.type = "button";
    tlacitko.className = "theme-toggle";
    tlacitko.addEventListener("click", prepnout);
    document.body.appendChild(tlacitko);
  }

  // Po načtení DOM vytvoříme tlačítko a nastavíme jeho počáteční ikonu.
  document.addEventListener("DOMContentLoaded", function () {
    vytvoritTlacitko();
    aktualizujTlacitko();
  });
})();
