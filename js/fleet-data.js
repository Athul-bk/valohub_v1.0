/**
 * ValoHub Bike Rental - Boutique 3-Bike Fleet Data
 * Hardcoded JSON array representing the 3 available motorcycles in Kozhikode.
 */

const FLEET_DATA = [
  {
    id: "himalayan-450",
    name: "Royal Enfield Himalayan 450",
    edition: "Summit Edition (Kamet White)",
    category: "Adventure Touring",
    engineCapacity: "452 cc",
    power: "40.02 PS @ 8,000 rpm",
    torque: "40 Nm @ 5,500 rpm",
    mileage: "30 km/l",
    fuelType: "Petrol (Fuel Injected)",
    seatHeight: "825 mm",
    pricing: {
      hourlyRate: 120,
      dailyRate: 2880, // 24 hours * ₹120/hr
      weekendDailyRate: 3360, // 24 hours * ₹140/hr
      depositAmount: 1500, // 100% refundable
      freeKmsPerDay: 200,
      extraKmRate: 6
    },
    specs: [
      { label: "Engine", value: "452cc Liquid-Cooled" },
      { label: "Terrain", value: "Highways & Wayanad Churam" },
      { label: "Brakes", value: "Dual Channel Switchable ABS" },
      { label: "Luggage", value: "Rear Carrier & Pannier Mounts" }
    ],
    features: [
      "Sherpa 450 Liquid-Cooled Engine",
      "Full TFT Navigation Display with Google Maps",
      "Ride-by-Wire with Eco & Performance Modes",
      "Upside-Down Front Showa Suspension",
      "USB-C Fast Charging Port on Console"
    ],
    idealFor: "Long-haul trips to Wayanad Ghats, Thusharagiri, Nilgiris & Malabar Hills",
    image: "https://images.unsplash.com/photo-1591637333184-19aa84b3e01f?auto=format&fit=crop&w=1000&q=80",
    badge: "Most Popular for Wayanad",
    availableAt: "Kozhikode Railway Station / Mavoor Rd Hub",
    status: "AVAILABLE",
    rating: 4.9,
    reviewCount: 42
  },
  {
    id: "classic-350",
    name: "Royal Enfield Classic 350",
    edition: "Reborn Chrome Bronze",
    category: "Modern Classic Cruiser",
    engineCapacity: "349 cc",
    power: "20.2 BHP @ 6,100 rpm",
    torque: "27 Nm @ 4,000 rpm",
    mileage: "36 km/l",
    fuelType: "Petrol (J-Series EFI)",
    seatHeight: "805 mm",
    pricing: {
      hourlyRate: 85,
      dailyRate: 2040, // 24 hours * ₹85/hr
      weekendDailyRate: 2376, // 24 hours * ₹99/hr
      depositAmount: 1000, // 100% refundable
      freeKmsPerDay: 180,
      extraKmRate: 5
    },
    specs: [
      { label: "Engine", value: "349cc J-Series Smooth" },
      { label: "Terrain", value: "City, Coastal & Scenic Cruising" },
      { label: "Brakes", value: "Dual Channel ABS" },
      { label: "Seating", value: "Comfort Split Touring Seat" }
    ],
    features: [
      "Signature RE J-Series refined engine with zero vibration",
      "Pillion backrest for comfortable 2-up rides",
      "Classic teardrop tank & gleaming chrome mirrors",
      "Crisp analog-digital cluster with service reminder",
      "USB mobile charging handlebar socket"
    ],
    idealFor: "Sunset coastal rides along Kappad Beach, Beypore Port & Calicut Beach",
    image: "https://images.unsplash.com/photo-1558981359-219d6364c9c8?auto=format&fit=crop&w=1000&q=80",
    badge: "Best for Coastal Cruising",
    availableAt: "Kozhikode Railway Station / Mavoor Rd Hub",
    status: "AVAILABLE",
    rating: 4.8,
    reviewCount: 56
  },
  {
    id: "duke-390",
    name: "KTM 390 Duke",
    edition: "Gen-3 Electronic Orange",
    category: "Street Fighter / Performance",
    engineCapacity: "399 cc",
    power: "46 PS @ 8,500 rpm",
    torque: "39 Nm @ 6,500 rpm",
    mileage: "28 km/l",
    fuelType: "Petrol (Liquid-Cooled LC4c)",
    seatHeight: "800 mm",
    pricing: {
      hourlyRate: 110,
      dailyRate: 2640, // 24 hours * ₹110/hr
      weekendDailyRate: 3120, // 24 hours * ₹130/hr
      depositAmount: 1500, // 100% refundable
      freeKmsPerDay: 180,
      extraKmRate: 6
    },
    specs: [
      { label: "Engine", value: "399cc LC4c High-Output" },
      { label: "Terrain", value: "Expressways & Twisties" },
      { label: "Brakes", value: "Cornering ABS & Supermoto Mode" },
      { label: "Tech", value: "Quickshifter+ & Launch Control" }
    ],
    features: [
      "Class-leading 46 PS power-to-weight ratio",
      "Bi-directional Quickshifter+ for clutchless up/downshifts",
      "5-inch bonded TFT display with Bluetooth pairing",
      "WP APEX adjustable suspension (front & rear)",
      "Motorcycle Traction Control (MTC) & Track Screen"
    ],
    idealFor: "Thrilling agility across Kannur-Kozhikode highway & twisting hill roads",
    image: "https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=1000&q=80",
    badge: "Ultimate Performance",
    availableAt: "Kozhikode Railway Station / Mavoor Rd Hub",
    status: "AVAILABLE",
    rating: 4.9,
    reviewCount: 38
  }
];

const ADDON_OPTIONS = [
  {
    id: "pillion_helmet",
    name: "Pillion Passenger Helmet",
    brand: "Vega / Studds ISI Certified",
    pricePerDay: 50,
    icon: "helmet",
    description: "Sanitized, sanitized visor with adjustable chin strap"
  },
  {
    id: "phone_mount",
    name: "BOBO Waterproof Phone Mount",
    brand: "Vibration Dampener + USB",
    pricePerDay: 50,
    icon: "phone",
    description: "High-grip claw clamp with fast charging cable for GPS navigation"
  },
  {
    id: "riding_jacket",
    name: "Rynox Armored Riding Jacket",
    brand: "Level-2 CE Armor Protection",
    pricePerDay: 200,
    icon: "shield",
    description: "Breathable mesh with Knox/Safe-Tech back, shoulder & elbow guards"
  },
  {
    id: "saddle_bags",
    name: "Waterproof Touring Saddlebags",
    brand: "ViaTerra 45L Capacity",
    pricePerDay: 150,
    icon: "bag",
    description: "Heavy-duty 100% rain-proof bags ideal for Wayanad / Ooty weekenders"
  }
];

const LOCAL_DESTINATIONS = [
  {
    name: "Wayanad Thamarassery Churam",
    distance: "60 km",
    duration: "1.5 hrs",
    description: "9 hairpin bends, misty viewpoints, and thrilling winding roads. Best enjoyed on the Himalayan 450 or Duke 390.",
    image: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=600&q=80"
  },
  {
    name: "Kappad Beach Historic Shoreline",
    distance: "16 km",
    duration: "30 mins",
    description: "Scenic coconut palm-fringed coastal highway where Vasco da Gama landed in 1498. Perfect for sunset cruising on Classic 350.",
    image: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80"
  },
  {
    name: "Kakkayam Dam & Valley",
    distance: "55 km",
    duration: "1.4 hrs",
    description: "Lush Western Ghats reservoir surrounded by evergreen forests, waterfalls, and peaceful mountain roads.",
    image: "https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=600&q=80"
  }
];

if (typeof window !== 'undefined') {
  window.FLEET_DATA = FLEET_DATA;
  window.ADDON_OPTIONS = ADDON_OPTIONS;
  window.LOCAL_DESTINATIONS = LOCAL_DESTINATIONS;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { FLEET_DATA, ADDON_OPTIONS, LOCAL_DESTINATIONS };
}
