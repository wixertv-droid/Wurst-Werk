  // Wir packen alles in ein "app" Objekt, das hält den Code aufgeräumt
const app = {
    
    // Initialisierung beim Start der App
    init: function() {
        console.log("Wurstwerk App gestartet!");
        // Hier laden wir später die Daten aus der Datenbank (Supabase)
    },

    // Steuert die Navigation unten
    switchView: function(viewName, clickedElement) {
        // Alle Views verstecken
        document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
        
        // Alle Nav-Items deaktivieren
        document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
        
        // Gewählte View und Icon aktivieren
        document.getElementById('view-' + viewName).classList.add('active');
        clickedElement.classList.add('active');
    }
};

// Startet die App, sobald die Seite geladen ist
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
