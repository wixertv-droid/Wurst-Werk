window.produktionManager = {
    recipe: null,
    inventory: [],
    mappedIngredients: [], 

    init: async function() {
        const params = new URLSearchParams(window.location.search);
        const id = params.get('id');
        
        if (!id) {
            alert("Kein Rezept ausgewählt!");
            window.location.href = 'rezepte.html';
            return;
        }

        try {
            const [recipeRes, invData] = await Promise.all([
                fetch(`${supabaseUrl}/rest/v1/recipes?id=eq.${id}&select=*`, { 
                    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } 
                }),
                db.getInventory()
            ]);

            const recipes = await recipeRes.json();
            if (recipes.length === 0) throw new Error("Rezept nicht gefunden");
            
            this.recipe = recipes[0];
            this.inventory = invData;

            document.getElementById('prod-title').innerText = `Produktion: ${this.recipe.name}`;
            this.buildMatchingUI();

        } catch (e) {
            alert("Fehler beim Laden der Produktionsdaten!");
            window.location.href = 'rezepte.html';
        }
    },

    buildMatchingUI: function() {
        const container = document.getElementById('matching-container');
        const details = this.recipe.details || {};
        const ingredients = details.ingredients || [];

        if (ingredients.length === 0) {
            container.innerHTML = '<p class="text-muted">Dieses Rezept hat keine Zutaten.</p>';
            return;
        }

        container.innerHTML = '';
        this.mappedIngredients = [];

        ingredients.forEach((ing, index) => {
            let bestMatch = this.inventory.find(item => 
                item.name.toLowerCase().includes(ing.name.toLowerCase()) || 
                ing.name.toLowerCase().includes(item.name.toLowerCase())
            );

            let optionsHtml = `<option value="">-- Bitte Lager-Artikel zuordnen --</option>`;
            const sortedInv = [...this.inventory].sort((a,b) => a.category.localeCompare(b.category));
            
            sortedInv.forEach(item => {
                if(item.category === 'Pfandglas' || item.category === 'Maschine') return; 
                const isSelected = bestMatch && bestMatch.id === item.id ? 'selected' : '';
                optionsHtml += `<option value="${item.id}" ${isSelected}>[${item.category}] ${item.name} (${item.amount} ${item.unit})</option>`;
            });

            container.innerHTML += `
                <div class="match-row">
                    <div class="match-header">
                        <span style="font-weight: bold; color: var(--accent-amber);">${ing.name}</span>
                        <span style="font-size: 1.2rem; font-weight: bold;" id="calc-val-${index}">${ing.amount} ${ing.unit}</span>
                    </div>
                    <select class="match-select ${bestMatch ? 'matched' : 'unmatched'}" id="match-select-${index}" onchange="window.produktionManager.updateSelectColor(this)">
                        ${optionsHtml}
                        <option value="skip">❌ Nicht abbuchen (Ignorieren)</option>
                    </select>
                </div>
            `;

            this.mappedIngredients.push({ originalName: ing.name, baseAmount: ing.amount, unit: ing.unit, index: index });
        });
    },

    updateSelectColor: function(selectEl) {
        if(selectEl.value && selectEl.value !== "") {
            selectEl.classList.replace('unmatched', 'matched');
        } else {
            selectEl.classList.replace('matched', 'unmatched');
        }
    },

    recalculate: function() {
        const multiplier = parseFloat(document.getElementById('multiplier-input').value) || 0; 
        this.mappedIngredients.forEach(ing => {
            const calc = (ing.baseAmount * multiplier);
            document.getElementById(`calc-val-${ing.index}`).innerText = `${calc % 1 === 0 ? calc : calc.toFixed(1)} ${ing.unit}`;
        });
    },

    goBackToSetup: function() {
        document.getElementById('step-2-checklist').style.display = 'none';
        document.getElementById('step-1-setup').style.display = 'block';
    },

    deductAndStart: async function() {
        const multiplier = parseFloat(document.getElementById('multiplier-input').value) || 0;
        if (multiplier <= 0) return alert("Bitte kg eingeben!");

        let updates = [];
        this.mappedIngredients.forEach(ing => {
            const invId = document.getElementById(`match-select-${ing.index}`).value;
            if (invId !== "" && invId !== "skip") {
                const invItem = this.inventory.find(i => i.id == invId);
                if(invItem) updates.push({ id: invItem.id, amount: Number(invItem.amount) - (ing.baseAmount * multiplier) });
            }
        });

        if (updates.length > 0 && confirm(`Mengen jetzt vom Lager abbuchen?`)) {
            for (let u of updates) {
                await fetch(`${supabaseUrl}/rest/v1/inventory?id=eq.${u.id}`, {
                    method: 'PATCH',
                    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ amount: u.amount })
                });
            }
        }

        document.getElementById('step-1-setup').style.display = 'none';
        document.getElementById('step-2-checklist').style.display = 'block';
        this.buildChecklist();
    },

    buildChecklist: function() {
        const container = document.getElementById('checklist-container');
        const steps = this.recipe.details.steps || [];
        container.innerHTML = '';
        
        steps.forEach((step, i) => {
            let timerBtn = '';
            let extra = '';

            if (step.type === 'timer' || step.type === 'interval') {
                if (step.type === 'timer') extra = `<br><b style="color:#4d4dff;">⏳ ${step.duration} ${step.unit}</b>`;
                if (step.type === 'interval') extra = `<br><b style="color:var(--accent-amber);">🔁 ${step.cycles}x ${step.duration} ${step.unit} (Pause: ${step.pauses}h)</b>`;
                
                timerBtn = `
                    <div class="timer-controls" id="timer-ctrl-${i}" style="display: flex; gap: 10px; margin-top: 15px; padding-left: 50px;">
                        <button style="background: #4d4dff; color: white; border: none; padding: 10px; border-radius: 8px; flex: 1; font-weight: bold; cursor: pointer;" onclick="window.produktionManager.startTimer(${i})">▶️ Starten</button>
                        <button style="background: #333; color: white; border: 1px solid #555; padding: 10px; border-radius: 8px; flex: 1; cursor: pointer;" onclick="window.produktionManager.skipStep(${i})">⏭️ Überspringen</button>
                    </div>
                    <div id="timer-status-${i}" style="display:none; padding-left:50px; margin-top: 10px; color:#4caf50; font-weight: bold;"></div>
                `;
            }

            container.innerHTML += `
                <div class="check-step" id="step-row-${i}" style="padding: 15px; background: #111; border-radius: 8px; margin-bottom: 12px; border-left: 4px solid #444;">
                    <div class="step-header" style="display: flex; gap: 15px; align-items: center; cursor: pointer;" onclick="window.produktionManager.toggleStep(${i})">
                        <div class="check-btn" style="background: #222; border: 2px solid #444; border-radius: 50%; min-width: 35px; height: 35px; display: flex; align-items: center; justify-content: center; color: transparent;"><span class="material-symbols-outlined">check</span></div>
                        <div style="flex:1;"><b style="font-size:0.8rem; color:#888;">SCHRITT ${i+1}</b><p style="margin: 3px 0 0 0; line-height: 1.4;">${step.text} ${extra}</p></div>
                    </div>
                    ${timerBtn}
                </div>`;
        });
    },

    toggleStep: function(i) { 
        document.getElementById(`step-row-${i}`).classList.toggle('done'); 
    },

    startTimer: async function(index) {
        const step = this.recipe.details.steps[index];
        const statusEl = document.getElementById(`timer-status-${index}`);
        
        let ms = 0;
        const d = Number(step.duration) || 0;
        const unit = (step.unit || '').toLowerCase();
        
        if (unit.includes('min')) ms = d * 60000;
        else if (unit.includes('std') || unit.includes('hou')) ms = d * 3600000;
        else if (unit.includes('tag') || unit.includes('day')) ms = d * 86400000;

        const end = new Date(Date.now() + ms).toISOString();
        const payload = { 
            recipe_name: this.recipe.name, 
            step_text: step.text, 
            end_time: end, 
            status: 'running' 
        };

        try {
            const res = await fetch(`${supabaseUrl}/rest/v1/active_processes`, {
                method: 'POST',
                headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                document.getElementById(`step-row-${index}`).style.borderLeftColor = '#4d4dff';
                document.getElementById(`timer-ctrl-${index}`).style.display = 'none';
                statusEl.style.display = 'block';
                statusEl.innerText = "✅ Timer läuft! (Wechsle aufs Dashboard)";
            } else {
                const err = await res.text();
                alert("Datenbank-Fehler (Tabelle active_processes fehlt?): " + err);
            }
        } catch (e) {
            alert("Netzwerkfehler: " + e.message);
        }
    },

    skipStep: function(i) {
        document.getElementById(`step-row-${i}`).style.borderLeftColor = '#4caf50';
        document.getElementById(`step-row-${i}`).style.opacity = '0.6';
        if(document.getElementById(`timer-ctrl-${i}`)) document.getElementById(`timer-ctrl-${i}`).style.display = 'none';
    },

    finishProduction: function() {
        alert("Produktion beendet!");
        window.location.href = 'index.html';
    }
};

document.addEventListener('DOMContentLoaded', () => window.produktionManager.init());
