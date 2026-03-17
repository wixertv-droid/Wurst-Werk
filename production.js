const production = {
    startRun: async function(recipeName, days) {
        const ende = new Date();
        ende.setDate(ende.getDate() + days);

        await fetch(`${supabaseUrl}/rest/v1/active_productions`, {
            method: 'POST',
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                recipe_name: recipeName,
                current_phase: 'Pökeln',
                phase_end_at: ende.toISOString()
            })
        });

        alert("Produktion gestartet!");
        app.refreshData(); // Das lädt jetzt auch loadActiveProcesses() mit
    },

    loadActiveProcesses: async function() {
        const list = document.getElementById('active-processes-list');
        if(!list) return;

        try {
            const response = await fetch(`${supabaseUrl}/rest/v1/active_productions?select=*`, {
                headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
            });
            const processes = await response.json();
            
            list.innerHTML = '';
            if(processes.length === 0) {
                list.innerHTML = '<p class="text-muted">Keine aktiven Reifeprozesse.</p>';
                return;
            }

            processes.forEach(p => {
                const end = new Date(p.phase_end_at);
                const tage = Math.ceil((end - new Date()) / (1000*60*60*24));
                list.innerHTML += `
                    <div class="list-card" style="border-left: 4px solid var(--accent-amber)">
                        <div class="info">
                            <h3>${p.recipe_name}</h3>
                            <p>Phase: ${p.current_phase} | <b>Noch ${tage} Tage</b></p>
                        </div>
                    </div>
                `;
            });
        } catch (e) { console.log("Keine Produktionen geladen"); }
    }
};
