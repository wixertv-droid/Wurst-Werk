const assistant = {
    // 1. Unser simuliertes Lager (Später kommen diese echten Zahlen aus der Supabase-Datenbank)
    lager: {
        "Bauch": 2000, // 2000g Bauch haben wir noch im Froster
        "Majoran": 50, // 50g Gewürz
        "Gläser": 15,  // 15 leere Gläser
        "Nacken": 0    // Nacken ist aktuell auf Null!
    },

    // 2. Unsere Rezept-Formeln
    rezepte: [
        {
            name: "Mettwurst im Glas (10 Stück)",
            zutaten: {
                "Nacken": 1500, // Wir brauchen 1,5kg
                "Bauch": 1000,  // Wir brauchen 1kg
                "Majoran": 15,  // Wir brauchen 15g
                "Gläser": 10    // Wir brauchen 10 Gläser
            }
        }
    ],

    // 3. Diese Funktion startet, wenn du den Einkauf in die App tippst
    logPurchase: function(itemName, amountInGramm) {
        // Zutat ins Lager legen
        if(this.lager[itemName] !== undefined) {
            this.lager[itemName] += amountInGramm;
        } else {
            this.lager[itemName] = amountInGramm;
        }

        alert(`🛒 ${amountInGramm / 1000}kg ${itemName} erfolgreich ins Lager gebucht!`);

        // Sofort das Gehirn anwerfen: Was können wir jetzt machen?
        this.checkWhatWeCanMake();
    },

    // 4. Der Smart-Checker
    checkWhatWeCanMake: function() {
        let possibleRecipes = [];

        // Jedes Rezept durchgehen
        this.rezepte.forEach(rezept => {
            let canMake = true;
            
            // Jede benötigte Zutat des Rezepts mit unserem Lager abgleichen
            for (let zutat in rezept.zutaten) {
                let benoetigt = rezept.zutaten[zutat];
                let vorhanden = this.lager[zutat] || 0;
                
                if (vorhanden < benoetigt) {
                    canMake = false; // Uns fehlt was, also überspringen!
                    break; 
                }
            }
            
            // Wenn alle Zutaten da sind, speichern wir den Vorschlag
            if (canMake) {
                possibleRecipes.push(rezept.name);
            }
        });

        // 5. Vorschlag auf dem Bildschirm anzeigen!
        if (possibleRecipes.length > 0) {
            this.showSuggestion(`💡 <b>Smart-Tipp:</b> Mit dem neuen Fleisch und deinem restlichen Bauch-Bestand kannst du jetzt sofort <b>${possibleRecipes.join(', ')}</b> produzieren!`);
        }
    },

    showSuggestion: function(text) {
        const box = document.getElementById('suggestion-box');
        const textElement = document.getElementById('suggestion-text');
        if(box && textElement) {
            textElement.innerHTML = text;
            box.style.display = 'flex'; // Box sichtbar machen
            // Eine kleine Animation abspielen
            box.style.animation = 'none';
            setTimeout(() => box.style.animation = 'fadeIn 0.5s ease', 10);
            
            // Wenn das iPhone vibrieren kann, gib ein kurzes Feedback
            if (navigator.vibrate) navigator.vibrate(100);
        }
    }
};
