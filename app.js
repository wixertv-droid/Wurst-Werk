const app = {
    init: async function() {
        console.log("Wurstwerk App gestartet!");
        await this.loadDashboard();
        await this.loadLager();
    },

    switchView: function(viewId) {
        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active');
            view.style.display = 'none';
        });
        
        const activeView = document.getElementById(viewId);
        if (activeView) {
            activeView.classList.add('active');
            activeView.style.display = 'block';
        }

        document.querySelectorAll('.bottom-nav button').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const navId = 'nav-' + viewId.split('-')[1];
        const activeNav = document.getElementById(navId);
        if (activeNav) {
            activeNav.classList.add('active');
        }
        
        if (viewId === 'view-dashboard') this.loadDashboard();
        if (viewId === 'view-lager') this.loadLager();
        if (viewId === 'view-einkauf' && typeof assistant !== 'undefined') assistant.renderRecentPurchases();
    },

    loadDashboard: async function() {
        // 1. Lagerwerte laden
        const inventory = await db.getInventory();
        let totalValue = 0;
        let totalItems = inventory.length;

        inventory.forEach(item => {
            if(item.price) totalValue += Number(item.price);
        });

        document.getElementById('dash-value').innerText = totalValue.toFixed(2).replace('.', ',') + ' €';
        document.getElementById('dash-items').innerText = totalItems + ' Positionen';
        
        // 2. Produktion laden (Bereitet den Code schon mal vor)
        const prodList = document.getElementById('dash-production-list');
        if (typeof db.getProductions === 'function') {
            const productions = await db.getProductions();
            if (!productions || productions.length === 0) {
                prodList.innerHTML = '<div class="recent-item"><div class="lager-item-info"><span>Smoker ist kalt. Keine aktiven Chargen.</span></div></div>';
            } else {
                // Hier werden später die echten Chargen geladen
                prodList.innerHTML = '';
            }
        } else {
            // Zeigt an, dass wir das in der Datenbank noch bauen müssen
            prodList.innerHTML = '<div class="recent-item" style="border-left-color: #555;"><div class="lager-item-info"><span>Produktions-Datenbank noch nicht verknüpft.</span></div></div>';
        }
    },

    loadLager: async function() {
        const inventory = await db.getInventory();
        const lagerList = document.getElementById('lager-list');
        
        if (!inventory || inventory.length === 0) {
            lagerList.innerHTML = '<p style="text-align:center; color:#666; margin-top: 20px;">Dein Lager ist leer.</p>';
            return;
        }

        lagerList.innerHTML = ''; 
        inventory.sort((a, b) => a.name.localeCompare(b.name));

        inventory.forEach(item => {
            let priceString = item.price ? ` | ${Number(item.price).toFixed(2).replace('.', ',')} €` : '';
            lagerList.innerHTML += `
                <div class="lager-item">
                    <div class="lager-item-info">
                        <strong>${item.name}</strong>
                        <span>Zuletzt gebucht: ${item.last_updated ? new Date(item.last_updated).toLocaleDateString('de-DE') : 'Neu'} ${priceString}</span>
                    </div>
                    <div class="lager-item-amount">
                        ${item.amount} <small>${item.unit || 'Stk'}</small>
                    </div>
                </div>
            `;
        });
    },

    filterLager: function() {
        const searchTerm = document.getElementById('search-lager').value.toLowerCase();
        const items = document.querySelectorAll('.lager-item');
        
        items.forEach(item => {
            const text = item.innerText.toLowerCase();
            item.style.display = text.includes(searchTerm) ? 'flex' : 'none';
        });
    }
};

window.onload = () => app.init();
