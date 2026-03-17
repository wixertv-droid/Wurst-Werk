const rezeptManager = {
    currentRecipeId: null,

    init: async function() {
        await this.loadList();
    },

    loadList: async function() {
        const listEl = document.getElementById('recipe-page-list');
        if (!listEl) return;

        try {
            const response = await fetch(`${supabaseUrl}/rest/v1/recipes?select=*&order=name.asc`, {
                headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
            });
            const recipes = await response.json();

            listEl.innerHTML = '';

            if (recipes.length === 0) {
                listEl.innerHTML = '<p class="text-muted" style="text-align: center;">Keine Rezepte gefunden.</p>';
                return;
            }

            recipes.forEach(r => {
                const safeData = encodeURIComponent(JSON.stringify(r));
                listEl.innerHTML += `
                    <div class="list-card" style="border-left: 3px solid var(--accent-amber); cursor: pointer;" onclick="rezeptManager.openDetail('${safeData}')">
                        <div class="icon-box" style="background: #222;">
                            <span class="material-symbols-outlined" style="color: var(--accent-amber);">restaurant_menu</span>
                        </div>
                        <div class="info">
                            <h3 style="font-size: 1.1rem; margin-bottom: 4px;">${r.name}</h3>
                            <p style="color: #aaa; font-size: 0.85rem; margin: 0;">Auf 1kg genormt</p>
                        </div>
                        <span class="material-symbols-outlined" style="color: #555;">chevron_right</span>
                    </div>
                `;
            });
        } catch (e) {
            listEl.innerHTML = '<p class="text-muted" style="color: red;">Fehler beim Laden.</p>';
        }
    },

    openDetail: function(encodedData) {
        const r = JSON.parse(decodeURIComponent(encodedData));
        this.currentRecipeId = r.id; // Merken für den Start-Button
        const details = r.details || {};

        document.getElementById('recipe-list-view').style.display = 'none';
        document.getElementById('recipe-detail-view').style.display = 'block';
        document.getElementById('detail-title').innerText = r.name;

        // 1. Zutaten aufbauen
        const ingContainer = document.getElementById('detail-ingredients');
        ingContainer.innerHTML = '';
        if (details.ingredients && details.ingredients.length > 0) {
            details.ingredients.forEach(ing => {
                ingContainer.innerHTML += `
                    <div class="ing-row">
                        <span>${ing.name}</span>
                        <b style="color: var(--text-main);">${ing.amount} ${ing.unit}</b>
                    </div>
                `;
            });
        } else {
            ingContainer.innerHTML = '<p class="text-muted">Keine Zutaten hinterlegt.</p>';
        }

        // 2. Schritte & Timer aufbauen
        const stepsContainer = document.getElementById('detail-steps');
        stepsContainer.innerHTML = '';
        if (details.steps && details.steps.length > 0) {
            let stepNum = 1;
            details.steps.forEach(step => {
                let icon = 'check_circle';
                let styleClass = '';
                let extraText = '';

                if (step.type === 'timer') {
                    icon = 'schedule';
                    styleClass = 'timer';
                    extraText = `<br><b style="color:#4d4dff;">⏳ ${step.duration} ${step.unit}</b>`;
                } else if (step.type === 'interval') {
                    icon = 'sync';
                    styleClass = 'interval';
                    extraText = `<br><b style="color:var(--accent-amber);">🔁 ${step.cycles}x ${step.duration} ${step.unit} (Pause: ${step.pauses}h)</b>`;
                }

                stepsContainer.innerHTML += `
                    <div class="step-row ${styleClass}">
                        <div class="step-icon"><span class="material-symbols-outlined">${icon}</span></div>
                        <div class="step-text">
                            <b style="color: #fff; font-size: 0.8rem; text-transform: uppercase;">Schritt ${stepNum}</b><br>
                            ${step.text} ${extraText}
                        </div>
                    </div>
                `;
                stepNum++;
            });
        } else {
            stepsContainer.innerHTML = '<p class="text-muted">Kein Ablauf hinterlegt.</p>';
        }
    },

    closeDetail: function() {
        document.getElementById('recipe-detail-view').style.display = 'none';
        document.getElementById('recipe-list-view').style.display = 'block';
    },

    startProduction: function() {
        // HIER passiert später die Magie!
        // Wir leiten weiter zur Produktions-Seite und übergeben die ID des Rezepts.
        alert("🚀 Bereit für die Produktion!\nIm nächsten Schritt bauen wir die zubereitung.html, die dich nach der Kilo-Menge fragt und das Lager abbucht!");
        // window.location.href = `zubereitung.html?recipeId=${this.currentRecipeId}`;
    }
};

document.addEventListener('DOMContentLoaded', () => rezeptManager.init());
 