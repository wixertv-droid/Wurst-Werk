const assistant = {
    processPurchase: async function() {
        const nameVal = document.getElementById('buy-name').value;
        const catVal = document.getElementById('buy-category').value;
        const amountVal = document.getElementById('buy-amount').value;
        const priceVal = document.getElementById('buy-price').value;

        if (!nameVal || !amountVal) {
            alert("⚠️ Bitte Name und Menge eingeben!");
            return;
        }

        const newEntry = {
            name: nameVal,
            category: catVal,
            amount: parseFloat(amountVal),
            price: parseFloat(priceVal) || 0,
            unit: catVal === 'Fleisch' ? 'g' : (catVal === 'Material' ? 'Stk' : 'g')
        };

        const result = await db.insertInventory(newEntry);

        if (result.ok) {
            alert("✅ Einkauf erfolgreich im Lager gespeichert!");
            
            // Felder leeren
            document.getElementById('buy-name').value = '';
            document.getElementById('buy-amount').value = '';
            document.getElementById('buy-price').value = '';
            
            // Dashboard aktualisieren
            if (typeof app !== 'undefined') {
                await app.refreshData();
            }
        } else {
            alert("❌ Fehler beim Speichern! Bitte prüfe die Spaltennamen in Supabase.");
        }
    }
};
