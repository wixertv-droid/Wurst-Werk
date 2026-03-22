window.produktionManager = {
    recipe: null,
    inventory: [],
    mappedIngredients: [], 
    totalCosts: 0, 
    currentRun: null, 

    init: async function() {
        const params = new URLSearchParams(window.location.search);
        const id = params.get('id');

        setInterval(() => this.tickTimers(), 1000);

        if (!id) {
            window.location.href = 'rezepte.html';
            return;
        }

        try {
            const [recipeRes, invData, runRes] = await Promise.all([
                fetch(`${supabaseUrl}/rest/v1/recipes?id=eq.${id}&select=*`, { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }),
                db.getInventory(),
                fetch(`${supabaseUrl}/rest/v1/production_runs?recipe_id=eq.${id}`, { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } })
            ]);

            const recipes = await recipeRes.json();
            if (recipes.length === 0) throw new Error("Rezept nicht gefunden");
            
            this.recipe = recipes[0];
            this.inventory = Array.isArray(invData) ? invData : [];
            const activeRuns = runRes.ok ? await runRes.json() : [];

            document.getElementById('prod-title').innerText = `Produktion: ${this.recipe.name}`;

            if (activeRuns.length > 0) {
                this.currentRun = activeRuns[0];
                if (!this.currentRun.state) this.currentRun.state = { checked: [], timers: {}, costs: 0 };
                
                document.getElementById('step-1-setup').style.display = 'none';
                document.getElementById('step-2-checklist').style.display = 'block';
                
                if (document.getElementById('prod-costs')) {
                    document.getElementById('prod-costs').innerText = Number(this.currentRun.state.costs || 0).toFixed(2);
                }

                this.buildChecklist();
                this.checkFinishCondition(); 
            } else {
                document.getElementById('step-1-setup').style.display = 'block';
                document.getElementById('step-2-checklist').style.display = 'none';
                this.buildMatchingUI();
            }

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

        const availableInv = this.inventory.filter(item => item.category !== 'Pfandglas' && item.category !== 'Maschine');
        const cleanString = (str) => (str || '').replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"").trim().toLowerCase();

        ingredients.forEach((ing, index) => {
            const searchStr = cleanString(ing.name);
            
            const getScore = (itemName) => {
                const nameL = cleanString(itemName);
                if (nameL === searchStr) return 100; 
                if (nameL.includes(searchStr) || searchStr.includes(nameL)) return 50; 
                return 0;
            };

            const sortedInv = [...availableInv].sort((a, b) => {
                const scoreA = getScore(a.name);
                const scoreB = getScore(b.name);
                if (scoreA !== scoreB) return scoreB - scoreA; 
                return (a.category || '').localeCompare(b.category || '');
            });

            let bestMatch = sortedInv.length > 0 && getScore(sortedInv[0].name) > 0 ? sortedInv[0] : null;
            let optionsHtml = `<option value="">-- Bitte Lager-Artikel zuordnen --</option>`;
            
            sortedInv.forEach(item => {
                const isSelected = bestMatch && bestMatch.id === item.id ? 'selected' : '';
                const itemPrice = Number(item.price) || 0;
                optionsHtml += `<option value="${item.id}" ${isSelected}>[${item.category}] ${item.name} (${item.amount} ${item.unit}) - ${itemPrice.toFixed(2)}€</option>`;
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
        if(selectEl.value && selectEl.value !== "") selectEl.classList.replace('unmatched', 'matched');
        else selectEl.classList.replace('matched', 'unmatched');
    },

    recalculate: function() {
        const multiplier = parseFloat(document.getElementById('multiplier-input').value) || 0; 
        this.mappedIngredients.forEach(ing => {
            let calc = (ing.baseAmount * multiplier);
            calc = Math.round(calc * 100) / 100;
            document.getElementById(`calc-val-${ing.index}`).innerText = `${calc} ${ing.unit}`;
        });
    },

    deductAndStart: async function() {
        const multiplier = parseFloat(document.getElementById('multiplier-input').value) || 0;
        if (multiplier <= 0) return alert("Bitte kg eingeben!");

        let updates = [];
        this.totalCosts = 0; 

        this.mappedIngredients.forEach(ing => {
            const invId = document.getElementById(`match-select-${ing.index}`).value;
            if (invId !== "" && invId !== "skip") {
                const invItem = this.inventory.find(i => i.id == invId);
                if(invItem) {
                    let neededAmount = ing.baseAmount * multiplier;
                    let deductAmount = neededAmount;
                    
                    const recipeUnit = (ing.unit || '').trim().toLowerCase();
                    const invUnit = (invItem.unit || '').trim().toLowerCase();
                    
                    if (recipeUnit === 'g' && invUnit === 'kg') deductAmount = neededAmount / 1000;
                    else if (recipeUnit === 'kg' && invUnit === 'g') deductAmount = neededAmount * 1000;
                    else if (recipeUnit === 'ml' && (invUnit === 'l' || invUnit === 'liter')) deductAmount = neededAmount / 1000;
                    else if ((recipeUnit === 'l' || recipeUnit === 'liter') && invUnit === 'ml') deductAmount = neededAmount * 1000;
                    
                    const currentInvAmount = Number(invItem.amount) || 0;
                    const currentInvPrice = Number(invItem.price) || 0;
                    
                    if (currentInvAmount > 0 && deductAmount > 0) {
                        let proportion = deductAmount / currentInvAmount;
                        if (proportion > 1) proportion = 1; 
                        
                        const costForThisItem = currentInvPrice * proportion;
                        this.totalCosts += costForThisItem;
                        
                        let newPrice = currentInvPrice - costForThisItem;
                        if (newPrice < 0) newPrice = 0;
                        
                        let newAmount = currentInvAmount - deductAmount;
                        if (newAmount < 0) newAmount = 0;
                        newAmount = Math.round(newAmount * 1000) / 1000;
                        
                        updates.push({ id: invItem.id, amount: newAmount, price: newPrice });
                    }
                }
            }
        });

        if (updates.length > 0 && confirm(`Mengen jetzt vom Lager abbuchen?\n(Materialkosten dieser Charge ca. ${this.totalCosts.toFixed(2)} €)`)) {
            for (let u of updates) {
                await fetch(`${supabaseUrl}/rest/v1/inventory?id=eq.${u.id}`, {
                    method: 'PATCH',
                    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ amount: u.amount, price: u.price })
                });
            }
        }

        if (document.getElementById('prod-costs')) {
            document.getElementById('prod-costs').innerText = this.totalCosts.toFixed(2);
        }

        this.currentRun = {
            id: crypto.randomUUID(),
            recipe_id: this.recipe.id,
            recipe_name: this.recipe.name,
            state: { checked: [], timers: {}, costs: this.totalCosts }
        };

        await fetch(`${supabaseUrl}/rest/v1/production_runs`, {
            method: 'POST',
            headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(this.currentRun)
        });

        document.getElementById('step-1-setup').style.display = 'none';
        document.getElementById('step-2-checklist').style.display = 'block';
        this.buildChecklist();
        this.checkFinishCondition();
    },

    syncState: async function() {
        if (!this.currentRun) return;
        try {
            await fetch(`${supabaseUrl}/rest/v1/production_runs?id=eq.${this.currentRun.id}`, {
                method: 'PATCH',
                headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
                body: JSON.stringify({ state: this.currentRun.state })
            });
        } catch(e) {
            console.error("Fehler beim Speichern des Hakens:", e);
        }
    },

    buildChecklist: function() {
        const container = document.getElementById('checklist-container');
        const steps = this.recipe.details.steps || [];
        const state = this.currentRun.state || { checked: [], timers: {} };
        
        container.innerHTML = '';
        
        steps.forEach((step, i) => {
            let timerBtn = '';
            let extra = '';
            const isChecked = state.checked.some(val => Number(val) === Number(i));
            const activeTimerEnd = state.timers[i]; 

            if (step.type === 'timer' || step.type === 'interval') {
                if (step.type === 'timer') extra = `<br><b style="color:#4d4dff;">⏳ ${step.duration} ${step.unit}</b>`;
                if (step.type === 'interval') extra = `<br><b style="color:var(--accent-amber);">🔁 ${step.cycles}x ${step.duration} ${step.unit} (Pause: ${step.pauses}h)</b>`;
                
                if (activeTimerEnd) {
                    timerBtn = `
                        <div style="padding-left:50px; margin-top: 10px; color:#4caf50; font-weight: bold;">
                            <span class="material-symbols-outlined" style="vertical-align: middle;">hourglass_bottom</span> Läuft: 
                            <span class="live-timer" data-endtime="${activeTimerEnd}" style="color:var(--accent-amber); font-size:1.2rem; margin-left: 5px;">Berechne...</span>
                        </div>
                    `;
                } else if (!isChecked) {
                    timerBtn = `
                        <div class="timer-controls" id="timer-ctrl-${i}" style="display: flex; gap: 10px; margin-top: 15px; padding-left: 50px;">
                            <button class="btn-start" onclick="event.stopPropagation(); window.produktionManager.startTimer(${i})">▶️ Starten</button>
                        </div>
                    `;
                }
            }

            container.innerHTML += `
                <div class="check-step ${isChecked ? 'done' : ''} ${activeTimerEnd && !isChecked ? 'running' : ''}" id="step-row-${i}">
                    <div class="step-header" onclick="window.produktionManager.toggleStep(${i})">
                        <div class="check-btn"><span class="material-symbols-outlined">check</span></div>
                        <div style="flex:1;">
                            <b style="font-size:0.8rem; color:#888;">SCHRITT ${i+1}</b>
                            <p class="step-desc" style="margin: 3px 0 0 0; line-height: 1.4;">${step.text} ${extra}</p>
                        </div>
                    </div>
                    <div class="step-body">
                        ${timerBtn}
                    </div>
                </div>`;
        });
    },

    toggleStep: async function(i) { 
        let checked = this.currentRun.state.checked || [];
        const isCurrentlyDone = checked.includes(Number(i));

        if (!isCurrentlyDone) {
            checked.push(Number(i));
        } else {
            checked = checked.filter(val => Number(val) !== Number(i));
        }
        
        this.currentRun.state.checked = checked;
        
        this.buildChecklist();
        await this.syncState(); 
        this.checkFinishCondition(); 
    },

    checkFinishCondition: function() {
        const steps = this.recipe.details.steps || [];
        if (steps.length === 0) return;

        const lastIndex = steps.length - 1;
        const checked = this.currentRun.state.checked || [];
        const btnFinish = document.getElementById('btn-finish-prod');
        
        if (checked.includes(lastIndex)) {
            btnFinish.style.display = 'flex';
        } else {
            btnFinish.style.display = 'none';
        }
    },

    startTimer: async function(index) {
        const step = this.recipe.details.steps[index];
        let ms = 0;
        const d = Number(step.duration) || 0;
        const unit = (step.unit || '').toLowerCase();
        
        if (unit.includes('min')) ms = d * 60000;
        else if (unit.includes('std') || unit.includes('hou')) ms = d * 3600000;
        else if (unit.includes('tag') || unit.includes('day')) ms = d * 86400000;

        const end = new Date(Date.now() + ms).toISOString();
        
        if (!this.currentRun.state.timers) this.currentRun.state.timers = {};
        this.currentRun.state.timers[index] = end;

        await this.syncState();
        this.buildChecklist(); 
    },

    tickTimers: function() {
        const timerElements = document.querySelectorAll('.live-timer');
        
        timerElements.forEach(el => {
            const endStr = el.getAttribute('data-endtime');
            if (!endStr) return;
            
            const end = new Date(endStr).getTime();
            const dist = end - Date.now();
            
            if (dist < 0) { 
                el.innerText = "✅ FERTIG!"; 
                el.style.color = "#4caf50"; 
            } else {
                const d = Math.floor(dist / 86400000);
                const h = Math.floor((dist % 86400000) / 3600000);
                const m = Math.floor((dist % 3600000) / 60000);
                const s = Math.floor((dist % 60000) / 1000);
                
                let timeStr = "";
                if (d > 0) timeStr += d + " T ";
                timeStr += (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
                el.innerText = timeStr;
            }
        });
    },

    // Hier ist der 100% kugelsichere Block
    showFinalStep: function() {
        document.getElementById('step-2-checklist').style.display = 'none';
        document.getElementById('step-3-finish').style.display = 'block';
        
        const titleEl = document.getElementById('finish-title');
        if (titleEl && this.recipe && this.recipe.name) {
            titleEl.innerHTML = `<span style="color: var(--accent-amber); font-size: 1.4rem;">${this.recipe.name}</span><br><span style="font-size: 1.1rem; color: #fff;">erfolgreich produziert!</span>`;
        }
    },

    saveToWurststand: async function() {
        const finalAmount = Number(document.getElementById('final-amount').value);
        const finalUnit = document.getElementById('final-unit').value;

        if (!finalAmount || finalAmount <= 0) {
            alert("Bitte gib eine gültige Menge ein!");
            return;
        }

        try {
            const checkRes = await fetch(`${supabaseUrl}/rest/v1/wurst_bestand?name=eq.${encodeURIComponent(this.recipe.name)}&unit=eq.${encodeURIComponent(finalUnit)}`, {
                headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
            });
            const existing = checkRes.ok ? await checkRes.json() : [];

            if (existing.length > 0) {
                const newAmount = Number(existing[0].amount) + finalAmount;
                await fetch(`${supabaseUrl}/rest/v1/wurst_bestand?id=eq.${existing[0].id}`, {
                    method: 'PATCH',
                    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ amount: newAmount })
                });
            } else {
                await fetch(`${supabaseUrl}/rest/v1/wurst_bestand`, {
                    method: 'POST',
                    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        id: crypto.randomUUID(), 
                        name: this.recipe.name, 
                        amount: finalAmount, 
                        unit: finalUnit, 
                        revenue: 0 
                    })
                });
            }

            if(this.currentRun) {
                await fetch(`${supabaseUrl}/rest/v1/production_runs?id=eq.${this.currentRun.id}`, {
                    method: 'DELETE',
                    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
                });
            }

            alert("✅ Produktion beendet! Ware liegt jetzt im Wurststand.");
            window.location.href = 'wurststand.html';

        } catch (e) {
            alert("Fehler beim Einbuchen in den Wurststand.");
        }
    }
};

document.addEventListener('DOMContentLoaded', () => window.produktionManager.init());
