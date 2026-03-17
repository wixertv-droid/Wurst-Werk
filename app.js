const app = {
    
    init: async function() {
        console.log("Wurstwerk App gestartet!");
        await this.refreshData();
    },

    // Holt frische Daten aus Supabase und schreibt sie in die App
    refreshData: async function() {
        try {
            const data = await db.getInventory();
            
            // 1. Dashboard Zahlen füllen
            const glaeser = data.find(i => i.name === 'Leere Gläser');
            if(glaeser) document.getElementById('stat-gläser').innerText = glaeser.amount;

            const fleisch = data.filter(i => i.category === 'Fleisch');
            const gesamtFleisch = fleisch.reduce((sum, item) => sum + Number(item.amount), 0);
            document.getElementById('stat-fleisch').innerText = (gesamtFleisch / 1000) + 'kg';

            // 2. Lager-Liste im Lager-Tab bauen
            const lagerListe = document.getElementById('inventory-list');
            lagerListe.innerHTML = '';
            data.forEach(item => {
                lagerListe.innerHTML += `
                    <div class="list-card">
                        <div class="icon-box"><span class="material-symbols-outlined">reorder</span></div>
                        <div class="info">
                            <h3>${item.name}</h3>
                            <p>Bestand: ${item.amount} ${item.unit}</p>
                        </div>
                    </div>
                `;
            });

        } catch (error) {
            console.error("Fehler beim Laden:", error);
        }
    },

    switchView: function(viewName, clickedElement) {
        document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
        document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
        document.getElementById('view-' + viewName).classList.add('active');
        clickedElement.classList.add('active');
        
        // Jedes Mal wenn wir den View wechseln, laden wir die Daten neu
        this.refreshData();
    }
};

document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
