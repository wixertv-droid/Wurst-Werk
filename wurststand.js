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
                const itemName = item.name || 'Unbenannt';
                const itemAmount = Number(item.amount) || 0;
                let dispUnit = item.unit || 'Stück'; 
                
                if (dispUnit.includes('Glas') && itemAmount !== 1) {
                    dispUnit = dispUnit.replace('Glas', 'Gläser');
                }

                const amountText = itemAmount <= 0 ? 
                    `<span style="color: var(--accent-danger);">Ausverkauft! (0 ${dispUnit})</span>` : 
                    `${itemAmount} ${dispUnit}`;

                const revenue = Number(item.revenue) || 0;
                const safeData = encodeURIComponent(JSON.stringify(item));

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
                            <button class="sell-btn" onclick="event.stopPropagation(); window.wurstManager.openSellView('${safeData}')" ${itemAmount <= 0 ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}>
                                <span class="material-symbols-outlined" style="font-size: 1.2rem;">shopping_cart</span> An Kunde verkaufen
                            </button>
                        </div>
                    </div>
                `;
            });

        } catch (e) {
            container.innerHTML = `<p class="text-muted" style="color: var(--accent-danger); text-align: center;">Netzwerk-Fehler.</p>`;
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
            if (customEl) { customEl.style.display = 'none'; customEl.value = ''; }
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
        if(document.getElementById('sell-item-original-unit')) document.getElementById('sell-item-original-unit').value = item.unit || ''; 
        
        if(document.getElementById('sell-amount')) document.getElementById('sell-amount').value = '';
        if(document.getElementById('sell-price')) document.getElementById('sell-price').value = '';
        
        // Versuchen, die Einheit im Dropdown automatisch passend vorzuwählen
        const unitSelect = document.getElementById('sell-unit-select');
        if(unitSelect) {
            let preUnit = item.unit || 'Stück';
            if(preUnit.includes('250')) preUnit = 'Glas (250ml)';
            else if(preUnit.includes('400')) preUnit = 'Glas (400ml)';
            else if(preUnit === 'g') preUnit = 'g';
            else preUnit = 'Stück';
            unitSelect.value = preUnit;
        }

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

    confirmSale: async function() {
        const itemId = document.getElementById('sell-item-id') ? document.getElementById('sell-item-id').value : null;
        const itemName = document.getElementById('sell-item-name') ? document.getElementById('sell-item-name').innerText : '';
        const originalUnit = document.getElementById('sell-item-original-unit') ? document.getElementById('sell-item-original-unit').value : '';
        
        const customerId = document.getElementById('sell-customer') ? document.getElementById('sell-customer').value : null;
        const sellAmount = document.getElementById('sell-amount') ? Number(document.getElementById('sell-amount').value) : 0;
        const sellPrice = document.getElementById('sell-price') ? (Number(document.getElementById('sell-price').value) || 0) : 0;
        
        // HIER WIRD DIE AUSGEWÄHLTE EINHEIT GELESEN
        const selectedUnit = document.getElementById('sell-unit-select') ? document.getElementById('sell-unit-select').value : '';

        if (!customerId || sellAmount <= 0) {
            alert("Bitte wähle einen Kunden und gib eine Menge ein (größer als 0)!");
            return;
        }

        const item = this.bestandData.find(i => i.id === itemId);
        const customer = this.customersData.find(c => c.id === customerId);

        if (!item || !customer) return;

        // 1. Wurststand aktualisieren (Menge abziehen, Umsatz aufrechnen)
        let newStockAmount = Number(item.amount) - sellAmount;
        if (newStockAmount < 0) newStockAmount = 0;
        
        let currentRevenue = Number(item.revenue) || 0;
        let newRevenue = currentRevenue + sellPrice;

        // 2. Pfand automatisch berechnen (Anhand der DROPDOWN Auswahl!)
        let add250 = 0;
        let add400 = 0;

        if (selectedUnit === 'Glas (250ml)') {
            add250 = Math.floor(sellAmount);
        } else if (selectedUnit === 'Glas (400ml)') {
            add400 = Math.floor(sellAmount);
        }

        let pfand250 = (Number(customer.pfand_250) || 0) + add250;
        let pfand400 = (Number(customer.pfand_400) || 0) + add400;
        let pfandSchulden = pfand250 + pfand400;

        let pfandInfo = "";
        if (add250 > 0 || add400 > 0) {
            pfandInfo = `\nEs wurden ${add250 + add400} Gläser in das Pfandkonto gebucht!`;
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

            alert(`✅ Verkauf erfolgreich!\n\nUmsatz: ${sellPrice.toFixed(2)} €\nNeuer Bestand: ${newStockAmount} ${originalUnit}${pfandInfo}`);
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
