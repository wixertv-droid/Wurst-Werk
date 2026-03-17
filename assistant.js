const assistant = {
    inventoryData: [], // Hier merken wir uns das Lager
    existingItem: null, // Hier merken wir uns, ob wir etwas gefunden haben

    // Startet sofort, wenn die einkauf.html geladen wird
    init: async function() {
        console.log("Lade Lager für Echtzeit-Prüfung...");
        this.inventoryData = await db.getInventory();
    },

    // Wird bei jedem Tastendruck im Namensfeld aufgerufen
    checkItemExists: function() {
        const name = document.getElementById('buy-name').value.trim().toLowerCase();
        const statusBox = document.getElementById('item-status');

        // Wenn noch zu wenig getippt wurde, Box verstecken
        if (name.length < 2) {
            statusBox.style.display = 'none';
            this.existingItem = null;
            return;
        }

        // Suchen, ob der Artikel schon da ist
        const found = this.inventoryData.find(i => i.name.toLowerCase() === name);
        
        if (found) {
            this.existingItem = found;
            statusBox.innerHTML = `<span class="material-symbols-outlined" style="font-size:1.1rem; vertical-align:middle;">info</span> <b>${found.name}</b> existiert (${found.amount} ${found.unit}). Menge wird addiert.`;
            statusBox.style.display = 'block';
            statusBox.style.backgroundColor = 'rgba(255, 140, 0, 0.1)';
            statusBox.style.color = 'var(--accent-amber)';
            statusBox.style.padding = '10px';
            statusBox.style.borderRadius = '8px';
            statusBox.style.marginTop = '10px';
            
            // Praktisch: Kategorie und Einheit automatisch auf das setzen, was wir schon haben!
            document.getElementById('buy-category').value = found.category;
            document.getElementById('buy-unit').value = found.unit === 'g' && found.amount >= 1000 ? 'kg' : found.unit;
        } else {
            this.existingItem = null;
            statusBox.innerHTML = `<span class="material-symbols-outlined" style="font-size:1.1rem; vertical-align:middle;">fiber_new</span> Neuer Artikel wird angelegt.`;
            statusBox.style.display = 'block';
            statusBox.style.backgroundColor = 'rgba(46, 125, 50, 0.1)';
            statusBox.style.color = '#4caf50';
            statusBox.style.padding = '10px';
            statusBox.style.borderRadius = '8px';
            statusBox.style.marginTop = '10px';
        }
    },

    // Wenn du auf "Speichern" drückst
    processPurchase: async function() {
        const nameVal = document.getElementById('buy-name').value.trim();
        const catVal = document.getElementById('buy-category').value;
        const amountVal = parseFloat(document.getElementById('buy-amount').value);
        const unitInput = document.getElementById('buy-unit').value;
        const priceVal = parseFloat(document.getElementById('buy-price').value);

        if (!nameVal || isNaN(amountVal) || amountVal <= 0) {
            alert("⚠️ Bitte fülle den Namen und die Menge aus!");
            return;
        }

        // Einheit umrechnen (kg -> g)
        let finalAmount = amountVal;
        let finalUnit = unitInput;
        if (unitInput === 'kg') {
            finalAmount = amountVal * 1000;
            finalUnit = 'g';
        }

        const parsedPrice = isNaN(priceVal) ? 0 : priceVal;

        if (this.existingItem) {
            // ARTIKEL EXISTIERT -> Menge & Preis addieren (PATCH)
            const newTotalAmount = Number(this.existingItem.amount) + finalAmount;
            const newTotalPrice = Number(this.existingItem.price || 0) + parsedPrice;

            try {
                const response = await fetch(`${supabaseUrl}/rest/v1/inventory?id=eq.${this.existingItem.id}`, {
                    method: 'PATCH',
                    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ amount: newTotalAmount, price: newTotalPrice })
                });
                
                if (response.ok) window.location.href = 'lager.html';
                else alert("Fehler beim Aktualisieren.");
            } catch (e) { alert("Verbindungsfehler!"); }

        } else {
            // ARTIKEL IST NEU -> Neu anlegen (POST)
            const newEntry = {
                name: nameVal, category: catVal, amount: finalAmount, price: parsedPrice, unit: finalUnit
            };

            const result = await db.insertInventory(newEntry);
            if (result && result.ok) {
                window.location.href = 'lager.html'; // Wir springen nachher zur neuen lager.html!
            } else {
                alert("Fehler beim Speichern des neuen Artikels.");
            }
        }
    }
};

// Sobald die Seite geladen ist, das Lager im Hintergrund holen
document.addEventListener('DOMContentLoaded', () => assistant.init());
