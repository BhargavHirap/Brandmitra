/**
 * THE TWO SCREENS THE CAROUSELS SHOW.
 *
 * These are drawn in markup rather than captured as images so they stay sharp,
 * stay small, and never go stale the way a screenshot does. They are simplified
 * views of the real dashboard and the real front desk — same labels, same order
 * of information — with example numbers, and the page says "example views" so
 * nobody reads the figures as a customer's.
 */

function Chrome({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[14px] border border-line bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04),0_28px_60px_-32px_rgba(16,24,40,0.22)]">
      <div className="flex items-center gap-1.5 border-b border-line bg-canvas/70 px-3 py-2">
        <span className="h-2 w-2 rounded-full bg-line" />
        <span className="h-2 w-2 rounded-full bg-line" />
        <span className="h-2 w-2 rounded-full bg-line" />
        <span className="ml-2 truncate text-[10px] text-muted">{label}</span>
      </div>
      <div className="p-3 sm:p-4">{children}</div>
    </div>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-[10px] border border-line bg-white px-2.5 py-2">
      <p className="text-[9.5px] uppercase tracking-[0.08em] text-muted">{label}</p>
      <p className="mt-0.5 text-[17px] font-medium tabular-nums leading-none">{value}</p>
      <p className="mt-1 text-[9.5px] text-muted">{hint}</p>
    </div>
  );
}

export function DashboardScreen() {
  return (
    <Chrome label="vantra / dashboard">
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <p className="text-[9.5px] uppercase tracking-[0.12em] text-muted">Today</p>
          <p className="text-[13px] font-medium">Vani&apos;s cafe</p>
        </div>
        <span className="rounded-full border border-line px-2 py-0.5 text-[9px] text-muted">Open</span>
      </div>

      <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric label="Orders" value="14" hint="3 to prepare" />
        <Metric label="Revenue" value="₹4,200" hint="Today" />
        <Metric label="Missed calls" value="2" hint="Call back" />
        <Metric label="Customers" value="126" hint="In the book" />
      </div>

      <div className="mt-2.5 rounded-[10px] border border-line">
        <div className="flex items-center justify-between border-b border-line px-2.5 py-1.5">
          <p className="text-[10px] font-medium">Orders queue</p>
          <span className="text-[9px] text-muted">Live</span>
        </div>
        <ul className="divide-y divide-line">
          {[
            ["#1042", "2 × Masala chai, 1 × Bun maska", "Preparing"],
            ["#1041", "1 × Filter coffee", "Ready"],
            ["#1040", "4 × Vada pav", "Delivered"],
          ].map(([id, items, status]) => (
            <li key={id} className="flex items-center gap-2 px-2.5 py-1.5">
              <span className="text-[9.5px] tabular-nums text-muted">{id}</span>
              <span className="truncate text-[10px]">{items}</span>
              <span className="ml-auto shrink-0 rounded-full bg-canvas px-1.5 py-0.5 text-[8.5px] text-muted">
                {status}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Chrome>
  );
}

export function DeskScreen() {
  return (
    <Chrome label="vantra / front desk">
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <p className="text-[9.5px] uppercase tracking-[0.12em] text-muted">Operate</p>
          <p className="text-[13px] font-medium">Front desk</p>
        </div>
        <span className="rounded-full border border-line px-2 py-0.5 text-[9px] text-muted">
          Hinglish
        </span>
      </div>

      <div className="mt-2.5 grid grid-cols-3 gap-2">
        <Metric label="Calls today" value="9" hint="2 missed" />
        <Metric label="Appointments" value="6" hint="4 slots free" />
        <Metric label="To call back" value="2" hint="Due soon" />
      </div>

      <div className="mt-2.5 rounded-[10px] border border-line">
        <div className="flex items-center justify-between border-b border-line px-2.5 py-1.5">
          <p className="text-[10px] font-medium">Next up</p>
          <span className="text-[9px] text-muted">Tomorrow</span>
        </div>
        <ul className="divide-y divide-line">
          {[
            ["Sunita Rao", "9:30 am", "Consultation"],
            ["Rakesh", "10:00 am", "Follow-up"],
            ["Meera Shah", "10:30 am", "Consultation"],
          ].map(([name, time, service]) => (
            <li key={name} className="flex items-center gap-2 px-2.5 py-1.5">
              <span className="text-[10px] font-medium">{name}</span>
              <span className="text-[9.5px] text-muted">{service}</span>
              <span className="ml-auto shrink-0 text-[9.5px] tabular-nums text-muted">{time}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-2.5 flex items-center gap-2 rounded-[10px] border border-line bg-canvas/60 px-2.5 py-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-success" />
        <p className="text-[9.5px] text-muted">
          WhatsApp confirmation sent · reminder queued for 8:30 am
        </p>
      </div>
    </Chrome>
  );
}

export const SCREENS = [
  {
    id: "dashboard",
    label: "The dashboard",
    line: "Orders, stock and money on one screen.",
    Screen: DashboardScreen,
  },
  {
    id: "front-desk",
    label: "The front desk",
    line: "Every call, slot and call-back, never in your head.",
    Screen: DeskScreen,
  },
] as const;
