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
            // Lade Rezepte für das Dropdown
            const resRecipes = await fetch(`${supabaseUrl}/rest/v1/recipes?select=id,name&order=name.asc`, {
                headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
            });
            if (resRecipes.ok) this.recipesData = await resRecipes.json();

            // Lade Kunden für den Verkauf
            this.customersData = await db.getCustomers();
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

            this.bestandData = await res.json();
            
            if (this.bestandData.length === 0) {
                container.innerHTML = '<p class="text-muted" style="text-align: center;">Der Wurststand ist aktuell leer.</p>';
                return;
            }

            container.innerHTML = '';

            this.bestandData.forEach(item => {
                const safeData = encodeURIComponent(JSON.stringify(item));
                
                let dispUnit = item.unit;
                if (dispUnit.includes('Glas') && Number(item.amount) !== 1) {
                    dispUnit = dispUnit.replace('Glas', 'Gläser');
                }

                // NEU: Die Karte hat jetzt unten den Verkaufen-Button integriert!
                container.innerHTML += `
                    <div class="wurst-card" onclick="window.wurstManager.openEditor('${safeData}')">
                        <div style="display: flex; align-items: center; gap: 15px;">
                            <div style="background: #222; padding: 10px; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
                                <span class="material-symbols-outlined" style="color: #4caf50;">storefront</span>
                            </div>
                            <div style="flex: 1;">
                                <h3 style="margin: 0; font-size: 1.1rem; color: white;">${item.name}</h3>
                                <p style="margin: 3px 0 0 0; color: #aaa; font-size: 0.95rem; font-weight: bold;">${item.amount} ${dispUnit}</p>
                            </div>
                            <div onclick="event.stopPropagation(); window.wurstManager.deleteItem('${item.id}', '${item.name}')" style="background: #331111; padding: 10px; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
                                <span class="material-symbols-outlined" style="color: var(--accent-danger);">delete</span>
                            </div>
                        </div>
                        <div style="border-top: 1px dashed #333; margin-top: 10px; padding-top: 5px;">
                            <button class="sell-btn" onclick="event.stopPropagation(); window.wurstManager.openSellView('${safeData}')">
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
        selectEl.innerHTML = '<option value="">-- Rezept wählen --</option>';
        this.recipesData.forEach(r => {
            selectEl.innerHTML += `<option value="${r.name}">${r.name}</option>`;
        });
        selectEl.innerHTML += '<option value="custom">✏️ Anderes (Manuell eingeben)...</option>';
    },

    toggleCustomName: function() {
        const select = document.getElementById('edit-name-select');
        const input = document.getElementById('edit-name-custom');
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

        if (encodedData) {
            const item = JSON.parse(decodeURIComponent(encodedData));
            document.getElementById('editor-title').innerText = "Bestand bearbeiten";
            document.getElementById('edit-id').value = item.id;
            document.getElementById('edit-amount').value = item.amount;
            document.getElementById('edit-unit').value = item.unit;
            
            // Schauen, ob der Name in den Rezepten steht
            const recipeExists = this.recipesData.some(r => r.name === item.name);
            if (recipeExists) {
                document.getElementById('edit-name-select').value = item.name;
                document.getElementById('edit-name-custom').style.display = 'none';
            } else {
                document.getElementById('edit-name-select').value = 'custom';
                document.getElementById('edit-name-custom').style.display = 'block';
                document.getElementById('edit-name-custom').value = item.name;
            }
        } else {
            document.getElementById('editor-title').innerText = "Neue Wurst einbuchen";
            document.getElementById('edit-id').value = '';
            document.getElementById('edit-name-select').value = '';
            document.getElementById('edit-name-custom').style.display = 'none';
            document.getElementById('edit-name-custom').value = '';
            document.getElementById('edit-amount').value = '';
        }
    },

    closeEditor: function() {
        document.getElementById('wurststand-list-view').style.display = 'block';
        document.getElementById('wurststand-editor-view').style.display = 'none';
    },

    saveItem: async function() {
        let id = document.getElementById('edit-id').value;
        const selectVal = document.getElementById('edit-name-select').value;
        const customVal = document.getElementById('edit-name-custom').value.trim();
        
        let nameVal = selectVal === 'custom' ? customVal : selectVal;
        const amountVal = Number(document.getElementById('edit-amount').value) || 0;
        const unitVal = document.getElementById('edit-unit').value;

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

    // ==========================================
    // DIE NEUE VERKAUFS-LOGIK (Wurst -> Kunde)
    // ==========================================
    openSellView: function(encodedData) {
        document.getElementById('wurststand-list-view').style.display = 'none';
        document.getElementById('wurststand-sell-view').style.display = 'block';

        const item = JSON.parse(decodeURIComponent(encodedData));
        
        let dispUnit = item.unit;
        if (dispUnit.includes('Glas') && Number(item.amount) !== 1) dispUnit = dispUnit.replace('Glas', 'Gläser');

        document.getElementById('sell-item-name').innerText = item.name;
        document.getElementById('sell-item-available').innerText = `${item.amount} ${dispUnit}`;
        document.getElementById('sell-item-id').value = item.id;
        document.getElementById('sell-item-unit').value = item.unit; // Wichtig für die Gläser-Berechnung!
        
        document.getElementById('sell-amount').value = '';
        document.getElementById('sell-price').value = '';

        // Kunden-Dropdown befüllen
        const customerSelect = document.getElementById('sell-customer');
        customerSelect.innerHTML = '<option value="">-- Kunde wählen --</option>';
        
        const sortedKunden = [...this.customersData].sort((a, b) => a.name.localeCompare(b.name));
        sortedKunden.forEach(c => {
            customerSelect.innerHTML += `<option value="${c.id}">${c.name}</option>`;
        });
    },

    closeSellView: function() {
        document.getElementById('wurststand-list-view').style.display = 'block';
        document.getElementById('wurststand-sell-view').style.display = 'none';
    },

    confirmSale: async function() {
        const itemId = document.getElementById('sell-item-id').value;
        const itemUnit = document.getElementById('sell-item-unit').value;
        const itemName = document.getElementById('sell-item-name').innerText;
        
        const customerId = document.getElementById('sell-customer').value;
        const sellAmount = Number(document.getElementById('sell-amount').value);
        const sellPrice = Number(document.getElementById('sell-price').value) || 0;

        if (!customerId || sellAmount <= 0) {
            alert("Bitte wähle einen Kunden und gib eine Menge ein (größer als 0)!");
            return;
        }

        const item = this.bestandData.find(i => i.id === itemId);
        const customer = this.customersData.find(c => c.id === customerId);

        if (!item || !customer) return;

        // 1. Wurststand aktualisieren (Menge abziehen)
        let newStockAmount = Number(item.amount) - sellAmount;
        if (newStockAmount < 0) newStockAmount = 0;

        // 2. Bestellung für die Kundenakte vorbereiten
        let orders = Array.isArray(customer.orders) ? customer.orders : [];
        orders.unshift({
            id: crypto.randomUUID(),
            date: new Date().toLocaleDateString('de-DE'),
            recipe: itemName,
            amount: sellAmount,
            unit: itemUnit,
            price: sellPrice
        });

        // 3. Pfandkonto automatisch anpassen (Der absolute Clou!)
        let pfand250 = Number(customer.pfand_250) || 0;
        let pfand400 = Number(customer.pfand_400) || 0;

        if (itemUnit.includes('250ml')) pfand250 += sellAmount;
        if (itemUnit.includes('400ml')) pfand400 += sellAmount;
        let pfandSchulden = pfand250 + pfand400;

        // Ab in die Datenbank mit beiden Änderungen gleichzeitig
        try {
            // Wurststand updaten
            await fetch(`${supabaseUrl}/rest/v1/wurst_bestand?id=eq.${itemId}`, {
                method: 'PATCH',
                headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount: newStockAmount })
            });

            // Kundenakte updaten
            await fetch(`${supabaseUrl}/rest/v1/customers?id=eq.${customerId}`, {
                method: 'PATCH',
                headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    orders: orders,
                    pfand_250: pfand250,
                    pfand_400: pfand400,
                    pfand_schulden: pfandSchulden
                })
            });

            // Alles erfolgreich!
            alert(`✅ ${sellAmount}x ${itemName} an ${customer.name} verkauft!`);
            this.closeSellView();
            
            // Daten neu laden, damit die Zahlen sofort stimmen
            await this.loadDependencies();
            await this.loadList();
            if(window.app && window.app.refreshData) window.app.refreshData();

        } catch (e) {
            alert("Fehler bei der Verbindung zur Datenbank.");
        }
    },

    deleteItem: async function(id, name) {
        if (!confirm(`"${name}" komplett aus dem Bestand löschen?`)) return;
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
