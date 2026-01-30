// ============================================
// BASE Content Studio - Router SPA (Hash-based)
// ============================================

class Router {
  constructor() {
    this.routes = [];
    this.currentRoute = null;
    window.addEventListener('hashchange', () => this.resolve());
  }

  // Registra uma rota
  on(pattern, handler) {
    // Converte pattern tipo '/cliente/:slug/mes/:mes' em regex
    const paramNames = [];
    const regexStr = pattern.replace(/:(\w+)/g, (_, name) => {
      paramNames.push(name);
      return '([^/]+)';
    });
    this.routes.push({
      pattern,
      regex: new RegExp(`^${regexStr}$`),
      paramNames,
      handler
    });
    return this;
  }

  // Resolve a rota atual
  resolve() {
    const hash = window.location.hash.slice(1) || '/';
    
    for (const route of this.routes) {
      const match = hash.match(route.regex);
      if (match) {
        const params = {};
        route.paramNames.forEach((name, i) => {
          params[name] = decodeURIComponent(match[i + 1]);
        });
        this.currentRoute = { pattern: route.pattern, params, hash };
        route.handler(params);
        return;
      }
    }
    
    // Rota não encontrada - vai pro home
    this.navigate('/');
  }

  // Navega para uma rota
  navigate(path) {
    window.location.hash = path;
  }

  // Inicia o router
  start() {
    this.resolve();
  }
}

// Instância global
const router = new Router();
