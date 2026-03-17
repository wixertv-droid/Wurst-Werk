const assistant = {
    // 1. Prüft während dem Tippen, ob das Produkt schon im Lager ist
    checkExisting: async function() {
        const nameInput = document.getElementById('buy-name').value.toLowerCase().trim();
        const hint = document.getElementById('duplicate-hint');
        
        // Erst ab 2 Buchstaben suchen, um die Datenbank nicht zu überlasten
        if (nameInput.length < 2) {
            hint.style.display = 'none';
            return;
        }

        const inventory = await db.getInventory();
        const exists = inventory.some(item => item.name.toLowerCase() === nameInput);
        
        // Wenn es existiert, zeige den grünen Hinweis-Badge
        if (exists) {
            hint.style.display = 'inline-block';
        } else {
            hint.style.display = 'none';
        }
    },

    // 2. Verarbeitet den Klick auf "Einlagern"
    processPurchase: async function() {
        const name = document.getElementById('buy-name').value.trim();
        const amount = Number(document.getElementById('buy-amount').value);
        const unit = document.getElementById('buy-unit').value;
        const price = Number(document.getElementById('buy-price').value) || 0; // Optional

        // Sicherheitsprüfung: Sind die Pflichtfelder ausgefüllt?
        if(!name || amount <= 0) {
            alert("Bitte gib einen Produktnamen und eine Menge größer als 0 ein!");
            return;
        }

        // Button optisch deaktivieren, damit man nicht doppelt klickt
        const btn = document.querySelector('.save-btn');
        const originalBtnText = btn.innerHTML;
        btn.innerHTML = '<span class="material-symbols-outlined">hourglass_empty</span> Speichere...';
        btn.disabled = true;

        const inventory = await db.getInventory();
        // Exakter Abgleich (Groß-/Kleinschreibung wird ignoriert)
        const existingItem = inventory.find(item => item.name.toLowerCase() === name.toLowerCase());

        try {
            if(existingItem) {
                // FALL A: PRODUKT EXISTIERT -> ADDIEREN (PATCH)
                const newTotalAmount = Number(existingItem.amount) + amount;
                const newTotalPrice = Number(existingItem.price || 0) + price;
                
                await fetch(`${supabaseUrl}/rest/v1/inventory?id=eq.${existingItem.id}`, {
                    method: 'PATCH',
                    headers: {
                        'apikey': supabaseKey,
                        'Authorization': `Bearer ${supabaseKey}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=minimal'
                    },
                    body: JSON.stringify({ 
                        amount: newTotalAmount, 
                        price: newTotalPrice,
                        unit: unit, // Falls sich die Einheit ändert
                        last_updated: new Date() 
                    })
                });
                console.log(`${name} wurde aktualisiert. Neuer Bestand: ${newTotalAmount} ${unit}`);
                
            } else {
                // FALL B: NEUES PRODUKT -> ANLEGEN (POST)
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
                        unit: unit,
                        price: price,
                        category: 'Einkauf', // Standard-Kategorie
                        last_updated: new Date()
                    })
                });
                console.log(`${name} wurde neu im Lager angelegt.`);
            }

            // Alles erfolgreich! Felder leeren und Liste unten aktualisieren
            this.clearInputs();
            this.renderRecentPurchases();
            
            // Falls du später die Lager-Liste baust, hier auch aktualisieren
            if(typeof app.loadLager === 'function') {
                app.loadLager();
            }

        } catch (error) {
            console.error("Fehler beim Speichern in Supabase:", error);
            alert("Es gab einen Fehler beim Speichern. Bitte überprüfe deine Internetverbindung.");
        } finally {
            // Button wieder freigeben
            btn.innerHTML = originalBtnText;
            btn.disabled = false;
        }
    },

    // 3. Setzt das Formular wieder zurück
    clearInputs: function() {
        document.getElementById('buy-name').value = '';
        document.getElementById('buy-amount').value = '';
        document.getElementById('buy-price').value = '';
        document.getElementById('duplicate-hint').style.display = 'none';
        document.getElementById('buy-name').focus(); // Setzt den Cursor direkt wieder ins Namensfeld
    },

    // 4. Lädt die letzten Einträge für die Übersichtskarte unten
    renderRecentPurchases: async function() {
        const recentList = document.getElementById('recent-purchases');
        recentList.innerHTML = '<p style="color: #666; font-size: 0.9rem; text-align: center;">Lade Daten...</p>';
        
        const data = await db.getInventory();
        recentList.innerHTML = '';

        if (!data || data.length === 0) {
            recentList.innerHTML = '<p style="color: #666; font-size: 0.9rem; text-align: center;">Noch keine Artikel im Lager.</p>';
            return;
        }

        // Sortieren: Neueste Änderungen zuerst (Wir simulieren das hier durch die Array-Reihenfolge)
        // Zeigt die letzten 3 aktualisierten/angelegten Artikel an
        const recentItems = data.slice(-3).reverse(); 

        recentItems.forEach(item => {
            recentList.innerHTML += `
                <div class="recent-item">
                    <div class="recent-info">
                        <strong>${item.name}</strong>
                        <span>Aktueller Bestand: ${item.amount} ${item.unit}</span>
                    </div>
                    <div class="recent-badge">✓ Gespeichert</div>
                </div>
            `;
        });
    }
};
