const assistant = {
    processPurchase: async function() {
        const name = document.getElementById('buy-name').value;
        const category = document.getElementById('buy-category').value;
        const amount = Number(document.getElementById('buy-amount').value);
        const price = Number(document.getElementById('buy-price').value);

        if(!name || !amount || !price) {
            alert("Bitte Name, Menge und Preis angeben!");
            return;
        }

        const inventory = await db.getInventory();
        const existingItem = inventory.find(i => i.name.toLowerCase() === name.toLowerCase());

        if(existingItem) {
            const newTotal = Number(existingItem.amount) + amount;
            const newPrice = Number(existingItem.price || 0) + price;
            
            await fetch(`${supabaseUrl}/rest/v1/inventory?id=eq.${existingItem.id}`, {
                method: 'PATCH',
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ amount: newTotal, price: newPrice })
            });
        } else {
            await fetch(`${supabaseUrl}/rest/v1/inventory`, {
                method: 'POST',
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: name,
                    category: category,
                    amount: amount,
                    price: price,
                    unit: category === 'Fleisch' ? 'g' : (category === 'Material' ? 'Stk/m' : 'g')
                })
            });
        }

        alert(`Einkauf gespeichert: ${amount}g/Stk ${name} für ${price.toFixed(2)}€`);
        
        document.getElementById('buy-name').value = '';
        document.getElementById('buy-amount').value = '';
        document.getElementById('buy-price').value = '';

        await app.refreshData();
    }
};
