const supabaseUrl = 'https://lphunsmxoruyovvhjrxy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwaHVuc214b3J1eW92dmhqcnh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3NDYxNDAsImV4cCI6MjA4OTMyMjE0MH0.LhW4nqr98xAU-0eun-qTByJBxBjRk767CTzVCtB0eEI';

const db = {
    getInventory: async function() {
        const response = await fetch(`${supabaseUrl}/rest/v1/inventory?select=*&order=name.asc`, {
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`
            }
        });
        return await response.json();
    },

    updateStock: async function(id, newAmount) {
        await fetch(`${supabaseUrl}/rest/v1/inventory?id=eq.${id}`, {
            method: 'PATCH',
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ amount: newAmount })
        });
    }
};
