window.produktionManager = {
    recipe: null,
    inventory: [],
    mappedIngredients: [], // Speichert, welche Zutat zu welchem Lagerartikel gehört

    init: async function() {
        // 1. Hole die ID aus der URL
        const params = new URLSearchParams(window.location.search);
        const id = params.get('id');
        
        if (!id) {
            alert("Kein Rezept ausgewählt!");
            window.location.href = 'rezepte.html';
            return;
        }

        try {
            // 2. Rezept und Lager parallel aus der Datenbank laden
            const [recipeRes, invData] = await Promise.all([
                fetch(`${supabaseUrl}/rest/v1/recipes?id=eq.${id}&select=*`, { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }),
                db.getInventory()
            ]);

            const recipes = await recipeRes.json();
            if (recipes.length === 0) throw new Error("Rezept nicht gefunden");
            
            this.recipe = recipes[0];
            this.inventory = invData;

            document.getElementById('prod-title').innerText = `Produktion: ${this.recipe.name}`;
            
            // 3. UI aufbauen
            this.buildMatchingUI();

        } catch (e) {
            alert("Fehler beim Laden der Produktionsdaten!");
            window.location.href = 'rezepte.html';
        }
    },

    // Baut die Liste auf, in der das Rezept mit dem Lager verknüpft wird
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
            // "Schlaues" Suchen: Versucht den Namen im Lager zu finden (Groß/Kleinschreibung egal)
            let bestMatch = this.inventory.find(item => 
                item.name.toLowerCase().includes(ing.name.toLowerCase()) || 
                ing.name.toLowerCase().includes(item.name.toLowerCase())
            );

            // HTML für das Dropdown bauen
            let optionsHtml = `<option value="">-- Bitte Lager-Artikel zuordnen --</option>`;
            
            // Wir sortieren das Dropdown, damit Fleisch und Gewürze schön geordnet sind
            const sortedInv = [...this.inventory].sort((a,b) => a.category.localeCompare(b.category));
            
            sortedInv.forEach(item => {
                // Pfandgläser schließen wir hier aus, die kommen ja erst am Ende ins Spiel
                if(item.category === 'Pfandglas' || item.category === 'Maschine') return; 
                
                const isSelected = bestMatch && bestMatch.id === item.id ? 'selected' : '';
                optionsHtml += `<option value="${item.id}" ${isSelected}>[${item.category}] ${item.name} (${item.amount} ${item.unit} auf Lager)</option>`;
            });

            const selectClass = bestMatch ? 'matched' : 'unmatched';

            // Jede Zutat bekommt eine Zeile
            container.innerHTML += `
                <div class="match-row">
                    <div class="match-header">
                        <span style="font-weight: bold; color: var(--accent-amber);">${ing.name}</span>
                        <span style="font-size: 1.2rem; font-weight: bold;" id="calc-val-${index}">${ing.amount} ${ing.unit}</span>
                    </div>
                    <select class="match-select ${selectClass}" id="match-select-${index}" onchange="window.produktionManager.updateSelectColor(this)">
                        ${optionsHtml}
                        <option value="skip">❌ Nicht aus dem Lager abbuchen (Ignorieren)</option>
                    </select>
                </div>
            `;

            // Speichern für die Live-Berechnung
            this.mappedIngredients.push({
                originalName: ing.name,
                baseAmount: ing.amount,
                unit: ing.unit,
                index: index
            });
        });
    },

    // Macht das Feld grün, wenn was ausgewählt wurde, rot wenn es leer ist
    updateSelectColor: function(selectEl) {
        if(selectEl.value && selectEl.value !== "") {
            selectEl.classList.remove('unmatched');
            selectEl.classList.add('matched');
        } else {
            selectEl.classList.remove('matched');
            selectEl.classList.add('unmatched');
        }
    },

    // Wird bei JEDEM Tastendruck im Feld "kg Fleischmasse" aufgerufen!
    recalculate: function() {
        const multiInput = document.getElementById('multiplier-input').value;
        const multiplier = parseFloat(multiInput) || 0; // Wenn leer, dann 0

        this.mappedIngredients.forEach(ing => {
            const calculatedAmount = (ing.baseAmount * multiplier);
            
            // Wenn es Gramm sind, machen wir keine ewig langen Kommastellen
            const displayAmount = calculatedAmount % 1 === 0 ? calculatedAmount : calculatedAmount.toFixed(1);
            
            document.getElementById(`calc-val-${ing.index}`).innerText = `${displayAmount} ${ing.unit}`;
        });
    },

    // Bucht die Mengen in Supabase ab und startet die Checkliste
    deductAndStart: async function() {
        const multiInput = document.getElementById('multiplier-input').value;
        const multiplier = parseFloat(multiInput) || 0;
        
        if (multiplier <= 0) {
            alert("Bitte gib eine gültige Fleischmenge (kg) ein!");
            return;
        }

        // 1. Sammle alle Abbuchungen
        let updates = [];
        let hasErrors = false;

        this.mappedIngredients.forEach(ing => {
            const selectEl = document.getElementById(`match-select-${ing.index}`);
            const invId = selectEl.value;
            
            if (invId === "") {
                hasErrors = true;
                selectEl.style.border = "2px solid red";
            } else if (invId !== "skip") {
                // Reale Abbuchung vorbereiten
                const neededAmount = (ing.baseAmount * multiplier);
                const invItem = this.inventory.find(i => i.id == invId);
                
                if(invItem) {
                    // ACHTUNG: Hier muss in der echten Praxis noch eine Umrechnung rein, falls das Lager in kg und das Rezept in g ist.
                    // Fürs erste ziehen wir die blanken Zahlen ab.
                    let newAmount = Number(invItem.amount) - neededAmount;
                    updates.push({ id: invItem.id, amount: newAmount });
                }
            }
        });

        if (hasErrors) {
            alert("⚠️ Bitte ordne alle rot markierten Zutaten einem Lager-Artikel zu oder wähle 'Ignorieren'!");
            return;
        }

        // 2. An die Datenbank senden (Warenabgang)
        if (updates.length > 0) {
            if(!confirm(`Möchtest du die berechneten Mengen jetzt wirklich fest aus deinem Lager abbuchen?`)) return;

            // Wir schicken für jeden Artikel ein Update (in einer professionellen App macht man das als Bulk, aber so ist es sicherer)
            for (let update of updates) {
                await fetch(`${supabaseUrl}/rest/v1/inventory?id=eq.${update.id}`, {
                    method: 'PATCH',
                    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ amount: update.amount })
                });
            }
        }

        // 3. UI Umschalten auf Checkliste
        document.getElementById('step-1-setup').style.display = 'none';
        document.getElementById('step-2-checklist').style.display = 'block';
        this.buildChecklist();
    },

    buildChecklist: function() {
        const container = document.getElementById('checklist-container');
        const details = this.recipe.details || {};
        const steps = details.steps || [];

        container.innerHTML = '';
        
        if (steps.length === 0) {
            container.innerHTML = '<p class="text-muted">Keine Arbeitsschritte hinterlegt.</p>';
            return;
        }

        steps.forEach((step, index) => {
            let extra = '';
            if (step.type === 'timer') extra = `<br><b style="color:#4d4dff;">⏳ ${step.duration} ${step.unit}</b>`;
            if (step.type === 'interval') extra = `<br><b style="color:var(--accent-amber);">🔁 ${step.cycles}x ${step.duration} ${step.unit} (Pause: ${step.pauses}h)</b>`;

            container.innerHTML += `
                <div class="check-step" id="step-row-${index}" onclick="window.produktionManager.toggleStep(${index})">
                    <div class="check-btn"><span class="material-symbols-outlined">check</span></div>
                    <div style="flex: 1;">
                        <b style="font-size: 0.8rem; color: #888; text-transform: uppercase;">Schritt ${index + 1}</b>
                        <p style="margin: 3px 0 0 0; font-size: 0.95rem; line-height: 1.4;">${step.text} ${extra}</p>
                    </div>
                </div>
            `;
        });
    },

    toggleStep: function(index) {
        const row = document.getElementById(`step-row-${index}`);
        row.classList.toggle('done');
    },

    finishProduction: function() {
        alert("✅ Produktion erfolgreich abgeschlossen!\n(Die Timer und das fertige Wurst-Lager bauen wir im nächsten Schritt ein!)");
        window.location.href = 'index.html'; // Zurück zum Dashboard
    }
};

document.addEventListener('DOMContentLoaded', () => window.produktionManager.init());
