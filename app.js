const app = {
    currentFilter: 'Alle', // Speichert, welche Kategorie im Lager gerade aktiv ist
    inventoryData: [],     // Speicher für alle Lagerartikel
    kundenData: [],        // Speicher für Kunden (wegen der Pfandgläser)

    // Startet die App
    init: async function() {
        console.log("Wurstwerk App synchronisiert...");
        await this.refreshData();
    },

    // Setzt den Filter im Lager (Fleisch, Gewürze, etc.)
    setFilter: function(category, clickedElement) {
        this.currentFilter = category;
        
        // Optik der Filter-Buttons anpassen
        if (clickedElement) {
            document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
            clickedElement.classList.add('active');
        }

        this.renderInventory();
    },

    // Holt alle Daten frisch aus Supabase
    refreshData: async function() {
        try {
            // 1. Lagerdaten holen
            this.inventoryData = await db.getInventory();
            
            // 2. Kundendaten holen (für die Pfand-Berechnung)
            const kundenRes = await fetch(`${supabaseUrl}/rest/v1/customers?select=pfand_schulden,name`, {
                headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
            });
            this.kundenData = await kundenRes.json();

            // 3. Berechnungen durchführen
            this.updateUI();

        } catch (error) {
            console.error("Fehler beim Laden der Daten:", error);
        }
    },

    // Berechnet die Statistiken und füllt die Felder
    updateUI: function() {
        let warenWert = 0;
        let totalGlaeserEingekauft = 0;
        let umlaufGlaeser = 0;

        // Warenwert berechnen (Maschinen und Gläser zählen NICHT zum Fleischwert)
        this.inventoryData.forEach(item => {
            const price = Number(item.price) || 0;
            if (item.category === 'Pfandglas') {
                totalGlaeserEingekauft += Number(item.amount) || 0;
            } else if (item.category !== 'Maschine') {
                warenWert += price;
            }
        });

        // Pfandgläser im Umlauf (bei Kunden) zusammenrechnen
        this.kundenData.forEach(k => {
            umlaufGlaeser += Number(k.pfand_schulden) || 0;
        });

        // Die "Wahrheit" im Regal
        const regalGlaeser = totalGlaeserEingekauft - umlaufGlaeser;

        // --- DASHBOARD & LAGER STATS BEFÜLLEN ---
        // Dashboard (index.html)
        if (document.getElementById('stat-wert')) document.getElementById('stat-wert').innerText = warenWert.toFixed(2);
        if (document.getElementById('stat-gläser')) document.getElementById('stat-gläser').innerText = regalGlaeser;

        // Lager-Übersicht (lager.html)
        if (document.getElementById('stat-warenwert')) document.getElementById('stat-warenwert').innerText = warenWert.toFixed(2);
        if (document.getElementById('stat-regal-glaeser')) document.getElementById('stat-regal-glaeser').innerText = regalGlaeser;

        // Gläser-Detail-Box (lager.html)
        if (document.getElementById('glass-total')) document.getElementById('glass-total').innerText = totalGlaeserEingekauft;
        if (document.getElementById('glass-umlauf')) document.getElementById('glass-umlauf').innerText = umlaufGlaeser;
        if (document.getElementById('glass-regal-final')) document.getElementById('glass-regal-final').innerText = regalGlaeser;

        // Listen im Lager zeichnen
        this.renderInventory();
        
        // Timer/Produktionen laden (falls vorhanden)
        if (typeof production !== 'undefined' && production.loadActiveProcesses) {
            production.loadActiveProcesses();
        }
    },

    // Baut die HTML-Listen im Lager zusammen
    renderInventory: function() {
        const lagerListe = document.getElementById('inventory-list');
        const recentSection = document.getElementById('recent-section');
        const recentListe = document.getElementById('recent-list');
        const umlaufSection = document.getElementById('umlauf-section');
        const umlaufListe = document.getElementById('umlauf-list');

        if (!lagerListe) return; // Wir sind nicht auf der Lager-Seite

        // 1. ZULETZT HINZUGEFÜGT (Nur wenn Filter auf 'Alle')
        if (this.currentFilter === 'Alle' && recentSection) {
            recentSection.style.display = 'block';
            const sortedRecent = [...this.inventoryData].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 3);
            recentListe.innerHTML = '';
            sortedRecent.forEach(item => recentListe.innerHTML += this.createCardHTML(item, true));
        } else if (recentSection) {
            recentSection.style.display = 'none';
        }

        // 2. HAUPTLISTE FILTERN
        const filtered = this.inventoryData.filter(i => this.currentFilter === 'Alle' || i.category === this.currentFilter);
        lagerListe.innerHTML = '';
        
        // Alphabetisch sortieren
        filtered.sort((a, b) => a.name.localeCompare(b.name)).forEach(item => {
            lagerListe.innerHTML += this.createCardHTML(item, false);
        });

        // 3. UMLAUF-LISTE (Nur wenn Filter auf 'Pfandglas')
        if (this.currentFilter === 'Pfandglas' && umlaufSection) {
            umlaufSection.style.display = 'block';
            umlaufListe.innerHTML = '';
            this.kundenData.filter(k => k.pfand_schulden > 0).forEach(k => {
                umlaufListe.innerHTML += `
                    <div class="list-card" style="border-left: 3px solid var(--accent-danger);">
                        <div class="info">
                            <h3>${k.name}</h3>
                            <p>Besitzt aktuell ${k.pfand_schulden} Pfandgläser</p>
                        </div>
                    </div>`;
            });
            // Spezial-Box für Gläser anzeigen (lager.html)
            if(document.getElementById('glass-details')) document.getElementById('glass-details').style.display = 'block';
        } else {
            if (umlaufSection) umlaufSection.style.display = 'none';
            if(document.getElementById('glass-details')) document.getElementById('glass-details').style.display = 'none';
        }
    },

    // Hilfsfunktion für die Lager-Karten
    createCardHTML: function(item, isRecent) {
        let displayAmount = item.amount;
        let icon = 'inventory_2';
        
        // Spezial-Logik für Icons und Glas-Bestand
        if (item.category === 'Fleisch') icon = 'set_meal';
        if (item.category === 'Gewürz') icon = 'grain';
        if (item.category === 'Maschine') icon = 'build';
        if (item.category === 'Pfandglas') {
            icon = 'recycling';
            // Im Lager zeigen wir bei Gläsern NUR das, was wirklich im Regal steht
            let gesamtUmlauf = 0;
            this.kundenData.forEach(k => gesamtUmlauf += Number(k.pfand_schulden));
            displayAmount = Number(item.amount) - gesamtUmlauf;
        }

        const border = isRecent ? 'border-left: 3px solid var(--accent-amber);' : '';

        return `
            <div class="list-card" style="${border}">
                <div class="icon-box"><span class="material-symbols-outlined">${icon}</span></div>
                <div class="info">
                    <h3>${item.name}</h3>
                    <p>${displayAmount} ${item.unit} | Wert: ${Number(item.price).toFixed(2)}€</p>
                </div>
                <button onclick="app.deleteItem('${item.id}')" style="background:none; border:none; color:var(--accent-danger); cursor:pointer;">
                    <span class="material-symbols-outlined">delete</span>
                </button>
            </div>`;
    },

    // Löscht einen Artikel
    deleteItem: async function(id) {
        if (!confirm("Artikel restlos aus dem Lager entfernen?")) return;
        try {
            const res = await fetch(`${supabaseUrl}/rest/v1/inventory?id=eq.${id}`, {
                method: 'DELETE',
                headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
            });
            if (res.ok) await this.refreshData();
        } catch (e) { alert("Fehler beim Löschen."); }
    }
};

document.addEventListener('DOMContentLoaded', () => app.init());
