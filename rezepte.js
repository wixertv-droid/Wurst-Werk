const rezeptManager = {
    init: async function() {
        await this.loadList();
    },

    loadList: async function() {
        const listEl = document.getElementById('recipe-page-list');
        if (!listEl) return;

        try {
            // Wir holen die Rezepte direkt über die Supabase API
            const response = await fetch(`${supabaseUrl}/rest/v1/recipes?select=*&order=name.asc`, {
                headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
            });
            const recipes = await response.json();

            listEl.innerHTML = '';

            if (recipes.length === 0) {
                listEl.innerHTML = '<p class="text-muted" style="text-align: center;">Du hast noch keine Rezepte angelegt.</p>';
                return;
            }

            recipes.forEach(r => {
                listEl.innerHTML += `
                    <div class="list-card" style="border-left: 3px solid var(--accent-amber);">
                        <div class="icon-box" style="background: #222;">
                            <span class="material-symbols-outlined" style="color: var(--accent-amber);">restaurant_menu</span>
                        </div>
                        <div class="info">
                            <h3 style="font-size: 1.1rem; margin-bottom: 4px;">${r.name}</h3>
                            <p style="color: var(--text-muted); font-size: 0.85rem; margin: 0;">
                                Kalkulation noch leer
                            </p>
                        </div>
                        <button onclick="rezeptManager.deleteRecipe('${r.id}', '${r.name}')" style="background:none; border:none; color:var(--accent-danger); cursor:pointer; padding: 10px;">
                            <span class="material-symbols-outlined">delete</span>
                        </button>
                    </div>
                `;
            });
        } catch (e) {
            console.error("Fehler beim Laden der Rezepte", e);
            listEl.innerHTML = '<p class="text-muted" style="color: var(--accent-danger); text-align: center;">Fehler beim Laden der Datenbank.</p>';
        }
    },

    addRecipe: async function() {
        const nameEl = document.getElementById('new-recipe-name');
        const nameVal = nameEl.value.trim();

        if (!nameVal) {
            alert("⚠️ Bitte gib einen Rezeptnamen ein!");
            return;
        }

        try {
            const response = await fetch(`${supabaseUrl}/rest/v1/recipes`, {
                method: 'POST',
                headers: { 
                    'apikey': supabaseKey, 
                    'Authorization': `Bearer ${supabaseKey}`, 
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify({ name: nameVal })
            });

            if (response.ok) {
                nameEl.value = ''; 
                await this.loadList(); 
            } else {
                alert("❌ Fehler beim Speichern des Rezepts.");
            }
        } catch (e) { 
            alert("Netzwerkfehler beim Speichern!"); 
        }
    },

    deleteRecipe: async function(id, name) {
        if (!confirm(`Möchtest du das Rezept "${name}" wirklich löschen?`)) return;

        try {
            const res = await fetch(`${supabaseUrl}/rest/v1/recipes?id=eq.${id}`, {
                method: 'DELETE',
                headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
            });

            if (res.ok) {
                await this.loadList();
            } else {
                alert("Fehler beim Löschen des Rezepts.");
            }
        } catch (e) { 
            alert("Verbindungsfehler."); 
        }
    }
};

document.addEventListener('DOMContentLoaded', () => rezeptManager.init());
