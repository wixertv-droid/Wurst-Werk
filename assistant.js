const assistant = {
    // Diese Funktion liest die Felder aus und speichert in Supabase
    processPurchase: async function() {
        const name = document.getElementById('buy-name').value;
        const category = document.getElementById('buy-category').value;
        const amount = document.getElementById('buy-amount').value;

        if(!name || !amount) {
            alert("Bitte Name und Menge angeben!");
            return;
        }

        // Wir schauen erst, ob der Artikel schon im Lager existiert
        const inventory = await db.getInventory();
        const existingItem = inventory.find(i => i.name.toLowerCase() === name.toLowerCase());

        if(existingItem) {
            // Artikel existiert -> Menge addieren
            const newTotal = Number(existingItem.amount) + Number(amount);
            await db.updateStock(existingItem.id, newTotal);
        } else {
            // Neuer Artikel -> In Supabase anlegen (über fetch)
            await fetch(`${supabaseUrl}/rest/v1/inventory`, {
                method: 'POST',
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: name,
                    category: category,
                    amount: amount,
                    unit: category === 'Fleisch' ? 'g' : (category === 'Material' ? 'Stk/m' : 'g')
                })
            });
        }

        alert(`${amount} zu ${name} hinzugefügt!`);
        
        // Felder leeren
        document.getElementById('buy-name').value = '';
        document.getElementById('buy-amount').value = '';

        // App Daten aktualisieren
        await app.refreshData();
        this.checkSuggestions(inventory);
    },

    checkSuggestions: function(inventory) {
        // Hier können wir später die Rezept-Logik einbauen
        // Für den Moment zeigen wir die Box nur an, wenn Fleisch da ist
        const fleisch = inventory.filter(i => i.category === 'Fleisch' && i.amount > 0);
        if(fleisch.length > 0) {
            document.getElementById('suggestion-box').style.display = 'flex';
            document.getElementById('suggestion-text').innerHTML = `💡 <b>Tipp:</b> Du hast ${fleisch.length} Sorten Fleisch. Prüfe die Rezepte für die nächste Produktion!`;
        }
    }
};
