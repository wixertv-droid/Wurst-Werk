const supabaseUrl = 'https://lphunsmxoruyovvhjrxy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwaHVuc214b3J1eW92dmhqcnh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3NDYxNDAsImV4cCI6MjA4OTMyMjE0MH0.LhW4nqr98xAU-0eun-qTByJBxBjRk767CTzVCtB0eEI';

const db = {
    // Daten aus dem Lager holen
    getInventory: async function() {
        try {
            const response = await fetch(`${supabaseUrl}/rest/v1/inventory?select=*&order=name.asc`, {
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`
                }
            });
            return await response.json();
        } catch (e) {
            console.error("Fehler beim Abrufen des Lagers:", e);
            return [];
        }
    },

    // Neuen Einkauf speichern
    insertInventory: async function(itemData) {
        try {
            const response = await fetch(`${supabaseUrl}/rest/v1/inventory`, {
                method: 'POST',
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify(itemData)
            });
            return response;
        } catch (e) {
            console.error("Netzwerkfehler beim Speichern:", e);
            return { ok: false };
        }
    }
};
