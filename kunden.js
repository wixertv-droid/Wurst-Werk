window.kundenManager = {
    kundenData: [],
    recipesData: [],
    currentOrders: [],

    init: async function() {
        await this.loadRecipes(); 
        await this.loadList();
    },

    loadRecipes: async function() {
        try {
            const res = await fetch(`${supabaseUrl}/rest/v1/recipes?select=id,name&order=name.asc`, {
                headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
            });
            if (res.ok) {
                this.recipesData = await res.json();
                const selectEl = document.getElementById('order-recipe');
                if (selectEl) {
                    selectEl.innerHTML = '<option value="">-- Produkt wählen --</option>';
                    this.recipesData.forEach(r => {
                        selectEl.innerHTML += `<option value="${r.name}">${r.name}</option>`;
                    });
                }
            }
        } catch (e) {
            console.error("Fehler beim Laden der Rezepte", e);
        }
    },

    formatUnit: function(amount, unit) {
        if (unit.includes('Glas') && Number(amount) !== 1) {
            return unit.replace('Glas', 'Gläser');
        }
        return unit;
    },

    loadList: async function() {
        const container = document.getElementById('kunden-list-container');
        if (!container) return;

        try {
            const data = await db.getCustomers();
            this.kundenData = Array.isArray(data) ? data : [];
            
            if (this.kundenData.length === 0) {
                container.innerHTML = '<p class="text-muted" style="text-align: center;">Keine Kunden angelegt.</p>';
                return;
            }

            container.innerHTML = '';
            
            // FIX: Kugelsicheres Sortieren
            const sortedKunden = [...this.kundenData].sort((a, b) => (a.name || '').localeCompare(b.name || ''));

            sortedKunden.forEach(k => {
                // Überspringe defekte Einträge ohne Namen
                if (!k.name) return;

                const safeData = encodeURIComponent(JSON.stringify(k));
                const pfandSumme = (Number(k.pfand_250) || 0) + (Number(k.pfand_400) || 0);
                
                const pfandColor = pfandSumme > 0 ? 'var(--accent-danger)' : '#aaa';
                const pfandText = pfandSumme > 0 ? `${pfandSumme} Gläser im Rückstand` : `Keine Pfandschulden`;

                let ordersHtml = '';
                if (Array.isArray(k.orders) && k.orders.length > 0) {
                    ordersHtml = `<div style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed #333;">`;
                    k.orders.forEach(o => {
                        const dispUnit = this.formatUnit(o.amount, o.unit);
                        ordersHtml += `<div style="color: #4caf50; font-size: 0.85rem; margin-bottom: 2px;">🛒 ${o.amount} ${dispUnit} ${o.recipe}</div>`;
                    });
                    ordersHtml += `</div>`;
                }

                container.innerHTML += `
                    <div class="kunden-card" style="flex-direction: column; align-items: stretch;" onclick="window.kundenManager.openEditor('${safeData}')">
                        <div style="display: flex; align-items: center; gap: 15px;">
                            <div class="icon-box">
                                <span class="material-symbols-outlined" style="color: var(--accent-amber);">person</span>
                            </div>
                            <div style="flex: 1;">
                                <h3 style="margin: 0; font-size: 1.1rem; color: white;">${k.name}</h3>
                                <p style="margin: 3px 0 0 0; color: ${pfandColor}; font-size: 0.85rem; font-weight: bold;">
                                    <span class="material-symbols-outlined" style="font-size: 1rem; vertical-align: middle;">kitchen</span> ${pfandText}
                                </p>
                            </div>
                            <div onclick="event.stopPropagation(); window.kundenManager.deleteCustomer('${k.id}', '${k.name}')" style="background: #331111; padding: 10px; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
                                <span class="material-symbols-outlined" style="color: var(--accent-danger);">delete</span>
                            </div>
                        </div>
                        ${ordersHtml}
                    </div>
                `;
            });

        } catch (e) {
            container.innerHTML = '<p class="text-muted" style="color: var(--accent-danger);">Fehler beim Laden der Kunden.</p>';
        }
    },

    openGlobalOrders: function() {
        document.getElementById('kunden-list-view').style.display = 'none';
        document.getElementById('global-orders-view').style.display = 'block';
        
        const container = document.getElementById('global-orders-container');
        container.innerHTML = '';
        let hasOrders = false;

        this.kundenData.forEach(k => {
            if (Array.isArray(k.orders) && k.orders.length > 0 && k.name) {
                hasOrders = true;
                let orderListHTML = '';
                k.orders.forEach(o => {
                    const dispUnit = this.formatUnit(o.amount, o.unit);
                    orderListHTML += `
                        <div style="display: flex; justify-content: space-between; margin-bottom: 5px; color: #eee;">
                            <span>${o.amount} ${dispUnit} ${o.recipe}</span>
                            <span style="color: #4caf50;">${Number(o.price).toFixed(2)} €</span>
                        </div>`;
                });

                container.innerHTML += `
                    <div style="background: #1a1a1a; border-left: 3px solid #4d4dff; border-radius: 8px; padding: 15px; margin-bottom: 15px;">
                        <h3 style="margin: 0 0 10px 0; color: var(--accent-amber); font-size: 1.1rem;">
                            <span class="material-symbols-outlined" style="font-size: 1.1rem; vertical-align: middle;">person</span> ${k.name}
                        </h3>
                        ${orderListHTML}
                    </div>
                `;
            }
        });

        if (!hasOrders) {
            container.innerHTML = '<p class="text-muted" style="text-align: center;">Aktuell keine Vorbestellungen vorhanden.</p>';
        }
    },

    closeGlobalOrders: function() {
        document.getElementById('kunden-list-view').style.display = 'block';
        document.getElementById('global-orders-view').style.display = 'none';
    },

    openEditor: function(encodedData = null) {
        document.getElementById('kunden-list-view').style.display = 'none';
        document.getElementById('kunden-editor-view').style.display = 'block';

        document.getElementById('order-recipe').value = '';
        document.getElementById('order-amount').value = '';
        document.getElementById('order-price').value = '';

        if (encodedData) {
            const k = JSON.parse(decodeURIComponent(encodedData));
            document.getElementById('editor-title').innerText = "Kunde bearbeiten";
            document.getElementById('edit-id').value = k.id;
            document.getElementById('edit-name').value = k.name;
            document.getElementById('edit-pfand-250').innerText = k.pfand_250 || 0;
            document.getElementById('edit-pfand-400').innerText = k.pfand_400 || 0;
            this.currentOrders = Array.isArray(k.orders) ? k.orders : [];
        } else {
            document.getElementById('editor-title').innerText = "Neuer Kunde";
            document.getElementById('edit-id').value = '';
            document.getElementById('edit-name').value = '';
            document.getElementById('edit-pfand-250').innerText = '0';
            document.getElementById('edit-pfand-400').innerText = '0';
            this.currentOrders = [];
        }
        
        this.renderOrders();
    },

    saveAndClose: async function() {
        await this.silentSave();
        document.getElementById('kunden-list-view').style.display = 'block';
        document.getElementById('kunden-editor-view').style.display = 'none';
        await this.loadList();
    },

    addOrder: async function() {
        const recipe = document.getElementById('order-recipe').value;
        const amount = document.getElementById('order-amount').value;
        const unit = document.getElementById('order-unit').value;
        const price = document.getElementById('order-price').value;

        if (!recipe || !amount) {
            alert("Bitte wähle ein Produkt und gib die Menge ein!");
            return;
        }

        const newOrder = {
            id: crypto.randomUUID(),
            date: new Date().toLocaleDateString('de-DE'),
            recipe: recipe,
            amount: Number(amount),
            unit: unit,
            price: Number(price) || 0
        };

        this.currentOrders.unshift(newOrder); 
        this.renderOrders();

        document.getElementById('order-recipe').value = '';
        document.getElementById('order-amount').value = '';
        document.getElementById('order-price').value = '';

        await this.silentSave(); 
    },

    fulfillOrder: async function(orderId) {
        if (!confirm("Vorbestellung an den Kunden übergeben?\n\n(Falls Gläser in der Bestellung sind, werden diese automatisch auf sein Pfand-Konto gebucht!)")) return;
        
        const orderIndex = this.currentOrders.findIndex(o => o.id === orderId);
        if (orderIndex === -1) return;
        
        const order = this.currentOrders[orderIndex];

        if (order.unit === 'Glas (250ml)') {
            const current250 = parseInt(document.getElementById('edit-pfand-250').innerText) || 0;
            document.getElementById('edit-pfand-250').innerText = current250 + order.amount;
        } else if (order.unit === 'Glas (400ml)') {
            const current400 = parseInt(document.getElementById('edit-pfand-400').innerText) || 0;
            document.getElementById('edit-pfand-400').innerText = current400 + order.amount;
        }

        this.currentOrders.splice(orderIndex, 1);
        
        this.renderOrders();
        await this.silentSave(); 
    },

    removeOrder: async function(orderId) {
        if (!confirm("Diese Vorbestellung wirklich löschen?")) return;
        this.currentOrders = this.currentOrders.filter(o => o.id !== orderId);
        this.renderOrders();
        await this.silentSave(); 
    },

    renderOrders: function() {
        const container = document.getElementById('customer-orders-list');
        container.innerHTML = '';

        if (this.currentOrders.length === 0) {
            container.innerHTML = '<p class="text-muted" style="font-size: 0.85rem;">Keine offenen Vorbestellungen.</p>';
            return;
        }

        let totalRevenue = 0;

        this.currentOrders.forEach(o => {
            totalRevenue += o.price;
            const dispUnit = this.formatUnit(o.amount, o.unit);
            
            container.innerHTML += `
                <div class="order-card">
                    <div style="flex: 1;">
                        <b style="color: white; font-size: 1rem;">${o.amount} ${dispUnit} ${o.recipe}</b>
                        <p style="margin: 3px 0 0 0; font-size: 0.8rem; color: #888;">Vorbestellt am: ${o.date}</p>
                    </div>
                    <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 8px;">
                        <b style="color: #4caf50; font-size: 1.1rem;">${o.price.toFixed(2)} €</b>
                        <div style="display: flex; gap: 10px; align-items: center;">
                            <button class="outline-btn green" style="padding: 6px 10px; font-size: 0.85rem;" onclick="window.kundenManager.fulfillOrder('${o.id}')">
                                <span class="material-symbols-outlined" style="font-size: 1rem;">done</span> Abgegeben
                            </button>
                            <span class="material-symbols-outlined" style="color: var(--accent-danger); font-size: 1.2rem; cursor: pointer;" onclick="window.kundenManager.removeOrder('${o.id}')">delete</span>
                        </div>
                    </div>
                </div>
            `;
        });

        container.innerHTML += `
            <div style="text-align: right; padding-top: 10px; margin-top: 10px; border-top: 1px solid #333;">
                <span style="color: var(--text-muted); font-size: 0.9rem;">Erwarteter Umsatz: </span>
                <b style="color: var(--accent-amber); font-size: 1.2rem;">${totalRevenue.toFixed(2)} €</b>
            </div>
        `;
    },

    changePfand: async function(type, modifier) {
        const spanId = `edit-pfand-${type}`;
        const currentVal = parseInt(document.getElementById(spanId).innerText) || 0;
        
        let actionText = modifier > 0 ? 'ausgeben' : 'zurücknehmen';
        let amountStr = prompt(`Wie viele ${type}ml Gläser möchtest du ${actionText}?`, "1");
        
        if (!amountStr) return;
        let amount = parseInt(amountStr);
        if (isNaN(amount) || amount <= 0) return;

        let newVal = currentVal + (amount * modifier);
        if (newVal < 0) newVal = 0; 
        
        document.getElementById(spanId).innerText = newVal;
        await this.silentSave(); 
    },

    silentSave: async function() {
        let id = document.getElementById('edit-id').value;
        const nameVal = document.getElementById('edit-name').value.trim();
        const pfand250 = parseInt(document.getElementById('edit-pfand-250').innerText) || 0;
        const pfand400 = parseInt(document.getElementById('edit-pfand-400').innerText) || 0;

        if (!nameVal) return; 

        const payload = {
            name: nameVal,
            pfand_250: pfand250,
            pfand_400: pfand400,
            pfand_schulden: pfand250 + pfand400,
            orders: this.currentOrders
        };

        try {
            let url = `${supabaseUrl}/rest/v1/customers`;
            let method = 'POST';

            if (id) {
                url += `?id=eq.${id}`;
                method = 'PATCH';
            } else {
                id = crypto.randomUUID();
                payload.id = id;
                document.getElementById('edit-id').value = id; 
            }

            await fetch(url, {
                method: method,
                headers: { 
                    'apikey': supabaseKey, 
                    'Authorization': `Bearer ${supabaseKey}`, 
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify(payload)
            });

            if(window.app && window.app.refreshData) window.app.refreshData(); 
        } catch (e) {
            console.error("Auto-Save Fehler:", e);
        }
    },

    deleteCustomer: async function(id, name) {
        if (!confirm(`Kunde "${name}" wirklich löschen?\n(Die offenen Gläser und alle Bestellungen werden dabei ebenfalls gelöscht!)`)) return;
        try {
            const res = await fetch(`${supabaseUrl}/rest/v1/customers?id=eq.${id}`, {
                method: 'DELETE',
                headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
            });
            if (res.ok) {
                await this.loadList();
                if(window.app && window.app.refreshData) window.app.refreshData(); 
            }
        } catch (e) {
            alert("Fehler beim Löschen.");
        }
    }
};

document.addEventListener('DOMContentLoaded', () => window.kundenManager.init());
