const app = {
    inventoryData: [],
    kundenData: [],

    init: async function() {
        await this.refreshData();
        // Timer alle 10 Sekunden prüfen, falls einer abläuft
        this.loadActiveProcesses();
        setInterval(() => this.loadActiveProcesses(), 60000); 
    },

    refreshData: async function() {
        try {
            [this.inventoryData, this.kundenData] = await Promise.all([
                db.getInventory(),
                db.getCustomers()
            ]);
            this.render();
        } catch (e) { console.error("Sync-Fehler:", e); }
    },

    render: function() {
        let wert = 0, g250 = 0, g400 = 0, u250 = 0, u400 = 0;

        this.inventoryData.forEach(i => {
            if (i.category === 'Pfandglas') {
                if (i.name.includes('250')) g250 += Number(i.amount);
                else if (i.name.includes('400')) g400 += Number(i.amount);
            } else if (i.category !== 'Maschine') { wert += Number(i.price); }
        });

        this.kundenData.forEach(k => {
            u250 += Number(k.pfand_250) || 0;
            u400 += Number(k.pfand_400) || 0;
        });

        if(document.getElementById('stat-wert')) document.getElementById('stat-wert').innerText = wert.toFixed(2);
        if(document.getElementById('stat-glaeser-250')) document.getElementById('stat-glaeser-250').innerText = g250 - u250;
        if(document.getElementById('stat-glaeser-400')) document.getElementById('stat-glaeser-400').innerText = g400 - u400;
        
        // Lager-Seite Stats
        if(document.getElementById('stat-warenwert')) document.getElementById('stat-warenwert').innerText = wert.toFixed(2);
        if(document.getElementById('glass-250-available')) document.getElementById('glass-250-available').innerText = g250 - u250;
        if(document.getElementById('glass-400-available')) document.getElementById('glass-400-available').innerText = g400 - u400;
    },

    loadActiveProcesses: async function() {
        const container = document.getElementById('active-processes-list');
        if (!container) return;

        const res = await fetch(`${supabaseUrl}/rest/v1/active_processes?status=eq.running&order=end_time.asc`, {
            headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
        });
        const processes = await res.json();
        container.innerHTML = processes.length ? '' : '<p class="text-muted">Keine aktiven Prozesse.</p>';

        processes.forEach(p => {
            container.innerHTML += `
                <div class="prod-card" style="border-left:4px solid #4d4dff; margin-bottom:10px; background:#1a1a1a; padding:15px; border-radius:10px;">
                    <div style="display:flex; justify-content:space-between;">
                        <div><b style="color:#4d4dff; font-size:0.75rem; text-transform:uppercase;">${p.recipe_name}</b><p style="margin:5px 0; font-size:0.9rem;">${p.step_text}</p></div>
                        <span class="material-symbols-outlined" style="color:var(--accent-danger); cursor:pointer;" onclick="app.stopProcess('${p.id}')">delete</span>
                    </div>
                    <div id="timer-${p.id}" style="color:var(--accent-amber); font-weight:bold; font-size:1.1rem; margin-top:5px;">Lade...</div>
                </div>`;
            this.startCountdown(p.id, p.end_time);
        });
    },

    startCountdown: function(id, endStr) {
        const el = document.getElementById(`timer-${id}`);
        const end = new Date(endStr).getTime();
        const update = () => {
            const dist = end - Date.now();
            if (dist < 0) { el.innerText = "FERTIG!"; el.style.color = "#4caf50"; return; }
            const d = Math.floor(dist / 86400000);
            const h = Math.floor((dist % 86400000) / 3600000);
            const m = Math.floor((dist % 3600000) / 60000);
            const s = Math.floor((dist % 60000) / 1000);
            if (el) { 
                el.innerText = (d > 0 ? d + "T " : "") + (h<10?"0":"")+h+":"+(m<10?"0":"")+m+":"+(s<10?"0":"")+s;
                setTimeout(update, 1000);
            }
        };
        update();
    },

    stopProcess: async function(id) {
        if(!confirm("Prozess entfernen?")) return;
        await fetch(`${supabaseUrl}/rest/v1/active_processes?id=eq.${id}`, {
            method: 'DELETE',
            headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
        });
        this.loadActiveProcesses();
    }
};
document.addEventListener('DOMContentLoaded', () => app.init());
