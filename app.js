const app = {
    currentFilter: 'Alle',
    inventoryData: [],
    kundenData: [],

    init: async function() {
        await this.refreshData();
    },

    // --- DIE SCHNELLE GLÄSER LOGIK (+ / -) ---
    adjustGlass: async function(size, type) {
        // ... (Logik bleibt gleich wie im vorherigen Schritt)
        const actionStr = type === 'add' ? 'hinzufügen (Eingang)' : 'abziehen (Verbrauch/Bruch)';
        const amountStr = prompt(`Wie viele ${size}ml Gläser möchtest du ${actionStr}?`, "1");
        
        if (!amountStr) return;
        const amount = parseInt(amountStr);
        if (isNaN(amount) || amount <= 0) return;

        let item = this.inventoryData.find(i => i.category === 'Pfandglas' && i.name.includes(size));

        if (!item) {
            if (type === 'add') {
                const newEntry = { name: `Sturzglas ${size}ml`, category: 'Pfandglas', amount: amount, price: 0, unit: 'Stk' };
                await db.insertInventory(newEntry);
                await this.refreshData();
                return;
            } else {
                alert(`Es gibt noch keine ${size}ml Gläser im Lager!`);
                return;
            }
        }

        if (type === 'remove') {
            let umlauf = 0;
            this.kundenData.forEach(k => umlauf += Number(k[`pfand_${size}`]) || 0);
            const regal = Number(item.amount) - umlauf;
            
            if (amount > regal) {
                alert(`Du hast nur ${regal} Gläser im Regal. Du kannst nicht ${amount} abziehen!`);
                return;
            }
        }

        const newAmount = type === 'add' ? Number(item.amount) + amount : Number(item.amount) - amount;

        try {
            const response = await fetch(`${supabaseUrl}/rest/v1/inventory?id=eq.${item.id}`, {
                method: 'PATCH',
                headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount: newAmount })
            });
            if (response.ok) await this.refreshData();
            else alert("Fehler beim Speichern in der Datenbank!");
        } catch (e) { alert("Verbindungsfehler!"); }
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
        
        const schuldner = this.kundenData.filter(k => (Number(k.pfand_250) > 0 || Number(k.pfand_400) > 0));
        
        if (schuldner.length === 0) {
            list.innerHTML = '<p class="text-muted" style="margin:0;">Keine Gläser im Umlauf.</p>';
            return;
        }

        schuldner.forEach(k => {
            let details = [];
            if (Number(k.pfand_250) > 0) details.push(`${k.pfand_250}x 250ml`);
            if (Number(k.pfand_400) > 0) details.push(`${k.pfand_400}x 400ml`);
            
            list.innerHTML += `
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #333;">
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

        this.inventoryData.forEach(item => {
            if (item.category === 'Pfandglas') {
                if (item.name.includes('250')) gesamt250 += Number(item.amount) || 0;
                else if (item.name.includes('400')) gesamt400 += Number(item.amount) || 0;
            } else if (item.category !== 'Maschine') {
                warenWert += Number(item.price) || 0;
            }
        });

        this.kundenData.forEach(k => {
            umlauf250 += Number(k.pfand_250) || 0;
            umlauf400 += Number(k.pfand_400) || 0;
        });

        const regal250 = gesamt250 - umlauf250;
        const regal400 = gesamt400 - umlauf400;

        // --- DASHBOARD (Home) ---
        if(document.getElementById('stat-wert')) document.getElementById('stat-wert').innerText = warenWert.toFixed(2);
        // HIER SIND DIE NEUEN FELDER FÜR DIE STARTSEITE:
        if(document.getElementById('stat-glaeser-250')) document.getElementById('stat-glaeser-250').innerText = regal250;
        if(document.getElementById('stat-glaeser-400')) document.getElementById('stat-glaeser-400').innerText = regal400;
        
        // --- LAGER ---
        if(document.getElementById('stat-warenwert')) document.getElementById('stat-warenwert').innerText = warenWert.toFixed(2);
        
        if(document.getElementById('glass-250-available')) document.getElementById('glass-250-available').innerText = regal250;
        if(document.getElementById('glass-250-out')) document.getElementById('glass-250-out').innerText = umlauf250;
        if(document.getElementById('glass-400-available')) document.getElementById('glass-400-available').innerText = regal400;
        if(document.getElementById('glass-400-out')) document.getElementById('glass-400-out').innerText = umlauf400;

        // Listen Rendern (Gläser werden ausgeblendet)
        const lagerListe = document.getElementById('inventory-list');
        if (!lagerListe) return;

        lagerListe.innerHTML = '';
        const filtered = this.inventoryData.filter(i => i.category !== 'Pfandglas' && (this.currentFilter === 'Alle' || i.category === this.currentFilter));
        filtered.forEach(item => lagerListe.innerHTML += this.createCard(item));

        const recentList = document.getElementById('recent-list');
        if (recentList && this.currentFilter === 'Alle') {
            const recentItems = [...this.inventoryData].filter(i => i.category !== 'Pfandglas').sort((a,b) => b.id - a.id).slice(0, 3);
            recentList.innerHTML = '';
            recentItems.forEach(item => recentList.innerHTML += this.createCard(item));
        }
    },

    createCard: function(item) {
        let icon = item.category === 'Fleisch' ? 'set_meal' : 'grain';
        
        return `
            <div class="list-card">
                <div class="icon-box"><span class="material-symbols-outlined">${icon}</span></div>
                <div class="info">
                    <h3>${item.name}</h3>
                    <p>${item.amount} ${item.unit} | Wert: ${Number(item.price).toFixed(2)}€</p>
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
