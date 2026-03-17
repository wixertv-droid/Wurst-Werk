const assistant = {
    // Prüft während dem Tippen, ob das Produkt existiert
    checkExisting: async function() {
        const name = document.getElementById('buy-name').value.toLowerCase();
        const hint = document.getElementById('duplicate-hint');
        const inventory = await db.getInventory();
        
        const exists = inventory.some(i => i.name.toLowerCase() === name);
        hint.style.display = (exists && name.length > 2) ? 'block' : 'none';
    },

    processPurchase: async function() {
        const name = document.getElementById('buy-name').value.trim();
        const amount = Number(document.getElementById('buy-amount').value);
        const price = Number(document.getElementById('buy-price').value);

        if(!name || amount <= 0) {
            alert("Bitte Name und Menge angeben!");
            return;
        }

        const inventory = await db.getInventory();
        // Exakter Abgleich (Case Insensitive)
        const existingItem = inventory.find(i => i.name.toLowerCase() === name.toLowerCase());

        try {
            if(existingItem) {
                // UPDATE: Vorhandenes Produkt erhöhen
                const newTotal = Number(existingItem.amount) + amount;
                const newPrice = Number(existingItem.price || 0) + price;
                
                await fetch(`${supabaseUrl}/rest/v1/inventory?id=eq.${existingItem.id}`, {
                    method: 'PATCH',
                    headers: {
                        'apikey': supabaseKey,
                        'Authorization': `Bearer ${supabaseKey}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=minimal'
                    },
                    body: JSON.stringify({ 
                        amount: newTotal, 
                        price: newPrice,
                        last_updated: new Date() 
                    })
                });
                alert(`${name} wurde aktualisiert (+${amount})`);
            } else {
                // NEUANLAGE: Produkt existiert noch nicht
                await fetch(`${supabaseUrl}/rest/v1/inventory`, {
                    method: 'POST',
                    headers: {
                        'apikey': supabaseKey,
                        'Authorization': `Bearer ${supabaseKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        name: name,
                        amount: amount,
                        price: price,
                        category: 'Fleisch', // Standard oder über Select
                        unit: 'g'
                    })
                });
                alert(`${name} neu im Lager angelegt!`);
            }

            // Felder leeren & Liste aktualisieren
            this.clearInputs();
            app.refreshData();
            this.renderRecentPurchases(); // Die neue Übersicht unten füllen

        } catch (error) {
            console.error("Fehler beim Speichern:", error);
        }
    },

    clearInputs: function() {
        document.getElementById('buy-name').value = '';
        document.getElementById('buy-amount').value = '';
        document.getElementById('buy-price').value = '';
        document.getElementById('duplicate-hint').style.display = 'none';
    },

    renderRecentPurchases: async function() {
        const data = await db.getInventory();
        // Wir sortieren nach den neuesten (angenommen wir haben ein 'updated_at' oder nutzen einfach die Liste)
        const recentList = document.getElementById('recent-purchases');
        recentList.innerHTML = '';

        // Zeige die letzten 3 Einträge/Änderungen
        data.slice(-3).reverse().forEach(item => {
            recentList.innerHTML += `
                <div class="recent-item">
                    <div class="recent-info">
                        <strong>${item.name}</strong>
                        <span>Aktueller Bestand: ${item.amount}${item.unit}</span>
                    </div>
                    <div class="recent-badge">Lager aktiv</div>
                </div>
            `;
        });
    }
};
