const kundenManager = {
    init: async function() {
        await this.loadList();
    },

    loadList: async function() {
        const listEl = document.getElementById('customer-page-list');
        if (!listEl) return;

        try {
            const customers = await db.getCustomers();
            
            // SICHERHEITS-CHECK: Hat die Datenbank einen Fehler gemeldet?
            if (!Array.isArray(customers)) {
                console.error("Supabase Fehler:", customers);
                listEl.innerHTML = `<p class="text-muted" style="color: var(--accent-danger); text-align: center;">Verbindungsfehler oder Datenbank-Problem.</p>`;
                return;
            }

            listEl.innerHTML = '';

            if (customers.length === 0) {
                listEl.innerHTML = '<p class="text-muted" style="text-align: center;">Du hast noch keine Kunden angelegt.</p>';
                return;
            }

            // Alphabetisch sortieren und anzeigen
            customers.sort((a, b) => a.name.localeCompare(b.name)).forEach(k => {
                const pfand250 = Number(k.pfand_250) || 0;
                const pfand400 = Number(k.pfand_400) || 0;

                listEl.innerHTML += `
                    <div class="list-card">
                        <div class="icon-box" style="background: #222;"><span class="material-symbols-outlined" style="color: var(--accent-amber);">person</span></div>
                        <div class="info">
                            <h3 style="font-size: 1.1rem; margin-bottom: 4px;">${k.name}</h3>
                            <p style="color: var(--accent-danger); font-size: 0.85rem; margin: 0;">
                                Pfand: ${pfand250}x 250ml | ${pfand400}x 400ml
                            </p>
                        </div>
                        <button onclick="kundenManager.deleteCustomer('${k.id}', '${k.name}')" style="background:none; border:none; color:var(--accent-danger); cursor:pointer; padding: 10px;">
                            <span class="material-symbols-outlined">delete</span>
                        </button>
                    </div>
                `;
            });
        } catch (e) {
            console.error("Fehler beim Laden der Kunden", e);
            listEl.innerHTML = '<p class="text-muted" style="color: var(--accent-danger); text-align: center;">Fehler beim Laden der Datenbank.</p>';
        }
    },

    addCustomer: async function() {
        const nameEl = document.getElementById('new-customer-name');
        const nameVal = nameEl.value.trim();

        if (!nameVal) {
            alert("⚠️ Bitte gib einen Namen ein!");
            return;
        }

        try {
            const response = await fetch(`${supabaseUrl}/rest/v1/customers`, {
                method: 'POST',
                headers: { 
                    'apikey': supabaseKey, 
                    'Authorization': `Bearer ${supabaseKey}`, 
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify({ name: nameVal, pfand_250: 0, pfand_400: 0 })
            });

            if (response.ok) {
                nameEl.value = ''; 
                await this.loadList(); 
                
                if (typeof app !== 'undefined' && app.refreshData) {
                    app.refreshData();
                }
            } else {
                const err = await response.json();
                alert("❌ Fehler beim Speichern: " + JSON.stringify(err));
            }
        } catch (e) { 
            alert("Netzwerkfehler beim Speichern!"); 
        }
    },

    deleteCustomer: async function(id, name) {
        if (!confirm(`Möchtest du den Kunden "${name}" wirklich unwiderruflich löschen?`)) return;

        try {
            const res = await fetch(`${supabaseUrl}/rest/v1/customers?id=eq.${id}`, {
                method: 'DELETE',
                headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
            });

            if (res.ok) {
                await this.loadList();
                if (typeof app !== 'undefined' && app.refreshData) {
                    app.refreshData();
                }
            } else {
                alert("Fehler beim Löschen des Kunden.");
            }
        } catch (e) { 
            alert("Verbindungsfehler."); 
        }
    }
};

document.addEventListener('DOMContentLoaded', () => kundenManager.init());
