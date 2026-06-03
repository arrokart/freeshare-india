export type Language = "en" | "hi" | "es";

export const translations = {
  en: {
    app_title: "FreeShare India",
    search_placeholder: "Search coordinates or items...",
    all_categories: "All Categories",
    all_conditions: "All Conditions",
    fresh_listings: "Fresh Listings",
    trending_items: "Trending Free Items",
    no_items_found: "No free items found",
    no_items_desc: "Try adjusting your keyword filters, location, or check back later.",
    items_donated: "Items Donated",
    items_received: "Items Received",
    dashboard: "Dashboard",
    login: "Login",
    register: "Register",
    logout: "Log Out",
    radius_filter: "Filter by radius",
    distance_within: "Within",
    km: "km",
    views: "views",
  },
  hi: {
    app_title: "फ्रीशेयर इंडिया",
    search_placeholder: "स्थान या सामान खोजें...",
    all_categories: "सभी श्रेणियां",
    all_conditions: "सभी स्थितियां",
    fresh_listings: "नए विज्ञापन",
    trending_items: "लोकप्रिय वस्तुएं",
    no_items_found: "कोई वस्तु नहीं मिली",
    no_items_desc: "अपने कीवर्ड फ़िल्टर, स्थान को बदलने का प्रयास करें, या बाद में देखें।",
    items_donated: "दान की गई वस्तुएं",
    items_received: "प्राप्त की गई वस्तुएं",
    dashboard: "डैशबोर्ड",
    login: "लॉगिन",
    register: "रजिस्टर",
    logout: "लॉग आउट",
    radius_filter: "दायरे के अनुसार फ़िल्टर करें",
    distance_within: "भीतर",
    km: "किमी",
    views: "दृश्य",
  },
  es: {
    app_title: "FreeShare India",
    search_placeholder: "Buscar coordenadas o artículos...",
    all_categories: "Todas las categorías",
    all_conditions: "Todas las condiciones",
    fresh_listings: "Anuncios recientes",
    trending_items: "Artículos populares",
    no_items_found: "No se encontraron artículos gratis",
    no_items_desc: "Intente ajustar sus filtros de palabras clave, ubicación o vuelva a consultar más tarde.",
    items_donated: "Artículos donados",
    items_received: "Artículos recibidos",
    dashboard: "Panel",
    login: "Iniciar sesión",
    register: "Registrarse",
    logout: "Cerrar sesión",
    radius_filter: "Filtrar por radio",
    distance_within: "Dentro de",
    km: "km",
    views: "vistas",
  }
};

export function getTranslation(key: keyof typeof translations["en"], lang: Language = "en"): string {
  const dictionary = translations[lang] || translations["en"];
  return dictionary[key] || translations["en"][key] || key;
}
