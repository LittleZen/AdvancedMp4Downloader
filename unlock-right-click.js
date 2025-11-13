// Sblocca il menu contestuale senza toccare mousedown/timeline
(function () {
  try {
    // 1) rimuovi SOLO gli handler inline di contextmenu
    function clearInline() {
      [document, document.documentElement, document.body].forEach(el => {
        if (!el) return;
        try { el.oncontextmenu = null; } catch(e){}
      });
    }
    clearInline();

    // 2) osserva il DOM per nuovi oncontextmenu inline
    try {
      const mo = new MutationObserver(muts => {
        for (const m of muts) {
          if (m.type === "attributes" && m.attributeName === "oncontextmenu") {
            try { m.target.oncontextmenu = null; } catch(e){}
          }
        }
      });
      mo.observe(document.documentElement || document, {
        subtree: true,
        attributes: true,
        attributeFilter: ["oncontextmenu"]
      });
    } catch(e){}

    // 3) listener in capture su contextmenu:
    //    - impedisce che i listener della pagina blocchino il menu
    //    - NON tocca mousedown, quindi la timeline rimane cliccabile
    function allowContextMenu(e) {
      // Mac: ctrl+click produce comunque 'contextmenu' con button 0 → usiamo solo il tipo
      try { e.preventDefault = () => {}; } catch(_) {}
      try { e.stopImmediatePropagation(); } catch(_) {}
      try { e.stopPropagation(); } catch(_) {}
      // Garantisce che defaultPrevented risulti sempre false
      try { Object.defineProperty(e, "defaultPrevented", { get: () => false }); } catch(_) {}
    }
    window.addEventListener("contextmenu", allowContextMenu, true);

    // 4) piccolo CSS per consentire selezione testo (non tocca pointer-events)
    try {
      const st = document.createElement("style");
      st.textContent = "*{-webkit-user-select:text!important;user-select:text!important;-webkit-touch-callout:default!important;}";
      document.documentElement.appendChild(st);
    } catch(e){}

  } catch (err) {
    // silenzioso
  }
})();
