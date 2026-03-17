const app = {
    init: async function() {
        console.log("Wurstwerk startet...");
        // Alles laden
        await this.refreshData();
    },

    refreshData: async function() {
        try {
            const data = await db.getInventory();
            
            // 1. Dashboard Stats
            const glaeser = data.find(i => i.name.toLowerCase().includes('glas'));
            document.getElementById('stat-gläser').innerText = glaeser ? glaeser.amount : "0";

            const gesamtWert = data.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
            document.getElementById('stat-wert').innerText = gesamtWert.toFixed(2);

            // 2. Lager-Liste
            const lagerListe = document.getElementById('inventory-list');
            if(lagerListe) {
                lagerListe.innerHTML = '';
                data.forEach(item => {
                    lagerListe.innerHTML += `
                        <div class="list-card">
                            <div class="icon-box"><span class="material-symbols-outlined">inventory</span></div>
                            <div class="info">
                                <h3>${item.name}</h3>
                                <p>${item.amount} ${item.unit} | Wert: ${Number(item.price).toFixed(2)}€</p>
                            </div>
                            <button onclick="app.deleteItem('${item.id}')" style="background:none; border:none; color:var(--accent-danger);">
                                <span class="material-symbols-outlined">delete</span>
                            </button>
                        </div>
                    `;
                });
            }

            // 3. Andere Sektionen laden
            await this.loadCustomers();
            if(typeof production !== 'undefined') {
                await production.loadActiveProcesses();
            }

        } catch (error) {
            console.error("Fehler beim Refresh:", error);
        }
    },

    loadCustomers: async function() {
        const list = document.getElementById('customer-list');
        if(!list) return;
        try {
            const response = await fetch(`${supabaseUrl}/rest/v1/customers?select=*`, {
                headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
            });
            const customers = await response.json();
            list.innerHTML = '';
            customers.forEach(c => {
                list.innerHTML += `
                    <div class="list-card">
                        <div class="icon-box"><span class="material-symbols-outlined">person</span></div>
                        <div class="info"><h3>${c.name}</h3><p>Pfand: ${c.pfand_schulden}</p></div>
                    </div>
                `;
            });
        } catch (e) { console.log("Keine Kunden gefunden"); }
    },

    deleteItem: async function(id) {
        if(confirm("Wirklich löschen?")) {
            await fetch(`${supabaseUrl}/rest/v1/inventory?id=eq.${id}`, {
                method: 'DELETE',
                headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
            });
            await this.refreshData();
        }
    },

    switchView: function(viewName, clickedElement) {
        document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
        document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
        
        const targetView = document.getElementById('view-' + viewName);
        if(targetView) targetView.classList.add('active');
        if(clickedElement) clickedElement.classList.add('active');
        
        // Jedes Mal beim Wechseln alles frisch laden!
        this.refreshData();
    }
};

document.addEventListener('DOMContentLoaded', () => app.init());
