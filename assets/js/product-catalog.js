/*
 * Central product catalog for Hueman.
 * Edit descriptions here for all pages.
 */
(function () {
  "use strict";

  const CATALOG = {
    "urban-legend": {
      indexDescriptionId: "descUrban",
      name: { el: "Urban Legend", en: "Urban Legend" },
      category: { el: "Statement", en: "Statement" },
      price: 19.99,
      images: ["assets/icons/a1.png", "assets/icons/a2.png", "assets/icons/a3.png", "assets/icons/a4.png"],
      image: "assets/icons/a1.png",
      description: {
        el: "Καθαρό statement design για δυνατές εμφανίσεις.",
        en: "Clean statement design for standout looks."
      }
    },
    "classic-banter": {
      indexDescriptionId: "descClassic",
      name: { el: "Classic Banter", en: "Classic Banter" },
      category: { el: "Fun", en: "Fun" },
      price: 19.99,
      images: ["assets/icons/b1.png", "assets/icons/b2.png", "assets/icons/b3.png", "assets/icons/b4.png"],
      image: "assets/icons/b1.png",
      description: {
        el: "Άνετο και ευκολοφόρετο για κάθε μέρα.",
        en: "Comfortable and easy to wear every day."
      }
    },
    "easy-mode": {
      indexDescriptionId: "descEasy",
      name: { el: "Easy Mode", en: "Easy Mode" },
      category: { el: "Minimal", en: "Minimal" },
      price: 19.99,
      images: ["assets/icons/c1.png", "assets/icons/c2.png", "assets/icons/c3.png", "assets/icons/c4.png"],
      image: "assets/icons/c1.png",
      description: {
        el: "Minimal αισθητική και διαχρονικό ύφος.",
        en: "Minimal aesthetic with timeless style."
      }
    },
    "one-more-tee": {
      indexDescriptionId: "descOneMore",
      name: { el: "One More Tee", en: "One More Tee" },
      category: { el: "Fun", en: "Fun" },
      price: 19.99,
      images: ["assets/icons/d1.png", "assets/icons/d2.png", "assets/icons/d3.png", "assets/icons/d4.png"],
      image: "assets/icons/d1.png",
      description: {
        el: "Fun χαρακτήρας που τραβάει βλέμματα.",
        en: "Fun character that attracts attention."
      }
    },
    "signature-fit": {
      indexDescriptionId: "descSignature",
      name: { el: "Signature Fit", en: "Signature Fit" },
      category: { el: "Minimal", en: "Minimal" },
      price: 19.99,
      images: ["assets/icons/e1.png", "assets/icons/e2.png", "assets/icons/e3.png", "assets/icons/e4.png"],
      image: "assets/icons/e1.png",
      description: {
        el: "Η πιο safe premium επιλογή για καθημερινό look.",
        en: "The safest premium choice for everyday looks."
      }
    }
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeLang(lang) {
    return lang === "en" ? "en" : "el";
  }

  function textForLocalizedField(fieldValue, lang) {
    const normalizedLang = normalizeLang(lang);
    if (fieldValue && typeof fieldValue === "object") {
      return fieldValue[normalizedLang] || fieldValue.el || "";
    }
    return String(fieldValue || "");
  }

  function getIndexDescriptionMap(lang) {
    const map = {};
    Object.keys(CATALOG).forEach((productKey) => {
      const product = CATALOG[productKey];
      if (!product || !product.indexDescriptionId) return;
      map[product.indexDescriptionId] = textForLocalizedField(product.description, lang);
    });
    return map;
  }

  window.HuemanProductCatalog = {
    getAll() {
      return clone(CATALOG);
    },
    getProduct(productKey) {
      return CATALOG[productKey] ? clone(CATALOG[productKey]) : null;
    },
    getDescription(productKey, lang) {
      const product = CATALOG[productKey];
      if (!product) return "";
      return textForLocalizedField(product.description, lang);
    },
    getIndexDescriptionMap
  };
})();
