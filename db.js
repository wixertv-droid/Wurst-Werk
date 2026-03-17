const supabaseUrl = 'https://lphunsmxoruyovvhjrxy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwaHVuc214b3J1eW92dmhqcnh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3NDYxNDAsImV4cCI6MjA4OTMyMjE0MH0.LhW4nqr98xAU-0eun-qTByJBxBjRk767CTzVCtB0eEI';

const db = {
    // Holt den gesamten Lagerbestand
    getInventory: async function() {
        try {
            const response = await fetch(`${supabaseUrl}/rest/v1/inventory?select=*`, {
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Netzwerk-Fehler beim Laden der Datenbank');
            }
            
            return await response.json();
        } catch (error) {
            console.error("Datenbank-Fehler (getInventory):", error);
            const statusEl = document.getElementById('db-status');
            if(statusEl) statusEl.innerText = "Offline / Fehler";
            return []; 
        }
    }
};
