// ====== Přepínač motivu (tmavý / světlý) — společný pro menu i všechny hry ======
// Skript běží synchronně v <head>, takže motiv je aplikován na <html> ještě před
// vykreslením těla stránky a tím se vyhneme "bliknutí" jiného motivu při načtení.
(function () {
  // Klíč pro uložení volby motivu v localStorage (sdílený napříč všemi stránkami).
  const KLIC = "hryMotiv";
  // Název parametru v URL, kterým si stránky motiv předávají při přechodu odkazem.
  const URL_PARAMETR = "motiv";

  // Ověří, že jde o známou hodnotu motivu (ochrana proti nesmyslům z URL či úložiště).
  function jePlatny(motiv) {
    return motiv === "svetly" || motiv === "tmavy";
  }

  // Čte uložený motiv; při chybě (např. soukromý režim) vrátí null.
  function cteniUlozeny() {
    try {
      return localStorage.getItem(KLIC);
    } catch (err) {
      return null;
    }
  }

  // Uloží motiv do localStorage; nedostupné úložiště tiše ignoruje.
  function ulozit(motiv) {
    try {
      localStorage.setItem(KLIC, motiv);
    } catch (err) {
      // localStorage nemusí být dostupný — motiv se přepne jen pro aktuální pohled
    }
  }

  // Přečte motiv z parametru URL (?motiv=svetly), který sem poslala předchozí stránka.
  // Je to nutné při otevření přes file://, kde má Firefox (a někdy Safari) pro každý
  // soubor vlastní localStorage, takže uložená volba by se mezi hrami nepřenesla.
  function cteniZUrl() {
    try {
      return new URLSearchParams(window.location.search).get(URL_PARAMETR);
    } catch (err) {
      return null;
    }
  }

  // Odstraní parametr motivu z adresního řádku, aby URL zůstala čistá
  // (volba je už uložená v localStorage této stránky).
  function vycistitUrl() {
    try {
      const adresa = new URL(window.location.href);
      if (!adresa.searchParams.has(URL_PARAMETR)) {
        return;
      }
      adresa.searchParams.delete(URL_PARAMETR);
      history.replaceState(history.state, "", adresa.href);
    } catch (err) {
      // replaceState může být v některých prostředích zakázán — URL pak ponecháme
    }
  }

  // Aplikuje motiv jako atribut data-motiv na <html>; CSS si podle něj přepíše barvy.
  function aplikuj(motiv) {
    document.documentElement.dataset.motiv = motiv === "svetly" ? "svetly" : "tmavy";
  }

  // Vrátí aktuálně aktivní motiv podle atributu na <html>.
  function aktivni() {
    return document.documentElement.dataset.motiv === "svetly" ? "svetly" : "tmavy";
  }

  // Inicializace — přednost má motiv předaný v URL, pak uložený, jinak výchozí světlý.
  const zUrl = cteniZUrl();
  let pocatecni;
  if (jePlatny(zUrl)) {
    pocatecni = zUrl;
    ulozit(zUrl);
  } else {
    pocatecni = cteniUlozeny();
  }
  if (!jePlatny(pocatecni)) {
    pocatecni = "svetly";
  }
  aplikuj(pocatecni);
  vycistitUrl();

  // Globální dotaz na aktivní motiv — canvas hry jím volí barvy pozadí a čar.
  window.hrySvetlyMotiv = function () {
    return aktivni() === "svetly";
  };

  // Nastaví nový motiv, aktualizuje tlačítko a oznámí změnu hrám.
  // Parametry: motiv — "svetly" | "tmavy"; ulozitVolbu — zda zapsat do localStorage.
  function nastav(motiv, ulozitVolbu) {
    // beze změny nic nepřekreslujeme (např. při obnovení stránky se stejným motivem)
    if (motiv === aktivni()) {
      return;
    }
    aplikuj(motiv);
    if (ulozitVolbu) {
      ulozit(motiv);
    }
    aktualizujTlacitko();
    // canvas hry naslouchají této události a překreslí herní pole novými barvami
    window.dispatchEvent(new CustomEvent("hry:motiv", { detail: { motiv: motiv } }));
  }

  // Přepne motiv kliknutím na tlačítko a volbu uloží.
  function prepnout() {
    nastav(aktivni() === "svetly" ? "tmavy" : "svetly", true);
  }

  // Nastaví ikonu a popis tlačítka dle aktuálního motivu (ikonou se motiv přepíná).
  function aktualizujTlacitko() {
    const svetly = aktivni() === "svetly";
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

  // Před přechodem interním odkazem (menu ↔ hra) připíše do jeho URL aktuální motiv,
  // aby cílová stránka motiv převzala i tam, kde nesdílí localStorage (file://).
  // Delegace na document pokryje i karty her, které menu generuje až po načtení.
  function pripsatMotivDoOdkazu(udalost) {
    const odkaz = udalost.target.closest ? udalost.target.closest("a[href]") : null;
    if (!odkaz) {
      return;
    }
    // jen odkazy v rámci stejného webu/složky; externí adresy necháváme beze změny
    if (odkaz.protocol !== window.location.protocol || odkaz.host !== window.location.host) {
      return;
    }
    try {
      const cil = new URL(odkaz.href);
      cil.searchParams.set(URL_PARAMETR, aktivni());
      odkaz.href = cil.href;
    } catch (err) {
      // neplatná adresa odkazu — navigace proběhne bez předání motivu
    }
  }
  // click = běžné kliknutí, auxclick = prostřední tlačítko (otevření v nové záložce)
  document.addEventListener("click", pripsatMotivDoOdkazu, true);
  document.addEventListener("auxclick", pripsatMotivDoOdkazu, true);

  // Při návratu tlačítkem Zpět se stránka obnoví z bfcache bez nového spuštění skriptu,
  // proto motiv znovu načteme z úložiště (volba mezitím mohla být změněna jinde).
  window.addEventListener("pageshow", function (udalost) {
    if (!udalost.persisted) {
      return;
    }
    const ulozeny = cteniUlozeny();
    if (jePlatny(ulozeny)) {
      nastav(ulozeny, false);
    }
  });

  // Změna motivu v jiné otevřené záložce se ihned promítne i do této stránky.
  window.addEventListener("storage", function (udalost) {
    if (udalost.key === KLIC && jePlatny(udalost.newValue)) {
      nastav(udalost.newValue, false);
    }
  });

  // Po načtení DOM vytvoříme tlačítko a nastavíme jeho počáteční ikonu.
  document.addEventListener("DOMContentLoaded", function () {
    vytvoritTlacitko();
    aktualizujTlacitko();
  });
})();
