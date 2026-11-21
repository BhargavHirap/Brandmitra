/**
 * BUSINESS TYPES — the single list of the kinds of business Vantra is built for.
 *
 * Vantra is not a restaurant app. The same modules (storefront, catalogue,
 * order desk, customer book, stock, staff) serve a sweet shop, a salon, a
 * boutique, an AC repair service, a coaching class and a wholesale distributor.
 * The only thing that changes is the vocabulary of what they sell.
 *
 * Three things live here:
 *   1. `INDUSTRY_GROUPS` — the six verticals, each with the industries inside it
 *      and the kind of copy the landing page shows.
 *   2. `INDUSTRIES` — the flat `{ value, label }` list used by every <select>.
 *   3. `starterCategories(value)` — the category names seeded into a brand new
 *      business, so a salon opens its catalogue with "Haircuts, Colour, ..."
 *      instead of an empty screen. Owners can rename or delete all of them.
 *
 * The `value` strings are stored in `businesses.industry`. Never rename one
 * without a database migration, or existing businesses lose their type.
 */

export type Industry = {
  /** Stored in `businesses.industry`. Stable — do not rename. */
  value: string;
  label: string;
  /** Category names seeded on signup. Owners edit or remove them freely. */
  categories: string[];
};

export type IndustryGroup = {
  value: string;
  label: string;
  /** One line for the landing page: what this vertical actually does here. */
  summary: string;
  /** Concrete examples shown under the group name. */
  examples: string[];
  industries: Industry[];
};

export const INDUSTRY_GROUPS: IndustryGroup[] = [
  {
    value: "food",
    label: "Food, sweets & cloud kitchens",
    summary:
      "Menus and daily specials with real stock, so a question about what is left today is answered by the catalogue, not a phone call.",
    examples: ["Sweet marts", "Bakeries", "Tiffin services", "Cloud kitchens"],
    industries: [
      {
        value: "restaurant",
        label: "Restaurant / dine-in",
        categories: ["Starters", "Mains", "Breads", "Rice", "Desserts", "Drinks"],
      },
      {
        value: "cafe",
        label: "Cafe / coffee shop",
        categories: ["Coffee", "Tea", "Cold drinks", "Snacks", "Bakes"],
      },
      {
        value: "bakery",
        label: "Bakery",
        categories: ["Breads", "Cakes", "Pastries", "Cookies", "Savouries"],
      },
      {
        value: "sweets",
        label: "Sweet shop / farsan",
        categories: ["Sweets", "Farsan", "Namkeen", "Gift boxes"],
      },
      {
        value: "cloud-kitchen",
        label: "Cloud kitchen",
        categories: ["Signature dishes", "Combos", "Rice & breads", "Sides", "Desserts"],
      },
      {
        value: "tiffin",
        label: "Tiffin / meal service",
        categories: ["Weekly plans", "Daily thali", "Extras"],
      },
      {
        value: "caterer",
        label: "Caterer",
        categories: ["Party menus", "Live counters", "Sweets", "Beverages"],
      },
      {
        value: "home-baker",
        label: "Home baker",
        categories: ["Cakes", "Cupcakes", "Brownies", "Cookies", "Gift boxes"],
      },
      {
        value: "grocery",
        label: "Grocery / kirana",
        categories: ["Staples", "Dairy", "Snacks", "Household", "Fresh produce"],
      },
      {
        value: "dairy",
        label: "Dairy / milk booth",
        categories: ["Milk", "Curd & paneer", "Ghee", "Sweets"],
      },
      {
        value: "meat-fish",
        label: "Meat & fish shop",
        categories: ["Chicken", "Mutton", "Fish", "Eggs", "Marinades"],
      },
    ],
  },
  {
    value: "wellness",
    label: "Salons, spas & wellness",
    summary:
      "Services with durations and prices as catalogue items, a client book with visit history, and packages customers buy once and use over weeks.",
    examples: ["Beauty salons", "Spas", "Dental clinics", "Gyms"],
    industries: [
      {
        value: "salon",
        label: "Salon",
        categories: ["Haircuts", "Colour", "Styling", "Bridal", "Packages"],
      },
      {
        value: "spa",
        label: "Spa",
        categories: ["Massages", "Facials", "Body treatments", "Packages"],
      },
      {
        value: "makeup",
        label: "Makeup artist / mehendi",
        categories: ["Bridal", "Party", "Engagement", "Trials"],
      },
      {
        value: "dental",
        label: "Dental clinic",
        categories: ["Consultations", "Cleaning", "Treatments", "Braces"],
      },
      {
        value: "clinic",
        label: "Clinic / doctor",
        categories: ["Consultations", "Health packages", "Procedures", "Follow-ups"],
      },
      {
        value: "gym",
        label: "Gym / fitness studio",
        categories: ["Memberships", "Personal training", "Classes", "Day pass"],
      },
      {
        value: "yoga",
        label: "Yoga / pilates studio",
        categories: ["Class packs", "Monthly plans", "Private sessions"],
      },
      {
        value: "physio",
        label: "Physiotherapy",
        categories: ["Assessments", "Sessions", "Packages"],
      },
    ],
  },
  {
    value: "retail",
    label: "Instagram-first boutiques & D2C retail",
    summary:
      "One mobile checkout link for the Instagram bio, live size and colour stock, and order tracking without replying to every DM by hand.",
    examples: ["Boutiques", "Footwear shops", "Gift stores", "Skincare brands"],
    industries: [
      {
        value: "boutique",
        label: "Boutique / clothing",
        categories: ["New arrivals", "Sarees", "Kurtis", "Western", "Accessories"],
      },
      {
        value: "footwear",
        label: "Footwear shop",
        categories: ["Men", "Women", "Kids", "Sports", "Sandals"],
      },
      {
        value: "gifts",
        label: "Gift shop",
        categories: ["Hampers", "Personalised gifts", "Flowers", "Cards"],
      },
      {
        value: "jewellery",
        label: "Jewellery",
        categories: ["Rings", "Necklaces", "Earrings", "Custom orders"],
      },
      {
        value: "cosmetics",
        label: "Cosmetics / skincare",
        categories: ["Skincare", "Makeup", "Haircare", "Gift sets"],
      },
      {
        value: "home-decor",
        label: "Home decor",
        categories: ["Cushions", "Wall art", "Lighting", "Dining"],
      },
      {
        value: "books",
        label: "Bookstore / stationery",
        categories: ["Books", "Stationery", "Art supplies", "Gifts"],
      },
      {
        value: "pets",
        label: "Pet supplies",
        categories: ["Food", "Toys", "Grooming", "Accessories"],
      },
      {
        value: "plants",
        label: "Nursery / plants",
        categories: ["Indoor plants", "Pots", "Soil & feed", "Gifts"],
      },
    ],
  },
  {
    value: "services",
    label: "Local services & repair",
    summary:
      "Job requests with the appliance, model and warranty on the customer record, a rate card instead of guessed quotes, and a history of past visits.",
    examples: ["AC repair", "Home cleaning", "Car detailing", "Electronics repair"],
    industries: [
      {
        value: "ac-repair",
        label: "AC & appliance repair",
        categories: ["Service visits", "Gas refill", "Installation", "AMC"],
      },
      {
        value: "cleaning",
        label: "Home cleaning",
        categories: ["Deep clean", "Regular clean", "Sofa & carpet", "Bathroom"],
      },
      {
        value: "car-care",
        label: "Car wash / detailing",
        categories: ["Wash", "Interior", "Ceramic coating", "Packages"],
      },
      {
        value: "electronics",
        label: "Electronics repair",
        categories: ["Phone repair", "Laptop repair", "Diagnostics", "Accessories"],
      },
      {
        value: "electrician",
        label: "Electrician / plumber",
        categories: ["Repairs", "Installation", "Emergency call-out", "Parts"],
      },
      {
        value: "pest",
        label: "Pest control",
        categories: ["Home", "Commercial", "Termite", "Follow-up"],
      },
      {
        value: "laundry",
        label: "Laundry / dry clean",
        categories: ["Wash & fold", "Dry clean", "Ironing", "Express"],
      },
      {
        value: "photography",
        label: "Photography",
        categories: ["Portraits", "Weddings", "Events", "Editing"],
      },
      {
        value: "event-decor",
        label: "Event planner / decorator",
        categories: ["Decor", "Venue", "Rentals", "Add-ons"],
      },
      {
        value: "pet-care",
        label: "Pet grooming / care",
        categories: ["Grooming", "Boarding", "Walks", "Packages"],
      },
    ],
  },
  {
    value: "learning",
    label: "Coaching, classes & events",
    summary:
      "Batches, passes and workshop seats sold as catalogue items, registrations that land in the order desk, and one record of every fee paid.",
    examples: ["Coaching institutes", "Hobby workshops", "Dance schools", "Event teams"],
    industries: [
      {
        value: "coaching",
        label: "Coaching institute",
        categories: ["Batches", "Test series", "Study material", "Doubt sessions"],
      },
      {
        value: "tuition",
        label: "Tuition centre",
        categories: ["Subjects", "Monthly fees", "Crash courses"],
      },
      {
        value: "hobby",
        label: "Hobby / skill workshop",
        categories: ["Workshops", "Monthly plans", "Material kits"],
      },
      {
        value: "dance",
        label: "Dance / music school",
        categories: ["Classes", "Private lessons", "Performances"],
      },
      {
        value: "playschool",
        label: "Playschool / daycare",
        categories: ["Admission", "Monthly fees", "Day care", "Activities"],
      },
      {
        value: "event",
        label: "Event organiser",
        categories: ["Passes", "Tables", "Merch", "Add-ons"],
      },
    ],
  },
  {
    value: "wholesale",
    label: "B2B wholesale & distribution",
    summary:
      "Repeat order lists instead of voice notes, tier pricing for regular shopkeepers, and one ledger of who ordered what and paid when.",
    examples: ["Kirana suppliers", "Packaging distributors", "Hardware wholesalers", "Fabric suppliers"],
    industries: [
      {
        value: "wholesaler",
        label: "Wholesaler / distributor",
        categories: ["Bulk cases", "Cartons", "Pallet", "Tier pricing"],
      },
      {
        value: "packaging",
        label: "Packaging supplier",
        categories: ["Boxes", "Bags", "Tape", "Labels"],
      },
      {
        value: "hardware",
        label: "Hardware supplier",
        categories: ["Tools", "Fittings", "Paint", "Bulk"],
      },
      {
        value: "fabric",
        label: "Fabric / textile supplier",
        categories: ["Cottons", "Synthetics", "Rolls", "Swatches"],
      },
      {
        value: "agri",
        label: "Agri supplier",
        categories: ["Seeds", "Fertiliser", "Tools", "Bulk"],
      },
      {
        value: "other",
        label: "Other business",
        categories: ["Popular", "New", "Services", "Packages"],
      },
    ],
  },
];

/** Flat list for the onboarding and settings <select> elements. */
export const INDUSTRIES: { value: string; label: string }[] = INDUSTRY_GROUPS.flatMap((group) =>
  group.industries.map((industry) => ({ value: industry.value, label: industry.label })),
);

const BY_VALUE = new Map(
  INDUSTRY_GROUPS.flatMap((group) =>
    group.industries.map((industry) => [industry.value, { industry, group }] as const),
  ),
);

export function isIndustry(value: string): boolean {
  return BY_VALUE.has(value);
}

export function industryLabel(value: string): string {
  return BY_VALUE.get(value)?.industry.label ?? "Business";
}

export function industryGroupOf(value: string): IndustryGroup | null {
  return BY_VALUE.get(value)?.group ?? null;
}

/**
 * Category names a new business starts with, based on the type it picked.
 * Unknown or legacy values fall back to a neutral set rather than an empty list.
 */
export function starterCategories(value: string): string[] {
  return BY_VALUE.get(value)?.industry.categories ?? ["Popular", "New", "Services", "Packages"];
}
