const assistant = {
    processPurchase: async function() {
        // Wir holen die Werte direkt aus den Feldern
        const nameEl = document.getElementById('buy-name');
        const catEl = document.getElementById('buy-category');
        const amountEl = document.getElementById('buy-amount');
        const priceEl = document.getElementById('buy-price');

        if(!nameEl.value || !amountEl.value) {
            alert("Bitte Name und Menge eingeben!");
            return;
        }

        const newEntry = {
            name: nameEl.value,
            category: catEl.value,
            amount: Number(amountEl.value),
            price: Number(priceEl.value) || 0,
            unit: catEl.value === 'Fleisch' ? 'g' : (catEl.value === 'Material' ? 'Stk' : 'g')
        };

        try {
            const response = await fetch(`${supabaseUrl}/rest/v1/inventory`, {
                method: 'POST',
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(newEntry)
            });

            if(response.ok) {
                alert("Einkauf gespeichert!");
                // Felder leeren
                nameEl.value = '';
                amountEl.value = '';
                priceEl.value = '';
                // Sofort das Dashboard und die Liste aktualisieren
                await app.refreshData();
            } else {
                const err = await response.json();
                alert("Fehler: " + err.message);
            }
        } catch (error) {
            alert("Verbindung fehlgeschlagen: " + error);
        }
    }
};
