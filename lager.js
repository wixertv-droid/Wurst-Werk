window.lagerManager = {
    init: async function() {
        await this.loadList();
    },

    loadList: async function() {
        const container = document.getElementById('inventory-list-container');
        if (!container) return;

        try {
            const items = await db.getInventory();
            if (!items || items.length === 0) {
                container.innerHTML = '<p class="text-muted" style="text-align: center;">Dein Lager ist noch leer.</p>';
                return;
            }

            // Gruppieren nach Kategorien
            const grouped = {};
            items.forEach(item => {
                const cat = item.category || 'Sonstiges';
                if (!grouped[cat]) grouped[cat] = [];
                grouped[cat].push(item);
            });

            container.innerHTML = '';

            // Kategorien durchlaufen und rendern
            for (const [category, catItems] of Object.entries(grouped)) {
                let catHtml = `<div class="section-title" style="margin-top: 20px; font-size: 1.1rem; color: var(--accent-amber);">${category}</div>`;
                
                catItems.forEach(i => {
                    const safeData = encodeURIComponent(JSON.stringify(i));
                    catHtml += `
                        <div class="list-card" style="border-left: 3px solid #555; background: #1a1a1a; cursor: pointer;" onclick="window.lagerManager.openEditor('${safeData}')">
                            <div class="info" style="flex: 1;">
                                <h3 style="font-size: 1rem; margin-bottom: 4px; color: white;">${i.name}</h3>
                                <p style="color: #aaa; font-size: 0.85rem; margin: 0;">${i.amount} ${i.unit} | ${Number(i.price).toFixed(2)} €</p>
                            </div>
                            <span class="material-symbols-outlined" style="color: var(--accent-danger); cursor: pointer; padding: 10px;" onclick="event.stopPropagation(); window.lagerManager.deleteItem('${i.id}', '${i.name}')">delete</span>
                        </div>
                    `;
                });
                container.innerHTML += catHtml;
            }

        } catch (e) {
            container.innerHTML = '<p class="text-muted" style="color: var(--accent-danger);">Fehler beim Laden des Lagers.</p>';
        }
    },

    openEditor: function(encodedData = null) {
        document.getElementById('inventory-list-container').style.display = 'none';
        document.getElementById('inventory-editor').style.display = 'block';

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
        document.getElementById('inventory-list-container').style.display = 'block';
        document.getElementById('inventory-editor').style.display = 'none';
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

        if (!payload.name) {
            alert("Bitte gib einen Namen ein!");
            return;
        }

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
            } else {
                alert("Fehler beim Speichern!");
            }
        } catch (e) {
            alert("Netzwerkfehler beim Speichern.");
        }
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
        } catch (e) {
            alert("Fehler beim Löschen.");
        }
    }
};

document.addEventListener('DOMContentLoaded', () => window.lagerManager.init());
