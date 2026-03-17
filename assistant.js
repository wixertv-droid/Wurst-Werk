const assistant = {
    pendingEntry: null, // Merkt sich deine Eingaben
    existingItem: null, // Merkt sich den gefundenen Artikel

    // Schritt 1: Prüfen, was du eingegeben hast
    processPurchase: async function() {
        const nameVal = document.getElementById('buy-name').value.trim();
        const catVal = document.getElementById('buy-category').value;
        const amountVal = parseFloat(document.getElementById('buy-amount').value);
        const unitInput = document.getElementById('buy-unit').value;
        const priceVal = parseFloat(document.getElementById('buy-price').value);

        if (!nameVal || isNaN(amountVal) || amountVal <= 0) {
            alert("⚠️ Bitte fülle den Namen und eine Menge aus!");
            return;
        }

        // Einheit umrechnen (kg -> g)
        let finalAmount = amountVal;
        let finalUnit = unitInput;
        if (unitInput === 'kg') {
            finalAmount = amountVal * 1000;
            finalUnit = 'g';
        }

        // Wir speichern das kurz zwischen
        this.pendingEntry = {
            name: nameVal,
            category: catVal,
            amount: finalAmount,
            price: isNaN(priceVal) ? 0 : priceVal,
            unit: finalUnit
        };

        // Gucken, ob es das schon gibt!
        const inventory = await db.getInventory();
        const exists = inventory.find(i => i.name.toLowerCase() === nameVal.toLowerCase() && i.category === catVal);

        if (exists) {
            // Artikel GEFUNDEN -> Smart-Filter Pop-up anzeigen
            this.existingItem = exists;
            document.getElementById('dup-name').innerText = exists.name;
            document.getElementById('dup-amount').innerText = `${exists.amount} ${exists.unit}`;
            document.getElementById('duplicate-modal').style.display = 'flex';
        } else {
            // Artikel NEU -> Direkt speichern
            this.saveAsNew();
        }
    },

    // Schritt 2a: Wenn du "Zum Bestand addieren" klickst (PATCH = Update)
    addToExisting: async function() {
        document.getElementById('duplicate-modal').style.display = 'none';
        
        const newTotalAmount = Number(this.existingItem.amount) + this.pendingEntry.amount;
        const newTotalPrice = Number(this.existingItem.price || 0) + this.pendingEntry.price;

        try {
            const response = await fetch(`${supabaseUrl}/rest/v1/inventory?id=eq.${this.existingItem.id}`, {
                method: 'PATCH',
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ amount: newTotalAmount, price: newTotalPrice })
            });
            this.handleResponse(response);
        } catch (e) {
            alert("Verbindungsfehler beim Aktualisieren.");
        }
    },

    // Schritt 2b: Wenn du "Als extra Posten" klickst ODER es ganz neu ist (POST = Neu anlegen)
    saveAsNew: async function() {
        document.getElementById('duplicate-modal').style.display = 'none';

        try {
            const response = await fetch(`${supabaseUrl}/rest/v1/inventory`, {
                method: 'POST',
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(this.pendingEntry)
            });
            this.handleResponse(response);
        } catch (e) {
            alert("Verbindungsfehler beim Speichern.");
        }
    },

    // Schritt 3: Was nach dem Speichern passiert
    handleResponse: async function(response) {
        if (response.ok) {
            // Achtung: Wir leiten jetzt zur NEUEN lager.html weiter, 
            // die wir im nächsten Schritt zusammen bauen!
            window.location.href = 'lager.html'; 
        } else {
            const err = await response.json();
            alert("❌ Datenbank-Fehler: " + (err.message || JSON.stringify(err)));
        }
    }
};
