const assistant = {
    processPurchase: async function() {
        const nameVal = document.getElementById('buy-name').value;
        const catVal = document.getElementById('buy-category').value;
        const amountVal = document.getElementById('buy-amount').value;
        const priceVal = document.getElementById('buy-price').value;

        if (!nameVal || !amountVal) {
            alert("⚠️ Bitte fülle Name und Menge aus!");
            return;
        }

        const newEntry = {
            name: nameVal,
            category: catVal,
            amount: parseFloat(amountVal),
            price: parseFloat(priceVal) || 0,
            unit: catVal === 'Fleisch' ? 'g' : (catVal === 'Material' ? 'Stk' : 'g')
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

            if (response.ok) {
                // Erfolgreich! Wir leiten den Nutzer zurück zur Startseite (index.html)
                // Die Startseite lädt beim Öffnen automatisch die neuesten Daten aus Supabase
                window.location.href = 'index.html';
            } else {
                const err = await response.json();
                alert("Fehler von der Datenbank: " + err.message);
            }
        } catch (e) {
            alert("Verbindungsfehler. Bitte prüfe dein Internet.");
        }
    }
};
