export const PRODUCTS_CATALOG = {
  Interfolded: {
    pieceSize: 2000, // cm³ per piece
    packaging: {
      type: 'case',
      quantity: 30,
      name: 'Case (30 pcs)',
      size: 70780.5,
      dimensions: { length: 535, width: 315, height: 420 } // mm
    },
    pricing: {
      perPiece: { price: 26, unit: 'piece' },
      perPackage: { price: 780, unit: 'case' }
    }
  },
  'Jumbo Roll': {
    pieceSize: 3648.4, // cm³ per roll
    packaging: [
      {
        type: 'case',
        quantity: 12,
        name: 'Case (12 rolls)',
        size: 39016.5,
        dimensions: { length: 370, width: 285, height: 370 }
      },
      {
        type: 'case',
        quantity: 16,
        name: 'Case (16 rolls)',
        size: 90956.25,
        dimensions: { length: 495, width: 375, height: 490 }
      }
    ],
    pricing: {
      perPiece: { price: 51, unit: 'roll' },
      perPackage: [
        { price: 612, unit: 'case', quantity: 12 },
        { price: 816, unit: 'case', quantity: 16 }
      ]
    },
    dimensions: { length: 400, width: 300, height: 200 } // mm per roll (estimated)
  },
  Bathroom: {
    pieceSize: 926.7, // cm³ per roll
    packaging: {
      type: 'case',
      quantity: 48,
      name: 'Case (48 rolls)',
      size: 45630,
      dimensions: { length: 585, width: 390, height: 200 }
    },
    pricing: {
      perPiece: { price: 8.15, unit: 'roll' },
      perPackage: { price: 408, unit: 'case' }
    },
    dimensions: { length: 250, width: 180, height: 120 } // mm per roll (estimated)
  },
  'Hand Roll': {
    pieceSize: 6813.6, // cm³ per roll
    packaging: {
      type: 'case',
      quantity: 6,
      name: 'Case (6 rolls)',
      size: 46200,
      dimensions: { length: 550, width: 400, height: 210 }
    },
    pricing: {
      perPiece: { price: 134, unit: 'roll' },
      perPackage: { price: 804, unit: 'case' }
    },
    dimensions: { length: 200, width: 150, height: 100 } // mm per roll (estimated)
  }
};

export const PRODUCT_NAMES = Object.keys(PRODUCTS_CATALOG);
