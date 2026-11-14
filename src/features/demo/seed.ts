import { BANKS, COLORS, EXPENSES, FIRST_NAMES, LAST_NAMES, LOST_REASONS, MODELS, type CatalogModel } from "./catalog.ts";

// The demo store. Its WhatsApp is a placeholder until the founders pick a number (a confirmar).
export const DEMO_STORE = { name: "Maré Veículos", city: "João Pessoa - PB", whatsapp: "558390000000" } as const;

export type StaffKey = "renata" | "bruno" | "larissa" | "tiago";

// Fictional team: the .invalid domain never receives mail, so nobody can log in as them.
export const DEMO_STAFF: readonly { key: StaffKey; name: string; email: string; role: "manager" | "seller" }[] = [
  { key: "renata", name: "Renata Albuquerque", email: "renata@exemplo.invalid", role: "manager" },
  { key: "bruno", name: "Bruno Farias", email: "bruno@exemplo.invalid", role: "seller" },
  { key: "larissa", name: "Larissa Melo", email: "larissa@exemplo.invalid", role: "seller" },
  { key: "tiago", name: "Tiago Dantas", email: "tiago@exemplo.invalid", role: "seller" },
];

// Insert order: a table comes after every table it references (vehicles <-> sales is deferred).
export const DEMO_TABLES = [
  "channels", "channel_costs", "vehicles", "vehicle_finances", "vehicle_documents", "vehicle_expenses", "leads",
  "lead_contacts", "sales", "sale_finances", "sale_trade_ins", "reservations", "commission_rules", "goals", "store_expenses",
] as const;

export type DemoTable = (typeof DEMO_TABLES)[number];
export type DemoRow = Record<string, string | number | boolean | string[] | null>;
export type DemoData = Record<DemoTable, DemoRow[]>;

const DAY = 86_400_000;
const CHANNELS: [string, number][] = [
  ["OLX", 1290], ["Instagram", 600], ["Webmotors", 890], ["Mobiauto", 390], ["Indicação", 0], ["Passante", 0], ["Site", 0],
];
// Where sales come from, 50 slots; OLX and Instagram lead even after a partial cycle. Webmotors sells once, by hand.
const SALE_MIX: [string, number][] = [["OLX", 17], ["Instagram", 15], ["Indicação", 7], ["Passante", 5], ["Site", 3], ["Mobiauto", 3]];
// Where leads that did not buy come from; Webmotors brings leads that do not close.
const LEAD_MIX = ["OLX", "Instagram", "Webmotors", "OLX", "Instagram", "Mobiauto", "OLX", "Instagram", "Indicação", "Webmotors", "OLX", "Passante", "Instagram", "Site"];
const DOCUMENT_ITEMS = ["ipva", "fines", "inspection_report", "lien", "transfer_document", "spare_key", "manual"];

const addDays = (iso: string, days: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / DAY);
const isSunday = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay() === 0;
const minDate = (a: string, b: string) => (a < b ? a : b);
const maxDate = (a: string, b: string) => (a > b ? a : b);
const monthStart = (iso: string, monthsBack: number) => {
  const [year, month] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1 - monthsBack, 1)).toISOString().slice(0, 10);
};
// Store time is UTC-3 all year (no daylight saving in Paraíba).
const msAt = (iso: string, minutes: number) => Date.parse(`${iso}T00:00:00-03:00`) + minutes * 60_000;
const stamp = (ms: number) => `${new Date(ms - 3 * 3_600_000).toISOString().slice(0, 19)}-03:00`;
const round = (value: number, step: number) => Math.round(value / step) * step;
const slugify = (text: string) =>
  text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const thousands = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

// mulberry32: small, seeded, the same sequence on every run.
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Six months of the Maré Veículos, with every date counted back from `today` (store date, YYYY-MM-DD).
 * Rows carry the database column names, no store_id; ids come from `newId`.
 */
export function buildDemoData(input: { today: string; staff: Record<StaffKey, string>; newId: () => string }): DemoData {
  const { today, staff, newId } = input;
  const rand = seeded(0x6d617265);
  const int = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
  const pick = <T>(list: readonly T[]): T => list[Math.floor(rand() * list.length)];
  const shuffle = <T>(list: T[]): T[] => {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  };

  const data = Object.fromEntries(DEMO_TABLES.map((table) => [table, []])) as unknown as DemoData;
  const sellers = [staff.bruno, staff.larissa, staff.tiago];
  const nameOf = new Map(DEMO_STAFF.map((member) => [staff[member.key], member.name]));
  // Minutes to answer a new lead: Tiago is the slow one.
  const responseMinutes = (seller: string) =>
    seller === staff.tiago ? int(90, 300) : seller === staff.bruno ? int(8, 40) : int(5, 25);
  let phones = 0;
  const phone = () => `55839000${String(++phones).padStart(4, "0")}`;
  const person = () => `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
  const saleChannels = shuffle(SALE_MIX.flatMap(([name, slots]) => Array<string>(slots).fill(name)));

  const channel = new Map<string, string>();
  for (const [name, cost] of CHANNELS) {
    const id = newId();
    channel.set(name, id);
    data.channels.push({ id, name, active: true });
    for (let back = 6; back >= 0; back--) {
      data.channel_costs.push({ id: newId(), channel_id: id, month: monthStart(today, back), amount: cost });
    }
  }

  let vehicleCount = 0;
  function newVehicle(enteredOn: string, status: string, source: string, model: CatalogModel = pick(MODELS)): DemoRow {
    const n = ++vehicleCount;
    const [firstYear, lastYear] = model.years;
    const modelYear = int(firstYear, lastYear);
    const share = lastYear === firstYear ? 1 : (modelYear - firstYear) / (lastYear - firstYear);
    const price = round(model.prices[0] + share * (model.prices[1] - model.prices[0]), 1000) - 10;
    const km = Math.max(1, Number(today.slice(0, 4)) - modelYear + 1) * int(8, 15) * 1000 + int(0, 999);
    const color = pick(COLORS);
    const row: DemoRow = {
      id: newId(),
      slug: `${slugify(`${model.brand} ${model.model}`)}-${modelYear}-${n}`,
      brand: model.brand,
      model: model.model,
      version: model.version,
      model_year: modelYear,
      manufacture_year: rand() < 0.4 ? modelYear - 1 : modelYear,
      km,
      color,
      fuel: model.fuel,
      transmission: model.transmission,
      body_type: model.bodyType,
      doors: model.doors,
      engine: model.engine,
      power: model.power,
      description: `${model.model} ${model.version} ${modelYear}, ${thousands(km)} km, cor ${color.toLowerCase()}. Revisado, com garantia de 90 dias e documentação conferida pela loja.`,
      features: model.features,
      plate: `ZZZ${Math.floor(n / 100) % 10}${String.fromCharCode(65 + (n % 26))}${String(n % 100).padStart(2, "0")}`,
      renavam: null,
      chassis: null,
      price,
      min_cash_price: price - pick([2000, 3000]),
      status,
      away_reason: null,
      away_until: null,
      removed_reason: null,
      source,
      acquired_in_sale_id: null,
      entered_on: enteredOn,
      featured: false,
    };
    data.vehicles.push(row);
    return row;
  }

  function finance(vehicle: DemoRow, purchasePrice: number, consigned = false) {
    const payout = consigned ? round((vehicle.price as number) * 0.9, 500) : null;
    data.vehicle_finances.push({
      vehicle_id: vehicle.id,
      purchase_price: purchasePrice,
      consignor_name: consigned ? person() : null,
      consignor_phone: consigned ? phone() : null,
      consignor_payout: payout,
    });
  }
  const purchaseOf = (vehicle: DemoRow) => round((vehicle.price as number) * (0.82 + rand() * 0.07), 500);

  function expenses(vehicle: DemoRow, from: string, to: string, count: number) {
    for (let i = 0; i < count; i++) {
      const [category, description, min, max] = pick(EXPENSES);
      data.vehicle_expenses.push({
        id: newId(),
        vehicle_id: vehicle.id,
        category,
        spent_on: addDays(from, int(0, Math.max(0, daysBetween(from, to)))),
        amount: round(int(min, max), 10),
        description,
        created_by: staff.renata,
      });
    }
  }

  type LeadFields = Partial<DemoRow> & { name: string; channel_id: string; seller_id: string; stage: string; created_at: string };
  function lead(fields: LeadFields): DemoRow {
    const row: DemoRow = {
      id: newId(), phone: phone(), interest: null, vehicle_id: null, note: null, first_response_at: null,
      last_contact_at: null, visit_on: null, visit_time: null, came_on: null, call_back_on: null, lost_reason: null,
      closed_at: null, ...fields,
    };
    data.leads.push(row);
    return row;
  }
  function contact(leadRow: DemoRow, kind: string, happenedAt: unknown) {
    if (!happenedAt) return;
    data.lead_contacts.push({ id: newId(), lead_id: leadRow.id, member_id: leadRow.seller_id, kind, happened_at: happenedAt as string, note: null });
  }

  // Sales: 2 or 3 a week over 26 weeks, never on Sunday.
  const saleDates: string[] = [];
  for (let week = 25; week >= 0; week--) {
    const days: string[] = [];
    for (let k = 6; k >= 0; k--) {
      const date = addDays(today, -(week * 7 + k));
      if (!isSunday(date)) days.push(date);
    }
    saleDates.push(...shuffle(days).slice(0, rand() < 0.5 ? 2 : 3).sort());
  }
  const month = today.slice(0, 7);
  const oldEnough = saleDates.findIndex((date, i) => date <= addDays(today, -60) && saleChannels[i % 50] === "Passante");
  const webmotorsSale = oldEnough >= 0 ? oldEnough : 0;
  let tiagoThisMonth = false;
  let monthTurn = 0;
  let pendingTransfers = 0;
  const tradeInsWaiting: DemoRow[] = [];

  saleDates.forEach((soldOn, i) => {
    let seller: string;
    if (!soldOn.startsWith(month)) seller = [staff.bruno, staff.larissa, staff.bruno, staff.larissa, staff.tiago][i % 5];
    else if (!tiagoThisMonth && Number(soldOn.slice(8)) >= 15) {
      seller = staff.tiago; // Tiago sells once, late in the month: behind his goal
      tiagoThisMonth = true;
    } else seller = monthTurn++ % 2 === 0 ? staff.bruno : staff.larissa;

    // A trade-in waiting 30 days or more is sold first; otherwise a car bought for this sale.
    const ready = tradeInsWaiting.findIndex((v) => (v.entered_on as string) <= addDays(soldOn, -30));
    let car: DemoRow;
    if (ready >= 0) car = tradeInsWaiting.splice(ready, 1)[0];
    else {
      const enteredOn = addDays(soldOn, -int(12, 80));
      const consigned = rand() < 0.1;
      car = newVehicle(enteredOn, "sold", consigned ? "consignment" : "purchase");
      finance(car, consigned ? 0 : purchaseOf(car), consigned);
      expenses(car, enteredOn, soldOn, int(1, 3));
    }
    car.status = "sold";

    const createdOn = addDays(soldOn, -int(2, 20));
    const createdMs = msAt(createdOn, int(8 * 60, 18 * 60));
    const won = lead({
      name: person(),
      channel_id: channel.get(i === webmotorsSale ? "Webmotors" : saleChannels[i % 50])!,
      seller_id: seller,
      stage: "won",
      interest: `${car.model} ${car.version}`,
      vehicle_id: car.id,
      created_at: stamp(createdMs),
      first_response_at: stamp(createdMs + responseMinutes(seller) * 60_000),
      came_on: maxDate(createdOn, addDays(soldOn, -int(0, 3))),
      last_contact_at: stamp(msAt(soldOn, int(9 * 60, 12 * 60))),
      closed_at: stamp(msAt(soldOn, int(13 * 60, 17 * 60))),
    });
    contact(won, "whatsapp", won.first_response_at);
    contact(won, "visit", stamp(msAt(won.came_on as string, int(9 * 60, 17 * 60))));

    const financed = i % 2 === 0;
    const price = (car.price as number) - pick([0, 500, 1000, 1500, 2000]);
    let transferDoneOn: string | null = null;
    if (soldOn <= addDays(today, -25)) {
      // The first two sales between 25 and 45 days ago still wait for the transfer.
      if (soldOn >= addDays(today, -45) && pendingTransfers < 2) pendingTransfers++;
      else transferDoneOn = addDays(soldOn, int(5, 20));
    }
    const sale: DemoRow = {
      id: newId(),
      vehicle_id: car.id,
      lead_id: won.id,
      seller_id: seller,
      seller_name: nameOf.get(seller)!,
      sold_on: soldOn,
      price,
      payment: financed ? "financing" : "cash",
      bank: financed ? pick(BANKS) : null,
      financed_amount: financed ? round(price * (0.4 + rand() * 0.4), 100) : null,
      trade_in_vehicle_id: null,
      warranty_until: addDays(soldOn, 90),
      transfer_done_on: transferDoneOn,
    };
    data.sales.push(sale);
    if (financed) data.sale_finances.push({ sale_id: sale.id, financing_return_pct: 0.02 + 0.005 * int(0, 8) });

    if (i % 6 === 3) {
      const tradeIn = newVehicle(soldOn, "preparing", "trade_in", pick(MODELS.filter((m) => m.prices[1] <= 100_000)));
      const value = round((tradeIn.price as number) * 0.84, 500);
      tradeIn.acquired_in_sale_id = sale.id;
      sale.trade_in_vehicle_id = tradeIn.id;
      data.sale_trade_ins.push({ sale_id: sale.id, trade_in_value: value });
      finance(tradeIn, value);
      expenses(tradeIn, soldOn, minDate(addDays(soldOn, 10), today), 1);
      tradeInsWaiting.push(tradeIn);
    }
  });

  // Stock: trade-ins not sold yet, 2 parked for months, 3 consigned, 1 away for service, the rest bought.
  const stock: DemoRow[] = [...tradeInsWaiting];
  const expensive = MODELS.filter((m) => m.prices[1] >= 120_000);
  for (const daysAgo of [131, 104]) {
    const car = newVehicle(addDays(today, -daysAgo), "available", "purchase", pick(expensive));
    finance(car, purchaseOf(car));
    expenses(car, car.entered_on as string, today, 2);
    stock.push(car);
  }
  for (let i = 0; i < 3; i++) {
    const car = newVehicle(addDays(today, -int(10, 60)), "available", "consignment");
    finance(car, 0, true);
    expenses(car, car.entered_on as string, today, 1);
    stock.push(car);
  }
  const away = newVehicle(addDays(today, -int(20, 60)), "away", "purchase");
  Object.assign(away, { away_reason: "service", away_until: addDays(today, 5) });
  finance(away, purchaseOf(away));
  stock.push(away);
  const bought: DemoRow[] = [];
  while (stock.length + bought.length < 22) {
    const car = newVehicle(addDays(today, -int(3, 85)), "available", "purchase");
    finance(car, purchaseOf(car));
    expenses(car, car.entered_on as string, today, bought.length < 6 ? int(1, 3) : int(0, 2));
    bought.push(car);
  }
  bought[0].min_cash_price = null; // margin not set yet: the panel asks for it
  bought[1].min_cash_price = null;
  stock.push(...bought);
  for (const car of stock) {
    if (car.status !== "away") car.status = (car.entered_on as string) >= addDays(today, -7) ? "preparing" : "available";
  }
  for (const car of stock.filter((v) => v.status === "available").slice(-4)) car.featured = true;

  const pendingDocs = new Map<unknown, string>([
    [bought[2].id, "ipva"], [bought[3].id, "ipva"], [bought[4].id, "transfer_document"], [stock[0].id, "inspection_report"],
  ]);
  for (const car of stock) {
    for (const item of DOCUMENT_ITEMS) {
      const status = pendingDocs.get(car.id) === item ? "pending" : item === "lien" ? "not_applicable" : "ok";
      data.vehicle_documents.push({ id: newId(), vehicle_id: car.id, item, status, note: null });
    }
  }

  // Leads that did not buy, over the six months.
  const lostCount = Math.round(saleDates.length * 1.4);
  for (let j = 0; j < lostCount; j++) {
    const seller = sellers[j % 3];
    const createdOn = addDays(today, -int(8, 178));
    const createdMs = msAt(createdOn, int(8 * 60, 18 * 60));
    const closedOn = minDate(addDays(createdOn, int(3, 20)), addDays(today, -1));
    const lost = lead({
      name: person(),
      channel_id: channel.get(LEAD_MIX[j % LEAD_MIX.length])!,
      seller_id: seller,
      stage: "lost",
      interest: `${pick(MODELS).model}`,
      created_at: stamp(createdMs),
      first_response_at: stamp(createdMs + responseMinutes(seller) * 60_000),
      last_contact_at: stamp(Math.max(createdMs + 6 * 3_600_000, msAt(closedOn, int(9 * 60, 12 * 60)))),
      lost_reason: pick(LOST_REASONS),
      closed_at: stamp(Math.max(createdMs + 7 * 3_600_000, msAt(closedOn, int(13 * 60, 17 * 60)))),
    });
    contact(lost, "whatsapp", lost.first_response_at);
    contact(lost, "call", lost.last_contact_at);
  }

  // Open funnel: 3 new leads still unanswered, 4 left without contact for days.
  const forSale = stock.filter((v) => v.status === "available");
  const stages = [
    ...Array<string>(6).fill("new"), ...Array<string>(5).fill("visit_scheduled"),
    ...Array<string>(7).fill("negotiating"), ...Array<string>(7).fill("call_back"),
  ];
  const turn = new Map<string, number>();
  let reserved = false;
  stages.forEach((stage, k) => {
    const nth = turn.get(stage) ?? 0;
    turn.set(stage, nth + 1);
    const seller = sellers[k % 3];
    const stale = (stage === "negotiating" || stage === "call_back") && nth < 2;
    const createdOn = addDays(today, stage === "new" ? -int(1, 3) : stale ? -int(12, 20) : -int(2, 20));
    const createdMs = msAt(createdOn, int(8 * 60, 18 * 60));
    const unanswered = stage === "new" && nth < 3;
    const firstMs = createdMs + responseMinutes(seller) * 60_000;
    const lastOn = stale ? addDays(today, -int(5, 9)) : maxDate(createdOn, addDays(today, -int(1, 2)));
    const car = pick(forSale);
    const open = lead({
      name: person(),
      channel_id: channel.get(LEAD_MIX[(k * 5) % LEAD_MIX.length])!,
      seller_id: seller,
      stage,
      interest: `${car.model} ${car.version}`,
      vehicle_id: car.id,
      created_at: stamp(createdMs),
      first_response_at: unanswered ? null : stamp(firstMs),
      last_contact_at: unanswered ? null : stamp(Math.max(firstMs + 3_600_000, msAt(lastOn, int(9 * 60, 17 * 60)))),
      visit_on: stage === "visit_scheduled" ? addDays(today, int(0, 6)) : null,
      visit_time: stage === "visit_scheduled" ? pick(["09:30", "10:00", "14:00", "15:30", "17:00"]) : null,
      call_back_on: stage === "call_back" ? addDays(today, int(-2, 5)) : null,
    });
    contact(open, "whatsapp", open.first_response_at);
    if (open.last_contact_at !== open.first_response_at) contact(open, "call", open.last_contact_at);

    if (stage === "negotiating" && !stale && !reserved) {
      reserved = true;
      data.reservations.push({
        id: newId(),
        vehicle_id: car.id,
        lead_id: open.id,
        deposit: 2000,
        expires_on: addDays(today, 2),
        created_by: seller,
        canceled_at: null,
        created_at: stamp(msAt(addDays(today, -1), 11 * 60)),
      });
    }
  });

  data.commission_rules.push(
    { id: newId(), member_id: null, kind: "fixed", value: 350 },
    { id: newId(), member_id: staff.larissa, kind: "profit_pct", value: 0.1 },
  );
  for (let back = 6; back >= 0; back--) {
    const first = monthStart(today, back);
    data.goals.push({ id: newId(), month: first, member_id: null, cars: 12 });
    for (const seller of sellers) data.goals.push({ id: newId(), month: first, member_id: seller, cars: 4 });
    const fixed: [string, string, number][] = [
      ["rent", "Aluguel do galpão", 6500],
      ["payroll", "Salários e encargos", 9800],
      ["accountant", "Contador", 900],
      ["utilities", "Energia, água e internet", 1000 + int(0, 30) * 10],
      ["other", "Material de limpeza e café", 400 + int(0, 60) * 10],
    ];
    for (const [category, description, amount] of fixed) {
      data.store_expenses.push({ id: newId(), month: first, category, description, amount });
    }
  }
  return data;
}
