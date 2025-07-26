// 1. Debouncing pour les requêtes API
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

// 2. Cache en mémoire pour réduire les appels API
class DataCache {
    constructor(ttl = 300000) { // 5 minutes
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
        
        if (Date.now() - item.timestamp > this.ttl) {
            this.cache.delete(key);
            return null;
        }
        
        return item.value;
    }
}

const dataCache = new DataCache();

// 3. Batch requests pour multiple materials
async function submitBatchMovement(formData) {
    // Group by target sheet to minimize Apps Script calls
    const batches = {};
    
    formData.items.forEach(item => {
        const key = `${formData.feuilleCible}_${formData.type}_${formData.zone}`;
        if (!batches[key]) {
            batches[key] = { ...formData, items: [] };
        }
        batches[key].items.push(item);
    });
    
    // Send batched requests
    const results = await Promise.allSettled(
        Object.values(batches).map(batch => sendBatchToAPI(batch))
    );
    
    return results;
}

// 4. Lazy loading pour les gros datasets
async function loadDataWithPagination(type, page = 0, size = 50) {
    const cacheKey = `${type}_${page}_${size}`;
    const cached = dataCache.get(cacheKey);
    
    if (cached) return cached;
    
    const data = await fetch(`${APP_SCRIPT_URL}?get=${type}&page=${page}&size=${size}`);
    const result = await data.json();
    
    dataCache.set(cacheKey, result);
    return result;
}
