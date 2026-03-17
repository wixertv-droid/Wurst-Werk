const supabaseUrl = 'https://lphunsmxoruyovvhjrxy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwaHVuc214b3J1eW92dmhqcnh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3NDYxNDAsImV4cCI6MjA4OTMyMjE0MH0.LhW4nqr98xAU-0eun-qTByJBxBjRk767CTzVCtB0eEI';

const db = {
    // Holt alle Lagerartikel
    getInventory: async function() {
        try {
            const response = await fetch(`${supabaseUrl}/rest/v1/inventory?select=*&order=name.asc`, {
                headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
            });
            return await response.json();
        } catch (e) { return []; }
    },

    // Holt alle Kunden (für Pfand-Berechnung)
    getCustomers: async function() {
        try {
            const response = await fetch(`${supabaseUrl}/rest/v1/customers?select=*`, {
                headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
            });
            return await response.json();
        } catch (e) { return []; }
    },

    // Neuen Einkauf speichern
    insertInventory: async function(itemData) {
        try {
            return await fetch(`${supabaseUrl}/rest/v1/inventory`, {
                method: 'POST',
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify(itemData)
            });
        } catch (e) { return { ok: false }; }
    }
};
