const assistant = {
    checkExisting: async function() {
        const nameInput = document.getElementById('buy-name').value.toLowerCase().trim();
        const hint = document.getElementById('duplicate-hint');
        
        if (nameInput.length < 2) {
            hint.style.display = 'none';
            return;
        }

        const inventory = await db.getInventory();
        const exists = inventory.some(item => item.name.toLowerCase() === nameInput);
        hint.style.display = exists ? 'inline-block' : 'none';
    },

    processPurchase: async function() {
        const name = document.getElementById('buy-name').value.trim();
        const amount = Number(document.getElementById('buy-amount').value);
        const unit = document.getElementById('buy-unit').value;
        const price = Number(document.getElementById('buy-price').value) || 0;

        if(!name || amount <= 0) {
            alert("Bitte Produktnamen und Menge angeben!");
            return;
        }

        const btn = document.querySelector('.save-btn');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<span class="material-symbols-outlined">hourglass_empty</span> Speichere...';
        btn.disabled = true;

        const inventory = await db.getInventory();
        const existingItem = inventory.find(item => item.name.toLowerCase() === name.toLowerCase());

        let success = false;
        
        // Neues, sicheres Datumsformat für Supabase
        const timestamp = new Date().toISOString();

        if(existingItem) {
            // Addieren
            const updateData = {
                amount: Number(existingItem.amount) + amount,
                price: Number(existingItem.price || 0) + price,
                unit: unit,
                last_updated: timestamp
            };
            success = await db.saveItem(updateData, existingItem.id);
        } else {
            // Neu anlegen
            const insertData = {
                name: name,
                amount: amount,
                unit: unit,
                price: price,
                category: 'Einkauf',
                last_updated: timestamp
            };
            success = await db.saveItem(insertData, null);
        }

        if (success) {
            this.clearInputs();
            // Bestätigungs-Pop-Up für dich
            alert("✅ Erfolgreich im Lager gespeichert!"); 
            
            // Alles sofort aktualisieren
            if(typeof app.loadLager === 'function') app.loadLager();
            if(typeof app.loadDashboard === 'function') app.loadDashboard();
        }

        btn.innerHTML = originalText;
        btn.disabled = false;
    },

    clearInputs: function() {
        document.getElementById('buy-name').value = '';
        document.getElementById('buy-amount').value = '';
        document.getElementById('buy-price').value = '';
        document.getElementById('duplicate-hint').style.display = 'none';
        document.getElementById('buy-name').focus();
    }
};
