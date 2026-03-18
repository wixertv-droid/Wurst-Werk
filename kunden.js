window.kundenManager = {
    kundenData: [],

    init: async function() {
        await this.loadList();
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
            
            // Kunden alphabetisch sortieren
            const sortedKunden = [...this.kundenData].sort((a, b) => a.name.localeCompare(b.name));

            sortedKunden.forEach(k => {
                const safeData = encodeURIComponent(JSON.stringify(k));
                const pfandSumme = (Number(k.pfand_250) || 0) + (Number(k.pfand_400) || 0);
                
                // Warn-Farbe, wenn der Kunde Gläser hat
                const pfandColor = pfandSumme > 0 ? 'var(--accent-danger)' : '#aaa';
                const pfandText = pfandSumme > 0 ? `${pfandSumme} Gläser im Rückstand` : `Keine Pfandschulden`;

                container.innerHTML += `
                    <div class="kunden-card" onclick="window.kundenManager.openEditor('${safeData}')">
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
                `;
            });

        } catch (e) {
            container.innerHTML = '<p class="text-muted" style="color: var(--accent-danger);">Fehler beim Laden der Kunden.</p>';
        }
    },

    openEditor: function(encodedData = null) {
        document.getElementById('kunden-list-view').style.display = 'none';
        document.getElementById('kunden-editor-view').style.display = 'block';

        if (encodedData) {
            const k = JSON.parse(decodeURIComponent(encodedData));
            document.getElementById('editor-title').innerText = "Kunde bearbeiten";
            document.getElementById('edit-id').value = k.id;
            document.getElementById('edit-name').value = k.name;
            document.getElementById('edit-contact').value = k.contact || '';
            document.getElementById('edit-pfand-250').innerText = k.pfand_250 || 0;
            document.getElementById('edit-pfand-400').innerText = k.pfand_400 || 0;
        } else {
            document.getElementById('editor-title').innerText = "Neuer Kunde";
            document.getElementById('edit-id').value = '';
            document.getElementById('edit-name').value = '';
            document.getElementById('edit-contact').value = '';
            document.getElementById('edit-pfand-250').innerText = '0';
            document.getElementById('edit-pfand-400').innerText = '0';
        }
    },

    closeEditor: function() {
        document.getElementById('kunden-list-view').style.display = 'block';
        document.getElementById('kunden-editor-view').style.display = 'none';
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
        if (newVal < 0) newVal = 0; // Pfand kann nicht negativ sein
        
        document.getElementById(spanId).innerText = newVal;
    },

    saveCustomer: async function() {
        const id = document.getElementById('edit-id').value;
        const payload = {
            name: document.getElementById('edit-name').value.trim(),
            contact: document.getElementById('edit-contact').value.trim(),
            pfand_250: parseInt(document.getElementById('edit-pfand-250').innerText) || 0,
            pfand_400: parseInt(document.getElementById('edit-pfand-400').innerText) || 0
        };

        if (!payload.name) {
            alert("Der Kunde braucht mindestens einen Namen!");
            return;
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
                headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                this.closeEditor();
                await this.loadList();
                // Globale App-Daten aktualisieren (damit Dashboard & Lager das merken!)
                if(window.app && window.app.refreshData) window.app.refreshData(); 
            } else {
                alert("Fehler beim Speichern in der Datenbank!");
            }
        } catch (e) {
            alert("Netzwerkfehler beim Speichern.");
        }
    },

    deleteCustomer: async function(id, name) {
        if (!confirm(`Kunde "${name}" wirklich löschen?\n(Die offenen Gläser werden dabei ebenfalls gelöscht!)`)) return;
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
