import { Coffee } from "@/types/coffee";

export const initialCoffees: Coffee[] = [
  {
    id: 1,
    code: "VI",
    name: "VIANI",
    description: "A bright and fruity coffee with complex flavor notes",
    fullStory: "This exceptional coffee comes from a small family farm in the mountains of Cundinamarca, Colombia. The farmers have been perfecting their craft for generations, using traditional methods combined with modern techniques to produce this outstanding coffee.",
    origin: "CUNDINAMARCA, COLOMBIA",
    farm: "Finca El Paraiso",
    region: "Cundinamarca",
    country: "Colombia",
    variety: "Caturra, Castillo",
    altitude: "1,800 - 2,000m",
    producer: "Carlos Rodriguez",
    tastesLike: ["STONEFRUIT", "COCOA", "GRAPE"],
    processing: "washed",
    roastProfile: "Espresso / Filter",
    category: "specialty",
    pricing: {
      "125g": 8.50,
      "250g": 15.00,
      "1kg": 54.00
    },
    sizeAvailability: {
      "125g": true,
      "250g": true,
      "1kg": true
    },
    available: true,
    roastOptions: ["Espresso", "Filter"],
    image: "/api/placeholder/400/400"
  },
  {
    id: 2,
    code: "IS",
    name: "INACIO SOARES",
    description: "Rich and chocolatey with floral notes and praline sweetness",
    fullStory: "Inacio Soares is a pioneering producer in the Cerrado region of Minas Gerais, Brazil. His innovative anaerobic honey processing method creates unique flavor profiles that have won numerous awards in international competitions.",
    origin: "MINAS GERAIS, BRAZIL",
    farm: "Fazenda Soares",
    region: "Cerrado Mineiro",
    country: "Brazil",
    variety: "Yellow Bourbon",
    altitude: "1,200 - 1,400m",
    producer: "Inacio Soares",
    tastesLike: ["WHITE FLOWERS", "PRALINE", "CHOCOLATE"],
    processing: "anaerobic honey",
    roastProfile: "Espresso / Filter",
    category: "specialty",
    pricing: {
      "125g": 9.50,
      "250g": 18.00,
      "1kg": 65.00
    },
    sizeAvailability: {
      "125g": true,
      "250g": true,
      "1kg": true
    },
    available: true,
    roastOptions: ["Espresso", "Filter"],
    image: "/api/placeholder/400/400"
  }
];