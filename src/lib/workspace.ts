/**
 * WORKSPACE VOCABULARY — the words each kind of business actually uses.
 *
 * The modules are shared (catalogue, order desk, customer book, stock, staff),
 * but a salon does not have "products", "categories", a "kitchen display" or
 * "orders", and a coaching institute does not have a "customer" — it has
 * students paying for batches.
 *
 * This file turns `businesses.industry` into the labels those screens print.
 * Routes, table names and status values never change: only what the owner
 * reads. A new vertical is added by writing one object here.
 */

import { industryGroupOf } from "@/lib/industries";

export type Workspace = {
  /** Singular noun for one catalogue entry: dish, service, course, SKU. */
  item: string;
  /** Plural heading for the catalogue: "Menu items", "Services", "Batches". */
  items: string;
  /** Lowercase plural for running text: "menu items", "services". */
  itemsLower: string;
  /** Singular heading for a group of entries. */
  category: string;
  /** Plural heading for the group picker. */
  categories: string;
  /** Placeholder example in the "add a category" box. */
  categoryExample: string;
  /** Singular noun for what lands when someone checks out. */
  order: string;
  /** Plural heading for the order desk. */
  orders: string;
  /** Singular noun for the person buying. */
  customer: string;
  /** Plural heading for the customer book. */
  customers: string;
  /** Title of the fulfilment screen (was "Kitchen display"). */
  board: string;
  /** One line under the board title, explaining what it is for here. */
  boardIntro: string;
  /** Sentence used when the board is empty. */
  boardEmpty: string;
  /** Column headings: new / in progress / ready. */
  columnLabels: [string, string, string];
  /** One short hint under each column heading. */
  columnHints: [string, string, string];
  /** What to print inside an empty column. */
  columnEmpty: [string, string, string];
  /** Big button that moves a fresh ticket forward. */
  startAction: string;
  /** Big button that moves work in progress to ready. */
  readyAction: string;
  /** Button on a ready ticket: collected, served, completed. */
  handoverAction: string;
  /** Whether "out for delivery" is offered on a ready ticket. */
  allowDispatch: boolean;
  /** Import screen button, or null when a photo of a menu makes no sense. */
  importLabel: string | null;
  /** What the storefront calls its list of things for sale. */
  storefrontList: string;
  /** "Back to ..." link on the public cart. */
  storefrontBack: string;
  /** What a visitor does here: order, book, enrol. */
  storefrontVerb: string;
  /** Hero button that jumps to the list: "Browse the menu". */
  storefrontBrowseLabel: string;
  /** Button on a catalogue card that adds the thing to the cart. */
  addAction: string;
  /** Short header link on the storefront: "Cart", "Bookings". */
  cartLabel: string;
  /** Heading on the public cart: "Your cart", "Your booking". */
  cartTitle: string;
  /** Button that finishes checkout. */
  checkoutAction: string;
  /** Banner heading on the receipt: "Order placed". */
  receiptTitle: string;
  /** Receipt status for a fresh, untouched ticket. */
  statusReceived: string;
  /** Receipt status for a finished ticket. */
  statusDone: string;
  /** Pay-later option label and its one-line hint. */
  payLaterLabel: string;
  payLaterHint: string;
  /** Pay-in-person option label and its one-line hint. */
  payAtStoreLabel: string;
  payAtStoreHint: string;
  /** How the customer gets the thing, printed on the cart summary. */
  fulfilmentNote: string;
  /** Example text in the optional note box. */
  notePlaceholder: string;
};

/* ── The six verticals ────────────────────────────────────────────────────── */

const FOOD: Workspace = {
  item: "dish",
  items: "Menu items",
  itemsLower: "menu items",
  category: "Menu section",
  categories: "Menu sections",
  categoryExample: "Combos",
  order: "order",
  orders: "Orders",
  customer: "customer",
  customers: "Customers",
  board: "Kitchen display",
  boardIntro:
    "New tickets land in the first column. Tap the big button to move a ticket along — the customer's receipt updates at the same time.",
  boardEmpty: "No tickets in the kitchen",
  columnLabels: ["New", "Preparing", "Ready"],
  columnHints: ["Just placed, not started", "Accepted or being cooked", "Waiting to be handed over"],
  columnEmpty: [
    "New orders appear automatically.",
    "Tickets you start preparing show up here.",
    "Finished plates wait here until they are handed over.",
  ],
  startAction: "Start preparing",
  readyAction: "Mark ready",
  handoverAction: "Handed over",
  allowDispatch: true,
  importLabel: "Import menu photo",
  storefrontList: "Menu",
  storefrontBack: "Back to menu",
  storefrontVerb: "order",
  storefrontBrowseLabel: "Browse the menu",
  addAction: "Add to cart",
  cartLabel: "Cart",
  cartTitle: "Your cart",
  checkoutAction: "Place order",
  receiptTitle: "Order placed",
  statusReceived: "Received",
  statusDone: "Delivered",
  payLaterLabel: "Cash on delivery",
  payLaterHint: "Pay when it arrives.",
  payAtStoreLabel: "Pay at the counter",
  payAtStoreHint: "For pickup orders.",
  fulfilmentNote:
    "Delivery or pickup is arranged with the business directly. Online payment is not enabled yet — you pay when you receive it.",
  notePlaceholder: "Less spicy, no onion, ring the bell…",
};

const WELLNESS: Workspace = {
  item: "service",
  items: "Services",
  itemsLower: "services",
  category: "Service group",
  categories: "Service groups",
  categoryExample: "Haircuts",
  order: "booking",
  orders: "Appointments",
  customer: "client",
  customers: "Clients",
  board: "Appointment board",
  boardIntro:
    "New bookings land in the first column. Tap the big button as the client moves from the chair to the finish — their receipt updates at the same time.",
  boardEmpty: "No appointments on the board",
  columnLabels: ["Booked", "In service", "Finished"],
  columnHints: ["Booked, not started", "Client is with you now", "Done, waiting to be closed"],
  columnEmpty: [
    "New bookings appear here automatically.",
    "Appointments you start show up here.",
    "Finished services wait here until you close them.",
  ],
  startAction: "Start service",
  readyAction: "Finish service",
  handoverAction: "Complete",
  allowDispatch: false,
  importLabel: null,
  storefrontList: "Services",
  storefrontBack: "Back to services",
  storefrontVerb: "book",
  storefrontBrowseLabel: "Browse services",
  addAction: "Book",
  cartLabel: "Bookings",
  cartTitle: "Your booking",
  checkoutAction: "Confirm booking",
  receiptTitle: "Booking confirmed",
  statusReceived: "Booked",
  statusDone: "Completed",
  payLaterLabel: "Cash",
  payLaterHint: "Pay at the counter on the day.",
  payAtStoreLabel: "Pay at the counter",
  payAtStoreHint: "Settle when you arrive.",
  fulfilmentNote:
    "Your slot is arranged with the business directly. Online payment is not enabled yet — you pay at the counter.",
  notePlaceholder: "Preferred time, who you would like, allergies…",
};

const RETAIL: Workspace = {
  item: "product",
  items: "Products",
  itemsLower: "products",
  category: "Collection",
  categories: "Collections",
  categoryExample: "New arrivals",
  order: "order",
  orders: "Orders",
  customer: "customer",
  customers: "Customers",
  board: "Packing board",
  boardIntro:
    "New orders land in the first column. Tap the big button as you pack each one — the customer's receipt updates at the same time.",
  boardEmpty: "Nothing waiting to be packed",
  columnLabels: ["New orders", "Packing", "Ready to ship"],
  columnHints: ["Paid or cash on delivery", "Being packed now", "Packed, waiting for pickup"],
  columnEmpty: [
    "New orders appear here automatically.",
    "Orders you start packing show up here.",
    "Packed orders wait here until they leave.",
  ],
  startAction: "Start packing",
  readyAction: "Mark packed",
  handoverAction: "Handed over",
  allowDispatch: true,
  importLabel: null,
  storefrontList: "Shop",
  storefrontBack: "Back to the shop",
  storefrontVerb: "order",
  storefrontBrowseLabel: "Browse the shop",
  addAction: "Add to cart",
  cartLabel: "Cart",
  cartTitle: "Your cart",
  checkoutAction: "Place order",
  receiptTitle: "Order placed",
  statusReceived: "Received",
  statusDone: "Delivered",
  payLaterLabel: "Cash on delivery",
  payLaterHint: "Pay when it arrives.",
  payAtStoreLabel: "Pay at the store",
  payAtStoreHint: "For pickup orders.",
  fulfilmentNote:
    "Delivery or pickup is arranged with the business directly. Online payment is not enabled yet — you pay when you receive it.",
  notePlaceholder: "Size, colour, gift wrap, delivery instructions…",
};

const SERVICES: Workspace = {
  item: "service",
  items: "Services & rates",
  itemsLower: "services",
  category: "Service category",
  categories: "Service categories",
  categoryExample: "Repairs",
  order: "job",
  orders: "Job cards",
  customer: "client",
  customers: "Clients",
  board: "Job board",
  boardIntro:
    "New job cards land in the first column. Tap the big button as the job moves from accepted to done — the client's receipt updates at the same time.",
  boardEmpty: "No open jobs",
  columnLabels: ["New jobs", "On the job", "Finished"],
  columnHints: ["Booked, not started", "Someone is working on it", "Done, waiting for handover"],
  columnEmpty: [
    "New job cards appear here automatically.",
    "Jobs you start show up here.",
    "Finished jobs wait here until they are closed.",
  ],
  startAction: "Start job",
  readyAction: "Job finished",
  handoverAction: "Handed back",
  allowDispatch: false,
  importLabel: null,
  storefrontList: "Services",
  storefrontBack: "Back to services",
  storefrontVerb: "book",
  storefrontBrowseLabel: "Browse services",
  addAction: "Book",
  cartLabel: "Bookings",
  cartTitle: "Your booking",
  checkoutAction: "Confirm booking",
  receiptTitle: "Booking confirmed",
  statusReceived: "Booked",
  statusDone: "Completed",
  payLaterLabel: "Cash",
  payLaterHint: "Pay after the work is done.",
  payAtStoreLabel: "Pay at the counter",
  payAtStoreHint: "Settle when you drop by.",
  fulfilmentNote:
    "Timing and pickup are arranged with the business directly. Online payment is not enabled yet — you pay after the work.",
  notePlaceholder: "Describe the problem, preferred time…",
};

const LEARNING: Workspace = {
  item: "course",
  items: "Courses & batches",
  itemsLower: "courses",
  category: "Course group",
  categories: "Course groups",
  categoryExample: "Batches",
  order: "enrolment",
  orders: "Enrolments",
  customer: "student",
  customers: "Students",
  board: "Enrolment board",
  boardIntro:
    "New enrolments land in the first column. Tap the big button as a seat is confirmed and the batch runs — the student's receipt updates at the same time.",
  boardEmpty: "No enrolments waiting",
  columnLabels: ["New enrolments", "In progress", "Completed"],
  columnHints: ["Seat requested, not confirmed", "Confirmed and attending", "Batch finished"],
  columnEmpty: [
    "New enrolments appear here automatically.",
    "Enrolments you confirm show up here.",
    "Finished batches wait here until they are closed.",
  ],
  startAction: "Confirm seat",
  readyAction: "Mark completed",
  handoverAction: "Completed",
  allowDispatch: false,
  importLabel: null,
  storefrontList: "Courses",
  storefrontBack: "Back to courses",
  storefrontVerb: "enrol",
  storefrontBrowseLabel: "Browse courses",
  addAction: "Enrol",
  cartLabel: "Enrolments",
  cartTitle: "Your enrolment",
  checkoutAction: "Confirm enrolment",
  receiptTitle: "Enrolment confirmed",
  statusReceived: "Enrolled",
  statusDone: "Completed",
  payLaterLabel: "Cash",
  payLaterHint: "Pay the fee at the centre.",
  payAtStoreLabel: "Pay at the centre",
  payAtStoreHint: "Settle the fee in person.",
  fulfilmentNote:
    "Batch timings are confirmed with the institute directly. Online payment is not enabled yet — the fee is paid at the centre.",
  notePlaceholder: "Student name, preferred batch timing…",
};

const WHOLESALE: Workspace = {
  item: "SKU",
  items: "SKUs",
  itemsLower: "SKUs",
  category: "Product group",
  categories: "Product groups",
  categoryExample: "Bulk cases",
  order: "purchase order",
  orders: "Purchase orders",
  customer: "buyer",
  customers: "Buyers",
  board: "Dispatch board",
  boardIntro:
    "New purchase orders land in the first column. Tap the big button as the godown picks and packs each one — the buyer's copy updates at the same time.",
  boardEmpty: "Nothing waiting to be dispatched",
  columnLabels: ["New POs", "Picking", "Ready to dispatch"],
  columnHints: ["Received, not started", "Being picked in the godown", "Packed, waiting for the vehicle"],
  columnEmpty: [
    "New purchase orders appear here automatically.",
    "Orders you start picking show up here.",
    "Packed orders wait here until they leave.",
  ],
  startAction: "Start picking",
  readyAction: "Mark packed",
  handoverAction: "Dispatched",
  allowDispatch: true,
  importLabel: null,
  storefrontList: "Catalogue",
  storefrontBack: "Back to the catalogue",
  storefrontVerb: "order",
  storefrontBrowseLabel: "Browse the catalogue",
  addAction: "Add to cart",
  cartLabel: "Cart",
  cartTitle: "Your purchase order",
  checkoutAction: "Place purchase order",
  receiptTitle: "Purchase order received",
  statusReceived: "Received",
  statusDone: "Delivered",
  payLaterLabel: "Cash on delivery",
  payLaterHint: "Pay when the vehicle arrives.",
  payAtStoreLabel: "Pay at the godown",
  payAtStoreHint: "For self-pickup orders.",
  fulfilmentNote:
    "Dispatch and transport are arranged with the business directly. Online payment is not enabled yet — you settle on delivery.",
  notePlaceholder: "Delivery instructions, GST number, vehicle details…",
};

/** Neutral wording for a business type we do not recognise. */
const OTHER: Workspace = {
  ...RETAIL,
  item: "item",
  items: "Items",
  itemsLower: "items",
  category: "Category",
  categories: "Categories",
  categoryExample: "Popular",
  order: "order",
  orders: "Orders",
  customer: "customer",
  customers: "Customers",
  board: "Fulfilment board",
  boardIntro:
    "New orders land in the first column. Tap the big button as each one moves along — the customer's receipt updates at the same time.",
  boardEmpty: "Nothing waiting",
  columnLabels: ["New", "In progress", "Ready"],
  columnHints: ["Not started", "Being worked on", "Waiting to be handed over"],
  columnEmpty: [
    "New orders appear here automatically.",
    "Orders you start show up here.",
    "Finished orders wait here until they are handed over.",
  ],
  startAction: "Start",
  readyAction: "Mark ready",
  handoverAction: "Handed over",
  allowDispatch: true,
  importLabel: null,
  storefrontList: "Catalogue",
  storefrontBack: "Back to the catalogue",
  storefrontVerb: "order",
  storefrontBrowseLabel: "Browse the catalogue",
  addAction: "Add to cart",
  cartLabel: "Cart",
  cartTitle: "Your cart",
  checkoutAction: "Place order",
  receiptTitle: "Order received",
  statusReceived: "Received",
  statusDone: "Completed",
  payLaterLabel: "Cash on delivery",
  payLaterHint: "Pay when you receive it.",
  payAtStoreLabel: "Pay in person",
  payAtStoreHint: "For pickup.",
  fulfilmentNote:
    "Delivery or pickup is arranged with the business directly. Online payment is not enabled yet — you pay when you receive it.",
  notePlaceholder: "Anything the business should know…",
};

const GROUP_WORKSPACE: Record<string, Workspace> = {
  food: FOOD,
  wellness: WELLNESS,
  retail: RETAIL,
  services: SERVICES,
  learning: LEARNING,
  wholesale: WHOLESALE,
};

/**
 * Per-business refinements. Only the fields that differ from the vertical are
 * listed, so a salon inherits the wellness board and just calls its people
 * "Clients".
 */
const OVERRIDES: Record<string, Partial<Workspace>> = {
  /* Food */
  restaurant: { customer: "guest", customers: "Guests" },
  cafe: { customer: "guest", customers: "Guests" },
  "cloud-kitchen": { board: "Packing screen", customers: "Customers" },
  tiffin: {
    items: "Plans & meals",
    itemsLower: "plans",
    order: "subscription",
    orders: "Subscriptions",
    board: "Tiffin round",
    boardIntro:
      "Today's subscriptions land in the first column. Tap the big button as each tiffin is packed and handed to the delivery person.",
    boardEmpty: "No tiffins waiting",
    columnLabels: ["Due today", "Packing", "Ready to go"],
    columnHints: ["Paid or pay on delivery", "Being packed now", "Waiting for the delivery round"],
    columnEmpty: [
      "Today's subscriptions appear here automatically.",
      "Subscriptions you start packing show up here.",
      "Packed tiffins wait here until the round leaves.",
    ],
    startAction: "Start packing",
    readyAction: "Packed",
    handoverAction: "Sent out",
    storefrontList: "Plans",
    storefrontBack: "Back to the plans",
    storefrontVerb: "subscribe",
    storefrontBrowseLabel: "Browse the plans",
    addAction: "Choose plan",
    cartLabel: "Plans",
    cartTitle: "Your plan",
    checkoutAction: "Start the plan",
    receiptTitle: "Plan started",
    statusReceived: "Subscribed",
    notePlaceholder: "Delivery address, meal preference, skip days…",
  },
  caterer: {
    order: "event booking",
    orders: "Event bookings",
    customer: "client",
    customers: "Clients",
    board: "Event prep board",
    boardEmpty: "No events in prep",
    columnLabels: ["Confirmed", "In prep", "Ready to serve"],
    columnHints: ["Booked, not started", "Kitchen and decor are on it", "Loaded, ready on site"],
    columnEmpty: [
      "New event bookings appear here automatically.",
      "Events you start prepping show up here.",
      "Prepared events wait here until service begins.",
    ],
    startAction: "Start prep",
    readyAction: "Ready to serve",
    handoverAction: "Served",
    storefrontList: "Menus",
    storefrontBack: "Back to the menus",
  },
  grocery: {
    items: "Stock items",
    itemsLower: "stock items",
    order: "order",
    orders: "Orders",
    board: "Packing board",
    boardIntro:
      "New orders land in the first column. Tap the big button as you gather and pack each basket — the customer's receipt updates at the same time.",
    boardEmpty: "Nothing waiting to be packed",
    columnLabels: ["New orders", "Gathering", "Ready to send"],
    columnHints: ["Just placed", "Being picked from the shelves", "Packed, waiting for delivery"],
    columnEmpty: [
      "New orders appear here automatically.",
      "Orders you start gathering show up here.",
      "Packed baskets wait here until the delivery leaves.",
    ],
    startAction: "Start gathering",
    readyAction: "Mark packed",
    importLabel: null,
    storefrontList: "Shop",
    storefrontBack: "Back to the shop",
  },
  "meat-fish": { items: "Cuts", itemsLower: "cuts", importLabel: null },

  /* Wellness */
  spa: { customer: "guest", customers: "Guests" },
  makeup: { order: "booking", orders: "Bookings" },
  dental: {
    item: "treatment",
    items: "Treatments",
    itemsLower: "treatments",
    order: "appointment",
    orders: "Appointments",
    customer: "patient",
    customers: "Patients",
  },
  clinic: {
    item: "consultation",
    items: "Consultations",
    itemsLower: "consultations",
    customer: "patient",
    customers: "Patients",
    board: "Clinic board",
    startAction: "Call in",
    readyAction: "Consult finished",
  },
  gym: {
    item: "membership",
    items: "Memberships & classes",
    itemsLower: "memberships",
    category: "Plan type",
    categories: "Plan types",
    order: "sign-up",
    orders: "Sign-ups",
    customer: "member",
    customers: "Members",
    board: "Front desk board",
    boardIntro:
      "New sign-ups land in the first column. Tap the big button as you complete the joining formalities — the member's receipt updates at the same time.",
    boardEmpty: "No sign-ups waiting",
    columnLabels: ["New sign-ups", "Joining", "Active"],
    columnHints: ["Not started", "Paperwork or trial in progress", "Membership activated"],
    columnEmpty: [
      "New sign-ups appear here automatically.",
      "Sign-ups you start show up here.",
      "Activated memberships wait here until they are closed.",
    ],
    startAction: "Start joining",
    readyAction: "Activate",
    handoverAction: "Done",
    storefrontList: "Plans",
    storefrontBack: "Back to the plans",
    storefrontVerb: "join",
    storefrontBrowseLabel: "Browse the plans",
    addAction: "Join",
    cartLabel: "Sign-ups",
    cartTitle: "Your sign-up",
    checkoutAction: "Confirm sign-up",
    receiptTitle: "Sign-up received",
    statusReceived: "Signed up",
    notePlaceholder: "Preferred batch, trainer, joining date…",
  },
  yoga: {
    item: "class pack",
    items: "Class packs",
    itemsLower: "class packs",
    customer: "member",
    customers: "Members",
    order: "booking",
    orders: "Bookings",
  },
  physio: {
    item: "session",
    items: "Sessions",
    itemsLower: "sessions",
    customer: "patient",
    customers: "Patients",
    order: "appointment",
    orders: "Appointments",
  },

  /* Retail */
  boutique: { category: "Collection", categories: "Collections" },
  footwear: { category: "Collection", categories: "Collections" },
  jewellery: {
    items: "Pieces",
    itemsLower: "pieces",
    category: "Collection",
    categories: "Collections",
    order: "order",
    orders: "Orders",
    customer: "client",
    customers: "Clients",
  },
  cosmetics: { category: "Collection", categories: "Collections" },
  books: { item: "title", items: "Titles", itemsLower: "titles" },
  pets: { customer: "pet parent", customers: "Pet parents" },
  plants: { item: "plant", items: "Plants", itemsLower: "plants" },

  /* Services */
  "ac-repair": {
    order: "job card",
    orders: "Job cards",
    board: "Service board",
    columnLabels: ["New jobs", "On site", "Completed"],
    columnHints: ["Booked, technician not assigned", "Technician is working", "Fixed, waiting for the bill"],
    columnEmpty: [
      "New job cards appear here automatically.",
      "Jobs you start show up here.",
      "Finished jobs wait here until the invoice is closed.",
    ],
    startAction: "Start job",
    readyAction: "Job done",
    handoverAction: "Closed",
  },
  cleaning: { order: "booking", orders: "Bookings" },
  "car-care": {
    order: "booking",
    orders: "Bookings",
    customer: "client",
    customers: "Clients",
    board: "Bay board",
    boardEmpty: "No cars in the bay",
    columnLabels: ["Booked", "In the bay", "Ready for pickup"],
    columnHints: ["Slot booked", "Being washed or detailed", "Done, owner not collected yet"],
    columnEmpty: [
      "New bookings appear here automatically.",
      "Cars you start show up here.",
      "Finished cars wait here until they are collected.",
    ],
    startAction: "Start work",
    readyAction: "Job done",
    handoverAction: "Collected",
  },
  electronics: {
    order: "repair ticket",
    orders: "Repair tickets",
    board: "Repair bench",
    boardEmpty: "Nothing on the bench",
    columnLabels: ["Checked in", "On the bench", "Ready for pickup"],
    columnHints: ["Device received", "Being diagnosed or repaired", "Fixed, waiting for the customer"],
    columnEmpty: [
      "New repair tickets appear here automatically.",
      "Devices you start show up here.",
      "Fixed devices wait here until they are collected.",
    ],
    startAction: "Start repair",
    readyAction: "Repair done",
    handoverAction: "Collected",
  },
  electrician: { order: "job card", orders: "Job cards", customer: "client", customers: "Clients" },
  pest: { order: "booking", orders: "Bookings" },
  laundry: {
    item: "service",
    items: "Services",
    order: "ticket",
    orders: "Tickets",
    board: "Wash board",
    boardEmpty: "Nothing in the wash",
    columnLabels: ["Dropped off", "In process", "Ready for pickup"],
    columnHints: ["Received at the counter", "Washing, drying or ironing", "Bagged, waiting for the customer"],
    columnEmpty: [
      "New tickets appear here automatically.",
      "Clothes you start show up here.",
      "Bagged orders wait here until they are collected.",
    ],
    startAction: "Start washing",
    readyAction: "Mark ready",
    handoverAction: "Collected",
    importLabel: null,
  },
  photography: {
    item: "package",
    items: "Packages",
    itemsLower: "packages",
    order: "booking",
    orders: "Bookings",
    customer: "client",
    customers: "Clients",
    board: "Shoot board",
    boardEmpty: "No shoots scheduled",
    columnLabels: ["Booked", "Shooting / editing", "Delivered"],
    columnHints: ["Date booked", "On set or in editing", "Files handed over"],
    columnEmpty: [
      "New bookings appear here automatically.",
      "Bookings you start show up here.",
      "Finished work waits here until it is delivered.",
    ],
    startAction: "Start shoot",
    readyAction: "Editing done",
    handoverAction: "Delivered",
    importLabel: null,
  },
  "event-decor": {
    order: "event booking",
    orders: "Event bookings",
    customer: "client",
    customers: "Clients",
    board: "Event board",
    boardEmpty: "No events coming up",
  },
  "pet-care": {
    item: "service",
    items: "Services",
    order: "booking",
    orders: "Bookings",
    customer: "pet parent",
    customers: "Pet parents",
    board: "Grooming board",
  },

  /* Learning */
  coaching: {
    items: "Batches & courses",
    itemsLower: "batches",
    category: "Subject",
    categories: "Subjects",
    order: "enrolment",
    orders: "Enrolments",
  },
  tuition: {
    items: "Subjects & fees",
    itemsLower: "subjects",
    category: "Subject",
    categories: "Subjects",
    customer: "student",
    customers: "Students",
  },
  hobby: {
    item: "workshop",
    items: "Workshops",
    itemsLower: "workshops",
    order: "registration",
    orders: "Registrations",
  },
  dance: {
    item: "class",
    items: "Classes",
    itemsLower: "classes",
    order: "enrolment",
    orders: "Enrolments",
  },
  playschool: {
    item: "programme",
    items: "Programmes",
    itemsLower: "programmes",
    order: "admission",
    orders: "Admissions",
    customer: "parent",
    customers: "Parents",
    board: "Admissions board",
    boardEmpty: "No admission enquiries",
    columnLabels: ["New enquiries", "In process", "Admitted"],
    columnHints: ["Form received", "Visit or paperwork in progress", "Seat confirmed"],
    columnEmpty: [
      "New enquiries appear here automatically.",
      "Enquiries you start show up here.",
      "Admitted children wait here until they are closed.",
    ],
    startAction: "Start paperwork",
    readyAction: "Seat confirmed",
    handoverAction: "Closed",
    storefrontList: "Programmes",
    storefrontBack: "Back to the programmes",
    storefrontVerb: "apply",
    storefrontBrowseLabel: "Browse the programmes",
    addAction: "Apply",
    cartLabel: "Admissions",
    cartTitle: "Your application",
    checkoutAction: "Submit application",
    receiptTitle: "Application received",
    statusReceived: "Applied",
    notePlaceholder: "Child's name, age, preferred timing…",
  },
  event: {
    item: "ticket",
    items: "Passes & tables",
    itemsLower: "passes",
    order: "booking",
    orders: "Ticket sales",
    customer: "attendee",
    customers: "Attendees",
    board: "Event day board",
    boardEmpty: "No bookings yet",
    columnLabels: ["New bookings", "Confirming", "Confirmed"],
    columnHints: ["Just booked", "Payment or details being checked", "Pass issued"],
    columnEmpty: [
      "New bookings appear here automatically.",
      "Bookings you start confirming show up here.",
      "Confirmed passes wait here until the event.",
    ],
    startAction: "Start confirming",
    readyAction: "Confirmed",
    handoverAction: "Closed",
    storefrontList: "Passes",
    storefrontBack: "Back to the passes",
    addAction: "Book",
    cartLabel: "Bookings",
    cartTitle: "Your booking",
    checkoutAction: "Confirm booking",
    receiptTitle: "Booking confirmed",
    statusReceived: "Booked",
    statusDone: "Completed",
    notePlaceholder: "Number of guests, table preference…",
  },

  /* Wholesale */
  packaging: { item: "SKU", items: "SKUs" },
  hardware: { item: "SKU", items: "SKUs" },
  fabric: {
    item: "fabric",
    items: "Fabrics",
    itemsLower: "fabrics",
    category: "Fabric group",
    categories: "Fabric groups",
    customer: "buyer",
    customers: "Buyers",
  },
};

/** The vocabulary for one `businesses.industry` value. Never throws. */
export function workspaceFor(industry: string): Workspace {
  const group = industryGroupOf(industry);
  const base = (group && GROUP_WORKSPACE[group.value]) || OTHER;
  const overrides = OVERRIDES[industry];
  if (!overrides) return base;
  return { ...base, ...overrides };
}

/**
 * The status a customer sees on their own receipt. The stored status values
 * never change; only the words do, because a salon's ticket is "In service",
 * not "Preparing".
 */
export function storefrontStatus(status: string, ws: Workspace): string {
  switch (status) {
    case "new":
      return ws.statusReceived;
    case "accepted":
      return "Confirmed";
    case "preparing":
      return ws.columnLabels[1];
    case "ready":
      return ws.columnLabels[2];
    case "out_for_delivery":
      return "Out for delivery";
    case "delivered":
      return ws.statusDone;
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

/** "order" -> "Order", for the start of a sentence. */
export function sentenceStart(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}
