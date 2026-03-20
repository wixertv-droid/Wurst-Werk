window.app = {
    inventoryData: [],
    kundenData: [],
    wurstData: [], 

    init: async function() {
        try {
            await this.refreshData();
        } catch (e) {
            console.error("Fehler beim Laden der Basisdaten", e);
        }

        if (document.getElementById('active-processes-list')) {
            try {
                await this.loadActiveProcesses();
                setInterval(() => this.loadActiveProcesses(), 10000); 
            } catch (e) {
                console.error("Fehler bei den Timern", e);
            }
        }
    },

    refreshData: async function() {
        const [inv, kund, wurst] = await Promise.all([
            db.getInventory(),
            db.getCustomers(),
            fetch(`${supabaseUrl}/rest/v1/wurst_bestand?select=*`, { 
                headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } 
            }).then(res => res.ok ? res.json() : [])
        ]);
        
        this.inventoryData = Array.isArray(inv) ? inv : [];
        this.kundenData = Array.isArray(kund) ? kund : [];
        this.wurstData = Array.isArray(wurst) ? wurst : [];
        
        this.render();
    },

    render: function() {
        let ausgaben = 0; 
        let einnahmen = 0; 
        
        let total250 = 0, total400 = 0; 
        let gefuellt250 = 0, gefuellt400 = 0; 
        let kunden250 = 0, kunden400 = 0; 
        
        let fertigeWurstArtikel = 0;

        this.inventoryData.forEach(i => {
            const nameStr = (i.name || '').toLowerCase();
            const catStr = (i.category || '').toLowerCase();

            if (catStr === 'pfandglas' || nameStr.includes('glas') || nameStr.includes('gläser')) {
                if (nameStr.includes('250')) total250 += Number(i.amount) || 0;
                else if (nameStr.includes('400')) total400 += Number(i.amount) || 0;
            } else if (catStr !== 'maschine') { 
                ausgaben += Number(i.price) || 0; 
            }
        });

        this.wurstData.forEach(w => {
            const unit = (w.unit || '').toLowerCase();
            const name = (w.name || '').toLowerCase();
            const amount = Number(w.amount) || 0;
            
            einnahmen += Number(w.revenue) || 0; 

            if (amount > 0) fertigeWurstArtikel += amount;

            if (unit.includes('250') || name.includes('250')) {
                gefuellt250 += amount;
            } else if (unit.includes('400') || name.includes('400')) {
                gefuellt400 += amount;
            } else if (unit.includes('glas') || name.includes('glas')) {
                gefuellt250 += amount; 
            }
        });

        this.kundenData.forEach(k => {
            kunden250 += Number(k.pfand_250) || 0;
            kunden400 += Number(k.pfand_400) || 0;
        });

        const frei250 = total250 - gefuellt250 - kunden250;
        const frei400 = total400 - gefuellt400 - kunden400;
        const gewinn = einnahmen - ausgaben;

        if(document.getElementById('stat-wert')) document.getElementById('stat-wert').innerText = ausgaben.toFixed(2);
        if(document.getElementById('stat-einnahmen')) document.getElementById('stat-einnahmen').innerText = einnahmen.toFixed(2);
        if(document.getElementById('stat-wurst-anzahl')) document.getElementById('stat-wurst-anzahl').innerText = fertigeWurstArtikel;

        if(document.getElementById('stat-gewinn')) {
            const gewinnEl = document.getElementById('stat-gewinn');
            const cardGewinn = document.getElementById('card-gewinn');
            const iconGewinn = document.getElementById('icon-gewinn');
            
            gewinnEl.innerText = gewinn.toFixed(2);
            
            if (gewinn >= 0) {
                gewinnEl.style.color = '#4caf50';
                cardGewinn.style.borderTop = '3px solid #4caf50';
                iconGewinn.style.color = '#4caf50';
                iconGewinn.innerText = 'trending_up'; 
            } else {
                gewinnEl.style.color = '#ff4444';
                cardGewinn.style.borderTop = '3px solid #ff4444';
                iconGewinn.style.color = '#ff4444';
                iconGewinn.innerText = 'trending_down'; 
            }
        }

        if(document.getElementById('stat-g250-total')) {
            document.getElementById('stat-g250-total').innerText = total250;
            document.getElementById('stat-g400-total').innerText = total400;
            
            document.getElementById('stat-g250-gefuellt').innerText = Math.floor(gefuellt250);
            document.getElementById('stat-g400-gefuellt').innerText = Math.floor(gefuellt400);
            
            document.getElementById('stat-g250-kunden').innerText = kunden250;
            document.getElementById('stat-g400-kunden').innerText = kunden400;
            
            const frei250El = document.getElementById('stat-g250-frei');
            frei250El.innerText = Math.floor(frei250);
            frei250El.style.color = frei250 < 0 ? 'var(--accent-danger)' : '#4caf50';

            const frei400El = document.getElementById('stat-g400-frei');
            frei400El.innerText = Math.floor(frei400);
            frei400El.style.color = frei400 < 0 ? 'var(--accent-danger)' : '#4caf50';
        }

        if(document.getElementById('stat-warenwert')) document.getElementById('stat-warenwert').innerText = ausgaben.toFixed(2);
        if(document.getElementById('glass-250-stock')) document.getElementById('glass-250-stock').innerText = Math.floor(frei250);
        if(document.getElementById('glass-400-stock')) document.getElementById('glass-400-stock').innerText = Math.floor(frei400);
        if(document.getElementById('glass-250-kunden')) document.getElementById('glass-250-kunden').innerText = kunden250 + gefuellt250;
        if(document.getElementById('glass-400-kunden')) document.getElementById('glass-400-kunden').innerText = kunden400 + gefuellt400;
    },

    loadActiveProcesses: async function() {
        const container = document.getElementById('active-processes-list');
        if (!container) return; 

        try {
            const res = await fetch(`${supabaseUrl}/rest/v1/production_runs`, {
                headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
            });
            
            if (!res.ok) return;

            const runs = await res.json();
            
            if (!Array.isArray(runs) || runs.length === 0) {
                container.innerHTML = '<p class="text-muted" style="text-align: center;">Aktuell keine Prozesse in Arbeit.</p>';
                return;
            }

            container.innerHTML = '';
            runs.forEach(run => {
                const state = run.state || {};
                const timers = state.timers || {};
                let timerHtml = '';
                
                for (const [stepIdx, endTime] of Object.entries(timers)) {
                    if (new Date(endTime).getTime() > Date.now() || new Date(endTime).getTime() <= Date.now()) {
                        timerHtml += `<div id="dash-timer-${run.id}-${stepIdx}" style="color:var(--accent-amber); font-weight:bold; font-size:1.1rem; margin-top:8px;">Berechne...</div>`;
                        this.startCountdown(`dash-timer-${run.id}-${stepIdx}`, endTime);
                    }
                }

                container.innerHTML += `
                    <div class="prod-card" style="border-left:4px solid #4d4dff; margin-bottom:10px; background:#1a1a1a; padding:15px; border-radius:10px; cursor:pointer;" onclick="window.location.href='produktion.html?id=${run.recipe_id}'">
                        <div style="display:flex; justify-content:space-between; align-items: flex-start;">
                            <div style="flex: 1; padding-right: 10px;">
                                <b style="color:#4d4dff; font-size:0.85rem; text-transform:uppercase;">${run.recipe_name}</b>
                                <p style="margin:5px 0 0 0; font-size:0.95rem; color: #eee; line-height: 1.3;">Produktion läuft (Klicke zum Öffnen)</p>
                                ${timerHtml}
                            </div>
                            <span class="material-symbols-outlined" style="color:var(--accent-danger); cursor:pointer; padding: 5px;" onclick="event.stopPropagation(); window.app.stopProcess('${run.id}')">delete</span>
                        </div>
                    </div>`;
            });
        } catch (e) {
            console.error(e);
        }
    },

    startCountdown: function(elId, endStr) {
        const end = new Date(endStr).getTime();
        
        const update = () => {
            const el = document.getElementById(elId);
            if (!el) return; 
            
            const dist = end - Date.now();
            
            if (dist < 0) { 
                el.innerText = "✅ FERTIG!"; 
                el.style.color = "#4caf50"; 
                return; 
            }
            
            const d = Math.floor(dist / 86400000);
            const h = Math.floor((dist % 86400000) / 3600000);
            const m = Math.floor((dist % 3600000) / 60000);
            const s = Math.floor((dist % 60000) / 1000);
            
            let timeStr = "";
            if (d > 0) timeStr += d + " Tage ";
            timeStr += (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
            el.innerText = "⏳ " + timeStr;
            
            setTimeout(update, 1000);
        };
        update();
    },

    stopProcess: async function(id) {
        if(!confirm("Diesen Prozess wirklich abbrechen und vom Dashboard löschen?")) return;
        try {
            await fetch(`${supabaseUrl}/rest/v1/production_runs?id=eq.${id}`, {
                method: 'DELETE',
                headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
            });
            await this.loadActiveProcesses();
        } catch (e) {
            alert("Fehler beim Löschen!");
        }
    },

    // NEU: Setzt alle Finanzen auf 0 zurück (Ausgaben & Einnahmen)
    resetFinances: async function() {
        if (!confirm("⚠️ ACHTUNG: Möchtest du die Gewinn/Verlust-Rechnung wirklich zurücksetzen?\n\nDadurch werden alle bisherigen Umsätze am Wurststand UND alle hinterlegten Einkaufspreise im Lager auf 0,00 € gesetzt. Deine tatsächlichen Wurst- und Lagerbestände (Mengen) bleiben komplett erhalten!")) return;

        try {
            // Alle Preise im Lager nullen
            const invUpdates = this.inventoryData.map(item => 
                fetch(`${supabaseUrl}/rest/v1/inventory?id=eq.${item.id}`, {
                    method: 'PATCH',
                    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ price: 0 })
                })
            );

            // Alle Umsätze im Wurststand nullen
            const wurstUpdates = this.wurstData.map(wurst => 
                fetch(`${supabaseUrl}/rest/v1/wurst_bestand?id=eq.${wurst.id}`, {
                    method: 'PATCH',
                    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ revenue: 0 })
                })
            );

            // Ausführen
            await Promise.all([...invUpdates, ...wurstUpdates]);

            alert("✅ Finanzen wurden erfolgreich auf 0,00 € zurückgesetzt! Du bist bereit für den echten Modus.");
            await this.refreshData(); // Lädt das Dashboard sofort neu

        } catch (e) {
            alert("Fehler beim Zurücksetzen der Finanzen.");
            console.error(e);
        }
    }
};

document.addEventListener('DOMContentLoaded', () => window.app.init());
