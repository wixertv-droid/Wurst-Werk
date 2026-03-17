const assistant = {
    processPurchase: async function() {
        console.log("Starte Speichervorgang...");

        // Felder holen
        const nameVal = document.getElementById('buy-name').value;
        const catVal = document.getElementById('buy-category').value;
        const amountVal = document.getElementById('buy-amount').value;
        const priceVal = document.getElementById('buy-price').value;

        // Validierung
        if (!nameVal || !amountVal) {
            alert("Name und Menge sind Pflichtfelder!");
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
            // Wir versuchen es mit einer simplen Fetch-Anfrage
            const response = await fetch(`${supabaseUrl}/rest/v1/inventory`, {
                method: 'POST',
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal' // Wichtig für Supabase POST
                },
                body: JSON.stringify(newEntry)
            });

            if (response.ok) {
                console.log("Speichern erfolgreich!");
                alert("🛒 Einkauf erfolgreich gespeichert!");
                
                // Felder leeren
                document.getElementById('buy-name').value = '';
                document.getElementById('buy-amount').value = '';
                document.getElementById('buy-price').value = '';
                
                // Dashboard sofort aktualisieren
                if (typeof app !== 'undefined') {
                    await app.refreshData();
                }
            } else {
                // Wenn es nicht klappt, lesen wir die Fehlermeldung aus
                const errorData = await response.json();
                console.error("Supabase Fehler Details:", errorData);
                alert("Fehler von der Datenbank: " + (errorData.message || "Unbekannter Fehler"));
            }
        } catch (err) {
            console.error("Netzwerkfehler:", err);
            alert("Netzwerkfehler: Konnte keine Verbindung zu Supabase aufbauen.");
        }
    }
};
