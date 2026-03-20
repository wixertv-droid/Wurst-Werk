window.kundenManager = {
    kundenData: [],
    recipesData: [],
    currentOrders: [], // Speichert die Bestellungen des gerade geöffneten Kunden

    init: async function() {
        await this.loadRecipes(); // Läd die Rezepte für das Dropdown
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

    loadList: async function() {
        const container = document.getElementById('kunden-list-container');
        if (!container) return;

        try {
            this.kundenData = await db.getCustomers();
            
            if (!this.kundenData || this.kundenData.length === 0) {
                container.innerHTML = '<p class="text-muted" style="text-align: center;">Keine Kunden angelegt.</p>';
                return;
            }

            container.innerHTML = '';
            
            const sortedKunden = [...this.kundenData].sort((a, b) => a.name.localeCompare(b.name));

            sortedKunden.forEach(k => {
                const safeData = encodeURIComponent(JSON.stringify(k));
                const pfandSumme = (Number(k.pfand_250) || 0) + (Number(k.pfand_400) || 0);
                const orderCount = Array.isArray(k.orders) ? k.orders.length : 0;
                
                const pfandColor = pfandSumme > 0 ? 'var(--accent-danger)' : '#aaa';
                const pfandText = pfandSumme > 0 ? `${pfandSumme} Gläser im Rückstand` : `Keine Pfandschulden`;
                const orderText = orderCount > 0 ? `<br><span style="color:#4caf50;">🛒 ${orderCount} Bestellungen</span>` : '';

                container.innerHTML += `
                    <div class="kunden-card" onclick="window.kundenManager.openEditor('${safeData}')">
                        <div class="icon-box">
                            <span class="material-symbols-outlined" style="color: var(--accent-amber);">person</span>
                        </div>
                        <div style="flex: 1;">
                            <h3 style="margin: 0; font-size: 1.1rem; color: white;">${k.name}</h3>
                            <p style="margin: 3px 0 0 0; color: ${pfandColor}; font-size: 0.85rem; font-weight: bold;">
                                <span class="material-symbols-outlined" style="font-size: 1rem; vertical-align: middle;">kitchen</span> ${pfandText}
                                ${orderText}
                            </p>
                        </div>
                        <div onclick="event.stopPropagation(); window.kundenManager.deleteCustomer('${k.id}', '${k.name}')" style="background: #331111; padding: 10px; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
                            <span class="material-symbols-outlined" style="color: var(--accent-danger);">delete</span>
                        </div>
                    </div>
                `;
            });

        } catch (e) {
            container.innerHTML = '<p class="text-muted" style="color: var(--accent-danger);">Fehler beim Laden der Kunden.</p>';
        }
    },

    openEditor: function(encodedData = null) {
        document.getElementById('kunden-list-view').style.display = 'none';
        document.getElementById('kunden-editor-view').style.display = 'block';

        // Felder zurücksetzen
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
            
            // Bestellungen laden
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

    closeEditor: function() {
        document.getElementById('kunden-list-view').style.display = 'block';
        document.getElementById('kunden-editor-view').style.display = 'none';
    },

    addOrder: function() {
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

        this.currentOrders.unshift(newOrder); // Oben an die Liste hängen
        this.renderOrders();

        // Eingabefelder wieder leeren
        document.getElementById('order-recipe').value = '';
        document.getElementById('order-amount').value = '';
        document.getElementById('order-price').value = '';
    },

    removeOrder: function(orderId) {
        if (!confirm("Diesen Kauf wirklich löschen?")) return;
        this.currentOrders = this.currentOrders.filter(o => o.id !== orderId);
        this.renderOrders();
    },

    renderOrders: function() {
        const container = document.getElementById('customer-orders-list');
        container.innerHTML = '';

        if (this.currentOrders.length === 0) {
            container.innerHTML = '<p class="text-muted" style="font-size: 0.85rem;">Noch keine Käufe hinterlegt.</p>';
            return;
        }

        let totalRevenue = 0;

        this.currentOrders.forEach(o => {
            totalRevenue += o.price;
            container.innerHTML += `
                <div class="order-card">
                    <div>
                        <b style="color: white; font-size: 1rem;">${o.amount} ${o.unit} ${o.recipe}</b>
                        <p style="margin: 3px 0 0 0; font-size: 0.8rem; color: #888;">Gekauft am: ${o.date}</p>
                    </div>
                    <div style="text-align: right;">
                        <b style="color: #4caf50; font-size: 1.1rem;">${o.price.toFixed(2)} €</b><br>
                        <span class="material-symbols-outlined" style="color: var(--accent-danger); font-size: 1.2rem; cursor: pointer; margin-top: 5px;" onclick="window.kundenManager.removeOrder('${o.id}')">delete</span>
                    </div>
                </div>
            `;
        });

        // Summe aller Käufe anzeigen
        container.innerHTML += `
            <div style="text-align: right; padding-top: 10px; margin-top: 10px; border-top: 1px solid #333;">
                <span style="color: var(--text-muted); font-size: 0.9rem;">Gesamtumsatz: </span>
                <b style="color: var(--accent-amber); font-size: 1.2rem;">${totalRevenue.toFixed(2)} €</b>
            </div>
        `;
    },

    changePfand: function(type, modifier) {
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
    },

    saveCustomer: async function() {
        const id = document.getElementById('edit-id').value;
        const nameVal = document.getElementById('edit-name').value.trim();
        const pfand250 = parseInt(document.getElementById('edit-pfand-250').innerText) || 0;
        const pfand400 = parseInt(document.getElementById('edit-pfand-400').innerText) || 0;

        if (!nameVal) {
            alert("Der Kunde braucht mindestens einen Namen!");
            return;
        }

        const payload = {
            name: nameVal,
            pfand_250: pfand250,
            pfand_400: pfand400,
            pfand_schulden: pfand250 + pfand400,
            orders: this.currentOrders // HIER WERDEN DIE BESTELLUNGEN GESPEICHERT!
        };

        if (!id) {
            payload.id = crypto.randomUUID();
        }

        try {
            let url = `${supabaseUrl}/rest/v1/customers`;
            let method = 'POST';
            if (id) {
                url += `?id=eq.${id}`;
                method = 'PATCH';
            }

            const res = await fetch(url, {
                method: method,
                headers: { 
                    'apikey': supabaseKey, 
                    'Authorization': `Bearer ${supabaseKey}`, 
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                this.closeEditor();
                await this.loadList();
                if(window.app && window.app.refreshData) window.app.refreshData(); 
            } else {
                const err = await res.text();
                alert("Fehler beim Speichern!\n(Hast du den SQL Befehl für die 'orders' Spalte ausgeführt? Details: " + err + ")");
            }
        } catch (e) {
            alert("Netzwerkfehler beim Speichern.");
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
