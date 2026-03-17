const app = {
    // Wird ausgeführt, sobald die App geladen ist
    init: async function() {
        console.log("Wurstwerk App gestartet!");
        
        // Lade die Daten für die Startseite (Dashboard) und das Lager
        await this.loadDashboard();
        await this.loadLager();
        
        // Falls der Einkauf-Tab geladen werden soll
        if (typeof assistant !== 'undefined' && assistant.renderRecentPurchases) {
            assistant.renderRecentPurchases();
        }
    },

    // Wechselt die Ansichten (Home, Lager, Einkauf etc.)
    switchView: function(viewId) {
        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active');
            view.style.display = 'none';
        });
        
        const activeView = document.getElementById(viewId);
        if (activeView) {
            activeView.classList.add('active');
            activeView.style.display = 'block';
        }

        document.querySelectorAll('.bottom-nav button').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const navId = 'nav-' + viewId.split('-')[1];
        const activeNav = document.getElementById(navId);
        if (activeNav) {
            activeNav.classList.add('active');
        }
        
        // Aktualisiere die Daten, wenn ein Tab geöffnet wird
        if (viewId === 'view-dashboard') this.loadDashboard();
        if (viewId === 'view-lager') this.loadLager();
        if (viewId === 'view-einkauf' && typeof assistant !== 'undefined') assistant.renderRecentPurchases();
    },

    // ================= NEU: DASHBOARD LADEN =================
    loadDashboard: async function() {
        document.getElementById('db-status').innerText = "Verbinde...";
        
        const inventory = await db.getInventory();
        
        let totalValue = 0;
        let totalItems = inventory.length;

        // Gesamtwert berechnen
        inventory.forEach(item => {
            if(item.price) {
                totalValue += Number(item.price);
            }
        });

        // Werte ins Dashboard schreiben
        document.getElementById('dash-value').innerText = totalValue.toFixed(2).replace('.', ',') + ' €';
        document.getElementById('dash-items').innerText = totalItems + ' Positionen';
        
        // Status oben rechts auf "Verbunden" setzen
        document.getElementById('db-status').innerText = "Verbunden";
    },

    // ================= NEU: LAGER LADEN =================
    loadLager: async function() {
        const inventory = await db.getInventory();
        const lagerList = document.getElementById('lager-list');
        
        if (!inventory || inventory.length === 0) {
            lagerList.innerHTML = '<p style="text-align:center; color:#666; margin-top: 20px;">Dein Lager ist leer.</p>';
            return;
        }

        lagerList.innerHTML = ''; // Liste leeren
        
        // Alphabetisch sortieren
        inventory.sort((a, b) => a.name.localeCompare(b.name));

        inventory.forEach(item => {
            // Preis formatieren, falls vorhanden
            let priceString = item.price ? ` | ${Number(item.price).toFixed(2).replace('.', ',')} €` : '';
            
            lagerList.innerHTML += `
                <div class="lager-item">
                    <div class="lager-item-info">
                        <strong>${item.name}</strong>
                        <span>Zuletzt gebucht: ${item.last_updated ? new Date(item.last_updated).toLocaleDateString('de-DE') : 'Unbekannt'} ${priceString}</span>
                    </div>
                    <div class="lager-item-amount">
                        ${item.amount} <small>${item.unit || 'Stk'}</small>
                    </div>
                </div>
            `;
        });
    },

    // Suchfunktion für das Lager
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

// Startet die App automatisch
window.onload = function() {
    app.init();
};
