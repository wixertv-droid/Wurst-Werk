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
            const resRecipes = await fetch(`${supabaseUrl}/rest/v1/recipes?select=id,name&order=name.asc`, {
                headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
            });
            if (resRecipes.ok) this.recipesData = await resRecipes.json();

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

            const data = await res.json();
            this.bestandData = Array.isArray(data) ? data : [];
            
            if (this.bestandData.length === 0) {
                container.innerHTML = '<p class="text-muted" style="text-align: center;">Der Wurststand ist aktuell leer.</p>';
                return;
            }

            container.innerHTML = '';

            this.bestandData.forEach(item => {
                const safeData = encodeURIComponent(JSON.stringify(item));
                
                let dispUnit = item.unit || '';
                if (dispUnit.includes('Glas') && Number(item.amount) !== 1) {
                    dispUnit = dispUnit.replace('Glas', 'Gläser');
                }

                const amountText = Number(item.amount) <= 0 ? 
                    `<span style="color: var(--accent-danger);">Ausverkauft! (0 ${dispUnit})</span>` : 
                    `${item.amount} ${dispUnit}`;

                const revenue = Number(item.revenue) || 0;

                container.innerHTML += `
                    <div class="wurst-card" onclick="window.wurstManager.openEditor('${safeData}')">
                        <div style="display: flex; align-items: center; gap: 15px;">
                            <div style="background: #222; padding: 10px; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
                                <span class="material-symbols-outlined" style="color: #4caf50;">storefront</span>
                            </div>
                            <div style="flex: 1;">
                                <h3 style="margin: 0; font-size: 1.1rem; color: white;">${item.name || 'Unbenannt'}</h3>
                                <p style="margin: 3px 0 0 0; color: #aaa; font-size: 0.95rem; font-weight: bold;">Bestand: ${amountText}</p>
                                <p style="margin: 3px 0 0 0; color: var(--accent-amber); font-size: 0.85rem; font-weight: bold;">💰 Umsatz: ${revenue.toFixed(2)} €</p>
                            </div>
                            <div onclick="event.stopPropagation(); window.wurstManager.deleteItem('${item.id}', '${item.name}')" style="background: #331111; padding: 10px; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
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
            
            document.getElementById('edit-unit').value = item.unit || 'Stück';
            
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
        
        let dispUnit = item.unit || '';
        if (dispUnit.includes('Glas') && Number(item.amount) !== 1) dispUnit = dispUnit.replace('Glas', 'Gläser');

        document.getElementById('sell-item-name').innerText = item.name || 'Unbenannt';
        document.getElementById('sell-item-available').innerText = `${item.amount} ${dispUnit}`;
        document.getElementById('sell-item-id').value = item.id;
        
        // NEU: Setzt das Dropdown automatisch auf die Einheit, die beim Produkt gespeichert ist!
        const unitSelect = document.getElementById('sell-unit');
        if (item.unit) {
            unitSelect.value = item.unit;
            if (!unitSelect.value) unitSelect.value = 'Stück'; // Fallback
        } else {
            unitSelect.value = 'Stück';
        }
        
        document.getElementById('sell-amount').value = '';
        document.getElementById('sell-price').value = '';

        const customerSelect = document.getElementById('sell-customer');
        customerSelect.innerHTML = '<option value="">-- Kunde wählen --</option>';
        
        const safeCustomers = Array.isArray(this.customersData) ? this.customersData : [];
        const sortedKunden = [...safeCustomers].sort((a, b) => (a.name || '').
