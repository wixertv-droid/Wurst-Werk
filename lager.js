window.lagerManager = {
    currentFilter: 'Alles',
    inventoryData: [],

    init: async function() {
        await this.loadList();
    },

    loadList: async function() {
        const container = document.getElementById('inventory-list-container');
        if (!container) return;

        try {
            this.inventoryData = await db.getInventory();
            this.renderFilteredList();
            this.updateGlassStats();
        } catch (e) {
            container.innerHTML = '<p class="text-muted" style="color: var(--accent-danger);">Fehler beim Laden des Lagers.</p>';
        }
    },

    setFilter: function(filterName) {
        this.currentFilter = filterName;
        
        document.getElementById('filter-all').className = filterName === 'Alles' ? 'filter-pill' : 'filter-pill inactive';
        document.getElementById('filter-fleisch').className = filterName === 'Fleisch' ? 'filter-pill' : 'filter-pill inactive';
        document.getElementById('filter-gewuerze').className = filterName === 'Gewürze' ? 'filter-pill' : 'filter-pill inactive';
        document.getElementById('filter-material').className = filterName === 'Verpackung' ? 'filter-pill' : 'filter-pill inactive';
        
        this.renderFilteredList();
    },

    renderFilteredList: function() {
        const container = document.getElementById('inventory-list-container');
        container.innerHTML = '';

        let filteredItems = this.inventoryData.filter(i => i.category !== 'Pfandglas');

        if (this.currentFilter !== 'Alles') {
            filteredItems = filteredItems.filter(i => {
                const cat = (i.category || '').toLowerCase();
                if (this.currentFilter === 'Fleisch') return cat.includes('fleisch');
                if (this.currentFilter === 'Gewürze') return cat.includes('gewürz');
                if (this.currentFilter === 'Verpackung') return cat.includes('verpackung') || cat.includes('darm');
                return cat === this.currentFilter.toLowerCase();
            });
        }

        if (filteredItems.length === 0) {
            container.innerHTML = '<p class="text-muted" style="text-align: center;">Keine Artikel in dieser Kategorie.</p>';
            return;
        }

        filteredItems.forEach(i => {
            const safeData = encodeURIComponent(JSON.stringify(i));
            
            let icon = 'grain';
            const cat = (i.category || '').toLowerCase();
            if (cat.includes('fleisch')) icon = 'set_meal';
            else if (cat.includes('gewürz')) icon = 'eco';
            else if (cat.includes('verpackung') || cat.includes('darm')) icon = 'inventory_2';
            else if (cat.includes('maschine')) icon = 'blender';
            
            container.innerHTML += `
                <div class="lager-item-card" onclick="window.lagerManager.openEditor('${safeData}')">
                    <div class="lager-icon-box">
                        <span class="material-symbols-outlined" style="color: #aaa;">${icon}</span>
                    </div>
                    <div style="flex: 1;">
                        <h3 style="margin: 0; font-size: 1.1rem; color: white;">${i.name}</h3>
                        <p style="margin: 3px 0 0 0; color: #aaa; font-size: 0.85rem;">${i.amount} ${i.unit} | Wert: ${Number(i.price).toFixed(2)}€</p>
                    </div>
                    <div onclick="event.stopPropagation(); window.lagerManager.deleteItem('${i.id}', '${i.name}')" style="background: #331111; padding: 10px; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
                        <span class="material-symbols-outlined" style="color: var(--accent-danger);">delete</span>
                    </div>
                </div>
            `;
        });
    },

    updateGlassStats: async function() {
        let total250 = 0, total400 = 0;
        let kunden250 = 0, kunden400 = 0;
        let gefuellt250 = 0, gefuellt400 = 0;
        
        // 1. Gesamtbestand aus dem Lager holen
        const gl250Item = this.inventoryData.find(i => i.category === 'Pfandglas' && i.name.includes('250'));
        const gl400Item = this.inventoryData.find(i => i.category === 'Pfandglas' && i.name.includes('400'));
        
        if (gl250Item) total250 = Number(gl250Item.amount);
        if (gl400Item) total400 = Number(gl400Item.amount);

        // 2. Gläser beim Kunden (Pfand) holen
        try {
            const kunden = await db.getCustomers();
            kunden.forEach(k => {
                kunden250 += Number(k.pfand_250) || 0;
                kunden400 += Number(k.pfand_400) || 0;
            });
        } catch (e) {}

        // 3. Gefüllte Gläser aus dem Wurststand holen
        try {
            const res = await fetch(`${supabaseUrl}/rest/v1/wurst_bestand?select=*`, { 
                headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } 
            });
            if(res.ok) {
                const wurstData = await res.json();
                wurstData.forEach(w => {
                    const unit = (w.unit || '').toLowerCase();
                    const name = (w.name || '').toLowerCase();
                    const amount = Number(w.amount) || 0;
                    
                    if (unit.includes('250') || name.includes('250')) {
                        gefuellt250 += amount;
                    } else if (unit.includes('400') || name.includes('400')) {
                        gefuellt400 += amount;
                    } else if (unit.includes('glas') || name.includes('glas')) {
                        gefuellt250 += amount; 
                    }
                });
            }
        } catch(e) {}

        // 4. Leere Gläser berechnen
        const frei250 = total250 - gefuellt250 - kunden250;
        const frei400 = total400 - gefuellt400 - kunden400;

        // 5. DOM updaten
        if(document.getElementById('glass-250-stock')) {
            document.getElementById('glass-250-stock').innerText = total250;
            document.getElementById('glass-400-stock').innerText = total400;
            
            document.getElementById('glass-250-wurst').innerText = Math.floor(gefuellt250);
            document.getElementById('glass-400-wurst').innerText = Math.floor(gefuellt400);

            document.getElementById('glass-250-kunden').innerText = kunden250;
            document.getElementById('glass-400-kunden').innerText = kunden400;
            
            const elFrei250 = document.getElementById('glass-250-frei');
            elFrei250.innerText = Math.floor(frei250);
            elFrei250.style.color = frei250 < 0 ? 'var(--accent-danger)' : '#4caf50';

            const elFrei400 = document.getElementById('glass-400-frei');
            elFrei400.innerText = Math.floor(frei400);
            elFrei400.style.color = frei400 < 0 ? 'var(--accent-danger)' : 'var(--accent-amber)';
        }
    },

    changeGlass: async function(type, modifier) {
        let amountStr = prompt(`Du bist im Bereich: Gesamtbestand.\nWie viele ${type}ml Gläser möchtest du zum GESAMTBESTAND hinzufügen oder abziehen? (Verwende ein - für Abziehen)`, "10");
        if (!amountStr) return;
        let amount = parseInt(amountStr);
        if (isNaN(amount)) return;

        let item = this.inventoryData.find(i => i.category === 'Pfandglas' && i.name.includes(type));
        
        try {
            if (item) {
                let newAmount = Number(item.amount) + amount;
                if (newAmount < 0) newAmount = 0;
                await fetch(`${supabaseUrl}/rest/v1/inventory?id=eq.${item.id}`, {
                    method: 'PATCH',
                    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ amount: newAmount })
                });
            } else if (amount > 0) {
                await fetch(`${supabaseUrl}/rest/v1/inventory`, {
                    method: 'POST',
                    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: `Pfandglas ${type}ml`, category: 'Pfandglas', amount: amount, unit: 'Stk', price: 0 })
                });
            }
            await this.loadList();
            if(window.app && window.app.refreshData) window.app.refreshData();
        } catch (e) { alert("Fehler beim Speichern!"); }
    },

    openEditor: function(encodedData = null) {
        document.getElementById('inventory-list-view').style.display = 'none';
        document.getElementById('inventory-editor-view').style.display = 'block';

        if (encodedData) {
            const item = JSON.parse(decodeURIComponent(encodedData));
            document.getElementById('editor-title').innerText = "Artikel bearbeiten";
            document.getElementById('edit-id').value = item.id;
            document.getElementById('edit-name').value = item.name;
            document.getElementById('edit-category').value = item.category;
            document.getElementById('edit-amount').value = item.amount;
            document.getElementById('edit-unit').value = item.unit;
            document.getElementById('edit-price').value = item.price;
        } else {
            document.getElementById('editor-title').innerText = "Neuer Artikel";
            document.getElementById('edit-id').value = '';
            document.getElementById('edit-name').value = '';
            document.getElementById('edit-amount').value = '';
            document.getElementById('edit-price').value = '';
        }
    },

    closeEditor: function() {
        document.getElementById('inventory-list-view').style.display = 'block';
        document.getElementById('inventory-editor-view').style.display = 'none';
    },

    saveItem: async function() {
        const id = document.getElementById('edit-id').value;
        const payload = {
            name: document.getElementById('edit-name').value.trim(),
            category: document.getElementById('edit-category').value,
            amount: Number(document.getElementById('edit-amount').value),
            unit: document.getElementById('edit-unit').value,
            price: Number(document.getElementById('edit-price').value)
        };

        if (!payload.name) { alert("Bitte gib einen Namen ein!"); return; }

        try {
            let url = `${supabaseUrl}/rest/v1/inventory`;
            let method = 'POST';
            if (id) {
                url += `?id=eq.${id}`;
                method = 'PATCH';
            }

            const res = await fetch(url, {
                method: method,
                headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                this.closeEditor();
                await this.loadList();
                if(window.app && window.app.refreshData) window.app.refreshData(); 
            } else { alert("Fehler beim Speichern!"); }
        } catch (e) { alert("Netzwerkfehler beim Speichern."); }
    },

    deleteItem: async function(id, name) {
        if (!confirm(`Artikel "${name}" wirklich löschen?`)) return;
        try {
            const res = await fetch(`${supabaseUrl}/rest/v1/inventory?id=eq.${id}`, {
                method: 'DELETE',
                headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
            });
            if (res.ok) {
                await this.loadList();
                if(window.app && window.app.refreshData) window.app.refreshData(); 
            }
        } catch (e) { alert("Fehler beim Löschen."); }
    }
};

document.addEventListener('DOMContentLoaded', () => window.lagerManager.init());
