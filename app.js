const app = {
    currentFilter: 'Alle',
    inventoryData: [],
    kundenData: [],

    init: async function() {
        await this.refreshData();
    },

    setFilter: function(category, clickedElement) {
        this.currentFilter = category;
        document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
        if(clickedElement) clickedElement.classList.add('active');
        this.render();
    },

    refreshData: async function() {
        try {
            // Daten parallel laden
            [this.inventoryData, this.kundenData] = await Promise.all([
                db.getInventory(),
                db.getCustomers()
            ]);
            this.render();
        } catch (e) { console.error("Sync-Fehler:", e); }
    },

    render: function() {
        // --- 1. GLOBALE BERECHNUNGEN ---
        let warenWert = 0;
        let gesamtGekaufteGlaeser = 0;
        let pfandImUmlauf = 0;

        // Inventar durchgehen
        this.inventoryData.forEach(item => {
            const preis = Number(item.price) || 0;
            if (item.category === 'Pfandglas') {
                gesamtGekaufteGlaeser += Number(item.amount) || 0;
            } else if (item.category !== 'Maschine') {
                // Nur Fleisch, Gewürze und Material zählen zum Warenwert
                warenWert += preis;
            }
        });

        // Kundenschulden (Umlauf) berechnen
        this.kundenData.forEach(k => {
            pfandImUmlauf += Number(k.pfand_schulden) || 0;
        });

        const regalGlaeser = gesamtGekaufteGlaeser - pfandImUmlauf;

        // --- 2. STATS AKTUALISIEREN ---
        // Home
        if(document.getElementById('stat-wert')) document.getElementById('stat-wert').innerText = warenWert.toFixed(2);
        if(document.getElementById('stat-gläser')) document.getElementById('stat-gläser').innerText = regalGlaeser;
        
        // Lager
        if(document.getElementById('stat-warenwert')) document.getElementById('stat-warenwert').innerText = warenWert.toFixed(2);
        if(document.getElementById('stat-regal-glaeser')) document.getElementById('stat-regal-glaeser').innerText = regalGlaeser;

        // --- 3. LISTEN RENDERN (Nur auf lager.html) ---
        const lagerListe = document.getElementById('inventory-list');
        if (!lagerListe) return;

        // Gläser-Spezial-Box
        const glassBox = document.getElementById('glass-summary');
        const debtSection = document.getElementById('customer-debt-section');
        const recentSection = document.getElementById('recent-section');

        if (this.currentFilter === 'Pfandglas') {
            glassBox.style.display = 'block';
            debtSection.style.display = 'block';
            recentSection.style.display = 'none';
            document.getElementById('glass-total').innerText = gesamtGekaufteGlaeser;
            document.getElementById('glass-out').innerText = pfandImUmlauf;
            document.getElementById('glass-final').innerText = regalGlaeser;

            // Schuldner-Liste
            const debtList = document.getElementById('customer-debt-list');
            debtList.innerHTML = '';
            this.kundenData.filter(k => k.pfand_schulden > 0).forEach(k => {
                debtList.innerHTML += `
                    <div class="list-card" style="border-left:3px solid var(--accent-danger)">
                        <div class="info"><h3>${k.name}</h3><p>Hat noch ${k.pfand_schulden} Gläser</p></div>
                    </div>`;
            });
        } else {
            if(glassBox) glassBox.style.display = 'none';
            if(debtSection) debtSection.style.display = 'none';
            if(recentSection) recentSection.style.display = (this.currentFilter === 'Alle') ? 'block' : 'none';
        }

        // Zuletzt hinzugefügt
        const recentList = document.getElementById('recent-list');
        if (recentList && this.currentFilter === 'Alle') {
            const recentItems = [...this.inventoryData].sort((a,b) => b.id - a.id).slice(0, 3);
            recentList.innerHTML = '';
            recentItems.forEach(item => recentList.innerHTML += this.createCard(item, pfandImUmlauf));
        }

        // Hauptliste
        lagerListe.innerHTML = '';
        const filtered = this.inventoryData.filter(i => this.currentFilter === 'Alle' || i.category === this.currentFilter);
        filtered.forEach(item => {
            lagerListe.innerHTML += this.createCard(item, pfandImUmlauf);
        });
    },

    createCard: function(item, totalUmlauf) {
        let displayAmount = item.amount;
        let icon = 'inventory_2';
        
        if (item.category === 'Pfandglas') {
            displayAmount = Number(item.amount) - totalUmlauf;
            icon = 'recycling';
        } else if (item.category === 'Fleisch') icon = 'set_meal';
          else if (item.category === 'Gewürz') icon = 'grain';

        return `
            <div class="list-card">
                <div class="icon-box"><span class="material-symbols-outlined">${icon}</span></div>
                <div class="info">
                    <h3>${item.name}</h3>
                    <p>${displayAmount} ${item.unit} im Regal | Wert: ${Number(item.price).toFixed(2)}€</p>
                </div>
                <button onclick="app.deleteItem('${item.id}')" style="background:none; border:none; color:var(--accent-danger); cursor:pointer;">
                    <span class="material-symbols-outlined">delete</span>
                </button>
            </div>`;
    },

    deleteItem: async function(id) {
        if (!confirm("Wirklich löschen?")) return;
        const res = await fetch(`${supabaseUrl}/rest/v1/inventory?id=eq.${id}`, {
            method: 'DELETE',
            headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
        });
        if (res.ok) this.refreshData();
    }
};

document.addEventListener('DOMContentLoaded', () => app.init());
