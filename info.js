// ====== Společné info okno — otevírání / zavírání modálního dialogu s popisem hry ======
// Každá stránka hry obsahuje tlačítko .info-toggle a skrytý dialog .info-modal
// s vlastním obsahem (popis, pravidla, ovládání, nastavení). Tento skript jen
// propojí interakci: klik na "?" otevře dialog, Escape / klik mimo / tlačítko ✕
// ho zavře. Obsah dialogu se do stránky vkládá staticky, aby nezávisel na JS.
(function () {
  // Čekáme na DOM, aby existovala tlačítka i dialog.
  document.addEventListener("DOMContentLoaded", function () {
    // tlačítko pro otevření info okna
    const tlacitko = document.querySelector(".info-toggle");
    // samotný modální dialog s obsahem
    const modal = document.querySelector(".info-modal");
    // pokud stránka nemá info okno (např. rozcestník), nic neděláme
    if (!tlacitko || !modal) {
      return;
    }

    // zavírací tlačítko uvnitř panelu
    const zavrit = modal.querySelector(".info-close");
    // element, na kterém byl fokus před otevřením — po zavření ho obnovíme
    let predchoziFokus = null;

    // Seznam kláves, které hry používají pro ovládání — když je info okno
    // otevřené, tyto stisky potlačujeme, aby se hra za dialogem nehýbala.
    const HRAVE_KLAVESY = new Set([
      "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown",
      " ", "w", "a", "s", "d", "r", "p",
    ]);

    // Otevře info okno, posune fokus na zavírací tlačítko a zapne klávesové hlídání.
    function otevrit() {
      predchoziFokus = document.activeElement;
      modal.hidden = false;
      // zamkeme scroll pozadí, aby se při listování dialogu neposouvala stránka
      document.body.style.overflow = "hidden";
      // fokus na zavírací tlačítko pro uživatele klávesnice
      if (zavrit) {
        zavrit.focus();
      }
      // hlídáme klávesy v capture fázi, aby se spustily dřív než herní logika
      document.addEventListener("keydown", klavesoveHlideni, true);
    }

    // Zavře info okno a vrátí fokus na tlačítko, ze kterého jsme otevřeli.
    function zavritModal() {
      modal.hidden = true;
      document.body.style.overflow = "";
      document.removeEventListener("keydown", klavesoveHlideni, true);
      // obnovíme předchozí fokus (tlačítko "?") pro plynulé pokračování
      if (predchoziFokus && typeof predchoziFokus.focus === "function") {
        predchoziFokus.focus();
      }
    }

    // Klávesové hlídání během otevřeného dialogu:
    //   Escape  → zavře dialog
    //   herní klávesy → potlačí, aby se hra za dialogem nehýbala
    function klavesoveHlideni(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        zavritModal();
        return;
      }
      // normalizace velkého písmene pro písmenné klávesy
      const klic = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (HRAVE_KLAVESY.has(klic)) {
        // zabráníme, aby stisk proběhl do herní logiky i do scrollování
        e.preventDefault();
        e.stopPropagation();
      }
    }

    // propojení událostí
    tlacitko.addEventListener("click", otevrit);
    if (zavrit) {
      zavrit.addEventListener("click", zavritModal);
    }
    // klik přímo na pozadí (backdrop) dialogu ho zavře — klik na panel ne
    modal.addEventListener("click", function (e) {
      if (e.target === modal) {
        zavritModal();
      }
    });
  });
})();
