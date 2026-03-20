 window.wurstManager = {
    bestandData: [],

    init: async function() {
        await this.loadList();
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
                
                // Plural anpassen für die Anzeige
                let dispUnit = item.unit;
                if (dispUnit.includes('Glas') && Number(item.amount) !== 1) {
                    dispUnit = dispUnit.replace('Glas', 'Gläser');
                } else if (dispUnit === 'Stück' && Number(item.amount) !== 1) {
                    dispUnit = 'Stück'; // Stück bleibt im Deutschen oft Stück, kann man anpassen
                }

                container.innerHTML += `
                    <div class="wurst-card" onclick="window.wurstManager.openEditor('${safeData}')">
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
                `;
            });

        } catch (e) {
            container.innerHTML = '<p class="text-muted" style="color: var(--accent-danger);">Netzwerkfehler.</p>';
        }
    },

    openEditor: function(encodedData = null) {
        document.getElementById('wurststand-list-view').style.display = 'none';
        document.getElementById('wurststand-editor-view').style.display = 'block';

        if (encodedData) {
            const item = JSON.parse(decodeURIComponent(encodedData));
            document.getElementById('editor-title').innerText = "Bestand bearbeiten";
            document.getElementById('edit-id').value = item.id;
            document.getElementById('edit-name').value = item.name;
            document.getElementById('edit-amount').value = item.amount;
            document.getElementById('edit-unit').value = item.unit;
        } else {
            document.getElementById('editor-title').innerText = "Neue Wurst einbuchen";
            document.getElementById('edit-id').value = '';
            document.getElementById('edit-name').value = '';
            document.getElementById('edit-amount').value = '';
        }
    },

    closeEditor: function() {
        document.getElementById('wurststand-list-view').style.display = 'block';
        document.getElementById('wurststand-editor-view').style.display = 'none';
    },

    saveItem: async function() {
        let id = document.getElementById('edit-id').value;
        const nameVal = document.getElementById('edit-name').value.trim();
        const amountVal = Number(document.getElementById('edit-amount').value) || 0;
        const unitVal = document.getElementById('edit-unit').value;

        if (!nameVal) {
            alert("Bitte gib einen Namen ein!");
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
            } else {
                const err = await res.text();
                alert("Fehler beim Speichern!\n" + err);
            }
        } catch (e) {
            alert("Netzwerkfehler beim Speichern.");
        }
    },

    deleteItem: async function(id, name) {
        if (!confirm(`"${name}" komplett aus dem Bestand löschen?`)) return;
        try {
            const res = await fetch(`${supabaseUrl}/rest/v1/wurst_bestand?id=eq.${id}`, {
                method: 'DELETE',
                headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
            });
            if (res.ok) {
                await this.loadList();
            }
        } catch (e) {
            alert("Fehler beim Löschen.");
        }
    }
};

document.addEventListener('DOMContentLoaded', () => window.wurstManager.init());
