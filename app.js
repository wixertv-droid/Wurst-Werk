const app = {
    currentFilter: 'Alle',
    inventoryData: [],
    kundenData: [],

    init: async function() {
        await this.refreshData();
    },

    toggleGlassList: function() {
        const overlay = document.getElementById('glass-customer-overlay');
        if (!overlay) return;
        const isVisible = overlay.style.display === 'block';
        overlay.style.display = isVisible ? 'none' : 'block';
        if (!isVisible) this.renderCustomerDebtList();
    },

    renderCustomerDebtList: function() {
        const list = document.getElementById('glass-customer-list');
        if (!list) return;
        list.innerHTML = '';
        
        // Finde alle Kunden, die ENTWEDER 250ml ODER 400ml Gläser haben
        const schuldner = this.kundenData.filter(k => (Number(k.pfand_250) > 0 || Number(k.pfand_400) > 0));
        
        if (schuldner.length === 0) {
            list.innerHTML = '<p class="text-muted">Keine Gläser im Umlauf.</p>';
            return;
        }

        schuldner.forEach(k => {
            let details = [];
            if (Number(k.pfand_250) > 0) details.push(`${k.pfand_250}x 250ml`);
            if (Number(k.pfand_400) > 0) details.push(`${k.pfand_400}x 400ml`);
            
            list.innerHTML += `
                <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #333;">
                    <span>${k.name}</span>
                    <b style="color: var(--accent-danger); font-size: 0.9rem;">${details.join(' | ')}</b>
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
        let gesamt250 = 0, gesamt400 = 0;
        let umlauf250 = 0, umlauf400 = 0;

        // 1. Gekaufte Gläser & Warenwert zählen
        this.inventoryData.forEach(item => {
            if (item.category === 'Pfandglas') {
                if (item.name.includes('250')) gesamt250 += Number(item.amount) || 0;
                else if (item.name.includes('400')) gesamt400 += Number(item.amount) || 0;
            } else if (item.category !== 'Maschine') {
                warenWert += Number(item.price) || 0;
            }
        });

        // 2. Kunden-Schulden aus den NEUEN Spalten zählen
        this.kundenData.forEach(k => {
            umlauf250 += Number(k.pfand_250) || 0;
            umlauf400 += Number(k.pfand_400) || 0;
        });

        // 3. Wahrheit berechnen
        const regal250 = gesamt250 - umlauf250;
        const regal400 = gesamt400 - umlauf400;
        const totalUmlauf = umlauf250 + umlauf400;
        const totalRegal = regal250 + regal400; // Für das Dashboard

        // --- Werte in die HTML-Felder schreiben ---
        
        // Home
        if(document.getElementById('stat-wert')) document.getElementById('stat-wert').innerText = warenWert.toFixed(2);
        if(document.getElementById('stat-gläser')) document.getElementById('stat-gläser').innerText = totalRegal;
        
        // Lager
        if(document.getElementById('stat-warenwert')) document.getElementById('stat-warenwert').innerText = warenWert.toFixed(2);
        
        // Das neue, geteilte Gläser-Kästchen
        if(document.getElementById('glass-250-available')) document.getElementById('glass-250-available').innerText = regal250;
        if(document.getElementById('glass-400-available')) document.getElementById('glass-400-available').innerText = regal400;
        if(document.getElementById('glass-with-customer')) document.getElementById('glass-with-customer').innerText = totalUmlauf;

        // --- LISTEN RENDERN ---
        const lagerListe = document.getElementById('inventory-list');
        if (!lagerListe) return;

        lagerListe.innerHTML = '';
        const filtered = this.inventoryData.filter(i => this.currentFilter === 'Alle' || i.category === this.currentFilter);
        
        filtered.forEach(item => {
            lagerListe.innerHTML += this.createCard(item, umlauf250, umlauf400);
        });

        // Zuletzt hinzugefügt
        const recentList = document.getElementById('recent-list');
        if (recentList && this.currentFilter === 'Alle') {
            const recentItems = [...this.inventoryData].sort((a,b) => b.id - a.id).slice(0, 3);
            recentList.innerHTML = '';
            recentItems.forEach(item => recentList.innerHTML += this.createCard(item, umlauf250, umlauf400));
        }
    },

    createCard: function(item, umlauf250, umlauf400) {
        let displayAmount = item.amount;
        let icon = 'inventory_2';
        
        if (item.category === 'Pfandglas') {
            icon = 'recycling';
            // Zieht genau den richtigen Umlauf ab
            if (item.name.includes('250')) displayAmount = Number(item.amount) - umlauf250;
            else if (item.name.includes('400')) displayAmount = Number(item.amount) - umlauf400;
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
