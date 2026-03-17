const app = {
    // Wird ausgeführt, sobald die Seite geladen ist
    init: function() {
        console.log("Wurstwerk App erfolgreich gestartet!");
        // Wenn die App lädt, prüfen wir, ob die assistant.js da ist und laden die Liste
        if (typeof assistant !== 'undefined' && assistant.renderRecentPurchases) {
            assistant.renderRecentPurchases();
        }
    },

    // Steuert das Wechseln zwischen Einkauf, Lager und Produktion
    switchView: function(viewId) {
        // 1. Alle Ansichten (Views) ausblenden
        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active');
            view.style.display = 'none'; // Hartes Verstecken zur Sicherheit
        });
        
        // 2. Gewählte Ansicht einblenden
        const activeView = document.getElementById(viewId);
        if (activeView) {
            activeView.classList.add('active');
            activeView.style.display = 'block';
        }

        // 3. Farbe der Navigations-Buttons unten anpassen (Grün für aktiv)
        document.querySelectorAll('.bottom-nav button').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const navId = 'nav-' + viewId.split('-')[1]; // Macht aus 'view-lager' -> 'nav-lager'
        const activeNav = document.getElementById(navId);
        if (activeNav) {
            activeNav.classList.add('active');
        }
        
        // 4. Daten aktualisieren, je nachdem wo wir hingehen
        if (viewId === 'view-einkauf' && typeof assistant !== 'undefined') {
            assistant.renderRecentPurchases();
        }
        // Hier kommt später die Lade-Logik für view-lager hin
    },

    // Einfache Suchfunktion für das Lager (filtert die angezeigten Elemente)
    filterLager: function() {
        const searchTerm = document.getElementById('search-lager').value.toLowerCase();
        const items = document.querySelectorAll('.lager-item');
        
        items.forEach(item => {
            const text = item.innerText.toLowerCase();
            if (text.includes(searchTerm)) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    }
};

// Startet die App, sobald das Fenster komplett geladen ist
window.onload = function() {
    app.init();
};
