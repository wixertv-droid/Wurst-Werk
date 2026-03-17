const assistant = {
    processPurchase: async function() {
        const name = document.getElementById('buy-name').value;
        const category = document.getElementById('buy-category').value;
        const amount = Number(document.getElementById('buy-amount').value);
        const price = Number(document.getElementById('buy-price').value);

        if(!name || amount <= 0) {
            alert("Bitte Name und Menge eingeben!");
            return;
        }

        try {
            // Wir nutzen POST, um ein neues Item anzulegen
            const response = await fetch(`${supabaseUrl}/rest/v1/inventory`, {
                method: 'POST',
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify({
                    name: name,
                    category: category,
                    amount: amount,
                    price: price || 0,
                    unit: category === 'Fleisch' ? 'g' : (category === 'Material' ? 'Stk' : 'g')
                })
            });

            if(response.ok) {
                alert("Erfolgreich gespeichert!");
                // Felder leeren
                document.getElementById('buy-name').value = '';
                document.getElementById('buy-amount').value = '';
                document.getElementById('buy-price').value = '';
                // Dashboard aktualisieren
                await app.refreshData();
            } else {
                throw new Error("Fehler beim Speichern");
            }
        } catch (error) {
            alert("Fehler: " + error.message);
        }
    }
};
