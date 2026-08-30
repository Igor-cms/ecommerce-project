export const BRAND_COLORS = {
  legendary: 'hsl(45 85% 95%)', // cream
  everyday: 'hsl(350 58% 67%)', // pink
} as const;

export const BRAND_TEXT_POSITIONS = {
  idle: {
    legendary: {
      className: "absolute left-1/4 top-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center z-20",
      style: undefined
    },
    everyday: {
      className: "absolute right-1/4 top-1/2 transform translate-x-1/2 -translate-y-1/2 text-center z-20",
      style: undefined
    },
    because: {
      className: "absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center z-30",
      style: undefined
    }
  },
  legendary: {
    legendary: {
      className: "absolute left-1/2 top-1/4 transform -translate-x-1/2 -translate-y-1/2 text-center z-20",
      style: undefined
    },
    everyday: undefined,
    because: {
      className: "absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center z-30",
      style: { marginTop: '70px' }
    }
  },
  everyday: {
    legendary: {
      className: "absolute left-1/4 top-1/4 transform -translate-x-1/2 -translate-y-1/2 text-center z-20",
      style: { marginLeft: '-50px', marginTop: '-15px' }
    },
    everyday: {
      className: "absolute left-1/2 top-1/4 transform -translate-x-1/2 -translate-y-1/2 text-center z-20",
      style: undefined
    },
    because: {
      className: "absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center z-30",
      style: { marginTop: '70px' }
    }
  }
} as const;

export type BrandType = 'legendary' | 'everyday';