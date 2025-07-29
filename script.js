// URL de votre API Google Apps Script
// REMPLACEZ CECI PAR L'URL DÉPLOYÉE DE VOTRE SCRIPT APPS !
const APP_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwO0P3Yo5kw9PPriJPXzUMipBrzlGTR_r-Ff6OyEUnsNu-I9q-rESbBq7l2m6KLA3RJ/exec';

// Variables globales
let materielCounter = 0;
let deferredPrompt; // Pour la PWA
let currentStep = 1; // Pour le formulaire multi-étapes

// --- NOUVELLES FONCTIONS UTILITAIRES ---

// 1. Debouncing pour les requêtes API et événements rapides
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// 2. Cache en mémoire pour réduire les appels API (côté client)
class DataCache {
    constructor(ttl = 300000) { // 5 minutes par défaut
        this.cache = new Map();
        this.ttl = ttl;
    }
    
    set(key, value) {
        this.cache.set(key, {
            value,
            timestamp: Date.now()
        });
    }
    
    get(key) {
        const item = this.cache.get(key);
        if (!item) return null;
        
        // Invalidate cache if expired
        if (Date.now() - item.timestamp > this.ttl) {
            this.cache.delete(key);
            return null;
        }
        
        return item.value;
    }

    delete(key) {
        this.cache.delete(key);
    }

    clear() {
        this.cache.clear();
    }
}

const dataCache = new DataCache(); // Instance globale du cache

// 3. Rate limiting côté client
class RateLimiter {
    constructor(maxRequests = 5, windowMs = 10000) { // 5 requêtes toutes les 10 secondes
        this.requests = [];
        this.maxRequests = maxRequests;
        this.windowMs = windowMs;
    }
    
    canMakeRequest() {
        const now = Date.now();
        // Filter out requests older than the window
        this.requests = this.requests.filter(time => now - time < this.windowMs);
        
        if (this.requests.length >= this.maxRequests) {
            return false;
        }
        
        this.requests.push(now);
        return true;
    }
    
    getWaitTime() {
        if (this.requests.length === 0) return 0;
        const oldestRequestTime = this.requests[0];
        const timeElapsedInWindow = Date.now() - oldestRequestTime;
        return Math.max(0, this.windowMs - timeElapsedInWindow);
    }
}

const rateLimiter = new RateLimiter(); // Instance globale du rate limiter

// --- GESTION DES REQUÊTES API (avec rate limiting et gestion d'erreur) ---
async function makeApiRequest(path, params = {}, method = 'GET', data = null) {
    // Check client-side rate limit
    if (!rateLimiter.canMakeRequest()) {
        const waitTime = Math.ceil(rateLimiter.getWaitTime() / 1000);
        ToastManager.show(`Veuillez patienter ${waitTime} secondes avant d'envoyer une nouvelle requête.`, 'warning');
        LoadingManager.hide();
        throw new Error('Too Many Requests (client-side rate limit)');
    }

    const url = new URL(APP_SCRIPT_URL);
    // Ajoutez un ID client pour le rate limiting côté serveur (si implémenté)
    // IMPORTANT: Ceci générera un nouvel ID à chaque requête. Pour un suivi par session, stockez-le dans localStorage.
    params.clientId = DataProtection.generateSessionId(); 

    // Add query parameters for GET requests, or for action/method in POST
    Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

    const options = {
        method: method,
        mode: 'cors', // Apps Script est configuré pour gérer le CORS par défaut si déployé correctement
        cache: 'no-cache'
    };

    if (data && method === 'POST') {
        options.headers = {
            'Content-Type': 'application/json'
        };
        options.body = JSON.stringify(data);
    }

    try {
        const response = await fetch(url.toString(), options);
        if (!response.ok) {
            const errorText = await response.text();
            let errorMessage = `HTTP Error: ${response.status} - ${errorText}`;
            try {
                const errorJson = JSON.parse(errorText);
                errorMessage = errorJson.error || errorMessage;
            } catch (e) {
                // Not JSON, use plain text
            }
            throw new Error(errorMessage);
        }
        return response;
    } catch (error) {
        console.error("Erreur lors de la requête API:", error);
        throw error; // Re-throw to be caught by the calling function
    }
}

// --- GESTION DU FORMULAIRE MULTI-ÉTAPES ---
function showStep(stepNumber) {
    document.querySelectorAll('.form-step').forEach(stepDiv => {
        stepDiv.classList.remove('active');
    });
    document.getElementById(`step${stepNumber}`).classList.add('active');

    document.querySelectorAll('.step-indicator .step').forEach((indicator, index) => {
        if (index + 1 < stepNumber) {
            indicator.classList.add('completed');
            indicator.classList.remove('active');
        } else if (index + 1 === stepNumber) {
            indicator.classList.add('active');
            indicator.classList.remove('completed');
        } else {
            indicator.classList.remove('active', 'completed');
        }
    });
    currentStep = stepNumber;
}

// --- GESTION DES THÈMES ---
function toggleTheme() {
    const body = document.body;
    const themeToggle = document.querySelector('.theme-toggle');
    
    if (body.getAttribute('data-theme') === 'dark') {
        body.removeAttribute('data-theme');
        themeToggle.textContent = '🌙';
        localStorage.setItem('theme', 'light');
    } else {
        body.setAttribute('data-theme', 'dark');
        themeToggle.textContent = '☀️';
        localStorage.setItem('theme', 'dark');
    }
}

function loadSavedTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.setAttribute('data-theme', 'dark');
        document.querySelector('.theme-toggle').textContent = '☀️';
    }
}

// --- PWA LOGIC ---
function setupPWA() {
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        document.getElementById('installPrompt').classList.add('show');
    });

    document.getElementById('installAppBtn').addEventListener('click', installApp);
    document.getElementById('dismissInstallBtn').addEventListener('click', dismissInstall);
}

function installApp() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                console.log('App installée');
                ToastManager.show('📱 Application installée avec succès !', 'success');
            }
            deferredPrompt = null;
        });
    }
    dismissInstall();
}

function dismissInstall() {
    document.getElementById('installPrompt').classList.remove('show');
}


// --- FORMULAIRE D'ENREGISTREMENT DE MOUVEMENT ---
// Mapping des noms de feuilles vers les zones logiques pour le frontend
const NOM_FEUILLE_TO_NOM_ZONE_FRONTEND = {
    "Stock Voie Creuse": "Voie Creuse",
    "Stock Bibliothèque": "Bibliothèque",
};

function updateFormLabelsAndVisibility() {
    const typeSelected = document.getElementById('typeMouvement').value;
    const feuilleCible = document.getElementById('feuilleCible').value;
    const zoneLabel = document.querySelector('#zoneInputFieldGroup label');
    const feuilleCibleSelect = document.getElementById('feuilleCible');
    const typeMouvementSelect = document.getElementById('typeMouvement');
    const zoneMouvementInput = document.getElementById('zoneMouvement');

    if (typeSelected === "Transfert") {
        feuilleCibleSelect.querySelector('option[value="Stock Voie Creuse"]').disabled = false;
        feuilleCibleSelect.querySelector('option[value="Stock Bibliothèque"]').disabled = false;
        feuilleCibleSelect.querySelector('option[value="Répartition Journalière"]').disabled = true;
        feuilleCibleSelect.querySelector('option[value="Restes Zones"]').disabled = true;
        zoneLabel.innerHTML = '📍 Zone de Destination du Transfert:';
        if (!['Stock Voie Creuse', 'Stock Bibliothèque'].includes(feuilleCible)) {
            feuilleCibleSelect.value = 'Stock Voie Creuse';
        }
    } else if (typeSelected === "Entrée" || typeSelected === "Sortie") {
        feuilleCibleSelect.querySelector('option[value="Stock Voie Creuse"]').disabled = false;
        feuilleCibleSelect.querySelector('option[value="Stock Bibliothèque"]').disabled = false;
        feuilleCibleSelect.querySelector('option[value="Répartition Journalière"]').disabled = true;
        feuilleCibleSelect.querySelector('option[value="Restes Zones"]').disabled = true;
        if (typeSelected === "Entrée") {
            zoneLabel.innerHTML = '📍 Zone de Destination (où le matériel est ajouté):';
        } else {
            zoneLabel.innerHTML = '📍 Zone d\'Origine (d\'où le matériel est retiré):';
        }
        zoneMouvementInput.value = NOM_FEUILLE_TO_NOM_ZONE_FRONTEND[feuilleCible] || '';
    } else if (feuilleCible === "Répartition Journalière") {
        zoneLabel.innerHTML = '📍 Zone de Distribution:';
        typeMouvementSelect.value = "Entrée";
        typeMouvementSelect.disabled = true;
    } else if (feuilleCible === "Restes Zones") {
        zoneLabel.innerHTML = '📍 Zone d\'Inventaire:';
        typeMouvementSelect.value = "Entrée";
        typeMouvementSelect.disabled = true;
    }

    if (feuilleCible !== "Répartition Journalière" && feuilleCible !== "Restes Zones") {
        typeMouvementSelect.disabled = false;
    }

    zoneMouvementInput.required = true;
}

function addMaterielItem() {
    materielCounter++;
    const container = document.getElementById('materielsContainer');
    
    const materielDiv = document.createElement('div');
    materielDiv.className = 'materiel-item';
    materielDiv.dataset.id = materielCounter;
    
    materielDiv.innerHTML = `
        <div class="materiel-inputs">
            <input list="materielsList" 
                   placeholder="📦 Sélectionner ou saisir un matériel" 
                   class="materiel-input" 
                   required>
            <input type="number" 
                   placeholder="🔢 Quantité" 
                   class="quantite-input" 
                   min="1" 
                   required>
        </div>
        <button type="button" class="btn-danger remove-materiel-btn button-enhanced">🗑️ Supprimer</button>
    `;
    
    container.appendChild(materielDiv);
    
    const removeBtn = materielDiv.querySelector('.remove-materiel-btn');
    removeBtn.addEventListener('click', () => removeMaterielItem(materielDiv));
    
    updateMaterielCounter();
}

function removeMaterielItem(materielDiv) {
    const container = document.getElementById('materielsContainer');
    if (container.children.length > 1) {
        materielDiv.remove();
        updateMaterielCounter();
    } else {
        ToastManager.show('⚠️ Au moins un matériel est requis.', 'warning');
    }
}

function updateMaterielCounter() {
    const count = document.getElementById('materielsContainer').children.length;
    document.getElementById('materielCount').textContent = count;
}


async function handleFormSubmit(event) {
    event.preventDefault();
    LoadingManager.show('Enregistrement des mouvements...');
    
    try {
        const formData = {
            feuilleCible: document.getElementById('feuilleCible').value,
            date: document.getElementById('dateMouvement').value,
            type: document.getElementById('typeMouvement').value,
            zone: document.getElementById('zoneMouvement').value,
            items: []
        };

        const materielItems = document.querySelectorAll('.materiel-item');
        for (const item of materielItems) {
            const materiel = item.querySelector('.materiel-input').value;
            const quantite = item.querySelector('.quantite-input').value;
            
            formData.items.push({
                materiel: materiel,
                quantite: quantite
            });
        }

        const validationResult = FormValidator.validateMovement(formData);
        if (!validationResult.isValid) {
            validationResult.errors.forEach(err => ToastManager.show(err, 'error'));
            LoadingManager.hide();
            return;
        }

        // Use submitBatchMovement for API calls
        const apiResponse = await sendBatchToAPI(formData); // This now sends as POST
        const resultJson = await apiResponse.json();

        if (apiResponse.ok && resultJson.overallStatus === "success") {
            ToastManager.show(`✅ Mouvements enregistrés avec succès : ${formData.items.length} matériel(s) traité(s).`, 'success');
            if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
            
            resetForm();
            dataCache.clear(); // Clear relevant cache entries
            loadAllZonesForDatalist();
            loadAllMaterielsForDatalist(); 
            loadAvailableZonesForVisualization();
        } else if (apiResponse.ok && resultJson.overallStatus === "partial_success") {
            const failedItems = resultJson.results.filter(r => r.status === "failed");
            const successCount = resultJson.results.length - failedItems.length;
            const failureMessages = failedItems.map(item => `${item.materiel}: ${item.message}`);
            
            ToastManager.show(`⚠️ Opération partielle : ${successCount} succès, ${failedItems.length} échecs. Détails : ${failureMessages.join('; ')}.`, 'warning', 10000);
            if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 100]);
        } else {
            // Error already handled by makeApiRequest, but ensure a final toast
            ToastManager.show(`❌ Échec de l'enregistrement: ${resultJson.error || 'Erreur inconnue.'}`, 'error');
            if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 100]);
        }
        
    } catch (error) {
        console.error('Erreur lors de l\'enregistrement:', error);
        ToastManager.show('❌ Erreur générale lors de l\'enregistrement : ' + error.message, 'error');
        if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 100]);
    } finally {
        LoadingManager.hide();
    }
}

// Fonction pour envoyer un lot de mouvements à l'API Apps Script
async function sendBatchToAPI(formData) {
    const params = {
        action: 'addBatchMovement', // Nouvelle action pour le traitement par lot
        // Base parameters for the batch, actual items go in the body
        feuilleCible: formData.feuilleCible,
        date: formData.date,
        type: formData.type,
        zone: formData.zone,
    };

    const batchData = {
        items: formData.items.map(item => ({
            materiel: item.materiel,
            quantite: item.quantite
        }))
    };

    // Send as POST request
    return makeApiRequest('', params, 'POST', batchData); 
}


function resetForm() {
    document.getElementById('mouvementForm').reset();
    
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    document.getElementById('dateMouvement').value = `${yyyy}-${mm}-${dd}`;
    
    const container = document.getElementById('materielsContainer');
    container.innerHTML = '';
    materielCounter = 0;
    addMaterielItem();
    
    updateFormLabelsAndVisibility();
    showStep(1); // Revenir à la première étape
}


// --- CHARGEMENT DES DONNÉES ET VISUALISATION ---

async function loadAllZonesForDatalist() {
    const cacheKey = 'zonesDatalist';
    let zones = dataCache.get(cacheKey);

    if (!zones) {
        try {
            const response = await makeApiRequest('?get=zones');
            zones = await response.json();
            dataCache.set(cacheKey, zones);
        } catch (error) {
            console.error('Erreur lors du chargement des zones depuis l\'API:', error);
            // Fallback to default zones
            // Ensure this fallback list is always consistent with Apps Script's predefined list
            zones = ["Voie Creuse", "Bibliothèque", "étage 1", "étage 2", "étage 3", "étage 4", "étage 5", "étage 6", "étage 7", "étage 8", "étage 9", "étage 10", "reading room 1", "reading room 2", "compactus", "b26"];
            ToastManager.show('Chargement des zones API échoué. Utilisation des zones par défaut.', 'warning');
        }
    }
    
    const zonesDatalist = document.getElementById('zonesList');
    zonesDatalist.innerHTML = '';
    zones.forEach(zone => {
        const option = document.createElement('option');
        option.value = zone;
        zonesDatalist.appendChild(option);
    });
}

async function loadAllMaterielsForDatalist() {
    const cacheKey = 'materielsDatalist';
    let materiels = dataCache.get(cacheKey);

    if (!materiels) {
        try {
            const response = await makeApiRequest('?get=materiels');
            materiels = await response.json();
            dataCache.set(cacheKey, materiels);
        } catch (error) {
            console.error('Erreur lors du chargement des matériels depuis l\'API:', error);
            // Fallback to default materials
            materiels = ["Cadres-palette CFF", "Cartons 60x37x38", "Couvercles cadres-palette", "Intercalaires 120x80", "Palettes 80x120", "rouleau scotch", "papier blanc"];
            ToastManager.show('Chargement des matériels API échoué. Utilisation des matériels par défaut.', 'warning');
        }
    }
    
    const materielsDatalist = document.getElementById('materielsList');
    materielsDatalist.innerHTML = '';
    materiels.forEach(materiel => {
        const option = document.createElement('option');
        option.value = materiel;
        materielsDatalist.appendChild(option);
    });
}

async function loadAvailableZonesForVisualization() {
    const selectZoneVisualisation = document.getElementById('selectZoneVisualisation');
    const cacheKey = 'zonesVisualization';
    let zones = dataCache.get(cacheKey);

    if (!zones) {
        try {
            const response = await makeApiRequest('?get=zones');
            zones = await response.json();
            dataCache.set(cacheKey, zones);
        } catch (error) {
            console.error('Erreur lors du chargement des zones pour visualisation depuis l\'API:', error);
            zones = ["Voie Creuse", "Bibliothèque", "étage 1", "étage 2", "étage 3"]; // Fallback
            ToastManager.show('Chargement des zones de visualisation API échoué. Utilisation des zones par défaut.', 'warning');
        }
    }
    
    selectZoneVisualisation.innerHTML = '<option value="">-- Sélectionner une zone --</option>';
    zones.forEach(zone => {
        const option = document.createElement('option');
        option.value = zone;
        option.textContent = zone;
        selectZoneVisualisation.appendChild(option);
    });

    if (zones.length > 0) {
        // Debounce initial load to prevent rapid calls if multiple elements trigger it
        debounce(() => loadStockData(zones[0]), 300)();
    }
}

async function handleLoadStock() {
    const selectedZone = document.getElementById('selectZoneVisualisation').value;
    if (selectedZone) {
        loadStockData(selectedZone);
    } else {
        ToastManager.show('⚠️ Veuillez sélectionner une zone pour visualiser le stock.', 'warning');
    }
}

// Load stock data with skeleton loader
async function loadStockData(zone) {
    LoadingManager.show(`Chargement du stock pour "${zone}"...`);
    document.getElementById('initialStockMessage').style.display = 'none'; // Hide initial message
    const stockDisplayArea = document.getElementById('stockDisplayArea');
    
    const skeleton = ProgressiveLoader.showSkeleton('stockDisplayArea', 5); // Show skeleton for 5 rows

    try {
        const response = await makeApiRequest(`?etat=1&zone=${encodeURIComponent(zone)}`);
        const data = await response.json();
        
        ProgressiveLoader.hideSkeleton(skeleton); // Hide skeleton
        displayStockData(data, zone);
        ToastManager.show(`✅ Stock pour "${zone}" chargé avec succès.`, 'success');
    } catch (error) {
        console.error('Erreur lors du chargement des données de stock:', error);
        ProgressiveLoader.hideSkeleton(skeleton); // Hide skeleton
        stockDisplayArea.innerHTML = `
            <p style="text-align: center; color: var(--error-color); padding: 40px;">
                ❌ Erreur lors du chargement des données pour "${zone}". Veuillez réessayer.
            </p>
        `;
        ToastManager.show(`❌ Échec du chargement du stock pour "${zone}": ${error.message}`, 'error');
    } finally {
        LoadingManager.hide();
    }
}

function displayStockData(data, zoneName) {
    const stockDisplayArea = document.getElementById('stockDisplayArea');
    stockDisplayArea.innerHTML = ''; // Ensure it's clean before adding content

    const title = document.createElement('h3');
    title.innerHTML = `📦 État des stocks pour ${zoneName}:`;
    title.style.color = 'var(--primary-color)';
    title.style.textAlign = 'center';
    title.style.marginBottom = '20px';
    stockDisplayArea.appendChild(title);

    if (data && data.length > 1) {
        const tableContainer = document.createElement('div');
        tableContainer.classList.add('table-responsive'); // Apply responsive class

        const table = document.createElement('table');
        table.classList.add('stock-table');

        let html = '<thead><tr>';
        // Check if data[0] exists before iterating
        if (data[0] && Array.isArray(data[0])) {
            data[0].forEach(header => {
                html += `<th>${header}</th>`;
            });
        }
        html += '</tr></thead><tbody>';

        for (let i = 1; i < data.length; i++) {
            html += '<tr>';
            if (data[i] && Array.isArray(data[i])) {
                data[i].forEach(cell => {
                    html += `<td>${cell}</td>`;
                });
            }
            html += '</tr>';
        }
        html += '</tbody>';
        table.innerHTML = html;
        tableContainer.appendChild(table);
        stockDisplayArea.appendChild(tableContainer);
        
    } else {
        stockDisplayArea.innerHTML += '<p style="text-align: center; color: #666; padding: 40px;">📭 Aucune donnée de stock trouvée pour cette zone ou le stock est vide.</p>';
    }
}

// --- INITIALISATION DE L'APPLICATION ---
document.addEventListener('DOMContentLoaded', () => {
    const mouvementForm = document.getElementById('mouvementForm');
    const dateMouvementInput = document.getElementById('dateMouvement');
    const feuilleCibleSelect = document.getElementById('feuilleCible');
    const typeMouvementSelect = document.getElementById('typeMouvement');
    const addMaterielBtn = document.getElementById('addMaterielBtn');
    const chargerStockBtn = document.getElementById('chargerStockBtn');
    const nextStepBtn = document.getElementById('nextStepBtn');
    const prevStepBtn = document.getElementById('prevStepBtn');

    // Initialisation de la date
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    dateMouvementInput.value = `${yyyy}-${mm}-${dd}`;

    // Charger les données initiales pour les datalists et la visualisation
    loadAllZonesForDatalist();
    loadAllMaterielsForDatalist();
    loadAvailableZonesForVisualization(); // Cette fonction appellera loadStockData pour la première zone

    // Ajouter le premier matériel
    addMaterielItem();

    // Event listeners
    document.querySelector('.theme-toggle').addEventListener('click', toggleTheme); // Event listener for theme toggle
    typeMouvementSelect.addEventListener('change', updateFormLabelsAndVisibility);
    feuilleCibleSelect.addEventListener('change', updateFormLabelsAndVisibility);
    addMaterielBtn.addEventListener('click', addMaterielItem);
    mouvementForm.addEventListener('submit', handleFormSubmit);
    chargerStockBtn.addEventListener('click', handleLoadStock);

    // Navigation du formulaire multi-étapes
    nextStepBtn.addEventListener('click', () => {
        // Petite validation pour passer à l'étape suivante
        const zoneInput = document.getElementById('zoneMouvement');
        const dateInput = document.getElementById('dateMouvement');
        if (!dateInput.value.trim() || !zoneInput.value.trim()) {
            ToastManager.show('Veuillez remplir la date et la zone avant de continuer.', 'warning');
            return;
        }
        showStep(2);
    });
    prevStepBtn.addEventListener('click', () => showStep(1));

    // Initialiser l'affichage
    updateFormLabelsAndVisibility();
    showStep(1); // Assurez-vous que la première étape est affichée au démarrage

    // Charger le thème sauvegardé
    loadSavedTheme();

    // Setup PWA install prompt
    setupPWA();

    // Initialize auto-save for main form
    const autoSave = new AutoSave('#mouvementForm', 30000); // Save every 30 seconds
    autoSave.restoreAutoSave();

    // Exemple de toast de bienvenue
    setTimeout(() => {
        ToastManager.show('Bienvenue dans la Gestion de Stock !', 'info');
    }, 1000);
});

// --- CLASSES D'AMÉLIORATION UX/DEV ---

// Toast notification system
class ToastManager {
    static show(message, type = 'info', duration = 4000) {
        const container = document.getElementById('toastContainer');
        if (!container) return; // Fail gracefully if container not found

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            ${message}
            <button class="toast-close" aria-label="Fermer la notification" onclick="this.parentElement.remove()">×</button>
        `;
        
        container.appendChild(toast);
        
        setTimeout(() => {
            if (toast.parentElement) {
                toast.style.animation = 'slideInToast 0.3s ease reverse';
                setTimeout(() => toast.remove(), 300);
            }
        }, duration);
    }
}

// Auto-save functionality
class AutoSave {
    constructor(formSelector, saveInterval = 30000) {
        this.form = document.querySelector(formSelector);
        if (!this.form) {
            console.warn('AutoSave: Form selector not found.', formSelector);
            return;
        }
        this.saveInterval = saveInterval;
        this.indicator = document.getElementById('autoSaveIndicator');
        this.lastSave = Date.now();
        this.autoSaveTimeout = null;
        this.setupAutoSave();
    }
    
    setupAutoSave() {
        // Monitor changes on all inputs within the form
        this.form.addEventListener('input', () => this.scheduleAutoSave());
        this.form.addEventListener('change', () => this.scheduleAutoSave()); // For select/checkboxes
        
        // Periodically check if a save is needed
        setInterval(() => {
            if (Date.now() - this.lastSave > this.saveInterval && this.formChangedSinceLastSave()) {
                this.autoSave();
            }
        }, 5000); // Check every 5 seconds if a save is due
    }

    // Check if form data has changed since last save
    formChangedSinceLastSave() {
        const currentData = JSON.stringify(this.getFormData());
        const lastSavedData = localStorage.getItem('autoSaveData_' + this.form.id);
        return currentData !== lastSavedData;
    }

    getFormData() {
        const formData = new FormData(this.form);
        // Special handling for dynamic material inputs
        const materielItems = document.querySelectorAll('#materielsContainer .materiel-item');
        const items = [];
        materielItems.forEach(item => {
            items.push({
                materiel: item.querySelector('.materiel-input').value,
                quantite: item.querySelector('.quantite-input').value
            });
        });
        return {
            ...Object.fromEntries(formData.entries()),
            materielItems: items
        };
    }
    
    scheduleAutoSave() {
        clearTimeout(this.autoSaveTimeout);
        this.autoSaveTimeout = setTimeout(() => {
            this.autoSave();
        }, 2000); // Save after 2 seconds of inactivity
    }
    
    autoSave() {
        const data = this.getFormData();
        
        // Save to localStorage
        localStorage.setItem('autoSave_' + this.form.id, JSON.stringify({
            data,
            timestamp: Date.now()
        }));
        // Store current form state to detect changes
        localStorage.setItem('autoSaveData_' + this.form.id, JSON.stringify(data));
        
        this.showSaveIndicator();
        this.lastSave = Date.now();
    }
    
    showSaveIndicator() {
        if (this.indicator) {
            this.indicator.classList.add('show');
            setTimeout(() => {
                this.indicator.classList.remove('show');
            }, 2000);
        }
    }
    
    restoreAutoSave() {
        const saved = localStorage.getItem('autoSave_' + this.form.id);
        if (saved) {
            const { data, timestamp } = JSON.parse(saved);
            // Restore if less than 12 hours old
            if (Date.now() - timestamp < 43200000) { // 12 hours in ms
                Object.entries(data).forEach(([name, value]) => {
                    if (name === 'materielItems') {
                        const container = document.getElementById('materielsContainer');
                        container.innerHTML = ''; // Clear existing items
                        materielCounter = 0;
                        value.forEach(itemData => {
                            addMaterielItem(); // Add a new item element
                            const newItem = container.lastElementChild;
                            if (newItem) { // Ensure element was added
                                newItem.querySelector('.materiel-input').value = itemData.materiel;
                                newItem.querySelector('.quantite-input').value = itemData.quantite;
                            }
                        });
                        updateMaterielCounter();
                    } else {
                        const input = this.form.querySelector(`[name="${name}"]`);
                        if (input) input.value = value;
                    }
                });
                ToastManager.show('Données restaurées depuis la sauvegarde automatique', 'info');
                // Ensure form state is updated to avoid immediate re-save
                localStorage.setItem('autoSaveData_' + this.form.id, JSON.stringify(data));
            } else {
                // Clear old auto-save data
                localStorage.removeItem('autoSave_' + this.form.id);
                localStorage.removeItem('autoSaveData_' + this.form.id);
            }
        }
    }
}

// Progressive loading (Skeleton Loader)
class ProgressiveLoader {
    static showSkeleton(containerId, numRows = 3) {
        const container = document.getElementById(containerId);
        if (!container) return null;

        const skeletonContainer = document.createElement('div');
        skeletonContainer.className = 'skeleton-container';
        skeletonContainer.id = 'activeSkeleton-' + containerId; // Give a unique ID to manage it

        for (let i = 0; i < numRows; i++) {
            const row = document.createElement('div');
            row.className = 'skeleton skeleton-row';
            // Vary width for a more natural look
            row.style.width = `${70 + Math.random() * 30}%`;
            skeletonContainer.appendChild(row);
        }
        container.innerHTML = ''; // Clear existing content before adding skeleton
        container.appendChild(skeletonContainer);
        skeletonContainer.style.display = 'block'; // Make it visible
        return skeletonContainer;
    }
    
    static hideSkeleton(skeletonElement) {
        if (skeletonElement && skeletonElement.parentElement) {
            skeletonElement.remove();
        }
    }
}

// Enhanced global loading states
class LoadingManager {
    static show() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) overlay.classList.add('show');
    }
    
    static hide() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) overlay.classList.remove('show');
    }
}

// --- VALIDATION CÔTÉ CLIENT ---
class FormValidator {
    static validateMovement(formData) {
        const errors = [];
        
        // Sanitization and initial conversion
        formData.zone = this.sanitizeString(formData.zone);
        formData.feuilleCible = this.sanitizeString(formData.feuilleCible);
        formData.type = this.sanitizeString(formData.type);

        formData.items = formData.items.map(item => ({
            materiel: this.sanitizeString(item.materiel),
            // Quantité est déjà parsée en entier par auto-save ou input type="number"
            quantite: this.sanitizeNumber(item.quantite) 
        }));
        
        // Basic required fields
        if (!formData.date) errors.push("La date est obligatoire.");
        if (!formData.zone) errors.push("La zone est obligatoire.");
        if (!formData.type) errors.push("Le type de mouvement est obligatoire.");
        if (!formData.feuilleCible) errors.push("La feuille cible est obligatoire.");

        // Business rules validation
        if (formData.type === "Transfert") {
            if (!this.isValidTransferSource(formData.feuilleCible)) {
                errors.push("Source de transfert invalide. Seuls 'Stock Voie Creuse' et 'Stock Bibliothèque' sont valides.");
            }
            if (this.getLogicalZone(formData.feuilleCible) === formData.zone) {
                errors.push("Pour un transfert, la zone source et la zone de destination ne peuvent pas être identiques.");
            }
            if (!formData.zone || !formData.feuilleCible) {
                errors.push("Pour un Transfert, la Feuille de Journalisation (Source) et la Zone de Destination sont obligatoires.");
            }
        } else if (formData.feuilleCible === "Répartition Journalière" && formData.type !== "Entrée") {
            errors.push('Pour "Répartition Journalière", seul le type "Entrée" est logique.');
        } else if (formData.feuilleCible === "Restes Zones" && formData.type !== "Entrée") {
            errors.push('Pour "Restes Zones", seul le type "Entrée" (historique) est logique.');
        }
        
        // Quantity and material name validation
        if (formData.items.length === 0) {
            errors.push('Au moins un matériel est requis.');
        }
        formData.items.forEach((item, index) => {
            if (!item.materiel || item.materiel.length < 2) {
                errors.push(`Nom de matériel trop court ou manquant pour l'article ${index + 1}.`);
            }
            if (item.quantite <= 0 || item.quantite > 100000) { // Max 100,000 to prevent extreme values
                errors.push(`Quantité invalide pour l'article "${item.materiel || index + 1}". Elle doit être positive et inférieure à 100,000.`);
            }
        });
        
        return { isValid: errors.length === 0, errors };
    }
    
    static sanitizeString(str) {
        if (typeof str !== 'string') return '';
        // Basic sanitization: remove HTML-like characters, trim whitespace, limit length
        return str.trim().replace(/[<>'"&]/g, '').slice(0, 255);
    }
    
    static sanitizeNumber(num) {
        const parsed = parseInt(num, 10);
        // Ensure it's a number, convert to 0 if NaN, and constrain positive values
        return isNaN(parsed) ? 0 : Math.max(0, parsed);
    }
    
    static isValidTransferSource(feuille) {
        return ["Stock Voie Creuse", "Stock Bibliothèque"].includes(feuille);
    }
    
    static getLogicalZone(feuille) {
        const mapping = {
            "Stock Voie Creuse": "Voie Creuse",
            "Stock Bibliothèque": "Bibliothèque"
        };
        return mapping[feuille];
    }
}

// --- PROTECTION DES DONNÉES (Exemple pour ID Client) ---
class DataProtection {
    // Génère un ID de session simple (non sécurisé pour authentification réelle)
    static generateSessionId() {
        let sessionId = localStorage.getItem('clientId');
        if (!sessionId) {
            sessionId = 'sess_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
            localStorage.setItem('clientId', sessionId);
        }
        return sessionId;
    }
}
