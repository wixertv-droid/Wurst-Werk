window.wurstManager = {
    bestandData: [],
    recipesData: [],
    customersData: [],

    init: async function() {
        await this.loadDependencies();
        await this.loadList();
    },

    loadDependencies: async function() {
        try {
            if (typeof supabaseUrl !== 'undefined' && typeof supabaseKey !== 'undefined') {
                const resRecipes = await fetch(`${supabaseUrl}/rest/v1/recipes?select=id,name&order=name.asc`, {
                    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
                });
                if (resRecipes.ok) this.recipesData = await resRecipes.json();
            }

            if (typeof db !== 'undefined' && db.getCustomers) {
                this.customersData = await db.getCustomers();
            }
        } catch (e) {
            console.error("Fehler beim Laden von Rezepten/Kunden", e);
        }
    },

    loadList: async function() {
        const container = document.getElementById('wurst-list-container');
        if (!container) return;

        try {
            const res = await fetch(`${supabaseUrl}/rest/v1/wurst_bestand?order=name.asc`, {
                headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
            });
            
            if (!res.ok) {
                container.innerHTML = '<p class="text-muted" style="color: var(--accent-danger);">Tabelle "wurst_bestand" fehlt in Supabase!</p>';
                return;
            }

            const data = await res.json();
            this.bestandData = Array.isArray(data) ? data : [];
            
            if (this.bestandData.length === 0) {
                container.innerHTML = '<p class="text-muted" style="text-align: center;">Der Wurststand ist aktuell leer.</p>';
                return;
            }

            container.innerHTML = '';

            this.bestandData.forEach(item => {
                const safeData = encodeURIComponent(JSON.stringify(item));
                
                let dispUnit = item.unit || 'Stück';
                if (dispUnit.includes('Glas') && Number(item.amount) !== 1) {
                    dispUnit = dispUnit.replace('Glas', 'Gläser');
                }

                const amountText = Number(item.amount) <= 0 ? 
                    `<span style="color: var(--accent-danger);">Ausverkauft! (0 ${dispUnit})</span>` : 
                    `${item.amount} ${dispUnit}`;

                const revenue = Number(item.revenue) || 0;
                const itemName = item.name || 'Unbenannt';

                container.innerHTML += `
                    <div class="wurst-card" onclick="window.wurstManager.openEditor('${safeData}')">
                        <div style="display: flex; align-items: center; gap: 15px;">
                            <div style="background: #222; padding: 10px; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
                                <span class="material-symbols-outlined" style="color: #4caf50;">storefront</span>
                            </div>
                            <div style="flex: 1;">
                                <h3 style="margin: 0; font-size: 1.1rem; color: white;">${itemName}</h3>
                                <p style="margin: 3px 0 0 0; color: #aaa; font-size: 0.95rem; font-weight: bold;">Bestand: ${amountText}</p>
                                <p style="margin: 3px 0 0 0; color: var(--accent-amber); font-size: 0.85rem; font-weight: bold;">💰 Umsatz: ${revenue.toFixed(2)} €</p>
                            </div>
                            <div onclick="event.stopPropagation(); window.wurstManager.deleteItem('${item.id}', '${itemName}')" style="background: #331111; padding: 10px; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
                                <span class="material-symbols-outlined" style="color: var(--accent-danger);">delete</span>
                            </div>
                        </div>
                        <div style="border-top: 1px dashed #333; margin-top: 10px; padding-top: 5px;">
                            <button class="sell-btn" onclick="event.stopPropagation(); window.wurstManager.openSellView('${safeData}')" ${Number(item.amount) <= 0 ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}>
                                <span class="material-symbols-outlined" style="font-size: 1.2rem;">shopping_cart</span> An Kunde verkaufen
                            </button>
                        </div>
                    </div>
                `;
            });

        } catch (e) {
            container.innerHTML = '<p class="text-muted" style="color: var(--accent-danger);">Netzwerkfehler.</p>';
        }
    },

    populateRecipeDropdown: function() {
        const selectEl = document.getElementById('edit-name-select');
        if (!selectEl) return;
        
        selectEl.innerHTML = '<option value="">-- Rezept wählen --</option>';
        if (Array.isArray(this.recipesData)) {
            this.recipesData.forEach(r => {
                selectEl.innerHTML += `<option value="${r.name}">${r.name}</option>`;
            });
        }
        selectEl.innerHTML += '<option value="custom">✏️ Anderes (Manuell eingeben)...</option>';
    },

    toggleCustomName: function() {
        const select = document.getElementById('edit-name-select');
        const input = document.getElementById('edit-name-custom');
        
        // Verhindert Abstürze, wenn das Feld nicht da ist
        if (!select || !input) return;

        if (select.value === 'custom') {
            input.style.display = 'block';
        } else {
            input.style.display = 'none';
        }
    },

    openEditor: function(encodedData = null) {
        document.getElementById('wurststand-list-view').style.display = 'none';
        document.getElementById('wurststand-editor-view').style.display = 'block';
        
        this.populateRecipeDropdown();

        const idEl = document.getElementById('edit-id');
        const amountEl = document.getElementById('edit-amount');
        const unitEl = document.getElementById('edit-unit');
        const selectEl = document.getElementById('edit-name-select');
        const customEl = document.getElementById('edit-name-custom');

        if (encodedData) {
            const item = JSON.parse(decodeURIComponent(encodedData));
            document.getElementById('editor-title').innerText = "Bestand bearbeiten";
            
            if (idEl) idEl.value = item.id || '';
            if (amountEl) amountEl.value = item.amount || 0;
            if (unitEl) unitEl.value = item.unit || 'Stück';
            
            const recipeExists = Array.isArray(this.recipesData) && this.recipesData.some(r => r.name === item.name);
            
            if (selectEl && customEl) {
                if (recipeExists) {
                    selectEl.value = item.name;
                    customEl.style.display = 'none';
                } else {
                    selectEl.value = 'custom';
                    customEl.style.display = 'block';
                    customEl.value = item.name || '';
                }
            }
        } else {
            document.getElementById('editor-title').innerText = "Neue Wurst einbuchen";
            if (idEl) idEl.value = '';
            if (selectEl) selectEl.value = '';
            if (customEl) {
                customEl.style.display = 'none';
                customEl.value = '';
            }
            if (amountEl) amountEl.value = '';
        }
    },

    closeEditor: function() {
        document.getElementById('wurststand-list-view').style.display = 'block';
        document.getElementById('wurststand-editor-view').style.display = 'none';
    },

    saveItem: async function() {
        let id = document.getElementById('edit-id') ? document.getElementById('edit-id').value : '';
        const selectVal = document.getElementById('edit-name-select') ? document.getElementById('edit-name-select').value : '';
        const customVal = document.getElementById('edit-name-custom') ? document.getElementById('edit-name-custom').value.trim() : '';
        
        let nameVal = selectVal === 'custom' ? customVal : selectVal;
        const amountVal = document.getElementById('edit-amount') ? (Number(document.getElementById('edit-amount').value) || 0) : 0;
        const unitVal = document.getElementById('edit-unit') ? document.getElementById('edit-unit').value : 'Stück';

        if (!nameVal) {
            alert("Bitte wähle ein Produkt oder gib einen Namen ein!");
            return;
        }

        const payload = {
            name: nameVal,
            amount: amountVal,
            unit: unitVal
        };

        try {
            let url = `${supabaseUrl}/rest/v1/wurst_bestand`;
            let method = 'POST';

            if (id) {
                url += `?id=eq.${id}`;
                method = 'PATCH';
            } else {
                payload.id = crypto.randomUUID();
                payload.revenue = 0; 
            }

            const res = await fetch(url, {
                method: method,
                headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                this.closeEditor();
                await this.loadList();
            } else {
                alert("Fehler beim Speichern!");
            }
        } catch (e) { alert("Netzwerkfehler beim Speichern."); }
    },

    openSellView: function(encodedData) {
        document.getElementById('wurststand-list-view').style.display = 'none';
        document.getElementById('wurststand-sell-view').style.display = 'block';

        const item = JSON.parse(decodeURIComponent(encodedData));
        
        let dispUnit = item.unit || 'Stück';
        if (dispUnit.includes('Glas') && Number(item.amount) !== 1) dispUnit = dispUnit.replace('Glas', 'Gläser');

        if(document.getElementById('sell-item-name')) document.getElementById('sell-item-name').innerText = item.name || 'Unbenannt';
        if(document.getElementById('sell-item-available')) document.getElementById('sell-item-available').innerText = `${item.amount || 0} ${dispUnit}`;
        if(document.getElementById('sell-item-id')) document.getElementById('sell-item-id').value = item.id;
        if(document.getElementById('sell-item-unit')) document.getElementById('sell-item-unit').value = item.unit || ''; 
        
        if(document.getElementById('sell-amount')) document.getElementById('sell-amount').value = '';
        if(document.getElementById('sell-price')) document.getElementById('sell-price').value = '';
        
        if(document.getElementById('sell-pfand-250')) document.getElementById('sell-pfand-250').value = 0;
        if(document.getElementById('sell-pfand-400')) document.getElementById('sell-pfand-400').value = 0;

        const customerSelect = document.getElementById('sell-customer');
        if (customerSelect) {
            customerSelect.innerHTML = '<option value="">-- Kunde wählen --</option>';
            
            const safeCustomers = Array.isArray(this.customersData) ? this.customersData : [];
            const sortedKunden = [...safeCustomers].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            
            sortedKunden.forEach(c => {
                if(c.name) {
                    customerSelect.innerHTML += `<option value="${c.id}">${c.name}</option>`;
                }
            });
        }
    },

    closeSellView: function() {
        document.getElementById('wurststand-list-view').style.display = 'block';
        document.getElementById('wurststand-sell-view').style.display = 'none';
    },

    autoFillPfand: function() {
        const unitEl = document.getElementById('sell-item-unit');
        const nameEl = document.getElementById('sell-item-name');
        const amountEl = document.getElementById('sell-amount');

        const unit = unitEl ? (unitEl.value || '').toLowerCase() : '';
        const name = nameEl ? (nameEl.innerText || '').toLowerCase() : '';
        const amount = amountEl ? Math.floor(Number(amountEl.value) || 0) : 0;

        let p250 = 0;
        let p400 = 0;

        if (unit.includes('250') || name.includes('250')) {
            p250 = amount;
        } else if (unit.includes('400') || name.includes('400')) {
            p400 = amount;
        } else if (unit.includes('glas') || name.includes('glas')) {
            p250 = amount; 
        }

        if(document.getElementById('sell-pfand-250')) document.getElementById('sell-pfand-250').value = p250;
        if(document.getElementById('sell-pfand-400')) document.getElementById('sell-pfand-400').value = p400;
    },

    confirmSale: async function() {
        const itemId = document.getElementById('sell-item-id') ? document.getElementById('sell-item-id').value : null;
        const itemUnit = document.getElementById('sell-item-unit') ? document.getElementById('sell-item-unit').value : '';
        const itemName = document.getElementById('sell-item-name') ? document.getElementById('sell-item-name').innerText : '';
        
        const customerId = document.getElementById('sell-customer') ? document.getElementById('sell-customer').value : null;
        const sellAmount = document.getElementById('sell-amount') ? Number(document.getElementById('sell-amount').value) : 0;
        const sellPrice = document.getElementById('sell-price') ? (Number(document.getElementById('sell-price').value) || 0) : 0;

        if (!customerId || sellAmount <= 0) {
            alert("Bitte wähle einen Kunden und gib eine Menge ein (größer als 0)!");
            return;
        }

        const item = this.bestandData.find(i => i.id === itemId);
        const customer = this.customersData.find(c => c.id === customerId);

        if (!item || !customer) return;

        let newStockAmount = Number(item.amount) - sellAmount;
        if (newStockAmount < 0) newStockAmount = 0;
        
        let currentRevenue = Number(item.revenue) || 0;
        let newRevenue = currentRevenue + sellPrice;

        const p250El = document.getElementById('sell-pfand-250');
        const p400El = document.getElementById('sell-pfand-400');
        
        const add250 = p250El ? Number(p250El.value) || 0 : 0;
        const add400 = p400El ? Number(p400El.value) || 0 : 0;

        let pfand250 = (Number(customer.pfand_250) || 0) + add250;
        let pfand400 = (Number(customer.pfand_400) || 0) + add400;
        let pfandSchulden = pfand250 + pfand400;

        let pfandInfo = "";
        if (add250 > 0 || add400 > 0) {
            pfandInfo = `\nEs wurden ${add250 + add400} Gläser in sein Pfandkonto gebucht!`;
        }

        try {
            const [resWurst, resCustomer] = await Promise.all([
                fetch(`${supabaseUrl}/rest/v1/wurst_bestand?id=eq.${itemId}`, {
                    method: 'PATCH',
                    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ amount: newStockAmount, revenue: newRevenue })
                }),
                fetch(`${supabaseUrl}/rest/v1/customers?id=eq.${customerId}`, {
                    method: 'PATCH',
                    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        pfand_250: pfand250,
                        pfand_400: pfand400,
                        pfand_schulden: pfandSchulden
                    })
                })
            ]);

            if (!resWurst.ok || !resCustomer.ok) {
                alert("Es gab einen Fehler beim Speichern der Datenbank.");
                return;
            }

            alert(`✅ Direktverkauf erledigt!\n\nUmsatz gebucht: ${sellPrice.toFixed(2)} €\nNeuer Bestand: ${newStockAmount} ${itemUnit}${pfandInfo}`);
            this.closeSellView();
            
            await this.loadDependencies();
            await this.loadList();
            if(window.app && window.app.refreshData) window.app.refreshData();

        } catch (e) {
            alert("Fehler bei der Verbindung zur Datenbank.");
        }
    },

    deleteItem: async function(id, name) {
        if (!confirm(`"${name}" komplett aus dem Bestand löschen? (Umsatz-Historie geht dabei auch verloren!)`)) return;
        try {
            const res = await fetch(`${supabaseUrl}/rest/v1/wurst_bestand?id=eq.${id}`, {
                method: 'DELETE',
                headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
            });
            if (res.ok) await this.loadList();
        } catch (e) { alert("Fehler beim Löschen."); }
    }
};

document.addEventListener('DOMContentLoaded', () => window.wurstManager.init());
