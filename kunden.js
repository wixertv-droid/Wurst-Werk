const kundenManager = {
    // Startet, sobald die Seite geladen ist
    init: async function() {
        await this.loadList();
    },

    // Lädt alle Kunden aus Supabase
    loadList: async function() {
        const listEl = document.getElementById('customer-page-list');
        if (!listEl) return;

        try {
            const customers = await db.getCustomers();
            listEl.innerHTML = '';

            if (customers.length === 0) {
                listEl.innerHTML = '<p class="text-muted" style="text-align: center;">Du hast noch keine Kunden angelegt.</p>';
                return;
            }

            // Alphabetisch sortieren
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
            listEl.innerHTML = '<p class="text-muted" style="color: red;">Fehler beim Laden der Datenbank.</p>';
        }
    },

    // Fügt einen neuen Kunden hinzu
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
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify({ name: nameVal, pfand_250: 0, pfand_400: 0 })
            });

            if (response.ok) {
                nameEl.value = ''; // Feld leeren
                await this.loadList(); // Liste sofort aktualisieren
                
                // Falls app.js gerade mitläuft, auch die globalen Daten kurz updaten
                if (typeof app !== 'undefined' && app.refreshData) {
                    app.refreshData();
                }
            } else {
                alert("❌ Fehler beim Speichern des Kunden.");
            }
        } catch (e) { 
            alert("Netzwerkfehler!"); 
        }
    },

    // Löscht einen Kunden
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

// Startet automatisch beim Öffnen der Kunden-Seite
document.addEventListener('DOMContentLoaded', () => kundenManager.init());
