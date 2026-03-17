const app = {
    currentFilter: 'Alle',
    inventoryData: [],
    kundenData: [],

    init: async function() {
        await this.refreshData();
    },

    // Zeigt/Versteckt die Liste der Kunden mit Gläsern
    toggleGlassList: function() {
        const overlay = document.getElementById('glass-customer-overlay');
        if (!overlay) return;
        const isVisible = overlay.style.display === 'block';
        overlay.style.display = isVisible ? 'none' : 'block';
        
        if (!isVisible) {
            this.renderCustomerDebtList();
        }
    },

    renderCustomerDebtList: function() {
        const list = document.getElementById('glass-customer-list');
        if (!list) return;
        list.innerHTML = '';
        const schuldner = this.kundenData.filter(k => Number(k.pfand_schulden) > 0);
        
        if (schuldner.length === 0) {
            list.innerHTML = '<p class="text-muted">Keine Gläser im Umlauf.</p>';
            return;
        }

        schuldner.forEach(k => {
            list.innerHTML += `
                <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #333;">
                    <span>${k.name}</span>
                    <b style="color: var(--accent-danger);">${k.pfand_schulden} Stk.</b>
                </div>`;
        });
    },

    setFilter: function(category, clickedElement) {
        this.currentFilter = category;
        document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
        if(clickedElement) clickedElement.classList.add('active');
        this.render();
    },

    refreshData: async function() {
        try {
            [this.inventoryData, this.kundenData] = await Promise.all([
                db.getInventory(),
                db.getCustomers()
            ]);
            this.render();
        } catch (e) { console.error("Sync-Fehler:", e); }
    },

    render: function() {
        let warenWert = 0;
        let gesamtGekauft = 0;
        let imUmlauf = 0;

        this.inventoryData.forEach(item => {
            if (item.category === 'Pfandglas') {
                gesamtGekauft += Number(item.amount) || 0;
            } else if (item.category !== 'Maschine') {
                warenWert += Number(item.price) || 0;
            }
        });

        this.kundenData.forEach(k => imUmlauf += Number(k.pfand_schulden) || 0);
        const imRegal = gesamtGekauft - imUmlauf;

        // --- STATS BEFÜLLEN ---
        
        // 1. Dashboard / Home (index.html)
        if(document.getElementById('stat-wert')) {
            document.getElementById('stat-wert').innerText = warenWert.toFixed(2);
        }
        if(document.getElementById('stat-gläser')) {
            document.getElementById('stat-gläser').innerText = imRegal;
        }

        // 2. Lager-Seite (lager.html)
        if(document.getElementById('stat-warenwert')) {
            document.getElementById('stat-warenwert').innerText = warenWert.toFixed(2);
        }
        if(document.getElementById('stat-regal-glaeser')) {
            document.getElementById('stat-regal-glaeser').innerText = imRegal;
        }
        
        // 3. Blaues Gläser-Kästchen Details (lager.html)
        if(document.getElementById('glass-bought')) document.getElementById('glass-bought').innerText = gesamtGekauft;
        if(document.getElementById('glass-with-customer')) document.getElementById('glass-with-customer').innerText = imUmlauf;
        if(document.getElementById('glass-available')) document.getElementById('glass-available').innerText = imRegal;

        // --- LISTEN RENDERN ---
        const lagerListe = document.getElementById('inventory-list');
        if (!lagerListe) return;

        lagerListe.innerHTML = '';
        const filtered = this.inventoryData.filter(i => this.currentFilter === 'Alle' || i.category === this.currentFilter);
        filtered.forEach(item => {
            let displayAmount = item.amount;
            if (item.category === 'Pfandglas') displayAmount = Number(item.amount) - imUmlauf;
            lagerListe.innerHTML += this.createCard(item, displayAmount);
        });

        // Zuletzt hinzugefügt (Zieht die letzten 3 IDs)
        const recentList = document.getElementById('recent-list');
        if (recentList && this.currentFilter === 'Alle') {
            const recentItems = [...this.inventoryData].sort((a,b) => b.id - a.id).slice(0, 3);
            recentList.innerHTML = '';
            recentItems.forEach(item => recentList.innerHTML += this.createCard(item, item.amount));
        }
    },

    createCard: function(item, amount) {
        let icon = 'inventory_2';
        if (item.category === 'Fleisch') icon = 'set_meal';
        if (item.category === 'Gewürz') icon = 'grain';
        if (item.category === 'Pfandglas') icon = 'recycling';

        return `
            <div class="list-card">
                <div class="icon-box"><span class="material-symbols-outlined">${icon}</span></div>
                <div class="info">
                    <h3>${item.name}</h3>
                    <p>${amount} ${item.unit} im Regal | Wert: ${Number(item.price).toFixed(2)}€</p>
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
