const assistant = {
    processPurchase: async function() {
        // Werte aus dem Formular auslesen
        const nameVal = document.getElementById('buy-name').value;
        const catVal = document.getElementById('buy-category').value;
        const amountVal = parseFloat(document.getElementById('buy-amount').value);
        const unitInput = document.getElementById('buy-unit').value;
        const priceVal = parseFloat(document.getElementById('buy-price').value);

        // Prüfen, ob die wichtigsten Felder ausgefüllt sind
        if (!nameVal || isNaN(amountVal) || amountVal <= 0) {
            alert("⚠️ Bitte fülle den Namen und eine gültige Menge aus!");
            return;
        }

        // Smarte Umrechnung in die Grundeinheit (für saubere Rezepte)
        let finalAmount = amountVal;
        let finalUnit = unitInput;

        // Wenn jemand kg auswählt, rechnen wir es intern in Gramm um
        if (unitInput === 'kg') {
            finalAmount = amountVal * 1000;
            finalUnit = 'g';
        }

        // Datenbank-Eintrag vorbereiten
        const newEntry = {
            name: nameVal,
            category: catVal,
            amount: finalAmount,
            price: isNaN(priceVal) ? 0 : priceVal,
            unit: finalUnit
        };

        console.log("Versuche zu speichern:", newEntry);

        // Sende Daten an db.js
        const result = await db.insertInventory(newEntry);

        if (result && result.ok) {
            alert(`✅ ${amountVal} ${unitInput} ${nameVal} erfolgreich im Lager gespeichert!`);
            
            // Zurück zur Hauptseite springen!
            window.location.href = 'index.html';
        } else {
            // Falls Supabase meckert, lesen wir den genauen Fehler aus
            let errorMsg = "Unbekannter Fehler";
            try {
                const errObj = await result.json();
                errorMsg = errObj.message || JSON.stringify(errObj);
            } catch (e) {
                errorMsg = "Konnte die genaue Fehlermeldung nicht lesen.";
            }
            alert("❌ Fehler beim Speichern! Details: " + errorMsg);
        }
    }
};
