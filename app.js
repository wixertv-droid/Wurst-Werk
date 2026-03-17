const app = {
    init: async function() {
        console.log("Wurstwerk initialisiert...");
        await this.refreshData();
    },

    refreshData: async function() {
        try {
            const data = await db.getInventory();
            console.log("Daten empfangen:", data); // Zum Debuggen in der Konsole

            if (!data || data.error) throw new Error("Keine Daten erhalten");

            // 1. Dashboard Statistik
            const glaeser = data.find(i => i.name.toLowerCase().includes('glas'));
            document.getElementById('stat-gläser').innerText = glaeser ? glaeser.amount : "0";

            const gesamtWert = data.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
            document.getElementById('stat-wert').innerText = gesamtWert.toFixed(2);

            // 2. Lager-Liste (mit Lösch-Funktion)
            const lagerListe = document.getElementById('inventory-list');
            lagerListe.innerHTML = '';
            
            data.forEach(item => {
                const preis = Number(item.price) || 0;
                const menge = Number(item.amount) || 0;

                lagerListe.innerHTML += `
                    <div class="list-card">
                        <div class="icon-box"><span class="material-symbols-outlined">inventory</span></div>
                        <div class="info">
                            <h3>${item.name}</h3>
                            <p>${menge} ${item.unit} | Wert: ${preis.toFixed(2)}€</p>
                        </div>
                        <button onclick="app.deleteItem('${item.id}')" style="background:none; border:none; color:var(--accent-danger); cursor:pointer;">
                            <span class="material-symbols-outlined">delete</span>
                        </button>
                    </div>
                `;
            });

            // 3. Kunden laden
            await this.loadCustomers();

        } catch (error) {
            console.error("Fehler beim Laden:", error);
        }
    },

    loadCustomers: async function() {
        try {
            const response = await fetch(`${supabaseUrl}/rest/v1/customers?select=*`, {
                headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
            });
            const customers = await response.json();
            const list = document.getElementById('customer-list');
            list.innerHTML = '';
            customers.forEach(c => {
                list.innerHTML += `
                    <div class="list-card">
                        <div class="icon-box"><span class="material-symbols-outlined">person</span></div>
                        <div class="info">
                            <h3>${c.name}</h3>
                            <p>Pfandschulden: ${c.pfand_schulden} Gläser</p>
                        </div>
                    </div>
                `;
            });
        } catch (e) { console.error("Kundenfehler:", e); }
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
        this.refreshData();
    }
};

document.addEventListener('DOMContentLoaded', () => app.init());
