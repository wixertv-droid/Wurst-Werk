const supabaseUrl = 'https://lphunsmxoruyovvhjrxy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwaHVuc214b3J1eW92dmhqcnh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3NDYxNDAsImV4cCI6MjA4OTMyMjE0MH0.LhW4nqr98xAU-0eun-qTByJBxBjRk767CTzVCtB0eEI';

const db = {
    // Lesen
    getInventory: async function() {
        try {
            const response = await fetch(`${supabaseUrl}/rest/v1/inventory?select=*`, {
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`
                }
            });
            if (!response.ok) throw new Error('Fehler beim Laden');
            return await response.json();
        } catch (error) {
            console.error(error);
            return [];
        }
    },

    // NEU: Schreiben & Updaten (Direkt hier, wo die Keys liegen)
    saveItem: async function(itemData, existingId = null) {
        try {
            let response;
            if (existingId) {
                // UPDATE (Aufaddieren)
                response = await fetch(`${supabaseUrl}/rest/v1/inventory?id=eq.${existingId}`, {
                    method: 'PATCH',
                    headers: {
                        'apikey': supabaseKey,
                        'Authorization': `Bearer ${supabaseKey}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=minimal'
                    },
                    body: JSON.stringify(itemData)
                });
            } else {
                // NEU ANLEGEN
                response = await fetch(`${supabaseUrl}/rest/v1/inventory`, {
                    method: 'POST',
                    headers: {
                        'apikey': supabaseKey,
                        'Authorization': `Bearer ${supabaseKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(itemData)
                });
            }

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText);
            }
            return true;
        } catch (error) {
            alert("Fehler beim Speichern in der Datenbank:\n" + error.message);
            return false;
        }
    }
};
