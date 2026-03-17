const production = {
    // Startet eine Produktion mit Phasen-Logik
    startRun: async function(recipeName, totalDays) {
        // Beispiel-Phase: Pökeln (7 Tage)
        const poekelEnde = new Date();
        poekelEnde.setDate(poekelEnde.getDate() + 7); 

        const { data, error } = await fetch(`${supabaseUrl}/rest/v1/active_productions`, {
            method: 'POST',
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify({
                recipe_name: recipeName,
                current_phase: 'Pökeln',
                phase_end_at: poekelEnde.toISOString()
            })
        });

        alert(`Produktion für ${recipeName} gestartet. Pökelphase bis ${poekelEnde.toLocaleDateString()}`);
        app.switchView('home', document.querySelector('.nav-item'));
        this.loadActiveProcesses();
    },

    loadActiveProcesses: async function() {
        const response = await fetch(`${supabaseUrl}/rest/v1/active_productions?select=*`, {
            headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
        });
        const processes = await response.json();
        const list = document.getElementById('active-processes-list');
        list.innerHTML = '';

        processes.forEach(p => {
            const end = new Date(p.phase_end_at);
            const diff = end - new Date();
            const tageRest = Math.ceil(diff / (1000 * 60 * 60 * 24));

            list.innerHTML += `
                <div class="list-card" style="border-left: 4px solid var(--accent-amber)">
                    <div class="info">
                        <h3>${p.recipe_name}</h3>
                        <p>Phase: <b>${p.current_phase}</b></p>
                        <p style="color: var(--accent-amber)">Noch ${tageRest} Tage verbleibend</p>
                    </div>
                </div>
            `;
        });
    }
};
