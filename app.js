const app = {
    init: async function() {
        await this.refreshData();
        await production.loadActiveProcesses();
    },

    refreshData: async function() {
        try {
            const data = await db.getInventory();
            
            // Stats
            const glaeser = data.find(i => i.name.toLowerCase().includes('glas'));
            if(glaeser) document.getElementById('stat-gläser').innerText = glaeser.amount;
            
            const wert = data.reduce((sum, item) => sum + Number(item.price || 0), 0);
            document.getElementById('stat-wert').innerText = wert.toFixed(2);

            // Lagerliste
            const list = document.getElementById('inventory-list');
            list.innerHTML = '';
            data.forEach(item => {
                list.innerHTML += `
                    <div class="list-card">
                        <div class="icon-box"><span class="material-symbols-outlined">inventory</span></div>
                        <div class="info">
                            <h3>${item.name}</h3>
                            <p>${item.amount} ${item.unit} | Wert: ${Number(item.price).toFixed(2)}€</p>
                        </div>
                    </div>
                `;
            });
        } catch (e) { console.error(e); }
    },

    switchView: function(viewName, clickedElement) {
        document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
        document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
        document.getElementById('view-' + viewName).classList.add('active');
        clickedElement.classList.add('active');
        this.refreshData();
        production.loadActiveProcesses();
    }
};
document.addEventListener('DOMContentLoaded', () => app.init());
