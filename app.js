const app = {
    currentFilter: 'Alle', // Speichert, welcher Filter gerade aktiv ist
    inventoryData: [],     // Speichert das gesamte Lager

    init: async function() {
        console.log("Wurstwerk App synchronisiert...");
        await this.refreshData();
    },

    // Wenn man auf einen Filter-Button tippt
    setFilter: function(category, clickedElement) {
        this.currentFilter = category;
        
        // Optik der Buttons anpassen
        document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
        clickedElement.classList.add('active');

        // Die Listen neu aufbauen
        this.renderInventory();
    },

    refreshData: async function() {
        try {
            // 1. Lagerdaten UND Kundendaten holen (für die Pfandgläser im Umlauf)
            this.inventoryData = await db.getInventory();
            
            // Wir versuchen die Kunden zu holen, wenn es fehlschlägt, ist es 0
            let kundenData = [];
            try {
                const kundenRes = await fetch(`${supabaseUrl}/rest/v1/customers?select=pfand_schulden`, {
                    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
                });
                if(kundenRes.ok) kundenData = await kundenRes.json();
            } catch (e) { console.log("Kunden konnten noch nicht geladen werden."); }

            // --- BERECHNUNGEN ---
            let warenWert = 0;
            let leereGlaeser = 0;
            let umlaufGlaeser = 0;

            // Warenwert und leere Gläser berechnen
            this.inventoryData.forEach(item => {
                const price = Number(item.price) || 0;
                if (item.category === 'Pfandglas') {
                    leereGlaeser += Number(item.amount) || 0;
                } else if (item.category !== 'Maschine') {
                    warenWert += price; // Maschinen fliegen aus dem Warenwert raus
                }
            });

            // Gläser im Umlauf (Pfandschulden der Kunden zusammenrechnen)
            kundenData.forEach(kunde => {
                umlaufGlaeser += Number(kunde.pfand_schulden) || 0;
            });

            // --- ZAHLEN INS HTML SCHREIBEN ---
            if (document.getElementById('stat-warenwert')) document.getElementById('stat-warenwert').innerText = warenWert.toFixed(2);
            if (document.getElementById('stat-leere-glaeser')) document.getElementById('stat-leere-glaeser').innerText = leereGlaeser;
            if (document.getElementById('stat-umlauf-glaeser')) document.getElementById('stat-umlauf-glaeser').innerText = umlaufGlaeser;
            
            // Für die Startseite (index.html)
            if (document.getElementById('stat-wert')) document.getElementById('stat-wert').innerText = warenWert.toFixed(2);
            if (document.getElementById('stat-gläser')) document.getElementById('stat-gläser').innerText = leereGlaeser;

            // Listen zeichnen
            this.renderInventory();

            // Produktionen laden (falls auf der Home-Seite)
            if (typeof production !== 'undefined' && production.loadActiveProcesses) {
                await production.loadActiveProcesses();
            }

        } catch (error) {
            console.error("Fehler beim Aktualisieren:", error);
        }
    },

    // Diese Funktion baut das HTML für die Listen auf
    renderInventory: function() {
        const lagerListe = document.getElementById('inventory-list');
        const recentListe = document.getElementById('recent-list');
        const recentSection = document.getElementById('recent-section');
        const titleElement = document.getElementById('inventory-title');

        if (!lagerListe) return; // Wenn wir nicht auf der Lager-Seite sind, abbrechen

        lagerListe.innerHTML = '';
        if (recentListe) recentListe.innerHTML = '';

        // 1. ZULETZT HINZUGEFÜGT (Die 3 neuesten Einträge finden)
        if (this.currentFilter === 'Alle' && recentSection) {
            recentSection.style.display = 'block';
            titleElement.innerText = 'Komplettes Lager';
            
            // Sortieren nach Erstelldatum (oder ID als Ersatz) und die neuesten 3 nehmen
            const sortedRecent = [...this.inventoryData].sort((a, b) => {
                return new Date(b.created_at || 0) - new Date(a.created_at || 0);
            }).slice(0, 3);

            if (sortedRecent.length > 0) {
                sortedRecent.forEach(item => recentListe.innerHTML += this.createCardHTML(item, true));
            } else {
                recentListe.innerHTML = '<p class="text-muted">Noch keine Einträge.</p>';
            }
        } else {
            if (recentSection) recentSection.style.display = 'none';
            if (titleElement) titleElement.innerText = `Lagerbestand: ${this.currentFilter}`;
        }

        // 2. DAS GEFILTERTE LAGER AUFBAUEN
        const filteredData = this.inventoryData.filter(item => {
            if (this.currentFilter === 'Alle') return true;
            return item.category === this.currentFilter;
        });

        if (filteredData.length === 0) {
            lagerListe.innerHTML = '<p class="text-muted" style="text-align:center; margin-top:30px;">Keine Artikel in dieser Kategorie.</p>';
        } else {
            // Alphabetisch sortieren für die Hauptliste
            const sortedAlphabetisch = [...filteredData].sort((a, b) => a.name.localeCompare(b.name));
            sortedAlphabetisch.forEach(item => lagerListe.innerHTML += this.createCardHTML(item, false));
        }
    },

    // Hilfsfunktion: Baut den HTML-Code für eine Karte (Listeneintrag)
    createCardHTML: function(item, isRecent) {
        let unitPriceInfo = "";
        if (item.amount > 0 && item.price > 0 && item.category !== 'Maschine') {
            if (item.unit === 'g') {
                const kgPreis = (item.price / item.amount) * 1000;
                unitPriceInfo = `<span style="font-size: 0.8rem; color: #aaa;">(${kgPreis.toFixed(2)}€/kg)</span>`;
            } else {
                const stueckPreis = item.price / item.amount;
                unitPriceInfo = `<span style="font-size: 0.8rem; color: #aaa;">(${stueckPreis.toFixed(2)}€/${item.unit})</span>`;
            }
        }

        let icon = 'inventory_2';
        if (item.category === 'Fleisch') icon = 'set_meal';
        if (item.category === 'Gewürz') icon = 'grain';
        if (item.category === 'Maschine') icon = 'build';
        if (item.category === 'Pfandglas') icon = 'recycling';

        // Wenn es bei "Zuletzt hinzugefügt" ist, geben wir ihm einen leichten farbigen Rand
        const borderStyle = isRecent ? 'border-left: 3px solid var(--accent-amber);' : '';

        return `
            <div class="list-card" style="${borderStyle}">
                <div class="icon-box"><span class="material-symbols-outlined">${icon}</span></div>
                <div class="info">
                    <h3>${item.name}</h3>
                    <p>${item.amount} ${item.unit} | Gesamt: ${Number(item.price).toFixed(2)}€ ${unitPriceInfo}</p>
                </div>
                <button onclick="app.deleteItem('${item.id}')" style="background:none; border:none; color:var(--accent-danger); cursor:pointer; padding:10px;">
                    <span class="material-symbols-outlined">delete</span>
                </button>
            </div>
        `;
    },

    deleteItem: async function(id) {
        if (!confirm("Restlos aus dem Lager entfernen?")) return;
        try {
            const res = await fetch(`${supabaseUrl}/rest/v1/inventory?id=eq.${id}`, {
                method: 'DELETE',
                headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
            });
            if (res.ok) await this.refreshData();
        } catch (e) { alert("Löschen fehlgeschlagen."); }
    }
};

document.addEventListener('DOMContentLoaded', () => app.init());
